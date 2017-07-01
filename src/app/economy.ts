import { state, Res, Building, Job, GameState, clone, resourceNames, Upgrade, ConvertedRes, BasicRes, basicResourceNames } from "app/game-state";

let currentProduction: {[R in Res]: number};
let price: {[R in Res]: number};
let conversions: Conversion[];
let actions: Action[];

function updateEconomy() {
	const {priceMarkup} = state;
  const wage = 1;
	const basicPrice : {[R in BasicRes]: number} = {
		catnip: wage / workerProduction("farmer", "catnip"),
		wood: wage / workerProduction("woodcutter", "wood"),
		minerals: wage / workerProduction("miner", "minerals"),
		iron: 0, // assigned below
		coal: wage / workerProduction("geologist", "coal") * priceMarkup.coal,
		gold: 10 * priceMarkup.gold,
		oil: 5 * priceMarkup.oil,
		catpower: wage / workerProduction("hunter", "catpower"),
		science: wage / workerProduction("scholar", "science"),
		culture: priceMarkup.culture, 
		faith: wage / workerProduction("priest", "faith") * priceMarkup.faith,
		unicorn: 1,
	};
	price = <any>basicPrice;

	const huntingBonus = 0;
	conversions = [
		// the constructor sets the price of the product
		new Smelting(),
		new Hunt(),
		new CraftingConversion("beam", [[175, "wood"]]),
		new CraftingConversion("slab", [[250, "minerals"]]),
		new CraftingConversion("plate", [[125, "iron"]]),
		new ZebraTrade(),
		new CraftingConversion("steel", [[100, "coal"], [100, "iron"]]),
		new CraftingConversion("gear", [[15, "steel"]]),
		new CraftingConversion("concrete", [[2500, "slab"], [25, "steel"]]),
		new CraftingConversion("alloy", [[75, "steel"], [10, "titanium"]]),
		new CraftingConversion("scaffold", [[50, "beam"]]),
		new CraftingConversion("parchment", [[175, "fur"]]),
		new CraftingConversion("manuscript", [[25, "parchment"], [400, "culture"]]),
		new CraftingConversion("compendium", [[50, "manuscript"], [10000, "science"]]),
		new CraftingConversion("blueprint", [[25, "compendium"], [25000, "science"]]),
	];

	price.starchart = 1000 * priceMarkup.starchart;
}

function workerProduction(job: Job, res: Res) {
	return delta(basicProduction, (s) => s.workers[job]++)[res];
}

function delta<T extends string>(metric: (state: GameState) => {[R in T]: number}, change: (state: GameState) => void): {[R in T]: number} {
	const original = metric(state);
	const clonedState = clone(state);
	change(clonedState);
	const modified = metric(clonedState);

	const delta: {[R in T]: number} = <any>{};
	for (let r in original) {
		delta[r] = modified[r] - original[r];
	}
	return delta;
}

function hyperbolicDecrease(x: number) {
	return x < 0.75 ? (1 - x) : 0.25 / ((x - 0.5) / 0.25);
}

function hyperbolicLimit(x: number, limit: number) {
	let a = x / limit;
	if (a > 0.75) {
		a = 1 - 0.25 / ((a - 0.5) / 0.25);
	}
	return a * limit;
}

