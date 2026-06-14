/**
 * Ants bot - egg rush into swipe
 *
 * Core loop:
 * - Build early ant economy from close/good eggs.
 * - Switch into broad crystal pressure once economy is online or score pressure appears.
 * - Recompute every turn; live resource amount naturally lowers depleted target priority.
 */

interface Cell {
	type: number;
	resources: number;
	neighbors: number[];
	myAnts: number;
	oppAnts: number;
}

interface ResourceNode {
	type: number;
	index: number;
	amount: number;
	distance: number;
	path: number[];
	baseIndex: number;
}

type Phase = 'EGG_RUSH' | 'SWIPE';

const EGG = 1;
const CRYSTAL = 2;

const ANT_BUDGET_RATIO = 0.9;
const MIN_EGG_RUSH_ANT_GOAL = 50;
const EGG_RUSH_MAX_TARGETS = 3;
const EGG_RUSH_MAX_DISTANCE = 6;
const SWIPE_LOW_ANT_CRYSTAL_TARGETS = 3;
const SWIPE_HIGH_ANT_CRYSTAL_TARGETS = 5;


const cellCount = parseInt(readline());
const cells: Cell[] = [];

for (let i = 0; i < cellCount; i++) {
	const inputs = readline().split(' ').map(Number);

	cells.push({
		type: inputs[0],
		resources: inputs[1],
		neighbors: inputs.slice(2, 8),
		myAnts: 0,
		oppAnts: 0
	});
}

parseInt(readline());
const myBases = readline().split(' ').map(Number);
const oppBases = readline().split(' ').map(Number);

let turn = 0;
let phase: Phase = 'EGG_RUSH';
let harvestedEggs = 0;
let myScore = 0;
let oppScore = 0;
let previousMyScore = 0;
let previousOppScore = 0;
let lastSwipeCrystalTargets: number[] = [];

const initialEggTotal = cells
	.filter(cell => cell.type === EGG)
	.reduce((sum, cell) => sum + cell.resources, 0);

const eggRushAntGoal = Math.max(
	MIN_EGG_RUSH_ANT_GOAL,
	Math.floor(initialEggTotal * 0.35)
);

const initialCrystalTotal = cells
	.filter(cell => cell.type === CRYSTAL)
	.reduce((sum, cell) => sum + cell.resources, 0);

const crystalGoal = Math.floor(initialCrystalTotal / 2) + 1;
const previousResources = cells.map(cell => cell.resources);

const getDistancesFromBases = (baseIndexes: number[]): number[] => {
	const distances = Array(cellCount).fill(Number.MAX_SAFE_INTEGER);
	const queue: number[] = [];

	for (const baseIndex of baseIndexes) {
		distances[baseIndex] = 0;
		queue.push(baseIndex);
	}

	while (queue.length > 0) {
		const index = queue.shift()!;
		const cell = cells[index];

		for (const neighbor of cell.neighbors) {
			if (neighbor === -1) continue;
			if (distances[neighbor] <= distances[index] + 1) continue;

			distances[neighbor] = distances[index] + 1;
			queue.push(neighbor);
		}
	}

	return distances;
};

const myBaseDistances = getDistancesFromBases(myBases);
const oppBaseDistances = getDistancesFromBases(oppBases);

const findResourcesFromBase = (
	resourceType: number,
	baseIndex: number
): ResourceNode[] => {
	const resources: ResourceNode[] = [];
	const visited = new Set<number>();
	const queue: { index: number; distance: number; path: number[] }[] = [{
		index: baseIndex,
		distance: 0,
		path: [baseIndex]
	}];

	visited.add(baseIndex);

	while (queue.length > 0) {
		const current = queue.shift()!;
		const cell = cells[current.index];

		if (cell.type === resourceType && cell.resources > 0) {
			resources.push({
				type: resourceType,
				index: current.index,
				amount: cell.resources,
				distance: current.distance,
				path: current.path,
				baseIndex
			});
		}

		for (const neighbor of cell.neighbors) {
			if (neighbor === -1 || visited.has(neighbor)) continue;

			visited.add(neighbor);
			queue.push({
				index: neighbor,
				distance: current.distance + 1,
				path: [...current.path, neighbor]
			});
		}
	}

	return resources.sort((a, b) => {
		if (a.distance !== b.distance) return a.distance - b.distance;
		return b.amount - a.amount;
	});
};

