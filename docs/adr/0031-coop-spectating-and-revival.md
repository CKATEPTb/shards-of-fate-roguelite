# Co-op spectating, retreat and revival

## Fallen participants

A hero's death does not release their seat in an ongoing battle. `getCoopBattle` and the battle lock retain dead participants until `battle-end`; only successful escape releases a seat early. The defeated player's battle scene continues presenting the entire encounter, with a spectator notice replacing their hand of cards after the death animation has been presented.

If somebody in the original expedition roster is still alive, finishing a dead hero's battle leaves their body at its world position and assigns `WorldActor.reviveUntilTick = room.tick + 4500`. At 40 ms per tick this gives three minutes of active room time. Other ongoing battles do not stop this rescue clock. Saving/exiting pauses it with the rest of the room, and loading preserves the remaining time. A disconnected hero is still part of the run's existing roster.

No deadline is created in a one-hero expedition or when every hero is dead. The existing shared-failure rule ends a wiped expedition after the battle presentation. Expiration leaves a noninteractive corpse; the player can continue observing but cannot be raised again during this run through this mechanic.

## Rescue interaction

The corpse uses the existing death pose. Its countdown and progress strip appear only after battle end, become dim at expiration, and respect house visibility. The fallen player's top countdown displays rescue time instead of the seasonal timer.

A living hero explicitly clicks the body (or presses E/Enter next to it). The client chooses a reachable adjacent tile and walks there automatically. Passing by never revives. A new movement/object order, another battle, a chunk transition, disconnection, expiration or an already raised target cancels the pending interaction. Repeated clicks retain the same route. A network guest must finish the route in both the predicted and confirmed host state.

The host accepts `revive` only for a stopped, living rescuer outside combat, in the same chunk and within one four-way tile of a fallen ally. The request includes `expectedReviveUntilTick`, binding it to this particular death. A delayed request cannot raise a later corpse or restart the clock. Funds, equipment, inventory and dice counters are unchanged.

All six parts regrow with their original maxima. Head and torso return at zero durability; each arm and leg returns at one durability, following the user's first-aid decision. Every `lost` flag is cleared. Existing injury penalties still apply, so the hero needs healing. The actor's route is stopped and the deadline removed. Campfires keep their usual healing rules.

## Retreat

Successful escape teleports inside the current chunk to open, unoccupied ground connected to a real chunk exit; basement escape uses a component connected to an upward staircase. The hero never lands on a gate, tree, bush or water tile. The destination may be in a different connected component from the original fight, avoiding isolated pockets.

Selection is deterministic, consumes no dice, and measures distance from actual participants in ongoing battles in that chunk. It prefers points beyond the ten-step pathfinder recruitment range, with stable exit-distance/tile-index tie breaking. Several escaping heroes receive distinct cells. If a very small map has no point beyond ten steps, the most distant exit-connected point is used. Existing battle membership prevents the escaped hero from rejoining that same still-running encounter. Other creatures can still attack normally later.

## Transport and compatibility

Protocol 21 carries a compact `revive` command/event. Deadline creation is replayed as part of `battle-end`; normal room ticks drive all countdowns without per-second messages. World/co-op saves preserve the optional deadline and validate that its owner is dead. Old saves without it remain valid and do not gain an invented rescue window.

Client and relay must both be updated to protocol 21. No content or map migration is required specifically for resurrection.