function basicProduction(state: GameState): {[R in BasicRes | "fur" | "ivory" | "manuscript" | "starchart" | "titanium"]: number} {
	let {level, upgrades, workers, luxury} = state;

	const kittens = level.Hut * 2 + level.LogHouse * 1 + level.Mansion * 1;
	const unhappiness = 0.02 * Math.max(kittens - 5, 0) * hyperbolicDecrease(level.Amphitheatre * 0.048);
	const happiness = 1 + (luxury.fur && 0.1) + (luxury.ivory && 0.1) + (luxury.unicorn && 0.1) + (state.karma && 0.1 + state.karma * 0.01) 
									+ (upgrades.SunAltar && level.Temple * 0.005) - unhappiness;
	const workerProficiency = 1 + 0.1875 * kittens / (kittens + 50) * (1 + (upgrades.Logistics && 0.15));  // the more kittens, the older the average kitten (assuming no deaths)
	const workerEfficiency = happiness * workerProficiency;

	let idle = kittens;
	for (let j in workers) {
		idle -= workers[j];
	}
	if (idle > 0) {
		workers.farmer += idle; // so additional kittens are known to contribute production
	}
	const scienceBonus = level.Library * 0.1 + level.Academy * 0.2 + level.Observatory * 0.25 * level.BioLab * 0.70;
	const astroChance = ((level.Library && 0.25) + level.Observatory * 0.2) * 0.005 * Math.min(1, level.Observatory * 0.01);
	const maxCatpower = level.Hut * 75 + level.LogHouse * 50 + level.Mansion * 50;

	const energyProduction = level.Steamworks * 1 + level.Magneto * 5;
	const energyConsumption = level.Calciner * 1 + level.BioLab * 1 + level.Factory * 2 + (upgrades.Pumpjack && level.OilWell * 1);

	const magnetoBonus = 1 + level.Magneto * 0.02 * (1 + level.Steamworks * 0.15);

	return {
		catnip: (level.CatnipField * 0.63 * (1.5 + 1 + 1 + 0.25) / 4
				    + workers.farmer * workerEfficiency * 5 * (1 + (upgrades.MineralHoes && 0.5) + (upgrades.IronHoes && 0.3))
					) * (1 + level.Aqueduct * 0.03)
				  - kittens * 4.25 * Math.max(1, happiness) * hyperbolicDecrease(level.Pasture * 0.005 + level.UnicornPasture * 0.0015),
		wood: workers.woodcutter * 0.09 * workerEfficiency 
					* (1 + (upgrades.MineralAxe && 0.7) + (upgrades.IronAxe && 0.5) + (upgrades.SteelAxe && 0.5) + (upgrades.TitaniumAxe && 0.5) + (upgrades.AlloyAxe && 0.5))
					* (1 + level.LumberMill * 0.1 * (1 + (upgrades.ReinforcedSaw && 0.2) + (upgrades.SteelSaw && 0.2) + (upgrades.TitaniumSaw && 0.15) + (upgrades.AlloySaw && 0.15)))
					* magnetoBonus
		      - level.Smelter * 0.25,
		minerals: workers.miner * 0.25 * workerEfficiency * (1 + level.Mine * 0.2 + level.Quarry * 0.35) * magnetoBonus
					- level.Smelter * 0.5 - level.Calciner * 7.5,
		catpower: workers.hunter * 0.3 * workerEfficiency * (1 + (upgrades.CompositeBow && 0.5) + (upgrades.Crossbow && 0.25))
					- level.Mint * 3.75,
		iron: (level.Smelter * 0.1 * (1 + (upgrades.ElectrolyticSmelting && 0.95)) + level.Calciner * 0.75 * (1 + (upgrades.Oxidation && 1))) * magnetoBonus,
		coal: 0 + ((upgrades.DeepMining && level.Mine * 0.015) + level.Quarry * 0.075 + workers.geologist * workerEfficiency * (0.075 + (upgrades.Geodesy && 0.0375) + (upgrades.MiningDrill && 0.05)))
						* (1 + (upgrades.Pyrolysis && 0.2))
						* (1 + (level.Steamworks && (-0.8 + (upgrades.HighPressureEngine && 0.2) + (upgrades.FuelInjectors && 0.2))))
						* magnetoBonus
						+ (upgrades.CoalFurnace && level.Smelter * 0.025 * (1 + (upgrades.ElectrolyticSmelting && 0.95))),
		gold: (level.Smelter * 0.005 + (upgrades.Geodesy && workers.geologist * workerEfficiency * (0.004 + (upgrades.MiningDrill && 0.0025)))) * magnetoBonus
					- level.Mint * 0.025,
		oil: level.OilWell * 0.1 * (1 + (upgrades.Pumpjack && 0.45) + (upgrades.OilRefinery && 0.35)) - level.Calciner * 0.12 - level.Magneto * 0.25,
		titanium: level.Calciner * 0.0025 * (1 + (upgrades.Oxidation && 3)) * magnetoBonus,
		science: workers.scholar * 0.18 * workerEfficiency * (1 + scienceBonus) + astroChance * (30 * scienceBonus),
		culture: level.Amphitheatre * 0.025 + level.Temple * 0.5 + level.Chapel * 0.25,
		faith: level.Temple * 0.0075 + level.Chapel * 0.025 + workers.priest * workerEfficiency * 0.0075,
		fur: level.Mint * 0.0000875 * maxCatpower - (luxury.fur && kittens * 0.05) * hyperbolicDecrease(level.TradePost * 0.04),
		ivory: level.Mint * 0.0000210 * maxCatpower - (luxury.ivory && kittens * 0.035) * hyperbolicDecrease(level.TradePost * 0.04),
		unicorn: level.UnicornPasture * 0.005 + (luxury.unicorn && 1e-6), // add some unicorns so the building shows up
		manuscript: level.Steamworks * ((upgrades.PrintingPress && 0.0025) + (upgrades.OffsetPress && 0.0075)) * magnetoBonus,
		starchart: astroChance * 1,
	}
}