const findResourcesByBase = (resourceType: number): Map<number, ResourceNode[]> => {
	const byBase = new Map<number, ResourceNode[]>();

	for (const baseIndex of myBases) {
		byBase.set(baseIndex, findResourcesFromBase(resourceType, baseIndex));
	}

	return byBase;
};

const findResources = (resourceType: number): ResourceNode[] => {
	const bestByIndex = new Map<number, ResourceNode>();

	for (const resources of findResourcesByBase(resourceType).values()) {
		for (const resource of resources) {
			const existing = bestByIndex.get(resource.index);

			if (!existing || resource.distance < existing.distance) {
				bestByIndex.set(resource.index, resource);
			}
		}
	}

	return [...bestByIndex.values()].sort((a, b) => {
		if (a.distance !== b.distance) return a.distance - b.distance;
		return b.amount - a.amount;
	});
};

const getPlannedCost = (strengths: Map<number, number>): number => {
	let cost = 0;

	for (const strength of strengths.values()) {
		cost += strength;
	}

	return cost;
};

const getPathCost = (
	path: number[],
	strength: number,
	strengths: Map<number, number>
): number => {
	let cost = 0;

	for (const index of path) {
		const current = strengths.get(index) ?? 0;
		cost += Math.max(0, strength - current);
	}

	return cost;
};

const getBestNetworkPath = (
	resource: ResourceNode,
	strengths: Map<number, number>,
	avoidCells: Set<number> = new Set<number>()
): number[] => {
	const findPath = (softAvoid: Set<number>): number[] | null => {
		const plannedStarts = strengths.size > 0
			? [...strengths.keys()].filter(index => !softAvoid.has(index) || index === resource.index)
			: [];
		const starts = plannedStarts.length > 0
			? plannedStarts
			: myBases;
		const visited = new Set<number>();
		const queue: { index: number; path: number[] }[] = starts.map(index => ({
			index,
			path: [index]
		}));

		for (const start of starts) {
			visited.add(start);
		}

		while (queue.length > 0) {
			const current = queue.shift()!;

			if (current.index === resource.index) {
				return current.path;
			}

			for (const neighbor of cells[current.index].neighbors) {
				if (neighbor === -1 || visited.has(neighbor)) continue;
				if (softAvoid.has(neighbor) && neighbor !== resource.index) continue;

				visited.add(neighbor);
				queue.push({
					index: neighbor,
					path: [...current.path, neighbor]
				});
			}
		}

		return null;
	};

	const avoidedPath = avoidCells.size > 0
		? findPath(avoidCells)
		: null;

	if (avoidedPath) return avoidedPath;

	const path = findPath(new Set<number>());

	return path ?? resource.path;
};

const hasAvoidedTransitCell = (
	path: number[],
	resource: ResourceNode,
	avoidCells: Set<number>
): boolean =>
	path.some(index => index !== resource.index && avoidCells.has(index));

const getStrategicPath = (
	resource: ResourceNode,
	strength: number,
	strengths: Map<number, number>,
	avoidCells: Set<number> = new Set<number>()
): number[] => {
	const canonicalPath = resource.path;
	const branchPath = getBestNetworkPath(resource, strengths, avoidCells);
	const canonicalHasAvoidedTransit = hasAvoidedTransitCell(canonicalPath, resource, avoidCells);
	const branchHasAvoidedTransit = hasAvoidedTransitCell(branchPath, resource, avoidCells);

	if (canonicalHasAvoidedTransit && !branchHasAvoidedTransit) return branchPath;
	if (branchHasAvoidedTransit && !canonicalHasAvoidedTransit) return canonicalPath;

	const canonicalCost = getPathCost(canonicalPath, strength, strengths);
	const branchCost = getPathCost(branchPath, strength, strengths);

	if (branchCost >= canonicalCost) return canonicalPath;

	const branchStart = branchPath[0];
	const branchStartsOnCanonicalPath = canonicalPath.includes(branchStart);
	const savedCost = canonicalCost - branchCost;

	if (branchStartsOnCanonicalPath && savedCost >= 1) return branchPath;
	if (savedCost >= 4 && branchPath.length <= canonicalPath.length) return branchPath;

	return canonicalPath;
};

