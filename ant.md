# Zeiko Challenge 

## Goal

Reach **Gold League**.

Win by collecting more crystals than the opponent.

---

## Synthetic Summary

### Crystal
- Type 2
- Only resource that matters in this league

### Ants
- Cannot be controlled directly
- Follow beacon strengths

### Harvesting
- Need a continuous chain:
  Base → Ants → Crystal
- Harvest amount = weakest link in the chain

### Beacons
- Recreated every turn
- `LINE` automatically creates a path
- Higher strength = more ants

---

## Priority Order

1. Crystal
2. Continuous chain
3. Enough ants on the chain
4. Short paths
5. Beacon strength tuning
6. Opponent interaction
7. Optimization

---

## Mental Model

Think pipes, not ants.

```
Base
 ↓
 Pipe
 ↓
Crystal
```

Flow = weakest section of the pipe.

---

### Session 0 – Parsing, Graph Representation and First Working Bot

Build a reliable representation of the map, understand CodinGame's input/output loop, and produce a valid bot capable of harvesting crystals.

**Purpose:** Establish a solid foundation before introducing optimization. The objective was to understand the game structure, create a graph model, implement BFS to measure distances, and get a working bot capable of defeating the first boss.

#### Approach:

1. Parse the static map into a `Cell[]` graph representation.
2. Parse both player and opponent bases, even if opponent data is not yet used.
3. Model the map as connected nodes using neighbor indexes.
4. Implement BFS from the base to discover crystal cells and record their distance.
5. Sort crystals by distance.
6. Learn the distinction between initialization and the turn loop.
7. Understand that every turn requires reading all inputs before sending an action.
8. Use `console.error()` for visual debugging.
9. Produce a first valid `LINE` action toward the closest crystal.
10. Verify the solution by defeating the first boss.

Deliverables:

* `Cell` interface representing the graph.
* `Crystal` interface containing distance, index, and amount.
* BFS traversal with a queue and visited set.
* Distance-sorted crystal list.
* Working game loop synchronized with CodinGame input.
* First functional harvesting bot.
* Understanding of `console.log()` versus `console.error()`.
* First boss defeated.

> **Note:** The largest source of confusion came from the game loop. Initialization data is read once, while turn data must be completely consumed before printing an action. Printing during input parsing causes desynchronization. The current bot only targets the nearest crystal; optimization and multi-target strategies will be introduced in later sessions.

### Session 1 – Stability and Porcupine Foundations

League testing revealed that continuity matters more than greed. The bot now begins transitioning toward a Porcupine style: preserving active harvesting lines while expanding only when resources allow.

**Purpose:** Build continuity instead of chasing the whole map. Prevent wasted turns, maintain pressure, and gradually add layers through eggs and future expansion.

#### Approach:

1. Test the first bot in league play.
2. Observe failure cases.
3. Prioritize continuity over constant retargeting.
4. Keep active crystals flowing before opening new fronts.
5. Introduce eggs as future expansion rather than immediate greed.
6. Begin implementing the Porcupine philosophy incrementally.

Deliverables:

* Identified target-switching instability when crystals share the same distance.
* Recognized uncontested crystals as easy future gains.
* Observed many opponents spreading too thin.
* Reached Wood League.
* Unlocked eggs and ant growth.
* Established continuity as the next optimization priority.

## current strategy:
> **First strategic observation:** Eggs are the economy. Crystals are the army.

Value = Crystals + Eggs + Future connections - Distance cost

No ants means no harvesting. Therefore egg income has priority until sufficient ant production exists.

The bot should:

1. Calculate the total eggs available.
2. Monitor whether the opponent is harvesting eggs.
3. Estimate the crystal requirement for victory.
4. Maintain approximately one third of active ants invested into economic growth.
5. Build efficient lines connecting resources instead of isolated targets.
6. Adapt continuously between economy and crystal gathering.

**Porcupine doctrine**

```
Need more ants?
↓
Eggs

Enough ants?
↓
Crystals

Enemy weak?
↓
Smell blood
↓
Ignore eggs
↓
Brute-force crystal victory

Enemy survives?
↓
More eggs
↓
More lines
↓
More options
```

