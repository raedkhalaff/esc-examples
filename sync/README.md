# Pushing ESC values into external systems

This example demonstrates how to sync ESC values into external systems. The pulumi program contained in this directory uses the [pulumiservice provider](https://www.pulumi.com/registry/packages/pulumiservice/) to create an environment containing some configuration and secrets, a new stack, and configures deployment settings and a deployment schedule for the newly created stack. 

The deployment settings point to the pulumi program contained in the [aws-secretsmanager](./aws-secretsmanager/) directory, which takes the output of the ESC environment and creates a secret in AWS Secrets Manager.

Running `pulumi install` and `pulumi up` in this directory will set up hourly updates on the newly created stack, where each job deployment will open the ESC environment and sync its output into AWS Secrets Manager.