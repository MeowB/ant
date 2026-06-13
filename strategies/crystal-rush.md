# CRYSTAL_RUSH

## Goal

Win before egg economy matters.

This is for maps where the closest crystal patches are valuable enough that delaying for eggs gives the opponent the score lead.

## Trigger In `ant.ts`

Chosen by `chooseStrategyMode` when close crystals cover a large part of the crystal goal, a very close crystal is high value, or reachable crystals already cover the win condition.

The strongest override:

```
profile.reachableCrystalAmount >= profile.crystalGoal
```

If the bot can already bank half the map minerals from reachable crystals, it should rush crystals no matter how tempting the eggs look.

Key checks:

- `profile.reachableCrystalAmount >= profile.crystalGoal`
- `profile.closeCrystalAmount >= profile.crystalGoal * 0.55`
- best close crystal is distance `<= 2`
- nearby egg amount is below the current egg cutoff

## Behavior

- Commit hard to opening crystals.
- Add at most one cheap strategic egg if it does not slow the rush.

Planner:

- `runCrystalRush`

## Knobs

- `OPENING_CRYSTAL_DISTANCE`
- `OPENING_CRYSTAL_MIN_AMOUNT`
- `MINERAL_TARGET_ANT_DIVISOR`
- the `commitStrategicEggs(1, 6)` cost cap inside `runCrystalRush`

## Watch For

- Losing because a cheap nearby egg was ignored.
- Spreading onto too many crystal paths when only two high-value patches matter.
- Opponent taking the same crystals faster from a shorter base.
- Calling `CRYSTAL_RUSH` on maps where reachable crystals are technically enough but too spread out to mine before the opponent.