The goal is not to collect everything immediately.

The goal is continuity.

Eggs create ants.

Ants create options.

Options win games.

Like gold in AoE4, eggs are not the victory condition, but without them there is no army.

The network matters more than any individual resource, internet proved that.


> **Note:** The objective is not to harvest the entire map. The objective is to maintain working harvesting lines and add new ones only when the current network is stable. Blood? Expand aggressively. No blood? Add layers.

### Next Session

**Purpose:** Build the economy.

#### Approach:

1. Add egg detection.
2. Count total eggs and crystals.
3. Define a target ant/crystal ratio.
4. Prevent target switching between equal-distance resources.
5. Build stable harvesting lines.
6. Introduce the first Porcupine layer.

Deliverables:

- Stable target locking.
- Egg prioritization.
- Economy growth model.
- First adaptive resource allocation.

> **Note:** Session 0 proved that the problem is understandable and solvable. Future work is optimization, not discovery.

### Session 2 – Economy Layer, Corridor Value and Failed Experiments

Wood League introduced eggs and exposed weaknesses in the original "closest crystal" approach.

#### Main ideas explored

##### ResourceNode

The bot evolved from storing only crystal positions to storing:

* type
* amount
* distance
* index
* full path

This enabled path scoring and future corridor analysis.

---

##### Economy First

Eggs became the equivalent of gold in AoE4.

Principles:

```
Eggs create ants.
Ants create options.
Options win games.
```

Early game should favor eggs over crystals.

---

##### Path Scoring

Resources were scored using:

* eggs on path
* crystals on path
* distance

Priority examples:

* egg + egg path
* egg + crystal path
* crystal clusters

The goal became harvesting corridors rather than isolated nodes.

---

##### Active Resource Memory

Instead of changing targets every turn, resource paths were remembered.

Resources remain active until depleted.

This improved continuity.

---

##### Adjacent Resource Detection

Resources one cell away from a corridor were detected and scored.

Purpose:

Harvest side resources without creating completely new lines.

Result:

Promising, but bonuses were often overvalued.

---

##### Close Egg Rule

A rule was introduced:

```
If eggs are within distance 3,
ignore everything else.
```

Fast economy proved more important than distant value.

---

##### Harassment / Smell Blood

A future aggression layer was designed.

Conditions considered:

* enemy ant count stagnating
* large ant advantage
* enough economy

Modes:

```
Normal
↓

Pressure
(2/3 crystals, 1/3 eggs)

↓

Kill
(crystals only)
```

Result:

Premature aggression caused overextension.

The layer is postponed until economy is stable.

---

##### Ant Front Experiment

Resource acquisition was attempted from cells already containing ants.

Idea:

Grow from the living network instead of the base.

Result:

Paths no longer matched LINE commands and movement became unstable.

Conclusion:

Commands should remain base-connected.

Ant-front information may later be reused only for scoring.

---

##### Reachability Experiment

Reward-aware reachability:

```
distance * 2 - pathValue
```

Result:

Long paths were overvalued.

The bot walked across the map too early.

Current philosophy:

```
Early game values time more than theoretical value.
```

---

##### Opening Route Planning

Idea:

Precompute profitable opening routes using:

* total eggs
* total crystals
* number of resources
* distance cost

Instead of:

```
Best node
```

Use:

```
Best route
```

Result:

Conceptually promising, implementation unstable.

Still under investigation.

---

##### Multi-Target Harvesting

After economy stabilizes:

```
One active target
↓

Multiple active targets
```

Goal:

Expand gradually rather than opening the whole map.

Still unfinished.

---

##### Idle Ant Problem

Many ants remain stranded on empty cells.

Current hypothesis:

The acquisition system should treat occupied empty cells as temporary mini-bases and redirect nearby ants toward local resources.

This problem remains unsolved.

---

### Current Understanding

The biggest weakness is not scoring.

It is acquisition.

The bot knows what resources are valuable.

The bot still struggles to decide:

* where new resources should be acquired from,
* how many fronts should exist,
* how to recycle ants already positioned on empty cells.

