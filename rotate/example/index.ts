import * as pulumi from "@pulumi/pulumi";
import * as pulumiservice from "@pulumi/pulumiservice";

const env = new pulumiservice.Environment("example", {
    organization: pulumi.getOrganization(),
    project: pulumi.getProject(),
    name: pulumi.getStack(),
    yaml: pulumi.interpolate`
values:
  rotation-example:
    stack: esc-example-credential-rotator/${pulumi.getStack()}
    rotate:
      xfn::pulumi-scheduled-update:
        stack: \${rotation-example.stack}
        scheduleCron: "0 0 * * 0" # weekly
        trigger: "break-glass" # rotate immediately if changed
    outputs:
      fn::open::pulumi-stacks:
        stacks:
          example-creds:
            stack: \${rotation-example.stack}

  environmentVariables:
    DB_CONNECTION_STRING: \${rotation-example.outputs.example-creds.current}
`,
})

// rotatorStack is an example of a stack that is responsible for provisioning fresh credentials each deployment.
const rotatorStack = new pulumiservice.Stack("rotator", {
    organizationName: pulumi.getOrganization(),
    projectName: "esc-example-credential-rotator",
    stackName: pulumi.getStack(),
})

const rotatorDeploySettings = new pulumiservice.DeploymentSettings("rotator", {
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
        options: {
            // don't double rotate
            skipIntermediateDeployments: true,
        },
    },
    cacheOptions: {
        enable: true,
    }
})

const rotatorBootstrap = new pulumiservice.DeploymentSchedule("rotator-bootstrap", {
    organization: pulumi.getOrganization(),
    project: rotatorStack.projectName,
    stack: rotatorStack.stackName,
    pulumiOperation: "update",
    timestamp: new Date().toISOString(),
}, {retainOnDelete: true, ignoreChanges: ["timestamp"], dependsOn: [rotatorDeploySettings]})

// schedulerStack watches the ESC environment for edits and reschedules deployments of the rotatorStack when necessary.
const schedulerStack = new pulumiservice.Stack("scheduler", {
    organizationName: pulumi.getOrganization(),
    projectName: "esc-rotation-scheduler",
    stackName: pulumi.getStack(),
})

const schedulerDeploySettings = new pulumiservice.DeploymentSettings("scheduler", {
    organization: schedulerStack.organizationName,
    project: schedulerStack.projectName,
    stack: schedulerStack.stackName,
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
            // only care about latest config
            skipIntermediateDeployments: true,
        },
    },
    cacheOptions: {
        enable: true,
    }
})

const schedulerBootstrap = new pulumiservice.DeploymentSchedule("scheduler-bootstrap", {
    organization: pulumi.getOrganization(),
    project: schedulerStack.projectName,
    stack: schedulerStack.stackName,
    pulumiOperation: "update",
    timestamp: new Date().toISOString(),
}, {retainOnDelete: true, ignoreChanges: ["timestamp"], dependsOn: [schedulerDeploySettings, rotatorBootstrap]})