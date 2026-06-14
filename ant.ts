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
const EGG_RUSH_ANT_GOAL = 50;
const EGG_RUSH_MAX_TARGETS = 3;
const EGG_RUSH_MAX_DISTANCE = 6;

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
readline();

let turn = 0;
let phase: Phase = 'EGG_RUSH';
let harvestedEggs = 0;
let myScore = 0;
let oppScore = 0;

const initialEggTotal = cells
	.filter(cell => cell.type === EGG)
	.reduce((sum, cell) => sum + cell.resources, 0);

const initialCrystalTotal = cells
	.filter(cell => cell.type === CRYSTAL)
	.reduce((sum, cell) => sum + cell.resources, 0);

const crystalGoal = Math.floor(initialCrystalTotal / 2) + 1;
const previousResources = cells.map(cell => cell.resources);

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

const isEnemyMiningTooFast = (resource: ResourceNode): boolean => {
	const cell = cells[resource.index];

	if (resource.type !== CRYSTAL) return false;
	if (cell.oppAnts === 0) return false;
	if (cell.myAnts > 0) return false;

	const enemyClearTurns = Math.ceil(resource.amount / cell.oppAnts);

	return resource.distance > enemyClearTurns + 2;
};

const hasOpponentPressureOnPath = (path: number[]): boolean =>
	path.some(index => cells[index].oppAnts > cells[index].myAnts);

const getCommitStrength = (
	resource: ResourceNode,
	strength: number,
	strengths: Map<number, number>,
	antBudget: number
): number => {
	if (strength > 1) return strength;
	if (!hasOpponentPressureOnPath(resource.path)) return strength;

	const shouldReinforce =
		resource.distance <= 4 ||
		resource.amount >= 20 ||
		(resource.type === EGG && resource.distance <= EGG_RUSH_MAX_DISTANCE);

	if (!shouldReinforce) return 0;

	const reinforcedStrength = 2;
	const cost = getPathCost(resource.path, reinforcedStrength, strengths);

	if (getPlannedCost(strengths) + cost > antBudget) return 0;

	return reinforcedStrength;
};

const getEggStrength = (egg: ResourceNode): number => {
	if (egg.distance <= 2) return 2;
	return 1;
};