function production(state: GameState) : {[R in Res]: number} {
	const production: {[R in Res]: number} = <any>basicProduction(state);
	for (const conversion of conversions) {
		if (!conversion.instanteneous) {
			continue; // the conversion is ongoing and included in basicProduction (like smelting iron)
		}

		const frequency = production[conversion.investment.expeditures[0].res] * state.conversionProportion[conversion.product]
										/ conversion.investment.expeditures[0].amount;
		for (const xp of conversion.investment.expeditures) {
			production[xp.res] -= xp.amount * frequency;
		}
		const produced = conversion.produced(state);
		for (const product in produced) {
			production[product] = (production[product] || 0) + produced[product] * frequency;
		}
	}
	return production;
}

type Storage = {[R in BasicRes]: number};
function storage(state: GameState): Storage {
	let {level, upgrades, ships} = state;

	const barnRatio = (upgrades.ExpandedBarns && 0.75) + (upgrades.ReinforcedBarns && 0.80) + (upgrades.TitaniumBarns && 1.00) + (upgrades.AlloyBarns && 1.00) + (upgrades.ConcretePillars && 0.05);
	const warehouseRatio = 1 + (upgrades.ReinforcedWarehouses && 0.25) + (upgrades.TitaniumWarehouses && 0.50) + (upgrades.AlloyWarehouses && 0.45) + (upgrades.ConcretePillars && 0.05);
	const harborRatio = 1 + (upgrades.ExpandedCargo && hyperbolicLimit(ships * 0.01, 2.25));

	return {
		catnip: (5000 + level.Barn * 5000 + (upgrades.Silos && level.Warehouse * 750) + level.Harbor * harborRatio * 2500) * (1 + (upgrades.Silos && barnRatio * 0.25)),
		wood: (200 + level.Barn * 200 + level.Warehouse * 150 + level.Harbor * harborRatio * 700) * (1 + barnRatio) * warehouseRatio,
		minerals: (250 + level.Barn * 250 + level.Warehouse * 200 + level.Harbor * harborRatio * 950) * (1 + barnRatio) * warehouseRatio,
		iron: (level.Barn * 50 + level.Warehouse * 25 + level.Harbor * harborRatio * 150) * (1 + barnRatio) * warehouseRatio,
		coal: 0,
		oil: level.OilWell * 1500,
		gold: (level.Barn * 10 + level.Warehouse * 5 + level.Harbor * harborRatio * 25) * warehouseRatio,
		catpower: 1e9, // I never hit the limit, so this should be ok
		science: 1e9, // TODO rework if technologies are tracked too
		culture: 1e9, // I never hit the limit, so this should be ok
		faith: 1e9, // I never hit the limit, so this should be ok
		unicorn: 1e9, // there is no limit
	}
}

class Expediture {
	price: number;
	cost: number;

	constructor(public amount: number, public res: Res) {
		this.price = price[res];
		this.cost = amount * this.price;
	}
}

export class Investment {
    cost = 0;
		expeditures: Expediture[] = [];
		expenses: {name: string, cost: number}[] = [];

		add(xp: Expediture) {
			if (Math.abs(xp.cost) > 1e-6 || Math.abs(xp.amount) > 1e-6) {
				this.expeditures.push(xp);
				this.cost += xp.cost;
			}
		}

