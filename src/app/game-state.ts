export class GameState {
	
	price : {[R in Res]? : number} = {}

  jobs = {
		farmer: new Job(5, "catnip"),
		woodcutter: new Job(0.05, "wood"),
		miner: new Job(0.1, "minerals"),
		scientist: new Job(0.2, "science")
	};

	buildings = [
		new Building("Catnip field", [[5, "catnip"]]),
		new Building("Pasture", [[100, "catnip"], [10, "wood"]]),
	];

	eco = {
		wage: 0
	}
}

export type Res = "catnip" | "wood" | "minerals" | "iron"| "science";

export const ResourceNames : Res[] = [
	"catnip", "wood", "minerals", "iron", "science"
]

class Job {
	workers = 0;
	baseProduction = 0;
	bonus = 0;
	modifiedProduction = 0;

	constructor(private initialProduction : number, private product : Res) {}
}

class Building {
	level = 0;
	investment : Investment;

	constructor(private name : string, private initialConstructionResources: [number, Res][], private priceRatio = 1.15) {}

	update() {
		this.investment = new Investment();
		for (const [number, res] of this.initialConstructionResources) {
			const xp = new Expediture(number * Math.pow(this.priceRatio, this.level), res);
			this.investment.expeditures.push(xp);
			this.investment.investment += xp.cost;
		}
	}
}

export const state : GameState = localStorage.kittensGameState ? JSON.parse(localStorage.kittensGameState) : new GameState();
const {jobs, price, eco, buildings} = state; // for brevity


class Investment {
		benefit = 0;
    investment = 0;
		expeditures: Expediture[] = [];
}

class Expediture {
	price: number;
	cost: number;

	constructor(public amount: number, public res: Res) {
		this.price = price[res];
		this.cost = amount * this.price;
	}
}

export class EconomyService {
	
	update() {
		// produced by jobs
		for (const jobName in jobs) {
			const job = jobs[jobName];
			job.modifiedProduction = job.baseProduction * (1 + job.bonus / 100);
			if (jobName == "farmer") {
				eco.wage = job.modifiedProduction / job.workers || job.initialProduction; // ensures price.catnip == 1
			}
			price[job.product] = job.workers 
				? eco.wage * job.workers / job.modifiedProduction
				: eco.wage / job.initialProduction;
		}

		// transmuted resources
		price.iron = (0.25 * price.wood + 0.5 * price.minerals) / 0.1;

		// buildings
		for (const building of buildings) {
			building.update();
		}
	}

}

export const economyService = new EconomyService();
economyService.update();

