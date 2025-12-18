// ==================== GAME CLASS ====================
// Main game loop and state management

import { CONFIG, WIND_DIRS, WIND_STR } from './config.js';
import { SceneManager } from './scene.js';
import { Joystick } from './joystick.js';
import { UI } from './ui.js';
import { leaderboard } from './leaderboard.js';
import {
    // Power & Phase
    getPlayerPower, getGamePhase, getPowerScaling,
    // Bounty
    getBounty, addBounty, decayBounty, getBountyLevel,
    // Meta pressure
    metaInit, metaRecordRoute, metaRecordTrade, metaRecalcPressure,
    metaUpdateDaily, metaGetModifiers,
    // Economy
    getMarketSaturation, addMarketSaturation, decayMarketSaturation, getSaturationPenalty,
    getFenceUsage, addFenceUsage, canFence, getFenceRemaining,
    calculateDailyUpkeep, calculateDockingFee,
    getTradeFatigue, addTradeFatigue, resetTradeFatigue, getPortVisitPenalty,
    recordPortVisit, getBulkTradePenalty, getAntiSpamSellMult, getAntiSpamBuyMult,
    buyGood, sellGood, calcBuyPrice, calcSellPrice,
    // Titles
    updateTitles,
    // Reputation
    applyRepChange,
    // Contracts
    generateContractsForIsland, acceptContract, abandonContract,
    evaluateContractsOnDock, expireContracts, getTrackedContract, refreshContractBoard,
    // Seasons
    getCurrentSeason, getSeasonModifiers,
    // Port states
    getPortState, updatePortStates,
    // Faction influence
    updateFactionInfluence,
    // Blockades
    getActiveBlockades, isIslandBlockaded, updateBlockades,
    // War zones
    isIslandWarZone, updateWarZones,
    // Hidden coves
    discoverCove, getDiscoveredCoves,
    addChartFragment, canRevealCove, getCoveHint,
    // Drift entities
    spawnDriftEntity, updateDriftEntities, getNearbyDriftEntities,
    // Rumors
    generateRumors, getRumorsForPort,
    // Ship stats
    getCargoCapacity, getCargoUsed,
    // Ship condition
    getShipHull, getShipRigging, getShipMorale, damageHull, damageRigging, damageMorale,
    repairHull, repairRigging, restoreMorale, getRepairCost, isShipCritical,
    // Officers
    getOfficer, hireOfficer, fireOfficer, getOfficerWages, getAvailableOfficersAtPort,
    // Chase system
    calculateEscapeChance, getChaseDuration,
    // Cove rumors
    getCoveRumor,
    // Bounty hunters
    spawnBountyHunter, defeatHunter,
    // Questlines
    startQuestline, advanceQuestline, failQuestline, completeQuestline,
    getQuestlineProgress, checkQuestlineDeadline, checkQuestlineStep,
    // Risk & value
    getRouteRisk, getHighMarginGoods,
    // Heat
    decayHeat, addHeat, decayHeatBalanced,
    // State
    createState, migrateState,
    // Misc helpers
    tickWorldStatePerDay, simMarketDay, getNetWorth, estimateCargoValue,
    getWindEffect, getShipSpeed, getSupplyRate, applyDailyWear, checkMutinyRisk
} from './systems.js';