Future work should focus on acquisition and expansion rather than more scoring formulas.

### Session 3 - Bronze Push, Commitment Problems and Multi-Base Fronts

Bronze testing became a long try/retry cycle around one core problem:

The bot could find valuable resources, but it often failed to keep a stable, productive pipe.

Several ideas worked partially, then exposed new failure modes.

---

#### Close Egg Priority

Initial problem:

* The bot switched between equal-distance targets.
* It sometimes ignored close eggs while trying to optimize a wider route.
* Egg production was not reliable enough against the boss.

Changes tried:

* Close eggs were prioritized before opening routes.
* Stray-ant local routing was removed.
* Targets were made sticky instead of being cleared and recalculated every turn.

Result:

Close eggs improved, but target identity alone was not enough. The route itself could still wobble because `LINE` lets the engine choose a shortest path.

---

#### Explicit Beacon Paths

Problem:

`LINE` commands allowed equal-distance route ambiguity.

Change:

Committed resource paths switched from:

```
LINE base target strength
```

to explicit:

```
BEACON pathCell strength
```

Result:

Routes became more stable. This was one of the important mechanical improvements of the session.

---

#### Silk Road Experiment

Idea:

Once enough ants exist, commit to one high-value crystal corridor:

* main path strength 4,
* adjacent resource nodes strength 1,
* sweep the map once the corridor is nearly depleted.

Result:

The collection mechanics worked in some games and even produced no-match wins, but the phase transition was too brittle.

Failures observed:

* The bot switched to crystal harvest too early.
* It stopped caring about important egg nests.
* Side beacons sometimes drained pressure from the main objective.
* Sweep mode was initially too late, then too early.

Conclusion:

The Silk Road idea is promising later, but it needs stronger phase logic and per-front commitment before it can be trusted.

---

#### Contested Resource / Demon Mode Experiment

Idea:

Use opponent-distance awareness to fight for center eggs and steal opponent-side crystals.

Changes tried:

* Distance maps from my base and opponent base.
* Contested scoring based on distance parity.
* Bonuses for center eggs and lightly stealable resources.

Result:

The bot became more aggressive, but overextended into opponent-side resources too early.

Failures observed:

* Long funnels lost too much power.
* Center or enemy-side eggs sometimes pulled ants away from cheap local eggs.
* Local economy suffered while chasing theoretically valuable contested nodes.

Conclusion:

Contested resources matter, but only after the local economy is stable. Deep enemy-side nodes belong in late sweep, not opening economy.

---

#### Boss-Beater Simplification

The boss exposed that a simple strategy was beating the clever one:

```
Take eggs.
Build ants.
Sweep crystals.
```

Changes:

* Strategy was simplified to egg phase, then crystal sweep.
* Premature sweep was blocked when behind on ants.
* One reachable egg was kept during sweep for continued traction.
* Extra routes were gated by path viability.

Result:

This simplified approach reached Bronze League.

Lesson:

The bot needed boring reliability more than sophisticated stealing.

---

#### Multi-Base Support

Bronze introduced two-base layouts.

Initial issue:

The bot only used `myBaseIndexes[0]` for paths and distances.

Changes:

* Resource BFS became multi-source from all friendly bases.
* Opponent distance maps became multi-source from all opponent bases.
* Resource paths now start at the nearest friendly base.

Result:

Two-base maps started to work, but new problems appeared.

Failures observed:

* A global "active base" caused ants from one base to migrate toward the other base.
* Maintaining roads from both bases without independent logic split funnel power.

Follow-up change:

The strategy moved toward independent per-base fronts:

* each base chooses its own local egg funnel,
* sweep loops over live bases,
* bases with no ants are ignored in sweep.

Result:

This reduced cross-base migration but is still not fully solved.

---

#### Dead Movement and Weak Pipes

Observed problems:

* Some ants moved toward nodes they could not realistically connect to.
* Some egg funnels had weak cells before and after the egg, slowing income.
* Side taps caused drift during egg phase.

Changes:

