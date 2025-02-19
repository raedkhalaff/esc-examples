import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as pulumiservice from "@pulumi/pulumiservice";

// Step 1: set up oidc

// const oidcProvider = new aws.iam.OpenIdConnectProvider("oidc", {
//     url: "https://api.pulumi.com/oidc",
//     clientIdLists: [`aws:${pulumi.getOrganization()}`]
// })

const oidcProvider = aws.iam.OpenIdConnectProvider.get("oidc-provider", pulumi.interpolate`arn:aws:iam::${aws.getCallerIdentityOutput().accountId}:oidc-provider/api.pulumi.com/oidc`)

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
                },
            },
        },
    ],
};

// Step 2: provision a minimal managing role
const managingRole = new aws.iam.Role("esc-iam-rotator-oidc", {
    assumeRolePolicy: pulumi.jsonStringify(oidcTrustPolicy),
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
                    // scope this role to only acting on iam users in the /esc/rotated path
                    Resource: "arn:aws:iam::*:user/esc/rotated/*"
                }
            ]
        }),
    }]
})

// Step 3: create an environment with managing user credentials
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
    `
})

// Step 4: create a user to rotate
const rotatedUser = new aws.iam.User("rotated-user", {
    path: "/esc/rotated/",
})

// fixme: need to strip the path from the arn, because fn::rotate::aws-iam thinks it makes the username invalid
const rotatedUserArn = rotatedUser.arn.apply(arn => arn.replace("/esc/rotated", ""));

// Step 5: create an environment with rotation configuration
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

// Step 6: set up rotation schedule
export const url = pulumi.interpolate`https://app.pulumi.com/${pulumi.getOrganization()}/esc/${rotated.project}/${rotated.name}/rotations`
