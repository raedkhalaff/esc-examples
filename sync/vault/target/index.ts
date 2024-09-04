// target.ts
import * as pulumi from "@pulumi/pulumi";
import * as vault from "@pulumi/vault";
import * as fs from "fs";

const config = new pulumi.Config();
const secretPath = config.require("secretPath");

const json = fs.readFileSync("sync.json", "utf8");

const secret = new vault.GenericSecret(secretPath, {
    path: secretPath,
    dataJson: json,
});

// Export the path of the secret
export const vaultSecretPath = secret.path;
