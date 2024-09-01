# Pushing ESC Values into HashiCorp Vault

This example demonstrates how to sync ESC values into HashiCorp Vault. The Pulumi program contained in this directory uses the [pulumiservice provider](https://www.pulumi.com/registry/packages/pulumiservice/) to create an environment containing some configuration and secrets, a new stack, and configures deployment settings and a deployment schedule for the newly created stack.

The deployment settings point to the Pulumi program contained in the [target](./target/) directory, which takes the output of the ESC environment and (in this case) creates or updates a secret in HashiCorp Vault.

Running `pulumi install` and `pulumi up` in this directory will set up regular (hourly by default, but configurable) updates on the newly created stack, where each job deployment will open the ESC environment and sync its output into HashiCorp Vault.

**Note**: In this example, the deployment settings include a pre-run command that opens the ESC environment and stores the output of a specific property as a file on disk. When the target update runs, it simply reads the file. However, there are multiple other ways to access ESC values from within the Pulumi program, for example by using the [ESC SDK](https://github.com/pulumi/esc-sdk) or passing the key through [pulumi config](https://github.com/pulumi/esc-sdk).

## Getting Started

1. Ensure you have [Pulumi CLI](https://www.pulumi.com/docs/get-started/install/) installed.
2. Set up your Pulumi project and stack if you haven't already.
3. Install the necessary dependencies with `pulumi install`.
4. Configure your environment by setting any configuration values:
    - `repository`: The GitHub repository where the source for the target stack is located.
    - `projectName`: The name of the project where the target stack will be created.
    - `stackName`: (optional) The name of the target stack that will be deployed at regular intervals (defaults is "dev").
    - `syncCronSchedule` (optional): A cron expression to define the sync schedule (default is hourly).
    - `envPath` (optional): The path to the environment file containing secrets/configuration to sync.
5. Run `pulumi up` to deploy the stack and set up the scheduled sync.

## Customizing the Sync

The `syncEnv.yaml` file defines the structure of the environment data that will be synced. Modify this file to include different configuration keys or secrets, and adjust the target Pulumi program (`target/index.ts`) to handle the specific structure of your data.

## Cleanup

To remove the resources created by this example, run `pulumi destroy`.