const isOurSide = (resource: ResourceNode): boolean =>
	myBaseDistances[resource.index] <= oppBaseDistances[resource.index];

const isNeutralSide = (resource: ResourceNode): boolean =>
	myBaseDistances[resource.index] === oppBaseDistances[resource.index];

const isCheapExtension = (
	resource: ResourceNode,
	strengths: Map<number, number>,
	maxCost: number
): boolean =>
	getPathCost(getBestNetworkPath(resource, strengths), 1, strengths) <= maxCost;

const addPath = (
	path: number[],
	strength: number,
	strengths: Map<number, number>
): void => {
	for (const index of path) {
		const current = strengths.get(index) ?? 0;
		strengths.set(index, Math.max(current, strength));
	}
};

const isEnemyMiningTooFast = (
	resource: ResourceNode,
	strengths: Map<number, number>
): boolean => {
	const cell = cells[resource.index];

	if (resource.type !== CRYSTAL) return false;
	if (cell.oppAnts === 0) return false;
	if (cell.myAnts > 0) return false;

	const enemyClearTurns = Math.ceil(resource.amount / cell.oppAnts);
	const remainingPathCost = getPathCost(resource.path, 1, strengths)

	return remainingPathCost > enemyClearTurns + 2;
};

const getEggStrength = (egg: ResourceNode): number => {
	if (egg.distance <= 1) return 4;
	if (egg.distance <= 3) return 3;
	return 2;
};

const getDepletedStrength = (
	resource: ResourceNode,
	baseStrength: number
): number =>
	Math.max(1, Math.min(baseStrength, Math.ceil(resource.amount / 5)));

const isNearlyDepletedEggCell = (index: number): boolean =>
	cells[index].type === EGG &&
	cells[index].resources > 0 &&
	cells[index].resources <= 5;

const getEggTransitAvoidCells = (egg: ResourceNode): Set<number> => {
	const avoidCells = new Set<number>();

	for (let index = 0; index < cellCount; index++) {
		if (index === egg.index) continue;
		if (isNearlyDepletedEggCell(index)) {
			avoidCells.add(index);
		}
	}

	return avoidCells;
};

const shouldSwipe = (
	myAnts: number,
	oppAnts: number,
	eggs: ResourceNode[],
): boolean => {
	const reachableEggs = eggs.filter(egg =>
		egg.distance <= EGG_RUSH_MAX_DISTANCE &&
		egg.amount > 0 &&
		isOurSide(egg) &&
		getPathCost(egg.path, 1, new Map<number, number>()) <= Math.max(1, Math.floor(myAnts * ANT_BUDGET_RATIO))
	);
	const richReachableEggs = reachableEggs.some(egg => egg.amount >= 20);

	if (phase !== 'EGG_RUSH') return true;
	if (myAnts >= eggRushAntGoal && (myAnts >= oppAnts + 10 || !richReachableEggs)) return true;
	if (reachableEggs.length === 0) return true;

	return false;
};

const tryCommit = (
	resource: ResourceNode,
	strength: number,
	strengths: Map<number, number>,
	antBudget: number,
	actions: string[],
	logs: string[],
	label: string
): boolean => {
	const commitStrength = strength;
	const avoidCells = resource.type === EGG
		? getEggTransitAvoidCells(resource)
		: new Set<number>();

	const path = getStrategicPath(resource, commitStrength, strengths, avoidCells);
	const cost = getPathCost(path, commitStrength, strengths);

	if (getPlannedCost(strengths) + cost > antBudget) return false;
	if (cost === 0) return false;

	const beaconPath = path.filter(index => (strengths.get(index) ?? 0) < commitStrength);

	addPath(path, commitStrength, strengths);
	for (const index of beaconPath) {
		actions.push(`BEACON ${index} ${commitStrength}`)
	}
	logs.push(`${label}:${resource.index}/t${resource.type}/d${resource.distance}/a${resource.amount}/s${commitStrength}/cost${cost}`);
	return true;
};

