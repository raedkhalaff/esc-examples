import * as pulumi from "@pulumi/pulumi";
import * as service from "@pulumi/pulumiservice";

const config = new pulumi.Config();
const orgName = pulumi.getOrganization();

const projectName = config.require("projectName");
const stackName = config.get("stackName") || "dev";
const repository = config.require("repository");
const syncCronSchedule = config.get("syncCronSchedule") || "0 * * * *";
const envPath = config.get("envPath") || "syncEnv.yaml";

const env = new service.Environment("env", {
    organization: orgName,
    name: `${projectName}-${stackName}`,
    yaml: new pulumi.asset.FileAsset(envPath),
});

const stack = new service.Stack("esc-sync-github-secrets", {
    organizationName: orgName,
    projectName,
    stackName,
});

const fullyQualifiedStackName = pulumi.interpolate`${orgName}/${projectName}/${stackName}`;
const fullyQualifiedEnvName = pulumi.interpolate`${orgName}/${env.name}`;

const settings = new service.DeploymentSettings("deployment_settings", {
    organization: orgName,
    project: stack.projectName,
    stack: stack.stackName,
    github: {
        repository,
    },
    sourceContext: {
        git: {
            branch: "main",
            repoDir: "sync/target",
        },
    },
    operationContext: {
        preRunCommands: [
            "pulumi login",
            pulumi.interpolate`pulumi config env add ${env.name} -s ${fullyQualifiedStackName} --yes`,
            pulumi.interpolate`pulumi env open ${fullyQualifiedEnvName} sync.githubSecrets.value > sync.json`,
        ],
    },
});

const schedule = new service.DeploymentSchedule("update_schedule", {
    organization: orgName,
    project: settings.project,
    stack: settings.stack,
    scheduleCron: syncCronSchedule,
    pulumiOperation: "update",
});
