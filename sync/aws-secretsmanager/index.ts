import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as fs from "fs";

// Read a json file from the local filesystem using node.js fs module
const json = fs.readFileSync("sync.json", "utf8");
console.log(json);
const openedEnv = JSON.parse(json);

// Create an AWS resource (S3 Bucket)
const bucket = new aws.s3.Bucket("my-bucket");

// Export the name of the bucket
export const bucketName = bucket.id;
