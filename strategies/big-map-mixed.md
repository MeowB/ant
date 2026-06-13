# BIG_MAP_MIXED

## Goal

Keep economy and scoring alive at the same time on large maps.

Big maps usually punish single-minded play. If we only mine, we run out of ants. If we only egg, the opponent banks crystals first.

## Trigger In `ant.ts`

Chosen by `chooseStrategyMode` when the map is large or resource-rich.

Key checks:

- `numberOfCells >= 70`
- `profile.totalEggAmount >= 60`
- `profile.totalCrystalAmount >= 180`
- `profile.reachableEggAmount >= 40`

## Behavior

- Take up to two strong opening crystals.
- Take urgent eggs.
- Add strategic eggs.
- Spend remaining available ants on crystals.

Planner:

- `runBigMapMixed`

## Knobs

- big-map/resource thresholds in `chooseStrategyMode`
- `commitCrystals(openingCrystals, 2)`
- `commitEggs(urgentEggs, 2)`
- `commitStrategicEggs(3)`
- `MINERAL_TARGET_ANT_DIVISOR`

## Watch For

- Spreading too thin across far crystal roads.
- Losing free egg economy because opening crystals consume all available ants.
- Sticky paths keeping too many weak lanes alive after a target is no longer useful.