* Extra targets require path viability.
* First egg target is allowed freely.
* Second egg and steal targets are gated.
* Egg-phase side taps were disabled.
* Main egg funnel health was introduced before allowing extra routes.

Result:

This reduced some waste, but did not fully remove left/right target switching.

---

### Current Bronze Understanding

What works better now:

* Explicit `BEACON` paths.
* Egg-first simplification.
* Blocking premature crystal sweep.
* Multi-source BFS for two-base maps.
* Per-base local fronts instead of one global base.

What still fails:

* Some games still have weak or missing egg income.
* Targets can still switch between turns, causing left/right movement.
* Per-base fronts still lack persistent commitment memory.
* Sweep can still spread too thin on some maps.
* Free eggs near bases are not always integrated cleanly.

Most likely next improvement:

Add per-base committed targets:

```
committedEggTargets: base -> ResourceNode
committedSweepTargets: base -> ResourceNode
```

Each base should keep its target until the target or corridor is depleted.

This should reduce switching and make egg income more consistent.

### Next Session

Purpose:

Stabilize Bronze behavior and prepare for Silver/Gold.

Focus:

1. Add per-base target memory.
2. Keep egg targets committed until depleted.
3. Prevent target switching between equal-value resources.
4. Make sweep incremental instead of opening too many crystal paths.
5. Reintroduce stealing only after local egg income is stable.

### Session 4 - Dist Swipe, Road Taps and Boss-Test Triage

This session was mostly die-and-retry. The goal was no longer to build a beautiful strategy; it was to recover a reliable bot after several promising ideas started fighting each other.

The best ranked result came from a simpler distance-based strategy: close eggs first, then crystal pressure, with active memory and profitability scoring. It reached rank 2 briefly, then later rank 5 during road-tap experiments, but the exact saved version was lost during manual file swapping.

Files involved:

* `ant.dist-swipe.ts`
* `ant.dist-swipe-530.ts`
* `ant.road-tap.ts`
* `rank2bronze.ts` existed briefly as a recovered candidate, then disappeared during file churn.

---

#### Dist Swipe Strategy

Core idea:

```
Close eggs first.
Then crystals.
Do not chase everything.
Keep active roads alive.
```

What worked:

* Removing broad phases reduced overthinking.
* Active memory helped avoid target churn.
* Profitability scoring avoided some bad mineral patches.
* Side taps worked when they were small and local.
* Close eggs with high beacon strength were strong.
* Ignoring eggs too close to enemy bases avoided pointless contests.

What failed:

* Far eggs pulled ants across the map.
* When far eggs depleted, committed ants withdrew instead of converting cleanly into crystal harvest.
* Switching depleted eggs to nearest local resources sounded good, but ranked much worse.
* Trying to ignore enemy-safe crystals broke useful enemy-line roads.

Lesson:

The bot wins more from boring, nearby growth than from clever long-distance stealing.

---

#### Close Egg Gate

A major rule emerged:

```
If close eggs exist, focus them.
Otherwise mine.
```

Regular eggs were eventually removed from broad activation because they caused overextension. Close eggs remained valuable, especially within distance 2 or 3 depending on tuning.

Important caveat:

Egg acquisition cannot become so weak that the boss outgrows us. Any anti-sprawl rule that blocks close egg pickup is too expensive.

---

#### Crystal Baseline Pressure

Several games were lost because the map had one important mineral patch and many eggs. The bot built economy while the boss mined.

A rule was added:

```
Always pressure the closest crystal every turn.
```

Later this became a small closest-crystal cluster:

```
closest crystal distance + 1
```

What worked:

* Prevented stupid losses where the only good crystal was ignored.
* Kept some scoring alive during egg-heavy openings.

What needs tuning:

* Beacon strength should be capped by remaining resources.
* A 3-strength road into a patch with 1 resource left wastes ants.

---

#### Road Tap Strategy

New strategy idea:

After close eggs are handled, build roads and tap adjacent resources from those roads.

The first version:

* Added beacons to resources adjacent to committed roads.
* Kept sticky memory for touched patches.
* Added taps when ants physically passed next to resources.

What worked:

