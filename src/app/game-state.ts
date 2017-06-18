export interface GameState {
	workers : {[J in Job] : number};
	conversionProportion: {[CR in ConvertedRes]: number};
	luxury: {
		fur: boolean;
		ivory: boolean;
		unicorn: boolean;
	}

	level : {[B in Building] : number};
	upgrades : {[U in Upgrade] : boolean};

	ironMarkup: number;
	coalPrice: number;
	showResearchedUpgrades: boolean;
	karma: number;
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
	state.luxury.unicorn = state.luxury.unicorn || false;
	state.level = state.level || <any>{};
	for (const b of buildingNames) {
		state.level[b] = state.level[b] || 0;
	}
	state.upgrades = state.upgrades || <any>{};
	for (const u of upgradeNames) {
		state.upgrades[u] = state.upgrades[u] || false;
	}
	state.ironMarkup = state.ironMarkup || 0;
	state.coalPrice = state.coalPrice || 1;
	if (state.showResearchedUpgrades === undefined) {
		state.showResearchedUpgrades = true;
	}
	state.karma = state.karma || 0;
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
	coal: x,
	iron: x,
	gold: x,
	catpower: x,
	science: x,
	culture: x,
	faith: x,
	unicorn: x,
};
// created on command by conversion, unlimited storage
const convertedResources = {
	starchart: x,
	titanium: x,
	fur: x,
	ivory: x,
	beam: x,
	slab: x,
	plate: x,
	steel: x,
	gear: x,
	scaffold: x,
	parchment: x,
	manuscript: x,
	compendium: x,
}

const job = {
	farmer: x,
	woodcutter: x,
	miner: x,
	hunter: x,
	scholar: x,
	priest: x,
}
const building = {
	CatnipField: x,
	Pasture: x,
	Aqueduct: x,
	Hut: x,
	LogHouse: x,
	Mansion: x,
	Library: x,
	Academy: x,
	Observatory: x,
	Barn: x,
	Warehouse: x,
	Harbor: x,
	Mine: x,
	LumberMill: x,
	Steamworks: x,
	Smelter: x,
	Amphitheatre: x,
	Temple: x,
	Workshop: x,
	TradePost: x,
	Mint: x,
	UnicornPasture: x,

	TradeShip: x,
}
const upgrade = {
	MineralHoes: x,
	IronHoes: x,
	MineralAxe: x,
	IronAxe: x,
	SteelAxe: x,
	ReinforcedSaw: x,
	SteelSaw: x,
	TitaniumAxe: x,
	ExpandedBarns: x,
	ReinforcedBarns: x,
	ReinforcedWarehouses: x,
	TitaniumBarns: x,
	IronWoodHuts: x,
	CompositeBow: x,
	Crossbow: x,
	Bolas: x,
	HuntingArmor: x,
	SteelArmor: x,
	CoalFurnace: x,
	DeepMining: x,
	Pyrolysis: x,
	PrintingPress: x,
	HighPressureEngine: x,
	Astrolabe: x,
	TitaniumReflectors: x,
	SunAltar: x,
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
window["state"] = state; // helpful for debugging