		addExpense(expense: {name: string, cost: number}) {
			this.expenses.push(expense);
			this.cost += expense.cost;
		}
}

export class CostBenefitAnalysis {
	investment = new Investment();
	return = new Investment();
	instanteneous = false;
}

export abstract class Conversion extends CostBenefitAnalysis {
	instanteneous = true;

	/** also sets the price of the product! */
	constructor(public product: ConvertedRes | "iron", resourceInvestment: [number, Res][]) {
		super();
		let cost = 0;
		let benefit = 0;
		for (const [number, res] of resourceInvestment) {
			this.investment.add(new Expediture(number, res));
			cost += number * price[res];
		}

		const currentlyProduced = this.produced(state);		
		for (const res in currentlyProduced) {
			if (res != this.product) {
				const p = currentlyProduced[res];
				if (p) {
					this.return.add(new Expediture(p, <Res>res));
					if (p < 0) {
						cost -= p * price[res];
					} else {
						benefit += p * price[res];
					}
				}
			}
		}
		price[this.product] = Math.max(0, (cost * (state.priceMarkup[product] || 1) - benefit) / currentlyProduced[this.product]);
		this.return.add(new Expediture(currentlyProduced[this.product], this.product));
	}

	abstract produced(state: GameState): {[R in Res]?: number};
}

class Smelting extends Conversion {
	constructor() {
		super("iron", []);
		this.instanteneous = false;
	}

	produced(state: GameState) {
		return delta(basicProduction, s => s.level.Smelter++);
	}
}

class Hunt extends Conversion {
	constructor() {
		price.ivory = 0;
		super("fur", [[100, "catpower"]]);
	}

	produced(state: GameState){
		const {upgrades} = state;
		const huntingBonus = 0 + (upgrades.Bolas && 1) + (upgrades.HuntingArmor && 2) + (upgrades.SteelArmor && 0.5) + (upgrades.AlloyArmor && 0.5);
		return {
			fur: 40 + huntingBonus * 32,
			ivory: (0.44 + huntingBonus * 0.02) * (25 + huntingBonus * 20),
		}
	}
}

class ZebraTrade extends Conversion {
	constructor() {
		super("titanium", [[15, "gold"], [50, "catpower"], [50, "slab"]]);
	}

	produced(state: GameState) {
		const {level, ships} = state;
		const hostileChance = Math.max(0, 0.30 - level.TradePost * 0.0035);
		const expectedSuccess = 1 - hostileChance;
		const tradeRatio = 1 + level.TradePost * 0.015;

		const titaniumChance = Math.min(1, 0.15 + ships * 0.0035);
		const titaniumAmount = 1.5 + ships * 0.03;

		return {
			titanium: expectedSuccess * titaniumChance * titaniumAmount,
			plate: expectedSuccess * 0.65 * 2 * 1.05 * tradeRatio,
			iron: expectedSuccess * 1 * 300 * 1.00 * tradeRatio,
		}
	}
}

class CraftingConversion extends Conversion {
	constructor(product: ConvertedRes, resourceInvestment: [number, Res][]) {
		super(product, resourceInvestment);
	}

	produced(state: GameState) {
		const produced: {[R in Res]?: number} = {};
		produced[this.product] = 1 + state.level.Workshop * 0.06 + state.level.Factory * 0.05;
		return produced;
	}
}

export abstract class Action extends CostBenefitAnalysis {
	roi: number;

	constructor(s: GameState, public name: string, resourceInvestment: [number, Res][], resourceMultiplier = 1) {
		super();
		for (const [number, res] of resourceInvestment) {
			this.investment.add(new Expediture(number * resourceMultiplier, res));
		}

		this.procureStorage(this.investment.expeditures, s);

		const deltaProduction = delta(production, state => this.applyTo(state));
		for (const r of resourceNames) {
			if (deltaProduction[r]) {
				this.return.add(new Expediture(deltaProduction[r], r));
			}
		}

		this.roi = this.investment.cost / this.return.cost;
		if (this.roi < 0 || this.roi > 1e6) {
			this.roi = Infinity;
		}
	}

	private static procuringStorage = false;

