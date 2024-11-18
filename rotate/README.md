
- rotation deployment provisions user + password, writes to ESC, tags
  - no need to write back, just use a stack output!!
- ESC env defines rotated secret, has target ref & schedule.  Webhook triggers update of ^ deployment schedule

stacks:
  postgres-instance <-- scheduled by rotation-schedule, updates credentials every time its run
  rotation-schedule <-- triggered by env webhook, set up scheduled deployments for each rotator


values:
    example:
        xfn::rotated:
            stack: postgres-instance/dev
            schedule: <CRON EXPRESSION>
        fn::open::pulumi-stacks:
            stacks:
                postgres:
                    stack: ${rotatedCredential.xfn::rotated.stack}

environmentVariables:
  FOO: ${example.postgres.connectionString}