const keepBasesAnchored = (
	strengths: Map<number, number>,
	antBudget: number,
	actions: string[],
	logs: string[]
): void => {
	for (const baseIndex of myBases) {
		if ((strengths.get(baseIndex) ?? 0) > 0) continue;
		if (getPlannedCost(strengths) + 1 > antBudget) continue;

		strengths.set(baseIndex, 1);
		actions.push(`BEACON ${baseIndex} 1`);
		logs.push(`anchor:${baseIndex}`);
	}
};

const getRouteScore = (
	resource: ResourceNode,
	strengths: Map<number, number>
): number =>
	resource.amount / Math.max(1, resource.distance + getPathCost(getBestNetworkPath(resource, strengths), 1, strengths));

const isEndgameCrystalRace = (): boolean =>
	myScore >= crystalGoal * 0.7 || oppScore >= crystalGoal * 0.7;

const isEndgameContestedCrystal = (crystal: ResourceNode): boolean =>
	isEndgameCrystalRace() &&
	(cells[crystal.index].oppAnts > 0 || hasOpponentPressureOnPath(crystal));

const getCrystalBaseStrength = (crystal: ResourceNode): number => {
	if (isEndgameContestedCrystal(crystal)) {
		return 4;
	}

	return cells[crystal.index].oppAnts > 0 ? 2 : 1;
};

const isBankedCrystal = (crystal: ResourceNode): boolean =>
	!isEndgameCrystalRace() &&
	isOurSide(crystal) &&
	cells[crystal.index].oppAnts === 0 &&
	!hasOpponentPressureOnPath(crystal);

const getEggPathValue = (resource: ResourceNode): number =>
	resource.path.reduce((sum, index) =>
		cells[index].type === EGG ? sum + cells[index].resources : sum,
	0);

const getSwipeEggCandidates = (
	eggs: ResourceNode[],
	strengths: Map<number, number>
): ResourceNode[] =>
	eggs
		.filter(egg =>
			isOurSide(egg)
				? egg.distance <= EGG_RUSH_MAX_DISTANCE
				: isCheapExtension(egg, strengths, 3)
		)
		.sort((a, b) => {
			const scoreA = getRouteScore(a, strengths);
			const scoreB = getRouteScore(b, strengths);

			if (scoreA !== scoreB) return scoreB - scoreA;
			return a.distance - b.distance;
		});

const hasOpponentPressureOnPath = (resource: ResourceNode): boolean =>
	resource.path.some(index => cells[index].oppAnts > cells[index].myAnts);

const getEggPressure = (egg: ResourceNode): number =>
	egg.path.reduce((total, index) => total + Math.max(0, cells[index].oppAnts - cells[index].myAnts), 0) +
	cells[egg.index].oppAnts;

const hasContestedEggRushTarget = (eggs: ResourceNode[]): boolean =>
	eggs.some(egg =>
		egg.distance <= EGG_RUSH_MAX_DISTANCE &&
		egg.amount > 0 &&
		(isNeutralSide(egg) || getEggPressure(egg) > 0)
	);

const commitEggRushDefense = (
	crystals: ResourceNode[],
	strengths: Map<number, number>,
	antBudget: number,
	actions: string[],
	logs: string[]
): boolean => {
	const defensiveCrystals = crystals
		.filter(crystal => isOurSide(crystal) || isNeutralSide(crystal))
		.filter(crystal => cells[crystal.index].oppAnts > 0 || hasOpponentPressureOnPath(crystal))
		.filter(crystal => !isEnemyMiningTooFast(crystal, strengths))
		.sort((a, b) => {
			const pathCostA = getPathCost(getBestNetworkPath(a, strengths), 1, strengths);
			const pathCostB = getPathCost(getBestNetworkPath(b, strengths), 1, strengths);
			const scoreA = a.amount / Math.max(1, a.distance + pathCostA);
			const scoreB = b.amount / Math.max(1, b.distance + pathCostB);

			if (pathCostA !== pathCostB) return pathCostA - pathCostB;
			if (scoreA !== scoreB) return scoreB - scoreA;
			return a.distance - b.distance;
		});

	for (const crystal of defensiveCrystals) {
		const baseStrength = cells[crystal.index].oppAnts > 0 ? 2 : 1;
		const strength = getDepletedStrength(crystal, baseStrength);

		for (let commitStrength = strength; commitStrength >= 1; commitStrength--) {
			if (tryCommit(crystal, commitStrength, strengths, antBudget, actions, logs, 'defCrystal')) {
				return true;
			}
		}
	}

	return false;
};