* Sticky road taps harvested useful side crystals.
* Ants passing near resources could opportunistically harvest them.
* Some ranked results improved.

What failed:

* Sticky taps became too sticky.
* Empty nodes were sometimes kept alive too long.
* Side taps started spawning more side taps.
* Random ants created map-wide crystal sprawl.
* Main crystal roads lost density.

Lesson:

Taps are good only when they stay local. Strength-1 taps must not become new expansion roots.

---

#### Sticky Tap Rules

Rules that survived:

* A patch that has resources and gets tapped can remain sticky.
* A sticky tap is removed only when the patch is empty.
* Crystal taps from committed roads are useful.
* Egg taps from passing ants are useful because growth is time-sensitive.

Rules that failed:

* Tapping empty neighboring nodes.
* Making all ant-adjacent crystal taps sticky.
* Letting weak side taps recursively expand.
* Blocking all taps on immune crystal roads.

Current preferred split:

```
Committed strong roads:
  may tap adjacent crystals and eggs.

Random ant positions:
  may tap adjacent eggs only.

Strength-1 side taps:
  should not create more taps.
```

---

#### Tap Immunity

Problem:

The initial closest-crystal road could be corrupted by opportunistic egg taps. Ants left the main mining pipe to grab eggs on the side.

Tried rule:

```
Initial crystal road is immune to tapping.
```

Failure:

This also blocked valuable adjacent crystals, so the bot missed obvious mineral income.

Better rule:

```
Tap-immune roads block egg taps only.
Crystal taps are still allowed.
```

Lesson:

Immunity should protect mining density from egg distractions, not blind the bot to nearby crystals.

---

#### Boss Test Failures

Several boss losses had the same shape:

* Our roads existed visually.
* The boss harvested more.
* Our ants looked present but did not produce enough from the intended patch.

Root cause:

The road was not always a strong pipe. Many visible roads were only strength-1 taps. Harvesting depends on the weakest link, not on whether a beacon exists.

Observed pattern:

```
Strong main road harvests.
Weak side tap looks connected but barely harvests.
Too many weak taps dilute the main road.
Boss keeps one cleaner pipe and wins.
```

The important distinction:

* A beacon is intent.
* An ant chain is capacity.
* Harvesting is capacity at the weakest link.

---

#### Failed Ideas Worth Remembering

Do not repeat these without a new reason:

* Broad far-egg acquisition.
* Switching depleted eggs to nearest resource automatically.
* Ignoring enemy-farthest crystals globally.
* Treating any ant position as a full expansion root.
* Making every nearby crystal sticky from random ants.
* Blocking all taps on crystal roads.
* Opening too many active targets because the score says they are profitable.

Each one looked sensible locally. Each one made the pipe weaker globally.

---

#### Current Working Theory

The bot does not need more clever scoring right now.

It needs stricter acquisition discipline:

```
Close eggs are allowed.
Closest crystal pressure is mandatory.
Committed roads may tap.
Weak taps must not expand.
Far eggs are mostly bait.
Crystal density beats pretty coverage.
```

Current tactical direction:

1. Keep close egg farming.
2. Keep the closest crystal or closest crystal cluster pressured every turn.
3. Keep active target memory.
4. Keep sticky taps, but only for real resources.
5. Prevent strength-1 side taps from becoming new roads.
6. Allow opportunistic egg pickup from passing ants.
7. Avoid broad far-egg acquisition unless the map is already won.

---

### Session 5 - Strategy Featurization and Tuning Roadmap

This session moved the bot away from one giant behavior blob and toward named strategies that can be inspected and tuned separately.

The runtime is still a single CodinGame file:

* `ant.ts`

The strategy folder is documentation only:

* `strategies/crystal-rush.md`
* `strategies/egg-rush.md`
* `strategies/scarce-crystal-bank.md`
* `strategies/big-map-mixed.md`
* `strategies/default-mixed.md`

No imports, no bundler, no build step. CodinGame still gets one pasted file.

---

#### Strategy Modes

The bot now chooses one strategy from the initial map profile:

