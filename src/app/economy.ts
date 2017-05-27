import { state, Res, Building, Job, GameState, clone, resourceNames, Upgrade, ConvertedRes, BasicRes } from "app/game-state";

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
		catpower: wage / workerProduction("hunter", "catpower"),
		science: wage / workerProduction("scholar", "science"),
		iron: null, // assigned below
		unicorn: 1,
	};
	price = <any>basicPrice;
	price.iron = (0.25 * price.wood + 0.5 * price.minerals) / 0.1 * Math.pow(1.1, state.ironMarkup);

	const huntingBonus = 0;
	conversions = [
		// the constructor sets the price of the product
		new Hunt(),
		new CraftingConversion("parchment", [[175, "fur"]]),
	];
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

function basicProduction(state: GameState): {[R in BasicRes | "fur" | "ivory"]: number} {
	let {level, upgrades, workers, luxury} = state;

	const kittens = level.Hut * 2 + level.LogHouse * 1;
	const unhappiness = 0.02 * Math.max(kittens - 5, 0) * hyperbolicDecrease(level.Amphitheatre * 0.048);
	const happiness = 1 + (luxury.fur && 0.1) + (luxury.ivory && 0.1) + (luxury.unicorn && 0.1) - unhappiness;

	let idle = kittens;
	for (let j in workers) {
		idle -= workers[j];
	}
	if (idle > 0) {
		workers.farmer += idle; // so additional kittens are known to contribute production
	}

	return {
		catnip: (level.CatnipField * 0.63 * (1.5 + 1 + 1 + 0.25) / 4
				    + workers.farmer * happiness * 5 * (1 + (upgrades.MineralHoes && 0.5) + (upgrades.IronHoes && 0.3))
					) * (1 + level.Aqueduct * 0.03)
				  - kittens * 4.25 * Math.max(1, happiness) * hyperbolicDecrease(level.Pasture * 0.005 + level.UnicornPasture * 0.0015),
		wood: workers.woodcutter * 0.09 * happiness 
					* (1 + (upgrades.MineralAxe && 0.7) + (upgrades.IronAxe && 0.5)) 
					* (1 + level.LumberMill * 0.1 * (1 + (upgrades.ReinforcedSaw && 0.2)))
		      - level.Smelter * 0.25,
		minerals: workers.miner * 0.25 * happiness * (1 + 0.2 * level.Mine)
					- level.Smelter * 0.5,
		catpower: workers.hunter * 0.3 * happiness * (1 + (upgrades.CompositeBow && 0.5)),
		science: workers.scholar * 0.18 * happiness * (1 + level.Library * 0.1 + level.Academy * 0.2),
		iron: level.Smelter * 0.1,
		fur: 0 - (luxury.fur && kittens * 0.05) * hyperbolicDecrease(level.TradePost * 0.04),
		ivory: 0 - (luxury.ivory && kittens * 0.035) * hyperbolicDecrease(level.TradePost * 0.04),
		unicorn: level.UnicornPasture * 0.005 + (luxury.unicorn && 1e-6) // add some unicorns so the building shows up
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

		add(xp : Expediture) {
			if (Math.abs(xp.cost) > 1e-6) {
				this.expeditures.push(xp);
				this.cost += xp.cost;
			}
		}
}

abstract class Conversion {
	investment = new Investment();

	/** also sets the price of the product! */
	constructor(public product: ConvertedRes, resourceInvestment: [number, Res][]) {
		for (const [number, res] of resourceInvestment) {
			this.investment.add(new Expediture(number, res));
		}
		price[this.product] = this.investment.cost / this.produced(state)[this.product];
	}

	abstract produced(state: GameState): {[R in Res]?: number};
}

class Hunt extends Conversion {
	constructor() {
		super("fur", [[100, "catpower"]]);
		price.ivory = 0;
	}

	produced(state: GameState){
		const huntingBonus = 0 + (state.upgrades.Bolas && 1) + (state.upgrades.HuntingArmor && 2);
		return {
			fur: 40 + huntingBonus * 32,
			ivory: (0.44 + huntingBonus * 0.02) * (25 + huntingBonus * 20),
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

export abstract class Action {
	investment = new Investment();
	return = new Investment();
	roi: number;

	constructor(public name: string, resourceInvestment: [number, Res][], resourceMultiplier = 1) {
		for (const [number, res] of resourceInvestment) {
			this.investment.add(new Expediture(number * resourceMultiplier, res));
		}

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

	available() {
		for (const xp of this.investment.expeditures) {
			if (!currentProduction[xp.res]) {
				return false;
			}
		}
		return true;
	}

	abstract applyTo(state: GameState): void;
	
	abstract undo();

	abstract stateInfo() : string;
}

class BuildingAction extends Action {
	constructor(name: Building, private initialConstructionResources: [number, Res][], priceRatio: number) {
		super(name, initialConstructionResources, Math.pow(priceRatio, state.level[name]));
	}

	stateInfo() {
		return state.level[this.name];
	}

	applyTo(state: GameState) {
		state.level[this.name]++;
	}

	undo() {
		state.level[this.name]--;
	}
}

class UpgradeAction extends Action {
	constructor(name: Upgrade, resourceCost: [number, Res][]) {
		super(name, resourceCost);
	}

	stateInfo() {
		return state.upgrades[this.name] ? "R" : " ";
	}

  available() {
		return super.available() && state.level.Workshop && (state.showResearchedUpgrades || !state.upgrades[this.name]);
	}

	applyTo(state: GameState) {
		state.upgrades[this.name] = true;
	}

	undo() {
		state.upgrades[this.name] = false;
	}
}

function updateActions() {
	actions = [
		new BuildingAction("CatnipField", [[10, "catnip"]], 1.12),
		new BuildingAction("Pasture", [[100, "catnip"], [10, "wood"]], 1.15),
		new BuildingAction("Aqueduct", [[75, "minerals"]], 1.15),
		new BuildingAction("Hut", [[5, "wood"]], 2.5),
		new BuildingAction("LogHouse", [[200, "wood"], [250, "minerals"]], 1.15),
		new BuildingAction("Library", [[25, "wood"]], 1.15),
		new BuildingAction("Academy", [[50, "wood"], [70, "minerals"], [100, "science"]], 1.15),
		new BuildingAction("Mine", [[100, "wood"]], 1.15),
		new BuildingAction("LumberMill", [[100, "wood"], [50, "iron"], [250, "minerals"]], 1.15),
		new BuildingAction("Smelter", [[200, "minerals"]], 1.15),
		new BuildingAction("Workshop", [[100, "wood"], [400, "minerals"]], 1.15),
		new BuildingAction("Amphitheatre", [[200, "wood"], [1200, "minerals"], [3, "parchment"]], 1.15),
		new BuildingAction("TradePost", [[500, "wood"], [200, "minerals"]], 1.15), // TODO: include Gold
		new BuildingAction("UnicornPasture", [[2, "unicorn"]], 1.75),

		new UpgradeAction("MineralHoes", [[100, "science"], [275, "minerals"]]),
		new UpgradeAction("IronHoes", [[200, "science"], [25, "iron"]]),
		new UpgradeAction("MineralAxe", [[100, "science"], [500, "minerals"]]),
		new UpgradeAction("IronAxe", [[200, "science"], [50, "iron"]]),
		new UpgradeAction("ReinforcedSaw", [[2500, "science"], [1000, "iron"]]),
		new UpgradeAction("CompositeBow", [[500, "science"], [100, "iron"], [200, "wood"]]),
		new UpgradeAction("Bolas", [[1000, "science"], [250, "minerals"], [50, "wood"]]),
		new UpgradeAction("HuntingArmor", [[2000, "science"], [750, "iron"]]),
	];
	actions = actions.filter(a => a.available());
	actions.sort((a,b) => a.roi - b.roi);
}

function furConsumptionReport() {
	const productionDelta = delta(production, (state: GameState) => state.luxury.fur = !state.luxury.fur);
	const benefit = new Investment();
	for (const r of resourceNames) {
		if (productionDelta[r]) {
			benefit.add(new Expediture(productionDelta[r] * (state.luxury.fur ? -1 : 1), r));
		}
	}
	return benefit;
}

export function economyReport() {
	updateEconomy();
	currentProduction = production(state);
	updateActions();

	return {production: currentProduction, price, actions, furReport: furConsumptionReport()};
}