	procureStorage(xps: Expediture[], state: GameState) {
		let currentState = clone(state);
		let currentStorage = storage(currentState);
		for (const xp of this.investment.expeditures) {
			while (xp.amount > currentStorage[xp.res]) {
				if (Action.procuringStorage) {
					// don't recurse (for performance, and to avoid endless recursion if a building needs storage, and considers building itself to fix that :-)
					this.investment.cost = Infinity;
					return;
				}
				Action.procuringStorage = true;
				try {
					// what's the best way to expand our storage?
					let bestRoI = 0;
					let bestAction: Action = null;
					let bestStorage: Storage;
					for (const sa of storageActions(currentState)) {
						sa.applyTo(currentState);
						let newStorage = storage(currentState);
						sa.undo(currentState);

						const gain = newStorage[xp.res] - currentStorage[xp.res];
						const cost = sa.investment.cost;
						const roi = gain / cost;
						if (roi > bestRoI) {
							bestRoI = roi;
							bestAction = sa;
							bestStorage = newStorage;
						}
					}

					if (bestAction) {
						this.investment.addExpense({
							name: bestAction.name,
							cost: bestAction.investment.cost
						});
						bestAction.applyTo(currentState)
						currentStorage = bestStorage;
					} else {
						this.investment.addExpense({
							name: "<more storage needed>",
							cost: Infinity,
						});
						return;
					}
				} finally {
					Action.procuringStorage = false;
				}
			}
		}
	}

	available(state: GameState) {
		for (const xp of this.investment.expeditures) {
			if (xp.res != "catnip" && xp.res != "wood" && basicResourceNames.includes(<any>xp.res) && !currentProduction[xp.res]) {
				return false;
			}
		}
		return true;
	}

	abstract applyTo(state: GameState): void;
	
	abstract undo(state: GameState): void;

	abstract stateInfo() : string;
}

class BuildingAction extends Action {
	constructor(name: Building, private initialConstructionResources: [number, Res][], priceRatio: number, s = state) {
		super(s, name, initialConstructionResources, Math.pow(priceRatio, s.level[name]));
	}

	stateInfo() {
		return state.level[this.name];
	}

	applyTo(state: GameState) {
		state.level[this.name]++;
	}

	undo(state: GameState) {
		state.level[this.name]--;
	}
}

class UpgradeAction extends Action {
	constructor(name: Upgrade, resourceCost: [number, Res][], s = state) {
		super(s, name, resourceCost);
	}

	stateInfo() {
		return state.upgrades[this.name] ? "R" : " ";
	}

  available(state: GameState) {
		return super.available(state) && state.level.Workshop && (state.showResearchedUpgrades || !state.upgrades[this.name]);
	}

	applyTo(state: GameState) {
		state.upgrades[this.name] = true;
	}

	undo(state: GameState) {
		state.upgrades[this.name] = false;
	}
}

class TradeshipAction extends Action {
	constructor(s = state) {
		super(s, "TradeShip", [[100, "scaffold"], [150, "plate"], [25, "starchart"]]);
	}

	applyTo(state: GameState) {
		state.ships += 1 + state.level.Workshop * 0.06;
	}
	undo(state: GameState) {
		state.ships -= 1 + state.level.Workshop * 0.06;
	}
	stateInfo() {
		return "";
	}
}

