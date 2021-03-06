import { state, Res, Building, Job, GameState, GameStateUpdate, resourceNames, Upgrade, ConvertedRes, BasicRes, Science, activatableBuildingNames, buildingNames, Metaphysic, replaceGameState } from "./game-state";
import { apply } from "./game-state-changer";

let currentBasicProduction: Cart;
let price: {[R in Res]: number};
let conversions: Conversion[];
let actions: Action[];
let sciences: ScienceInfo[];
let prerequisite: {[A in string]: ScienceInfo[]};

function updateEconomy() {
	const {priceMarkup} = state;
	const wage = 1;
	const goldPrice = 10 * priceMarkup.gold;
	const basicPrice : {[R in BasicRes]: number} = {
		catnip: wage / workerProduction("farmer", "catnip"),
		wood: wage / workerProduction("woodcutter", "wood"),
		minerals: wage / workerProduction("miner", "minerals"),
		iron: undefined, // assigned below
		titanium: undefined, // assigned below
		uranium: 100 * priceMarkup.uranium, // not derived from dragon trade, because uranium is usually obtained from them only very briefly
		unobtainium: 1000 * priceMarkup.unobtainium,
		coal: Math.max(0, wage - goldPrice * workerProduction("geologist", "gold")) / workerProduction("geologist", "coal") * priceMarkup.coal,
		gold: goldPrice,
		oil: 5 * priceMarkup.oil,
		catpower: wage / workerProduction("hunter", "catpower"),
		science: wage / workerProduction("scholar", "science"),
		culture: priceMarkup.culture, 
		faith: wage / workerProduction("priest", "faith") * priceMarkup.faith,
		unicorn: priceMarkup.unicorn,
		alicorn: 20000 * priceMarkup.alicorn,
		necrocorn: 20000 * priceMarkup.alicorn + 30000 * priceMarkup.necrocorn,
		antimatter: 5000 * priceMarkup.antimatter,
	};
	price = <any>basicPrice;
	price.iron = ironPrice(state, basicPrice),
	price.starchart = 1000 * priceMarkup.starchart;

	conversions = [
		// in resource flow order, so conversion production can be calculated in a single pass
		// (this is, for each resource, the conversion that uses is primarily should appear last 
		// among all conversions affecting that resource. This ensures that 100% conversionProportion 
		// consumes everything)
		new CraftingConversion("slab", {minerals: 250}),
		new LeviathanTrade(),
		new DragonTrade(), 
		new ZebraTrade(),
		new Hunt(),
		new CraftingConversion("parchment", {fur: 175}),
		new CraftingConversion("manuscript", {parchment: 25, culture: 400}),
		new CraftingConversion("compendium", {manuscript: 50, science: 10000}),
		new CraftingConversion("blueprint", {compendium: 25, science: 25000}),
		new CraftingConversion("beam", {wood: 175}),
		new CraftingConversion("steel", {coal: 100, iron: 100}),
		new CraftingConversion("plate", {iron: 125}),
		new CraftingConversion("megalith", {slab: 50, beam: 25, plate: 5}),
		new CraftingConversion("scaffold", {beam: 50}),
		new CraftingConversion("concrete", {slab: 2500, steel: 25}),
		new CraftingConversion("alloy", {steel: 75, titanium: 10}),
		new CraftingConversion("gear", {steel: 15}),
		new CraftingConversion("eludium", {unobtainium: 1000, alloy: 2500}),
		new KeroseneConversion(),
		new UnicornSacrifice(),
		new AlicornSacrifice(),
		new RefineTears(),
		new Smelting(), // only for display purposes (price is set previously)
	];

	const priceInitializer = {} as {[R in ConvertedRes]: Conversion};
	for (const conv of conversions) {
		priceInitializer[conv.product] = conv;
	}

	const priceProvider = (res: Res) => {
		if (price[res] === undefined) {
			priceInitializer[res].init(priceProvider);
		}
		return price[res];
	}
	
	for (const c of conversions) {
		c.init(priceProvider);
	}
}

function workerProduction(job: Job, res: Res) {
	return delta(basicProduction, {
		workers: {
			[job]: state.workers[job] + 1,
		},
		extraKittens: 1,
	})[res];
}

function ironPrice(state: GameState, price: {[R in BasicRes]: number}) {
	/*
		It is quite hard to find a way to price iron that appropriate for all stages of the game: 

		Early on, iron comes from smelters, so we should determine iron price based on that.
		Later though, smelters also produce coal, gold, and titanium. 
		
		How do we deal with that?
		
		We could simply ignore the value of the other outputs, but as they can be very valuable
		at times (for instance: gold rally in early titanium age), iron price would be significantly
		overestimated.

		We could subtract the value of other outputs when setting the iron price, but their high
		volatility would destabilize the iron price and require frequent player intervention.
		Such hidden coupling among prices would also be hard to understand for players
		(even I would be surprised that lowering blueprint prices massively reduces my iron price
		due to increased titanium prices ...). Also, it would create a mutual dependency between 
		iron and titanium prices (smelters also produce titanium, trading for titanium also produces 
		iron), which the current pricing algorithm can not resolve.

		Instead, we use a hybrid model, where large markup uses the full input costs, but small markup
		also reduces input costs.
	*/

	const smelter = delta(basicProduction, {level: {Smelter: state.level.Smelter + 1}});
	const inputCost = -smelter.wood * price.wood - smelter.minerals * price.minerals;
	const m = state.priceMarkup.iron;
	const c = 0.01;
	const cost = m < c ? inputCost * m/c : inputCost + m;
	return cost / smelter.iron;
}

type Cart = {[R in Res]?: number};

function delta(metric: (state: GameState) => Cart, change: GameStateUpdate): Cart {
	const original = metric(state);	
	const undo = apply(state, change);
	try {
		const modified = metric(state);

		const delta = {};
		for (let r in original) {
			delta[r] = modified[r] - original[r];
		}
		return delta;
	} finally {
		undo();
	}
}

