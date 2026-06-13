/**
 * CodinGame Spring Challenge 2023 - Ants
 *
 * Fresh strategy shell:
 * - Harvest close eggs while reachable close eggs exist.
 * - Require enough ants before committing to any resource road.
 * - Keep tagged healthy roads sticky at low strength.
 * - After close eggs, swipe all reachable crystals.
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
	baseIndex: number;
	amount: number;
	distance: number;
	path: number[];
}

const EGG = 1;
const CRYSTAL = 2;
const URGENT_EGG_DISTANCE = 2;
const MINERAL_BEACON_STRENGTH = 3;
const MINERAL_TARGET_ANT_DIVISOR = 6;

const numberOfCells: number = parseInt(readline());

const cells: Cell[] = [];

for (let i = 0; i < numberOfCells; i++) {
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
const myBaseIndexes = readline().split(' ').map(Number);
readline();

const stickyBeaconIndexes = new Set<number>();
let turn = 0;

const findResourcesFromBase = (baseIndex: number, resourceType: number): ResourceNode[] => {
	const visited = new Set<number>();
	const queue: { index: number; distance: number; path: number[] }[] = [{
		index: baseIndex,
		distance: 0,
		path: [baseIndex]
	}];
	const resources: ResourceNode[] = [];

	visited.add(baseIndex);

	while (queue.length > 0) {
		const current = queue.shift()!;
		const currentCell = cells[current.index];

		if (currentCell.type === resourceType && currentCell.resources > 0) {
			resources.push({
				type: currentCell.type,
				index: current.index,
				baseIndex,
				amount: currentCell.resources,
				distance: current.distance,
				path: current.path
			});
		}

		for (const neighborIndex of currentCell.neighbors) {
			if (neighborIndex === -1) continue;
			if (visited.has(neighborIndex)) continue;

			visited.add(neighborIndex);
			queue.push({
				index: neighborIndex,
				distance: current.distance + 1,
				path: [...current.path, neighborIndex]
			});
		}
	}

	return resources.sort((a, b) => {
		if (a.distance !== b.distance) return a.distance - b.distance;
		return b.amount - a.amount;
	});
};

const findResourcesFromClosestBases = (resourceType: number): ResourceNode[] => {
	const resourcesByIndex = new Map<number, ResourceNode>();

	for (const baseIndex of myBaseIndexes) {
		const baseResources = findResourcesFromBase(baseIndex, resourceType);

		for (const resource of baseResources) {
			const current = resourcesByIndex.get(resource.index);

			if (
				current === undefined ||
				resource.distance < current.distance ||
				(resource.distance === current.distance && resource.baseIndex < current.baseIndex)
			) {
				resourcesByIndex.set(resource.index, resource);
			}
		}
	}

	return [...resourcesByIndex.values()].sort((a, b) => {
		if (a.distance !== b.distance) return a.distance - b.distance;
		return b.amount - a.amount;
	});
};

const getAdditionalPathCost = (path: number[], committedPathIndexes: Set<number>): number => {
	let cost = 0;

	for (const pathIndex of path) {
		if (!committedPathIndexes.has(pathIndex)) {
			cost++;
		}
	}

	return cost;
};

const getEggBeaconStrength = (egg: ResourceNode): number => {
	if (egg.distance === 1) return 4;
	if (egg.distance === 2) return 3;
	if (egg.distance === 3) return 2;
	return 1;
};

while (true) {
	let myTotalAnts = 0;
	turn++;
	for (let i = 0; i < numberOfCells; i++) {
		const inputs = readline().split(' ').map(Number);

		cells[i].resources = inputs[0];
		cells[i].myAnts = inputs[1];
		cells[i].oppAnts = inputs[2];

		myTotalAnts += cells[i].myAnts;
	}

	const beaconStrengths = new Map<number, number>();
	const addBeacon = (cellIndex: number, strength: number): void => {
		const currentStrength = beaconStrengths.get(cellIndex) ?? 0;
		beaconStrengths.set(cellIndex, Math.max(currentStrength, strength));
		stickyBeaconIndexes.add(cellIndex);
	};

	const addPath = (path: number[], strength: number): void => {
		for (const pathIndex of path) {
			addBeacon(pathIndex, strength);
		}
	};

	const eggs = findResourcesFromClosestBases(EGG);
	const crystals = findResourcesFromClosestBases(CRYSTAL);
	const urgentEggs = eggs.filter(egg => egg.distance <= URGENT_EGG_DISTANCE);
	const committedPathIndexes = new Set<number>();
	let availableAnts = myTotalAnts;
	const committedTargetLogs: string[] = [];
	const skippedTargetLogs: string[] = [];
	const phase = urgentEggs.length > 0 ? 'EGG' : 'MINERAL';

	const tryCommitPath = (resource: ResourceNode, strength: number): boolean => {
		const additionalCost = getAdditionalPathCost(resource.path, committedPathIndexes);

		if (additionalCost > availableAnts) {
			skippedTargetLogs.push(
				`${resource.type === EGG ? 'egg' : 'crystal'}:${resource.index}/d${resource.distance}/a${resource.amount}/cost${additionalCost}/left${availableAnts}`
			);
			return false;
		}

		availableAnts -= additionalCost;

		for (const pathIndex of resource.path) {
			committedPathIndexes.add(pathIndex);
		}

		addPath(resource.path, strength);
		committedTargetLogs.push(
			`${resource.type === EGG ? 'egg' : 'crystal'}:${resource.index}/d${resource.distance}/a${resource.amount}/cost${additionalCost}/s${strength}`
		);
		return true;
	};

	if (urgentEggs.length > 0) {
		for (const egg of eggs) {
			tryCommitPath(egg, getEggBeaconStrength(egg));
		}
	} else {
		const remainingCrystals = [...crystals];
		const mineralTargetLimit = Math.max(1, Math.floor(myTotalAnts / MINERAL_TARGET_ANT_DIVISOR));
		let committedMineralTargets = 0;

		while (remainingCrystals.length > 0 && committedMineralTargets < mineralTargetLimit) {
			remainingCrystals.sort((a, b) => {
				const additionalCostA = getAdditionalPathCost(a.path, committedPathIndexes);
				const additionalCostB = getAdditionalPathCost(b.path, committedPathIndexes);

				if (additionalCostA !== additionalCostB) return additionalCostA - additionalCostB;
				if (a.amount !== b.amount) return b.amount - a.amount;
				return a.distance - b.distance;
			});

			const crystal = remainingCrystals.shift()!;

			if (tryCommitPath(crystal, MINERAL_BEACON_STRENGTH)) {
				committedMineralTargets++;
			}
		}
	}

	for (const stickyIndex of [...stickyBeaconIndexes]) {
		if (!committedPathIndexes.has(stickyIndex)) {
			stickyBeaconIndexes.delete(stickyIndex);
			continue;
		}

		addBeacon(stickyIndex, 1);
	}

	console.error(`t=${turn} phase=${phase} ants=${myTotalAnts} left=${availableAnts} nodes=${committedPathIndexes.size}`);
	console.error(`commit ${committedTargetLogs.join(' | ') || 'none'}`);
	console.error(`skip ${skippedTargetLogs.slice(0, 8).join(' | ') || 'none'}`);
	const actions = [...beaconStrengths].map(([cellIndex, strength]) =>
		`BEACON ${cellIndex} ${strength}`
	);

	console.log(actions.length > 0 ? actions.join(';') : 'WAIT');
}
