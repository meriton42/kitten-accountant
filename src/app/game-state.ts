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

function keyNames<T>(o: T): Array<keyof T> {
	const keys : Array<keyof T> = <any>[];
	for (let k in o) {
		keys.push(k);
	}
	return keys;
}

const x = null;
const resources = {
	catnip: x,
	wood: x,
	minerals: x,
	iron: x,
	science: x
};
const job = {
	farmer: x,
	woodcutter: x,
	miner: x,
	scholar: x
}
const building = {
	CatnipField: x,
	Pasture: x,
	Hut: x,
	LogHouse: x,
	Library: x,
	Academy: x,
	Mine: x,
	LumberMill: x,
	Workshop: x,
	Smelter: x,
}
const upgrade = {
	MineralHoes: x,
	IronHoes: x,
	MineralAxe: x,
	IronAxe: x,
	ReinforcedSaw: x,
}

export type Res = keyof typeof resources;
export const resourceNames = keyNames(resources);

export type Job = keyof typeof job;
export const jobNames = keyNames(job);

export type Building = keyof typeof building;
export const buildingNames = keyNames(building);

export type Upgrade = keyof typeof upgrade;
export const upgradeNames = keyNames(upgrade);

export const state = readGameState();