const commitEggRush = (
	eggs: ResourceNode[],
	crystals: ResourceNode[],
	strengths: Map<number, number>,
	antBudget: number,
	actions: string[],
	logs: string[]
): boolean => {
	let committedEggs = 0;
	const committedEggIndexes = new Set<number>();

	const sortEggCandidates = (eggCandidates: ResourceNode[]): ResourceNode[] =>
		eggCandidates.sort((a, b) => {
			if (a.distance !== b.distance) return a.distance - b.distance;

			const pressureA = isNeutralSide(a) ? getEggPressure(a) : 0;
			const pressureB = isNeutralSide(b) ? getEggPressure(b) : 0;
			if (pressureA !== pressureB) return pressureB - pressureA;

			const valueA = getEggPathValue(a);
			const valueB = getEggPathValue(b);
			if (valueA !== valueB) return valueB - valueA;
			if (b.amount !== a.amount) return b.amount - a.amount;
			return a.index - b.index
		});

	const tryEgg = (egg: ResourceNode): boolean => {
		const eggPressure = getEggPressure(egg);
		const baseStrength = Math.min(
			4,
			Math.max(
				getEggStrength(egg),
				isNeutralSide(egg) || eggPressure > 0 ? 2 : 1,
				cells[egg.index].oppAnts > 0 ? cells[egg.index].oppAnts + 1 : 1
			)
		);
		const strength = getDepletedStrength(egg, baseStrength);

		for (let commitStrength = strength; commitStrength >= 1; commitStrength--) {
			if (tryCommit(egg, commitStrength, strengths, antBudget, actions, logs, 'egg')) {
				return true;
			}
		}

		return false;
	};

	for (const baseIndex of myBases) {
		if (committedEggs >= EGG_RUSH_MAX_TARGETS) break;

		const localEggCandidates = sortEggCandidates(
			findResourcesFromBase(EGG, baseIndex)
				.filter(egg => egg.distance <= EGG_RUSH_MAX_DISTANCE)
				.filter(isOurSide)
				.filter(egg => !committedEggIndexes.has(egg.index))
		);

		for (const egg of localEggCandidates) {
			if (tryEgg(egg)) {
				committedEggs++;
				committedEggIndexes.add(egg.index);
				break;
			}
		}
	}

	const eggCandidates = sortEggCandidates(
		eggs
			.filter(egg => egg.distance <= EGG_RUSH_MAX_DISTANCE)
			.filter(isOurSide)
			.filter(egg => !committedEggIndexes.has(egg.index))
	);

	for (const egg of eggCandidates) {
		if (committedEggs >= EGG_RUSH_MAX_TARGETS) break;

		if (tryEgg(egg)) {
			committedEggs++;
			committedEggIndexes.add(egg.index);
		}
	}

	const defendedCrystal = hasContestedEggRushTarget(eggs)
		? false
		: commitEggRushDefense(crystals, strengths, antBudget, actions, logs);

	return committedEggs > 0 || defendedCrystal;
};

