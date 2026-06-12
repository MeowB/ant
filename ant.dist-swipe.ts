/**
 * CodinGame Spring Challenge 2023 - Ants
 *
 * Distance-swipe strategic shell:
 * - Keep graph/resource primitives.
 * - Keep active target memory.
 * - Keep resource scoring so the bot avoids low-value long walks.
 * - Keep side taps from profitable corridors.
 * - Distance-based activation only: close eggs, eggs, then crystals.
 *
 * Beacon strengths:
 * - Close eggs: 4
 * - Eggs: 3
 * - Crystals: 1
 * - Side taps: 1
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

const oppDistances = getDistancesFromCells(cells, oppBaseIndexes);

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

const cleanDepletedTargets = (
    activeResourcePaths: Map<number, ResourceNode>,
    cells: Cell[]
): void => {
    for (const [targetIndex, target] of [...activeResourcePaths]) {
        const targetCellIsEmpty = cells[target.index].resources <= 0;
        const corridorIsEmpty = getCorridorRemainingResourceAmount(target, cells) <= 0;

        if (target.type === 2 && targetCellIsEmpty) {
            activeResourcePaths.delete(targetIndex);
            continue;
        }

        if (target.type !== 2 && (targetCellIsEmpty || corridorIsEmpty)) {
            activeResourcePaths.delete(targetIndex);
        }
    }
};

// ==========================================
// Scoring
// ==========================================

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
    score -= resource.distance * 100;

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

const isProfitableResource = (
    resource: ResourceNode,
    cells: Cell[]
): boolean => {
    const priority = getPriority(resource, cells);
    const minimumPriority = resource.type === 1 ? 500 : 100;

    return priority >= minimumPriority;
};

const activateTargets = (
    resources: ResourceNode[],
    cells: Cell[],
    limit: number
): void => {
    const sortedResources = sortByPathValue([...resources], cells);

    for (const resource of sortedResources) {
        if (activeResourcePaths.size >= limit) break;
        if (activeResourcePaths.has(resource.index)) continue;
        if (!isProfitableResource(resource, cells)) continue;

        activeResourcePaths.set(resource.index, resource);
    }
};

const isCloseEgg = (resource: ResourceNode): boolean => {
    return resource.type === 1 && resource.distance <= 2;
};

const isSafeEgg = (resource: ResourceNode): boolean => {
    return resource.type === 1 && oppDistances[resource.index] >= 3;
};

// ==========================================
// Game loop
// ==========================================

while (true) {
    let myTotalAnts = 0;

    for (let i = 0; i < numberOfCells; i++) {
        const inputs = readline().split(' ').map(Number);

        cells[i].resources = inputs[0];
        cells[i].myAnts = inputs[1];
        cells[i].oppAnts = inputs[2];

        myTotalAnts += cells[i].myAnts;
    }

    const eggs = findResourcesByDistanceFromBases(cells, myBaseIndexes, 1);
    const crystals = findResourcesByDistanceFromBases(cells, myBaseIndexes, 2);

    cleanDepletedTargets(activeResourcePaths, cells);

    const activeTargetLimit = Math.max(1, Math.min(6, Math.floor(myTotalAnts / 4)));

    const safeEggs = eggs.filter(isSafeEgg);
    const closeEggs = safeEggs.filter(isCloseEgg);
    const regularEggs = safeEggs.filter(egg => !isCloseEgg(egg));

    activateTargets(closeEggs, cells, activeTargetLimit);
    activateTargets(regularEggs, cells, activeTargetLimit);
    activateTargets(crystals, cells, activeTargetLimit);

    const beaconStrengths = new Map<number, number>();

    const addBeacon = (cellIndex: number, strength: number): void => {
        const existingStrength = beaconStrengths.get(cellIndex) ?? 0;
        beaconStrengths.set(cellIndex, Math.max(existingStrength, strength));
    };

    for (const [targetIndex, target] of [...activeResourcePaths]) {
        const targetCellIsEmpty = cells[target.index].resources <= 0;
        const shouldClearTarget =
            target.type === 2
                ? targetCellIsEmpty
                : getCorridorRemainingResourceAmount(target, cells) <= 0;

        if (shouldClearTarget) {
            activeResourcePaths.delete(targetIndex);
            continue;
        }

        const strength = isCloseEgg(target)
            ? 4
            : target.type === 1
                ? 2
                : 1;

        for (const pathIndex of target.path) {
            addBeacon(pathIndex, strength);
        }

        if (target.type === 2) {
            addBeacon(target.index, 1);

            for (const neighborIndex of cells[target.index].neighbors) {
                if (neighborIndex === -1) continue;

                addBeacon(neighborIndex, 1);
            }
        }

        for (const adjacentResource of getAdjacentResourcesOnPath(target, cells)) {
            addBeacon(adjacentResource.index, 1);
        }
    }

    const actions = [...beaconStrengths].map(([cellIndex, strength]) =>
        `BEACON ${cellIndex} ${strength}`
    );

    console.log(actions.length > 0 ? actions.join(';') : 'WAIT');
}