class Game {
constructor() { this.gameState = null; this.scene = null; this.ui = null; this.joystick = null; this.selectedFaction = null; this.nearbyIsland = null; this.nearbyCove = null; this.lastDayTick = 0; this.init(); }
async init() {
    try {
        this.ui = new UI(this);

        // Initialize leaderboard
        await leaderboard.init();
        this.ui.initLeaderboard(leaderboard);

        for (let i = 0; i <= 100; i += 20) { this.ui.showLoading(i); await new Promise(r => setTimeout(r, 80)); }
        const save = localStorage.getItem('merchantSeasSave');
        setTimeout(() => {
            try {
                this.ui.hideLoading();
                if (save && confirm('Continue saved game?')) {
                    if (!this.load()) {
                        // Load failed, start fresh
                        localStorage.removeItem('merchantSeasSave');
                        this.ui.showFaction();
                    } else {
                        this.start();
                    }
                } else {
                    this.ui.showFaction();
                }
            } catch (e) {
                console.error('Init error:', e);
                this.ui.hideLoading();
                this.ui.showFaction();
            }
        }, 300);
    } catch (e) {
        console.error('Game initialization error:', e);
        document.getElementById('loading-screen')?.classList.add('hidden');
        document.getElementById('faction-screen')?.classList.remove('hidden');
    }
}

startGame(faction) {
    this.gameState = createState(faction); this.ui.hideFaction(); this.ui.showGame();
    this.scene = new SceneManager(document.getElementById('game-canvas')); this.joystick = new Joystick();
    this.ui.updateHUD(this.gameState); this.save(); this.start(); this.ui.toast('Welcome!', 'Sail to Port Royal!');
}

update(dt) {
    if (!this.gameState) return; this.checkNearby();
    if (this.gameState.isDocked) { this.ui.updateSpeed(0, null); return; }
    const gs = this.gameState;
    if (this.joystick?.magnitude > 0.1) {
        const md = { x: -this.joystick.value.x, z: -this.joystick.value.y }, len = Math.sqrt(md.x**2 + md.z**2); if (len) { md.x /= len; md.z /= len; }
        const we = getWindEffect(gs, md), spd = getShipSpeed(gs) * this.joystick.magnitude * 0.8 * we.mult;
        gs.player.position.x = Math.max(-250, Math.min(250, gs.player.position.x + md.x * spd));
        gs.player.position.z = Math.max(-200, Math.min(200, gs.player.position.z + md.z * spd));
        this.ui.updateSpeed(this.joystick.magnitude * we.mult, we); this.ui.updateCompass(this.joystick.angle, gs);
        this.lastDayTick += dt * 1000;
        if (this.lastDayTick > 5000) { this.advanceDay(); this.lastDayTick = 0; this.checkEncounters(); }
    } else { this.ui.updateSpeed(0, null); this.ui.updateCompass(0, gs); }
}

checkNearby() {
    const gs = this.gameState;
    const pp = gs.player.position; let closest = null, cd = Infinity;
    Object.entries(CONFIG.islands).forEach(([id, isl]) => { const d = Math.sqrt((isl.position.x - pp.x)**2 + (isl.position.z - pp.z)**2); if (d < 80 && d < cd) { cd = d; closest = { id, ...isl, dist: d, type: 'island' }; } });

    // Also check for discovered coves
    const discoveredCoves = getDiscoveredCoves(gs);
    for (const coveId of discoveredCoves) {
        const cove = CONFIG.hiddenCoves[coveId];
        if (!cove) continue;
        const d = Math.sqrt((cove.position.x - pp.x)**2 + (cove.position.z - pp.z)**2);
        if (d < 60 && d < cd) { cd = d; closest = { id: coveId, ...cove, dist: d, type: 'cove' }; }
    }

    this.nearbyIsland = closest?.type === 'island' ? closest.id : null;
    this.nearbyCove = closest?.type === 'cove' ? closest.id : null;
    this.ui.updateNearby(closest, cd);
}

advanceDay() {
    const gs = this.gameState;
    gs.player.days++;
    gs.player.daysSinceDock = (gs.player.daysSinceDock || 0) + 1;

    // Update season day counter (cycles within season)
    gs.world.seasonDay = ((gs.world.seasonDay || 1) % CONFIG.settings.seasonCycleDays) + 1;

    // Consume supplies (with upgrade modifiers)
    const supplyRate = getSupplyRate(gs);
    gs.player.supplies -= Math.floor(supplyRate);
    // Handle fractional supply cost via RNG
    if (Math.random() < (supplyRate % 1)) gs.player.supplies--;

    // === BALANCE: Daily upkeep costs ===
    const upkeep = calculateDailyUpkeep(gs);
    if (upkeep > 0) {
        gs.player.gold = Math.max(0, gs.player.gold - upkeep);
        // Track total upkeep for stats
        if (!gs.player.stats.totalUpkeep) gs.player.stats.totalUpkeep = 0;
        gs.player.stats.totalUpkeep += upkeep;
    }

    // === LIVING SEA: Ship condition wear ===
    const windStrength = gs.wind?.strength || 0;
    applyDailyWear(gs, false, windStrength);

    // Check for mutiny at low morale
    if (checkMutinyRisk(gs)) {
        // Mutiny event - lose some gold and supplies
        const goldLoss = Math.floor(gs.player.gold * 0.1);
        const supplyLoss = Math.floor(gs.player.supplies * 0.2);
        gs.player.gold = Math.max(0, gs.player.gold - goldLoss);
        gs.player.supplies = Math.max(0, gs.player.supplies - supplyLoss);
        this.ui.showWarning('⚔️', 'Mutiny!', `Crew unrest! Lost ${goldLoss}g and ${supplyLoss} supplies.`);
        restoreMorale(gs, 20); // Situation calms after confrontation
    }

    // Ship condition warnings
    if (getShipHull(gs) < CONFIG.shipCondition.criticalThreshold) {
        this.ui.showWarning('🔨', 'Hull Critical!', 'Repair at port or risk sinking!');
    } else if (getShipRigging(gs) < CONFIG.shipCondition.criticalThreshold) {
        this.ui.showWarning('⛵', 'Rigging Failing!', 'Speed reduced. Repair soon!');
    }

    // Check questline deadline
    if (checkQuestlineDeadline(gs)) {
        this.ui.showWarning('📜', 'Quest Failed!', 'You ran out of time.');
    }

    // Check for bounty hunter encounter
    const bountyLevel = getBountyLevel(gs);
    const hunterChance = CONFIG.bountyHunters.encounterChance[bountyLevel] || 0;
    if (hunterChance > 0 && Math.random() < hunterChance) {
        const hunter = spawnBountyHunter(gs);
        if (hunter) {
            this.triggerBountyHunter(hunter);
            return; // Skip normal day processing
        }
    }

    // === BALANCE: Decay systems ===
    // Heat decays slower at sea
    decayHeatBalanced(gs, false);

    // Bounty decays
    decayBounty(gs, false, false);

    // Market saturation recovers
    decayMarketSaturation(gs);

    // Meta pressure daily decay and milestone checks
    metaUpdateDaily(gs, (title, msg) => this.ui.toast(title, msg));

    simMarketDay(gs);

    // Tick world state
    tickWorldStatePerDay(gs);

    // Check contract expirations
    const expired = expireContracts(gs);
    if (expired.length > 0) {
        this.ui.toast('Contract Failed', `${expired.length} contract(s) expired!`);
    }

    // Update titles
    const oldTitles = { ...gs.player.titles };
    updateTitles(gs, (icon, name, desc) => {
        this.ui.showTitleEarned(icon, name, desc);
    });

    // Wind changes
    if (gs.wind) {
        gs.wind.daysUntilChange--;
        if (gs.wind.daysUntilChange <= 0) {
            gs.wind.direction = Math.floor(Math.random() * 8);
            gs.wind.strength = Math.floor(Math.random() * 4);
            gs.wind.daysUntilChange = CONFIG.settings.windChangeDays;
            this.ui.toast('Wind', WIND_STR[gs.wind.strength].name + ' ' + WIND_DIRS[gs.wind.direction].name);
        }
    }

    this.ui.updateHUD(gs);
    if (gs.player.supplies <= 5 && gs.player.supplies > 0) this.ui.showWarning('🍖', 'Low Supplies!', 'Dock soon!');
    else if (gs.player.supplies <= 0) { gs.player.supplies = 0; this.ui.showWarning('💀', 'Stranded!', 'Find port fast!'); }
}

checkEncounters() {
    const gs = this.gameState, fc = CONFIG.factions[gs.player.faction];
    const risk = getRouteRisk(gs);
    const cargoVal = estimateCargoValue(gs);
    const mods = getTitleModifiers(gs);
    const seasonMods = getSeasonModifiers(gs);

    // === META PRESSURE: Calculate route-based modifiers ===
    const meta = metaInit(gs);
    const currentRouteKey = meta.lastPort && this.nearbyIsland
        ? [meta.lastPort, this.nearbyIsland].sort().join('>')
        : null;
    const metaMods = metaGetModifiers(gs, {
        route: currentRouteKey,
        port: this.nearbyIsland,
        faction: this.nearbyIsland ? CONFIG.islands[this.nearbyIsland]?.faction : null
    });

    // === LIVING SEA: Check for blockade encounters when near blockaded islands ===
    const nearestBlockaded = this.getNearbyBlockadedIsland(gs);
    if (nearestBlockaded && Math.random() < 0.15) {
        this.triggerBlockadeEncounter(nearestBlockaded);
        return;
    }

    // === LIVING SEA: Check for drift entity encounters first ===
    const nearbyEntities = getNearbyDriftEntities(gs, 60);
    for (const entity of nearbyEntities) {
        if (entity.distance < (entity.config.dangerRadius || entity.config.inspectRadius || entity.config.interactRadius || 30)) {
            // Mark entity as encountered to prevent repeated triggers
            if (entity.lastEncounterDay === gs.player.days) continue;
            entity.lastEncounterDay = gs.player.days;

            switch (entity.typeId) {
                case 'pirateFleet':
                    // Skip if player has convoy protection
                    if (gs.player.convoyProtection && gs.player.convoyProtection >= gs.player.days) continue;
                    this.triggerPirateFleetEncounter(entity);
                    return;
                case 'navyConvoy':
                    this.triggerConvoyEncounter(entity);
                    return;
                case 'floatingMarket':
                    this.triggerDriftingMarket(entity);
                    return;
                case 'stormFront':
                    // Storm front triggers storm encounter with chance for Storm's Eye
                    if (Math.random() < 0.25) {
                        this.triggerStormsEye();
                    } else {
                        this.triggerStorm();
                    }
                    return;
                case 'merchantFleet':
                    this.triggerMerchantFleet(entity);
                    return;
            }
        }
    }

    // Pirate encounters scale with cargo value, faction, and season
    const pirateBase = CONFIG.settings.pirateEncounterChance * (fc.pirateChanceMult || 1) * (seasonMods.piratesMult || 1);
    let pirateChance = pirateBase * (1 + risk * 0.5); // +50% at max risk
    // === META PRESSURE: Route bias increases pirate chance (they've learned your patterns) ===
    pirateChance *= metaMods.pirateChanceMult;
    // Convoy protection reduces pirate encounters
    if (gs.player.convoyProtection && gs.player.convoyProtection >= gs.player.days) pirateChance *= 0.1;
    if (Math.random() < pirateChance) { this.triggerPirate(); return; }

    // Inspection encounter - scales with heat, crackdown, bounty, port state, and proximity to English/EITC waters
    const bountyLevel = getBountyLevel(gs);
    // Bounty level increases base chance of being inspected
    const bountyInspectMult = { clean: 1.0, wanted: 1.5, hunted: 2.5, infamous: 4.0 }[bountyLevel] || 1.0;
    if (isNearHostileWaters(gs) || gs.player.heat > 30 || bountyLevel !== 'clean') {
        let inspectChance = CONFIG.encounters.inspection.baseChance * (1 + gs.player.heat / 100);
        // === BALANCE: Bounty increases inspection chance significantly ===
        inspectChance *= bountyInspectMult;
        // Crackdown increases inspection chance
        inspectChance *= (1 + getCrackdownLevel(gs) / 100);
        // Seasonal event effects
        if (gs.world?.seasonalEvent?.effects?.inspectMult) {
            inspectChance *= gs.world.seasonalEvent.effects.inspectMult;
        }
        // Port state inspection multiplier (from nearest island)
        if (this.nearbyIsland) {
            const portState = getPortStateConfig(gs, this.nearbyIsland);
            inspectChance *= (portState.inspectMult ?? 1);
        }
        // Smuggler compartments reduce chance (less effective at higher bounty)
        if (gs.player.upgrades?.smugglerCompartments) {
            const compartmentReduction = CONFIG.upgrades.smugglerCompartments.effects.inspectionReduction;
            // Effectiveness reduces with bounty level
            const bountyPenalty = { clean: 0, wanted: 0.25, hunted: 0.5, infamous: 0.75 }[bountyLevel] || 0;
            inspectChance *= (1 - compartmentReduction * (1 - bountyPenalty));
        }
        // Title modifiers
        inspectChance *= (1 - mods.inspectionReduction);
        // === META PRESSURE: Port/faction bias increases inspection chance (they're watching you) ===
        inspectChance *= metaMods.inspectionChanceMult;
        if (Math.random() < inspectChance) { this.triggerInspection(); return; }
    }

    // Storm - scales with season, days at sea
    let stormChance = CONFIG.encounters.storm.baseChance * (1 + gs.player.daysSinceDock / 30) * (seasonMods.stormMult || 1);
    // Seasonal event storm multiplier
    if (gs.world?.seasonalEvent?.effects?.stormMult) {
        stormChance *= gs.world.seasonalEvent.effects.stormMult;
    }
    // === META PRESSURE: Route bias increases storm chance (the sea conspires against predictability) ===
    stormChance *= metaMods.stormChanceMult;
    if (Math.random() < stormChance) {
        // During heavy storms, chance for Storm's Eye encounter
        if (seasonMods.stormMult >= 2 && Math.random() < 0.2) {
            this.triggerStormsEye();
        } else {
            this.triggerStorm();
        }
        return;
    }

    // === LIVING SEA ENCOUNTERS ===

    // Desperate Merchant - more common in harsh seasons
    const desperateChance = CONFIG.encounters.desperateMerchant.baseChance * (seasonMods.stormMult || 1);
    if (Math.random() < desperateChance) { this.triggerDesperateMerchant(); return; }

    // Blockade Runner - near blockaded ports
    for (const iid of Object.keys(CONFIG.islands)) {
        const portState = getPortState(gs, iid);
        if (portState === 'blockaded') {
            const isl = CONFIG.islands[iid];
            const dist = Math.sqrt((isl.position.x - gs.player.position.x)**2 + (isl.position.z - gs.player.position.z)**2);
            if (dist < 100 && Math.random() < CONFIG.encounters.blockadeRunner.baseChance * 2) {
                this.triggerBlockadeRunner();
                return;
            }
        }
    }

    // Merchant/wreck - slightly more common when risk is low (reward safe play)
    const safeBonus = 1 + (1 - risk) * 0.3;
    if (Math.random() < CONFIG.encounters.adriftMerchant.baseChance * safeBonus) { this.triggerMerchant(); return; }
    if (Math.random() < CONFIG.encounters.wreckSalvage.baseChance * safeBonus) { this.triggerWreck(); return; }
}

triggerPirate() {
    const gs = this.gameState;
    // === LIVING SEA: Start chase sequence before pirate confrontation ===
    // Pirates with parley skip the chase
    if (gs.player.faction === 'pirates') {
        this._showPirateEncounter();
        return;
    }
    this.startChase('pirate');
}

// === LIVING SEA: Bounty Hunter Encounters ===
_pendingHunter = null;

triggerBountyHunter(hunter) {
    // Store the hunter for use after chase resolves
    this._pendingHunter = hunter;
    // Start chase with bounty hunter - they're faster than regular pirates
    this.startChase('bounty_hunter');
}

// === LIVING SEA: Chase System ===
_chaseState = null;
_chaseInterval = null;

startChase(type = 'pirate') {
    const gs = this.gameState;
    const escapeChance = calculateEscapeChance(gs);
    const duration = getChaseDuration(gs);

    this._chaseState = {
        type,
        startTime: Date.now(),
        duration,
        escapeChance,
        progress: 0,
        actionsUsed: { trim: false, jettison: false, risky: false },
        cargoJettisoned: 0
    };

    this.ui.showChase(escapeChance, duration);

    // Start chase timer
    this._chaseInterval = setInterval(() => this._updateChase(), 100);
}

_updateChase() {
    if (!this._chaseState) return;

    const elapsed = Date.now() - this._chaseState.startTime;
    const remaining = Math.max(0, this._chaseState.duration - elapsed);
    const progress = Math.min(1, elapsed / this._chaseState.duration);

    this._chaseState.progress = progress;
    this.ui.updateChase(this._chaseState.escapeChance, remaining, progress);

    // Chase resolution
    if (remaining <= 0) {
        this._resolveChase();
    }
}

chaseAction(action) {
    if (!this._chaseState || this._chaseState.actionsUsed[action]) return;

    const gs = this.gameState;
    this._chaseState.actionsUsed[action] = true;

    if (action === 'trim') {
        // Trim sails: +10% escape chance, slight rigging wear
        this._chaseState.escapeChance = Math.min(0.95, this._chaseState.escapeChance + 0.10);
        damageRigging(gs, 5);
        this.ui.toast('Trim Sails', '+10% escape, rigging strain');
    } else if (action === 'jettison') {
        // Jettison cargo: +15% escape chance, lose 20% cargo
        const cargoLost = this.loseCargo(calcCargoLoss(gs, 0.2));
        this._chaseState.cargoJettisoned += cargoLost;
        this._chaseState.escapeChance = Math.min(0.95, this._chaseState.escapeChance + 0.15);
        this.ui.toast('Jettison!', `+15% escape, lost ${cargoLost} cargo`);
    } else if (action === 'risky') {
        // Risky maneuver: 50% chance +25% escape, 50% chance -20% and hull damage
        if (Math.random() < 0.5) {
            this._chaseState.escapeChance = Math.min(0.95, this._chaseState.escapeChance + 0.25);
            this.ui.toast('Daring Move!', '+25% escape chance!');
        } else {
            this._chaseState.escapeChance = Math.max(0.1, this._chaseState.escapeChance - 0.20);
            damageHull(gs, 15);
            this.ui.toast('Risky Failed!', '-20% escape, hull damage');
        }
    }

    // Disable used action button
    this.ui.el['chase-' + action].disabled = true;
    this.ui.updateChase(this._chaseState.escapeChance, this._chaseState.duration - (Date.now() - this._chaseState.startTime), this._chaseState.progress);
    this.ui.updateHUD(gs);
}

_resolveChase() {
    clearInterval(this._chaseInterval);
    this._chaseInterval = null;

    const gs = this.gameState;
    const escaped = Math.random() < this._chaseState.escapeChance;
    const type = this._chaseState.type;

    if (escaped) {
        // Successfully escaped!
        const escapeMsg = type === 'bounty_hunter'
            ? 'You escaped! The bounty hunter loses your trail.'
            : 'You escaped! The pirates fall behind.';
        this.ui.showChaseResult(true, escapeMsg);
        // Small morale boost for exciting escape
        restoreMorale(gs, 5);

        // Escaping bounty hunter doesn't defeat them - they'll be back
        if (type === 'bounty_hunter' && this._pendingHunter) {
            // Small bounty increase for evading justice
            gs.player.bounty = (gs.player.bounty || 0) + 10;
        }

        // === LIVING SEA: Check questline for survive_chase step ===
        const questResult = checkQuestlineStep(gs, 'escape_chase', { type });
        if (questResult.advanced) {
            if (questResult.completed) {
                setTimeout(() => this.ui.showQuestComplete(questResult.rewards), 2100);
            } else {
                setTimeout(() => this.ui.toast('Quest Progress', 'Survived the chase!'), 2100);
            }
        }

        setTimeout(() => {
            this.ui.closeChase();
            this.ui.toast('Escaped!', type === 'bounty_hunter' ? 'Lost the hunter' : 'Lost the pirates');
            this._pendingHunter = null; // Clear pending hunter
        }, 2000);
    } else {
        // Caught! Show appropriate encounter
        const caughtMsg = type === 'bounty_hunter'
            ? 'Caught! The bounty hunter boards your ship.'
            : 'Caught! The pirates board your ship.';
        this.ui.showChaseResult(false, caughtMsg);
        setTimeout(() => {
            this.ui.closeChase();
            if (type === 'pirate') {
                this._showPirateEncounter();
            } else if (type === 'bounty_hunter') {
                this._showBountyHunterEncounter();
            }
        }, 2000);
    }

    this._chaseState = null;
    this.ui.updateHUD(gs);
    this.save();
}

_showPirateEncounter() {
    const gs = this.gameState;
    // Power-scaled tribute calculation
    const enc = CONFIG.balance.encounters;
    const power = getPlayerPower(gs);
    const bounty = getBounty(gs);

    // Base tribute scales with gold AND power
    let tributeRate = enc.pirateStrengthBase + (power * enc.pirateStrengthPower);
    // Bounty makes pirates demand more (they know you're valuable)
    tributeRate *= (1 + bounty * CONFIG.balance.bounty.tributeBountyMult);

    const baseCost = Math.max(enc.pirateMinTribute, Math.floor(gs.player.gold * tributeRate) + enc.pirateMinTribute);
    const cost = calcTributeCost(gs, baseCost);
    this.ui.showPirate(cost, gs.player.faction === 'pirates');
}

_showBountyHunterEncounter() {
    const gs = this.gameState;
    // Use pending hunter from triggerBountyHunter, or spawn new one
    const hunter = this._pendingHunter || spawnBountyHunter(gs);
    this._pendingHunter = null; // Clear for next time

    if (!hunter) {
        this.ui.toast('Close Call', 'The hunter lost your trail');
        return;
    }

    // Calculate bribe cost based on hunter strength and player bounty
    const bounty = getBounty(gs);
    const bribeCost = Math.floor(100 + (bounty * 0.5) + (hunter.strength * 100));

    // Show encounter modal with hunter options
    this.ui.showEncounter({
        icon: hunter.icon,
        title: `${hunter.name} Approaches!`,
        desc: `A notorious bounty hunter has caught up with you. They demand you surrender or pay for your freedom!`
    }, [
        { label: `💰 Pay Bribe (${bribeCost}g)`, style: 'secondary', action: () => this._bribeBountyHunter(hunter, bribeCost) },
        { label: '⚔️ Fight', style: 'danger', action: () => this._fightBountyHunter(hunter) }
    ]);
}

_bribeBountyHunter(hunter, bribeCost) {
    const gs = this.gameState;
    if (gs.player.gold >= bribeCost) {
        gs.player.gold -= bribeCost;
        this.ui.closeEncounter();
        this.ui.toast('Bribed', `${hunter.name} looks the other way`);
    } else {
        this.ui.toast('No Gold', 'Cannot afford the bribe!');
        this._fightBountyHunter(hunter);
    }
    this.ui.updateHUD(gs);
    this.save();
}

_fightBountyHunter(hunter) {
    const gs = this.gameState;
    this.ui.closeEncounter();

    // Fight mechanics - win chance decreases with hunter strength
    // strength: 1.2 (Blackwood) = 35%, 1.5 (Iron Maiden) = 25%, 2.0 (Graves) = 10%
    const winChance = Math.max(0.1, 0.5 - (hunter.strength * 0.2));

    if (Math.random() < winChance) {
        // Victory!
        defeatHunter(gs, hunter.index);
        const reward = hunter.reward || 200;
        gs.player.gold += reward;
        // Defeating hunter reduces bounty slightly
        gs.player.bounty = Math.max(0, (gs.player.bounty || 0) - 50);
        this.ui.toast('Victory!', `Defeated ${hunter.name}! +${reward}g`);
    } else {
        // Lost fight - hunter takes their bounty
        const loss = Math.floor(gs.player.gold * 0.4);
        gs.player.gold = Math.max(0, gs.player.gold - loss);
        this.loseCargo(calcCargoLoss(gs, 0.3));
        damageHull(gs, 25);
        // Increase bounty from escaping (but alive)
        gs.player.bounty = (gs.player.bounty || 0) + 30;
        this.ui.toast('Defeated', `${hunter.name} claims their prize!`);
    }
    this.ui.updateHUD(gs);
    this.save();
}

payTribute() {
    const gs = this.gameState;
    const enc = CONFIG.balance.encounters;
    const power = getPlayerPower(gs);
    const bounty = getBounty(gs);

    let tributeRate = enc.pirateStrengthBase + (power * enc.pirateStrengthPower);
    tributeRate *= (1 + bounty * CONFIG.balance.bounty.tributeBountyMult);

    const baseCost = Math.max(enc.pirateMinTribute, Math.floor(gs.player.gold * tributeRate) + enc.pirateMinTribute);
    const cost = calcTributeCost(gs, baseCost);

    if (gs.player.gold >= cost) {
        gs.player.gold -= cost;
        this.ui.closePirate();
        this.ui.toast('Paid', '-' + cost + 'g');
    } else {
        this.loseCargo(calcCargoLoss(gs, 0.3));
        this.ui.closePirate();
        this.ui.toast('Plundered!', 'Lost cargo');
    }
    this.ui.updateHUD(gs);
}

fight() {
    const gs = this.gameState;
    this.ui.closePirate();

    // Power-scaled fight mechanics
    const enc = CONFIG.balance.encounters;
    const power = getPlayerPower(gs);
    const phase = getGamePhase(gs);

    // Win chance decreases with power (pirates get tougher)
    let winChance = enc.pirateFightWinBase;
    if (phase === 'mid') winChance -= enc.pirateFightWinPenalty;
    else if (phase === 'late') winChance -= enc.pirateFightWinPenalty * 2;
    else if (phase === 'endgame') winChance -= enc.pirateFightWinPenalty * 3;
    winChance = Math.max(0.2, winChance); // Never below 20%

    if (Math.random() < winChance) {
        // Loot scales slightly with power (tougher pirates = better loot)
        const r = Math.floor(enc.pirateLootBase + (power * enc.pirateLootPowerMult) + Math.random() * 100);
        gs.player.gold += r;
        // Pirate reputation boost
        applyRepChange(gs, 'pirates', 5, 'fight_win');
        this.ui.toast('Victory!', '+' + r + 'g');
    } else {
        // Loss is more punishing at higher power
        let cargoLossFrac = 0.5;
        let goldLossFrac = 0.1;
        if (phase === 'late' || phase === 'endgame') {
            cargoLossFrac = 0.6;
            goldLossFrac = 0.15;
        }
        this.loseCargo(calcCargoLoss(gs, cargoLossFrac));
        const goldLoss = calcGoldLoss(gs, Math.floor(gs.player.gold * goldLossFrac));
        gs.player.gold = Math.max(0, gs.player.gold - goldLoss);
        this.ui.toast('Defeated', 'Lost cargo & gold');
    }
    this.ui.updateHUD(gs);
}

loseCargo(frac) {
    const gs = this.gameState;
    Object.keys(gs.player.cargo).forEach(gid => {
        gs.player.cargo[gid] -= Math.ceil(gs.player.cargo[gid] * frac);
        if (gs.player.cargo[gid] <= 0) delete gs.player.cargo[gid];
    });
}

// INSPECTION ENCOUNTER
triggerInspection() {
    const gs = this.gameState, enc = CONFIG.encounters.inspection;
    const contrabandQty = getContrabandCount(gs);
    const hasContraband = contrabandQty > 0;
    const bb = CONFIG.balance.bounty;

    // Mark inspection for active courier contracts with noInspection requirement (per-contract tracking)
    for (const contract of gs.player.contracts.active) {
        if (contract.requirement?.noInspection) {
            contract.wasInspected = true;
        }
    }

    // Crackdown increases
    gs.world.crackdown.level = Math.min(CONFIG.settings.crackdownMaxLevel, (gs.world.crackdown.level || 0) + 5);

    // If no contraband, just a warning
    if (!hasContraband) {
        this.ui.showEncounter(enc, [], { positive: true, text: 'Cargo is clean. You are free to go!' });
        return;
    }

    // Has contraband - calculate penalty (scales with player power)
    const power = getPlayerPower(gs);
    let fine = 50 + contrabandQty * 15 + Math.floor(power * 0.05);

    // Smuggler compartments can hide some (reduced from 40% to 25% with power scaling)
    const hideChance = gs.player.upgrades?.smugglerCompartments
        ? Math.max(0.15, 0.25 - (power * 0.00005))
        : 0;
    if (hideChance > 0 && Math.random() < hideChance) {
        this.ui.showEncounter(enc, [], { positive: true, text: 'Hidden compartments concealed your cargo. You pass inspection!' });
        return;
    }

    const bountyLevel = getBountyLevel(gs);
    const bountyWarning = bountyLevel !== 'clean' ? ` (Bounty: ${getBounty(gs)}g)` : '';

    this.ui.showEncounter(enc, [
        {
            label: `💰 Pay Fine (${fine}g)`, style: 'danger',
            action: () => {
                if (gs.player.gold >= fine) {
                    gs.player.gold -= fine;
                    addHeat(gs, 15);
                    // Add bounty for smuggling
                    addBounty(gs, bb.contrabandBounty * contrabandQty);
                    this.ui.showEncounter(enc, [], { positive: false, text: `Paid ${fine}g fine. Contraband confiscated! Bounty increased.` });
                } else {
                    // Can't pay - lose all contraband and reputation hit
                    this.confiscateContraband(gs);
                    applyRepChange(gs, 'english', -15, 'inspection_caught');
                    applyRepChange(gs, 'eitc', -15, 'inspection_caught');
                    addHeat(gs, 25);
                    addBounty(gs, bb.baseGainPerCrime + bb.contrabandBounty * contrabandQty);
                    this.ui.showEncounter(enc, [], { positive: false, text: 'No gold! All contraband seized. Reputation damaged. Major bounty added!' });
                }
                // Confiscate contraband regardless
                this.confiscateContraband(gs);
                // Increase crackdown
                gs.world.crackdown.level = Math.min(CONFIG.settings.crackdownMaxLevel, (gs.world.crackdown.level || 0) + 10);
                this.ui.updateHUD(gs);
            }
        },
        {
            label: '🏃 Flee!',
            action: () => {
                // Flee chance decreases with bounty level
                let fleeChance = 0.4;
                if (bountyLevel === 'wanted') fleeChance = 0.3;
                else if (bountyLevel === 'hunted') fleeChance = 0.2;
                else if (bountyLevel === 'infamous') fleeChance = 0.1;

                if (Math.random() < fleeChance) {
                    // Escaped
                    addHeat(gs, 20);
                    addBounty(gs, bb.fleeingBounty);
                    this.ui.showEncounter(enc, [], { positive: true, text: 'You escaped the patrol! Heat and bounty increased.' });
                } else {
                    // Caught - worse penalty
                    this.confiscateContraband(gs);
                    const penalty = Math.floor(gs.player.gold * 0.2);
                    gs.player.gold = Math.max(0, gs.player.gold - penalty);
                    applyRepChange(gs, 'english', -20, 'inspection_fled');
                    applyRepChange(gs, 'eitc', -20, 'inspection_fled');
                    addHeat(gs, 30);
                    addBounty(gs, bb.baseGainPerCrime + bb.fleeingBounty + bb.contrabandBounty * contrabandQty);
                    gs.world.crackdown.level = Math.min(CONFIG.settings.crackdownMaxLevel, (gs.world.crackdown.level || 0) + 20);
                    this.ui.showEncounter(enc, [], { positive: false, text: `Caught fleeing! Lost ${penalty}g and all contraband. Major bounty placed on your head!` });
                }
                this.ui.updateHUD(gs);
            }
        }
    ]);
}

confiscateContraband(gs) {
    Object.keys(gs.player.cargo).forEach(gid => {
        if (CONFIG.goods[gid]?.category === 'contraband') {
            delete gs.player.cargo[gid];
        }
    });
}

triggerStorm() {
    const gs = this.gameState, enc = CONFIG.encounters.storm;
    this.ui.showEncounter(enc, [
        { label: '🌊 Ride out', action: () => {
            const l = 2 + Math.floor(Math.random() * 3);
            gs.player.supplies = Math.max(0, gs.player.supplies - l);
            if (Math.random() < 0.3) {
                this.loseCargo(calcCargoLoss(gs, 0.15));
                this.ui.showEncounter(enc, [], { positive: false, text: `Lost ${l} supplies + cargo!` });
            } else
                this.ui.showEncounter(enc, [], { positive: false, text: `Lost ${l} supplies` });
            this.ui.updateHUD(gs);
        } },
        { label: '⚓ Wait (safe)', style: 'primary', action: () => {
            gs.player.supplies--; gs.player.days++;
            this.ui.showEncounter(enc, [], { positive: true, text: 'Waited safely. Lost 1 day.' });
            this.ui.updateHUD(gs);
        } }
    ]);
}

triggerMerchant() {
    const gs = this.gameState, enc = CONFIG.encounters.adriftMerchant;
    const gids = Object.keys(CONFIG.goods), gid = gids[Math.floor(Math.random() * gids.length)], g = CONFIG.goods[gid];
    const qty = 3 + Math.floor(Math.random() * 5);

    // === BALANCE: Discount scales down with player power ===
    const balEnc = CONFIG.balance.encounters;
    const discountMult = getPowerScaling(gs, balEnc.merchantDiscountMax, -0.0001, balEnc.merchantDiscountMin, balEnc.merchantDiscountMax);
    const price = Math.floor(g.basePrice * (1 - discountMult)), total = price * qty;

    this.ui.showEncounter({ ...enc, desc: `Offers ${qty}x ${g.name} for ${price}g each (${total}g)` }, [
        { label: `💰 Buy (${total}g)`, style: 'primary', action: () => {
            const check = canCarryMore(gid, qty, gs);
            if (gs.player.gold >= total && check.canCarry) {
                gs.player.gold -= total;
                gs.player.cargo[gid] = (gs.player.cargo[gid] || 0) + qty;
                gs.player.purchaseHistory[gid] = price;
                if (g.category === 'contraband') addHeat(gs, CONFIG.settings.heatGainContraband);
                this.ui.showEncounter(enc, [], { positive: true, text: `Bought ${qty}x ${g.name}!` });
            } else
                this.ui.showEncounter(enc, [], { positive: false, text: check.reason || 'Not enough gold!' });
            this.ui.updateHUD(gs);
        } },
        { label: '👋 Pass', action: () => this.ui.closeEncounter() }
    ]);
}

triggerWreck() {
    const gs = this.gameState, enc = CONFIG.encounters.wreckSalvage;
    // === BALANCE: Positive outcome chance decreases with power ===
    const positiveChance = getPowerScaling(gs, CONFIG.balance.encounters.wreckPositiveChance, -0.0001, 0.5, 0.9);

    this.ui.showEncounter(enc, [
        { label: '🔍 Investigate', style: 'primary', action: () => {
            const r = Math.random();
            if (r < positiveChance) {
                // Positive outcomes
                const outcomeRoll = Math.random();
                if (outcomeRoll < 0.15) {
                    // Chart fragment - rare find!
                    const result = addChartFragment(gs);
                    if (result.discovered) {
                        const cove = CONFIG.hiddenCoves[result.coveId];
                        this.ui.showEncounter(enc, [], { positive: true, text: `Found a chart fragment! You've discovered ${cove.name}!` });
                    } else {
                        this.ui.showEncounter(enc, [], { positive: true, text: `Found a chart fragment! (${gs.player.chartFragments}/3 to reveal a cove)` });
                    }
                    this.ui.updateChartFragments(gs);
                } else if (outcomeRoll < 0.45) {
                    const s = 3 + Math.floor(Math.random() * 5);
                    gs.player.supplies = Math.min(30, gs.player.supplies + s);
                    this.ui.showEncounter(enc, [], { positive: true, text: `Found ${s} supplies!` });
                } else if (outcomeRoll < 0.8) {
                    // Gold scales with power but not excessively
                    const baseGold = 20 + Math.floor(Math.random() * 50);
                    const g = Math.floor(baseGold * (1 + getPlayerPower(gs) * 0.0002));
                    gs.player.gold += g;
                    this.ui.showEncounter(enc, [], { positive: true, text: `Found ${g} gold!` });
                } else {
                    const gids = Object.keys(CONFIG.goods), gid = gids[Math.floor(Math.random() * gids.length)], good = CONFIG.goods[gid], q = 1 + Math.floor(Math.random() * 3);
                    const check = canCarryMore(gid, q, gs);
                    if (check.canCarry) {
                        gs.player.cargo[gid] = (gs.player.cargo[gid] || 0) + q;
                        if (good.category === 'contraband') addHeat(gs, CONFIG.settings.heatGainContraband / 2);
                        this.ui.showEncounter(enc, [], { positive: true, text: `Salvaged ${q}x ${good.name}!` });
                    } else
                        this.ui.showEncounter(enc, [], { positive: false, text: check.reason || 'No room!' });
                }
            } else {
                // Negative outcomes scale with power
                const negRoll = Math.random();
                if (negRoll < 0.5) {
                    this.ui.showEncounter(enc, [], { positive: false, text: 'Nothing useful...' });
                } else if (negRoll < 0.8) {
                    // Lost supplies while searching
                    const lost = 1 + Math.floor(Math.random() * 2);
                    gs.player.supplies = Math.max(0, gs.player.supplies - lost);
                    this.ui.showEncounter(enc, [], { positive: false, text: `Wasted time searching. Lost ${lost} supplies.` });
                } else {
                    // Minor damage - gold loss
                    const damage = 10 + Math.floor(Math.random() * 20);
                    gs.player.gold = Math.max(0, gs.player.gold - damage);
                    this.ui.showEncounter(enc, [], { positive: false, text: `Sharp debris! ${damage}g repair cost.` });
                }
            }
            this.ui.updateHUD(gs);
        } },
        { label: '🚢 Sail on', action: () => this.ui.closeEncounter() }
    ]);
}

// ==================== LIVING SEA ENCOUNTERS ====================

triggerDesperateMerchant() {
    const gs = this.gameState, enc = CONFIG.encounters.desperateMerchant;
    const gids = Object.keys(CONFIG.goods).filter(g => CONFIG.goods[g].category !== 'contraband');
    const gid = gids[Math.floor(Math.random() * gids.length)];
    const good = CONFIG.goods[gid];
    const qty = 5 + Math.floor(Math.random() * 10);
    // === BALANCE: Desperate discount scales down with power ===
    const despDiscount = getPowerScaling(gs, 0.5, -0.0001, 0.3, 0.5);
    const price = Math.floor(good.basePrice * (1 - despDiscount));

    this.ui.showEncounter({ ...enc, desc: `${enc.desc} They offer ${qty}x ${good.name} for ${price}g each.` }, [
        { label: `💰 Take cargo (${price * qty}g)`, style: 'danger', action: () => {
            const check = canCarryMore(gid, qty, gs);
            if (gs.player.gold >= price * qty && check.canCarry) {
                gs.player.gold -= price * qty;
                gs.player.cargo[gid] = (gs.player.cargo[gid] || 0) + qty;
                gs.player.purchaseHistory[gid] = price;
                // Massive profit, but reputation hit
                applyRepChange(gs, 'english', -8, 'abandoned_merchant');
                applyRepChange(gs, 'eitc', -5, 'abandoned_merchant');
                this.ui.showEncounter(enc, [], { positive: false, text: `Took ${qty}x ${good.name}. Their fate is on your hands. (-8 Navy rep, -5 Company rep)` });
            } else {
                this.ui.showEncounter(enc, [], { positive: false, text: check.reason || 'Not enough gold!' });
            }
            this.ui.updateHUD(gs);
        } },
        { label: '🍖 Share supplies', action: () => {
            if (gs.player.supplies >= 5) {
                gs.player.supplies -= 5;
                applyRepChange(gs, 'english', 10, 'helped_merchant');
                applyRepChange(gs, 'eitc', 8, 'helped_merchant');
                // They remember you
                gs.player.merchantFavor = (gs.player.merchantFavor || 0) + 1;
                this.ui.showEncounter(enc, [], { positive: true, text: 'Shared 5 supplies. They\'ll remember your kindness. (+10 Navy rep, +8 Company rep)' });
            } else {
                this.ui.showEncounter(enc, [], { positive: false, text: 'Not enough supplies to share!' });
            }
            this.ui.updateHUD(gs);
        } },
        { label: '💱 Trade fairly', action: () => {
            const fairPrice = Math.floor(good.basePrice * 0.8);
            const check = canCarryMore(gid, qty, gs);
            if (gs.player.gold >= fairPrice * qty && check.canCarry) {
                gs.player.gold -= fairPrice * qty;
                gs.player.cargo[gid] = (gs.player.cargo[gid] || 0) + qty;
                gs.player.purchaseHistory[gid] = fairPrice;
                this.ui.showEncounter(enc, [], { positive: true, text: `Fair trade: ${qty}x ${good.name} for ${fairPrice * qty}g. Honor intact.` });
            } else {
                this.ui.showEncounter(enc, [], { positive: false, text: check.reason || 'Not enough gold!' });
            }
            this.ui.updateHUD(gs);
        } },
        { label: '🚢 Sail on', action: () => this.ui.closeEncounter() }
    ]);
}

triggerDriftingMarket(entity) {
    const gs = this.gameState, enc = CONFIG.encounters.driftingMarket;
    // Generate special market goods
    const marketGoods = [];
    const gids = Object.keys(CONFIG.goods);
    for (let i = 0; i < 3; i++) {
        const gid = gids[Math.floor(Math.random() * gids.length)];
        const good = CONFIG.goods[gid];
        marketGoods.push({
            gid,
            good,
            price: Math.floor(good.basePrice * (0.6 + Math.random() * 0.3)), // 60-90% of base
            qty: 3 + Math.floor(Math.random() * 8)
        });
    }

    this.ui.showEncounter(enc, [
        { label: `💰 Buy ${marketGoods[0].good.icon} ${marketGoods[0].good.name} (${marketGoods[0].price}g x${marketGoods[0].qty})`, style: 'primary', action: () => {
            const mg = marketGoods[0];
            const check = canCarryMore(mg.gid, mg.qty, gs);
            const total = mg.price * mg.qty;
            if (gs.player.gold >= total && check.canCarry) {
                gs.player.gold -= total;
                gs.player.cargo[mg.gid] = (gs.player.cargo[mg.gid] || 0) + mg.qty;
                gs.player.purchaseHistory[mg.gid] = mg.price;
                if (mg.good.category === 'contraband') addHeat(gs, CONFIG.settings.heatGainContraband);
                this.ui.showEncounter(enc, [], { positive: true, text: `Bought ${mg.qty}x ${mg.good.name}! No tariffs, no questions.` });
            } else {
                this.ui.showEncounter(enc, [], { positive: false, text: check.reason || 'Not enough gold!' });
            }
            this.ui.updateHUD(gs);
        } },
        { label: '🗣️ Ask for rumors', action: () => {
            // Get one verified piece of intel (same island for name and port state)
            const islands = Object.keys(CONFIG.islands);
            const randomIslandId = islands[Math.floor(Math.random() * islands.length)];
            const randomIsland = CONFIG.islands[randomIslandId];
            const portState = getPortState(gs, randomIslandId);
            const stateInfo = CONFIG.portStates[portState];
            this.ui.showEncounter(enc, [], { positive: true, text: `The merchants whisper: "${randomIsland.name} is ${stateInfo.name.toLowerCase()}. ${stateInfo.desc}"` });
        } },
        { label: '🚢 Sail on', action: () => {
            this.ui.closeEncounter();
            // Market moves away faster
            if (entity) entity.daysRemaining = Math.max(1, entity.daysRemaining - 3);
        } }
    ]);
}

triggerMerchantFleet(entity) {
    const gs = this.gameState;
    const enc = { name: 'Merchant Fleet', icon: '🚢', desc: 'A convoy of trading vessels crosses your path. They seem open to business.' };

    // Generate trade offers - bulk goods at decent prices
    const gids = Object.keys(CONFIG.goods).filter(g => CONFIG.goods[g].category !== 'contraband');
    const buyGid = gids[Math.floor(Math.random() * gids.length)];
    const buyGood = CONFIG.goods[buyGid];
    const buyPrice = Math.floor(buyGood.basePrice * (0.75 + Math.random() * 0.15)); // 75-90% base
    const buyQty = 5 + Math.floor(Math.random() * 6);

    // What they want to buy from player
    const playerCargo = Object.entries(gs.player.cargo).filter(([gid, qty]) => qty > 0 && CONFIG.goods[gid]?.category !== 'contraband');
    const hasCargo = playerCargo.length > 0;
    let sellGid, sellGood, sellPrice, sellQty;
    if (hasCargo) {
        [sellGid, sellQty] = playerCargo[Math.floor(Math.random() * playerCargo.length)];
        sellGood = CONFIG.goods[sellGid];
        sellPrice = Math.floor(sellGood.basePrice * (1.1 + Math.random() * 0.2)); // 110-130% base
        sellQty = Math.min(sellQty, 5);
    }

    const actions = [
        { label: `💰 Buy ${buyGood.icon} ${buyGood.name} (${buyPrice}g x${buyQty})`, style: 'primary', action: () => {
            const total = buyPrice * buyQty;
            const check = canCarryMore(buyGid, buyQty, gs);
            if (gs.player.gold >= total && check.canCarry) {
                gs.player.gold -= total;
                gs.player.cargo[buyGid] = (gs.player.cargo[buyGid] || 0) + buyQty;
                gs.player.purchaseHistory[buyGid] = buyPrice;
                gs.player.merchantFavor = (gs.player.merchantFavor || 0) + 1;
                this.ui.showEncounter(enc, [], { positive: true, text: `Bought ${buyQty}x ${buyGood.name}. The merchants appreciate your business.` });
            } else {
                this.ui.showEncounter(enc, [], { positive: false, text: check.reason || 'Not enough gold!' });
            }
            this.ui.updateHUD(gs);
        } }
    ];

    if (hasCargo) {
        actions.push({ label: `📦 Sell ${sellGood.icon} ${sellGood.name} (${sellPrice}g x${sellQty})`, action: () => {
            gs.player.cargo[sellGid] -= sellQty;
            if (gs.player.cargo[sellGid] <= 0) delete gs.player.cargo[sellGid];
            gs.player.gold += sellPrice * sellQty;
            gs.player.merchantFavor = (gs.player.merchantFavor || 0) + 1;
            this.ui.showEncounter(enc, [], { positive: true, text: `Sold ${sellQty}x ${sellGood.name} for ${sellPrice * sellQty}g. Good trade!` });
            this.ui.updateHUD(gs);
        } });
    }

    actions.push({ label: '🚢 Sail on', action: () => {
        this.ui.closeEncounter();
        if (entity) entity.daysRemaining = Math.max(1, entity.daysRemaining - 2);
    } });

    this.ui.showEncounter(enc, actions);
}

triggerBlockadeRunner() {
    const gs = this.gameState, enc = CONFIG.encounters.blockadeRunner;
    const fee = 100 + Math.floor(Math.random() * 150);

    this.ui.showEncounter(enc, [
        { label: `💰 Pay the fee (${fee}g)`, style: 'primary', action: () => {
            if (gs.player.gold >= fee) {
                gs.player.gold -= fee;
                // Grant temporary blockade immunity
                gs.player.blockadePass = gs.player.days + 3; // 3 days of safe passage
                applyRepChange(gs, 'pirates', 5, 'used_smuggler');
                applyRepChange(gs, 'english', -3, 'used_smuggler');
                this.ui.showEncounter(enc, [], { positive: true, text: `Paid ${fee}g. You have safe passage through blockades for 3 days.` });
            } else {
                this.ui.showEncounter(enc, [], { positive: false, text: 'Not enough gold!' });
            }
            this.ui.updateHUD(gs);
        } },
        { label: '👮 Report them', action: () => {
            const reward = 50 + Math.floor(Math.random() * 50);
            gs.player.gold += reward;
            applyRepChange(gs, 'english', 10, 'reported_smuggler');
            applyRepChange(gs, 'pirates', -15, 'reported_smuggler');
            addHeat(gs, -10); // Reduces heat
            this.ui.showEncounter(enc, [], { positive: true, text: `Reported to Navy. +${reward}g reward, +10 Navy rep, -15 Pirate rep, reduced heat.` });
            this.ui.updateHUD(gs);
        } },
        { label: '🚢 Refuse', action: () => this.ui.closeEncounter() }
    ]);
}

triggerStormsEye() {
    const gs = this.gameState, enc = CONFIG.encounters.stormsEye;

    this.ui.showEncounter(enc, [
        { label: '⚡ Salvage quickly', style: 'primary', action: () => {
            // Quick salvage - random valuable cargo, storm resumes
            const r = Math.random();
            if (r < 0.6) {
                const gids = Object.keys(CONFIG.goods);
                const gid = gids[Math.floor(Math.random() * gids.length)];
                const good = CONFIG.goods[gid];
                const qty = 2 + Math.floor(Math.random() * 4);
                const check = canCarryMore(gid, qty, gs);
                if (check.canCarry) {
                    gs.player.cargo[gid] = (gs.player.cargo[gid] || 0) + qty;
                    if (good.category === 'contraband') addHeat(gs, CONFIG.settings.heatGainContraband / 2);
                    this.ui.showEncounter(enc, [], { positive: true, text: `Grabbed ${qty}x ${good.name} before the storm returned!` });
                } else {
                    this.ui.showEncounter(enc, [], { positive: false, text: 'No room for salvage!' });
                }
            } else {
                const gold = 30 + Math.floor(Math.random() * 70);
                gs.player.gold += gold;
                this.ui.showEncounter(enc, [], { positive: true, text: `Found ${gold}g in the wreckage!` });
            }
            this.ui.updateHUD(gs);
        } },
        { label: '🔍 Search thoroughly', action: () => {
            // Better cargo but storm catches you
            const gids = Object.keys(CONFIG.goods).filter(g => CONFIG.goods[g].category === 'luxury');
            const gid = gids[Math.floor(Math.random() * gids.length)] || 'gold';
            const good = CONFIG.goods[gid];
            const qty = 3 + Math.floor(Math.random() * 5);
            const check = canCarryMore(gid, qty, gs);

            if (check.canCarry) {
                gs.player.cargo[gid] = (gs.player.cargo[gid] || 0) + qty;
                // But storm catches you
                const supplyLoss = 2 + Math.floor(Math.random() * 3);
                gs.player.supplies = Math.max(0, gs.player.supplies - supplyLoss);
                if (Math.random() < 0.4) {
                    this.loseCargo(calcCargoLoss(gs, 0.1));
                    this.ui.showEncounter(enc, [], { positive: false, text: `Found ${qty}x ${good.name}! But the storm caught you. Lost ${supplyLoss} supplies and some cargo.` });
                } else {
                    this.ui.showEncounter(enc, [], { positive: true, text: `Found ${qty}x ${good.name}! Lost ${supplyLoss} supplies escaping the storm.` });
                }
            } else {
                this.ui.showEncounter(enc, [], { positive: false, text: 'No room for salvage!' });
            }
            this.ui.updateHUD(gs);
        } },
        { label: '🙏 Take survivors only', action: () => {
            // Crew bonus, karma, nothing material
            gs.player.supplies = Math.min(30, gs.player.supplies + 2); // They had some supplies
            applyRepChange(gs, 'english', 5, 'rescued_sailors');
            applyRepChange(gs, 'eitc', 5, 'rescued_sailors');
            gs.player.merchantFavor = (gs.player.merchantFavor || 0) + 2;
            this.ui.showEncounter(enc, [], { positive: true, text: 'Rescued the crew. They share stories and a bit of supplies. +5 rep with Navy and Company. The sea remembers.' });
            this.ui.updateHUD(gs);
        } }
    ]);
}

triggerPirateFleetEncounter(entity) {
    const gs = this.gameState, enc = CONFIG.encounters.pirateFleetEncounter;
    const baseCost = Math.floor(gs.player.gold * 0.25) + 200; // Higher than normal pirates
    const cost = calcTributeCost(gs, baseCost);

    this.ui.showEncounter(enc, [
        { label: `💰 Pay tribute (${cost}g)`, style: 'danger', action: () => {
            if (gs.player.gold >= cost) {
                gs.player.gold -= cost;
                applyRepChange(gs, 'pirates', 3, 'paid_fleet');
                this.ui.showEncounter(enc, [], { positive: false, text: `Paid ${cost}g to the fleet. They let you pass... this time.` });
            } else {
                this.loseCargo(calcCargoLoss(gs, 0.5));
                const goldLoss = calcGoldLoss(gs, Math.floor(gs.player.gold * 0.3));
                gs.player.gold = Math.max(0, gs.player.gold - goldLoss);
                applyRepChange(gs, 'pirates', -5, 'couldnt_pay_fleet');
                this.ui.showEncounter(enc, [], { positive: false, text: 'Couldn\'t pay! They took what they wanted.' });
            }
            this.ui.updateHUD(gs);
        } },
        { label: '⚔️ Fight the fleet', action: () => {
            // Very risky fight
            if (Math.random() < 0.25) { // 25% chance to win
                const reward = 200 + Math.floor(Math.random() * 300);
                gs.player.gold += reward;
                applyRepChange(gs, 'pirates', -20, 'defeated_fleet');
                applyRepChange(gs, 'english', 15, 'defeated_fleet');
                // Remove the fleet entity
                if (entity) entity.daysRemaining = 0;
                this.ui.showEncounter(enc, [], { positive: true, text: `Victory against the odds! +${reward}g, +15 Navy rep. The fleet is scattered.` });
            } else {
                this.loseCargo(calcCargoLoss(gs, 0.7));
                const goldLoss = calcGoldLoss(gs, Math.floor(gs.player.gold * 0.5));
                gs.player.gold = Math.max(0, gs.player.gold - goldLoss);
                gs.player.supplies = Math.max(0, gs.player.supplies - 5);
                this.ui.showEncounter(enc, [], { positive: false, text: 'Overwhelmed! Lost most cargo, gold, and supplies.' });
            }
            this.ui.updateHUD(gs);
        } },
        ...(gs.player.faction === 'pirates' ? [{ label: '🏴‍☠️ Invoke the Code', action: () => {
            // Pirates can invoke the Code
            applyRepChange(gs, 'pirates', -10, 'invoked_code');
            this.ui.showEncounter(enc, [], { positive: true, text: 'You invoke the Pirate\'s Code. They grumble but let you pass. -10 pirate rep for the insult.' });
            this.ui.updateHUD(gs);
        } }] : [])
    ]);
}

triggerConvoyEncounter(entity) {
    const gs = this.gameState, enc = CONFIG.encounters.convoyEncounter;
    const hasContraband = getContrabandCount(gs) > 0;

    this.ui.showEncounter(enc, [
        { label: '✅ Submit to inspection', style: hasContraband ? 'danger' : 'primary', action: () => {
            if (hasContraband) {
                // They find the contraband
                this.confiscateContraband(gs);
                const fine = 100 + getContrabandCount(gs) * 20;
                gs.player.gold = Math.max(0, gs.player.gold - fine);
                applyRepChange(gs, 'english', -15, 'caught_by_convoy');
                addHeat(gs, 20);
                this.ui.showEncounter(enc, [], { positive: false, text: `Contraband found! Confiscated, fined ${fine}g. -15 Navy rep.` });
            } else {
                // Clean - get convoy protection
                applyRepChange(gs, 'english', 5, 'passed_inspection');
                gs.player.convoyProtection = gs.player.days + 2; // 2 days safe from pirates
                this.ui.showEncounter(enc, [], { positive: true, text: 'Cargo clean. The convoy offers protection for 2 days. +5 Navy rep.' });
            }
            this.ui.updateHUD(gs);
        } },
        { label: '🏃 Break away', action: () => {
            // Try to escape - risky
            if (Math.random() < 0.5) {
                addHeat(gs, 15);
                applyRepChange(gs, 'english', -10, 'fled_convoy');
                this.ui.showEncounter(enc, [], { positive: true, text: 'Escaped the convoy! Heat increased, -10 Navy rep.' });
            } else {
                // Caught - forced inspection
                if (hasContraband) {
                    this.confiscateContraband(gs);
                    const fine = 150 + getContrabandCount(gs) * 25;
                    gs.player.gold = Math.max(0, gs.player.gold - fine);
                    applyRepChange(gs, 'english', -25, 'caught_fleeing_convoy');
                    addHeat(gs, 30);
                    this.ui.showEncounter(enc, [], { positive: false, text: `Caught fleeing! Contraband confiscated, fined ${fine}g. -25 Navy rep.` });
                } else {
                    applyRepChange(gs, 'english', -15, 'fled_then_caught');
                    addHeat(gs, 15);
                    this.ui.showEncounter(enc, [], { positive: false, text: 'Caught! Cargo clean but -15 Navy rep for fleeing.' });
                }
            }
            this.ui.updateHUD(gs);
        } },
        { label: '⛵ Shadow the convoy', action: () => {
            // Follow for protection but guaranteed inspection at destination
            gs.player.convoyProtection = gs.player.days + 3;
            gs.player.convoyInspection = true; // Will be inspected at next dock
            this.ui.showEncounter(enc, [], { positive: true, text: 'You shadow the convoy. Safe from pirates for 3 days, but expect inspection at your next port.' });
            this.ui.closeEncounter();
        } }
    ]);
}

// === LIVING SEA: Blockade Encounter System ===
getNearbyBlockadedIsland(gs) {
    const pp = gs.player.position;
    const blockades = getActiveBlockades(gs);
    const blockadedIds = blockades.map(b => b.islandId);

    for (const iid of blockadedIds) {
        const isl = CONFIG.islands[iid];
        if (!isl) continue;
        const dist = Math.sqrt((isl.position.x - pp.x) ** 2 + (isl.position.z - pp.z) ** 2);
        // Trigger within 80 units of blockaded island
        if (dist < 80 && dist > CONFIG.settings.dockDistance) {
            const blockade = getBlockadeInfo(gs, iid);
            // Don't trigger twice per day
            if (blockade.lastEncounterDay === gs.player.days) continue;
            return { iid, island: isl, blockade, distance: dist };
        }
    }
    return null;
}

triggerBlockadeEncounter(info) {
    const gs = this.gameState;
    const { iid, island, blockade } = info;
    blockade.lastEncounterDay = gs.player.days;

    const blockaderName = blockade.blockadingFaction === 'english' ? 'Royal Navy' :
                         blockade.blockadingFaction === 'pirates' ? 'Pirate Fleet' : 'Company Ships';

    const enc = {
        name: 'Blockade!',
        icon: '⛔',
        desc: `${blockaderName} blockading ${island.name}! Their ships move to intercept.`
    };

    const bribeCost = 100 + Math.floor(blockade.strength * 2);
    const hasContraband = getContrabandCount(gs) > 0;

    this.ui.showEncounter(enc, [
        { label: `💰 Bribe passage (${bribeCost}g)`, style: gs.player.gold >= bribeCost ? 'primary' : 'secondary', action: () => {
            if (gs.player.gold < bribeCost) {
                this.ui.toast('Not enough gold', `Need ${bribeCost}g`);
                return;
            }
            gs.player.gold -= bribeCost;
            // Reduce influence of blockading faction
            modifyInfluence(gs, iid, blockade.blockadingFaction, -2);
            this.ui.showEncounter(enc, [], { positive: true, text: `Paid ${bribeCost}g. The blockade lets you pass.` });
            this.ui.updateHUD(gs);
        } },
        { label: '🏃 Run the blockade', style: 'danger', action: () => {
            // Chase encounter!
            this.startChase('blockade');
        } },
        { label: '↩️ Turn back', action: () => {
            // Safe escape but can't reach the island
            gs.player.destinationIslandId = null;
            this.ui.showEncounter(enc, [], { positive: true, text: 'You retreat to open waters. The blockade remains.' });
            this.ui.closeEncounter();
        } }
    ]);
}

dock() {
    // Check for cove first
    if (this.nearbyCove) {
        this.dockAtCove(this.nearbyCove);
        return;
    }
    if (!this.nearbyIsland) { this.ui.toast('Too Far', 'Get closer!'); return; }
    const gs = this.gameState, pp = gs.player.position, isl = CONFIG.islands[this.nearbyIsland];
    if (Math.sqrt((isl.position.x - pp.x)**2 + (isl.position.z - pp.z)**2) > CONFIG.settings.dockDistance) { this.ui.toast('Too Far', 'Get closer!'); return; }

    // === LIVING SEA: Check for blockade (requires blockadePass to dock) ===
    const portState = getPortState(gs, this.nearbyIsland);
    if (portState === 'blockaded') {
        const hasPass = gs.player.blockadePass && gs.player.blockadePass >= gs.player.days;
        if (!hasPass) {
            this.ui.toast('Blockaded!', 'Navy ships prevent docking. Find a blockade runner.');
            return;
        }
        this.ui.toast('Pass Used', 'Slipping through the blockade...');
    }

    gs.isDocked = true;
    gs.currentIsland = this.nearbyIsland;
    gs.player.daysSinceDock = 0; // Reset days since dock
    // Per-contract inspection tracking: wasInspected flag is on each contract, no global reset needed

    // === LIVING SEA: Check for convoy inspection (from shadowing navy convoy) ===
    if (gs.player.convoyInspection) {
        gs.player.convoyInspection = false; // Clear flag
        this.ui.toast('Convoy Report', 'Navy was alerted to your presence!');
        setTimeout(() => this.triggerInspection(), 500);
        return; // Don't proceed with normal docking until inspection resolves
    }

    // === BALANCE: Docking fee ===
    const dockFee = calculateDockingFee(gs, this.nearbyIsland);
    if (dockFee > 0) {
        gs.player.gold = Math.max(0, gs.player.gold - dockFee);
        this.ui.toast('Docking Fee', '-' + dockFee + 'g');
    }

    // === BALANCE: Record port visit for cooldown system ===
    recordPortVisit(gs, this.nearbyIsland);

    // === META PRESSURE: Record route if we have a previous port ===
    const meta = metaInit(gs);
    if (meta.lastPort && meta.lastPort !== this.nearbyIsland) {
        metaRecordRoute(gs, meta.lastPort, this.nearbyIsland);
    } else {
        // First dock or same port - just update lastPort and record port visit
        meta.lastPort = this.nearbyIsland;
        metaAddToWindow(meta.recentPorts, meta.portCounts, this.nearbyIsland, CONFIG.metaPressure.windowSize);
        metaAddToWindow(meta.recentFactions, meta.factionCounts, isl.faction, CONFIG.metaPressure.windowSize);
        metaRecalcPressure(gs);
    }

    // === BALANCE: Bounty decay at friendly ports ===
    const isFriendly = isl.faction === gs.player.faction || isl.faction === 'neutral';
    decayBounty(gs, true, isFriendly);
    // Heat also decays faster when docked at friendly
    decayHeatBalanced(gs, true, isFriendly);

    // Heat changes on dock
    const islFaction = isl.faction;
    if (islFaction === 'english' || islFaction === 'eitc') {
        // Heat increases if carrying contraband at English/EITC ports
        if (getContrabandCount(gs) > 0) {
            addHeat(gs, CONFIG.settings.heatGainDockEnglishEITC);
        }
    } else {
        // Heat decays faster at pirate/neutral ports
        gs.player.heat = Math.max(0, (gs.player.heat || 0) - 10);
    }

    // Evaluate contracts
    const completedContracts = evaluateContractsOnDock(gs, this.nearbyIsland);
    if (completedContracts.length > 0) {
        this.ui.showContractComplete(completedContracts);
    }

    // === LIVING SEA: Check questline progress ===
    const questResult = checkQuestlineStep(gs, 'dock', { islandId: this.nearbyIsland });
    if (questResult.completed) {
        // Full questline completed - show completion modal
        this.ui.showQuestComplete(questResult.rewards);
    } else if (questResult.stepDone) {
        // Step completed but questline continues
        const rewardText = questResult.reward ? ` +${questResult.reward}g` : '';
        this.ui.toast('Step Complete!', questResult.message + rewardText);
    } else if (questResult.progress) {
        // Partial progress on a delivery step
        const rewardText = questResult.reward ? ` +${questResult.reward}g` : '';
        this.ui.toast('Delivery Made!', `${questResult.message}${rewardText}`);
    } else if (questResult.blocked) {
        // Anti-cheese: goods were bought locally
        this.ui.toast('Quest Blocked', questResult.message);
    }

    // Refresh contract board
    refreshContractBoard(gs, this.nearbyIsland);

    // Update titles
    updateTitles(gs, (icon, name, desc) => {
        this.ui.showTitleEarned(icon, name, desc);
    });

    // Resupply
    const cost = 2, maxBuy = Math.min(30 - gs.player.supplies, Math.floor(gs.player.gold / cost));
    if (maxBuy > 0 && gs.player.supplies < 15) { const b = Math.min(maxBuy, 15); gs.player.gold -= b * cost; gs.player.supplies += b; this.ui.toast('Resupplied', '+' + b); }
    this.ui.updateHUD(gs); this.ui.showTrade(this.nearbyIsland, gs); this.save();
}

undock() {
    // === BALANCE: Reset trade fatigue when leaving port ===
    resetTradeFatigue(this.gameState);
    this.gameState.isDocked = false;
    this.ui.closeTrade();
}

// ==================== LIVING SEA: HIDDEN COVE DOCKING ====================
dockAtCove(coveId) {
    const gs = this.gameState;
    const cove = CONFIG.hiddenCoves[coveId];
    if (!cove) { this.ui.toast('Error', 'Unknown cove'); return; }

    const pp = gs.player.position;
    const dist = Math.sqrt((cove.position.x - pp.x)**2 + (cove.position.z - pp.z)**2);
    if (dist > CONFIG.settings.dockDistance) { this.ui.toast('Too Far', 'Get closer!'); return; }

    gs.isDocked = true;
    gs.currentCove = coveId;
    gs.player.daysSinceDock = 0;

    // Heat drops significantly at hidden coves
    gs.player.heat = Math.max(0, (gs.player.heat || 0) - 20);

    this.ui.showCove(coveId, gs);
    this.save();
}

undockCove() {
    this.gameState.isDocked = false;
    this.gameState.currentCove = null;
}

// Cove services
useCoveService(coveId, service) {
    try {
        const gs = this.gameState;
        const cove = CONFIG.hiddenCoves[coveId];
        if (!cove) return;

        switch(service) {
            case 'fence':
                this.coveFence(gs);
                break;
            case 'salvage':
                this.coveSalvage(gs);
                break;
            case 'repair':
                this.coveRepair(gs);
                break;
            case 'rest':
                this.coveRest(gs);
                break;
            case 'treasure':
                this.coveTreasure(gs, coveId);
                break;
            case 'charts':
                this.coveCharts(gs);
                break;
            case 'rumors':
                this.coveRumors(gs);
                break;
        }
        this.ui.updateHUD(gs);
        this.save();
    } catch (e) {
        console.error('Cove service error:', service, e);
        this.ui.toast('Error', e.message || 'Service failed');
    }
}

coveFence(gs) {
    const contraband = Object.entries(gs.player.cargo)
        .filter(([gid, qty]) => CONFIG.goods[gid]?.category === 'contraband' && qty > 0);
    if (contraband.length === 0) {
        this.ui.toast('No Contraband', 'Nothing to fence');
        return;
    }
    let total = 0;
    for (const [gid, qty] of contraband) {
        const price = Math.floor(CONFIG.goods[gid].basePrice * 1.5);
        total += price * qty;
        gs.player.cargo[gid] = 0;
    }
    gs.player.gold += total;
    this.ui.toast('Fenced!', '+' + total + 'g (no heat)');
}

coveSalvage(gs) {
    const cost = 50;
    if (gs.player.gold < cost) { this.ui.toast('No Gold', 'Need ' + cost + 'g'); return; }
    const gids = Object.keys(CONFIG.goods).filter(g => CONFIG.goods[g].category !== 'contraband');
    const gid = gids[Math.floor(Math.random() * gids.length)];
    const qty = 2 + Math.floor(Math.random() * 4);
    const check = canCarryMore(gid, qty, gs);
    if (!check.canCarry) { this.ui.toast('No Space', check.reason); return; }
    gs.player.gold -= cost;
    gs.player.cargo[gid] = (gs.player.cargo[gid] || 0) + qty;
    this.ui.toast('Salvage', qty + 'x ' + CONFIG.goods[gid].name);
}

coveRepair(gs) {
    const hullDmg = getMaxHull(gs) - getShipHull(gs);
    const riggingDmg = getMaxRigging(gs) - getShipRigging(gs);
    if (hullDmg <= 0 && riggingDmg <= 0) { this.ui.toast('No Damage', 'Ship is fine'); return; }
    const cost = Math.floor((hullDmg + riggingDmg) * 0.5); // Half price
    if (gs.player.gold < cost) { this.ui.toast('No Gold', 'Need ' + cost + 'g'); return; }
    gs.player.gold -= cost;
    if (gs.player.ship) {
        gs.player.ship.hull = getMaxHull(gs);
        gs.player.ship.rigging = getMaxRigging(gs);
    }
    this.ui.toast('Repaired', '-' + cost + 'g (cheap!)');
}

coveRest(gs) {
    const currentMorale = getShipMorale(gs);
    const maxMorale = getMaxMorale(gs);
    if (currentMorale >= maxMorale) { this.ui.toast('Crew Happy', 'Morale is full'); return; }
    const cost = 25;
    if (gs.player.gold < cost) { this.ui.toast('No Gold', 'Need ' + cost + 'g'); return; }
    gs.player.gold -= cost;
    if (gs.player.ship) gs.player.ship.morale = maxMorale;
    this.ui.toast('Rested', 'Crew morale restored');
}

coveTreasure(gs, coveId) {
    // One-time treasure per cove
    if (!gs.player.covesTreasured) gs.player.covesTreasured = [];
    if (gs.player.covesTreasured.includes(coveId)) {
        this.ui.toast('Already Looted', 'Treasure was claimed');
        return;
    }
    gs.player.covesTreasured.push(coveId);
    const gold = 200 + Math.floor(Math.random() * 300);
    gs.player.gold += gold;
    this.ui.toast('Treasure!', '+' + gold + 'g found!');
}

coveCharts(gs) {
    const cost = 75;
    if (gs.player.gold < cost) { this.ui.toast('No Gold', 'Need ' + cost + 'g'); return; }
    gs.player.gold -= cost;
    const result = addChartFragment(gs);
    if (result.discovered) {
        const cove = CONFIG.hiddenCoves[result.coveId];
        this.ui.toast('Discovery!', cove.name + ' revealed!');
    } else {
        this.ui.toast('Chart Fragment', gs.player.chartFragments + '/3');
    }
    this.ui.updateChartFragments(gs);
}

coveRumors(gs) {
    const rumor = getCoveRumor(gs);
    if (rumor) {
        this.ui.toast('Rumor', rumor.hint);
    } else {
        this.ui.toast('No News', 'All coves discovered');
    }
}

buyBest() {
    const gs = this.gameState, iid = gs.currentIsland; if (!iid) return;
    const deals = calcDeals(gs, iid);
    for (const d of deals) {
        const g = CONFIG.goods[d.gid], m = gs.islands[iid].markets[d.gid];
        const check = canCarryMore(d.gid, 1, gs);
        const max = Math.min(Math.floor(gs.player.gold / d.buyPrice), Math.floor((getCargoCapacity(gs) - getCargoUsed(gs)) / g.weight), m.supply);
        if (max > 0 && check.canCarry) {
            for (let i = 0; i < max; i++) if (!buyGood(d.gid, 1, iid, gs).success) break;
            this.ui.toast('Bought', g.name);
            this.ui.renderBuy(iid, gs); this.ui.renderSell(iid, gs); this.ui.updateFooter(gs); this.save();
            return;
        }
    }
    this.ui.toast('No Deals', 'Visit more ports');
}

sellBest() {
    const gs = this.gameState, iid = gs.currentIsland; if (!iid || !Object.keys(gs.player.cargo).length) { this.ui.toast('Empty', 'Nothing to sell'); return; }
    let best = null, bestScore = -Infinity;
    Object.entries(gs.player.cargo).forEach(([gid, qty]) => { const cp = calcSellPrice(gid, iid, gs), pp = gs.player.purchaseHistory[gid] || 0, score = (cp - pp) > 0 ? (cp - pp) * 1000 + cp : cp; if (score > bestScore) { bestScore = score; best = gid; } });
    if (best) { const g = CONFIG.goods[best], qty = gs.player.cargo[best]; for (let i = 0; i < qty; i++) if (!sellGood(best, 1, iid, gs).success) break; this.ui.toast('Sold', g.name); this.ui.renderBuy(iid, gs); this.ui.renderSell(iid, gs); this.ui.updateFooter(gs); this.save(); }
}

buyUpgrade(id) {
    const gs = this.gameState, u = CONFIG.upgrades[id];
    if (!u || gs.player.upgrades[id]) return false;

    // === BALANCE: Upgrade costs scale with player power ===
    const prog = CONFIG.balance.progression;
    const costMult = getPowerScaling(gs, 1.0, prog.upgradeCostPowerMult, 1.0, prog.upgradeCostMax);
    const scaledCost = Math.floor(u.cost * costMult);

    if (gs.player.gold < scaledCost) return false;
    gs.player.gold -= scaledCost;
    gs.player.upgrades[id] = true;
    this.ui.toast('Upgrade!', u.name);
    this.ui.updateHUD(gs);
    this.save();
    return true;
}

// Helper to get scaled upgrade cost for display
getUpgradeCost(id) {
    const gs = this.gameState, u = CONFIG.upgrades[id];
    if (!u) return 0;
    const prog = CONFIG.balance.progression;
    const costMult = getPowerScaling(gs, 1.0, prog.upgradeCostPowerMult, 1.0, prog.upgradeCostMax);
    return Math.floor(u.cost * costMult);
}

// === LIVING SEA: Buy Pardon ===
buyPardon() {
    const gs = this.gameState;
    if (!gs.isDocked || !gs.currentIsland) {
        this.ui.toast('Error', 'Must be docked');
        return false;
    }

    const bounty = getBounty(gs);
    if (bounty <= 0) {
        this.ui.toast('Clean Record', 'No bounty to clear');
        return false;
    }

    const cost = getPardonCost(gs, gs.currentIsland);
    if (cost === null) {
        this.ui.toast('Unavailable', 'No pardons here');
        return false;
    }

    if (gs.player.gold < cost) {
        this.ui.toast('No Gold', `Need ${cost}g`);
        return false;
    }

    gs.player.gold -= cost;
    grantPardon(gs);
    this.ui.toast('Pardoned!', 'Your record is clean');
    this.ui.updateHUD(gs);
    this.save();
    return true;
}

// === LIVING SEA: Questline Management ===
startQuestline(questlineId) {
    const gs = this.gameState;
    const result = startQuestline(gs, questlineId);
    if (result.success) {
        this.ui.updateHUD(gs);
        this.save();
    }
    return result;
}

abandonQuestline() {
    const gs = this.gameState;
    const result = failQuestline(gs);
    if (result.success) {
        this.ui.toast('Quest Abandoned', 'Progress lost');
        this.ui.updateHUD(gs);
        this.save();
    }
    return result;
}

// === LIVING SEA: Ship repairs at dock ===
repairShip(type) {
    const gs = this.gameState;

    // Calculate amount to repair
    let amount = 0;
    if (type === 'hull') {
        amount = getMaxHull(gs) - getShipHull(gs);
    } else if (type === 'rigging') {
        amount = getMaxRigging(gs) - getShipRigging(gs);
    } else if (type === 'morale') {
        amount = getMaxMorale(gs) - getShipMorale(gs);
    }

    if (amount <= 0) return false;

    const cost = getRepairCost(gs, type === 'morale' ? 'rest' : type, amount);
    if (gs.player.gold < cost) return false;

    let repaired = false;
    if (type === 'hull') {
        repairHull(gs, amount);
        repaired = true;
    } else if (type === 'rigging') {
        repairRigging(gs, amount);
        repaired = true;
    } else if (type === 'morale') {
        restoreMorale(gs, amount);
        repaired = true;
    }

    if (repaired) {
        gs.player.gold -= cost;
        const labels = { hull: 'Hull Repaired', rigging: 'Rigging Fixed', morale: 'Crew Rested' };
        this.ui.toast('Repairs', labels[type] || 'Ship Repaired');
        this.save();
    }
    return repaired;
}

// === LIVING SEA: Officer hiring/firing ===
hireOfficer(type, name) {
    const gs = this.gameState;
    const cfg = CONFIG.officers?.[type];
    if (!cfg) return false;

    const officers = gs.player.officers || [];
    if (officers.length >= 3) {
        this.ui.toast('Full Crew', 'Max 3 officers');
        return false;
    }

    const hireCost = cfg.hireCost || 100;
    if (gs.player.gold < hireCost) {
        this.ui.toast('No Gold', 'Not enough to hire');
        return false;
    }

    // Check if already have this type
    if (hasOfficer(gs, type)) {
        this.ui.toast('Duplicate', `Already have a ${cfg.name}`);
        return false;
    }

    gs.player.gold -= hireCost;
    hireOfficer(gs, type);
    // Set the name for the hired officer
    const hired = gs.player.officers[gs.player.officers.length - 1];
    if (hired) hired.name = name;

    this.ui.toast('Hired!', `${name} joins your crew`);
    this.save();
    return true;
}

fireOfficer(officerId) {
    const gs = this.gameState;
    const officer = gs.player.officers?.find(o => o.id === officerId);
    if (!officer) return false;

    fireOfficer(gs, officerId);
    this.ui.toast('Dismissed', `${officer.name} leaves your crew`);
    this.save();
    return true;
}

// === LIVING SEA: Ship purchase ===
buyShip(shipId) {
    const gs = this.gameState;
    const ship = CONFIG.shipClasses?.[shipId];
    if (!ship) return false;

    if (gs.player.shipClass === shipId) {
        this.ui.toast('Already Owned', 'This is your current ship');
        return false;
    }

    if (gs.player.gold < ship.cost) {
        this.ui.toast('No Gold', 'Not enough for this ship');
        return false;
    }

    // Check if cargo fits in new ship
    const currentCargo = getCargoUsed(gs);
    if (currentCargo > ship.cargoCapacity) {
        this.ui.toast('Too Much Cargo', `Sell ${currentCargo - ship.cargoCapacity} cargo first`);
        return false;
    }

    gs.player.gold -= ship.cost;
    gs.player.shipClass = shipId;

    // Reset ship condition to new ship's max values
    gs.player.ship = {
        hull: ship.hullMax,
        rigging: ship.riggingMax,
        morale: gs.player.ship?.morale || 100 // Keep crew morale
    };

    this.ui.toast('New Ship!', `You now captain a ${ship.name}`);
    this.save();
    return true;
}

// Save throttling with dirty flag - prevents excessive localStorage writes
_dirty = false;
_saveTimeout = null;
_lastSaveTime = 0;
_saveThrottleMs = 2000; // Minimum 2 seconds between saves

save() {
    this._dirty = true;
    const now = performance.now();
    const elapsed = now - this._lastSaveTime;

    // If enough time has passed, save immediately
    if (elapsed >= this._saveThrottleMs) {
        this._flushSave();
    } else if (!this._saveTimeout) {
        // Schedule a save for later
        this._saveTimeout = setTimeout(() => this._flushSave(), this._saveThrottleMs - elapsed);
    }
}

_flushSave() {
    if (this._saveTimeout) {
        clearTimeout(this._saveTimeout);
        this._saveTimeout = null;
    }
    if (this._dirty && this.gameState) {
        localStorage.setItem('merchantSeasSave', JSON.stringify(this.gameState));
        this._dirty = false;
        this._lastSaveTime = performance.now();
    }
}
load() {
    try {
        this.gameState = migrateState(JSON.parse(localStorage.getItem('merchantSeasSave')));
        this.ui.hideFaction(); this.ui.showGame();
        this.scene = new SceneManager(document.getElementById('game-canvas'));
        this.joystick = new Joystick();
        this.ui.updateHUD(this.gameState);
        return true;
    } catch { return false; }
}
start() { this.lastTime = performance.now(); this.animate(); }
animate() {
    requestAnimationFrame(() => this.animate());
    if (!this.scene || !this.gameState) return;
    const now = performance.now(), dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    this.update(dt);
    this.scene.updateShip(this.gameState.player.position, this.joystick?.active ? this.joystick.angle : null);
    this.scene.updateCamera(this.gameState.player.position);
    this.scene.render();
}

}

export { Game };