* `CRYSTAL_RUSH`
* `EGG_RUSH`
* `SCARCE_CRYSTAL_BANK`
* `BIG_MAP_MIXED`
* `DEFAULT_MIXED`

The selected strategy is shown every turn with:

```
MESSAGE strategyName
```

This makes replay review much easier because bad behavior can be tied to the strategy that caused it.

---

#### Map Profile Debugging

At game start, the bot logs:

* base indexes,
* selected strategy,
* crystal goal,
* egg node count and total amount,
* crystal node count and total amount,
* close/reachable resource amounts,
* closest resources,
* richest resources.

Per turn, it logs:

* turn,
* phase,
* total ants,
* remaining available ants,
* committed targets,
* skipped targets.

This gives enough information to decide whether the strategy choice was wrong or whether the chosen strategy executed badly.

---

#### Strategy Playbooks

The old `switch(strategyMode)` was refactored into named playbook functions inside `ant.ts`:

* `runCrystalRush`
* `runEggRush`
* `runScarceCrystalBank`
* `runBigMapMixed`
* `runDefaultMixed`

The goal is readability. Each strategy should be easy to inspect without mentally untangling the whole bot.

---

#### Egg Rush Bug Found

A replay showed a major contradiction:

```
MESSAGE EGG_RUSH
```

But the bot ignored eggs.

Observed behavior:

* It picked `EGG_RUSH`.
* It harvested the first close egg.
* Then it spent most of the early budget on crystal `11`.
* The close egg refresh was skipped because crystal pressure consumed the budget.
* Distance-6 rich eggs were skipped forever because their cost was slightly above the default cap.
* Late game sometimes output only `MESSAGE` because all full-strength mineral paths were too expensive.

Root causes:

* `runEggRush` committed an opening crystal before eggs.
* Strategic egg cap was too strict for real egg-rush maps.
* No fallback existed when strength-3 crystal paths were unaffordable.

Fix:

* `EGG_RUSH` now commits urgent eggs before crystals.
* `EGG_RUSH` strategic eggs use a higher cap: `14`.
* Urgent eggs stay relevant after turn 7.
* Mineral commits can fall back to strength 2, then strength 1, instead of outputting only `MESSAGE`.

Lesson:

Strategy names are only useful if the playbook actually obeys them. Very rude of the bot, honestly.

---

#### Current Working Theory

The bot should not try to find one universal strategy.

Different map shapes need different behavior:

* Close high-value crystals: rush crystals.
* Rich reachable eggs and weak close crystals: rush eggs.
* Scarce crystals: bank nearby crystals before economy greed.
* Big maps: mix eggs and crystals.
* Unclear maps: default balanced play.

The next improvement is not another grand rewrite.

The next improvement is tuning each named strategy independently.

---

### Next Session

Purpose:

Fine tune every strategy one by one.

Focus:

1. Test `CRYSTAL_RUSH` maps and tune crystal target count, strength, and egg allowance.
2. Test `EGG_RUSH` maps and tune urgent egg limits, strategic egg cap, and crystal timing.
3. Test `SCARCE_CRYSTAL_BANK` maps and make sure eggs do not distract from quick scoring.
4. Test `BIG_MAP_MIXED` maps and prevent thin overexpansion.
5. Test `DEFAULT_MIXED` maps and identify cases that deserve a new named strategy.
6. Use HUD `MESSAGE` plus debug logs to classify every loss.
7. Update the matching file in `strategies/` after each tuning pass.

Rule:

Tune one strategy at a time. Do not fix every bad replay with one global formula.

### Session 6 - Bronze to Silver, Protocol Fix and Two-Base Stability

This session was the successful Silver promotion push.

The project was intentionally cleaned down to the useful working files:

* `ant.ts` - active bot under tuning.
* `ant.md` - learning log and strategy notes.
* `silver-bot.ts` - saved Silver League baseline. Do not overwrite it during experiments.

The old artifact files and separate strategy notes were removed because the bot is now simple enough to reason about directly in `ant.ts`.

---

#### Strategic Reset

Several complex approaches were tested and abandoned:

