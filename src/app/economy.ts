import { state, Res, Building, Job, GameState, clone, resourceNames, Upgrade } from "app/game-state";

let currentProduction: {[R in Res]: number};
let price: {[R in Res]: number};
let actions: Action[];

function updateEconomy() {
  const wage = 1;
	price = {
		catnip: wage / workerProduction("farmer", "catnip"),
		wood: wage / workerProduction("woodcutter", "wood"),
		minerals: wage / workerProduction("miner", "minerals"),
		science: wage / workerProduction("scholar", "science"),
		iron: null, // assigned below
	};
	price.iron = (0.25 * price.wood + 0.5 * price.minerals) / 0.1 * Math.pow(1.1, state.ironMarkup);
}

function workerProduction(job: Job, res: Res) {
	return productionDelta((s) => s.workers[job]++)[res];
}

function productionDelta(change: (state: GameState) => void): {[R in Res]: number} {
	const clonedState = clone(state);
	change(clonedState);
	const modified = production(clonedState);

	const delta : {[R in Res]: number} = <any>{};
	for (let r in currentProduction) {
		delta[r] = modified[r] - currentProduction[r];
	}
	return delta;
}

function production(state: GameState) : {[R in Res]: number} {
	let {level, upgrades, workers} = state;

	const kittens = level.Hut * 2;
	const happiness = 1 - 0.02 * Math.max(kittens - 5, 0);

	let idle = kittens;
	for (let j in workers) {
		idle -= workers[j];
	}
	if (idle > 0) {
		workers.farmer += idle; // so additional kittens are known to contribute production
	}

	return {
		catnip: 0.63 * level.CatnipField * (1.5 + 1 + 1 + 0.25) / 4
				  + workers.farmer * 5 * happiness * (1 + (upgrades.MineralHoes && 0.5) + (upgrades.IronHoes && 0.3))
				  - kittens * 4.25 * (1 - 0.005 * level.Pasture),  // TODO account for happiness > 100 and diminishing Pasture returns
		wood: workers.woodcutter * 0.09 * happiness * (1 + (upgrades.MineralAxe && 0.7) + (upgrades.IronAxe && 0.5))
		      - level.Smelter * 0.25,
		minerals: workers.miner * 0.25 * happiness * (1 + 0.2 * level.Mine)
					- level.Smelter * 0.5,
		science: workers.scholar * 0.18 * happiness * (1 + 0.1 * level.Library),
		iron: level.Smelter * 0.1,
	};
}

class Expediture {
	price: number;
	cost: number;

	constructor(public amount: number, public res: Res) {
		this.price = price[res];
		this.cost = amount * this.price;
	}
}

class Investment {
    cost = 0;
		expeditures: Expediture[] = [];

		add(xp : Expediture) {
			this.expeditures.push(xp);
			this.cost += xp.cost;
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

		const delta = productionDelta(state => this.applyTo(state))
		for (const r of resourceNames) {
			if (delta[r]) {
				this.return.add(new Expediture(delta[r], r));
			}
		}

		this.roi = this.investment.cost / this.return.cost;
		if (this.roi < 0) {
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
		new BuildingAction("Hut", [[5, "wood"]], 2.5),
		new BuildingAction("Library", [[25, "wood"]], 1.15),
		new BuildingAction("Mine", [[100, "wood"]], 1.15),
		new BuildingAction("Workshop", [[100, "wood"], [400, "minerals"]], 1.15),
		new BuildingAction("Smelter", [[200, "minerals"]], 1.15),

		new UpgradeAction("MineralHoes", [[100, "science"], [275, "minerals"]]),
		new UpgradeAction("IronHoes", [[200, "science"], [25, "iron"]]),
		new UpgradeAction("MineralAxe", [[100, "science"], [500, "minerals"]]),
		new UpgradeAction("IronAxe", [[200, "science"], [50, "iron"]]),
	];
	actions = actions.filter(a => a.available());
	actions.sort((a,b) => a.roi - b.roi);
}

export function economyReport() {
  currentProduction = production(state);
	updateEconomy();
	updateActions();

	return {production: currentProduction, price, actions};
}