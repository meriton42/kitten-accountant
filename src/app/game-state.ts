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

	priceMarkup: {[R in UserPricedRes]: number};

	showResearchedUpgrades: boolean;
	ships: number;
	karma: number;
	paragon: number;
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
	state.priceMarkup = state.priceMarkup || <any>{};
	for (const r of userPricedResourceNames) {
		state.priceMarkup[r] = state.priceMarkup[r] || 1;
	}
	if (state.showResearchedUpgrades === undefined) {
		state.showResearchedUpgrades = true;
	}
	state.ships = state.ships || 0;
	state.karma = state.karma || 0;
	state.paragon = state.paragon || 0;
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
	oil: x,
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
	uranium: x,
	unobtainium: x,
	eludium: x,
	fur: x,
	ivory: x,
	beam: x,
	slab: x,
	concrete: x,
	plate: x,
	steel: x,
	gear: x,
	alloy: x,
	scaffold: x,
	kerosene: x,
	parchment: x,
	manuscript: x,
	compendium: x,
	blueprint: x,
}

const userPricedResources: {[R in Res]?} = {
	iron: x,
	coal: x,
	gold: x,
	oil: x,
	culture: x,
	faith: x,
	starchart: x,
	blueprint: x,
	uranium: x,
	unobtainium: x,
}

const job = {
	farmer: x,
	woodcutter: x,
	miner: x,
	hunter: x,
	scholar: x,
	priest: x,
	geologist: x,
}
const building = {
	CatnipField: x,
	Pasture: x,
	SolarFarm: x,
	Aqueduct: x,
	HydroPlant: x,
	Hut: x,
	LogHouse: x,
	Mansion: x,
	Library: x,
	Academy: x,
	Observatory: x,
	BioLab: x,
	Barn: x,
	Warehouse: x,
	Harbor: x,
	Mine: x,
	Quarry: x,
	LumberMill: x,
	OilWell: x,
	Accelerator: x, 
	Steamworks: x,
	Magneto: x,
	Smelter: x,
	Calciner: x,
	Factory: x,
	Reactor: x,
	Amphitheatre: x,
	BroadcastTower: x,
	Chapel: x,
	Temple: x,
	Workshop: x,
	TradePost: x,
	Mint: x,
	UnicornPasture: x,

	SolarChant: x,
	Scholasticism: x,
	GoldenSpire: x,
	SunAltar: x,
	StainedGlass: x,
	Basilica: x,
	Templars: x,

	SpaceElevator: x,
	Satellite: x,
	SpaceStation: x,
	LunarOutpost: x,
	MoonBase: x,
}
const upgrade = {
	MineralHoes: x,
	IronHoes: x,
	MineralAxe: x,
	IronAxe: x,
	SteelAxe: x,
	ReinforcedSaw: x,
	SteelSaw: x,
	TitaniumSaw: x,
	AlloySaw: x,
	TitaniumAxe: x,
	AlloyAxe: x,
	ExpandedBarns: x,
	ReinforcedBarns: x,
	ReinforcedWarehouses: x,
	TitaniumBarns: x,
	AlloyBarns: x,
	ConcreteBarns: x,
	TitaniumWarehouses: x,
	AlloyWarehouses: x,
	ConcreteWarehouses: x,
	EnergyRifts: x,
	PhotovoltaicCells: x,
	SolarSatellites: x,
	ExpandedCargo: x,
	ReactorVessel: x,
	IronWoodHuts: x,
	ConcreteHuts: x,
	Silos: x,
	Refrigeration: x,
	CompositeBow: x,
	Crossbow: x,
	Railgun: x,
	Bolas: x,
	HuntingArmor: x,
	SteelArmor: x,
	AlloyArmor: x,
	Nanosuits: x,
	Geodesy: x,
	ConcretePillars: x,
	MiningDrill: x,
	CoalFurnace: x,
	DeepMining: x,
	Pyrolysis: x,
	ElectrolyticSmelting: x,
	Oxidation: x,
	RotaryKiln: x,
	FluidizedReactors: x,
	NuclearSmelters: x,
	PrintingPress: x,
	OffsetPress: x,
	Photolithography: x,
	HighPressureEngine: x,
	FuelInjectors: x,
	FactoryLogistics: x,
	SpaceManufacturing: x,
	Astrolabe: x,
	TitaniumReflectors: x,
	Pumpjack: x,
	BiofuelProcessing: x,
	CADsystem: x,
	SETI: x,
	Logistics: x,
	Augmentations: x,
	EnrichedUranium: x,
	ColdFusion: x,
	OilRefinery: x,
	HubbleSpaceTelescope: x,
	AstroPhysicists: x,
	OilDistillation: x,
	FactoryProcessing: x,
	Telecommunication: x,
	RoboticAssistance: x,

	Transcendence: x,

	Engineering: x,
	Diplomacy: x,
}

export type BasicRes = keyof typeof basicResources;
export const basicResourceNames = keyNames(basicResources);

export type ConvertedRes = keyof typeof convertedResources;
export const convertedResourceNames = keyNames(convertedResources);

export type UserPricedRes = keyof typeof userPricedResources;
export const userPricedResourceNames = keyNames(userPricedResources);

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