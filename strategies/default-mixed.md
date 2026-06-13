# DEFAULT_MIXED

## Goal

Play a sane balanced game when the map does not clearly match another strategy.

This should be boring on purpose. It is the fallback, not the hero.

## Trigger In `ant.ts`

Chosen by `chooseStrategyMode` when no stronger map signature matches.

## Behavior

- Take one strong opening crystal.
- Take urgent eggs.
- Add a small number of strategic eggs.
- Mine crystals with the remaining available ants.

Planner:

- `runDefaultMixed`

## Knobs

- fallback order inside `chooseStrategyMode`
- `commitCrystals(openingCrystals, 1)`
- `commitEggs(urgentEggs, 2)`
- `commitStrategicEggs(2)`
- `MINERAL_TARGET_ANT_DIVISOR`

## Watch For

- Maps that repeatedly choose fallback but clearly need a named strategy.
- Fallback scoring worse than either pure egg or pure crystal play.
- Debug output showing enough unused ants that target limits are too conservative.
