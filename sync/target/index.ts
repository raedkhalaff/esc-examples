import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as fs from "fs";

const config = new pulumi.Config();
const name = config.require("secretName");

// Read a json file from the local filesystem using node.js fs module
const json = fs.readFileSync("sync.json", "utf8");

const secret = new aws.secretsmanager.Secret(name, {
    recoveryWindowInDays: 0,
})

const secretVersion = new aws.secretsmanager.SecretVersion(`${name}-version`, {
    secretId: secret.id,
    secretString: json,
})

// Export the name of the secret
export const secretName = secret.name;
