import * as pulumi from "@pulumi/pulumi";
import * as service from "@pulumi/pulumiservice";

const orgName = "pulumi";

const env = new service.Environment("env", {
    organization: orgName,
    name: "esc-sync-aws-secretsmanager",
  yaml: new pulumi.asset.StringAsset(
`imports:
  - dev-sandbox
values:
  mySyncedKey:
    myConfigKey: myImportantValue
    myNestedKey:
      haha: business
    mySecret: \${aws.login.accessKeyId}
`
  )
})

const stack = new service.Stack("esc-sync-aws-secretsmanager", {
    organizationName: orgName,
    projectName: "esc-sync-aws-secretsmanager",
    stackName: "dev",
})

const settings = new service.DeploymentSettings("deployment_settings", {
    organization: orgName,
    project: stack.projectName,
    stack: stack.stackName,
    github: {
        repository: "pulumi/esc-examples",
    },
    sourceContext: {
        git: {
            branch: "main",
            repoDir: "sync/aws-secretsmanager",
        }
    },
    operationContext: {
        preRunCommands: [
            'pulumi login',
            pulumi.interpolate`pulumi config env add ${env.name} --yes`,
            pulumi.interpolate`pulumi env open ${env.name} mySyncedKey > sync.json`,
        ]
    }
});

const schedule = new service.DeploymentSchedule("schedule", {
    organization: orgName,
    project: settings.project,
    stack: settings.stack,
    scheduleCron: "*/5 * * * *",
    pulumiOperation: "update",
})

