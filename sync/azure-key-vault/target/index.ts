import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure-native";
import * as fs from "fs";

const config = new pulumi.Config();
const name = config.require("secretName");
const vaultName = config.require("vaultName");
const resourceGroupName = config.require("resourceGroupName");

const json = fs.readFileSync("sync.json", "utf8");

const secret = new azure.keyvault.Secret(name, {
    secretName: name,
    vaultName: vaultName,
    resourceGroupName: resourceGroupName,
    properties: {
        value: json,
    },
});

export const secretName = secret.name;
