/**
 * CodinGame Spring Challenge 2023 - Ants
 *
 * Strategy:
 * - Economy mode: prioritize fast egg acquisition.
 * - Mid game: harvest multiple nearby/resource-rich targets.
 * - Pressure/Kill mode: switch harder into crystals only when force projection is realistic.
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
    distance: number;
    index: number;
    amount: number;
    path: number[];
}

// ==========================================
// Initial parsing
// ==========================================

const numberOfCells: number = parseInt(readline());

const parseCells = (): Cell[] => {
    const result: Cell[] = [];

    for (let i = 0; i < numberOfCells; i++) {
        const inputs = readline().split(' ').map(Number);

        result.push({
            type: inputs[0],
            resources: inputs[1],
            neighbors: inputs.slice(2, 8),
            myAnts: 0,
            oppAnts: 0
        });
    }

    return result;
};

const cells = parseCells();

parseInt(readline());
const myBaseIndexes = readline().split(' ').map(Number);
const oppBaseIndexes = readline().split(' ').map(Number);

// Resource index -> full base-connected path
const activeResourcePaths = new Map<number, ResourceNode>();

// ==========================================
// Base-connected BFS
// ==========================================

const findResourcesByDistanceFromBases = (
    cells: Cell[],
    startIndexes: number[],
    resourceType: number
): ResourceNode[] => {
    const queue: { index: number; distance: number; path: number[] }[] = startIndexes.map(startIndex => ({
        index: startIndex,
        distance: 0,
        path: [startIndex]
    }));

    const visited = new Set<number>();

    for (const startIndex of startIndexes) {
        visited.add(startIndex);
    }

    const resources: ResourceNode[] = [];

    while (queue.length > 0) {
        const current = queue.shift()!;
        const currentCell = cells[current.index];

        if (currentCell.type === resourceType && currentCell.resources > 0) {
            resources.push({
                type: currentCell.type,
                index: current.index,
                distance: current.distance,
                amount: currentCell.resources,
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

    return resources.sort((a, b) => a.distance - b.distance);
};

const getDistancesFromCells = (
    cells: Cell[],
    startIndexes: number[]
): number[] => {
    const distances = Array(cells.length).fill(Infinity);
    const queue: number[] = [...startIndexes];

    for (const startIndex of startIndexes) {
        distances[startIndex] = 0;
    }

    while (queue.length > 0) {
        const currentIndex = queue.shift()!;
        const currentCell = cells[currentIndex];

        for (const neighborIndex of currentCell.neighbors) {
            if (neighborIndex === -1) continue;
            if (distances[neighborIndex] !== Infinity) continue;

            distances[neighborIndex] = distances[currentIndex] + 1;
            queue.push(neighborIndex);
        }
    }

    return distances;
};

const myDistances = getDistancesFromCells(cells, myBaseIndexes);
const oppDistances = getDistancesFromCells(cells, oppBaseIndexes);
const initialEggAmount = cells.reduce((total, cell) => {
    return cell.type === 1 ? total + cell.resources : total;
}, 0);

// ==========================================
// Path analysis
// ==========================================

const getPathResourceCounts = (
    resource: ResourceNode,
    cells: Cell[]
): { eggs: number; crystals: number } => {
    let eggs = 0;
    let crystals = 0;

    for (const index of resource.path) {
        const cell = cells[index];

        if (cell.resources <= 0) continue;

        if (cell.type === 1) eggs++;
        if (cell.type === 2) crystals++;
    }

    return { eggs, crystals };
};

const getPathResourceValue = (
    resource: ResourceNode,
    cells: Cell[]
): number => {
    let value = 0;

    for (const index of resource.path) {
        const cell = cells[index];

        if (cell.resources <= 0) continue;

        if (cell.type === 1) value += 12;
        if (cell.type === 2) value += 4;
    }

    return value;
};

const getContestBonus = (resource: ResourceNode): number => {
    const myDistance = myDistances[resource.index];
    const oppDistance = oppDistances[resource.index];

    if (!Number.isFinite(myDistance) || !Number.isFinite(oppDistance)) {
        return 0;
    }

    const distanceGap = myDistance - oppDistance;
    const isContested = Math.abs(distanceGap) <= 2;
    const isSmallSteal = distanceGap > 0 && distanceGap <= 3;
    const distanceRaceBonus = Math.max(0, 4 - Math.abs(myDistance - oppDistance)) * 150;

    if (resource.type === 1) {
        return (
            (isContested ? 5000 : 0) +
            (isSmallSteal ? 800 : 0) +
            distanceRaceBonus
        );
    }

    if (resource.type === 2) {
        return (
            (isContested ? 1800 : 0) +
            (isSmallSteal ? 400 : 0) +
            distanceRaceBonus
        );
    }

    return 0;
};

const getAdjacentResourcesOnPath = (
    resource: ResourceNode,
    cells: Cell[]
): ResourceNode[] => {
    const found = new Map<number, ResourceNode>();

    for (let pathPosition = 0; pathPosition < resource.path.length; pathPosition++) {
        const pathIndex = resource.path[pathPosition];
        const cell = cells[pathIndex];

        for (const neighborIndex of cell.neighbors) {
            if (neighborIndex === -1) continue;
            if (neighborIndex === resource.index) continue;

            const neighbor = cells[neighborIndex];

            if (neighbor.resources <= 0) continue;
            if (neighbor.type !== 1 && neighbor.type !== 2) continue;

            found.set(neighborIndex, {
                type: neighbor.type,
                index: neighborIndex,
                distance: pathPosition + 1,
                amount: neighbor.resources,
                path: [...resource.path.slice(0, pathPosition + 1), neighborIndex]
            });
        }
    }

    return [...found.values()];
};

const getCorridorResourceIndexes = (
    resource: ResourceNode,
    cells: Cell[]
): Set<number> => {
    const resourceIndexes = new Set<number>();

    for (const pathIndex of resource.path) {
        const cell = cells[pathIndex];

        if (cell.resources <= 0) continue;
        if (cell.type !== 1 && cell.type !== 2) continue;

        resourceIndexes.add(pathIndex);
    }

    for (const adjacentResource of getAdjacentResourcesOnPath(resource, cells)) {
        resourceIndexes.add(adjacentResource.index);
    }

    return resourceIndexes;
};

const getCorridorRemainingResourceAmount = (
    resource: ResourceNode,
    cells: Cell[]
): number => {
    let amount = 0;

    for (const resourceIndex of getCorridorResourceIndexes(resource, cells)) {
        amount += cells[resourceIndex].resources;
    }

    return amount;
};

const getPathBase = (resource: ResourceNode): number => {
    return resource.path[0];
};

const getResourcesForBase = (
    resources: ResourceNode[],
    baseIndex: number
): ResourceNode[] => {
    return resources.filter(resource => getPathBase(resource) === baseIndex);
};

// ==========================================
// Scoring
// ==========================================

const getEggPriority = (
    egg: ResourceNode,
    cells: Cell[]
): number => {
    const adjacentResources = getAdjacentResourcesOnPath(egg, cells);

    let score = 0;

    // Distance dominates. Fast ants matter more than far egg quantity.
    score -= egg.distance * 1000;
    score += egg.amount * 20;
    score += getContestBonus(egg);

    score += adjacentResources.filter(r => r.type === 1).length * 100;
    score += adjacentResources.filter(r => r.type === 2).length * 30;

    return score;
};

const sortEggsByFastAcquisition = (
    eggs: ResourceNode[],
    cells: Cell[]
): ResourceNode[] => {
    return eggs.sort((a, b) => {
        const priorityA = getEggPriority(a, cells);
        const priorityB = getEggPriority(b, cells);

        if (priorityA !== priorityB) {
            return priorityB - priorityA;
        }

        return a.distance - b.distance;
    });
};

const getPriority = (
    resource: ResourceNode,
    cells: Cell[]
): number => {
    const { eggs, crystals } = getPathResourceCounts(resource, cells);
    const adjacentResources = getAdjacentResourcesOnPath(resource, cells);
    const pathResourceValue = getPathResourceValue(resource, cells);

    let score = 0;

    if (resource.type === 1) {
        score += 1000;
        score += resource.amount * 20;

        score += eggs * 250;
        score += crystals * 60;

        score += adjacentResources.filter(r => r.type === 1).length * 80;
        score += adjacentResources.filter(r => r.type === 2).length * 30;

        if (eggs >= 2) score += 1000;
    }

    if (resource.type === 2) {
        score += 100;
        score += resource.amount * 10;

        score += eggs * 150;
        score += crystals * 120;

        score += adjacentResources.filter(r => r.type === 1).length * 60;
        score += adjacentResources.filter(r => r.type === 2).length * 80;
    }

    score += pathResourceValue * 8;
    score += getContestBonus(resource);
    score -= resource.distance * 80;

    return score;
};

const sortByPathValue = (
    resources: ResourceNode[],
    cells: Cell[]
): ResourceNode[] => {
    return resources.sort((a, b) => {
        const priorityA = getPriority(a, cells);
        const priorityB = getPriority(b, cells);

        if (priorityA !== priorityB) {
            return priorityB - priorityA;
        }

        return a.distance - b.distance;
    });
};

// ==========================================
// Reachability
// ==========================================

const antsCanReachEconomyTarget = (
    target: ResourceNode,
    myTotalAnts: number
): boolean => {
    const maxEconomyDistance = Math.max(3, Math.floor(myTotalAnts / 4));

    return target.distance <= maxEconomyDistance;
};

const canProjectForce = (
    target: ResourceNode | undefined,
    myTotalAnts: number
): boolean => {
    if (!target) return false;

    const requiredStrikeForce = target.distance * 3;

    return myTotalAnts >= requiredStrikeForce;
};

// ==========================================
// Target helpers
// ==========================================

const getLineStrength = (
    target: ResourceNode,
    pressureMode: boolean,
    killMode: boolean
): number => {
    if (killMode) {
        return target.type === 2 ? 6 : 1;
    }

    if (pressureMode) {
        return target.type === 2 ? 4 : 2;
    }

    return target.type === 1 ? 4 : 2;
};

const cleanDepletedTargets = (
    activeResourcePaths: Map<number, ResourceNode>,
    cells: Cell[]
): void => {
    for (const [targetIndex, target] of [...activeResourcePaths]) {
        if (getCorridorRemainingResourceAmount(target, cells) <= 0) {
            activeResourcePaths.delete(targetIndex);
        }
    }
};

// ==========================================
// Game state memory
// ==========================================

let previousOppTotalAnts = 0;
let stagnantEnemyTurns = 0;
let initialMyTotalAnts: number | undefined;
let sweepMode = false;

// ==========================================
// Game loop
// ==========================================

while (true) {
    let myTotalAnts = 0;
    let oppTotalAnts = 0;

    // ------------------------------
    // Read dynamic state
    // ------------------------------

    for (let i = 0; i < numberOfCells; i++) {
        const inputs = readline().split(' ').map(Number);

        cells[i].resources = inputs[0];
        cells[i].myAnts = inputs[1];
        cells[i].oppAnts = inputs[2];

        myTotalAnts += cells[i].myAnts;
        oppTotalAnts += cells[i].oppAnts;
    }

    if (initialMyTotalAnts === undefined) {
        initialMyTotalAnts = myTotalAnts;
    }

    // ------------------------------
    // Discover resources from base
    // ------------------------------

    const eggs = findResourcesByDistanceFromBases(cells, myBaseIndexes, 1);
    const crystals = findResourcesByDistanceFromBases(cells, myBaseIndexes, 2);

    const reachableEggs = eggs.filter(resource =>
        antsCanReachEconomyTarget(resource, myTotalAnts)
    );

    const reachableCrystals = crystals.filter(resource =>
        antsCanReachEconomyTarget(resource, myTotalAnts)
    );

    // ------------------------------
    // Opponent economy tracking
    // ------------------------------

    if (oppTotalAnts <= previousOppTotalAnts) {
        stagnantEnemyTurns++;
    } else {
        stagnantEnemyTurns = 0;
    }

    previousOppTotalAnts = oppTotalAnts;

    // ------------------------------
    // Compute best targets
    // ------------------------------

    const remainingEggAmount = eggs.reduce((total, egg) => total + egg.amount, 0);

    const bestCrystal = sortByPathValue(reachableCrystals, cells)[0];

    // ------------------------------
    // Strategy modes
    // ------------------------------

    const openingAntBaseline = Math.max(1, initialMyTotalAnts ?? myTotalAnts);
    const hasBigAntLead = myTotalAnts >= oppTotalAnts * 2;
    const enemyNotGrowing = stagnantEnemyTurns >= 3;
    const hasEnoughEconomy = myTotalAnts >= openingAntBaseline * 3 || eggs.length === 0;
    const canReachCrystalWithForce = canProjectForce(bestCrystal, myTotalAnts);

    const pressureMode =
        hasEnoughEconomy &&
        enemyNotGrowing &&
        myTotalAnts > oppTotalAnts &&
        canReachCrystalWithForce;

    const killMode =
        hasEnoughEconomy &&
        enemyNotGrowing &&
        hasBigAntLead &&
        canReachCrystalWithForce;

    const eggEconomyMostlyResolved =
        initialEggAmount === 0 ||
        remainingEggAmount <= initialEggAmount * 0.35;
    const hasScaledArmy = myTotalAnts >= openingAntBaseline * 4;
    const hasCrushingAntLead =
        oppTotalAnts > 0
            ? myTotalAnts >= oppTotalAnts * 1.75
            : myTotalAnts >= openingAntBaseline * 3;
    const simpleCrystalSweep =
        crystals.length > 0 &&
        (
            eggs.length === 0 ||
            eggEconomyMostlyResolved ||
            hasScaledArmy ||
            hasCrushingAntLead ||
            killMode
        );

    const simpleEggPhase = eggs.length > 0 && !simpleCrystalSweep;

    // ------------------------------
    // Memory cleanup
    // ------------------------------

    cleanDepletedTargets(activeResourcePaths, cells);

    // ------------------------------
    // Target activation
    // ------------------------------

    sweepMode = simpleCrystalSweep;

    if (sweepMode) {
        activeResourcePaths.clear();
    } else if (simpleEggPhase) {
        for (const [targetIndex, target] of [...activeResourcePaths]) {
            if (target.type !== 1) {
                activeResourcePaths.delete(targetIndex);
            }
        }

        const eggTargetLimit = myTotalAnts >= openingAntBaseline * 2 ? 2 : 1;

        for (const baseIndex of myBaseIndexes) {
            const baseReachableEggs = getResourcesForBase(reachableEggs, baseIndex);
            const nearBaseEggTargets = sortEggsByFastAcquisition(
                baseReachableEggs.filter(egg => egg.distance <= 2),
                cells
            );

            for (const nearBaseEggTarget of nearBaseEggTargets) {
                activeResourcePaths.set(nearBaseEggTarget.index, nearBaseEggTarget);
            }

            const eggTargets = sortEggsByFastAcquisition([...baseReachableEggs], cells)
                .slice(0, eggTargetLimit);

            for (const eggTarget of eggTargets) {
                activeResourcePaths.set(eggTarget.index, eggTarget);
            }
        }
    }


    // ------------------------------
    // Command generation
    // ------------------------------

    const beaconStrengths = new Map<number, number>();

    const addBeacon = (cellIndex: number, strength: number): void => {
        const existingStrength = beaconStrengths.get(cellIndex) ?? 0;
        beaconStrengths.set(cellIndex, Math.max(existingStrength, strength));
    };

    if (sweepMode) {
        for (const baseIndex of myBaseIndexes) {
            if (cells[baseIndex].myAnts <= 0) continue;

            const sweepTargets = sortByPathValue(
                getResourcesForBase(crystals, baseIndex),
                cells
            );

            for (const target of sweepTargets) {
                for (const pathIndex of target.path) {
                    addBeacon(pathIndex, 2);
                }
            }
        }
    } else {
        for (const [targetIndex, target] of [...activeResourcePaths]) {
            if (getCorridorRemainingResourceAmount(target, cells) <= 0) {
                activeResourcePaths.delete(targetIndex);
                continue;
            }

            const strength = getLineStrength(target, pressureMode, killMode);

            for (const pathIndex of target.path) {
                addBeacon(pathIndex, strength);
            }

            const targetCanSupportSideTaps =
                cells[target.index].myAnts >= 4 ||
                cells[target.index].resources <= 0;

            if (targetCanSupportSideTaps) {
                const adjacentResources = getAdjacentResourcesOnPath(target, cells);

                for (const adjacentResource of adjacentResources) {
                    addBeacon(adjacentResource.index, 1);
                }
            }
        }
    }

    const actions = [...beaconStrengths].map(([cellIndex, strength]) =>
        `BEACON ${cellIndex} ${strength}`
    );

    console.log(actions.length > 0 ? actions.join(';') : 'WAIT');
}
