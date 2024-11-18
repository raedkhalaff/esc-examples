import * as pulumi from "@pulumi/pulumi";
import * as pulumiservice from "@pulumi/pulumiservice";
import * as command from "@pulumi/command";
import * as yaml from "yaml"

const config = new pulumi.Config();

const env = new command.local.Command("parse-env", {
    create: `pulumi env get ${config.require("envRef")} --value=json`,
    triggers: [Date.now()],
    logging: "none",

})

// janky ESC parser that walks a tree looking for keys named `needle`.
// returns ESC paths to found values.
function collect(value: any, path: string[], needle: string): { name: string, args: any }[] {
    if (Array.isArray(value)) {
        return value.flatMap((item, i) => collect(item, [...path, `${i}`], needle))
    }

    if (typeof value === 'object' && value !== null) {
        return Object.entries(value).flatMap(([k, v]) => {
            if (k === needle) {
                return [{name: path.join("."), args: v}]
            }
            return collect(v, [...path, k], needle)
        })
    }

    return []
}

// consider doing sync fs instead so we get proper previews?
env.stdout.apply(envYaml => {
    const envDefinition = yaml.parse(envYaml)

    collect(envDefinition, [], "xfn::rotate").map(rotation => {
        console.log(rotation)

        const stackRef: string = rotation.args["stack"] || ""
        const scheduleCron: string | undefined = rotation.args["scheduleCron"]
        const trigger: string | undefined = rotation.args["trigger"]

        const organization = pulumi.getOrganization()
        const [project, stack] = stackRef.split("/")

        if (scheduleCron) {
            new pulumiservice.DeploymentSchedule(`${rotation.name}-scheduled-rotation`, {
                organization,
                project,
                stack,
                scheduleCron,
                pulumiOperation: "update",
            })
        }

        if (trigger) {
            const now = new command.local.Command(`${rotation.name}-trigger-timestamp`, {
                create: 'date --iso-8601=seconds',
                triggers: [trigger]
            })
            new pulumiservice.DeploymentSchedule(`${rotation.name}-immediate-rotation`, {
                organization, project, stack,
                timestamp: now.stdout,
                pulumiOperation: "update",
            })
        }
    })
});
