import * as pulumi from "@pulumi/pulumi";
import * as pulumiservice from "@pulumi/pulumiservice";
import * as command from "@pulumi/command";
import * as yaml from "yaml"

const config = new pulumi.Config();
const envRef = config.require("envRef")
const [envOrg, envProj, envName] = envRef.split("/")

// Monitor the referenced environment and rerun ourself whenever it updates.
new pulumiservice.Webhook("update-rotation-schedules-when-esc-environment-updates", {
    organizationName: envOrg,
    projectName: envProj,
    environmentName: envName,
    displayName: "update rotation schedules",
    filters: [
        "environment_revision_created",
    ],
    format: "pulumi_deployments",
    active: true,
    payloadUrl: pulumi.interpolate`${pulumi.getProject()}/${pulumi.getStack()}` // update self
})

// Get the current environment definition
const env = new command.local.Command("parse-env", {
    create: `pulumi env get ${envRef} --value=json`,
    triggers: [Date.now()],
    logging: "none",
})
env.stdout.apply(envYaml => {
    const envDefinition = yaml.parse(envYaml)

    // walk the environment definition looking for `xfn::pulumi-scheduled-update` configs
    collect(envDefinition, "xfn::pulumi-scheduled-update").map(schedule => {
        const stackRef: string = schedule.args["stack"] || ""
        const scheduleCron: string | undefined = schedule.args["scheduleCron"]
        const trigger: string | undefined = schedule.args["trigger"]

        const organization = pulumi.getOrganization()
        const [project, stack] = stackRef.split("/")

        // if scheduleCron is specified, create a scheduled update for the referenced stack
        if (scheduleCron) {
            new pulumiservice.DeploymentSchedule(`${schedule.path}-scheduled-rotation`, {
                organization, project, stack,
                scheduleCron,
                pulumiOperation: "update",
            })
        }

        // if trigger changes, create an immediate update for the referenced stack
        if (trigger) {
            const immediate = new command.local.Command(`${schedule.path}-trigger-timestamp`, {
                create: 'date --iso-8601=seconds',
                triggers: [trigger]
            })
            new pulumiservice.DeploymentSchedule(`${schedule.path}-immediate-rotation`, {
                organization, project, stack,
                timestamp: immediate.stdout,
                pulumiOperation: "update",
            }, {replaceOnChanges: ["*"], retainOnDelete: true})
        }
    })
});

// janky parser that walks a tree looking for keys named `needle`
// returns a list of ESC paths to the found values.
// (since we're using this to find fn configurations we leave off the final key in the path, like ESC paths to function outputs)
function collect(tree: any, needle: string): { path: string, args: any }[] {
    function walk(node: any, path: string): { path: string, args: any }[] {
        if (Array.isArray(node)) {
            return node.flatMap((item, index) => walk(item, `${path}[${index}]`))
        }

        if (typeof node === 'object' && node !== null) {
            return Object.entries(node).flatMap(([key, val]) => {
                if (key === needle) {
                    return [{path: path.slice(1,), args: val}]
                }
                return walk(val, `${path}.${key}`)
            })
        }

        return []
    }

    return walk(tree, "")
}
