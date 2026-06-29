/**
 * Smart node pathing bot
 *
 * Strategy:
 * - Every live resource is a checkpoint node.
 * - Build beacon chains only as node-to-node segments from bases and chosen checkpoints.
 * - Recompute the plan every turn; depleted nodes disappear naturally.
 * - Keep two simple policies:
 *   - EGG_FIRST: eggs outrank crystals.
 *   - CRYSTAL_FIRST: crystals outrank eggs.
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
	myBaseDistance: number;
	oppBaseDistance: number;
	baseIndex: number;
}

interface NodeRoute {
	target: ResourceNode;
	effectiveTargetValue: number;
	startIndex: number;
	path: number[];
	distance: number;
	baseDistance: number;
	extensionCost: number;
	corridorValue: number;
	contested: boolean;
	enemySide: boolean;
	strength: number;
	distruptionValue: number;
}

type Phase = 'EGG_FIRST' | 'CRYSTAL_FIRST';

const EGG = 1;
const CRYSTAL = 2;

const ANT_BUDGET_RATIO = 0.9;
const CHEAP_ENEMY_ROUTE_COST = 4;
const MAX_ROUTE_DISTANCE = 8;
const CHECKPOINT_LIMIT_LOW = 4;
const CHECKPOINT_LIMIT_MID = 6;
const CHECKPOINT_LIMIT_HIGH = 8;

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
let myScore = 0;
let oppScore = 0;
let harvestedEggs = 0;
let previousStrengths = new Map<number, number>();

const previousResources = cells.map(cell => cell.resources);
const initialEggTotal = cells
	.filter(cell => cell.type === EGG)
	.reduce((sum, cell) => sum + cell.resources, 0);
const initialCrystalTotal = cells
	.filter(cell => cell.type === CRYSTAL)
	.reduce((sum, cell) => sum + cell.resources, 0);
const eggSpawnMultiplier = myBases.length
const initialEggValue = initialEggTotal * eggSpawnMultiplier
const crystalGoal = Math.floor(initialCrystalTotal / 2) + 1;
const eggPhaseAntGoal = Math.max(
	45 + (myBases.length - 1) * 12,
	Math.floor(initialEggValue * 0.6)
);

const getDistancesFromStarts = (startIndexes: number[]): number[] => {
	const distances = Array(cellCount).fill(Number.MAX_SAFE_INTEGER);
	const queue: number[] = [];

	for (const startIndex of startIndexes) {
		if (distances[startIndex] === 0) continue;
		distances[startIndex] = 0;
		queue.push(startIndex);
	}

	while (queue.length > 0) {
		const index = queue.shift()!;
		const nextDistance = distances[index] + 1;

		for (const neighbor of cells[index].neighbors) {
			if (neighbor === -1) continue;
			if (distances[neighbor] <= nextDistance) continue;

			distances[neighbor] = nextDistance;
			queue.push(neighbor);
		}
	}

	return distances;
};

const getShortestPathFromStarts = (
	startIndexes: number[],
	targetIndex: number
): number[] | null => {
	const queue: { index: number; path: number[] }[] = [];
	const visited = new Set<number>();

	for (const startIndex of startIndexes) {
		if (visited.has(startIndex)) continue;

		visited.add(startIndex);
		queue.push({
			index: startIndex,
			path: [startIndex]
		});
	}

	while (queue.length > 0) {
		const current = queue.shift()!;

		if (current.index === targetIndex) {
			return current.path;
		}

		for (const neighbor of cells[current.index].neighbors) {
			if (neighbor === -1 || visited.has(neighbor)) continue;

			visited.add(neighbor);
			queue.push({
				index: neighbor,
				path: [...current.path, neighbor]
			});
		}
	}

	return null;
};

const myBaseDistances = getDistancesFromStarts(myBases);
const oppBaseDistances = getDistancesFromStarts(oppBases);
const myBaseDistancesByBase = myBases.map(baseIndex => ({
	baseIndex,
	distances: getDistancesFromStarts([baseIndex])
}));

const getClosestBaseIndex = (index: number): number => {
	let bestBaseIndex = myBases[0];
	let bestDistance = Number.MAX_SAFE_INTEGER;

	for (const baseData of myBaseDistancesByBase) {
		const distance = baseData.distances[index];

		if (distance < bestDistance) {
			bestDistance = distance;
			bestBaseIndex = baseData.baseIndex;
		}
	}

	return bestBaseIndex;
};

const getLiveNodes = (): ResourceNode[] => {
	const nodes: ResourceNode[] = [];

	for (let index = 0; index < cellCount; index++) {
		const cell = cells[index];

		if ((cell.type !== EGG && cell.type !== CRYSTAL) || cell.resources <= 0) continue;

		nodes.push({
			type: cell.type,
			index,
			amount: cell.resources,
			myBaseDistance: myBaseDistances[index],
			oppBaseDistance: oppBaseDistances[index],
			baseIndex: getClosestBaseIndex(index)
		});
	}

	return nodes;
};

const isEnemySide = (node: ResourceNode): boolean =>
	node.myBaseDistance > node.oppBaseDistance;

const isContested = (node: ResourceNode): boolean =>
	node.myBaseDistance === node.oppBaseDistance ||
	cells[node.index].oppAnts > 0;

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

const getPathResourceValue = (
	path: number[],
	targetIndex: number
): number =>
	path.reduce((sum, index) => {
		if (index === targetIndex) return sum;

		const cell = cells[index];

		if ((cell.type !== EGG && cell.type !== CRYSTAL) || cell.resources <= 0) {
			return sum;
		}

		return sum + cell.resources;
	}, 0);

const getPathDistruptionValue = (
	path: number[],
	target: ResourceNode
): number => {
	let value = 0;
	const seen = new Set<number>();

	for (const index of path) {
		const cell = cells[index];

		if (cell.oppAnts > 0) {
			value += cell.oppAnts > cell.myAnts ? 6 : 3;
		}

		for (const neighbor of cell.neighbors) {
			if (neighbor === -1 || seen.has(neighbor)) continue;
			seen.add(neighbor);

			const neighborCell = cells[neighbor];
			if ((neighborCell.type !== EGG && neighborCell.type !== CRYSTAL) || neighborCell.resources <= 0) {
				continue;
			}

			const enemyLeaning = oppBaseDistances[neighbor] <= myBaseDistances[neighbor];
			if (!enemyLeaning) continue;

			if (neighborCell.oppAnts > 0) {
				value += 4;
			} else {
				value += 2;
			}
		}
	}

	if (target.oppBaseDistance <= target.myBaseDistance) {
		value += 3;
	}

	return value;
};

const getNodeStrength = (
	node: ResourceNode,
	phase: Phase
): number => {
	if (cells[node.index].oppAnts > 0) return 2;
	if (node.amount <= 5) return 1;
	if (phase === 'EGG_FIRST' && node.type === EGG && node.amount >= 10) return 2;
	if (phase === 'CRYSTAL_FIRST' && node.type === CRYSTAL && node.amount >= 12) return 2;

	return 1;
};

const getDepletedStrength = (
	node: ResourceNode,
	baseStrength: number
): number =>
	Math.max(1, Math.min(baseStrength, Math.ceil(node.amount / 5)));

const buildNodeRoute = (
	target: ResourceNode,
	anchorIndexes: number[],
	strengths: Map<number, number>,
	phase: Phase,
	strengthOverride?: number
): NodeRoute | null => {
	const path = getShortestPathFromStarts(anchorIndexes, target.index);

	if (!path) return null;

	const distruptionValue = getPathDistruptionValue(path, target);
	const startIndex = path[0];
	const distance = Math.max(0, path.length - 1);
	const baseDistance = target.myBaseDistance
	const strength = strengthOverride ?? getNodeStrength(target, phase);
	const extensionCost = getPathCost(path, strength, strengths);
	const contested = isContested(target)
	const enemySide = isEnemySide(target);
	const effectiveTargetValue = target.type === EGG
		? target.amount * eggSpawnMultiplier
		: target.amount

	if (distance > MAX_ROUTE_DISTANCE && extensionCost > CHEAP_ENEMY_ROUTE_COST) return null;
	if (enemySide && extensionCost > CHEAP_ENEMY_ROUTE_COST) return null;

	const isFarLowValueEggRoute = phase === 'EGG_FIRST' &&
									target.type === EGG &&
									!contested &&
									baseDistance > 6 &&
									target.amount < 14;

	if (isFarLowValueEggRoute) return null

	return {
		target,
		effectiveTargetValue,
		distruptionValue,
		startIndex,
		path,
		distance,
		baseDistance,
		extensionCost,
		corridorValue: getPathResourceValue(path, target.index),
		contested: isContested(target),
		enemySide,
		strength
	};
};

const compareRoutes = (
	a: NodeRoute,
	b: NodeRoute,
	phase: Phase
): number => {
	const preferredType = phase === 'EGG_FIRST' ? EGG : CRYSTAL;
	const preferredA = a.target.type === preferredType ? 1 : 0;
	const preferredB = b.target.type === preferredType ? 1 : 0;

	if (preferredA !== preferredB) return preferredB - preferredA;
	if (a.contested !== b.contested) return Number(b.contested) - Number(a.contested);
	if (a.distruptionValue !== b.distruptionValue) return b.distruptionValue - a.distruptionValue;
	if (a.enemySide !== b.enemySide) return Number(a.enemySide) - Number(b.enemySide);
	if (a.baseDistance !== b.baseDistance) return a.baseDistance - b.baseDistance
	if (a.extensionCost !== b.extensionCost) return a.extensionCost - b.extensionCost;
	if (a.effectiveTargetValue !== b.effectiveTargetValue) return b.effectiveTargetValue - a.effectiveTargetValue
	if (a.distance !== b.distance) return a.distance - b.distance;
	if (a.corridorValue !== b.corridorValue) return b.corridorValue - a.corridorValue;
	if (a.target.amount !== b.target.amount) return b.target.amount - a.target.amount;

	return a.target.index - b.target.index;
};

const getCheckpointLimit = (myAnts: number): number => {
	if (myAnts >= 80) return CHECKPOINT_LIMIT_HIGH;
	if (myAnts >= 45) return CHECKPOINT_LIMIT_MID;

	return CHECKPOINT_LIMIT_LOW;
};

const getPhase = (
	myAnts: number,
	eggNodes: ResourceNode[],
	crystalNodes: ResourceNode[]
): Phase => {
	if (eggNodes.length === 0) return 'CRYSTAL_FIRST';
	if (crystalNodes.length === 0) return 'EGG_FIRST';
	if (myAnts < eggPhaseAntGoal) return 'EGG_FIRST';

	const remainingEggs = eggNodes.reduce((sum, node) => sum + node.amount, 0) * eggSpawnMultiplier;
	const remainingCrystals = crystalNodes.reduce((sum, node) => sum + node.amount, 0);

	if (remainingEggs > remainingCrystals && myAnts < eggPhaseAntGoal + 12) {
		return 'EGG_FIRST';
	}

	return 'CRYSTAL_FIRST';
};

const commitRoute = (
	route: NodeRoute,
	strengths: Map<number, number>,
	antBudget: number,
	actions: string[],
	logs: string[]
): boolean => {
	if (getPlannedCost(strengths) + route.extensionCost > antBudget) return false;
	if (route.extensionCost === 0) return false;

	const beaconPath = route.path.filter(index => (strengths.get(index) ?? 0) < route.strength);

	addPath(route.path, route.strength, strengths);

	for (const index of beaconPath) {
		actions.push(`BEACON ${index} ${route.strength}`);
	}

	logs.push(
		`node:${route.startIndex}->${route.target.index}/t${route.target.type}/d${route.distance}/cost${route.extensionCost}/v${route.corridorValue}/x${route.distruptionValue}/a${route.target.amount}`
	);

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

const hasPlannedEggRoute = (
	eggNodes: ResourceNode[],
	strengths: Map<number, number>
): boolean =>
	eggNodes.some(egg => (strengths.get(egg.index) ?? 0) > 0);

const commitStickyEggRoutes = (
	eggNodes: ResourceNode[],
	anchorIndexes: number[],
	strengths: Map<number, number>,
	antBudget: number,
	committedTargets: Set<number>,
	blockedTargets: Set<number>,
	actions: string[],
	logs: string[]
): void => {
	if (eggNodes.length === 0) return;

	const stickyEggs = eggNodes
		.filter(egg => (previousStrengths.get(egg.index) ?? 0) > 0)
		.filter(egg => !committedTargets.has(egg.index))
		.sort((a, b) => {
			const previousStrengthA = previousStrengths.get(a.index) ?? 0;
			const previousStrengthB = previousStrengths.get(b.index) ?? 0;

			if (previousStrengthA !== previousStrengthB) return previousStrengthB - previousStrengthA;
			if (a.amount !== b.amount) return b.amount - a.amount;
			if (a.myBaseDistance !== b.myBaseDistance) return a.myBaseDistance - b.myBaseDistance;

			return a.index - b.index;
		});

	for (const egg of stickyEggs) {
		const previousStrength = Math.max(1, previousStrengths.get(egg.index) ?? 1);
		const stickyStrength = getDepletedStrength(egg, previousStrength);
		let committed = false;

		for (let strength = stickyStrength; strength >= 1; strength--) {
			const route = buildNodeRoute(egg, anchorIndexes, strengths, 'CRYSTAL_FIRST', strength);

			if (!route) continue;

			if (route.extensionCost === 0 || commitRoute(route, strengths, antBudget, actions, logs)) {
				committedTargets.add(egg.index);
				anchorIndexes.push(egg.index);

				if (route.extensionCost === 0) {
					logs.push(`stickyEgg:${egg.index}/covered/s${strength}`);
				} else {
					logs.push(`stickyEgg:${egg.index}/cost${route.extensionCost}/s${strength}`);
				}

				committed = true;
				break;
			}
		}

		if (!committed) {
			blockedTargets.add(egg.index);
		}
	}
};

const buildCheckpointPlan = (
	nodes: ResourceNode[],
	phase: Phase,
	myAnts: number,
	antBudget: number,
	actions: string[],
	logs: string[]
): Map<number, number> => {
	const strengths = new Map<number, number>();
	const anchorIndexes = [...myBases];
	const committedTargets = new Set<number>();
	const blockedTargets = new Set<number>();
	const eggNodes = nodes.filter(node => node.type === EGG);
	const checkpointLimit = getCheckpointLimit(myAnts);

	const fillPlan = (targetLimit: number): void => {
		while (committedTargets.size < targetLimit) {
			const candidates = nodes
				.filter(node => !committedTargets.has(node.index))
				.filter(node => !blockedTargets.has(node.index))
				.map(node => buildNodeRoute(node, anchorIndexes, strengths, phase))
				.filter((route): route is NodeRoute => route !== null)
				.sort((a, b) => compareRoutes(a, b, phase));

			if (candidates.length === 0) break;

			let committed = false;

			for (const route of candidates) {
				if (!commitRoute(route, strengths, antBudget, actions, logs)) {
					blockedTargets.add(route.target.index);
					continue;
				}

				committedTargets.add(route.target.index);
				anchorIndexes.push(route.target.index);
				committed = true;
				break;
			}

			if (!committed) break;
		}
	};

	if (eggNodes.length > 0 && hasPlannedEggRoute(eggNodes, previousStrengths)) {
		commitStickyEggRoutes(
			eggNodes,
			anchorIndexes,
			strengths,
			antBudget,
			committedTargets,
			blockedTargets,
			actions,
			logs
		);
	}

	fillPlan(checkpointLimit);

	return strengths;
};

while (true) {
	turn++;

	let myAnts = 0;
	let oppAnts = 0;
	const [nextMyScore, nextOppScore] = readline().split(' ').map(Number);

	myScore = nextMyScore;
	oppScore = nextOppScore;

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

	const nodes = getLiveNodes();
	const eggNodes = nodes.filter(node => node.type === EGG);
	const crystalNodes = nodes.filter(node => node.type === CRYSTAL);
	const phase = getPhase(myAnts, eggNodes, crystalNodes);
	const actions = [`MESSAGE ${phase}`];
	const logs: string[] = [];
	const antBudget = Math.max(1, Math.floor(myAnts * ANT_BUDGET_RATIO));
	const strengths = buildCheckpointPlan(nodes, phase, myAnts, antBudget, actions, logs);

	keepBasesAnchored(strengths, antBudget, actions, logs);
	previousStrengths = new Map<number, number>(strengths);

	console.error(
		`t=${turn} phase=${phase} ants=${myAnts}/${oppAnts}/${eggPhaseAntGoal} score=${myScore}-${oppScore}/${crystalGoal}  eggs=${harvestedEggs}/${initialEggTotal} eggx=${eggSpawnMultiplier} budget=${antBudget} cost=${getPlannedCost(strengths)}`
	);
	console.error(logs.join(' | ') || 'idle');

	console.log(actions.join(';'));
}