function updateActions() {
	const {upgrades} = state;
	actions = [
		new BuildingAction("CatnipField", [[10, "catnip"]], 1.12),
		new BuildingAction("Pasture", [[100, "catnip"], [10, "wood"]], 1.15),
		new BuildingAction("Aqueduct", [[75, "minerals"]], 1.12),
		new BuildingAction("Hut", [[5, "wood"]], 2.5 - (upgrades.IronWoodHuts && 0.5)),
		new BuildingAction("LogHouse", [[200, "wood"], [250, "minerals"]], 1.15),
		new BuildingAction("Mansion", [[185, "slab"], [75, "steel"], [25, "titanium"]], 1.15),
		new BuildingAction("Library", [[25, "wood"]], 1.15),
		new BuildingAction("Academy", [[50, "wood"], [70, "minerals"], [100, "science"]], 1.15),
		new BuildingAction("Observatory", [[50, "scaffold"], [35, "slab"], [750, "iron"], [1000, "science"]], 1.10),
		new BuildingAction("BioLab", [[100, "slab"], [25, "alloy"], [1500, "science"]], 1.10),
		new BuildingAction("Mine", [[100, "wood"]], 1.15),
		new BuildingAction("Quarry", [[50, "scaffold"], [125, "steel"], [1000, "slab"]], 1.15),
		new BuildingAction("LumberMill", [[100, "wood"], [50, "iron"], [250, "minerals"]], 1.15),
		new BuildingAction("OilWell", [[50, "steel"], [25, "gear"], [25, "scaffold"]], 1.15),
		new BuildingAction("Steamworks", [[65, "steel"], [20, "gear"], [1, "blueprint"]], 1.25),
		new BuildingAction("Magneto", [[10, "alloy"], [5, "gear"], [1, "blueprint"]], 1.25),
		new BuildingAction("Smelter", [[200, "minerals"]], 1.15),
		new BuildingAction("Calciner", [[100, "steel"], [15, "titanium"], [5, "blueprint"], [500, "oil"]], 1.15),
		new BuildingAction("Factory", [[2000, "titanium"], [2500, "plate"], [15, "concrete"]], 1.15),
		new BuildingAction("Amphitheatre", [[200, "wood"], [1200, "minerals"], [3, "parchment"]], 1.15),
		new BuildingAction("Chapel", [[2000, "minerals"], [250, "culture"], [250, "parchment"]], 1.15),
		new BuildingAction("Temple", [[25, "slab"], [15, "plate"], [10, "manuscript"], [50, "gold"]], 1.15), 
		new BuildingAction("Workshop", [[100, "wood"], [400, "minerals"]], 1.15),
		new BuildingAction("TradePost", [[500, "wood"], [200, "minerals"], [10, "gold"]], 1.15),
		new BuildingAction("Mint", [[5000, "minerals"], [200, "plate"], [500, "gold"]], 1.15),
		new BuildingAction("UnicornPasture", [[2, "unicorn"]], 1.75),

		new UpgradeAction("MineralHoes", [[100, "science"], [275, "minerals"]]),
		new UpgradeAction("IronHoes", [[200, "science"], [25, "iron"]]),
		new UpgradeAction("MineralAxe", [[100, "science"], [500, "minerals"]]),
		new UpgradeAction("IronAxe", [[200, "science"], [50, "iron"]]),
		new UpgradeAction("SteelAxe", [[20000, "science"], [75, "steel"]]),
		new UpgradeAction("ReinforcedSaw", [[2500, "science"], [1000, "iron"]]),
		new UpgradeAction("SteelSaw", [[52000, "science"], [750, "steel"]]),
		new UpgradeAction("AlloySaw", [[85000, "science"], [75, "alloy"]]),
		new UpgradeAction("TitaniumSaw", [[75000, "science"], [500, "titanium"]]),
		new UpgradeAction("TitaniumAxe", [[38000, "science"], [10, "titanium"]]),
		new UpgradeAction("AlloyAxe", [[70000, "science"], [25, "alloy"]]),
		new UpgradeAction("IronWoodHuts", [[30000, "science"], [15000, "wood"], [3000, "iron"]]),
		new UpgradeAction("CompositeBow", [[500, "science"], [100, "iron"], [200, "wood"]]),
		new UpgradeAction("Crossbow", [[12000, "science"], [1500, "iron"]]),
		new UpgradeAction("Bolas", [[1000, "science"], [250, "minerals"], [50, "wood"]]),
		new UpgradeAction("HuntingArmor", [[2000, "science"], [750, "iron"]]),
		new UpgradeAction("SteelArmor", [[10000, "science"], [50, "steel"]]),
		new UpgradeAction("AlloyArmor", [[50000, "science"], [25, "alloy"]]),
		new UpgradeAction("Geodesy", [[250, "titanium"], [500, "starchart"], [90000, "science"]]),
		new UpgradeAction("MiningDrill", [[1750, "titanium"], [750, "steel"], [100000, "science"]]),
		new UpgradeAction("CoalFurnace", [[5000, "minerals"], [2000, "iron"], [35, "beam"], [5000, "science"]]),
		new UpgradeAction("DeepMining", [[1200, "iron"], [50, "beam"], [5000, "science"]]),
		new UpgradeAction("Pyrolysis", [[5, "compendium"], [35000, "science"]]),
		new UpgradeAction("ElectrolyticSmelting", [[2000, "titanium"], [100000, "science"]]),
		new UpgradeAction("Oxidation", [[5000, "steel"], [100000, "science"]]),
		new UpgradeAction("PrintingPress", [[45, "gear"], [7500, "science"]]),
		new UpgradeAction("OffsetPress", [[250, "gear"], [15000, "oil"], [100000, "science"]]),
		new UpgradeAction("HighPressureEngine", [[25, "gear"], [20000, "science"], [5, "blueprint"]]),
		new UpgradeAction("FuelInjectors", [[250, "gear"], [20000, "oil"], [100000, "science"]]),
		new UpgradeAction("Astrolabe", [[5, "titanium"], [75, "starchart"], [25000, "science"]]),
		new UpgradeAction("TitaniumReflectors", [[15, "titanium"], [20, "starchart"], [20000, "science"]]),
		new UpgradeAction("Pumpjack", [[250, "titanium"], [125, "gear"], [100000, "science"]]),
		new UpgradeAction("Logistics", [[100, "gear"], [1000, "scaffold"], [100000, "science"]]),
		new UpgradeAction("OilRefinery", [[1250, "titanium"], [500, "gear"], [125000, "science"]]),

		new UpgradeAction("SunAltar", [[500, "faith"], [250, "gold"]]),

		new TradeshipAction(),
	];
	actions = actions.filter(a => a.available(state));
	actions.sort((a,b) => a.roi - b.roi);
}