const commitSwipe = (
	eggs: ResourceNode[],
	crystals: ResourceNode[],
	strengths: Map<number, number>,
	antBudget: number,
	myAnts: number,
	preferStickyCrystals: boolean,
	actions: string[],
	logs: string[]
): void => {
	let committedEggs = 0
	let committedCrystals = 0
	const committedCrystalTargets: number[] = [];

	const maxCrystalDistance = myAnts >= 70 ? 12 : 6;
	const allCrystalCandidates = crystals
		.filter(crystal =>
			crystal.distance <= maxCrystalDistance || getPathCost(crystal.path, 1, strengths) <= 4
		)
		.filter(crystal => !isEnemyMiningTooFast(crystal, strengths))
		.sort((a, b) => {
			const scoreA = getRouteScore(a, strengths);
			const scoreB = getRouteScore(b, strengths);

			if (scoreA !== scoreB) return scoreB - scoreA;
			return a.distance - b.distance;
		});
	const attackCrystalCandidates = allCrystalCandidates.filter(crystal => !isBankedCrystal(crystal));
	const bankedCrystalCandidates = allCrystalCandidates.filter(isBankedCrystal);
	const crystalCandidates = [...attackCrystalCandidates, ...bankedCrystalCandidates];

	const maxCrystalTargets = myAnts >= 70
		? SWIPE_HIGH_ANT_CRYSTAL_TARGETS
		: SWIPE_LOW_ANT_CRYSTAL_TARGETS

	const tryCrystal = (crystal: ResourceNode, label: string): boolean => {
		if (committedCrystalTargets.includes(crystal.index)) return false;

		const baseStrength = getCrystalBaseStrength(crystal);
		const strength = isEndgameContestedCrystal(crystal)
			? baseStrength
			: getDepletedStrength(crystal, baseStrength);

		if (tryCommit(crystal, strength, strengths, antBudget, actions, logs, label)) {
			committedCrystals++;
			committedCrystalTargets.push(crystal.index);
			return true;
		}

		return false;
	};

	if (preferStickyCrystals) {
		for (const targetIndex of lastSwipeCrystalTargets) {
			if (committedCrystals >= maxCrystalTargets) break;

			const crystal = crystals.find(candidate => candidate.index === targetIndex);

			if (!crystal) continue;
			if (isEnemyMiningTooFast(crystal, strengths)) continue;

			tryCrystal(crystal, 'stickyCrystal');
		}
	}

	for (const crystal of crystalCandidates) {
		if (committedCrystals >= maxCrystalTargets) break
		tryCrystal(crystal, 'crystal');
	}

	if (committedCrystalTargets.length > 0) {
		lastSwipeCrystalTargets = committedCrystalTargets;
	}

	const swipeEggCandidates = getSwipeEggCandidates(eggs, strengths);

	for (const egg of swipeEggCandidates) {
		if (committedEggs >= 3) break;

		const strength = getDepletedStrength(egg, 1);

		if (tryCommit(egg, strength, strengths, antBudget, actions, logs, 'swipeEgg')) {
			committedEggs++;
		}
	}
};

while (true) {
	turn++;

	let myAnts = 0;
	let oppAnts = 0;
	const scoreInputs = readline().split(' ').map(Number);

	myScore = scoreInputs[0];
	oppScore = scoreInputs[1];
	const myCrystalIncome = Math.max(0, myScore - previousMyScore);
	const oppCrystalIncome = Math.max(0, oppScore - previousOppScore);
	const preferStickyCrystals = phase === 'SWIPE' && myCrystalIncome > oppCrystalIncome;
	previousMyScore = myScore;
	previousOppScore = oppScore;

	for (let i = 0; i < cellCount; i++) {
		const [resources, my, opp] = readline().split(' ').map(Number);
		const harvested = Math.max(0, previousResources[i] - resources);

		if (harvested > 0 && cells[i].type === EGG) {
			harvestedEggs += harvested;
		}

		previousResources[i] = resources;
		cells[i].resources = resources;
		cells[i].myAnts = my;
		cells[i].oppAnts = opp;

		myAnts += my;
		oppAnts += opp;
	}

	const eggs = findResources(EGG);
	const crystals = findResources(CRYSTAL);

	if (shouldSwipe(myAnts, oppAnts, eggs)) {
		phase = 'SWIPE';
	}

	const strengths = new Map<number, number>();
	const actions = [`MESSAGE ${phase}`];
	const logs: string[] = [];
	const antBudget = Math.max(1, Math.floor(myAnts * ANT_BUDGET_RATIO));

	if (phase === 'EGG_RUSH') {
		lastSwipeCrystalTargets = [];

		if (!commitEggRush(eggs, crystals, strengths, antBudget, actions, logs)) {
			commitSwipe(eggs, crystals, strengths, antBudget, myAnts, false, actions, logs);
		}
	} else {
		commitSwipe(eggs, crystals, strengths, antBudget, myAnts, preferStickyCrystals, actions, logs);
	}

	keepBasesAnchored(strengths, antBudget, actions, logs);

	console.error(
		`t=${turn} phase=${phase} ants=${myAnts}/${oppAnts}/${eggRushAntGoal} score=${myScore}-${oppScore}/${crystalGoal} eggs=${harvestedEggs}/${initialEggTotal} budget=${antBudget} cost=${getPlannedCost(strengths)}`
	);
	console.error(logs.join(' | ') || 'idle');

	console.log(actions.join(';'));
}
