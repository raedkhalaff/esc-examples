import * as pulumi from "@pulumi/pulumi";
import * as random from "@pulumi/random";
import {Rotator} from "./rotator";

const creds = new Rotator("rotating-creds", {
    // trigger credential rotation every deployment.
    // (the scheduler stack will create a deployment schedule for this stack to effect the rotation)
    trigger: Date().toString(),
    // create a set of equivalent credentials that will be rotated between.
    // a particular credential should be replaced whenever `trigger` is updated.
    construct: (name, trigger) => {
        // in this example we're just creating passwords,
        // but these could be mysql users or anything else.
        return new random.RandomPassword(name, {
            length: 10,
            keepers: {trigger}
        })
    },
})

// export when the last rotation happened
export const lastUpdate = creds.lastUpdate.apply(date => date.toISOString());
// export the currently active credential, which will be imported by the downstream ESC environment.
export const current = creds.current.result;
// previous represents the inactive credential that is still valid, but will be replaced next rotation.
export const previous = creds.previous.result;
