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