function hardLimit(min: number, x: number, max: number) {
	return x < min ? min
			 : x > max ? max
			 : x;
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

function invertTriValue(triValue: number, stripe: number) {
	return ((triValue * 2 + 1) ** 2 - 1) / 8 * stripe;
}

/** multiplier to production caused by solar revolution */
export function solarRevolutionProductionBonus(state: GameState) {
	return 1 + (state.upgrades.SolarRevolution && hyperbolicLimit(triValue(state.faith.stored, 1000), 1000) * 0.01);
}

// called GetTranscendenceRatio in kittens game source code
function transcendenceRatio(level: number) {
  return (Math.pow(Math.exp(level)/5+1,2)-1)/80; 
} 

export function praiseBonus(state: GameState) {
	const {faith} = state;

	return triValue(faith.apocryphaPoints, 0.1) * 0.1;
}

export function setPraiseBonus(praiseBonus: number, state: GameState) {	
	state.faith.apocryphaPoints = invertTriValue(praiseBonus / 0.1, 0.1);
}

export function faithReset(state: GameState, undo?: boolean) {
	const {faith} = state;

	const newlyStored = undo ? faith.previouslyStored : 0;
	faith.previouslyStored = faith.stored;
	faith.stored = newlyStored;

	const converted = faith.previouslyStored - faith.stored;
	faith.apocryphaPoints += 1.01 * (1 + faith.transcendenceLevel)**2 * converted * 1E-6;
}

export function transcend(state: GameState, times: number) {
	const {faith} = state;

	const oldLevel = faith.transcendenceLevel;
	const newLevel = oldLevel + times;
	const cost = transcendenceRatio(newLevel) - transcendenceRatio(oldLevel);
	
	faith.transcendenceLevel = newLevel;
	faith.apocryphaPoints -= cost;
}

function countKittens(state: GameState) {
	const {level} = state;
	return level.Hut * 2 + level.LogHouse * 1 + level.Mansion * 1 + level.SpaceStation * 2 + level.TerraformingStation * 1;
}

export function reset(state: GameState) {
	faithReset(state);
	// TODO: update karma
	state.paragon += Math.max(0, countKittens(state) - 70);

	const {metaphysic, faith, karma, paragon} = state;
	const {apocryphaPoints, transcendenceLevel} = faith;
	replaceGameState({
		metaphysic,
		faith: {
			apocryphaPoints,
			transcendenceLevel,
		},
		karma,
		paragon,
	});
}

function activeLevel(state: GameState) {
	const {level, active} = state;
	const al = <{[B in Building]: number}> {};
	for (const b of buildingNames) {
		al[b] = active[b] === false ? 0 : level[b]; // active is undefined for buildings that are always active
	}
	return al;
}

function basicProduction(state: GameState): Cart {
	// production is per second real time (neither per tick, nor per day)
	const day = 2; // seconds
	const year = 400 * day;

	const {upgrades, metaphysic, workers, luxury} = state;
	const level = activeLevel(state);

	const kittens = countKittens(state);
	const unhappiness = 0.02 * Math.max(kittens - 5, 0) * hyperbolicDecrease(level.Amphitheatre * 0.048 + level.BroadcastTower * 0.75);
	const happiness = 1 + (luxury.fur && 0.1) + (luxury.ivory && 0.1) + (luxury.unicorn && 0.1) + (luxury.alicorn && 0.1) + (state.karma && 0.1 + state.karma * 0.01) 
									+ (level.SunAltar && level.Temple * (0.004 + level.SunAltar * 0.001)) - unhappiness;
	const workerProficiency = 1 + 0.1875 * kittens / (kittens + 50) * (1 + (upgrades.Logistics && 0.15) + (upgrades.Augmentations && 1));  // approximation: the more kittens, the older the average kitten (assuming no deaths)
	const workerEfficiency = happiness * workerProficiency;

	let idle = kittens;
	for (let j in workers) {
		idle -= workers[j];
	}
	workers.farmer += idle + state.extraKittens; // so additional kittens are known to contribute production

	const faithBonus = solarRevolutionProductionBonus(state);
	const paragonBonus = 1 + 0.01 * hyperbolicLimit(state.paragon, 200);
	const autoParagonBonus = 1 + 0.0005 * hyperbolicLimit(state.paragon, 200);

	const scienceBonus = level.Library * 0.1 
											+ level.DataCenter * 0.1
											+ level.Academy * 0.2 
											+ level.Observatory * 0.25 * (1 + level.Satellite * 0.05) 
											+ level.BioLab * (0.35 + (upgrades.BiofuelProcessing && 0.35))
											+ level.SpaceStation * 0.5;
	const astroChance = ((level.Library && 0.25) + level.Observatory * 0.2) * (1 + (metaphysic.Chronomancy && 0.1)) * (metaphysic.Astromancy ? 2 : 1) * 0.005 * Math.min(1, upgrades.SETI ? 1 : level.Observatory * 0.01 * (metaphysic.Astromancy ? 2 : 1));
	const maxCatpower = (level.Hut * 75 + level.LogHouse * 50 + level.Mansion * 50 + level.Temple * (level.Templars && 50 + level.Templars * 25)) * (1 + state.paragon * 0.001);

	const energyProduction = level.Steamworks * 1 
											+ level.Magneto * 5 
											+ level.HydroPlant * 5 * (1 + (upgrades.HydroPlantTurbines && 0.15))
											+ level.Reactor * (10 + (upgrades.ColdFusion && 2.5)) 
											+ level.SolarFarm * 2 * (1 + (upgrades.PhotovoltaicCells && 0.5)) * 0.75 /* assume worst season */ * (1 + (upgrades.ThinFilmCells && 0.15))
											+ (upgrades.SolarSatellites && level.Satellite * 1)
											+ level.Sunlifter * 30;
	const energyConsumption = level.Calciner * 1 
											+ level.Factory * 2 
											+ (upgrades.Pumpjack && level.OilWell * 1) 
											+ (upgrades.BiofuelProcessing && level.BioLab * 1)
											+ (level.DataCenter * (upgrades.Cryocomputing ? 1 : 2))
											+ (!upgrades.SolarSatellites && level.Satellite * 1)
											+ level.Accelerator * 2
											+ level.SpaceStation * 10
											+ level.LunarOutpost * 5
											+ level.MoonBase * (upgrades.AntimatterBases ? 5 : 10)
											+ level.OrbitalArray * 20
											+ level.ContainmentChamber * 50 * (1 + level.HeatSink * 0.01);

	const energyRatio = (energyProduction / energyConsumption) || 1;
	const energyBonus = hardLimit(1, energyRatio, 1.75);
	const energyDelta = hardLimit(0.25, energyRatio, 1); // TODO energy challenge reward 

	const magnetoBonus = 1 + level.Magneto * 0.02 * (1 + level.Steamworks * 0.15) * energyDelta;
	const reactorBonus = 1 + level.Reactor * 0.05 * energyDelta;

	const spaceRatioUranium = (1 + level.SpaceElevator * 0.01 + level.OrbitalArray * 0.02) // for some reason, space manuf. does not apply to uranium
	const spaceRatio = spaceRatioUranium * (1 + (upgrades.SpaceManufacturing && level.Factory * (0.05 + (upgrades.FactoryLogistics && 0.01)) * 0.75)) * energyDelta; 
	const prodTransferBonus = level.SpaceElevator * 0.001;
	const spaceParagonRatio = autoParagonBonus * magnetoBonus * reactorBonus * faithBonus;
	const spaceAutoprodRatio = spaceRatio * (1 + (spaceParagonRatio - 1) * prodTransferBonus);

	const unicornRatioReligion = level.UnicornTomb * 0.05 + level.IvoryTower * 0.1 + level.IvoryCitadel * 0.25 + level.SkyPalace * 0.5 + level.UnicornUtopia * 2.5 + level.SunSpire * 5;

	return {
		catnip: (level.CatnipField * 0.63 * (1.5 + 1 + 1 + 0.25) / 4
				    + workers.farmer * workerEfficiency * 5 * (1 + (upgrades.MineralHoes && 0.5) + (upgrades.IronHoes && 0.3))
					) * (1 + level.Aqueduct * 0.03 + level.Hydroponics * 0.025) * paragonBonus * faithBonus
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
		oil: level.OilWell * 0.1 * (1 + (upgrades.Pumpjack && 0.45) + (upgrades.OilRefinery && 0.35) + (upgrades.OilDistillation && 0.75)) * paragonBonus * reactorBonus * faithBonus
					+ (upgrades.BiofuelProcessing && level.BioLab * 0.1 * (1 + (upgrades.GMCatnip && 0.6)))
					+ level.HydraulicFracturer * 2.5 * spaceAutoprodRatio
					- level.Calciner * 0.12 - level.Magneto * 0.25,
		titanium: (level.Calciner * 0.0025 * (1 + (upgrades.Oxidation && 3) + (upgrades.RotaryKiln && 2.25) + (upgrades.FluidizedReactors && 3)) 
					+ (upgrades.NuclearSmelters && level.Smelter * 0.0075))
					* autoParagonBonus * magnetoBonus * reactorBonus * faithBonus
					- level.Accelerator * 0.075,
		science: workers.scholar * 0.18 * workerEfficiency * (1 + scienceBonus) * paragonBonus * faithBonus + astroChance * (30 * scienceBonus),
		culture: (level.Amphitheatre * 0.025 + level.Temple * (0.5 + level.StainedGlass * 0.25 + (level.Basilica && 0.75 + level.Basilica * 0.25)) + level.Chapel * 0.25 + level.BroadcastTower * 5 * energyBonus) * paragonBonus * faithBonus,
		faith: (level.Temple * 0.0075 + level.Chapel * 0.025 + workers.priest * workerEfficiency * 0.0075) * (1 + level.SolarChant * 0.1) * paragonBonus * faithBonus,
		fur: level.Mint * 0.0004375 * maxCatpower  - (luxury.fur && kittens * 0.05) * hyperbolicDecrease(level.TradePost * 0.04),
		ivory: level.Mint * 0.000105 * maxCatpower - (luxury.ivory && kittens * 0.035) * hyperbolicDecrease(level.TradePost * 0.04),
		unicorn: level.UnicornPasture * 0.005 * (1 + unicornRatioReligion + (upgrades.UnicornSelection && 0.25)) * paragonBonus * faithBonus
					+ level.IvoryTower * 0.00025 * 500 * (1 + unicornRatioReligion * 0.1) 
					+ (luxury.unicorn && 1e-6), // add some unicorns so the building shows up
		alicorn: (level.SkyPalace * 10 + level.UnicornUtopia * 15 + level.SunSpire * 30) / 100000 / day 
					+ (luxury.alicorn && level.SkyPalace * 0.0001 + level.UnicornUtopia * 0.000125 + level.SunSpire * 0.00025)
					- level.Marker * 0.000005, // we assume no necrocorns yet - if you already have some the corruption will be slower
		necrocorn: level.Marker * 0.000005, // likewise
		manuscript: level.Steamworks * ((upgrades.PrintingPress && 0.0025) + (upgrades.OffsetPress && 0.0075) + (upgrades.Photolithography && 0.0225)),
		starchart: astroChance * 1 
					+ ((level.Satellite * 0.005 + level.ResearchVessel * 0.05 + level.SpaceBeacon * 0.625) * spaceRatio + (upgrades.AstroPhysicists && workers.scholar * 0.0005 * workerEfficiency))
					* (1 + (upgrades.HubbleSpaceTelescope && 0.3)) * paragonBonus * faithBonus,
		uranium: (upgrades.OrbitalGeodesy && level.Quarry * 0.0025 * paragonBonus * magnetoBonus * faithBonus)
					+ level.Accelerator * 0.0125 * autoParagonBonus * magnetoBonus * faithBonus
					+ level.PlanetCracker * 1.5 * (1 + (upgrades.PlanetBuster && 1)) * spaceRatioUranium
					- level.Reactor * 0.005 * (1 - (upgrades.EnrichedUranium && 0.25))
					- level.LunarOutpost * 1.75,
		unobtainium: level.LunarOutpost * 0.035 * (1 + (upgrades.MicroWarpReactors && 1)) * spaceRatio,
		antimatter: energyRatio >= 1 && level.Sunlifter * 1 / year,
	}
}

function production(state: GameState): {[R in Res]: number} {
	const production: {[R in Res]: number} = <any>basicProduction(state);
	for (const conversion of conversions) {
		if (!conversion.instanteneous) {
			continue; // the conversion is ongoing and included in basicProduction (like smelting iron)
		}

		let frequency = Infinity;
		for (const res in conversion.resourceInvestment) {
			if (production[res] === undefined) {
				throw new Error(`invalid conversion order: ${conversion.product} requires ${res}, but ${res} is not yet initialized`);
			}
			let maxFrequency = production[res] / conversion.resourceInvestment[res];
			if (res == conversion.primaryInput) {
				maxFrequency *= state.conversionProportion[conversion.product];
			}
			if (frequency > maxFrequency) {
				frequency = maxFrequency;
			}
		}
		if (frequency < 0) { // this may happen due to rounding issues
			frequency = 0; // don't consume resources. If we didn't do this, it might consume a little sorrow, which may have infinite price and wreck havoc with roi calcs
		}
		
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
	let {conversionProportion, level, upgrades, ships, compendia} = state;

	const barnRatio = (upgrades.ExpandedBarns && 0.75) + (upgrades.ReinforcedBarns && 0.80) + (upgrades.TitaniumBarns && 1.00) + (upgrades.AlloyBarns && 1.00) + (upgrades.ConcreteBarns && 0.75) + (upgrades.ConcretePillars && 0.05);
	const warehouseRatio = 1 + (upgrades.ReinforcedWarehouses && 0.25) + (upgrades.TitaniumWarehouses && 0.50) + (upgrades.AlloyWarehouses && 0.45) + (upgrades.ConcreteWarehouses && 0.35) + (upgrades.StorageBunkers && 0.20) + (upgrades.ConcretePillars && 0.05);
	const harborRatio = 1 + (upgrades.ExpandedCargo && hyperbolicLimit(ships * 0.01, 2.25 + (upgrades.ReactorVessel && level.Reactor * 0.05)));
	const acceleratorRatio = 0 + (upgrades.EnergyRifts && 1) + (upgrades.StasisChambers && 0.95) + (upgrades.VoidEnergy && 0.75) + (upgrades.DarkEnergy && 2.5) + (upgrades.TachyonAccelerators && 5);
	const paragonBonus = 1 + state.paragon * 0.001;
	const baseMetalRatio = 1 + level.Sunforge * 0.01;
	const science = scienceLimits(state);

	return {
		catnip: ((5000 + level.Barn * 5000 + (upgrades.Silos && level.Warehouse * 750) + level.Harbor * harborRatio * 2500) * (1 + (upgrades.Silos && barnRatio * 0.25)) 
				+  level.Accelerator * acceleratorRatio * 30000 + level.MoonBase * 45000) * paragonBonus * (1 + (upgrades.Refrigeration && 0.75) + level.Hydroponics * 0.1),
		wood: ((200 + level.Barn * 200 + level.Warehouse * 150 + level.Harbor * harborRatio * 700) * (1 + barnRatio) * warehouseRatio + level.Accelerator * acceleratorRatio * 20000 + level.MoonBase * 25000 + level.Cryostation * 200000) * paragonBonus,
		minerals: ((250 + level.Barn * 250 + level.Warehouse * 200 + level.Harbor * harborRatio * 950) * (1 + barnRatio) * warehouseRatio + level.Accelerator * acceleratorRatio * 25000 + level.MoonBase * 30000 + level.Cryostation * 200000) * paragonBonus,
		iron: ((50 + level.Barn * 50 + level.Warehouse * 25 + level.Harbor * harborRatio * 150) * (1 + barnRatio) * warehouseRatio + level.Accelerator * acceleratorRatio * 7500 + level.MoonBase * 9000 + level.Cryostation * 50000) * baseMetalRatio * paragonBonus,
		titanium: ((2 + level.Barn * 2 + level.Warehouse * 10 + level.Harbor * harborRatio * 50) * warehouseRatio + level.Accelerator * acceleratorRatio * 750 + level.MoonBase * 1250 + level.Cryostation * 7500) * baseMetalRatio * paragonBonus,
		uranium: (250 + level.Reactor * 250 + level.MoonBase * 1750 + level.Cryostation * 5000) * baseMetalRatio * paragonBonus,
		unobtainium: (150 + level.MoonBase * 150 + level.Cryostation * 750) * baseMetalRatio * paragonBonus,
		coal: 0,
		oil: (1500 + level.OilWell * 1500 + level.MoonBase * 3500 + level.Cryostation * 7500) * paragonBonus,
		gold: ((10 + level.Barn * 10 + level.Warehouse * 5 + level.Harbor * harborRatio * 25 + level.Mint * 100) * warehouseRatio + level.Accelerator * acceleratorRatio * 250) * (1 + level.SkyPalace * 0.01) * baseMetalRatio * paragonBonus,
		catpower: 1e9, // I never hit the limit, so this should be ok
		science: science.byBuildings + Math.min(science.byCompendia, compendia * science.perCompendium),
		culture: 1e9, // I never hit the limit, so this should be ok  (Ziggurats would boost this)
		faith: (100 + level.Temple * (100 + level.SunAltar * 50)) * (1 + (level.GoldenSpire && 0.4 + level.GoldenSpire * 0.1)) * paragonBonus,
		unicorn: 1e9, // there is no limit
		alicorn: 1e9, // there is no limit
		necrocorn: 1e9, // there is no limit
		antimatter: (100 + level.ContainmentChamber * 50 * (1 + level.HeatSink * 0.02)) * paragonBonus, // TODO barnRatio? warehouseRatio? harborRatio?
	}
}

function scienceLimits(state: GameState) {
	const {level, upgrades, paragon} = state;
	const paragonBonus = 1 + paragon * 0.001;
	const libraryRatio = (upgrades.TitaniumReflectors && 0.02) + (upgrades.UnobtainiumReflectors && 0.02) + (upgrades.EludiumReflectors && 0.02);
	const datacenterBoosts = (1 + (upgrades.Uplink && level.BioLab * 0.01))// * (1 + (upgrades.MachineLearning && level.AiCore * dataCenterAiRatio));
	const spaceScienceRatio = (1 + (upgrades.AntimatterReactors && 0.95))
	const scienceMax = (level.Library * 250 + level.DataCenter * 750 * datacenterBoosts) * (1 + level.Observatory * libraryRatio)
										+ level.Academy * 500
										+ level.Observatory * (upgrades.Astrolabe ? 1500 : 1000) * (1 + level.Satellite * 0.05)
										+ level.BioLab * 1500 * (1 + level.DataCenter * ((upgrades.Uplink && 0.01) + (upgrades.Starlink && 0.01)))
										+ level.Temple * (level.Scholasticism && 400 + level.Scholasticism * 100)
										+ level.Accelerator * (upgrades.LHC && 2500)
										+ level.ResearchVessel * 10000 * spaceScienceRatio
										+ level.SpaceBeacon * 25000 * spaceScienceRatio
	const scienceMaxCompendia = level.DataCenter * 1000 * datacenterBoosts; 
	return {
		byBuildings: scienceMax * paragonBonus,
		byCompendia: (scienceMax + scienceMaxCompendia) * paragonBonus,
		perCompendium: 10 * paragonBonus,
	}
}

interface Expense {
	name: string;
	cost: number;
}

class Expediture implements Expediture {
	price: number;
	cost: number;

	constructor(public amount: number, public res: Res) {
		if (isNaN(amount)) {
			debugger;
			throw new Error("amount is NaN");
		}
		this.price = price[res];
		this.cost = amount * this.price;
	}
}

export class Investment {

	cost = 0;
	expeditures: Expediture[] = [];
	expenses: Expense[] = [];

	alsoRequired: Expense[] = [];
	alsoRequiredCost = 0;

	add(xp: Expediture) {
		if (Math.abs(xp.cost) > 1e-6 || Math.abs(xp.amount) > 1e-6) {
			this.expeditures.push(xp);
			this.cost += xp.cost;
		}
	}

	addExpense(expense: Expense) {
		this.expenses.push(expense);
		this.cost += expense.cost;
	}

	addAdditionalRequirement(expense: Expense) {
		this.alsoRequired.push(expense);
		this.alsoRequiredCost += expense.cost;
	}
}

export class CostBenefitAnalysis {
	investment = new Investment();
	return = new Investment();
	instanteneous = false;
}

export abstract class Conversion extends CostBenefitAnalysis {
	instanteneous = true;

	private currentlyProduced = this.produced(state);
	private initialized = false;

	constructor(public product: ConvertedRes, public resourceInvestment: Cart) {
		super();
	}

	/** also sets the price of the product! */
	init(priceFor: (res: Res) => number) {
		if (this.initialized) return;

		let cost = 0;
		let benefit = 0;
		for (const res in this.resourceInvestment) {
			const number = this.resourceInvestment[res]
			cost += number * priceFor(<Res>res);
			this.investment.add(new Expediture(number, <Res>res));
		}

		for (const res in this.currentlyProduced) {
			const p = this.currentlyProduced[res];
			if (p) {
				if (res != this.product) {
					if (p < 0) {
						cost -= p * priceFor(<Res>res);
					} else {
						benefit += p * priceFor(<Res>res);
					}
					this.return.add(new Expediture(p, <Res>res));
				}
			}
		}
		price[this.product] = price[this.product] || Math.max(0, (cost * (state.priceMarkup[this.product] || 1) - benefit) / this.currentlyProduced[this.product]);
		this.return.add(new Expediture(this.currentlyProduced[this.product], this.product)); // can't do this earlier, because it needs the price ...

		this.initialized = true;
	}

	get primaryInput(): Res {
		for (const r in this.resourceInvestment) {
			return <Res>r; // the first
		}
	}

	abstract produced(state: GameState): Cart;
}

class Smelting extends Conversion {
	constructor() {
		super("iron", {});
		this.instanteneous = false;
	}

	produced(state: GameState) {
		return delta(basicProduction, {
			level: {
				Smelter: state.level.Smelter + 1
			}
		});
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
			unicorn: 0.05,
		}
	}
}

abstract class Trade extends Conversion {
	constructor(product: ConvertedRes, input: Cart) {
		super(product, {gold: 15, catpower: 50, ...input});
	}

	get friendly() {
		return 0;
	}
	get hostile() {
		return 0;
	}

	produced(state: GameState) {
		const {level, metaphysic} = state;

		let output = this.output(state, 1 + level.TradePost * 0.015);

		const standingRatio = level.TradePost * 0.0035 + (metaphysic.Diplomacy && 0.1);
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

class LeviathanTrade extends Trade {
	constructor() {
		super("relic", {unobtainium: 5000});
	}

	get primaryInput(): Res {
		return "unobtainium";
	}

	output(state: GameState, tradeRatio: number): Cart {
		const raceRatio = 1 + state.leviathanEnergy * 0.02;
		const ratio = tradeRatio * raceRatio;
		return {
			timecrystal: 0.98 * 0.25 * ratio,
			sorrow: 0.15 * 1 * ratio,
			starchart: 0.5 * 250 * ratio,
			relic: 0.05 * 1 * ratio 
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
		produced[this.product] = craftRatio(state, this.product);
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

class RefineTears extends Conversion {
	constructor() {
		super("sorrow", {tear: 10000});
	}

	produced(state: GameState): Cart {
		return {
			sorrow: 1
		}
	}
}

class AlicornSacrifice extends Conversion {
	constructor() {
		super("timecrystal", {alicorn: 25})
	}

	produced(state: GameState): Cart {
		const {level} = state;		
		const tcRefineRatio = 1 + level.UnicornUtopia * 0.05 + level.SunSpire * 0.10;
		return {
			timecrystal: 1 * tcRefineRatio
		}
	}
}

function craftRatio(state: GameState, res?: ConvertedRes) {
	const {level, upgrades, metaphysic} = state;
	const ratio = 1 + level.Workshop * 0.06 + level.Factory * (0.05 + (upgrades.FactoryLogistics && 0.01))
	let resCraftRatio = 0;
	let globalResCraftRatio = 0;

	if (res == "blueprint") {
		resCraftRatio = upgrades.CADsystem && 0.01 * (level.Library + level.Academy + level.Observatory + level.BioLab);
	} else if (res == "manuscript") {
		resCraftRatio = metaphysic.CodexVox && 0.25;
		globalResCraftRatio = metaphysic.CodexVox && 0.05;
	}

	return (ratio + resCraftRatio) * (1 + globalResCraftRatio);
}

export class ScienceInfo extends CostBenefitAnalysis {
	constructor(public name: Science, public resourceInvestment: Cart, unlocks: Array<Science | Upgrade | Building | Job>) {
		super();
		for (const res in resourceInvestment) {
			this.investment.add(new Expediture(resourceInvestment[res], <Res>res));
		}
		for (const unlock of unlocks) {
			prerequisite[unlock] = prerequisite[unlock] || [];
			prerequisite[unlock].push(this);
		}
	}

	get visible() {
		return state.researched[this.name] ? state.showResearchedUpgrades : collectMissingPrerequisites(this.name).length <= 3;
	}

	get stateInfo() {
		return state.researched[this.name] ? 'R' : '';
	}

	effect(times: number) {
		return {
			researched: {
				[this.name]: times > 0
			}
		}
	}
}

function collectMissingPrerequisites(thing: string, results: ScienceInfo[] = []) {
	for (const p of prerequisite[thing] || []) {
		if (!state.researched[p.name]) {
			collectMissingPrerequisites(p.name, results);
			results.push(p);
		}
	}
	return results;
}

export abstract class Action extends CostBenefitAnalysis {
	roi: number;

	constructor(s: GameState, public name: string, resourceInvestment: Cart, resourceMultiplier = 1) {
		super();
		for (const res in resourceInvestment) {
			const number = resourceInvestment[res];
			this.investment.add(new Expediture(number * resourceMultiplier, <Res>res));
		}

		this.procurePrerequisite();
		this.procureStorage(this.investment.expeditures, s);
	}

	assess() {
		const deltaProduction = delta(production, this.effect(1));
		for (const r of resourceNames) {
			if (deltaProduction[r] !== undefined) {
				this.return.add(new Expediture(deltaProduction[r], r));
			}
		}

		this.roi = this.investment.cost / this.return.cost;
		if (this.return.cost <= 0 || this.roi > 1e6) {
			this.roi = Infinity;
		}
		
		return this; // for chaining
	}

	private static procuringStorage = false;

	procureStorage(xps: Expediture[], state: GameState) {
		const undoers: Array<() => void> = [];
		try {
			let currentStorage = storage(state);
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
							for (const sa of storageActions(state, xp.res == "science" && xp.amount)) {
								const undo = apply(state, sa.effect(1));
								let newStorage = storage(state);
								undo();
		
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
							const undo = apply(state, bestAction.effect(1));
							undoers.push(undo);
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
		} finally {
			while (undoers.length) {
				undoers.pop()();
			}
		}
	}

	procurePrerequisite() {
		for (const p of collectMissingPrerequisites(this.name)) {
			const expense = {name: p.name, cost: p.investment.cost};
			if (this.repeatable) {
				this.investment.addAdditionalRequirement(expense); // it would be misleading to have the first action pay the entire cost
			} else {
				this.investment.addExpense(expense); // but here it makes sense
			}
		}
	}

	available(state: GameState) {
		return true;
	}

	abstract effect(times: number): GameStateUpdate;
	
	abstract readonly stateInfo: string | number;

	abstract readonly repeatable: boolean;
}


const obsoletes: {[B in Building]?: Building} = {
	BroadcastTower: "Amphitheatre",
	DataCenter: "Library",
	HydroPlant: "Aqueduct",
	SolarFarm: "Pasture",
}
const obsoletedBy: {[B in Building]?: Building} = {
	Amphitheatre: "BroadcastTower",
	Aqueduct: "HydroPlant",
	Library: "DataCenter",
	Pasture: "SolarFarm",
}

class BuildingAction extends Action {

	constructor(name: Building, private initialConstructionResources: Cart, priceRatio: number, s = state, priceReduction: number | null = 0) {
		super(s, name, initialConstructionResources, Math.pow(BuildingAction.priceRatio(s, priceRatio, priceReduction), s.level[name]));
	}

	static priceRatio(s: GameState, ratio: number, reduction: number | null) {
		if (reduction !== null) {
			const {metaphysic} = s;
			// cf. getPriceRatioWithAccessor in buildings.js
			const ratioBase = ratio - 1;
			const ratioDiff = reduction 
									 + (metaphysic.Engineering && 0.01) 
									 + (metaphysic.GoldenRatio && (1+Math.sqrt(5))/2 * 0.01) 
									 + (metaphysic.DivineProportion && 0.16 / 9) 
									 + (metaphysic.VitruvianFeline && 0.02)
									 + (metaphysic.Renaissance && 0.0225);
			ratio = ratio - hyperbolicLimit(ratioDiff, ratioBase);
		}
		return ratio;
	}

	available(state: GameState) {
		return super.available(state) && !this.obsolete(state);
	}

	obsolete(state: GameState) {
		const ob = obsoletedBy[this.name];
		return ob && state.level[ob];
	}

	private levelUpdateEffect(newLevel: number) {
		const update: GameStateUpdate = {
			level: {
				[this.name]: newLevel,
			}
		};
		
		if (newLevel) {
			const o = obsoletes[this.name];
			if (o) {
				update.level[o] = 0;
			}
		}
		return update;
	}

	get stateInfo(): number {
		return state.level[this.name];
	}

	set stateInfo(newValue: number) {
		apply(state, this.levelUpdateEffect(newValue));
	}

	effect(times: number) {
		return this.levelUpdateEffect(state.level[this.name] + times);
	}

	get repeatable() {
		return true;
	}
}

class SpaceAction extends BuildingAction {
	constructor(name: Building, initialConstructionResources: Cart, priceRatio: number, s = state) {
		if (initialConstructionResources.oil) {
			initialConstructionResources.oil *= 1 - hyperbolicLimit(s.level.SpaceElevator * 0.05, 0.75);
			initialConstructionResources.oil *= Math.pow(1.05, s.level[name]) / Math.pow(priceRatio, s.level[name]); // price ratio for oil is always 1.05
		}
		super(name, initialConstructionResources, priceRatio, s, null);
	}
}

class ReligiousAction extends BuildingAction {
	constructor(name: Building, initialConstructionResources: Cart, s = state) {
		super(name, initialConstructionResources, 2.5, s, null);
	}

	available(state: GameState) {
		const {level, upgrades} = state;
		return super.available(state) && (level[this.name] == 0 || upgrades.Transcendence || state.showResearchedUpgrades);
	}
}

class ZigguratBuilding extends BuildingAction {
	constructor(name: Building, initialConstructionResources: Cart, priceRatio: number, s = state) {
		super(name, initialConstructionResources, priceRatio, s, null);
	}

	available(state: GameState) {
		return super.available(state) && state.level.Ziggurat > 0;
	}
}

class UpgradeAction extends Action {
	constructor(name: Upgrade, resourceCost: Cart, s = state) {
		super(s, name, resourceCost);
	}

	get stateInfo() {
		return state.upgrades[this.name] ? "R" : " ";
	}

  available(state: GameState) {
		return super.available(state) && state.level.Workshop && (state.showResearchedUpgrades || !state.upgrades[this.name]);
	}

	effect(times: number): GameStateUpdate {
		return {
			upgrades: {
				[this.name]: times > 0,
			}
		}
	}

	get repeatable() {
		return false;
	}
}

class MetaphysicAction extends Action {
	constructor(name: Metaphysic, private paragonCost: number, s = state) {
		super(s, name, {});
	}

	get stateInfo() {
		return state.metaphysic[this.name] ? "R" : " ";
	}

	available(state: GameState) {
		return true;
	}

	effect(times: number): GameStateUpdate {
		return {
			metaphysic: {
				[this.name]: times > 0,
			},
			paragon: state.paragon - times * this.paragonCost,
		}
	}

	get repeatable() {
		return false;
	}
}

class TradeshipAction extends Action {
	constructor(s = state) {
		super(s, "TradeShip", {scaffold: 100, plate: 150, starchart: 25});
	}

	effect(times: number) {
		return {ships: state.ships + times * craftRatio(state)}
	}

	get stateInfo() {
		return "";
	}
	get repeatable() {
		return true;
	}
}

class PraiseAction extends Action {
	constructor() {
		super(state, "PraiseTheSun", {faith: 1000});
	}

	effect(times: number) {
		return {
			faith: {
				stored: state.faith.stored + times * 1000 * (1 + praiseBonus(state))
			}
		}
	}

	get stateInfo() {
		return "";
	}
	get repeatable() {
		return true;
	}
}

function compendiaAction(state: GameState, desiredScienceLimit: number) {
	const scienceLimit = scienceLimits(state);
	const desiredScienceByCompendia = desiredScienceLimit - scienceLimit.byBuildings;
	const available = 0 < desiredScienceByCompendia && desiredScienceByCompendia < scienceLimit.byCompendia;
	const desiredCompendia = desiredScienceByCompendia / scienceLimit.perCompendium + 1e-6; // guard against floating point rounding errors
	const neededCompendia = desiredCompendia - state.compendia;

	return new class A extends Action {
		constructor() {
			super(state, `${Math.round(neededCompendia)} compendia`, {compendium: neededCompendia}, 1);
		}
		available() {
			return available;
		}
		effect(times: number) {
			return {
				compendia: desiredCompendia,
			}
		}
		stateInfo = "";
		repeatable = false;
	}
}

class FeedEldersAction extends Action {
	constructor() {
		super(state, "FeedElders", {necrocorn: 1})
	}
	effect(times: number) {
		return {
			leviathanEnergy: state.leviathanEnergy + times
		}
	}
	get stateInfo() {
		return "";
	}
	get repeatable() {
		return true;
	}
}

function updateSciences() {
  prerequisite = {};

	const infos = [
		new ScienceInfo("Calendar", {science: 30}, ["Agriculture"]),
		new ScienceInfo("Agriculture", {science: 100}, ["Mining", "Archery", "Barn", "farmer"]),
		new ScienceInfo("Archery", {science: 300}, ["AnimalHusbandry", "hunter"]),
		new ScienceInfo("AnimalHusbandry", {science: 500}, ["CivilService", "Mathematics", "Construction", "Pasture", "UnicornPasture"]),
		new ScienceInfo("Mining", {science: 500}, ["MetalWorking", "Mine", "Workshop", "Bolas"]), // also enables meteors
		new ScienceInfo("MetalWorking", {science: 900}, ["Smelter", "HuntingArmor"]),
		new ScienceInfo("Mathematics", {science: 1000}, ["Academy"]), // celestial mechanics
		new ScienceInfo("Construction", {science: 1300}, ["Engineering", "LogHouse", "Warehouse", "LumberMill", "Ziggurat", "CompositeBow", "ReinforcedSaw"]), // catnip enrichment
		new ScienceInfo("CivilService", {science: 1500}, ["Currency"]),
		new ScienceInfo("Engineering", {science: 1500}, ["Writing", "Aqueduct"]),
		new ScienceInfo("Currency", {science: 2200}, ["TradePost"]),
		new ScienceInfo("Writing", {science: 3600}, ["Philosophy", "Machinery", "Steel", "Amphitheatre"]), // register
		new ScienceInfo("Philosophy", {science: 9500}, ["Theology", "Temple"]),
		new ScienceInfo("Steel", {science: 12000}, ["SteelAxe", "ReinforcedWarehouses", "CoalFurnace", "DeepMining", "HighPressureEngine", "SteelArmor"]),
		new ScienceInfo("Machinery", {science: 15000}, ["Steamworks", "PrintingPress", "Crossbow"]), // workshop automation
		new ScienceInfo("Theology", {science: 20000, manuscript: 35}, ["Astronomy", "Cryptotheology", "priest"]),
		new ScienceInfo("Astronomy", {science: 28000, manuscript: 65}, ["Navigation", "Observatory"]),
		new ScienceInfo("Navigation", {science: 35000, manuscript: 100}, ["Architecture", "Physics", "Geology", "Harbor", "TitaniumAxe", "ExpandedCargo", "Astrolabe", "TitaniumReflectors"]), // Caravanserai
		new ScienceInfo("Architecture", {science: 42000, compendium: 10}, ["Acoustics", "Mansion", "Mint"]),
		new ScienceInfo("Physics", {science: 50000, compendium: 35}, ["Chemistry", "Electricity", "Metaphysics", "SteelSaw", "Pyrolysis"]), //pneumatic press
		new ScienceInfo("Metaphysics", {science: 55000, unobtainium: 5}, []),
		new ScienceInfo("Chemistry", {science: 60000, compendium: 50}, ["OilWell", "Calciner", "AlloyAxe", "AlloyBarns", "AlloyWarehouses", "AlloyArmor"]),
		new ScienceInfo("Acoustics", {science: 60000, compendium: 60}, ["DramaAndPoetry", "Chapel"]),
		new ScienceInfo("Geology", {science: 65000, compendium: 65}, ["Biology", "Quarry", "Geodesy", "geologist"]),
		new ScienceInfo("DramaAndPoetry", {science: 90000, parchment: 5000}, []), // enables festivals
		new ScienceInfo("Electricity", {science: 75000, compendium: 85}, ["Industrialization", "Magneto"]),
		new ScienceInfo("Biology", {science: 85000, compendium: 100}, ["Biochemistry", "BioLab"]),
		new ScienceInfo("Biochemistry", {science: 145000, compendium: 500}, ["Genetics", "BiofuelProcessing"]),
		new ScienceInfo("Genetics", {science: 190000, compendium: 1500}, ["UnicornSelection", "GMCatnip"]),
		new ScienceInfo("Industrialization", {science: 100000, blueprint: 25}, ["Mechanization", "Metallurgy", "Combustion", "Logistics"]), // Barges, AdvancedAutomation
		new ScienceInfo("Mechanization", {science: 115000, blueprint: 45}, ["Electronics", "Factory", "ConcretePillars", "Pumpjack"]),
		new ScienceInfo("Combustion", {science: 115000, blueprint: 45}, ["Ecology", "OffsetPress", "FuelInjectors", "OilRefinery"]),
		new ScienceInfo("Metallurgy", {science: 125000, blueprint: 60}, ["ElectrolyticSmelting", "Oxidation", "MiningDrill"]),
		new ScienceInfo("Ecology", {science: 125000, blueprint: 55}, ["SolarFarm"]),
		new ScienceInfo("Electronics", {science: 135000, blueprint: 70}, ["Robotics", "NuclearFission", "Rocketry", "Refrigeration", "CADsystem", "SETI", "FactoryLogistics", "Telecommunication", "BroadcastTower", "DataCenter"]), // FactoryOptimization
		new ScienceInfo("Robotics", {science: 140000, blueprint: 80}, ["ArtificialIntelligence", "HydroPlant", "RotaryKiln", "RoboticAssistance"]), // SteelPlants, FactoryRobotics, Tanker
		new ScienceInfo("ArtificialIntelligence", {science: 250000, blueprint: 150}, ["QuantumCryptography"]), // AICore, NeuralNetworks, AIEngineers
		//new ScienceInfo("QuantumCryptography", {science: 1250000, relic: })
		// new ScienceInfo("Blackchain"),
		new ScienceInfo("NuclearFission", {science: 150000, blueprint: 100}, ["Nanotechnology", "ParticlePhysics", "Reactor", "ReactorVessel", "NuclearSmelters"]),
		new ScienceInfo("Rocketry", {science: 175000, blueprint: 125}, ["Satellites", "OilProcessing", "OilDistillation", "OrbitalLaunch"]),
		new ScienceInfo("OilProcessing", {science: 215000, blueprint: 150}, ["FactoryProcessing"]), // kerosene
		new ScienceInfo("Satellites", {science: 190000, blueprint: 125}, ["OrbitalEngineering", "Satellite", "Photolithography", "OrbitalGeodesy", "Uplink", "ThinFilmCells"]),
		new ScienceInfo("OrbitalEngineering", {science: 250000, blueprint: 250}, ["Exogeology", "Thorium", "HubbleSpaceTelescope", "AstroPhysicists", "SpaceStation", "SpaceElevator", "SolarSatellites", "Starlink"]), // SpaceEngineers
		new ScienceInfo("Thorium", {science: 375000, blueprint: 375}, []), // ThoriumReactors, ThoriumDrive
		new ScienceInfo("Exogeology", {science: 275000, blueprint: 250}, ["AdvancedExogeology", "UnobtainiumReflectors", "UnobtainiumHuts", "UnobtainiumDrill", "HydroPlantTurbines", "StorageBunkers"]),
		new ScienceInfo("AdvancedExogeology", {science: 325000, blueprint: 350}, ["PlanetBuster", "EludiumHuts", "MicroWarpReactors", "EludiumReflectors"]),
		new ScienceInfo("Nanotechnology", {science: 200000, blueprint: 150}, ["Superconductors", "PhotovoltaicCells", "Nanosuits", "Augmentations", "FluidizedReactors", "SpaceElevator"]),
		new ScienceInfo("Superconductors", {science: 225000, blueprint: 175}, ["Antimatter", "ColdFusion", "SpaceManufacturing", "Cryocomputing"]),
		new ScienceInfo("Antimatter", {science: 500000, relic: 1}, ["Terraformation", "AntimatterBases", "AntimatterReactors", "AntimatterFission", "AntimatterDrive"]),
		new ScienceInfo("Terraformation", {science: 750000, relic: 5}, ["HydroPonics", "TerraformingStation"]),
		new ScienceInfo("HydroPonics", {science: 1000000, relic: 25}, ["Exophysics", "Hydroponics"]), // Tectonic
		// new ScienceInfo("Exophysics", )
		new ScienceInfo("ParticlePhysics", {science: 185000, blueprint: 135}, [/*"Chronophysics"*/, "DimensionalPhysics", "Accelerator", "EnrichedUranium", "Railgun"]),
		new ScienceInfo("DimensionalPhysics", {science: 235000}, ["EnergyRifts", "LHC"]),
		new ScienceInfo("Chronophysics", {science: 250000, timecrystal: 5}, ["TachyonTheory", "StasisChambers", "VoidEnergy", "DarkEnergy"]),
		new ScienceInfo("TachyonTheory", {science: 750000, timecrystal: 25, relic: 1}, ["VoidSpace", "TachyonAccelerators", /*"Chronoforge"*/]),
		// ...

		new ScienceInfo("OrbitalLaunch", {starchart: 250, catpower: 5000, science: 100000, oil: 15000}, ["Satellite", "SpaceElevator", "MoonMission", "SpaceStation"]),
		new ScienceInfo("MoonMission", {starchart: 500, titanium: 5000, science: 125000, oil: 45000}, ["LunarOutpost", "MoonBase", "DuneMission", "PiscineMission"]),
		new ScienceInfo("DuneMission", {starchart: 1000, titanium: 7000, science: 175000, kerosene: 75}, ["HeliosMission", "PlanetCracker", "HydraulicFracturer", "SpiceRefinery"]),
		new ScienceInfo("PiscineMission", {starchart: 1500, titanium: 9000, science: 200000, kerosene: 250}, ["TMinusMission", "ResearchVessel", "OrbitalArray"]),
		new ScienceInfo("HeliosMission", {starchart: 3000, titanium: 15000, science: 250000, kerosene: 1250}, ["YarnMission", "Sunlifter", "ContainmentChamber", "HeatSink", "Sunforge"]),
		new ScienceInfo("TMinusMission", {starchart: 2500, titanium: 12000, science: 225000, kerosene: 750}, ["HeliosMission", "KairoMission", "Cryostation"]),
		new ScienceInfo("KairoMission", {starchart: 5000, titanium: 20000, science: 300000, kerosene: 7500}, ["RorschachMission", "SpaceBeacon"]),
		new ScienceInfo("YarnMission", {starchart: 7500, titanium: 35000, science: 350000, kerosene: 12000}, ["UmbraMission", "TerraformingStation", "Hydroponics"]),
		// ...
	];

	sciences = infos.filter(info => info.visible);
}

function scienceBuildings(state: GameState) {
	return [
		new BuildingAction("Accelerator", {titanium: 7500, concrete: 125, uranium: 25}, 1.15, state),
		new BuildingAction("Library", {wood: 25}, 1.15, state),
		new BuildingAction("DataCenter", {concrete: 10, steel: 100}, 1.15, state),
		new BuildingAction("Academy", {wood: 50, minerals: 70, science: 100}, 1.15, state),
		new BuildingAction("Observatory", {scaffold: 50, slab: 35, iron: 750, science: 1000}, 1.10, state),
		new BuildingAction("BioLab", {slab: 100, alloy: 25, science: 1500}, 1.10, state),

		new SpaceAction("ResearchVessel", {starchart: 100, alloy: 2500, titanium: 12500, kerosene: 250}, 1.15, state),
		new SpaceAction("SpaceBeacon", {starchart: 25000, antimatter: 50, alloy: 25000, kerosene: 7500}, 1.15),
	];
}

function activationActions() {
	return activatableBuildingNames.map(building => {
		const active = state.active[building];
		
		return new class A extends Action {
			constructor() {
				super(state, building, {});
			}

			effect(times: number) {
				return {
					active: {
						[building]: !active
					}
				}
			}
		
			stateInfo = active ? "on" : "off";
			repeatable = false;
		};
	});
}

function updateActions() {
	const {upgrades} = state;
	actions = [
		new BuildingAction("CatnipField", {catnip: 10}, 1.12),
		new BuildingAction("Pasture", {catnip: 100, wood: 10}, 1.15),
		new BuildingAction("SolarFarm", {titanium: 250}, 1.15),
		new BuildingAction("Aqueduct", {minerals: 75}, 1.12),
		new BuildingAction("HydroPlant", {concrete: 100, titanium: 2500}, 1.15),
		new BuildingAction("Hut", {wood: 5}, 2.5, state, (upgrades.IronWoodHuts && 0.5) + (upgrades.ConcreteHuts && 0.3) + (upgrades.UnobtainiumHuts && 0.25) + (upgrades.EludiumHuts && 0.1)),
		new BuildingAction("LogHouse", {wood: 200, minerals: 250}, 1.15),
		new BuildingAction("Mansion", {slab: 185, steel: 75, titanium: 25}, 1.15),
		...scienceBuildings(state),
		new BuildingAction("Mine", {wood: 100}, 1.15),
		new BuildingAction("Quarry", {scaffold: 50, steel: 125, slab:1000}, 1.15),
		new BuildingAction("LumberMill", {wood: 100, iron: 50, minerals: 250}, 1.15),
		new BuildingAction("OilWell", {steel: 50, gear: 25, scaffold: 25}, 1.15),
		new BuildingAction("Steamworks", {steel: 65, gear: 20, blueprint: 1}, 1.25),
		new BuildingAction("Magneto", {alloy: 10, gear: 5, blueprint: 1}, 1.25),
		new BuildingAction("Smelter", {minerals: 200}, 1.15),
		new BuildingAction("Calciner", {steel: 100, titanium: 15, blueprint: 1, oil: 500}, 1.15),
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
		new SpaceAction("OrbitalArray", {starchart: 2000, eludium: 100, science: 250000, kerosene: 500}, 1.15),
		new SpaceAction("Sunlifter", {science: 500000, eludium: 225, kerosene: 2500}, 1.15),
		new SpaceAction("TerraformingStation", {antimatter: 25, uranium: 5000, kerosene: 5000}, 1.25),
		new SpaceAction("Hydroponics", {kerosene: 500}, 1.15),

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
		new UpgradeAction("ThinFilmCells", {unobtainium: 200, uranium: 1000, science: 125000}),
		new UpgradeAction("SolarSatellites", {alloy: 750, science: 225000}),
		new UpgradeAction("IronWoodHuts", {science: 30000, wood: 15000, iron: 3000}),
		new UpgradeAction("ConcreteHuts", {science: 125000, concrete: 45, titanium: 3000}),
		new UpgradeAction("UnobtainiumHuts", {science: 200000, unobtainium: 350, titanium: 15000}),
		new UpgradeAction("EludiumHuts", {eludium: 125, science: 275000}),
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
		new UpgradeAction("OrbitalGeodesy", {alloy: 1000, oil: 35000, science: 150000}),
		new UpgradeAction("PrintingPress", {gear: 45, science: 7500}),
		new UpgradeAction("OffsetPress", {gear: 250, oil: 15000, science: 100000}),
		new UpgradeAction("Photolithography", {alloy: 1250, oil: 50000, uranium: 250, science: 250000}),
		new UpgradeAction("Cryocomputing", {eludium: 15, science: 125000}),
		new UpgradeAction("HighPressureEngine", {gear: 25, science: 20000, blueprint: 5}),
		new UpgradeAction("FuelInjectors", {gear: 250, oil: 20000, science: 100000}),
		new UpgradeAction("FactoryLogistics", {gear: 250, titanium: 2000, science: 100000}),
		new UpgradeAction("SpaceManufacturing", {titanium: 125000, science: 250000}),
		new UpgradeAction("HydroPlantTurbines", {unobtainium: 125, science: 250000}),
		new UpgradeAction("AntimatterBases", {eludium: 15, antimatter: 250}),
		//new UpgradeAction("AntimatterFission", {antimatter: 175, thorium: 7500, science: 525000}), // effect not calculated (speed up eludium crafting by 25%)
		new UpgradeAction("AntimatterDrive", {antimatter: 125, science: 450000}), // effect not calculated (routeSpeed 25)
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
		new UpgradeAction("MicroWarpReactors", {eludium: 50, science: 150000}),
		new UpgradeAction("PlanetBuster", {eludium: 250, science: 275000}),
		new UpgradeAction("OilDistillation", {titanium: 5000, science: 175000}),
		new UpgradeAction("FactoryProcessing", {titanium: 7500, concrete: 125, science: 195000}),
		// new UpgradeAction("Telecommunication", {titanium: 5000, uranium: 50, science: 150000}), // effect not calculated (increases learn ratio)
		new UpgradeAction("RoboticAssistance", {steel: 10000, gear: 250, science: 100000}),

		new ReligiousAction("SolarChant", {faith: 100}),
		new ReligiousAction("SunAltar", {faith: 500, gold: 250}),
		new ReligiousAction("StainedGlass", {faith: 500, gold: 250}),
		new ReligiousAction("Basilica", {faith: 1250, gold: 750}), // effect on culture storage not calculated
		new ReligiousAction("Templars", {faith: 3500, gold: 3000}),
		new UpgradeAction("SolarRevolution", {faith: 750, gold: 500}),
		new UpgradeAction("Transcendence", {faith: 7500, gold: 7500}),

		new ZigguratBuilding("UnicornTomb", {ivory: 500, tear: 5}, 1.15),
		new ZigguratBuilding("IvoryTower", {ivory: 25000, tear: 25}, 1.15),
		new ZigguratBuilding("IvoryCitadel", {ivory: 50000, tear: 50}, 1.15), // effect on ivory meteors not calculated
		new ZigguratBuilding("SkyPalace", {ivory: 125000, megalith: 5, tear: 500}, 1.15), // effect on ivory meteors not calculated
		new ZigguratBuilding("UnicornUtopia", {ivory: 1000000, gold: 500, tear: 5000}, 1.15), // effect on ivory meteors not calculated
		new ZigguratBuilding("SunSpire", {ivory: 750000, gold: 1250, tear: 25000}, 1.15), // effect on ivory meteors not calculated
		new ZigguratBuilding("Marker", {/*spice: 50000,*/ tear: 5000, unobtainium: 2500, megalith: 750 }, 1.15),
		// Markers, etc.
		new ZigguratBuilding("BlackPyramid", {/*spice: 150000,*/ sorrow: 5, unobtainium: 5000, megalith: 2500}, 1.15),

		...activationActions(),
		new TradeshipAction(),
		new PraiseAction(),
		new FeedEldersAction(),
	];
	actions = actions.filter(a => a.available(state)).map(a => a.assess());
	actions.sort((a,b) => a.roi - b.roi);
}

function storageActions(state: GameState, desiredScienceLimit?: number) {
	return [
		new BuildingAction("Barn", {wood: 50}, 1.75, state),
		new BuildingAction("Warehouse", {beam: 1.5, slab: 2}, 1.15, state),
		new BuildingAction("Harbor", {scaffold: 5, slab: 50, plate: 75}, 1.15, state),
		new BuildingAction("OilWell", {steel: 50, gear: 25, scaffold: 25}, 1.15, state),
		...scienceBuildings(state),
		...(desiredScienceLimit ? [compendiaAction(state, desiredScienceLimit)] : []),

		new SpaceAction("MoonBase", {starchart: 700, titanium: 9500, concrete: 250, science: 100000, unobtainium: 50, oil: 70000}, 1.12, state),
		new SpaceAction("Cryostation", {eludium: 25, concrete: 1500, science: 200000, kerosene: 500}, 1.12, state),
		new SpaceAction("ContainmentChamber", {science: 500000, kerosene: 2500}, 1.125, state),
		// new SpaceAction("HeatSink", {science: 125000, thorium: 12500, relic: 1, kerosene: 5000}, 1.12, state), // needs thorium
		new SpaceAction("Sunforge", {science: 100000, relic: 1, kerosene: 1250, antimatter: 250}, 1.12),

		new UpgradeAction("ExpandedBarns", {science: 500, wood: 1000, minerals: 750, iron: 50}, state),
		new UpgradeAction("ReinforcedBarns", {science: 800, beam: 25, slab: 10, iron: 100}, state),
		new UpgradeAction("ReinforcedWarehouses", {science: 15000, plate: 50, steel: 50, scaffold: 25}, state),
		new UpgradeAction("Silos", {science: 50000, steel: 125, blueprint: 5}, state),
		new UpgradeAction("ExpandedCargo", {science: 55000, blueprint: 15}, state),
		new UpgradeAction("ReactorVessel", {science: 135000, titanium: 5000, uranium: 125}, state),
		new UpgradeAction("TitaniumBarns", {science: 60000, titanium: 25, steel: 200, scaffold: 250}, state),
		new UpgradeAction("AlloyBarns", {science: 75000, alloy: 20, plate: 750}, state),
		new UpgradeAction("ConcreteBarns", {science: 100000, concrete: 45, titanium: 2000}, state),
		new UpgradeAction("TitaniumWarehouses", {science: 70000, titanium: 50, steel: 500, scaffold: 500}, state),
		new UpgradeAction("AlloyWarehouses", {science: 90000, titanium: 750, alloy: 50}, state),
		new UpgradeAction("ConcreteWarehouses", {science: 100000, titanium: 1250, concrete: 35}, state),
		new UpgradeAction("StorageBunkers", {science: 25000, unobtainium: 500, concrete: 1250}, state),
		new UpgradeAction("EnergyRifts", {science: 200000, titanium: 7500, uranium: 250}),
		new UpgradeAction("StasisChambers", {alloy: 200, uranium: 2000, timecrystal: 1, science: 235000}),
		new UpgradeAction("VoidEnergy", {alloy: 250, uranium: 2500, timecrystal: 2, science: 275000}),
		new UpgradeAction("DarkEnergy", {eludium: 75, timecrystal: 3, science: 350000}),
		new UpgradeAction("TachyonAccelerators", {eludium: 125, timecrystal: 10, science: 500000}),
		new UpgradeAction("LHC", {science: 250000, unobtainium: 100, alloy: 150}, state),
		new UpgradeAction("Refrigeration", {science: 125000, titanium: 2500, blueprint: 15}, state),
		new UpgradeAction("ConcretePillars", {science: 100000, concrete: 50}, state),
		new UpgradeAction("Uplink", {alloy: 1750, science: 75000}, state),
		new UpgradeAction("Starlink", {alloy: 5000, oil: 25000, science: 175000}, state),
		new UpgradeAction("Astrolabe", {titanium: 5, starchart: 75, science: 25000}, state),
		new UpgradeAction("TitaniumReflectors", {titanium: 15, starchart: 20, science: 20000}, state),
		new UpgradeAction("UnobtainiumReflectors", {unobtainium: 75, starchart: 750, science: 250000}, state),
		new UpgradeAction("EludiumReflectors", {eludium: 15, science: 250000}, state),
		new UpgradeAction("AntimatterReactors", {eludium: 35, antimatter: 750}, state),


		new ReligiousAction("Scholasticism", {faith: 250}, state),
		new ReligiousAction("GoldenSpire", {faith: 350, gold: 150}, state),
	].filter(a => a.available(state));
}

function metaphysicActions() {
	return [
		new MetaphysicAction("Engineering", 5),
		new MetaphysicAction("Diplomacy", 5),
		new MetaphysicAction("GoldenRatio", 50),
		new MetaphysicAction("DivineProportion", 100),
		new MetaphysicAction("VitruvianFeline", 250),
		new MetaphysicAction("Renaissance", 750),
		new MetaphysicAction("CodexVox", 25),
		new MetaphysicAction("Chronomancy", 25),
		new MetaphysicAction("Astromancy", 50),
	].filter(a => a.available(state)).map(a => a.assess());
}

class FurConsumptionReport extends CostBenefitAnalysis {
	constructor(state: GameState) {
		super();
		const productionDelta = delta(production, {luxury: {fur: !state.luxury.fur}});
		for (const r of resourceNames) {
			if (productionDelta[r]) {
				this.return.add(new Expediture(productionDelta[r] * (state.luxury.fur ? -1 : 1), r));
			}
		}
	}
}

export function economyReport() {
	updateEconomy();
	updateSciences();
	currentBasicProduction = basicProduction(state);
	updateActions();

	return {
		production: production(state), 
		price, 
		conversions,
		actions, 
		storageActions: storageActions(state).map(a => a.assess()), 
		sciences,
		metaphysicActions: metaphysicActions(),
		furReport: new FurConsumptionReport(state),
	};
}