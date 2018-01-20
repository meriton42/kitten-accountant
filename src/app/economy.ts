import { state, Res, Building, Job, GameState, clone, resourceNames, Upgrade, ConvertedRes, BasicRes, basicResourceNames } from "app/game-state";

let currentBasicProduction: Cart;
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
		titanium: 0, // assigned below
		uranium: 0, // assigned below
		unobtainium: 1000 * priceMarkup.unobtainium,
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
	price.starchart = 1000 * priceMarkup.starchart;

	// proper pricing for iron is rather involved, because the relative impact of the 3 contributions 
	// (raw material cost, smelter cost, value of other outputs) changes greatly in the course of the game
	// and affixing the priceMarkup to any single contribution therefore has counter intuitive side effects
	// instead, we introduce a separate contribution to affix the priceMarkup
	const smelter = delta(basicProduction, s => s.level.Smelter++);
	const ironPrice = (priceMarkup.iron - smelter.wood * price.wood - smelter.minerals * price.minerals) / smelter.iron;
	price.iron = ironPrice;

	conversions = [
		// the constructor sets the price of the product
		new Hunt(),
		new CraftingConversion("parchment", {fur: 175}),
		new CraftingConversion("manuscript", {parchment: 25, culture: 400}),
		new CraftingConversion("compendium", {manuscript: 50, science: 10000}),
		new CraftingConversion("blueprint", {compendium: 25, science: 25000}),
		new CraftingConversion("beam", {wood: 175}),
		new CraftingConversion("slab", {minerals: 250}),
		new CraftingConversion("plate", {iron: 125}),
		new ZebraTrade(),
		new DragonTrade(),
		new CraftingConversion("steel", {coal: 100, iron: 100}),
		new CraftingConversion("gear", {steel: 15}),
		new CraftingConversion("concrete", {slab: 2500, steel: 25}),
		new CraftingConversion("alloy", {steel: 75, titanium: 10}),
		new CraftingConversion("eludium", {alloy: 2500, unobtainium: 1000}),
		new CraftingConversion("scaffold", {beam: 50}),
		new Smelting(ironPrice),
		new KeroseneConversion(),
		new CraftingConversion("megalith", {slab: 50, beam: 25, plate: 5}),
		new UnicornSacrifice(),
	];
}

function workerProduction(job: Job, res: Res) {
	return delta(basicProduction, (s) => s.workers[job]++)[res];
}

type Cart = {[R in Res]?: number};