const shouldSwipe = (myAnts: number, eggs: ResourceNode[]): boolean => {
	if (phase === 'SWIPE') return true;
	if (myAnts >= EGG_RUSH_ANT_GOAL) return true;
	if (turn >= 10 && oppScore > myScore + 20) return true;

	const hasReachableEggs = eggs.some(egg =>
		egg.distance <= EGG_RUSH_MAX_DISTANCE &&
		egg.amount > 0
	);

	if (!hasReachableEggs) return true;

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
	const commitStrength = getCommitStrength(resource, strength, strengths, antBudget);

	if (commitStrength === 0) return false;

	const cost = getPathCost(resource.path, commitStrength, strengths);

	if (getPlannedCost(strengths) + cost > antBudget) return false;
	if (cost === 0) return false;

	addPath(resource.path, commitStrength, strengths);
	actions.push(`LINE ${resource.baseIndex} ${resource.index} ${commitStrength}`);
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

const getEggScore = (egg: ResourceNode): number =>
	egg.amount * (egg.distance <= 2 ? 2 : 1) / Math.max(1, egg.distance);

const getRouteScore = (
	resource: ResourceNode,
	strengths: Map<number, number>
): number =>
	resource.amount / Math.max(1, resource.distance + getPathCost(resource.path, 1, strengths));

const commitEggRush = (
	eggs: ResourceNode[],
	eggsByBase: Map<number, ResourceNode[]>,
	crystals: ResourceNode[],
	strengths: Map<number, number>,
	antBudget: number,
	myAnts: number,
	actions: string[],
	logs: string[]
): void => {
	let committedEggs = 0;
	const eggCandidates = eggs
		.filter(egg => egg.distance <= EGG_RUSH_MAX_DISTANCE)
		.sort((a, b) => {
			const scoreA = getEggScore(a);
			const scoreB = getEggScore(b);

			if (scoreA !== scoreB) return scoreB - scoreA;
			return a.distance - b.distance;
		});
	const priorityEgg = eggCandidates.find(egg =>
		egg.distance <= 2 &&
		egg.amount >= 20
	);

	if (priorityEgg && tryCommit(priorityEgg, 3, strengths, antBudget, actions, logs, 'priorityEgg')) {
		if (myAnts < 25) return;
		committedEggs++;
	}

	for (const baseIndex of myBases) {
		if ((strengths.get(baseIndex) ?? 0) > 0) continue;
		if (committedEggs >= EGG_RUSH_MAX_TARGETS) break;

		const localEgg = (eggsByBase.get(baseIndex) ?? [])
			.filter(egg => egg.distance <= EGG_RUSH_MAX_DISTANCE)
			.sort((a, b) => {
				const scoreA = getEggScore(a);
				const scoreB = getEggScore(b);

				if (scoreA !== scoreB) return scoreB - scoreA;
				return a.distance - b.distance;
			})[0];

		if (localEgg && tryCommit(localEgg, getEggStrength(localEgg), strengths, antBudget, actions, logs, 'localEgg')) {
			committedEggs++;
		}
	}

	for (const egg of eggCandidates) {
		if (committedEggs >= EGG_RUSH_MAX_TARGETS) break;
		if (egg.index === priorityEgg?.index) continue;

		if (tryCommit(egg, getEggStrength(egg), strengths, antBudget, actions, logs, 'egg')) {
			committedEggs++;
		}
	}

	const shouldTakeOpeningCrystals = crystalGoal <= myAnts * 3;

	if (!shouldTakeOpeningCrystals) return;

	const closeCrystals = crystals
		.filter(crystal => crystal.distance <= 3)
		.filter(crystal => !isEnemyMiningTooFast(crystal))
		.sort((a, b) => {
			if (a.distance !== b.distance) return a.distance - b.distance;
			return b.amount - a.amount;
		});

	for (const crystal of closeCrystals) {
		tryCommit(crystal, 1, strengths, antBudget, actions, logs, 'closeCrystal');
	}
};

const getOpponentPressure = (resource: ResourceNode): number => {
	return resource.path.reduce((total, index) => total + cells[index].oppAnts, 0);
};

const commitCuts = (
	crystals: ResourceNode[],
	strengths: Map<number, number>,
	antBudget: number,
	myAnts: number,
	oppAnts: number,
	actions: string[],
	logs: string[]
): void => {
	if (myAnts < 70 && myAnts < oppAnts + 10) return;

	const cutCandidates = crystals
		.filter(crystal => crystal.amount > 0)
		.filter(crystal => !isEnemyMiningTooFast(crystal))
		.filter(crystal => cells[crystal.index].oppAnts > 0 || hasOpponentPressureOnPath(crystal.path))
		.filter(crystal => crystal.distance <= 8 || getPathCost(crystal.path, 2, strengths) <= 8)
		.sort((a, b) => {
			const pressureA = getOpponentPressure(a);
			const pressureB = getOpponentPressure(b);
			const scoreA = (a.amount + pressureA * 4) / Math.max(1, a.distance + getPathCost(a.path, 2, strengths));
			const scoreB = (b.amount + pressureB * 4) / Math.max(1, b.distance + getPathCost(b.path, 2, strengths));

			if (scoreA !== scoreB) return scoreB - scoreA;
			if (pressureA !== pressureB) return pressureB - pressureA;
			return a.distance - b.distance;
		});
	let committedCuts = 0;

	for (const crystal of cutCandidates) {
		if (committedCuts >= 3) break;

		if (tryCommit(crystal, 2, strengths, antBudget, actions, logs, 'cut')) {
			committedCuts++;
		}
	}
};

const commitSwipe = (
	eggs: ResourceNode[],
	eggsByBase: Map<number, ResourceNode[]>,
	crystals: ResourceNode[],
	crystalsByBase: Map<number, ResourceNode[]>,
	strengths: Map<number, number>,
	antBudget: number,
	myAnts: number,
	oppAnts: number,
	actions: string[],
	logs: string[]
): void => {
	const stillWantEggs = eggs.length > 0;
	const eggCandidates = eggs
		.filter(egg =>
			stillWantEggs &&
			(egg.distance <= EGG_RUSH_MAX_DISTANCE || getPathCost(egg.path, 1, strengths) <= 3)
		)
		.sort((a, b) => {
			const scoreA = getRouteScore(a, strengths);
			const scoreB = getRouteScore(b, strengths);

			if (scoreA !== scoreB) return scoreB - scoreA;
			return a.distance - b.distance;
		});
	let committedEggs = 0;

	for (const baseIndex of myBases) {
		if ((strengths.get(baseIndex) ?? 0) > 0) continue;

		const localEgg = (eggsByBase.get(baseIndex) ?? [])
			.filter(egg =>
				stillWantEggs &&
				(egg.distance <= EGG_RUSH_MAX_DISTANCE || getPathCost(egg.path, 1, strengths) <= 3)
			)
			.sort((a, b) => {
				const scoreA = getRouteScore(a, strengths);
				const scoreB = getRouteScore(b, strengths);

				if (scoreA !== scoreB) return scoreB - scoreA;
				return a.distance - b.distance;
			})[0];

		if (localEgg && tryCommit(localEgg, 1, strengths, antBudget, actions, logs, 'localEgg')) {
			committedEggs++;
			continue;
		}

		const localCrystal = (crystalsByBase.get(baseIndex) ?? [])
			.filter(crystal => !isEnemyMiningTooFast(crystal))
			.filter(crystal => crystal.distance <= 6 || getPathCost(crystal.path, 1, strengths) <= 4)
			.sort((a, b) => {
				const scoreA = getRouteScore(a, strengths);
				const scoreB = getRouteScore(b, strengths);

				if (scoreA !== scoreB) return scoreB - scoreA;
				return a.distance - b.distance;
			})[0];

		if (localCrystal) {
			tryCommit(localCrystal, 1, strengths, antBudget, actions, logs, 'localCrystal');
		}
	}

	for (const egg of eggCandidates) {
		if (committedEggs >= 3) break;

		if (tryCommit(egg, 1, strengths, antBudget, actions, logs, 'swipeEgg')) {
			committedEggs++;
		}
	}

	commitCuts(crystals, strengths, antBudget, myAnts, oppAnts, actions, logs);

	const maxCrystalDistance = myAnts >= 70 ? 12 : 6;
	const crystalCandidates = crystals
		.filter(crystal =>
			crystal.distance <= maxCrystalDistance || getPathCost(crystal.path, 1, strengths) <= 4
		)
		.filter(crystal => !isEnemyMiningTooFast(crystal))
		.sort((a, b) => {
			const scoreA = getRouteScore(a, strengths);
			const scoreB = getRouteScore(b, strengths);

			if (scoreA !== scoreB) return scoreB - scoreA;
			return a.distance - b.distance;
		});

	for (const crystal of crystalCandidates) {
		tryCommit(crystal, 1, strengths, antBudget, actions, logs, 'crystal');
	}

	for (const egg of eggCandidates) {
		if (committedEggs >= 6) break;

		if (tryCommit(egg, 1, strengths, antBudget, actions, logs, 'extraEgg')) {
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
	const eggsByBase = findResourcesByBase(EGG);
	const crystalsByBase = findResourcesByBase(CRYSTAL);

	if (shouldSwipe(myAnts, eggs)) {
		phase = 'SWIPE';
	}

	const strengths = new Map<number, number>();
	const actions = [`MESSAGE ${phase}`];
	const logs: string[] = [];
	const antBudget = Math.max(1, Math.floor(myAnts * ANT_BUDGET_RATIO));

	if (phase === 'EGG_RUSH') {
		commitEggRush(eggs, eggsByBase, crystals, strengths, antBudget, myAnts, actions, logs);
	} else {
		commitSwipe(eggs, eggsByBase, crystals, crystalsByBase, strengths, antBudget, myAnts, oppAnts, actions, logs);
	}

	keepBasesAnchored(strengths, antBudget, actions, logs);

	console.error(
		`t=${turn} phase=${phase} ants=${myAnts}/${oppAnts} score=${myScore}-${oppScore}/${crystalGoal} eggs=${harvestedEggs}/${initialEggTotal} budget=${antBudget} cost=${getPlannedCost(strengths)}`
	);
	console.error(logs.join(' | ') || 'idle');

	console.log(actions.join(';'));
}
