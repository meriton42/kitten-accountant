import { state, Res, Building, Job, GameState, clone, resourceNames, Upgrade, ConvertedRes, BasicRes, basicResourceNames } from "app/game-state";

let currentProduction: {[R in Res]: number};
let price: {[R in Res]: number};
let conversions: Conversion[];
let actions: Action[];

function updateEconomy() {
  const wage = 1;
	const basicPrice : {[R in BasicRes]: number} = {
		catnip: wage / workerProduction("farmer", "catnip"),
		wood: wage / workerProduction("woodcutter", "wood"),
		minerals: wage / workerProduction("miner", "minerals"),
		iron: null, // assigned below
		coal: state.coalPrice,
		gold: 1, // find a way to price this
		catpower: wage / workerProduction("hunter", "catpower"),
		science: wage / workerProduction("scholar", "science"),
		culture: 1, // find a way to price this
		faith: wage / workerProduction("priest", "faith"),
		unicorn: 1,
	};
	price = <any>basicPrice;
	price.iron = (0.25 * price.wood + 0.5 * price.minerals) / 0.1 * Math.pow(1.1, state.ironMarkup);

	const huntingBonus = 0;
	conversions = [
		// the constructor sets the price of the product
		new Hunt(),
		new CraftingConversion("beam", [[175, "wood"]]),
		new CraftingConversion("slab", [[250, "minerals"]]),
		new CraftingConversion("steel", [[100, "coal"], [100, "iron"]]),
		new CraftingConversion("gear", [[15, "steel"]]),
		new CraftingConversion("plate", [[125, "iron"]]),
		new CraftingConversion("scaffold", [[50, "beam"]]),
		new CraftingConversion("parchment", [[175, "fur"]]),
		new CraftingConversion("manuscript", [[25, "parchment"], [400, "culture"]]),
		new ZebraTrade(),
	];

	price.starchart = 1000; // find a way to price this
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

function basicProduction(state: GameState): {[R in BasicRes | "fur" | "ivory" | "manuscript" | "starchart"]: number} {
	let {level, upgrades, workers, luxury} = state;

	const kittens = level.Hut * 2 + level.LogHouse * 1 + level.Mansion * 1;
	const unhappiness = 0.02 * Math.max(kittens - 5, 0) * hyperbolicDecrease(level.Amphitheatre * 0.048);
	const happiness = 1 + (luxury.fur && 0.1) + (luxury.ivory && 0.1) + (luxury.unicorn && 0.1) + (state.karma && 0.1 + state.karma * 0.01) 
									+ (upgrades.SunAltar && level.Temple * 0.005) - unhappiness;

	let idle = kittens;
	for (let j in workers) {
		idle -= workers[j];
	}
	if (idle > 0) {
		workers.farmer += idle; // so additional kittens are known to contribute production
	}
	const scienceBonus = level.Library * (0.1 + (upgrades.TitaniumReflectors && level.Observatory * 0.02)) + level.Academy * 0.2 + level.Observatory * 0.25;
	const astroChance = ((level.Library && 0.25) + level.Observatory * 0.2) * 0.005 * Math.min(1, level.Observatory * 0.01);
	const maxCatpower = level.Hut * 75 + level.LogHouse * 50 + level.Mansion * 50;

	return {
		catnip: (level.CatnipField * 0.63 * (1.5 + 1 + 1 + 0.25) / 4
				    + workers.farmer * happiness * 5 * (1 + (upgrades.MineralHoes && 0.5) + (upgrades.IronHoes && 0.3))
					) * (1 + level.Aqueduct * 0.03)
				  - kittens * 4.25 * Math.max(1, happiness) * hyperbolicDecrease(level.Pasture * 0.005 + level.UnicornPasture * 0.0015),
		wood: workers.woodcutter * 0.09 * happiness 
					* (1 + (upgrades.MineralAxe && 0.7) + (upgrades.IronAxe && 0.5) + (upgrades.SteelAxe && 0.5) + (upgrades.TitaniumAxe && 0.5))
					* (1 + level.LumberMill * 0.1 * (1 + (upgrades.ReinforcedSaw && 0.2)))
		      - level.Smelter * 0.25,
		minerals: workers.miner * 0.25 * happiness * (1 + 0.2 * level.Mine)
					- level.Smelter * 0.5,
		catpower: workers.hunter * 0.3 * happiness * (1 + (upgrades.CompositeBow && 0.5) + (upgrades.Crossbow && 0.25))
					- level.Mint * 3.75,
		iron: level.Smelter * 0.1,
		coal: 0 + (upgrades.DeepMining && level.Mine * 0.015) * (1 - (level.Steamworks && 0.8) + (upgrades.HighPressureEngine && 0.2))
						+ (upgrades.CoalFurnace && level.Smelter * 0.025),
		gold: level.Smelter * 0.005 - level.Mint * 0.025,
		science: workers.scholar * 0.18 * happiness * (1 + scienceBonus) + astroChance * (30 * scienceBonus),
		culture: level.Amphitheatre * 0.025 + level.Temple * 0.5,
		faith: level.Temple * 0.0075 + workers.priest * 0.0075,
		fur: level.Mint * 0.0000875 * maxCatpower - (luxury.fur && kittens * 0.05) * hyperbolicDecrease(level.TradePost * 0.04),
		ivory: level.Mint * 0.0000210 * maxCatpower - (luxury.ivory && kittens * 0.035) * hyperbolicDecrease(level.TradePost * 0.04),
		unicorn: level.UnicornPasture * 0.005 + (luxury.unicorn && 1e-6), // add some unicorns so the building shows up
		manuscript: 0 + (upgrades.PrintingPress && level.Steamworks * 0.0025),
		starchart: astroChance * 1,
	}
}

function production(state: GameState) : {[R in Res]: number} {
	const production: {[R in Res]: number} = <any>basicProduction(state);
	for (const conversion of conversions) {
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
	let {level, upgrades} = state;

	const barnRatio = 1 + (upgrades.ExpandedBarns && 0.75) + (upgrades.ReinforcedBarns && 0.80) + (upgrades.TitaniumBarns && 1.00);
	const warehouseRatio = 1 + (upgrades.ReinforcedWarehouses && 0.25);

	return {
		catnip: 5000 + level.Barn * 5000 + level.Harbor * 2500,
		wood: (200 + level.Barn * 200 + level.Warehouse * 150 + level.Harbor * 700) * barnRatio * warehouseRatio,
		minerals: (250 + level.Barn * 250 + level.Warehouse * 200 + level.Harbor * 950) * barnRatio * warehouseRatio,
		iron: (level.Barn * 50 + level.Warehouse * 25 + level.Harbor * 150) * barnRatio * warehouseRatio,
		coal: 0,
		gold: (level.Barn * 10 + level.Warehouse * 5 + level.Harbor * 25) * warehouseRatio,
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
			if (Math.abs(xp.cost) > 1e-6) {
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
	/** also sets the price of the product! */
	constructor(public product: ConvertedRes, resourceInvestment: [number, Res][]) {
		super();
		for (const [number, res] of resourceInvestment) {
			this.investment.add(new Expediture(number, res));
		}

		const currentlyProduced = this.produced(state);		
		for (const res in currentlyProduced) {
			if (res != this.product) {
				this.return.add(new Expediture(currentlyProduced[res], <Res>res));
			}
		}
		price[this.product] = Math.max(0, (this.investment.cost - this.return.cost) / currentlyProduced[this.product]);
		this.return.add(new Expediture(currentlyProduced[this.product], this.product));

		this.instanteneous = true;
	}

	abstract produced(state: GameState): {[R in Res]?: number};
}

class Hunt extends Conversion {
	constructor() {
		super("fur", [[100, "catpower"]]);
		price.ivory = 0;
	}

	produced(state: GameState){
		const {upgrades} = state;
		const huntingBonus = 0 + (upgrades.Bolas && 1) + (upgrades.HuntingArmor && 2) + (upgrades.SteelArmor && 0.5);
		return {
			fur: 40 + huntingBonus * 32,
			ivory: (0.44 + huntingBonus * 0.02) * (25 + huntingBonus * 20),
		}
	}
}

class ZebraTrade extends Conversion {
	constructor() {
		super("titanium", [[50, "catpower"], [15, "gold"], [50, "slab"]]); // TODO and 15 gold
	}

	produced(state: GameState) {
		const {level} = state;
		const hostileChance = 0.30 - level.TradePost * 0.0035;
		const efficiency = (1 - hostileChance) * (1 + level.TradePost * 0.015);

		const titaniumChance = Math.min(1, 0.15 + level.TradeShip * 0.0035);
		const titaniumAmount = 1.5 + level.TradeShip * 0.03;
		const plateChance = 0.65;

		return {
			titanium: titaniumChance * titaniumAmount,
			plate: efficiency * 0.65 * 2 * 1.05,
			iron: efficiency * 1 * 300 * 1.00,
		}
	}
}

class CraftingConversion extends Conversion {
	constructor(product: ConvertedRes, resourceInvestment: [number, Res][]) {
		super(product, resourceInvestment);
	}

	produced(state: GameState) {
		const produced: {[R in Res]?: number} = {};
		produced[this.product] = 1 + state.level.Workshop * 0.06;
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
		new BuildingAction("Mine", [[100, "wood"]], 1.15),
		new BuildingAction("LumberMill", [[100, "wood"], [50, "iron"], [250, "minerals"]], 1.15),
		new BuildingAction("Steamworks", [[65, "steel"], [20, "gear"]], 1.25), // and 1 blueprint
		new BuildingAction("Smelter", [[200, "minerals"]], 1.15),
		new BuildingAction("Amphitheatre", [[200, "wood"], [1200, "minerals"], [3, "parchment"]], 1.15),
		new BuildingAction("Temple", [[25, "slab"], [15, "plate"], [10, "manuscript"], [50, "gold"]], 1.15), 
		new BuildingAction("Workshop", [[100, "wood"], [400, "minerals"]], 1.15),
		new BuildingAction("TradePost", [[500, "wood"], [200, "minerals"], [10, "gold"]], 1.15),
		new BuildingAction("Mint", [[5000, "minerals"], [200, "plate"], [500, "gold"]], 1.15),
		new BuildingAction("UnicornPasture", [[2, "unicorn"]], 1.75),
		new BuildingAction("TradeShip", [[100, "scaffold"], [150, "plate"], [25, "starchart"]], 1),

		new UpgradeAction("MineralHoes", [[100, "science"], [275, "minerals"]]),
		new UpgradeAction("IronHoes", [[200, "science"], [25, "iron"]]),
		new UpgradeAction("MineralAxe", [[100, "science"], [500, "minerals"]]),
		new UpgradeAction("IronAxe", [[200, "science"], [50, "iron"]]),
		new UpgradeAction("SteelAxe", [[20000, "science"], [75, "steel"]]),
		new UpgradeAction("ReinforcedSaw", [[2500, "science"], [1000, "iron"]]),
		new UpgradeAction("TitaniumAxe", [[38000, "science"], [10, "titanium"]]),
		new UpgradeAction("IronWoodHuts", [[30000, "science"], [15000, "wood"], [3000, "iron"]]),
		new UpgradeAction("CompositeBow", [[500, "science"], [100, "iron"], [200, "wood"]]),
		new UpgradeAction("Crossbow", [[12000, "science"], [1500, "iron"]]),
		new UpgradeAction("Bolas", [[1000, "science"], [250, "minerals"], [50, "wood"]]),
		new UpgradeAction("HuntingArmor", [[2000, "science"], [750, "iron"]]),
		new UpgradeAction("SteelArmor", [[10000, "science"], [50, "steel"]]),
		new UpgradeAction("CoalFurnace", [[5000, "minerals"], [2000, "iron"], [35, "beam"], [5000, "science"]]),
		new UpgradeAction("DeepMining", [[1200, "iron"], [50, "beam"], [5000, "science"]]),
		new UpgradeAction("PrintingPress", [[45, "gear"], [7500, "science"]]),
		new UpgradeAction("HighPressureEngine", [[25, "gear"], [20000, "science"]]), // and 5 blueprints
		new UpgradeAction("Astrolabe", [[5, "titanium"], [75, "starchart"], [25000, "science"]]),
		new UpgradeAction("TitaniumReflectors", [[15, "titanium"], [20, "starchart"], [20000, "science"]]),
		new UpgradeAction("SunAltar", [[500, "faith"]]), // and 250 gold
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
		new UpgradeAction("TitaniumBarns", [[60000, "science"], [25, "titanium"], [200, "steel"], [250, "scaffold"]], state),
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