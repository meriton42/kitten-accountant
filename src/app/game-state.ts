export interface GameState {
	level : {[B in Building] : number};
	workers : {[J in Job] : number};
	upgrades : {[U in Upgrade] : boolean};

	ironMarkup: number;
	showResearchedUpgrades: boolean;
}

function readGameState() : GameState {
	const state : GameState = localStorage.kittensGameState ? JSON.parse(localStorage.kittensGameState) : {};
	state.level = state.level || <any>{};
	for (const b of buildingNames) {
		state.level[b] = state.level[b] || 0;
	}
	state.workers = state.workers || <any>{};
	for (const j of jobNames) {
		state.workers[j] = state.workers[j] || 0;
	}
	state.upgrades = state.upgrades || <any>{};
	for (const u of upgradeNames) {
		state.upgrades[u] = state.upgrades[u] || false;
	}
	state.ironMarkup = state.ironMarkup || 0;
	if (state.showResearchedUpgrades === undefined) {
		state.showResearchedUpgrades = true;
	}
	return state;
}

export function saveGameState() {
	localStorage.kittensGameState = JSON.stringify(state);
}

export function resetGameState() {
	localStorage.removeItem("kittensGameState");
	window.location.reload();
}

export function clone<T>(original : T) : T {
	if (original instanceof Object) {
		const copy : T = <any>{};
		for (const key in original) {
			copy[key] = clone(original[key]);
		}
		return <T>copy;
	} else {
		return original;
	}
}

export type Res = "catnip" | "wood" | "minerals" | "iron"| "science";

export const resourceNames : Res[] = [
	"catnip", "wood", "minerals", "iron", "science"
]

export type Job = "farmer" | "woodcutter" | "miner" | "scholar";
export const jobNames : Job[] = ["farmer", "woodcutter", "miner", "scholar"];

export type Building = "CatnipField" | "Pasture" | "Hut" | "Library" | "Academy" | "Mine" | "LumberMill" | "Workshop" | "Smelter";
export const buildingNames : Building[] = ["CatnipField", "Pasture", "Hut", "Library", "Academy", "Mine", "LumberMill", "Workshop", "Smelter"];

export type Upgrade = "MineralHoes" | "IronHoes" | "MineralAxe" | "IronAxe" | "ReinforcedSaw";
export const upgradeNames : Upgrade[] = ["MineralHoes", "IronHoes", "MineralAxe", "IronAxe", "ReinforcedSaw"];

export const state = readGameState();