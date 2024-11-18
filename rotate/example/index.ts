import * as pulumi from "@pulumi/pulumi";
import * as pulumiservice from "@pulumi/pulumiservice";
// import * as auto from "@pulumi/pulumi/automation"

const config = new pulumi.Config();

const env = new pulumiservice.Environment("example", {
    organization: pulumi.getOrganization(),
    project: pulumi.getProject(),
    name: pulumi.getStack(),
    yaml: new pulumi.asset.FileAsset("./exampleEnv.yaml"),
})

// rotatorStack is an example of a stack that is responsible for provisioning fresh credentials each deployment.
const rotatorStack = new pulumiservice.Stack("example-rotator", {
    organizationName: pulumi.getOrganization(),
    projectName: "esc-example-rotator",
    stackName: pulumi.getStack(),
})

new pulumiservice.DeploymentSettings("example-rotator", {
    organization: rotatorStack.organizationName,
    project: rotatorStack.projectName,
    stack: rotatorStack.stackName,
    sourceContext: {
        git: {
            repoUrl: "https://github.com/pulumi/esc-examples",
            repoDir: "rotate/example/rotator",
            branch: "claire/esc-rotation-example",
        }
    },
    operationContext: {
        preRunCommands: [
            // `...`
        ],
        options: {
            skipIntermediateDeployments: true,
        },
    },
    cacheOptions: {
        enable: true,
    }
})

// schedularStack watches the ESC environment for edits and reschedules deployments of the rotatorStack when necessary.
const schedularStack = new pulumiservice.Stack("scheduler", {
    organizationName: pulumi.getOrganization(),
    projectName: "esc-rotation-scheduler",
    stackName: pulumi.getStack(),
})

new pulumiservice.DeploymentSettings("scheduler", {
    organization: schedularStack.organizationName,
    project: schedularStack.projectName,
    stack: schedularStack.stackName,
    sourceContext: {
        git: {
            repoUrl: "https://github.com/pulumi/esc-examples",
            repoDir: "rotate/example/scheduler",
            branch: "claire/esc-rotation-example",
        }
    },
    operationContext: {
        preRunCommands: [
            // tell the scheduler which environment to watch
            pulumi.interpolate`pulumi config set envRef ${env.id}`
        ],
        options: {
            skipIntermediateDeployments: true,
        },
    },
    cacheOptions: {
        enable: true,
    }
})

new pulumiservice.Webhook("update-rotation-schedules-when-esc-environment-updates", {
    organizationName: pulumi.getOrganization(),
    projectName: pulumi.getProject(),
    environmentName: env.name,
    displayName: "update rotation schedules",
    filters: [
        "environment_revision_created",
    ],
    format: "pulumi_deployments",
    active: true,
    // I'm not sure where this is documented??
    payloadUrl: pulumi.interpolate`${schedularStack.projectName}/${schedularStack.stackName}`
})