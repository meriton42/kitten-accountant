import { state, Res, Building, Job, GameState, clone, resourceNames } from "app/game-state";

let currentProduction: {[R in Res]: number};
let price: {[R in Res]: number};
let actions: Action[];

function updateEconomy() {
  const wage = 1;
	price = {
		catnip: wage / workerProduction("farmer", "catnip"),
		wood: wage / workerProduction("woodcutter", "wood"),
		minerals: wage / workerProduction("miner", "minerals"),
		science: wage / workerProduction("scientist", "science"),
		iron: null, // assigned below
	};
	price.iron = (0.25 * price.wood + 0.5 * price.minerals) / 0.1;
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
	let {level, workers} = state;
	return {
		catnip: 0.63 * level.CatnipField * (1.5 + 1 + 1 + 0.25) / 4
					+ workers.farmer * 5,
		wood: workers.woodcutter * 0.05,
		minerals: workers.miner * 0.1,
		science: workers.scientist * 0.2,
		iron: 0
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

export class Action {
	investment : Investment;
	return: Investment;

	constructor(private name : Building, private initialConstructionResources: [number, Res][], private priceRatio = 1.15) {
		this.investment = new Investment();
		for (const [number, res] of this.initialConstructionResources) {
			this.investment.add(new Expediture(number * Math.pow(this.priceRatio, state.level[name]), res));
		}

		this.return = new Investment();
		const delta = productionDelta(state => state.level[name]++)
		for (const r of resourceNames) {
			if (delta[r]) {
				this.return.add(new Expediture(delta[r], r));
			}
		}
	}
}


function updateActions() {
	// buildings
	actions = [
		new Action("CatnipField", [[10, "catnip"]], 1.12),
		new Action("Pasture", [[100, "catnip"], [10, "wood"]]),
	];
}

export function economyReport() {
  currentProduction = production(state);
	updateEconomy();
	updateActions();

	return {price, actions};
}