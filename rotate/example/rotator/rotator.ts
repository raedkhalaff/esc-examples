import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";

// Rotator manages a set of two secrets that it swaps between, replacing one at a time.
// When a secret becomes `current` it is replaced with a new version.
// The previously `current` secret will remain unchanged so that it remains valid to give dependents time to switchover.
export class Rotator<T> extends pulumi.ComponentResource {
    current: pulumi.Output<T>
    previous: pulumi.Output<T>

    constructor(name: string, args: {
        // rotate the "current" secret when trigger changes.
        trigger: pulumi.Input<string>,
        // delegate construction of a set of equivalent secrets.
        // a created secret should be replaced when the "trigger" input changes.
        construct: (name: string, trigger: pulumi.Input<string>) => T,
    }, opts?: pulumi.ComponentResourceOptions) {
        super("claire:index:rotator", name, args, opts);

        // toggle flipflops between "a" and "b" whenever trigger changes
        const toggle = new command.local.Command(`${name}-toggle`, {
            create: 'echo "a"',
            update: 'if test "$PULUMI_COMMAND_STDOUT" = "a"; then echo "b"; else echo "a"; fi',
            environment: {
                TRIGGER: args.trigger, // command.triggers[] causes a replacement, which loses previous state, changing env this causes an update instead
            },
            logging: "none",
        }, {parent: this})

        // latch-a changes when toggle switches to "a", (but not while it remains "a")
        const latchA = new command.local.Command(`${name}-latch-a`, {
            environment: {
                SET: toggle.stdout.apply(toggle => toggle === "a" ? "true" : ""),
                VALUE: args.trigger,
            },
            create: 'echo "$VALUE"',
            update: 'if test "$SET"; then echo "$VALUE"; else echo "$PULUMI_COMMAND_STDOUT"; fi',
            logging: "none",
        }, {parent: this})

        // secret a changes whenever latch-a changes
        const a = args.construct(`${name}-a`, latchA.stdout)

        // latch-b changes when toggle switches to "b", (but not while it remains "b")
        const latchB = new command.local.Command(`${name}-latch-b`, {
            environment: {
                SET: toggle.stdout.apply(current => current === "b" ? "true" : ""),
                VALUE: args.trigger,
            },
            create: 'echo "$VALUE"',
            update: 'if test "$SET"; then echo "$VALUE"; else echo "$PULUMI_COMMAND_STDOUT"; fi',
            logging: "none",
        }, {parent: this})

        // secret b changes whenever latch-b changes
        const b = args.construct(`${name}-b`, latchB.stdout)

        // track whichever secret was changed last
        this.current = toggle.stdout.apply(toggle => toggle === "a" ? a : b)
        this.previous = toggle.stdout.apply(toggle => toggle === "a" ? b : a)
    }
}
