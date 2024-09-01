import * as pulumi from "@pulumi/pulumi";
import * as github from "@pulumi/github";
import * as fs from "fs";

const config = new pulumi.Config();
const name = config.require("secretName");
const repository = config.require("repository");

const json = fs.readFileSync("sync.json", "utf8");
const secretValue = JSON.stringify(JSON.parse(json), null, 2);

const secret = new github.ActionsSecret("githubSecret", {
    repository,
    secretName: name,
    plaintextValue: secretValue,
});

export const secretName = secret.secretName;
