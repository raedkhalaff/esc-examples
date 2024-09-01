import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import * as fs from "fs";

const config = new pulumi.Config();
const name = config.require("secretName");

const json = fs.readFileSync("sync.json", "utf8");

const secret = new gcp.secretmanager.Secret(name, {
    secretId: name,
    replication: {
        automatic: true,
    },
});

new gcp.secretmanager.SecretVersion(`${name}-version`, {
    secret: secret.id,
    secretData: json,
});

export const secretName = secret.secretId;
