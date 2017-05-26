export interface GameState {
	level : {[B in Building] : number};
	workers : {[J in Job] : number};
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

export type Building = "CatnipField" | "Pasture" | "Hut" | "Library" | "Mine";
export const buildingNames : Building[] = ["CatnipField", "Pasture", "Hut", "Library", "Mine"];

export const state = readGameState();