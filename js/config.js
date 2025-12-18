// ==================== CONFIG ====================
// Game configuration for Havenvoy (Merchant Seas)

export const CONFIG = {
goods: {
rum: { name: 'Rum', basePrice: 25, category: 'commodity', weight: 1, icon: '🍺' },
sugar: { name: 'Sugar', basePrice: 15, category: 'commodity', weight: 2, icon: '🧂' },
tobacco: { name: 'Tobacco', basePrice: 30, category: 'commodity', weight: 1, icon: '🌿' },
spices: { name: 'Spices', basePrice: 60, category: 'luxury', weight: 1, icon: '🌶️' },
tea: { name: 'Tea', basePrice: 45, category: 'luxury', weight: 1, icon: '🍵' },
silk: { name: 'Silk', basePrice: 80, category: 'luxury', weight: 1, icon: '🧵' },
gunpowder: { name: 'Gunpowder', basePrice: 50, category: 'contraband', weight: 2, icon: '💥' },
timber: { name: 'Timber', basePrice: 20, category: 'commodity', weight: 3, icon: '🪵' },
iron: { name: 'Iron', basePrice: 35, category: 'commodity', weight: 3, icon: '⚙️' },
gold: { name: 'Gold', basePrice: 150, category: 'luxury', weight: 1, icon: '🪙' }
},
islands: {
portRoyal: { name: 'Port Royal', position: { x: 0, z: 0 }, faction: 'english', color: 0x2d5016, markets: { rum: { preference: 'exports', targetSupply: 80, targetDemand: 30 }, sugar: { preference: 'exports', targetSupply: 100, targetDemand: 20 }, tobacco: { preference: 'neutral', targetSupply: 50, targetDemand: 50 }, spices: { preference: 'imports', targetSupply: 20, targetDemand: 60 }, tea: { preference: 'imports', targetSupply: 30, targetDemand: 70 }, silk: { preference: 'imports', targetSupply: 15, targetDemand: 50 }, gunpowder: { preference: 'neutral', targetSupply: 40, targetDemand: 40 }, timber: { preference: 'exports', targetSupply: 70, targetDemand: 30 }, iron: { preference: 'imports', targetSupply: 25, targetDemand: 55 }, gold: { preference: 'imports', targetSupply: 10, targetDemand: 40 } } },
tortuga: { name: 'Tortuga', position: { x: 150, z: -80 }, faction: 'pirates', color: 0x4a3728, markets: { rum: { preference: 'imports', targetSupply: 30, targetDemand: 90 }, sugar: { preference: 'neutral', targetSupply: 40, targetDemand: 40 }, tobacco: { preference: 'imports', targetSupply: 20, targetDemand: 70 }, spices: { preference: 'neutral', targetSupply: 30, targetDemand: 30 }, tea: { preference: 'neutral', targetSupply: 20, targetDemand: 20 }, silk: { preference: 'imports', targetSupply: 10, targetDemand: 50 }, gunpowder: { preference: 'exports', targetSupply: 90, targetDemand: 20 }, timber: { preference: 'imports', targetSupply: 25, targetDemand: 60 }, iron: { preference: 'imports', targetSupply: 20, targetDemand: 55 }, gold: { preference: 'exports', targetSupply: 60, targetDemand: 30 } } },
nassau: { name: 'Nassau', position: { x: -120, z: -150 }, faction: 'pirates', color: 0x5c4a32, markets: { rum: { preference: 'exports', targetSupply: 70, targetDemand: 30 }, sugar: { preference: 'exports', targetSupply: 60, targetDemand: 25 }, tobacco: { preference: 'exports', targetSupply: 80, targetDemand: 20 }, spices: { preference: 'imports', targetSupply: 15, targetDemand: 55 }, tea: { preference: 'imports', targetSupply: 10, targetDemand: 45 }, silk: { preference: 'imports', targetSupply: 10, targetDemand: 40 }, gunpowder: { preference: 'exports', targetSupply: 75, targetDemand: 30 }, timber: { preference: 'exports', targetSupply: 90, targetDemand: 20 }, iron: { preference: 'imports', targetSupply: 20, targetDemand: 60 }, gold: { preference: 'neutral', targetSupply: 25, targetDemand: 25 } } },
havana: { name: 'Havana', position: { x: -80, z: 100 }, faction: 'neutral', color: 0x3d6b2e, markets: { rum: { preference: 'exports', targetSupply: 85, targetDemand: 25 }, sugar: { preference: 'exports', targetSupply: 95, targetDemand: 15 }, tobacco: { preference: 'exports', targetSupply: 90, targetDemand: 20 }, spices: { preference: 'neutral', targetSupply: 40, targetDemand: 40 }, tea: { preference: 'imports', targetSupply: 15, targetDemand: 60 }, silk: { preference: 'imports', targetSupply: 10, targetDemand: 55 }, gunpowder: { preference: 'imports', targetSupply: 20, targetDemand: 70 }, timber: { preference: 'neutral', targetSupply: 50, targetDemand: 50 }, iron: { preference: 'imports', targetSupply: 25, targetDemand: 65 }, gold: { preference: 'exports', targetSupply: 45, targetDemand: 35 } } },
kingston: { name: 'Kingston', position: { x: 100, z: 120 }, faction: 'english', color: 0x4a7a3a, markets: { rum: { preference: 'neutral', targetSupply: 50, targetDemand: 50 }, sugar: { preference: 'exports', targetSupply: 75, targetDemand: 30 }, tobacco: { preference: 'exports', targetSupply: 65, targetDemand: 35 }, spices: { preference: 'exports', targetSupply: 70, targetDemand: 25 }, tea: { preference: 'imports', targetSupply: 20, targetDemand: 65 }, silk: { preference: 'imports', targetSupply: 15, targetDemand: 50 }, gunpowder: { preference: 'neutral', targetSupply: 35, targetDemand: 35 }, timber: { preference: 'imports', targetSupply: 30, targetDemand: 60 }, iron: { preference: 'imports', targetSupply: 25, targetDemand: 55 }, gold: { preference: 'imports', targetSupply: 15, targetDemand: 45 } } },
barbados: { name: 'Barbados', position: { x: 200, z: 50 }, faction: 'eitc', color: 0x5a8a4a, markets: { rum: { preference: 'exports', targetSupply: 90, targetDemand: 20 }, sugar: { preference: 'exports', targetSupply: 95, targetDemand: 15 }, tobacco: { preference: 'neutral', targetSupply: 45, targetDemand: 45 }, spices: { preference: 'neutral', targetSupply: 40, targetDemand: 40 }, tea: { preference: 'imports', targetSupply: 20, targetDemand: 70 }, silk: { preference: 'imports', targetSupply: 15, targetDemand: 60 }, gunpowder: { preference: 'imports', targetSupply: 25, targetDemand: 55 }, timber: { preference: 'imports', targetSupply: 30, targetDemand: 55 }, iron: { preference: 'imports', targetSupply: 20, targetDemand: 60 }, gold: { preference: 'imports', targetSupply: 10, targetDemand: 50 } } },
cartagena: { name: 'Cartagena', position: { x: -180, z: -50 }, faction: 'neutral', color: 0x6a5a3a, markets: { rum: { preference: 'imports', targetSupply: 30, targetDemand: 60 }, sugar: { preference: 'neutral', targetSupply: 45, targetDemand: 45 }, tobacco: { preference: 'imports', targetSupply: 25, targetDemand: 55 }, spices: { preference: 'exports', targetSupply: 65, targetDemand: 30 }, tea: { preference: 'neutral', targetSupply: 35, targetDemand: 35 }, silk: { preference: 'exports', targetSupply: 55, targetDemand: 30 }, gunpowder: { preference: 'imports', targetSupply: 20, targetDemand: 70 }, timber: { preference: 'neutral', targetSupply: 50, targetDemand: 50 }, iron: { preference: 'exports', targetSupply: 60, targetDemand: 35 }, gold: { preference: 'exports', targetSupply: 70, targetDemand: 20 } } }
},
factions: {
english: { name: 'Royal Navy', icon: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', taxRate: 0.05, startingRep: { english: 25, eitc: 0, pirates: -25 }, pirateChanceMult: 0.5, tributeMult: 0.7 },
eitc: { name: 'Trading Co.', icon: '⚓', taxRate: 0, startingRep: { english: 0, eitc: 25, pirates: -15 }, cargoBonus: 0.2, priceBonus: 0.05, logbookBonus: true },
pirates: { name: 'Brethren', icon: '🏴‍☠️', taxRate: 0, startingRep: { english: -30, eitc: -20, pirates: 50 }, contrabandBonus: 0.5, speedBonus: 0.2, pirateChanceMult: 1.3 }
},
// UPGRADES with real tradeoffs - pros array for positive effects, cons array for negative
upgrades: {
swiftSails: {
name: 'Swift Sails', cost: 600, icon: '🎐',
desc: 'Better wind usage but fragile rigging needs more upkeep',
pros: ['+30% wind bonus'],
cons: ['+0.5 supplies/day'],
effects: { windBonus: 0.3, supplyCostExtra: 0.5 }
},
reinforcedHold: {
name: 'Reinforced Hold', cost: 750, icon: '🛡️',
desc: 'Protects cargo in fights but weighs down the ship',
pros: ['50% cargo protection'],
cons: ['-10% speed', '-5 cargo capacity'],
effects: { cargoProtection: 0.5, speedPenalty: 0.1, capacityPenalty: 5 }
},
luxuryLocker: {
name: 'Luxury Locker', cost: 500, icon: '💎',
desc: 'Specialized storage for delicate luxury goods',
pros: ['+8 luxury capacity'],
cons: ['-3 commodity capacity'],
effects: { luxuryCapBonus: 8, commodityCapPenalty: 3 }
},
smugglerCompartments: {
name: 'Smuggler Compartments', cost: 650, icon: '🕳️',
desc: 'Hidden spaces reduce inspection risk but take room',
pros: ['-50% inspection chance', '+10% contraband profit'],
cons: ['-4 total capacity', '+0.25 supplies/day'],
effects: { inspectionReduction: 0.5, contrabandProfitBonus: 0.1, capacityPenalty: 4, supplyCostExtra: 0.25 }
},
vault: {
name: 'Iron Vault', cost: 900, icon: '🔒',
desc: 'Protects wealth from pirates but heavy and expensive',
pros: ['-40% tribute cost', '-30% gold loss in fights'],
cons: ['-8% speed', '-3 capacity'],
effects: { tributeReduction: 0.4, goldProtection: 0.3, speedPenalty: 0.08, capacityPenalty: 3 }
}
},
// TITLES - endless progression tiers
titles: {
merchant: {
    name: 'Merchant',
    icon: '💰',
    thresholds: [500, 2000, 5000, 15000, 50000], // net worth
    tierNames: ['Peddler', 'Trader', 'Merchant', 'Magnate', 'Tycoon', 'Legend'],
    effects: { repGainMult: 0.02 } // +2% per tier
},
smuggler: {
    name: 'Smuggler',
    icon: '🏴‍☠️',
    thresholds: [5, 20, 50, 100, 200], // lifetime contraband traded
    tierNames: ['Runner', 'Smuggler', 'Kingpin', 'Shadow Lord', 'Ghost', 'Phantom'],
    effects: { repLossReduction: 0.04, tributeReduction: 0.03 } // per tier
},
voyager: {
    name: 'Voyager',
    icon: '🧭',
    thresholds: [10, 30, 75, 150, 300], // days sailed
    tierNames: ['Deckhand', 'Sailor', 'Voyager', 'Navigator', 'Admiral', 'Legend'],
    effects: { inspectionReduction: 0.02 } // per tier
}
},
// CONTRACT TYPES - BALANCE: Reduced rewards & rep, contracts supplement trading not replace it
contractTypes: {
delivery: { name: 'Delivery', icon: '📦', baseReward: 50, repReward: 2, riskMult: 1.0 },        // Rep 5->2, just a routine delivery
smuggling: { name: 'Smuggling', icon: '🏴‍☠️', baseReward: 100, repReward: -5, riskMult: 1.8, heatGain: 20 }, // Rep penalty stays
courier: { name: 'Courier', icon: '✉️', baseReward: 25, repReward: 2, riskMult: 0.8, depositPct: 0.3 },  // Rep 5->2, just travel
supply: { name: 'Supply Run', icon: '🍖', baseReward: 20, repReward: 2, riskMult: 0.6, supplyCost: 8 },  // Rep 3->2, minor help
faction: { name: 'Faction Work', icon: '⚔️', baseReward: 15, repReward: 5, riskMult: 1.2 }    // Rep 12->5, was way too high
},
events: [
{ id: 'festival', name: 'Festival', desc: 'Luxury demand up!', duration: 3, affects: ['luxury'], multiplier: 1.5 },
{ id: 'shortage', name: 'Shortage', desc: 'Prices up!', duration: 4, affects: ['commodity'], multiplier: 1.4 },
{ id: 'surplus', name: 'Surplus', desc: 'Prices down!', duration: 3, affects: ['commodity'], multiplier: 0.7 }
],
// REGIONAL EVENTS for living world
regionalEvents: [
{ id: 'trade_boom', name: 'Trade Boom', desc: 'All prices up 20%', duration: 5, categoryMult: { commodity: 1.2, luxury: 1.2, contraband: 1.1 } },
{ id: 'pirate_activity', name: 'Pirate Activity', desc: 'Contraband prices soar', duration: 4, categoryMult: { commodity: 1.0, luxury: 1.0, contraband: 1.5 } },
{ id: 'naval_blockade', name: 'Naval Blockade', desc: 'Commodity shortage', duration: 4, categoryMult: { commodity: 1.4, luxury: 1.1, contraband: 0.8 } },
{ id: 'merchant_fair', name: 'Merchant Fair', desc: 'Luxury demand high', duration: 3, categoryMult: { commodity: 0.9, luxury: 1.4, contraband: 1.0 } }
],
encounters: {
storm: { name: 'Storm!', icon: '🌊', desc: 'A violent storm approaches!', baseChance: 0.04 },
adriftMerchant: { name: 'Adrift Merchant', icon: '🚢', desc: 'A merchant offers a trade.', baseChance: 0.03 },
wreckSalvage: { name: 'Wreckage', icon: '⚓', desc: 'Floating debris. Investigate?', baseChance: 0.03 },
inspection: { name: 'Inspection!', icon: '🔍', desc: 'Naval patrol demands to search your vessel!', baseChance: 0.05 },
// === LIVING SEA ENCOUNTERS ===
desperateMerchant: { name: 'The Desperate Merchant', icon: '😰', desc: 'A damaged trader hails you. They\'re out of supplies and offer their cargo at half price—but taking it means they\'ll die at sea.', baseChance: 0.02 },
driftingMarket: { name: 'The Drifting Market', icon: '🛒', desc: 'The Free Merchants—no flags, no tariffs, no promises. They\'re packing up. Last chance.', baseChance: 0.0 }, // Triggered by drift entity
blockadeRunner: { name: 'The Blockade Runner', icon: '🏃', desc: 'A smuggler offers to guide you through a blockaded port for a fee.', baseChance: 0.02 },
stormsEye: { name: 'The Storm\'s Eye', icon: '🌀', desc: 'Mid-storm, you find a pocket of calm with a wrecked ship.', baseChance: 0.0 }, // Triggered during storms
pirateFleetEncounter: { name: 'Pirate Armada!', icon: '🏴‍☠️', desc: 'A pirate fleet surrounds you! Multiple ships demand tribute.', baseChance: 0.0 }, // Triggered by drift entity
convoyEncounter: { name: 'Navy Convoy', icon: '⚓', desc: 'You\'ve entered Navy convoy waters. They offer protection—if you submit to inspection.', baseChance: 0.0 } // Triggered by drift entity
},
// PORT STATES - dynamic port conditions
portStates: {
    prosperous: { name: 'Prosperous', icon: '🏛️', desc: 'Fat and happy—and they\'ll inspect every crate.', inspectMult: 1.5, tariffMult: 1.2, priceMult: 0.9, supplyMult: 1.3 },
    struggling: { name: 'Struggling', icon: '📉', desc: 'They need goods. They\'ll overlook... irregularities.', inspectMult: 0.5, tariffMult: 0.8, priceMult: 1.2, supplyMult: 0.7 },
    blockaded: { name: 'Blockaded', icon: '⛔', desc: 'Nothing gets in. Nothing gets out. Officially.', inspectMult: 2.0, tariffMult: 1.5, priceMult: 2.5, supplyMult: 0.2, smugglerBonus: 2.0 },
    lawless: { name: 'Lawless', icon: '💀', desc: 'No law here. Watch your back.', inspectMult: 0, tariffMult: 0, priceMult: 1.1, supplyMult: 0.8, pirateRisk: 0.15 },
    starving: { name: 'Starving', icon: '🍽️', desc: 'They\'ll pay anything. Anything.', inspectMult: 0.3, tariffMult: 0, priceMult: 3.0, supplyMult: 0.1, foodCategory: 'commodity', foodMult: 4.0, reliefRep: 10 },
    flooded: { name: 'Flooded', icon: '🌊', desc: 'Half the docks are underwater. They need everything.', inspectMult: 0.5, tariffMult: 0.5, priceMult: 1.8, supplyMult: 0.4, materialBonus: 1.5 }
},
// SEASONS - 4 distinct seasons with material effects
seasons: {
    calmWinds: { name: 'Calm Winds', icon: '☀️', desc: 'Smooth sailing. Thin margins.', dayStart: 1, dayEnd: 12, stormMult: 0.3, windStrengthBias: -1, priceMult: 1.0, piratesMult: 0.8 },
    tradeWinds: { name: 'Trade Winds', icon: '🌬️', desc: 'The lanes are open. Make your fortune.', dayStart: 13, dayEnd: 30, stormMult: 0.5, windStrengthBias: 1, priceMult: 0.95, piratesMult: 1.0 },
    monsoon: { name: 'Monsoon', icon: '🌧️', desc: 'The sea takes what it wants.', dayStart: 31, dayEnd: 50, stormMult: 3.0, windStrengthBias: 2, priceMult: 1.3, piratesMult: 0.6, supplyCostMult: 1.5 },
    doldrums: { name: 'Doldrums', icon: '🌫️', desc: 'Still water. Restless crews. Patience.', dayStart: 51, dayEnd: 60, stormMult: 0.2, windStrengthBias: -2, priceMult: 1.1, piratesMult: 1.2, speedMult: 0.7 }
},
// MOVING ENTITIES for the Drift Map
driftEntities: {
    stormFront: { name: 'Storm Front', icon: '🌀', color: '#4a8a9a', speed: 8, lifetime: 10, encounterType: 'storm' },
    pirateFleet: { name: 'Pirate Fleet', icon: '🏴‍☠️', color: '#8b2500', speed: 5, lifetime: 15, encounterType: 'pirateFleet', dangerRadius: 40 },
    navyConvoy: { name: 'Navy Convoy', icon: '⚓', color: '#c41e3a', speed: 4, lifetime: 20, encounterType: 'convoy', inspectRadius: 50 },
    floatingMarket: { name: 'Floating Market', icon: '🛒', color: '#c9a227', speed: 3, lifetime: 8, encounterType: 'market', interactRadius: 30 },
    merchantFleet: { name: 'Merchant Fleet', icon: '🚢', color: '#1e4d2b', speed: 4, lifetime: 12, encounterType: 'merchants' }
},
// RUMOR TEMPLATES
rumorTemplates: [
    { template: 'Navy\'s hunting something big near {island}.', type: 'convoy', accuracy: 0.8 },
    { template: '{island} hasn\'t seen a supply ship in weeks.', type: 'shortage', accuracy: 0.85 },
    { template: 'Floating market was seen drifting toward {direction}.', type: 'market', accuracy: 0.7 },
    { template: 'Storm season\'s coming early—old sailors feel it.', type: 'weather', accuracy: 0.6 },
    { template: 'The Company\'s convoy left {island} heavy-laden.', type: 'convoy', accuracy: 0.75 },
    { template: 'Pirates took three ships near {island}.', type: 'pirates', accuracy: 0.9 },
    { template: 'Merchant named Voss made a fortune in {good} last week.', type: 'price', accuracy: 0.7 },
    { template: 'I wouldn\'t trust anything you hear in {island}.', type: 'meta', accuracy: 1.0 },
    { template: '{island} is paying triple for {good}.', type: 'price', accuracy: 0.65 },
    { template: 'The {faction} are cracking down on smugglers.', type: 'crackdown', accuracy: 0.8 },
    { template: 'Heard there\'s a blockade forming around {island}.', type: 'blockade', accuracy: 0.75 },
    { template: 'Plague ship spotted near {island}. Stay clear.', type: 'danger', accuracy: 0.85 },
    { template: '{cove_hint}', type: 'cove', accuracy: 0.9 }
],
// SEASONAL EVENTS - 10 major events
seasonalEvents: [
    { id: 'crimson_tide', name: 'The Crimson Tide', desc: 'Fishing collapsed; food prices spike everywhere', season: 'monsoon', duration: 6, effects: { commodity: 1.8, luxury: 1.0, contraband: 1.1 } },
    { id: 'embargo', name: 'Embargo Declared', desc: 'Two factions at war; convoys double, inspections triple', season: 'any', duration: 8, effects: { inspectMult: 3.0, convoySpawn: 2.0 } },
    { id: 'ghost_fleet', name: 'The Ghost Fleet', desc: 'Pirate armada appears; southern waters deadly', season: 'doldrums', duration: 10, effects: { pirateSpawn: 3.0, piratesMult: 2.0 } },
    { id: 'harvest_glut', name: 'Harvest Glut', desc: 'Food prices crash; luxury demand explodes', season: 'calmWinds', duration: 5, effects: { commodity: 0.6, luxury: 1.5 } },
    { id: 'great_race', name: 'The Great Race', desc: 'First merchant to reach destination wins big', season: 'tradeWinds', duration: 4, effects: { raceBonus: 5.0 } },
    { id: 'plague_ship', name: 'Plague Ship', desc: 'One port quarantined; medicine worth fortunes', season: 'any', duration: 7, effects: { quarantine: true, medicineMult: 3.0 } },
    { id: 'kings_wedding', name: 'The King\'s Wedding', desc: 'Luxury goods worth 3x at capital', season: 'calmWinds', duration: 5, effects: { luxury: 3.0, destination: 'portRoyal' } },
    { id: 'hurricane_season', name: 'Hurricane Season', desc: 'Storms cluster and strengthen; damage doubled', season: 'monsoon', duration: 8, effects: { stormMult: 2.0, stormDamage: 2.0 } },
    { id: 'mutiny_wave', name: 'The Mutiny Wave', desc: 'Random crew events more common', season: 'doldrums', duration: 6, effects: { crewEvents: 2.0, supplyCost: 1.5 } },
    { id: 'free_trade', name: 'Free Trade Week', desc: 'All tariffs suspended; inspections halved', season: 'tradeWinds', duration: 5, effects: { tariffMult: 0, inspectMult: 0.5 } }
],
settings: {
startingGold: 1000, startingSupplies: 30, baseCargoCapacity: 50, baseShipSpeed: 1.0,
baseSupplyRate: 1, dockDistance: 35, islandCollisionRadius: 25,
pirateEncounterChance: 0.08, windChangeDays: 5,
heatDecayPerDay: 2, heatGainContraband: 8, heatGainDockEnglishEITC: 5,
highMarginThreshold: 15, // minimum profit/weight to glow
maxActiveContracts: 3, contractBoardSize: 5, contractRefreshDays: 3,
seasonCycleDays: 60, // Full year cycle (4 seasons)
crackdownDecayPerDay: 2, crackdownMaxLevel: 100,
// Living Sea settings
maxDriftEntities: 8, driftEntitySpawnChance: 0.12, rumorRefreshDays: 2, maxRumorsPerPort: 4,
portStateChangeChance: 0.08, reliefRunThreshold: 10
},
// ==================== BALANCE TUNING ====================
// All balance values in one place for easy adjustment.
//
// === BALANCE PATCH v1.0 - TUNING TABLE ===
//
// SYSTEM                  | VALUE              | RANGE      | EFFECT
// ----------------------- | ------------------ | ---------- | ---------------------------------
// Power Score             |                    |            | Tracks player progression
//   goldWeight            | 0.0005             | 0.0001-0.001 | Higher = gold matters more
//   cargoWeight           | 0.001              | 0.0005-0.005 | Higher = cargo value matters more
//   upgradeWeight         | 200                | 100-500    | Points per upgrade
//   titleWeight           | 50                 | 25-100     | Points per title tier
//   daysWeight            | 2                  | 1-5        | Points per day survived
//   contractsWeight       | 10                 | 5-25       | Points per completed contract
//
// Power Thresholds        |                    |            | Game phase boundaries
//   mid                   | 500                | 300-800    | Early->mid transition
//   late                  | 1500               | 1000-2500  | Mid->late transition
//   endgame               | 3000               | 2000-5000  | Late->endgame transition
//
// Upkeep (gold sinks)     |                    |            | Reduces hoarding
//   crewWagesPerDay       | 3                  | 1-10       | Base daily cost
//   maintenancePerDay     | 2                  | 1-5        | Ship maintenance
//   dockingFee            | 25                 | 10-50      | Per-port cost
//   dockingFeeHostile     | 50                 | 25-100     | Extra for hostile ports
//
// Anti-Spam               |                    |            | Prevents trade loops
//   tradeFatigue.perVisit | 10                 | 5-20       | Trades before penalty
//   tradeFatigue.penalty  | 0.03               | 0.01-0.1   | Price penalty per excess trade
//   bulkTrade.threshold   | 5                  | 3-10       | Units before bulk penalty
//   portVisit.minDays     | 2                  | 1-5        | Days for cooldown reset
//
// Smuggling               |                    |            | Contraband risk/reward
//   heatGainBase          | 12                 | 5-20       | Heat per transaction
//   heatGainPerUnit       | 2                  | 1-5        | Additional heat per unit
//   fenceLimit            | 10                 | 5-20       | Max units per port visit
//   inspectionBaseChance  | 0.08               | 0.03-0.15  | Base inspection chance
//
// Bounty System           |                    |            | Escalating consequences
//   baseGainPerCrime      | 50                 | 25-100     | Bounty per major crime
//   bountyDecayPerDay     | 5                  | 2-15       | Daily decay rate
//   wanted threshold      | 100                | 50-200     | First notoriety tier
//   hunted threshold      | 300                | 200-500    | Second tier
//   infamous threshold    | 600                | 400-1000   | Maximum tier
//
// Encounter Scaling       |                    |            | Power-based difficulty
//   pirateStrengthBase    | 0.1                | 0.05-0.2   | Base tribute %
//   pirateFightWinBase    | 0.5                | 0.3-0.7    | Base win chance
//   wreckPositiveChance   | 0.7                | 0.5-0.9    | Wreck success rate
//   merchantDiscountMax   | 0.5                | 0.3-0.6    | Best merchant discount
//   merchantDiscountMin   | 0.2                | 0.1-0.3    | Worst merchant discount
//
// Contract Balance        |                    |            | Contracts supplement trading
//   delivery.baseReward   | 50                 | 30-80      | Down from 100 - lose goods profit
//   smuggling.baseReward  | 100                | 60-150     | Down from 200 - high risk
//   courier.baseReward    | 25                 | 15-40      | Down from 80 - requires 30% deposit
//   supply.baseReward     | 20                 | 10-35      | Down from 60 - costs 8 supplies
//   faction.baseReward    | 15                 | 10-25      | Down from 50 - rep-focused
//
// Contract Reputation      |                    |            | Rep should match difficulty
//   delivery.repReward    | 2                  | 1-3        | Down from 5 - routine work
//   smuggling.repReward   | -5                 | -3 to -8   | Penalty stays - illegal
//   courier.repReward     | 2                  | 1-3        | Down from 5 - just travel
//   supply.repReward      | 2                  | 1-3        | Down from 3 - minor help
//   faction.repReward     | 5                  | 3-8        | Down from 12 - was way too high
//
// Progression Scaling     |                    |            | Anti-snowball
//   contractRewardMin     | 0.7                | 0.5-0.9    | Min reward multiplier
//   upgradeCostMax        | 2.0                | 1.5-3.0    | Max cost multiplier
//
// === END TUNING TABLE ===

balance: {
    // === PLAYER POWER SCORE WEIGHTS ===
    // Used to calculate overall player strength for scaling
    powerScore: {
        goldWeight: 0.0005,        // 1 point per 2000 gold (range: 0.0001-0.001)
        cargoWeight: 0.001,        // 1 point per 1000 cargo value (range: 0.0005-0.005)
        upgradeWeight: 200,        // Points per upgrade owned (range: 100-500)
        titleWeight: 50,           // Points per title tier (range: 25-100)
        daysWeight: 2,             // Points per day survived (range: 1-5)
        contractsWeight: 10        // Points per completed contract (range: 5-25)
    },
    // Power thresholds for game phases
    powerThresholds: {
        early: 0,      // 0-500 power: early game
        mid: 500,      // 500-1500: mid game
        late: 1500,    // 1500-3000: late game
        endgame: 3000  // 3000+: endgame
    },

    // === ECONOMY CONTROLS ===
    upkeep: {
        enabled: true,
        crewWagesPerDay: 3,        // Base gold per day for crew
        crewWagesPerUpgrade: 1,    // Additional per upgrade owned
        maintenancePerDay: 2,      // Ship maintenance per day
        dockingFee: 25,            // Fee to dock at any port
        dockingFeeHostile: 50      // Additional fee at hostile ports
    },
    demandSaturation: {
        enabled: true,
        decayRate: 0.15,           // Price drops 15% per unit sold above threshold
        threshold: 5,              // Units sold before saturation kicks in
        recoveryPerDay: 2,         // Units of saturation that recover per day
        maxPenalty: 0.5            // Minimum price multiplier (50% of base)
    },
    tradeCooldown: {
        enabled: true,
        sameGoodPenalty: 0.05,     // 5% less profit per repeated same-good trade
        maxPenalty: 0.3,           // Max 30% penalty for repeated trades
        decayPerDay: 0.1           // Penalty decays 10% per day
    },
    bulkTrade: {
        enabled: true,
        threshold: 5,              // Units before bulk penalty kicks in
        penaltyPerUnit: 0.02,      // 2% worse price per unit above threshold
        maxPenalty: 0.3            // Max 30% penalty for bulk trades
    },
    portVisitCooldown: {
        enabled: true,
        minDaysBetween: 2,         // Minimum days between visits for full prices
        penaltyPerEarlyDay: 0.1,   // 10% penalty per day early
        maxPenalty: 0.2            // Max 20% penalty for visiting too soon
    },
    tradeFatigue: {
        enabled: true,
        transactionsPerVisit: 10,  // After N trades, prices worsen
        penaltyPerTrade: 0.03,     // 3% worse per trade after limit
        maxPenalty: 0.25           // Max 25% penalty from fatigue
    },

    // === SMUGGLING BALANCE ===
    smuggling: {
        heatGainBase: 12,          // Heat per contraband transaction (up from 8)
        heatGainPerUnit: 2,        // Additional heat per unit traded
        heatDecayBase: 1,          // Base decay per day (down from 2)
        heatDecayAtSea: 0.5,       // Reduced decay while at sea
        fenceLimit: 10,            // Max contraband units per port per visit
        fenceLimitDecayDays: 5,    // Days for fence limit to reset
        priceDropPerUnit: 0.03,    // 3% price drop per unit sold to fence
        inspectionBaseChance: 0.08, // Increased base inspection chance
        inspectionHeatMult: 1.5    // Heat multiplier for inspection chance
    },

    // === BOUNTY/NOTORIETY SYSTEM ===
    bounty: {
        enabled: true,
        baseGainPerCrime: 50,      // Gold bounty per major infraction
        contrabandBounty: 10,      // Per contraband unit when caught
        fleeingBounty: 25,         // Bounty for fleeing inspection
        bountyDecayPerDay: 5,      // Bounty decay per day
        bountyDecayDocked: 10,     // Faster decay when docked at friendly port
        // Bounty thresholds trigger different responses
        thresholds: {
            wanted: 100,           // Inspections more frequent
            hunted: 300,           // Navy actively seeks you
            infamous: 600          // Bounty hunters appear
        },
        // Bounty affects tribute demands
        tributeBountyMult: 0.002   // +0.2% tribute per bounty point
    },

    // === ENCOUNTER SCALING ===
    encounters: {
        pirateStrengthBase: 0.1,   // Base tribute % of gold
        pirateStrengthPower: 0.0001, // Additional % per power point
        pirateMinTribute: 50,      // Minimum tribute
        pirateFightWinBase: 0.5,   // Base fight win chance
        pirateFightWinPenalty: 0.05, // Reduced by this per power tier
        pirateLootBase: 50,        // Base loot from winning
        pirateLootPowerMult: 0.02, // Loot scales slightly with power
        wreckPositiveChance: 0.7,  // Down from 90% positive
        merchantDiscountMax: 0.5,  // Merchant discount capped at 50%
        merchantDiscountMin: 0.2   // Min discount (gets worse with power)
    },

    // === PROGRESSION SCALING ===
    progression: {
        contractRewardBase: 1.0,        // Base multiplier
        contractRewardPowerMult: -0.0001, // Slight decrease per power point
        contractRewardMin: 0.7,         // Minimum 70% of base reward
        upgradeCostPowerMult: 0.0005,   // Upgrades cost more as power grows
        upgradeCostMax: 2.0,            // Max 2x base cost
        titleBonusDecay: 0.9            // Each title tier bonus is 90% of previous
    },

    // === DIFFICULTY SCALING ===
    difficulty: {
        inspectionPowerMult: 0.0002,  // Inspection chance increases with power
        piratePowerMult: 0.0001,      // Pirate encounter rate scales
        stormPowerMult: 0,            // Storms don't scale (nature doesn't care)
        priceVolatilityPower: 0.0001, // Markets more volatile at high power
        maxScaling: 2.0               // Cap on any scaling multiplier
    }
},

// ==================== META PRESSURE SYSTEM ====================
// Detects and softly punishes repetitive "meta" behavior patterns
// Makes the world feel alive and responsive to player strategies
metaPressure: {
    enabled: true,
    windowSize: 30,                    // Number of recent events to track
    decayPerDay: 0.02,                 // Bias scores decay 2% per day with variety

    // Thresholds - if top item share exceeds this, bias starts building
    thresholds: {
        route: 0.30,                   // 30% of routes are same = starts bias
        good: 0.35,                    // 35% of trades are same good
        port: 0.30,                    // 30% of visits to same port
        faction: 0.45                  // 45% of interactions in same faction's territory
    },

    // Effect caps - maximum additional penalties from meta pressure
    caps: {
        pirateChance: 0.25,            // +25% max pirate encounter chance
        stormChance: 0.20,             // +20% max storm chance on route
        priceReduction: 0.20,          // -20% max sell price for oversold good
        saturationMult: 1.5,           // 1.5x faster market saturation
        dockFeeIncrease: 0.30,         // +30% max dock fee at over-visited ports
        inspectionChance: 0.15         // +15% max inspection chance
    },

    // Milestones for player feedback (as pressure crosses these values)
    feedbackMilestones: [0.3, 0.5, 0.7, 0.9],

    // Flavor text for world adaptation notifications
    flavorText: {
        route: {
            rising: [
                'Pirates have noted your regular course...',
                'Lookouts report ships watching your usual lanes.',
                'Your route has become... predictable.'
            ],
            peak: [
                'Every pirate on the sea knows where to find you.',
                'Your lanes are crawling with opportunists.',
                'The seas grow dangerous along your path.'
            ]
        },
        good: {
            rising: [
                'Markets are flooded with your preferred cargo...',
                'Merchants grumble about your saturation tactics.',
                'Supply is catching up with your demand.'
            ],
            peak: [
                'Nobody wants more of what you\'re selling.',
                'The market groans under the weight of your goods.',
                'Buyers scatter when they see your sail.'
            ]
        },
        port: {
            rising: [
                'Dock fees are rising at your favorite port...',
                'Officials grow suspicious of your frequent visits.',
                'The harbormaster knows you by name now.'
            ],
            peak: [
                'They\'ve learned all your tricks here.',
                'Every official has their hand out when you dock.',
                'Perhaps try a different port for a while.'
            ]
        },
        faction: {
            rising: [
                'The authorities have noticed your patterns...',
                'Patrols are being redirected to watch you.',
                'Your activities have drawn official attention.'
            ],
            peak: [
                'They\'ve assigned someone to track your movements.',
                'The crackdown intensifies wherever you sail.',
                'Perhaps diversify your allegiances.'
            ]
        }
    }
},

// ==================== LIVING SEA UPDATE CONFIG ====================
// Save version for migration
saveVersion: 2,

// Ship Classes - distinct vessel types with different characteristics
shipClasses: {
    sloop: {
        name: 'Sloop',
        icon: '⛵',
        desc: 'Fast and nimble. Perfect for quick runs and escapes.',
        baseSpeed: 1.3,
        cargoCapacity: 35,
        hullMax: 80,
        riggingMax: 100,
        repairCostMult: 0.7,
        upkeepMult: 0.6,
        escapeBonus: 0.25,
        chaseSpeedBonus: 0.2,
        cost: 0 // Starting class
    },
    brigantine: {
        name: 'Brigantine',
        icon: '🚢',
        desc: 'Balanced trader. Good capacity with decent speed.',
        baseSpeed: 1.0,
        cargoCapacity: 50,
        hullMax: 100,
        riggingMax: 100,
        repairCostMult: 1.0,
        upkeepMult: 1.0,
        escapeBonus: 0,
        chaseSpeedBonus: 0,
        cost: 1500
    },
    galleon: {
        name: 'Galleon',
        icon: '🛳️',
        desc: 'Massive cargo hauler. Slow but tough.',
        baseSpeed: 0.7,
        cargoCapacity: 80,
        hullMax: 150,
        riggingMax: 80,
        repairCostMult: 1.5,
        upkeepMult: 1.8,
        escapeBonus: -0.2,
        chaseSpeedBonus: -0.15,
        cost: 4000
    }
},

// Officers - crew members with perks and drawbacks
officers: {
    quartermaster: {
        name: 'Quartermaster',
        role: 'quartermaster',
        icon: '📋',
        perk: 'Reduces upkeep by 25% and cargo loss by 30%',
        drawback: 'Demands higher wage',
        effects: { upkeepMult: 0.75, cargoProtection: 0.3 },
        baseWage: 8,
        rarity: 'common'
    },
    navigator: {
        name: 'Navigator',
        role: 'navigator',
        icon: '🧭',
        perk: 'Reveals wind predictions and reduces travel time',
        drawback: 'Requires expensive charts',
        effects: { windPrediction: true, speedBonus: 0.1 },
        baseWage: 10,
        rarity: 'uncommon'
    },
    gunner: {
        name: 'Master Gunner',
        role: 'gunner',
        icon: '💣',
        perk: '+30% combat win chance, +20% boarding loot',
        drawback: 'Increases maintenance costs',
        effects: { combatBonus: 0.3, lootBonus: 0.2, maintenanceMult: 1.25 },
        baseWage: 12,
        rarity: 'uncommon'
    },
    smuggler: {
        name: 'Smuggler Contact',
        role: 'smuggler',
        icon: '🕵️',
        perk: '-40% inspection chance, +15% fence prices',
        drawback: 'Increases heat gain',
        effects: { inspectionReduction: 0.4, fenceBonus: 0.15, heatMult: 1.3 },
        baseWage: 15,
        rarity: 'rare'
    },
    surgeon: {
        name: 'Ship Surgeon',
        role: 'surgeon',
        icon: '⚕️',
        perk: 'Crew morale recovers faster, +5 max morale',
        drawback: 'Requires medical supplies',
        effects: { moraleRecovery: 1.5, maxMoraleBonus: 5, supplyCostExtra: 0.5 },
        baseWage: 10,
        rarity: 'uncommon'
    },
    bosun: {
        name: 'Bosun',
        role: 'bosun',
        icon: '🔧',
        perk: 'Ship repairs are 30% cheaper, rigging wear -20%',
        drawback: 'Strict discipline affects morale',
        effects: { repairDiscount: 0.3, riggingWearMult: 0.8, moralePenalty: 5 },
        baseWage: 8,
        rarity: 'common'
    }
},

// Hidden Coves - discoverable locations
hiddenCoves: {
    smugglersReef: {
        name: "Smuggler's Reef",
        icon: '🏴‍☠️',
        desc: 'A hidden cove where smugglers fence goods off the books.',
        type: 'fence',
        position: { x: -200, z: 100 },
        services: ['fence', 'rumors'],
        discoveryHint: 'Pirates whisper of a reef where the Navy never looks...'
    },
    wreckersHaven: {
        name: "Wrecker's Haven",
        icon: '⚓',
        desc: 'Wreckers have salvaged treasures from countless ships.',
        type: 'salvage',
        position: { x: 180, z: -120 },
        services: ['salvage', 'charts'],
        discoveryHint: 'Old sailors speak of lights that lure ships to their doom...'
    },
    healersIsle: {
        name: "Healer's Isle",
        icon: '🏥',
        desc: 'A remote sanctuary where ships can repair cheaply.',
        type: 'repair',
        position: { x: -50, z: -180 },
        services: ['repair', 'rest'],
        discoveryHint: 'They say there is an island where even the most battered ship can be made whole...'
    },
    piratesCache: {
        name: "Blackbeard's Cache",
        icon: '💰',
        desc: 'Legendary pirate treasure, if you can find it.',
        type: 'treasure',
        position: { x: 220, z: 150 },
        services: ['treasure'],
        discoveryHint: 'The map speaks of gold buried where the sun sets on the third day...'
    }
},

// Questlines - tiered progression system (complete tier to unlock next)
// Anti-cheese: goods must be acquired AFTER starting the questline
questlines: {
    // === TIER 1: Starter questlines (available immediately) ===
    courier_run: {
        id: 'courier_run',
        name: 'Courier Run',
        icon: '📦',
        desc: 'A simple delivery job to prove your reliability.',
        faction: 'neutral',
        tier: 1,
        steps: [
            { type: 'deliver_count', goods: { timber: 2 }, to: 'kingston', count: 2, reward: 25, desc: 'Deliver timber to Kingston' },
            { type: 'collect', at: 'portRoyal', desc: 'Collect payment at Port Royal' }
        ],
        rewards: { gold: 100, reputation: { english: 3, eitc: 2 } },
        deadline: 20
    },
    rum_runner: {
        id: 'rum_runner',
        name: 'Rum Runner',
        icon: '🍺',
        desc: 'The pirates need supplies. Keep it quiet.',
        faction: 'pirates',
        tier: 1,
        steps: [
            { type: 'deliver_count', goods: { rum: 3 }, to: 'tortuga', count: 2, reward: 30, desc: 'Deliver rum to Tortuga' },
            { type: 'collect', at: 'nassau', desc: 'Collect payment at Nassau' }
        ],
        rewards: { gold: 120, reputation: { pirates: 5 } },
        deadline: 20
    },
    company_errand: {
        id: 'company_errand',
        name: 'Company Errand',
        icon: '📋',
        desc: 'The Trading Company needs a reliable courier.',
        faction: 'eitc',
        tier: 1,
        steps: [
            { type: 'deliver_count', goods: { spices: 2 }, to: 'havana', count: 2, reward: 35, desc: 'Deliver spices to Havana' },
            { type: 'collect', at: 'barbados', desc: 'Collect payment at Barbados' }
        ],
        rewards: { gold: 130, reputation: { eitc: 5, english: 2 } },
        deadline: 20
    },

    // === TIER 2: Unlocked after completing any Tier 1 ===
    relief_effort: {
        id: 'relief_effort',
        name: 'The Relief Effort',
        icon: '🏥',
        desc: 'Help struggling ports by delivering essential supplies.',
        faction: 'neutral',
        tier: 2,
        requires: 1, // Requires 1 tier-1 completion
        steps: [
            { type: 'deliver_count', goods: { timber: 3, iron: 2 }, to: 'kingston', count: 3, reward: 40, desc: 'Deliver supplies to Kingston' },
            { type: 'collect', at: 'portRoyal', desc: 'Collect payment at Port Royal' }
        ],
        rewards: { gold: 250, reputation: { english: 8, eitc: 5 }, title: 'Benefactor' },
        deadline: 25
    },
    smuggling_ring: {
        id: 'smuggling_ring',
        name: 'The Smuggling Ring',
        icon: '🏴‍☠️',
        desc: 'Run contraband for the pirate network.',
        faction: 'pirates',
        tier: 2,
        requires: 1,
        steps: [
            { type: 'deliver_count', goods: { gunpowder: 4 }, to: 'tortuga', count: 2, reward: 60, desc: 'Smuggle gunpowder to Tortuga' },
            { type: 'deliver_count', goods: { gunpowder: 4 }, to: 'nassau', count: 2, reward: 60, desc: 'Smuggle gunpowder to Nassau' },
            { type: 'collect', at: 'tortuga', desc: 'Collect payment at Tortuga' }
        ],
        rewards: { gold: 350, reputation: { pirates: 10 } },
        deadline: 30
    },
    trading_company: {
        id: 'trading_company',
        name: 'Company Contract',
        icon: '⚓',
        desc: 'Establish yourself as a Trading Company supplier.',
        faction: 'eitc',
        tier: 2,
        requires: 1,
        steps: [
            { type: 'deliver_count', goods: { tea: 2, spices: 2 }, to: 'havana', count: 3, reward: 50, desc: 'Supply luxuries to Havana' },
            { type: 'collect', at: 'havana', desc: 'Collect bonus at Havana' }
        ],
        rewards: { gold: 300, reputation: { eitc: 10, english: 5 } },
        deadline: 28
    },

    // === TIER 3: Unlocked after completing any Tier 2 ===
    crown_service: {
        id: 'crown_service',
        name: 'Crown Service',
        icon: '👑',
        desc: 'Prove your loyalty to the Crown through naval supply runs.',
        faction: 'english',
        tier: 3,
        requires: 2,
        steps: [
            { type: 'deliver_count', goods: { iron: 4, timber: 4 }, to: 'portRoyal', count: 3, reward: 50, desc: 'Deliver naval supplies to Port Royal' },
            { type: 'deliver_count', goods: { gunpowder: 3 }, to: 'kingston', count: 2, reward: 60, desc: 'Supply munitions to Kingston' },
            { type: 'collect', at: 'portRoyal', desc: 'Receive Royal commendation' }
        ],
        rewards: { gold: 500, reputation: { english: 15, pirates: -10 }, pardon: true, title: 'Privateer' },
        deadline: 35
    },
    pirate_lord: {
        id: 'pirate_lord',
        name: 'Pirate Lord\'s Favor',
        icon: '💀',
        desc: 'Arm the pirate fleet for a major operation.',
        faction: 'pirates',
        tier: 3,
        requires: 2,
        steps: [
            { type: 'deliver_count', goods: { gunpowder: 6, iron: 4 }, to: 'tortuga', count: 3, reward: 80, desc: 'Arm Tortuga' },
            { type: 'deliver_count', goods: { gunpowder: 6, iron: 4 }, to: 'nassau', count: 3, reward: 80, desc: 'Arm Nassau' },
            { type: 'collect', at: 'tortuga', desc: 'Receive the Pirate Lord\'s blessing' }
        ],
        rewards: { gold: 600, reputation: { pirates: 20, english: -15, eitc: -10 }, unlocks: 'smugglersReef', title: 'Smuggler King' },
        deadline: 40
    },
    merchant_prince: {
        id: 'merchant_prince',
        name: 'Merchant Prince',
        icon: '💎',
        desc: 'Become the premier luxury goods supplier in the Caribbean.',
        faction: 'eitc',
        tier: 3,
        requires: 2,
        steps: [
            { type: 'deliver_count', goods: { silk: 3, tea: 3 }, to: 'havana', count: 3, reward: 70, desc: 'Supply Havana\'s elite' },
            { type: 'deliver_count', goods: { spices: 4, silk: 2 }, to: 'cartagena', count: 2, reward: 80, desc: 'Exclusive Cartagena delivery' },
            { type: 'collect', at: 'havana', desc: 'Receive your merchant charter' }
        ],
        rewards: { gold: 700, reputation: { eitc: 18, english: 8 }, title: 'Merchant Prince' },
        deadline: 40
    }
},

// Ship Condition tuning
shipCondition: {
    // Wear rates per day at sea
    hullWearBase: 0.5,
    hullWearStorm: 5,
    hullWearOverload: 2,
    riggingWearBase: 0.3,
    riggingWearStorm: 3,
    riggingWearHighWind: 1,
    moraleWearBase: 0.5,
    moraleDoldrumsExtra: 2,
    moraleLowSuppliesExtra: 3,

    // Thresholds for penalties
    criticalThreshold: 30,
    warningThreshold: 50,

    // Effects of low condition
    lowHullSinkChance: 0.05,      // Per storm at hull < 30
    lowHullRepairPenalty: 0.5,    // Sea repairs 50% less effective
    lowRiggingSpeedPenalty: 0.3,  // -30% speed at rigging < 30
    lowRiggingEscapePenalty: 0.25, // -25% escape chance
    lowMoraleEncounterBonus: 0.2, // +20% encounter chance
    lowMoraleMutinyChance: 0.02,  // Per day at morale < 30

    // Repair costs (gold per point)
    dockRepairCostHull: 3,
    dockRepairCostRigging: 2,
    dockRestCost: 15,
    seaRepairCostSupplies: 1,     // Supplies per 5 points

    // Recovery rates
    dockRepairRate: 20,           // Points per rest action
    seaRepairRate: 10,
    dockMoraleRecovery: 15
},

// Chase encounter system
chase: {
    baseDuration: 15000,          // 15 seconds
    minDuration: 10000,
    maxDuration: 20000,
    baseEscapeChance: 0.5,
    windSpeedFactor: 0.15,
    cargoWeightPenalty: 0.005,    // Per cargo unit
    riggingFactor: 0.003,         // Per rigging point
    hazardChance: 0.15,
    hazardTypes: ['rocks', 'storm', 'shallows'],
    jukeCooldown: 3000,
    jukeBonus: 0.1
},

// Bounty hunters and pardon
bountyHunters: {
    // Named hunters that appear at infamous level
    hunters: [
        { name: 'Captain Blackwood', icon: '⚔️', strength: 1.2, reward: 200 },
        { name: 'The Iron Maiden', icon: '🗡️', strength: 1.5, reward: 350 },
        { name: 'Admiral Graves', icon: '💀', strength: 2.0, reward: 500 }
    ],
    // Hunter encounter chance per day at sea (by tier)
    encounterChance: {
        wanted: 0,
        hunted: 0.03,
        infamous: 0.08
    },
    // Pardon costs by port type
    pardonCosts: {
        english: { base: 500, perBounty: 2 },
        eitc: { base: 400, perBounty: 1.5 },
        neutral: { base: 800, perBounty: 3 }
    }
},

// Faction war fronts
warFronts: {
    // Island influence change per event
    influencePerTrade: 0.5,
    influencePerQuest: 5,
    influencePerSmuggle: -2,
    stabilityRecoveryPerDay: 0.5,
    blockadeDuration: 5,
    warZoneDuration: 8,
    controlThreshold: 60  // Faction needs 60%+ influence to control
},

// Debug toggles
debug: {
    enabled: false,
    logWear: false,
    logChase: false,
    logBounty: false,
    logQuests: false,
    skipChase: false
}
};

export const WIND_DIRS = [
{ name: 'N', angle: 0, v: { x: 0, z: -1 } }, { name: 'NE', angle: 45, v: { x: 0.7, z: -0.7 } },
{ name: 'E', angle: 90, v: { x: 1, z: 0 } }, { name: 'SE', angle: 135, v: { x: 0.7, z: 0.7 } },
{ name: 'S', angle: 180, v: { x: 0, z: 1 } }, { name: 'SW', angle: 225, v: { x: -0.7, z: 0.7 } },
{ name: 'W', angle: 270, v: { x: -1, z: 0 } }, { name: 'NW', angle: 315, v: { x: -0.7, z: -0.7 } }
];

export const WIND_STR = [{ name: 'Calm', m: 0 }, { name: 'Light', m: 0.15 }, { name: 'Moderate', m: 0.25 }, { name: 'Strong', m: 0.4 }];
