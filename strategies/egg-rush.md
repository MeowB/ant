# EGG_RUSH

## Goal

Build enough ant economy to win midgame instead of fighting underpowered.

This is for maps where crystals are not immediately decisive and eggs are close, rich, or strategically necessary.

## Trigger In `ant.ts`

Chosen by `chooseStrategyMode` when nearby eggs are strong, reachable eggs are the obvious economy, or rich strategic eggs exist while close crystal value is weak.

Key checks:

- `profile.nearEggAmount >= 20`
- reachable eggs are strong while reachable crystals are not enough
- rich eggs within `STRATEGIC_EGG_MAX_DISTANCE` add up enough

## Behavior

Early turns:

- Take one opening crystal if it is clearly good.
- Take urgent eggs.
- Take strategic eggs.

Later turns:

- Keep one opening crystal lane alive.
- Take fewer strategic eggs.
- Start crystal mining.

Planner:

- `runEggRush`

## Knobs

- `URGENT_EGG_DISTANCE`
- `STRATEGIC_EGG_MIN_AMOUNT`
- `STRATEGIC_EGG_MAX_DISTANCE`
- `STRATEGIC_EGG_MAX_COST`
- the `turn <= 7` phase boundary inside `runEggRush`

## Watch For

- Egg bait: lots of ants but opponent reaches half crystals first.
- Contested eggs being too expensive for what they return.
- Early crystal path getting starved because egg strength is too high.