* smell-blood aggression,
* route-farming with many resource corridors,
* heavy tracking memory,
* broad map swipe without enough egg discipline.

The working strategy became simpler:

```
Egg rush
  -> build enough ant economy from good nearby eggs

Swipe
  -> keep eggs alive when useful
  -> pressure crystals broadly enough to race the boss
```

The important lesson was that clever global scoring was less valuable than reliable early economy and strong pipes.

---

#### Current Bot Shape

The current bot is an egg-rush into swipe planner.

Runtime state:

* `EGG_RUSH`
* `SWIPE`

Important behaviors:

* Prioritize close, high-value egg nests.
* Do not switch to crystals too early.
* During swipe, keep taking eggs instead of abandoning economy completely.
* Use `LINE` routes for simple, robust command output.
* Recompute every turn using live resource amounts, so depleted nodes naturally fall away.
* Avoid enemy-mined crystals when the opponent will clear them before we arrive.
* Reinforce contested paths when opponent ants threaten the chain.

---

#### Silver Protocol Fix

Silver changed the turn input protocol.

Each turn now starts with:

```
myScore oppScore
```

Then the bot reads one line per cell:

```
resources myAnts oppAnts
```

The bug was subtle because the game still looked partially readable, but all cell parsing became shifted when the score line was not consumed.

Fix:

* Read the score line before the cell loop.
* Use official score values instead of reconstructing score from crystal drops.
* Keep resource-drop tracking only for eggs/debugging.

This fixed the strange `NaN` opponent ant count and premature swipe transitions.

---

#### Attack Chains

Silver also introduced attack chains.

Contested cells can break harvest chains if the opponent has the stronger attack chain through that cell.

Current response is simple:

* If a planned path has stronger opponent presence, reinforce useful close routes.
* Prefer reinforcing eggs and valuable nearby crystals.
* Skip risky weak pressure on paths that are not worth contesting.

This is not a full attack-chain solver yet, but it prevents some obvious broken-chain losses.

---

#### Egg Rush Lessons

Several failures came from leaving egg rush too early or spreading it too thin.

Rules that survived:

* Egg rush should focus eggs, not crystals.
* Crystals during egg rush are only acceptable when the crystal win condition is small compared to current ant count.
* Swipe should not give up on live eggs.
* A close rich egg nest should be saturated before spreading to far eggs.

The boss often wins by fully exploiting a nearby nest before moving on. Matching that behavior was more important than fancy route diversity.

---

#### Two-Base Problem

On two-base maps, one base could abandon all existence.

Cause:

* Global resource selection picked the best base for each target.
* If most attractive routes belonged to one side, beacon weights pulled ants from the other base across the map.

Fix:

* Add per-base resource discovery.
* Let each base reserve a local egg route in egg rush.
* Let each base reserve a local egg or crystal route in swipe.
* Add a weak base anchor beacon when a base has no committed route.

Goal:

```
Each base should keep farming its own side unless there is a strong reason to merge fronts.
```

This keeps local ant economies alive and reduces pointless cross-map migration.

---

#### Current Debug Signals

Per turn, stderr reports:

* turn,
* phase,
* my ants / opponent ants,
* official score,
* estimated egg harvest,
* budget,
* committed path cost,
* committed route logs.

Useful log labels:

* `priorityEgg`
* `localEgg`
* `egg`
* `swipeEgg`
* `extraEgg`
* `localCrystal`
* `crystal`
* `cut`
* `anchor`

For two-base maps, look for `localEgg`, `localCrystal`, or `anchor` on both base indices.

---

#### Current Repository Rule

`silver-bot.ts` is the saved Silver League baseline.

Do not touch it during active experiments.

Use `ant.ts` for Gold-push tuning.

---

### Next Session

Purpose:

Push from Silver toward Gold.

Focus:

1. Test two-base anchoring on several maps.
2. Confirm that a base no longer fully drains into the other side.
3. Watch whether `anchor` strength 1 is enough or too expensive.
4. Tune close rich egg saturation.
5. Improve attack-chain handling only after replay evidence.
6. Avoid another broad rewrite unless logs prove the current simple planner is capped.
