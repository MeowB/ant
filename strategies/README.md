# Strategy Notes

This folder is for human tuning notes only. The CodinGame bot still runs from the single root file:

- `../ant.ts`

Each strategy card mirrors one `StrategyMode` in `ant.ts`.

Use these files to record:

- why the strategy exists
- what map shape should trigger it
- what constants or planner lines to tune
- what kind of replay proves it works

Runtime code stays in `ant.ts` so pasting into CodinGame stays simple.

## Current Strategies

- `crystal-rush.md`: win fast when close crystal value can decide the game.
- `egg-rush.md`: buy ant economy when eggs are the real opener.
- `scarce-crystal-bank.md`: avoid fancy expansion when crystals are limited.
- `big-map-mixed.md`: keep eggs and crystals both alive on large/resource-rich maps.
- `default-mixed.md`: conservative fallback when the map is not obvious.

## Tuning Flow

1. Run ranked or boss tests.
2. Read `MESSAGE <strategy>` in the HUD.
3. Compare the replay against that strategy card.
4. Tune constants or the named `run...` function in `ant.ts`.
5. Keep notes here so the next thread starts with context, not archaeology.
