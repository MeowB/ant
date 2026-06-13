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

- Take urgent eggs.
- Take strategic eggs with a looser cost cap.
- Take one opening crystal only after eggs have first claim on the budget.

Later turns:

- Keep urgent eggs alive while they still have resources.
- Keep strategic eggs affordable with the same looser cap.
- Mine crystals with the remaining budget.

Planner:

- `runEggRush`

## Knobs

- `URGENT_EGG_DISTANCE`
- `STRATEGIC_EGG_MIN_AMOUNT`
- `STRATEGIC_EGG_MAX_DISTANCE`
- `STRATEGIC_EGG_MAX_COST`
- the explicit `commitStrategicEggs(..., 14)` cap inside `runEggRush`
- the `turn <= 7` phase boundary inside `runEggRush`

## Watch For

- Egg bait: lots of ants but opponent reaches half crystals first.
- Contested eggs being too expensive for what they return.
- Opening crystal paths stealing budget before eggs are secured.
- Late turns outputting only `MESSAGE`; the bot has a low-strength mineral fallback now, but repeated fallback means target costs are still too high.
