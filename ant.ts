/**
 * CodinGame Spring Challenge 2023 - Ants
 *
 * One-file CodinGame bot with strategy-based planning.
 * Strategy notes live in strategies/ for tuning, but runtime code stays here.
 *
 * Core rules:
 * - Pick a strategy from the initial map profile.
 * - Commit only paths covered by available ants.
 * - Keep healthy committed roads sticky at low strength.
 * - Show the selected strategy with MESSAGE on the HUD.
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

type StrategyMode =
	| 'CRYSTAL_RUSH'
	| 'EGG_RUSH'
	| 'SCARCE_CRYSTAL_BANK'
	| 'BIG_MAP_MIXED'
	| 'DEFAULT_MIXED';

type StrategyPlanner = () => void;

interface MapProfile {
	eggs: ResourceNode[];
	crystals: ResourceNode[];
	crystalGoal: number;
	totalEggAmount: number;
	totalCrystalAmount: number;
	nearEggAmount: number;
	closeEggAmount: number;
	reachableEggAmount: number;
	nearCrystalAmount: number;
	closeCrystalAmount: number;
	reachableCrystalAmount: number;
}

const EGG = 1;
const CRYSTAL = 2;
const URGENT_EGG_DISTANCE = 2;
const MINERAL_BEACON_STRENGTH = 3;
const MINERAL_TARGET_ANT_DIVISOR = 6;
const OPENING_CRYSTAL_DISTANCE = 4;
const OPENING_CRYSTAL_MIN_AMOUNT = 20;
const STRATEGIC_EGG_MIN_AMOUNT = 12;
const CONTESTED_EGG_MIN_AMOUNT = 4;
const STRATEGIC_EGG_MAX_DISTANCE = 6;
const STRATEGIC_EGG_MAX_COST = 9;
const STRATEGIC_EGG_STRENGTH = 1;
const CONTESTED_EGG_STRENGTH = 2;

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
const oppBaseIndexes = readline().split(' ').map(Number);

const stickyBeaconIndexes = new Set<number>();
let turn = 0;

const getDistancesFromBases = (startIndexes: number[]): number[] => {
	const distances = Array(numberOfCells).fill(Infinity);
	const queue: number[] = [...startIndexes];

	for (const startIndex of startIndexes) {
		distances[startIndex] = 0;
	}

	while (queue.length > 0) {
		const currentIndex = queue.shift()!;

		for (const neighborIndex of cells[currentIndex].neighbors) {
			if (neighborIndex === -1) continue;
			if (distances[neighborIndex] !== Infinity) continue;

			distances[neighborIndex] = distances[currentIndex] + 1;
			queue.push(neighborIndex);
		}
	}

	return distances;
};

const myDistances = getDistancesFromBases(myBaseIndexes);
const oppDistances = getDistancesFromBases(oppBaseIndexes);

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

const getAdditionalPathCost = (
	path: number[],
	strength: number,
	committedPathStrengths: Map<number, number>
): number => {
	let cost = 0;

	for (const pathIndex of path) {
		const committedStrength = committedPathStrengths.get(pathIndex) ?? 0;
		cost += Math.max(0, strength - committedStrength);
	}

	return cost;
};

const getEggBeaconStrength = (egg: ResourceNode): number => {
	if (egg.distance === 1) return 4;
	if (egg.distance === 2) return 3;
	if (egg.distance === 3) return 2;
	return 1;
};

const isContestedEgg = (egg: ResourceNode): boolean => {
	const oppDistance = oppDistances[egg.index];

	return (
		egg.type === EGG &&
		egg.amount >= CONTESTED_EGG_MIN_AMOUNT &&
		egg.distance <= STRATEGIC_EGG_MAX_DISTANCE &&
		egg.distance <= oppDistance
	);
};

const formatResourceSummary = (resources: ResourceNode[], limit: number): string => {
	return resources
		.slice(0, limit)
		.map(resource => `${resource.index}:d${resource.distance}:a${resource.amount}`)
		.join(' | ') || 'none';
};

const getResourceAmountWithinDistance = (resources: ResourceNode[], maxDistance: number): number => {
	return resources
		.filter(resource => resource.distance <= maxDistance)
		.reduce((total, resource) => total + resource.amount, 0);
};

const buildMapProfile = (): MapProfile => {
	const initialEggs = findResourcesFromClosestBases(EGG);
	const initialCrystals = findResourcesFromClosestBases(CRYSTAL);
	const totalEggAmount = initialEggs.reduce((total, egg) => total + egg.amount, 0);
	const totalCrystalAmount = initialCrystals.reduce((total, crystal) => total + crystal.amount, 0);

	return {
		eggs: initialEggs,
		crystals: initialCrystals,
		crystalGoal: Math.floor(totalCrystalAmount / 2) + 1,
		totalEggAmount,
		totalCrystalAmount,
		nearEggAmount: getResourceAmountWithinDistance(initialEggs, 2),
		closeEggAmount: getResourceAmountWithinDistance(initialEggs, 4),
		reachableEggAmount: getResourceAmountWithinDistance(initialEggs, 6),
		nearCrystalAmount: getResourceAmountWithinDistance(initialCrystals, 2),
		closeCrystalAmount: getResourceAmountWithinDistance(initialCrystals, 4),
		reachableCrystalAmount: getResourceAmountWithinDistance(initialCrystals, 6)
	};
};

const chooseStrategyMode = (profile: MapProfile): StrategyMode => {
	const bestCloseCrystal = profile.crystals
		.filter(crystal => crystal.distance <= 4)
		.sort((a, b) => {
			if (a.amount !== b.amount) return b.amount - a.amount;
			return a.distance - b.distance;
		})[0];
	const strategicEggAmount = profile.eggs
		.filter(egg =>
			egg.distance <= STRATEGIC_EGG_MAX_DISTANCE &&
			egg.amount >= STRATEGIC_EGG_MIN_AMOUNT
		)
		.reduce((total, egg) => total + egg.amount, 0);
	const hasImmediateCrystalWin =
		profile.closeCrystalAmount >= profile.crystalGoal * 0.55 ||
		(bestCloseCrystal !== undefined &&
			bestCloseCrystal.distance <= 2 &&
			bestCloseCrystal.amount >= profile.crystalGoal * 0.20);
	const hasStrongNearbyEggs = profile.nearEggAmount >= 20;
	const hasEggEconomyMap =
		profile.eggs.some(egg => egg.distance <= 2) &&
		profile.reachableEggAmount >= 35 &&
		profile.reachableCrystalAmount < profile.crystalGoal * 0.50;
	const hasStrategicEggBank =
		strategicEggAmount >= 24 &&
		profile.closeCrystalAmount < profile.crystalGoal * 0.45;

	if (hasImmediateCrystalWin && profile.nearEggAmount < 12) {
		return 'CRYSTAL_RUSH';
	}

	if (
		(hasStrongNearbyEggs && profile.closeCrystalAmount < profile.crystalGoal * 0.35) ||
		hasEggEconomyMap ||
		hasStrategicEggBank
	) {
		return 'EGG_RUSH';
	}

	if (
		profile.crystals.length <= 6 ||
		profile.totalCrystalAmount <= 120 ||
		profile.closeCrystalAmount >= profile.crystalGoal * 0.70
	) {
		return 'SCARCE_CRYSTAL_BANK';
	}

	if (
		numberOfCells >= 70 ||
		profile.totalEggAmount >= 60 ||
		profile.totalCrystalAmount >= 180 ||
		profile.reachableEggAmount >= 40
	) {
		return 'BIG_MAP_MIXED';
	}

	return 'DEFAULT_MIXED';
};

const logInitialMapProfile = (profile: MapProfile, strategyMode: StrategyMode): void => {
	const closeEggs = profile.eggs.filter(egg => egg.distance <= 5);
	const closeCrystals = profile.crystals.filter(crystal => crystal.distance <= 5);
	const richEggs = [...profile.eggs]
		.sort((a, b) => {
			if (a.amount !== b.amount) return b.amount - a.amount;
			return a.distance - b.distance;
		});
	const richCrystals = [...profile.crystals]
		.sort((a, b) => {
			if (a.amount !== b.amount) return b.amount - a.amount;
			return a.distance - b.distance;
		});

	console.error(`map bases=${myBaseIndexes.join(',')} strategy=${strategyMode} crystalGoal=${profile.crystalGoal}`);
	console.error(`map eggs nodes=${profile.eggs.length} total=${profile.totalEggAmount} near=${profile.nearEggAmount} close=${profile.closeEggAmount} reachable=${profile.reachableEggAmount} close<=5=${closeEggs.length}`);
	console.error(`map eggs closest ${formatResourceSummary(profile.eggs, 8)}`);
	console.error(`map eggs richest ${formatResourceSummary(richEggs, 8)}`);
	console.error(`map crystals nodes=${profile.crystals.length} total=${profile.totalCrystalAmount} near=${profile.nearCrystalAmount} close=${profile.closeCrystalAmount} reachable=${profile.reachableCrystalAmount} close<=5=${closeCrystals.length}`);
	console.error(`map crystals closest ${formatResourceSummary(profile.crystals, 8)}`);
	console.error(`map crystals richest ${formatResourceSummary(richCrystals, 8)}`);
};

const initialMapProfile = buildMapProfile();
const strategyMode = chooseStrategyMode(initialMapProfile);

logInitialMapProfile(initialMapProfile, strategyMode);

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
	const openingCrystals = crystals
		.filter(crystal =>
			crystal.distance <= OPENING_CRYSTAL_DISTANCE &&
			crystal.amount >= OPENING_CRYSTAL_MIN_AMOUNT
		)
		.sort((a, b) => {
			if (a.amount !== b.amount) return b.amount - a.amount;
			return a.distance - b.distance;
		});
	const committedPathStrengths = new Map<number, number>();
	const committedResourceIndexes = new Set<number>();
	let availableAnts = myTotalAnts;
	const committedTargetLogs: string[] = [];
	const skippedTargetLogs: string[] = [];
	const phase = `${strategyMode}:${urgentEggs.length > 0 ? 'EGG' : 'MINERAL'}`;

	const tryCommitPath = (resource: ResourceNode, strength: number): boolean => {
		if (committedResourceIndexes.has(resource.index)) {
			return false;
		}

		const additionalCost = getAdditionalPathCost(resource.path, strength, committedPathStrengths);
		const resourceLabel = resource.type === EGG ? 'egg' : 'crystal';

		if (additionalCost > availableAnts) {
			skippedTargetLogs.push(
				`${resourceLabel}:${resource.index}/d${resource.distance}/a${resource.amount}/cost${additionalCost}/left${availableAnts}`
			);
			return false;
		}

		availableAnts -= additionalCost;
		committedResourceIndexes.add(resource.index);

		for (const pathIndex of resource.path) {
			const currentStrength = committedPathStrengths.get(pathIndex) ?? 0;
			committedPathStrengths.set(pathIndex, Math.max(currentStrength, strength));
		}

		addPath(resource.path, strength);
		committedTargetLogs.push(
			`${resourceLabel}:${resource.index}/d${resource.distance}/a${resource.amount}/cost${additionalCost}/s${strength}`
		);
		return true;
	};

	const commitCrystals = (candidates: ResourceNode[], targetLimit: number): void => {
		const remainingCrystals = [...candidates];
		let committedMineralTargets = 0;

		while (remainingCrystals.length > 0 && committedMineralTargets < targetLimit) {
			remainingCrystals.sort((a, b) => {
				const additionalCostA = getAdditionalPathCost(a.path, MINERAL_BEACON_STRENGTH, committedPathStrengths);
				const additionalCostB = getAdditionalPathCost(b.path, MINERAL_BEACON_STRENGTH, committedPathStrengths);

				if (additionalCostA !== additionalCostB) return additionalCostA - additionalCostB;
				if (a.amount !== b.amount) return b.amount - a.amount;
				return a.distance - b.distance;
			});

			const crystal = remainingCrystals.shift()!;

			if (tryCommitPath(crystal, MINERAL_BEACON_STRENGTH)) {
				committedMineralTargets++;
			}
		}
	};

	const commitEggs = (candidates: ResourceNode[], targetLimit: number): void => {
		let committedEggTargets = 0;

		for (const egg of candidates) {
			if (committedEggTargets >= targetLimit) break;

			if (tryCommitPath(egg, getEggBeaconStrength(egg))) {
				committedEggTargets++;
			}
		}
	};

	const getStrategicEggStrength = (egg: ResourceNode): number => {
		if (egg.distance <= URGENT_EGG_DISTANCE) return getEggBeaconStrength(egg);
		return isContestedEgg(egg) ? CONTESTED_EGG_STRENGTH : STRATEGIC_EGG_STRENGTH;
	};

	const commitStrategicEggs = (targetLimit: number, maxCost = STRATEGIC_EGG_MAX_COST): void => {
		const strategicEggs = eggs
			.filter(egg =>
				egg.distance <= STRATEGIC_EGG_MAX_DISTANCE &&
				(egg.amount >= STRATEGIC_EGG_MIN_AMOUNT || isContestedEgg(egg)) &&
				!committedResourceIndexes.has(egg.index)
			)
			.sort((a, b) => {
				const contestedA = isContestedEgg(a) ? 1 : 0;
				const contestedB = isContestedEgg(b) ? 1 : 0;
				const additionalCostA = getAdditionalPathCost(a.path, getStrategicEggStrength(a), committedPathStrengths);
				const additionalCostB = getAdditionalPathCost(b.path, getStrategicEggStrength(b), committedPathStrengths);

				if (contestedA !== contestedB) return contestedB - contestedA;
				if (additionalCostA !== additionalCostB) return additionalCostA - additionalCostB;
				if (a.amount !== b.amount) return b.amount - a.amount;
				return a.distance - b.distance;
			});
		let committedEggTargets = 0;

		for (const egg of strategicEggs) {
			if (committedEggTargets >= targetLimit) break;

			const strength = getStrategicEggStrength(egg);
			const additionalCost = getAdditionalPathCost(egg.path, strength, committedPathStrengths);

			if (additionalCost > maxCost) {
				skippedTargetLogs.push(
					`egg:${egg.index}/d${egg.distance}/a${egg.amount}/cost${additionalCost}/cap${maxCost}`
				);
				continue;
			}

			if (tryCommitPath(egg, strength)) {
				committedEggTargets++;
			}
		}
	};

	const mineralTargetLimit = Math.max(1, Math.floor(myTotalAnts / MINERAL_TARGET_ANT_DIVISOR));

	// Strategy playbooks live here so the CodinGame submission remains one file.
	// The markdown files in strategies/ are tuning notes for humans, not runtime code.
	const runCrystalRush = (): void => {
		commitCrystals(openingCrystals.length > 0 ? openingCrystals : crystals, mineralTargetLimit);
		commitStrategicEggs(1, 6);
	};

	const runScarceCrystalBank = (): void => {
		commitCrystals(crystals, mineralTargetLimit);
		commitStrategicEggs(1, 6);
	};

	const runEggRush = (): void => {
		if (turn <= 7) {
			commitCrystals(openingCrystals, 1);
			commitEggs(urgentEggs, 3);
			commitStrategicEggs(3);
			commitCrystals(openingCrystals, 1);
			return;
		}

		commitCrystals(openingCrystals, 1);
		commitStrategicEggs(2);
		commitCrystals(crystals, mineralTargetLimit);
	};

	const runBigMapMixed = (): void => {
		commitCrystals(openingCrystals, 2);
		commitEggs(urgentEggs, 2);
		commitStrategicEggs(3);
		commitCrystals(crystals, mineralTargetLimit);
	};

	const runDefaultMixed = (): void => {
		commitCrystals(openingCrystals, 1);
		commitEggs(urgentEggs, 2);
		commitStrategicEggs(2);
		commitCrystals(crystals, mineralTargetLimit);
	};

	const strategyPlanners: Record<StrategyMode, StrategyPlanner> = {
		CRYSTAL_RUSH: runCrystalRush,
		EGG_RUSH: runEggRush,
		SCARCE_CRYSTAL_BANK: runScarceCrystalBank,
		BIG_MAP_MIXED: runBigMapMixed,
		DEFAULT_MIXED: runDefaultMixed
	};

	strategyPlanners[strategyMode]();

	for (const stickyIndex of [...stickyBeaconIndexes]) {
		if (!committedPathStrengths.has(stickyIndex)) {
			stickyBeaconIndexes.delete(stickyIndex);
			continue;
		}

		addBeacon(stickyIndex, 1);
	}

	console.error(`t=${turn} phase=${phase} ants=${myTotalAnts} left=${availableAnts} nodes=${committedPathStrengths.size}`);
	console.error(`commit ${committedTargetLogs.join(' | ') || 'none'}`);
	console.error(`skip ${skippedTargetLogs.slice(0, 8).join(' | ') || 'none'}`);
	const actions = [`MESSAGE ${strategyMode}`];

	for (const [cellIndex, strength] of beaconStrengths) {
		actions.push(`BEACON ${cellIndex} ${strength}`);
	}

	console.log(actions.join(';'));
}
