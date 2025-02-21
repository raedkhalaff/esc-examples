import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as pulumiservice from "@pulumi/pulumiservice";

// Step 1: Set up OpenID Connect.
// See https://www.pulumi.com/docs/pulumi-cloud/access-management/oidc/provider/aws/

// Create an identity provider to link your pulumi organization and aws accounts
// If you've done this previously, you can fetch your existing provider instead:
// const oidcProvider = aws.iam.OpenIdConnectProvider.get("oidc-provider", pulumi.interpolate`arn:aws:iam::${aws.getCallerIdentityOutput().accountId}:oidc-provider/api.pulumi.com/oidc`)
const oidcProvider = new aws.iam.OpenIdConnectProvider("oidc", {
    url: "https://api.pulumi.com/oidc",
    clientIdLists: [`aws:${pulumi.getOrganization()}`]
})

// Create a WebIdentity trust policy.
// This policy allows a role to be assumed by anyone in your pulumi org who can open the `esc-rotation-demo/managing-creds` environment
// See https://www.pulumi.com/docs/pulumi-cloud/access-management/oidc/provider/aws/#pulumi-esc for how to customize this.
const oidcTrustPolicy = {
    Version: "2012-10-17",
    Statement: [
        {
            Effect: "Allow",
            Principal: {
                Federated: oidcProvider.arn,
            },
            Action: "sts:AssumeRoleWithWebIdentity",
            Condition: {
                StringEquals: {
                    "api.pulumi.com/oidc:aud": `aws:${pulumi.getOrganization()}`,
                    "api.pulumi.com/oidc:sub": `pulumi:environments:pulumi.organization.login:${pulumi.getOrganization()}:currentEnvironment.name:esc-rotation-demo/managing-creds`
                },
            },
        },
    ],
};

// Step 2: Provision a minimal managing role.
// This role will be assumed by the rotator to update the access keys of your iam user.
// The role is scoped so it can only act on iam users in the `/esc/rotated/` path, so we can opt into which users are allowed to be rotated.
// See https://aws.amazon.com/blogs/security/optimize-aws-administration-with-iam-paths/
const managingRole = new aws.iam.Role("esc-iam-rotator-oidc", {
    assumeRolePolicy: pulumi.jsonStringify(oidcTrustPolicy), // allow this role to be assumed by the oidc provider
    inlinePolicies: [{
        name: "RotateAccessKeys",
        policy: pulumi.jsonStringify({
            Version: "2012-10-17",
            Statement: [
                {
                    Effect: "Allow",
                    Action: [
                        "iam:ListAccessKeys",
                        "iam:CreateAccessKey",
                        "iam:DeleteAccessKey"
                    ],
                    Resource: "arn:aws:iam::*:user/esc/rotated/*"
                }
            ]
        }),
    }]
})

// Step 3: Create an environment with managing credentials.
// This environment will provide credentials to the rotator that allow it to assume the managing role.
// You can restrict access to this environment to just those users who need the ability to do on-demand rotation.
const creds = new pulumiservice.Environment("managing-creds", {
    organization: pulumi.getOrganization(),
    project: "esc-rotation-demo",
    name: "managing-creds",
    yaml: pulumi.interpolate`
values:
  aws:
    login:
      fn::open::aws-login:
        oidc:
          duration: 1h
          roleArn: ${managingRole.arn}
          sessionName: pulumi-environments-session
          subjectAttributes:
          - currentEnvironment.name
    `
})

// Step 4: Create a user to rotate.
// This user is created in the /esc/rotated/ path, so it can be updated by the managing role.
const rotatedUser = new aws.iam.User("rotated-user", {
    path: "/esc/rotated/",
})

// (fixme: currently need to strip the path from the arn, because fn::rotate::aws-iam thinks it makes the username invalid)
const rotatedUserArn = rotatedUser.arn.apply(arn => arn.replace("/esc/rotated", ""));

// Step 5: Create an environment with rotation configuration.
// This uses an inline reference to the managing credentials in the other environment. This reference is only resolved during rotation,
// not during open, so users who have permission to OPEN this environment don't necessarily need access to the managing creds environment.
const rotated = new pulumiservice.Environment("rotated-environment", {
    organization: pulumi.getOrganization(),
    project: "esc-rotation-demo",
    name: "rotated-creds",
    yaml: pulumi.interpolate`
values:
  rotated-creds:
    fn::rotate::aws-iam:
      inputs:
        region: us-west-1
        login: \${environments.${creds.project}.${creds.name}.aws.login}
        userArn: ${rotatedUserArn}
    `
})

// Step 6: Set up rotation schedule.
// The iam user does not yet have an access key, so you'll want to perform an initial manual rotation on the `esc-rotation-demo/rotated-creds` environment.
// Afterwards you can use this URL to set up a schedule for periodic automatic rotation.
export const url = pulumi.interpolate`https://app.pulumi.com/${pulumi.getOrganization()}/esc/${rotated.project}/${rotated.name}/rotations`