function delta(metric: (state: GameState) => Cart, change: (state: GameState) => void): Cart {
	const original = metric(state);
	const clonedState = clone(state);
	change(clonedState);
	const modified = metric(clonedState);

	const delta = {};
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

/** called getTriValue in kittens game source code */
function triValue(value: number, stripe: number){
	return (Math.sqrt(1 + 8 * value / stripe) - 1) / 2;
}

/** multiplier to production caused by solar revolution */
export function solarRevolutionProductionBonus(state: GameState) {
	return 1 + (state.upgrades.SolarRevolution && hyperbolicLimit(triValue(state.faith.stored, 1000), 1000) * 0.01);
}

function basicProduction(state: GameState): Cart {
	let {level, upgrades, workers, luxury} = state;

	const kittens = level.Hut * 2 + level.LogHouse * 1 + level.Mansion * 1 + level.SpaceStation * 2;
	const unhappiness = 0.02 * Math.max(kittens - 5, 0) * hyperbolicDecrease(level.Amphitheatre * 0.048 + level.BroadcastTower * 0.75);
	const happiness = 1 + (luxury.fur && 0.1) + (luxury.ivory && 0.1) + (luxury.unicorn && 0.1) + (state.karma && 0.1 + state.karma * 0.01) 
									+ (level.SunAltar && level.Temple * (0.004 + level.SunAltar * 0.001)) - unhappiness;
	const workerProficiency = 1 + 0.1875 * kittens / (kittens + 50) * (1 + (upgrades.Logistics && 0.15) + (upgrades.Augmentations && 1));  // the more kittens, the older the average kitten (assuming no deaths)
	const workerEfficiency = happiness * workerProficiency;

	let idle = kittens;
	for (let j in workers) {
		idle -= workers[j];
	}
	if (idle > 0) {
		workers.farmer += idle; // so additional kittens are known to contribute production
	}

	const faithBonus = solarRevolutionProductionBonus(state);
	const paragonBonus = 1 + 0.01 * hyperbolicLimit(state.paragon, 200);
	const autoParagonBonus = 1 + 0.0005 * hyperbolicLimit(state.paragon, 200);

	const scienceBonus = level.Library * 0.1 
											+ level.Academy * 0.2 
											+ level.Observatory * 0.25 * (1 + level.Satellite * 0.05) 
											+ level.BioLab * (0.35 + (upgrades.BiofuelProcessing && 0.35))
											+ level.SpaceStation * 0.5;
	const astroChance = ((level.Library && 0.25) + level.Observatory * 0.2) * 0.005 * Math.min(1, upgrades.SETI ? 1 : level.Observatory * 0.01);
	const maxCatpower = (level.Hut * 75 + level.LogHouse * 50 + level.Mansion * 50 + level.Temple * (level.Templars && 50 + level.Templars * 25)) * (1 + state.paragon * 0.001);

	const energyProduction = level.Steamworks * 1 
											+ level.Magneto * 5 
											+ level.HydroPlant * 5 * (1 + (upgrades.HydroPlantTurbines && 0.15))
											+ level.Reactor * (10 + (upgrades.ColdFusion && 2.5)) 
											+ level.SolarFarm * 2 * (1 + (upgrades.PhotovoltaicCells && 0.5))
											+ (upgrades.SolarSatellites && level.Satellite * 1);
	const energyConsumption = level.Calciner * 1 
											+ level.Factory * 2 
											+ (upgrades.Pumpjack && level.OilWell * 1) 
											+ (upgrades.BiofuelProcessing && level.BioLab * 1)
											+ (!upgrades.SolarSatellites && level.Satellite * 1)
											+ level.Accelerator * 2
											+ level.SpaceStation * 10
											+ level.LunarOutpost * 5
											+ level.MoonBase * 10;
	const energyBonus = Math.max(1, Math.min(1.75, (energyProduction / energyConsumption) || 1));

	const magnetoBonus = 1 + level.Magneto * 0.02 * (1 + level.Steamworks * 0.15);
	const reactorBonus = 1 + level.Reactor * 0.05;

	const spaceRatioUranium = (1 + level.SpaceElevator * 0.01) // for some reason, space manuf. does not apply to uranium
	const spaceRatio = spaceRatioUranium * (1 + (upgrades.SpaceManufacturing && level.Factory * (0.05 + (upgrades.FactoryLogistics && 0.01)) * 0.75)); 
	const prodTransferBonus = level.SpaceElevator * 0.001;
	const spaceAutoprodRatio = spaceRatio * (1 + (magnetoBonus * reactorBonus - 1) * prodTransferBonus); // TODO magneto does not apply for oil, reactor not for uranium

	const unicornRatioReligion = level.UnicornTomb * 0.05 + level.IvoryTower * 0.1 + level.IvoryCitadel * 0.25;

	return {
		catnip: (level.CatnipField * 0.63 * (1.5 + 1 + 1 + 0.25) / 4
				    + workers.farmer * workerEfficiency * 5 * (1 + (upgrades.MineralHoes && 0.5) + (upgrades.IronHoes && 0.3))
					) * (1 + level.Aqueduct * 0.03) * paragonBonus * faithBonus
					- kittens * 4.25 * Math.max(1, happiness) * hyperbolicDecrease(level.Pasture * 0.005 + level.UnicornPasture * 0.0015) * (1 - (upgrades.RoboticAssistance && 0.25))
					- (upgrades.BiofuelProcessing && level.BioLab * 5),
		wood: workers.woodcutter * 0.09 * workerEfficiency 
					* (1 + (upgrades.MineralAxe && 0.7) + (upgrades.IronAxe && 0.5) + (upgrades.SteelAxe && 0.5) + (upgrades.TitaniumAxe && 0.5) + (upgrades.AlloyAxe && 0.5))
					* (1 + level.LumberMill * 0.1 * (1 + (upgrades.ReinforcedSaw && 0.2) + (upgrades.SteelSaw && 0.2) + (upgrades.TitaniumSaw && 0.15) + (upgrades.AlloySaw && 0.15)))
					* paragonBonus * magnetoBonus * reactorBonus * faithBonus
		      - level.Smelter * 0.25,
		minerals: workers.miner * 0.25 * workerEfficiency * (1 + level.Mine * 0.2 + level.Quarry * 0.35) * paragonBonus * magnetoBonus * reactorBonus * faithBonus
					- level.Smelter * 0.5 - level.Calciner * 7.5,
		catpower: workers.hunter * 0.3 * workerEfficiency * (1 + (upgrades.CompositeBow && 0.5) + (upgrades.Crossbow && 0.25) + (upgrades.Railgun && 0.25)) * paragonBonus * faithBonus
					- level.Mint * 3.75,
		iron: (level.Smelter * 0.1 * (1 + (upgrades.ElectrolyticSmelting && 0.95)) + level.Calciner * 0.75 * (1 + (upgrades.Oxidation && 1) + (upgrades.RotaryKiln && 0.75) + (upgrades.FluidizedReactors && 1))) * autoParagonBonus * magnetoBonus * reactorBonus * faithBonus,
		coal: 0 + ((upgrades.DeepMining && level.Mine * 0.015) + level.Quarry * 0.075 + workers.geologist * workerEfficiency * (0.075 + (upgrades.Geodesy && 0.0375) + (upgrades.MiningDrill && 0.05) + (upgrades.UnobtainiumDrill && 0.075)))
						* (1 + (upgrades.Pyrolysis && 0.2))
						* (1 + (level.Steamworks && (-0.8 + (upgrades.HighPressureEngine && 0.2) + (upgrades.FuelInjectors && 0.2))))
						* paragonBonus * magnetoBonus * reactorBonus * faithBonus
						+ (upgrades.CoalFurnace && level.Smelter * 0.025 * (1 + (upgrades.ElectrolyticSmelting && 0.95))) * autoParagonBonus,
		gold: (level.Smelter * 0.005 * autoParagonBonus 
				+ (upgrades.Geodesy && workers.geologist * workerEfficiency * (0.004 + (upgrades.MiningDrill && 0.0025) + (upgrades.UnobtainiumDrill && 0.0025)) * paragonBonus)) * magnetoBonus * reactorBonus * faithBonus
					- level.Mint * 0.025,
		oil: (level.OilWell * 0.1 * (1 + (upgrades.Pumpjack && 0.45) + (upgrades.OilRefinery && 0.35) + (upgrades.OilDistillation && 0.75)) + (upgrades.BiofuelProcessing && level.BioLab * 0.02 * (1 + (upgrades.GMCatnip && 0.25)))) * paragonBonus * reactorBonus * faithBonus
					+ level.HydraulicFracturer * 2.5 * spaceRatio
					- level.Calciner * 0.12 - level.Magneto * 0.25,
		titanium: (level.Calciner * 0.0025 * (1 + (upgrades.Oxidation && 3) + (upgrades.RotaryKiln && 2.25) + (upgrades.FluidizedReactors && 3)) 
					+ (upgrades.NuclearSmelters && level.Smelter * 0.0075))
					* autoParagonBonus * magnetoBonus * reactorBonus * faithBonus
					- level.Accelerator * 0.075,
		science: workers.scholar * 0.18 * workerEfficiency * (1 + scienceBonus) * paragonBonus * faithBonus + astroChance * (30 * scienceBonus),
		culture: (level.Amphitheatre * 0.025 + level.Temple * (0.25 + (level.StainedGlass && 0.25 + level.StainedGlass * 0.5) + (level.Basilica && 0.75 + level.Basilica * 0.25)) + level.Chapel * 0.25 + level.BroadcastTower * 5 * energyBonus) * paragonBonus * faithBonus,
		faith: (level.Temple * 0.0075 + level.Chapel * 0.025 + workers.priest * workerEfficiency * 0.0075) * (1 + level.SolarChant * 0.1) * paragonBonus * faithBonus,
		fur: level.Mint * 0.0004375 * maxCatpower  - (luxury.fur && kittens * 0.05) * hyperbolicDecrease(level.TradePost * 0.04),
		ivory: level.Mint * 0.000105 * maxCatpower - (luxury.ivory && kittens * 0.035) * hyperbolicDecrease(level.TradePost * 0.04),
		unicorn: level.UnicornPasture * 0.005 * (1 + unicornRatioReligion + (upgrades.UnicornSelection && 0.25)) * paragonBonus * faithBonus
					+ level.IvoryTower * 0.00025 * 500 * (1 + unicornRatioReligion * 0.1) 
					+ (luxury.unicorn && 1e-6), // add some unicorns so the building shows up
		manuscript: level.Steamworks * ((upgrades.PrintingPress && 0.0025) + (upgrades.OffsetPress && 0.0075) + (upgrades.Photolithography && 0.0225)),
		starchart: astroChance * 1 
					+ level.Satellite * 0.005 * (1 + (upgrades.HubbleSpaceTelescope && 0.3)) * spaceRatio * paragonBonus
					+ (upgrades.AstroPhysicists && workers.scholar * 0.0005 * workerEfficiency * paragonBonus * faithBonus),
		uranium: level.Accelerator * 0.0125 * autoParagonBonus * magnetoBonus * faithBonus
					+ level.PlanetCracker * 1.5 * spaceRatioUranium
					- level.Reactor * 0.005 * (1 - (upgrades.EnrichedUranium && 0.25))
					- level.LunarOutpost * 1.75,
		unobtainium: level.LunarOutpost * 0.035 * spaceRatio,
	}
}

function production(state: GameState): {[R in Res]: number} {
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

	const barnRatio = (upgrades.ExpandedBarns && 0.75) + (upgrades.ReinforcedBarns && 0.80) + (upgrades.TitaniumBarns && 1.00) + (upgrades.AlloyBarns && 1.00) + (upgrades.ConcreteBarns && 0.75) + (upgrades.ConcretePillars && 0.05);
	const warehouseRatio = 1 + (upgrades.ReinforcedWarehouses && 0.25) + (upgrades.TitaniumWarehouses && 0.50) + (upgrades.AlloyWarehouses && 0.45) + (upgrades.ConcreteWarehouses && 0.35) + (upgrades.ConcretePillars && 0.05);
	const harborRatio = 1 + (upgrades.ExpandedCargo && hyperbolicLimit(ships * 0.01, 2.25 + (upgrades.ReactorVessel && level.Reactor * 0.05)));
	const acceleratorRatio = 0 + (upgrades.EnergyRifts && 1);
	const paragonBonus = 1 + state.paragon * 0.001;
	return {
		catnip: ((5000 + level.Barn * 5000 + (upgrades.Silos && level.Warehouse * 750) + level.Harbor * harborRatio * 2500) * (1 + (upgrades.Silos && barnRatio * 0.25)) 
				+  level.Accelerator * acceleratorRatio * 30000 + level.MoonBase * 45000) * paragonBonus * (1 + (upgrades.Refrigeration && 0.75)),
		wood: ((200 + level.Barn * 200 + level.Warehouse * 150 + level.Harbor * harborRatio * 700) * (1 + barnRatio) * warehouseRatio + level.Accelerator * acceleratorRatio * 20000 + level.MoonBase * 25000) * paragonBonus,
		minerals: ((250 + level.Barn * 250 + level.Warehouse * 200 + level.Harbor * harborRatio * 950) * (1 + barnRatio) * warehouseRatio + level.Accelerator * acceleratorRatio * 25000 + level.MoonBase * 30000) * paragonBonus,
		iron: ((level.Barn * 50 + level.Warehouse * 25 + level.Harbor * harborRatio * 150) * (1 + barnRatio) * warehouseRatio + level.Accelerator * acceleratorRatio * 7500 + level.MoonBase * 9000) * paragonBonus,
		titanium: ((level.Barn * 2 + level.Warehouse * 10 + level.Harbor * harborRatio * 50) * warehouseRatio + level.Accelerator * acceleratorRatio * 750 + level.MoonBase * 1250) * paragonBonus,
		uranium: (250 + level.Reactor * 250 + level.MoonBase * 1750) * paragonBonus,
		unobtainium: (150 + level.MoonBase * 150) * paragonBonus,
		coal: 0,
		oil: (level.OilWell * 1500 + level.MoonBase * 3500) * paragonBonus,
		gold: ((level.Barn * 10 + level.Warehouse * 5 + level.Harbor * harborRatio * 25 + level.Mint * 100) * warehouseRatio + level.Accelerator * acceleratorRatio * 250) * paragonBonus,
		catpower: 1e9, // I never hit the limit, so this should be ok
		science: 1e9, // TODO rework if technologies are tracked too
		culture: 1e9, // I never hit the limit, so this should be ok  (Ziggurats would boost this)
		faith: (100 + level.Temple * (100 + level.SunAltar * 50)) * (1 + (level.GoldenSpire && 0.4 + level.GoldenSpire * 0.1)) * paragonBonus,
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
	constructor(public product: ConvertedRes, resourceInvestment: Cart, productPrice?: number) {
		super();
		let cost = 0;
		let benefit = 0;
		for (const res in resourceInvestment) {
			const number = resourceInvestment[res]
			this.investment.add(new Expediture(number, <Res>res));
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
		price[this.product] = productPrice || Math.max(0, (cost * (state.priceMarkup[product] || 1) - benefit) / currentlyProduced[this.product]);
		this.return.add(new Expediture(currentlyProduced[this.product], this.product));
	}

	abstract produced(state: GameState): Cart;
}

class Smelting extends Conversion {
	constructor(ironPrice: number) {
		super("iron", {}, ironPrice);
		this.instanteneous = false;
	}

	produced(state: GameState) {
		return delta(basicProduction, s => s.level.Smelter++);
	}
}

class Hunt extends Conversion {
	constructor() {
		price.ivory = 0;
		super("fur", {catpower: 100});
	}

	produced(state: GameState){
		const {upgrades} = state;
		const huntingBonus = 0 + (upgrades.Bolas && 1) + (upgrades.HuntingArmor && 2) + (upgrades.SteelArmor && 0.5) + (upgrades.AlloyArmor && 0.5) + (upgrades.Nanosuits && 0.5);
		return {
			fur: 40 + huntingBonus * 32,
			ivory: (0.44 + huntingBonus * 0.02) * (25 + huntingBonus * 20),
		}
	}
}

abstract class Trade extends Conversion {
	static opportunityCosts: Cart = {gold: 15, catpower: 50};

	constructor(product: ConvertedRes, input: Cart) {
		super(product, Object.assign({}, Trade.opportunityCosts, input));
	}

	get friendly() {
		return 0;
	}
	get hostile() {
		return 0;
	}

	produced(state: GameState) {
		const {level, upgrades} = state;

		let output = this.output(state, 1 + level.TradePost * 0.015);

		const standingRatio = level.TradePost * 0.0035 + (upgrades.Diplomacy && 0.1);
		const friendlyChance = this.friendly && Math.max(1, this.friendly + standingRatio / 2);
		const hostileChance = this.hostile && Math.max(0, this.hostile - standingRatio);
		const expectedSuccess = 1 - hostileChance + friendlyChance * 0.25;

		for (const k in output) {
			output[k] *= expectedSuccess;
		}
		output["blueprint"] = expectedSuccess * 0.1 * 1;
		return output;
	}

	abstract output(state: GameState, tradeRatio: number): {[R in Res]?: number};
}

class ZebraTrade extends Trade {
	constructor() {
		super("titanium", {slab: 50});
	}

	// must be a getter to be available to the super constructor
	get hostile() {
		return 0.3;
	}

	output(state: GameState, tradeRatio: number) {
		const {ships} = state;

		const titaniumChance = Math.min(1, 0.15 + ships * 0.0035);
		const titaniumAmount = 1.5 + ships * 0.03;

		return {
			titanium: titaniumChance * titaniumAmount,
			plate: 0.65 * 2 * 1.05 * tradeRatio,
			iron: 1 * 300 * 1.00 * tradeRatio,
		}
	}
}

class DragonTrade extends Trade {
	constructor() {
		super("uranium", {titanium: 250});
	}

	output(state: GameState, tradeRatio: number) {
		return {
			uranium: 0.95 * 1 * tradeRatio,
		}
	}
}

class CraftingConversion extends Conversion {
	constructor(product: ConvertedRes, resourceInvestment: Cart) {
		super(product, resourceInvestment);
	}

	produced(state: GameState) {
		const {level, upgrades} = state;
		const produced: Cart = {};
		produced[this.product] = craftRatio(state)
													 + (this.product == "blueprint" && upgrades.CADsystem && 0.01 * (level.Library + level.Academy + level.Observatory + level.BioLab));
		return produced;
	}
}

class KeroseneConversion extends CraftingConversion {
	constructor() {
		super("kerosene", {oil: 7500});
	}

	produced(state: GameState) {
		const {level, upgrades} = state;
		const p = super.produced(state);
		p[this.product] *= 1 + level.Factory * (upgrades.FactoryProcessing && 0.05) * 0.75;
		return p;
	}
}

class UnicornSacrifice extends Conversion {
  constructor() {
		super("tear", {unicorn: 2500});
	}

	produced(state: GameState): Cart {
		return {
			tear: state.level.Ziggurat
		}
	}
}

function craftRatio(state: GameState) {
	const {level, upgrades} = state;
	return 1 + level.Workshop * 0.06 + level.Factory * (0.05 + (upgrades.FactoryLogistics && 0.01))
}

export abstract class Action extends CostBenefitAnalysis {
	roi: number;

	constructor(s: GameState, public name: string, resourceInvestment: Cart, resourceMultiplier = 1) {
		super();
		for (const res in resourceInvestment) {
			const number = resourceInvestment[res];
			this.investment.add(new Expediture(number * resourceMultiplier, <Res>res));
		}

		this.procureStorage(this.investment.expeditures, s);
	}

	assess() {
		const deltaProduction = delta(production, state => this.applyTo(state));
		for (const r of resourceNames) {
			if (deltaProduction[r]) {
				this.return.add(new Expediture(deltaProduction[r], r));
			}
		}

		this.roi = this.investment.cost / this.return.cost;
		if (this.return.cost < 0 || this.roi > 1e6) {
			this.roi = Infinity;
		}
		
		return this; // for chaining
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
					if (this.investment.expenses.length < 9) { // limit depth to save CPU time
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
			if (!["catnip", "wood", "titanium", "uranium"].includes(xp.res) && basicResourceNames.includes(<any>xp.res) && !currentBasicProduction[xp.res]) {
				return false;
			}
		}
		return true;
	}

	abstract applyTo(state: GameState): void;
	
	abstract undo(state: GameState): void;

	abstract stateInfo() : string;
}

const obsoletes: {[B in Building]?: Building} = {
	BroadcastTower: "Amphitheatre",
	HydroPlant: "Aqueduct",
	SolarFarm: "Pasture",
}
const obsoletedBy: {[B in Building]?: Building} = {
	Amphitheatre: "BroadcastTower",
	Aqueduct: "HydroPlant",
	Pasture: "SolarFarm",
}

class BuildingAction extends Action {

	constructor(name: Building, private initialConstructionResources: Cart, priceRatio: number, s = state, applyPriceReduction = true) {
		super(s, name, initialConstructionResources, Math.pow(BuildingAction.priceRatio(s, priceRatio, applyPriceReduction), s.level[name]));
	}

	static priceRatio(s: GameState, priceRatio: number, applyPriceReduction: boolean) {
		if (applyPriceReduction) {
			priceRatio = priceRatio - (s.upgrades.Engineering && 0.01) - (s.upgrades.GoldenRatio && (1+Math.sqrt(5))/2 * 0.01) - (s.upgrades.DivineProportion && 0.017);
		}
		return priceRatio;
	}

	available(state: GameState) {
		return super.available(state) && !this.obsolete(state);
	}

	obsolete(state: GameState) {
		const ob = obsoletedBy[this.name];
		return ob && state.level[ob];
	}

	stateInfo() {
		return state.level[this.name];
	}

	applyTo(state: GameState) {
		state.level[this.name]++;
		const o = obsoletes[this.name];
		if (o) {
			state.level[o] = 0;
		}
	}

	undo(state: GameState) {
		state.level[this.name]--;
	}
}

class SpaceAction extends BuildingAction {
	constructor(name: Building, initialConstructionResources: Cart, priceRatio: number, s = state) {
		if (initialConstructionResources.oil) {
			initialConstructionResources.oil *= 1 - s.level.SpaceElevator * 0.05;
		}
		super(name, initialConstructionResources, priceRatio, s, false);
	}
}

class ReligiousAction extends BuildingAction {
	constructor(name: Building, initialConstructionResources: Cart, s = state) {
		super(name, initialConstructionResources, 2.5, s, false);
	}

	available(state: GameState) {
		const {level, upgrades} = state;
		return super.available(state) && (level[this.name] == 0 || upgrades.Transcendence || state.showResearchedUpgrades);
	}
}

class ZigguratBuilding extends BuildingAction {
	constructor(name: Building, initialConstructionResources: Cart, priceRatio: number, s = state) {
		super(name, initialConstructionResources, priceRatio, s, false);
	}

	available(state: GameState) {
		return super.available(state) && state.level.Ziggurat > 0;
	}
}

class UpgradeAction extends Action {
	constructor(name: Upgrade, resourceCost: Cart, s = state) {
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

class MetaphysicAction extends UpgradeAction {
	constructor(name: Upgrade, private paragonCost: number, s = state) {
		super(name, {}, s);
	}

	available(state: GameState) {
		return true;
	}

	applyTo(state: GameState) {
		super.applyTo(state);
		state.paragon -= this.paragonCost;
	}

	undo(state: GameState) {
		super.undo(state);
		state.paragon += this.paragonCost;
	}
}

class TradeshipAction extends Action {
	constructor(s = state) {
		super(s, "TradeShip", {scaffold: 100, plate: 150, starchart: 25});
	}

	applyTo(state: GameState) {
		state.ships += craftRatio(state);
	}
	undo(state: GameState) {
		state.ships -= craftRatio(state);
	}
	stateInfo() {
		return "";
	}
}

class PraiseAction extends Action {
	constructor() {
		super(state, "PraiseTheSun", {faith: 1000});
	}

	applyTo(state: GameState) {
		state.faith.stored += 1000 * (1 + state.faith.apocryphaBonus * 0.01);
	}

	undo(state: GameState) {
		state.faith.stored -= 1000 * (1 + state.faith.apocryphaBonus * 0.01);
	}
	stateInfo() {
		return "";
	}
}

function updateActions() {
	const {upgrades} = state;
	actions = [
		new BuildingAction("CatnipField", {catnip: 10}, 1.12),
		new BuildingAction("Pasture", {catnip: 100, wood: 10}, 1.15),
		new BuildingAction("SolarFarm", {titanium: 250}, 1.15),
		new BuildingAction("Aqueduct", {minerals: 75}, 1.12),
		new BuildingAction("HydroPlant", {concrete: 100, titanium: 2500}, 1.15),
		new BuildingAction("Hut", {wood: 5}, 2.5 - (upgrades.IronWoodHuts && 0.5) - (upgrades.ConcreteHuts && 0.3) - (upgrades.UnobtainiumHuts && 0.25)),
		new BuildingAction("LogHouse", {wood: 200, minerals: 250}, 1.15),
		new BuildingAction("Mansion", {slab: 185, steel: 75, titanium: 25}, 1.15),
		new BuildingAction("Library", {wood: 25}, 1.15),
		new BuildingAction("Academy", {wood: 50, minerals: 70, science: 100}, 1.15),
		new BuildingAction("Observatory", {scaffold: 50, slab: 35, iron: 750, science: 1000}, 1.10),
		new BuildingAction("BioLab", {slab: 100, alloy: 25, science: 1500}, 1.10),
		new BuildingAction("Mine", {wood: 100}, 1.15),
		new BuildingAction("Quarry", {scaffold: 50, steel: 125, slab:1000}, 1.15),
		new BuildingAction("LumberMill", {wood: 100, iron: 50, minerals: 250}, 1.15),
		new BuildingAction("OilWell", {steel: 50, gear: 25, scaffold: 25}, 1.15),
		new BuildingAction("Accelerator", {titanium: 7500, concrete: 125, uranium: 25}, 1.15),
		new BuildingAction("Steamworks", {steel: 65, gear: 20, blueprint: 1}, 1.25),
		new BuildingAction("Magneto", {alloy: 10, gear: 5, blueprint: 1}, 1.25),
		new BuildingAction("Smelter", {minerals: 200}, 1.15),
		new BuildingAction("Calciner", {steel: 100, titanium: 15, blueprint: 5, oil: 500}, 1.15),
		new BuildingAction("Factory", {titanium: 2000, plate: 2500, concrete: 15}, 1.15),
		new BuildingAction("Reactor", {titanium: 3500, plate: 5000, concrete: 50, blueprint: 25}, 1.15),
		new BuildingAction("Amphitheatre", {wood: 200, minerals: 1200, parchment: 3}, 1.15),
		new BuildingAction("BroadcastTower", {iron: 1250, titanium: 75}, 1.18),
		new BuildingAction("Chapel", {minerals: 2000, culture: 250, parchment: 250}, 1.15),
		new BuildingAction("Temple", {slab: 25, plate: 15, manuscript: 10, gold: 50}, 1.15), 
		new BuildingAction("Workshop", {wood: 100, minerals: 400}, 1.15),
		new BuildingAction("TradePost", {wood: 500, minerals: 200, gold: 10}, 1.15),
		new BuildingAction("Mint", {minerals: 5000, plate: 200, gold: 500}, 1.15),
		new BuildingAction("UnicornPasture", {unicorn: 2}, 1.75),
		new BuildingAction("Ziggurat", {megalith: 50, scaffold: 50, blueprint: 1}, 1.25),

		new SpaceAction("SpaceElevator", {titanium: 6000, science: 100000, unobtainium: 50}, 1.15),
		new SpaceAction("Satellite", {starchart: 325, titanium: 2500, science: 100000, oil: 15000}, 1.08),
		new SpaceAction("SpaceStation", {starchart: 425, alloy: 750, science: 150000, oil: 35000}, 1.12),
		new SpaceAction("LunarOutpost", {starchart: 650, uranium: 500, alloy: 750, concrete: 150, science: 100000, oil: 55000}, 1.12),
		new SpaceAction("PlanetCracker", {starchart: 2500, alloy: 1750, science: 125000, kerosene: 50}, 1.18),
		new SpaceAction("HydraulicFracturer", {starchart: 750, alloy: 1025, science: 150000, kerosene: 100}, 1.18),

		new UpgradeAction("MineralHoes", {science: 100, minerals: 275}),
		new UpgradeAction("IronHoes", {science: 200, iron: 25}),
		new UpgradeAction("MineralAxe", {science: 100, minerals: 500}),
		new UpgradeAction("IronAxe", {science: 200, iron: 50}),
		new UpgradeAction("SteelAxe", {science: 20000, steel: 75}),
		new UpgradeAction("ReinforcedSaw", {science: 2500, iron: 1000}),
		new UpgradeAction("SteelSaw", {science: 52000, steel: 750}),
		new UpgradeAction("AlloySaw", {science: 85000, alloy: 75}),
		new UpgradeAction("TitaniumSaw", {science: 75000, titanium: 500}),
		new UpgradeAction("TitaniumAxe", {science: 38000, titanium: 10}),
		new UpgradeAction("AlloyAxe", {science: 70000, alloy: 25}),
		new UpgradeAction("PhotovoltaicCells", {titanium: 5000, science: 75000}), 
		new UpgradeAction("SolarSatellites", {alloy: 750, science: 225000}),
		new UpgradeAction("IronWoodHuts", {science: 30000, wood: 15000, iron: 3000}),
		new UpgradeAction("ConcreteHuts", {science: 125000, concrete: 45, titanium: 3000}),
		new UpgradeAction("UnobtainiumHuts", {science: 200000, unobtainium: 350, titanium: 15000}),
		new UpgradeAction("CompositeBow", {science: 500, iron: 100, wood: 200}),
		new UpgradeAction("Crossbow", {science: 12000, iron: 1500}),
		new UpgradeAction("Railgun", {science: 150000, titanium: 5000, blueprint: 25}),
		new UpgradeAction("Bolas", {science: 1000, minerals: 250, wood: 50}),
		new UpgradeAction("HuntingArmor", {science: 2000, iron: 750}),
		new UpgradeAction("SteelArmor", {science: 10000, steel: 50}),
		new UpgradeAction("AlloyArmor", {science: 50000, alloy: 25}),
		new UpgradeAction("Nanosuits", {science: 185000, alloy: 250}),
		new UpgradeAction("Geodesy", {titanium: 250, starchart: 500, science: 90000}),
		new UpgradeAction("MiningDrill", {titanium: 1750, steel: 750, science: 100000}),
		new UpgradeAction("UnobtainiumDrill", {unobtainium: 250, alloy: 1250, science: 250000}),
		new UpgradeAction("CoalFurnace", {minerals: 5000, iron: 2000, beam: 35, science: 5000}),
		new UpgradeAction("DeepMining", {iron: 1200, beam: 50, science: 5000}),
		new UpgradeAction("Pyrolysis", {compendium: 5, science: 35000}),
		new UpgradeAction("ElectrolyticSmelting", {titanium: 2000, science: 100000}),
		new UpgradeAction("Oxidation", {steel: 5000, science: 100000}),
		new UpgradeAction("RotaryKiln", {titanium: 5000, gear: 500, science: 145000}),
		new UpgradeAction("FluidizedReactors", {alloy: 200, science: 175000}),
		new UpgradeAction("NuclearSmelters", {uranium: 250, science: 165000}),
		new UpgradeAction("PrintingPress", {gear: 45, science: 7500}),
		new UpgradeAction("OffsetPress", {gear: 250, oil: 15000, science: 100000}),
		new UpgradeAction("Photolithography", {alloy: 1250, oil: 50000, uranium: 250, science: 250000}),
		new UpgradeAction("HighPressureEngine", {gear: 25, science: 20000, blueprint: 5}),
		new UpgradeAction("FuelInjectors", {gear: 250, oil: 20000, science: 100000}),
		new UpgradeAction("FactoryLogistics", {gear: 250, titanium: 2000, science: 100000}),
		new UpgradeAction("SpaceManufacturing", {titanium: 125000, science: 250000}),
		new UpgradeAction("Astrolabe", {titanium: 5, starchart: 75, science: 25000}),
		new UpgradeAction("TitaniumReflectors", {titanium: 15, starchart: 20, science: 20000}), // effect not calculated (science storage)
		new UpgradeAction("UnobtainiumReflectors", {unobtainium: 75, starchart: 750, science: 250000}), // effect not calculated (science storage)
		new UpgradeAction("HydroPlantTurbines", {unobtainium: 125, science: 250000}),
		new UpgradeAction("Pumpjack", {titanium: 250, gear: 125, science: 100000}),
		new UpgradeAction("BiofuelProcessing", {titanium: 1250, science: 150000}),
		new UpgradeAction("UnicornSelection", {titanium: 1500, science: 175000}),
		new UpgradeAction("GMCatnip", {titanium: 1500, catnip: 1000000, science: 175000}),
		new UpgradeAction("CADsystem", {titanium: 750, science: 125000}),
		new UpgradeAction("SETI", {titanium: 250, science: 125000}),
		new UpgradeAction("Logistics", {gear: 100, scaffold: 1000, science: 100000}),
		new UpgradeAction("Augmentations", {titanium: 5000, uranium: 50, science: 150000}),
		new UpgradeAction("EnrichedUranium", {titanium: 7500, uranium: 150, science: 175000}),
		new UpgradeAction("ColdFusion", {eludium: 25, science: 200000}),
		new UpgradeAction("OilRefinery", {titanium: 1250, gear: 500, science: 125000}),
		new UpgradeAction("HubbleSpaceTelescope", {alloy: 1250, oil: 50000, science: 250000}),
		new UpgradeAction("AstroPhysicists", {unobtainium: 350, science: 250000}),
		new UpgradeAction("OilDistillation", {titanium: 5000, science: 175000}),
		new UpgradeAction("FactoryProcessing", {titanium: 7500, concrete: 125, science: 195000}),
		// new UpgradeAction("Telecommunication", {titanium: 5000, uranium: 50, science: 150000}), // effect not calculated (increases learn ratio)
		new UpgradeAction("RoboticAssistance", {steel: 10000, gear: 250, science: 100000}),

		new ReligiousAction("SolarChant", {faith: 100}),
		// new ReligiousAction("Scholasticism", {faith: 250}), // effect not calculated (increases science storage)
		new ReligiousAction("SunAltar", {faith: 500, gold: 250}),
		new ReligiousAction("StainedGlass", {faith: 500, gold: 250}),
		new ReligiousAction("Basilica", {faith: 1250, gold: 750}), // effect on culture storage not calculated
		new ReligiousAction("Templars", {faith: 3500, gold: 3000}),
		new UpgradeAction("SolarRevolution", {faith: 750, gold: 500}),
		new UpgradeAction("Transcendence", {faith: 7500, gold: 7500}),

		new ZigguratBuilding("UnicornTomb", {ivory: 500, tear: 5}, 1.15),
		new ZigguratBuilding("IvoryTower", {ivory: 25000, tear: 25}, 1.15),
		new ZigguratBuilding("IvoryCitadel", {ivory: 50000, tear: 50}, 1.15), // effect on ivory meteors not calculated

		new TradeshipAction(),
		new PraiseAction(),
	];
	actions = actions.filter(a => a.available(state)).map(a => a.assess());
	actions.sort((a,b) => a.roi - b.roi);
}

function storageActions(state: GameState) {
	return [
		new BuildingAction("Barn", {wood: 50}, 1.75, state),
		new BuildingAction("Warehouse", {beam: 1.5, slab: 2}, 1.15, state),
		new BuildingAction("Harbor", {scaffold: 5, slab: 50, plate: 75}, 1.15, state),

		new SpaceAction("MoonBase", {starchart: 700, titanium: 9500, concrete: 250, science: 100000, unobtainium: 50, oil: 70000}, 1.12, state),

		new UpgradeAction("ExpandedBarns", {science: 500, wood: 1000, minerals: 750, iron: 50}, state),
		new UpgradeAction("ReinforcedBarns", {science: 800, beam: 25, slab: 10, iron: 100}, state),
		new UpgradeAction("ReinforcedWarehouses", {science: 15000, plate: 50, steel: 50, scaffold: 25}, state),
		new UpgradeAction("Silos", {science: 50000, steel: 125, blueprint: 5}, state),
		// LHC would give science storage
		new UpgradeAction("ExpandedCargo", {science: 55000, blueprint: 15}, state),
		new UpgradeAction("ReactorVessel", {science: 135000, titanium: 5000, uranium: 125}, state),
		new UpgradeAction("TitaniumBarns", {science: 60000, titanium: 25, steel: 200, scaffold: 250}, state),
		new UpgradeAction("AlloyBarns", {science: 75000, alloy: 20, plate: 750}, state),
		new UpgradeAction("ConcreteBarns", {science: 100000, concrete: 45, titanium: 2000}, state),
		new UpgradeAction("TitaniumWarehouses", {science: 70000, titanium: 50, steel: 500, scaffold: 500}, state),
		new UpgradeAction("AlloyWarehouses", {science: 90000, titanium: 750, alloy: 50}, state),
		new UpgradeAction("ConcreteWarehouses", {science: 100000, titanium: 1250, concrete: 35}, state),
		new UpgradeAction("EnergyRifts", {science: 200000, titanium: 7500, uranium: 250}),
		new UpgradeAction("Refrigeration", {science: 125000, titanium: 2500, blueprint: 15}, state),
		new UpgradeAction("ConcretePillars", {science: 100000, concrete: 50}, state),

		new ReligiousAction("GoldenSpire", {faith: 350, gold: 150}),
	].filter(a => a.available(state)).map(a => a.assess());
}

function metaphysicActions() {
	return [
		new MetaphysicAction("Engineering", 5),
		new MetaphysicAction("Diplomacy", 5),
		new MetaphysicAction("GoldenRatio", 50),
		new MetaphysicAction("DivineProportion", 100),
	].filter(a => a.available(state)).map(a => a.assess());
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
	currentBasicProduction = basicProduction(state);
	updateActions();

	return {
		production: production(state), 
		price, 
		conversions,
		actions, 
		storageActions: storageActions(state), 
		metaphysicActions: metaphysicActions(),
		furReport: new FurConsumptionReport(state),
	};
}