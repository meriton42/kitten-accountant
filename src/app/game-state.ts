export interface GameState {
	workers : {[J in Job] : number};
	conversionProportion: {[CR in ConvertedRes]: number};
	luxury: {
		fur: boolean;
		ivory: boolean;
	}

	level : {[B in Building] : number};
	upgrades : {[U in Upgrade] : boolean};

	ironMarkup: number;
	showResearchedUpgrades: boolean;
}

function readGameState() : GameState {
	const state : GameState = localStorage.kittensGameState ? JSON.parse(localStorage.kittensGameState) : {};
	state.workers = state.workers || <any>{};
	for (const j of jobNames) {
		state.workers[j] = state.workers[j] || 0;
	}
	state.conversionProportion = state.conversionProportion || <any>{};
	for (const cr of convertedResourceNames) {
		state.conversionProportion[cr] = state.conversionProportion[cr] ||  0;
	}
	state.luxury = state.luxury || <any>{};
	state.luxury.fur = state.luxury.fur || false;
	state.luxury.ivory = state.luxury.ivory || false;
	state.level = state.level || <any>{};
	for (const b of buildingNames) {
		state.level[b] = state.level[b] || 0;
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
// created on an ongoing basis
const basicResources = {
	catnip: x,
	wood: x,
	minerals: x,
	iron: x,
	catpower: x,
	science: x
};
// created on command by conversion, unlimited storage
const convertedResources = {
	fur: x,
	ivory: x,
	parchment: x,
}

const job = {
	farmer: x,
	woodcutter: x,
	miner: x,
	hunter: x,
	scholar: x
}
const building = {
	CatnipField: x,
	Pasture: x,
	Aqueduct: x,
	Hut: x,
	LogHouse: x,
	Library: x,
	Academy: x,
	Mine: x,
	LumberMill: x,
	Smelter: x,
	Amphitheatre: x,
	Workshop: x,
	TradePost: x,
}
const upgrade = {
	MineralHoes: x,
	IronHoes: x,
	MineralAxe: x,
	IronAxe: x,
	ReinforcedSaw: x,
	CompositeBow: x,
	Bolas: x,
	HuntingArmor: x,
}

export type BasicRes = keyof typeof basicResources;
export const basicResourceNames = keyNames(basicResources);

export type ConvertedRes = keyof typeof convertedResources;
export const convertedResourceNames = keyNames(convertedResources);

export type Res = BasicRes | ConvertedRes;
export const resourceNames = (<Res[]>basicResourceNames).concat(convertedResourceNames);

export type Job = keyof typeof job;
export const jobNames = keyNames(job);

export type Building = keyof typeof building;
export const buildingNames = keyNames(building);

export type Upgrade = keyof typeof upgrade;
export const upgradeNames = keyNames(upgrade);

export const state = readGameState();