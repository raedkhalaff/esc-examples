# Pushing ESC values into AWS Secrets Manager

This example demonstrates how to sync ESC values into AWS Secrets Manager. The pulumi program contained in this directory uses the [pulumiservice provider](https://www.pulumi.com/registry/packages/pulumiservice/) to create an environment containing some configuration and secrets, a new stack, and configures deployment settings and a deployment schedule for the newly created stack. 

The deployment settings point to the pulumi program contained in the [target](./target/) directory, which takes the output of the ESC environment and (in this case) creates a secret in AWS Secrets Manager.

Running `pulumi install` and `pulumi up` in this directory will set up regular (hourly by default, but configurable) updates on the newly created stack, where each job deployment will open the ESC environment and sync its output into AWS Secrets Manager.

**Note**: In this example, the deployment settings include a pre-run command that opens the ESC environment and stores the output of a specific property as a file on disk. When the target update runs, it simply reads the file. However, there are multiple other ways to access ESC values from within the Pulumi program, for example by using the [ESC SDK](https://github.com/pulumi/esc-sdk) or passing the key through [pulumi config](https://github.com/pulumi/esc-sdk).