function storageActions(state: GameState) {
	return [
		new BuildingAction("Barn", [[50, "wood"]], 1.75, state),
		new BuildingAction("Warehouse", [[1.5, "beam"], [2, "slab"]], 1.15, state),
		new BuildingAction("Harbor", [[5, "scaffold"], [50, "slab"], [75, "plate"]], 1.15, state),

		new UpgradeAction("ExpandedBarns", [[500, "science"], [1000, "wood"], [750, "minerals"], [50, "iron"]], state),
		new UpgradeAction("ReinforcedBarns", [[800, "science"], [25, "beam"], [10, "slab"], [100, "iron"]], state),
		new UpgradeAction("ReinforcedWarehouses", [[15000, "science"], [50, "plate"], [50, "steel"], [25, "scaffold"]], state),
		new UpgradeAction("Silos", [[50000, "science"], [125, "steel"], [5, "blueprint"]], state),
		new UpgradeAction("ExpandedCargo", [[55000, "science"], [15, "blueprint"]], state),
		new UpgradeAction("TitaniumBarns", [[60000, "science"], [25, "titanium"], [200, "steel"], [250, "scaffold"]], state),
		new UpgradeAction("AlloyBarns", [[75000, "science"], [20, "alloy"], [750, "plate"]], state),
		new UpgradeAction("TitaniumWarehouses", [[70000, "science"], [50, "titanium"], [500, "steel"], [500, "scaffold"]], state),
		new UpgradeAction("AlloyWarehouses", [[90000, "science"], [750, "titanium"], [50, "alloy"]], state),
		new UpgradeAction("ConcretePillars", [[100000, "science"], [50, "concrete"]], state),
	].filter(a => a.available(state));
}

class FurConsumptionReport extends CostBenefitAnalysis {
	constructor(state: GameState) {
		super();
		const productionDelta = delta(production, (state: GameState) => state.luxury.fur = !state.luxury.fur);
		for (const r of resourceNames) {
			if (productionDelta[r]) {
				this.return.add(new Expediture(productionDelta[r] * (state.luxury.fur ? -1 : 1), r));
			}
		}
	}
}

export function economyReport() {
	updateEconomy();
	currentProduction = production(state);
	updateActions();

	return {
		production: currentProduction, 
		price, 
		conversions,
		actions, 
		storageActions: storageActions(state), 
		furReport: new FurConsumptionReport(state),
	};
}