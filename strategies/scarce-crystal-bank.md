# SCARCE_CRYSTAL_BANK

## Goal

Bank crystals quickly when the map does not have many of them.

On scarce maps, every crystal patch is a bigger percentage of the win condition. The bot should not wander off chasing future economy unless it is cheap or close to base.

## Trigger In `ant.ts`

Chosen by `chooseStrategyMode` when crystal nodes or total crystal amount are low, or close crystals already cover most of the goal.

Key checks:

- `profile.crystals.length <= 6`
- `profile.totalCrystalAmount <= 120`
- `profile.closeCrystalAmount >= profile.crystalGoal * 0.70`

## Behavior

- Secure one crystal lane first.
- Take urgent close eggs if they are available.
- Add one cheap strategic egg with a small cap.
- Spend the remaining budget on crystals.

Planner:

- `runScarceCrystalBank`

## Knobs

- total crystal cutoff in `chooseStrategyMode`
- crystal node count cutoff in `chooseStrategyMode`
- `MINERAL_TARGET_ANT_DIVISOR`
- `commitEggs(urgentEggs, 2)` inside `runScarceCrystalBank`
- the `commitStrategicEggs(1, 8)` cost cap inside `runScarceCrystalBank`

## Watch For

- Ignoring an egg that would double ant count before mining starts.
- Letting cheap eggs become broad economy greed.
- Mining too many low-value far crystals instead of securing the closest patches.
- Letting opponent split nearby crystals while we overcommit to one road.
