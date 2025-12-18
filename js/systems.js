// ==================== GAME SYSTEMS ====================
// All game mechanics, calculations, and state management functions
// Includes: Power, Bounty, Meta Pressure, Economy, Titles, Reputation,
// Contracts, Living World, Seasons, Port States, Faction Influence,
// Blockades, War Zones, Hidden Coves, Drift Entities, Rumors,
// Ship Stats, Officers, Chase, Questlines, Risk, Heat

import { CONFIG, WIND_DIRS, WIND_STR } from './config.js';

// Re-export for convenience
export { CONFIG, WIND_DIRS, WIND_STR };

// Contract ID counter (module-level state)
let contractIdCounter = 1;

// ==================== PLAYER POWER SCORE SYSTEM ====================
// Calculates overall player strength for difficulty scaling
function getPlayerPower(gs) {
    const ps = CONFIG.balance.powerScore;
    let power = 0;

    // Wealth contribution
    power += (gs.player.gold || 0) * ps.goldWeight;

    // Cargo value (use base prices to avoid circular dependency)
    let cargoValue = 0;
    Object.entries(gs.player.cargo || {}).forEach(([gid, qty]) => {
        cargoValue += (CONFIG.goods[gid]?.basePrice || 0) * qty;
    });
    power += cargoValue * ps.cargoWeight;

    // Upgrades owned
    const upgradeCount = Object.keys(gs.player.upgrades || {}).filter(k => gs.player.upgrades[k]).length;
    power += upgradeCount * ps.upgradeWeight;

    // Title tiers (sum across all tracks)
    let totalTiers = 0;
    Object.keys(CONFIG.titles).forEach(trackId => {
        totalTiers += getTitleTierSafe(trackId, gs);
    });
    power += totalTiers * ps.titleWeight;

    // Days survived
    power += (gs.player.days || 1) * ps.daysWeight;

    // Contracts completed
    power += (gs.player.stats?.contractsCompleted || 0) * ps.contractsWeight;

    return Math.floor(power);
}

// Safe title tier lookup that doesn't cause circular dependency
function getTitleTierSafe(trackId, gs) {
    const track = CONFIG.titles[trackId];
    if (!track) return 0;
    let value = 0;
    switch (trackId) {
        case 'merchant': value = (gs.player.gold || 0); break; // Simplified, no cargo
        case 'smuggler': value = gs.player.stats?.contrabandTraded || 0; break;
        case 'voyager': value = gs.player.days || 0; break;
    }
    let tier = 0;
    for (let i = 0; i < track.thresholds.length; i++) {
        if (value >= track.thresholds[i]) tier = i + 1;
        else break;
    }
    return tier;
}

// Returns game phase: 'early', 'mid', 'late', 'endgame'
function getGamePhase(gs) {
    const power = getPlayerPower(gs);
    const t = CONFIG.balance.powerThresholds;
    if (power >= t.endgame) return 'endgame';
    if (power >= t.late) return 'late';
    if (power >= t.mid) return 'mid';
    return 'early';
}

// Get power-scaled multiplier (clamped between min and max)
function getPowerScaling(gs, baseMult, powerMult, min = 0, max = CONFIG.balance.difficulty.maxScaling) {
    const power = getPlayerPower(gs);
    return Math.max(min, Math.min(max, baseMult + power * powerMult));
}

// ==================== BOUNTY SYSTEM ====================
function getBounty(gs) {
    return gs.player.bounty || 0;
}

function addBounty(gs, amount) {
    if (!CONFIG.balance.bounty.enabled) return;
    gs.player.bounty = Math.max(0, (gs.player.bounty || 0) + amount);
}

function decayBounty(gs, isDocked = false, isFriendlyPort = false) {
    if (!CONFIG.balance.bounty.enabled) return;
    const bb = CONFIG.balance.bounty;
    let decay = bb.bountyDecayPerDay;
    if (isDocked && isFriendlyPort) decay = bb.bountyDecayDocked;
    gs.player.bounty = Math.max(0, (gs.player.bounty || 0) - decay);
}

function getBountyLevel(gs) {
    const bounty = getBounty(gs);
    const t = CONFIG.balance.bounty.thresholds;
    if (bounty >= t.infamous) return 'infamous';
    if (bounty >= t.hunted) return 'hunted';
    if (bounty >= t.wanted) return 'wanted';
    return 'clean';
}

// ==================== META PRESSURE SYSTEM ====================
// Detects repetitive player behavior and applies soft adaptive pressure

// Initialize or reset meta pressure for a game state
function metaInit(gs) {
    if (!gs.player.meta) {
        gs.player.meta = {
            recentRoutes: [],
            recentGoods: [],
            recentPorts: [],
            recentFactions: [],
            routeCounts: {},
            goodCounts: {},
            portCounts: {},
            factionCounts: {},
            pressure: { route: 0, good: 0, port: 0, faction: 0, total: 0 },
            lastPort: null,
            lastMilestones: { route: 0, good: 0, port: 0, faction: 0 },
            lastUpdateDay: 0
        };
    }
    return gs.player.meta;
}

// Helper: clamp value between 0 and 1
function clamp01(v) { return Math.max(0, Math.min(1, v)); }

// Helper: add to rolling window and maintain frequency counts
function metaAddToWindow(arr, counts, value, maxSize) {
    arr.push(value);
    counts[value] = (counts[value] || 0) + 1;

    // Trim window to max size
    while (arr.length > maxSize) {
        const removed = arr.shift();
        counts[removed]--;
        if (counts[removed] <= 0) delete counts[removed];
    }
}

// Helper: calculate bias score for a category
function metaCalcBias(counts, threshold, windowLen) {
    if (windowLen === 0) return 0;

    // Find top item share
    let topCount = 0;
    for (const key in counts) {
        if (counts[key] > topCount) topCount = counts[key];
    }

    const topShare = topCount / windowLen;

    // If under threshold, no bias
    if (topShare <= threshold) return 0;

    // Scale from threshold to 1.0
    return clamp01((topShare - threshold) / (1 - threshold));
}

// Helper: get the most frequent item in a counts object
function metaGetTopItem(counts) {
    let topItem = null, topCount = 0;
    for (const key in counts) {
        if (counts[key] > topCount) {
            topCount = counts[key];
            topItem = key;
        }
    }
    return topItem;
}

// Record a route (called when player docks at a new port)
function metaRecordRoute(gs, fromPort, toPort) {
    if (!CONFIG.metaPressure.enabled) return;
    const meta = metaInit(gs);

    // Create route key (normalized: alphabetical order for bidirectional routes)
    const routeKey = [fromPort, toPort].sort().join('>');

    metaAddToWindow(
        meta.recentRoutes,
        meta.routeCounts,
        routeKey,
        CONFIG.metaPressure.windowSize
    );

    // Also record the destination port
    const island = CONFIG.islands[toPort];
    if (island) {
        metaAddToWindow(
            meta.recentPorts,
            meta.portCounts,
            toPort,
            CONFIG.metaPressure.windowSize
        );

        // Record faction interaction
        metaAddToWindow(
            meta.recentFactions,
            meta.factionCounts,
            island.faction,
            CONFIG.metaPressure.windowSize
        );
    }

    // Update last port for next route calculation
    meta.lastPort = toPort;

    // Recalculate pressures
    metaRecalcPressure(gs);
}

// Record a trade (called when selling goods for profit)
function metaRecordTrade(gs, goodId, profit) {
    if (!CONFIG.metaPressure.enabled) return;
    if (profit <= 0) return; // Only track profitable trades

    const meta = metaInit(gs);

    metaAddToWindow(
        meta.recentGoods,
        meta.goodCounts,
        goodId,
        CONFIG.metaPressure.windowSize
    );

    // Recalculate pressures
    metaRecalcPressure(gs);
}

// Recalculate all pressure scores
function metaRecalcPressure(gs) {
    const meta = metaInit(gs);
    const cfg = CONFIG.metaPressure;

    // Calculate each bias
    meta.pressure.route = metaCalcBias(
        meta.routeCounts,
        cfg.thresholds.route,
        meta.recentRoutes.length
    );

    meta.pressure.good = metaCalcBias(
        meta.goodCounts,
        cfg.thresholds.good,
        meta.recentGoods.length
    );

    meta.pressure.port = metaCalcBias(
        meta.portCounts,
        cfg.thresholds.port,
        meta.recentPorts.length
    );

    meta.pressure.faction = metaCalcBias(
        meta.factionCounts,
        cfg.thresholds.faction,
        meta.recentFactions.length
    );

    // Total is weighted max of individual pressures
    meta.pressure.total = Math.max(
        meta.pressure.route,
        meta.pressure.good,
        meta.pressure.port * 0.8, // Port pressure weighted slightly less
        meta.pressure.faction * 0.7 // Faction pressure weighted less
    );
}

// Daily update: apply decay if player shows variety
function metaUpdateDaily(gs, showToast = null) {
    if (!CONFIG.metaPressure.enabled) return;
    const meta = metaInit(gs);
    const cfg = CONFIG.metaPressure;

    // Only update once per day
    if (meta.lastUpdateDay >= gs.player.days) return;
    meta.lastUpdateDay = gs.player.days;

    // Apply decay to pressure scores (represents world forgetting)
    const decayRate = cfg.decayPerDay;
    meta.pressure.route = Math.max(0, meta.pressure.route - decayRate);
    meta.pressure.good = Math.max(0, meta.pressure.good - decayRate);
    meta.pressure.port = Math.max(0, meta.pressure.port - decayRate);
    meta.pressure.faction = Math.max(0, meta.pressure.faction - decayRate);

    // Recalculate total
    meta.pressure.total = Math.max(
        meta.pressure.route,
        meta.pressure.good,
        meta.pressure.port * 0.8,
        meta.pressure.faction * 0.7
    );

    // Check for milestone notifications
    if (showToast) {
        metaCheckMilestones(gs, showToast);
    }
}

// Check if pressure crossed a milestone and show feedback
function metaCheckMilestones(gs, showToast) {
    const meta = metaInit(gs);
    const cfg = CONFIG.metaPressure;
    const milestones = cfg.feedbackMilestones;

    const categories = ['route', 'good', 'port', 'faction'];

    for (const cat of categories) {
        const pressure = meta.pressure[cat];
        const lastMilestone = meta.lastMilestones[cat] || 0;

        // Find the highest milestone we've crossed
        let crossedMilestone = 0;
        for (const m of milestones) {
            if (pressure >= m && m > lastMilestone) {
                crossedMilestone = m;
            }
        }

        if (crossedMilestone > 0) {
            meta.lastMilestones[cat] = crossedMilestone;

            // Get flavor text
            const texts = cfg.flavorText[cat];
            if (texts) {
                const isHigh = pressure >= 0.7;
                const pool = isHigh ? texts.peak : texts.rising;
                const msg = pool[Math.floor(Math.random() * pool.length)];
                showToast('World Adapts', msg);
            }
        }

        // Reset milestone if pressure drops
        if (pressure < milestones[0] && lastMilestone > 0) {
            meta.lastMilestones[cat] = 0;
        }
    }
}

// Get modifiers based on current meta pressure for game systems
// context: { route: "PortA>PortB", good: "rum", port: "portRoyal", faction: "english" }
function metaGetModifiers(gs, context = {}) {
    if (!CONFIG.metaPressure.enabled) {
        return {
            pirateChanceMult: 1,
            stormChanceMult: 1,
            priceMultSell: 1,
            saturationMult: 1,
            dockFeeMult: 1,
            inspectionChanceMult: 1
        };
    }

    const meta = metaInit(gs);
    const cfg = CONFIG.metaPressure;
    const caps = cfg.caps;

    let mods = {
        pirateChanceMult: 1,
        stormChanceMult: 1,
        priceMultSell: 1,
        saturationMult: 1,
        dockFeeMult: 1,
        inspectionChanceMult: 1
    };

    // Route-based modifiers (pirates and storms on that specific route)
    if (context.route) {
        const routeKey = context.route.includes('>') ? context.route : null;
        if (routeKey && meta.routeCounts[routeKey]) {
            const routeShare = meta.routeCounts[routeKey] / Math.max(1, meta.recentRoutes.length);
            if (routeShare > cfg.thresholds.route) {
                const intensity = clamp01((routeShare - cfg.thresholds.route) / (1 - cfg.thresholds.route));
                mods.pirateChanceMult += intensity * caps.pirateChance;
                mods.stormChanceMult += intensity * caps.stormChance;
            }
        }
    }

    // Good-based modifiers (prices for that good)
    if (context.good && meta.goodCounts[context.good]) {
        const goodShare = meta.goodCounts[context.good] / Math.max(1, meta.recentGoods.length);
        if (goodShare > cfg.thresholds.good) {
            const intensity = clamp01((goodShare - cfg.thresholds.good) / (1 - cfg.thresholds.good));
            mods.priceMultSell -= intensity * caps.priceReduction;
            mods.saturationMult += intensity * (caps.saturationMult - 1);
        }
    }

    // Port-based modifiers (dock fees and inspection at that port)
    if (context.port && meta.portCounts[context.port]) {
        const portShare = meta.portCounts[context.port] / Math.max(1, meta.recentPorts.length);
        if (portShare > cfg.thresholds.port) {
            const intensity = clamp01((portShare - cfg.thresholds.port) / (1 - cfg.thresholds.port));
            mods.dockFeeMult += intensity * caps.dockFeeIncrease;
            mods.inspectionChanceMult += intensity * caps.inspectionChance;
        }
    }

    // Faction-based modifiers (inspection in that faction's territory)
    if (context.faction && meta.factionCounts[context.faction]) {
        const factionShare = meta.factionCounts[context.faction] / Math.max(1, meta.recentFactions.length);
        if (factionShare > cfg.thresholds.faction) {
            const intensity = clamp01((factionShare - cfg.thresholds.faction) / (1 - cfg.thresholds.faction));
            mods.inspectionChanceMult += intensity * caps.inspectionChance * 0.5; // Stacks partially
        }
    }

    return mods;
}

// Get a summary of current meta pressure for UI display
function metaGetSummary(gs) {
    const meta = metaInit(gs);

    // Determine primary pressure type
    const pressures = [
        { type: 'route', value: meta.pressure.route },
        { type: 'good', value: meta.pressure.good },
        { type: 'port', value: meta.pressure.port },
        { type: 'faction', value: meta.pressure.faction }
    ].sort((a, b) => b.value - a.value);

    const primary = pressures[0];

    // Get the top item causing the pressure
    let topItem = null;
    switch (primary.type) {
        case 'route': topItem = metaGetTopItem(meta.routeCounts); break;
        case 'good': topItem = metaGetTopItem(meta.goodCounts); break;
        case 'port': topItem = metaGetTopItem(meta.portCounts); break;
        case 'faction': topItem = metaGetTopItem(meta.factionCounts); break;
    }

    return {
        total: meta.pressure.total,
        primary: primary.type,
        primaryValue: primary.value,
        topItem,
        route: meta.pressure.route,
        good: meta.pressure.good,
        port: meta.pressure.port,
        faction: meta.pressure.faction
    };
}

// ==================== DEMAND SATURATION SYSTEM ====================
function getMarketSaturation(gs, iid, gid) {
    if (!CONFIG.balance.demandSaturation.enabled) return 0;
    return gs.world.saturation?.[iid]?.[gid] || 0;
}

function addMarketSaturation(gs, iid, gid, qty) {
    if (!CONFIG.balance.demandSaturation.enabled) return;
    if (!gs.world.saturation) gs.world.saturation = {};
    if (!gs.world.saturation[iid]) gs.world.saturation[iid] = {};
    // === META PRESSURE: Good bias makes saturation ramp faster ===
    const metaMods = metaGetModifiers(gs, { good: gid });
    const effectiveQty = Math.ceil(qty * metaMods.saturationMult);
    gs.world.saturation[iid][gid] = (gs.world.saturation[iid][gid] || 0) + effectiveQty;
}

function decayMarketSaturation(gs) {
    if (!CONFIG.balance.demandSaturation.enabled || !gs.world.saturation) return;
    const recovery = CONFIG.balance.demandSaturation.recoveryPerDay;
    for (const iid of Object.keys(gs.world.saturation)) {
        for (const gid of Object.keys(gs.world.saturation[iid])) {
            gs.world.saturation[iid][gid] = Math.max(0, gs.world.saturation[iid][gid] - recovery);
            if (gs.world.saturation[iid][gid] <= 0) delete gs.world.saturation[iid][gid];
        }
        if (Object.keys(gs.world.saturation[iid]).length === 0) delete gs.world.saturation[iid];
    }
}

function getSaturationPenalty(gs, iid, gid) {
    if (!CONFIG.balance.demandSaturation.enabled) return 1;
    const sat = getMarketSaturation(gs, iid, gid);
    const ds = CONFIG.balance.demandSaturation;
    if (sat <= ds.threshold) return 1;
    const excess = sat - ds.threshold;
    const penalty = 1 - (excess * ds.decayRate);
    return Math.max(ds.maxPenalty, penalty);
}

// ==================== FENCE LIMIT SYSTEM ====================
function getFenceUsage(gs, iid) {
    const fenceData = gs.world.fenceUsage?.[iid];
    if (!fenceData) return 0;
    const daysSince = gs.player.days - fenceData.lastDay;
    if (daysSince >= CONFIG.balance.smuggling.fenceLimitDecayDays) return 0;
    return fenceData.amount || 0;
}

function addFenceUsage(gs, iid, qty) {
    if (!gs.world.fenceUsage) gs.world.fenceUsage = {};
    const existing = gs.world.fenceUsage[iid];
    if (existing && (gs.player.days - existing.lastDay) < CONFIG.balance.smuggling.fenceLimitDecayDays) {
        existing.amount += qty;
        existing.lastDay = gs.player.days;
    } else {
        gs.world.fenceUsage[iid] = { amount: qty, lastDay: gs.player.days };
    }
}

function canFence(gs, iid, qty) {
    const current = getFenceUsage(gs, iid);
    const limit = CONFIG.balance.smuggling.fenceLimit;
    return (current + qty) <= limit;
}

function getFenceRemaining(gs, iid) {
    return Math.max(0, CONFIG.balance.smuggling.fenceLimit - getFenceUsage(gs, iid));
}

// ==================== UPKEEP SYSTEM ====================
function calculateDailyUpkeep(gs) {
    if (!CONFIG.balance.upkeep.enabled) return 0;
    const up = CONFIG.balance.upkeep;
    const upgradeCount = Object.keys(gs.player.upgrades || {}).filter(k => gs.player.upgrades[k]).length;

    // Base upkeep
    let upkeep = up.crewWagesPerDay + (upgradeCount * up.crewWagesPerUpgrade) + up.maintenancePerDay;

    // Ship class upkeep multiplier
    const shipClass = CONFIG.shipClasses[gs.player.shipClass] || CONFIG.shipClasses.brigantine;
    upkeep *= shipClass.upkeepMult;

    // Officer wages
    upkeep += getOfficerWages(gs);

    // Quartermaster reduces upkeep
    if (hasOfficer(gs, 'quartermaster')) {
        upkeep *= CONFIG.officers.quartermaster.effects.upkeepMult;
    }

    // Gunner increases maintenance
    if (hasOfficer(gs, 'gunner')) {
        upkeep *= CONFIG.officers.gunner.effects.maintenanceMult;
    }

    return Math.ceil(upkeep);
}

function calculateDockingFee(gs, iid) {
    if (!CONFIG.balance.upkeep.enabled) return 0;
    const up = CONFIG.balance.upkeep;
    const isl = CONFIG.islands[iid];
    let fee = up.dockingFee;
    // Hostile port fee
    if (isl?.faction && isl.faction !== 'neutral' && isl.faction !== gs.player.faction) {
        const rep = gs.player.reputation?.[isl.faction] || 0;
        if (rep < -20) fee += up.dockingFeeHostile;
    }
    // === META PRESSURE: Port bias increases dock fees (they've learned to charge you more) ===
    const metaMods = metaGetModifiers(gs, { port: iid });
    fee = Math.ceil(fee * metaMods.dockFeeMult);
    return fee;
}

// ==================== ANTI-SPAM SYSTEMS ====================

// Trade fatigue: prices worsen after too many transactions at one port
function getTradeFatigue(gs, iid) {
    if (!CONFIG.balance.tradeFatigue.enabled) return 0;
    const fatigue = gs.player.tradeFatigue?.[iid] || 0;
    const tf = CONFIG.balance.tradeFatigue;
    const excessTrades = Math.max(0, fatigue - tf.transactionsPerVisit);
    return Math.min(tf.maxPenalty, excessTrades * tf.penaltyPerTrade);
}

function addTradeFatigue(gs, iid) {
    if (!gs.player.tradeFatigue) gs.player.tradeFatigue = {};
    gs.player.tradeFatigue[iid] = (gs.player.tradeFatigue[iid] || 0) + 1;
}

function resetTradeFatigue(gs) {
    // Reset all fatigue when leaving port
    gs.player.tradeFatigue = {};
}

// Port visit cooldown: visiting same port too quickly worsens prices
function getPortVisitPenalty(gs, iid) {
    if (!CONFIG.balance.portVisitCooldown.enabled) return 0;
    const lastVisit = gs.player.portVisitDays?.[iid];
    if (lastVisit === undefined) return 0;

    const pv = CONFIG.balance.portVisitCooldown;
    const daysSince = gs.player.days - lastVisit;
    if (daysSince >= pv.minDaysBetween) return 0;

    const earlyDays = pv.minDaysBetween - daysSince;
    return Math.min(pv.maxPenalty, earlyDays * pv.penaltyPerEarlyDay);
}

function recordPortVisit(gs, iid) {
    if (!gs.player.portVisitDays) gs.player.portVisitDays = {};
    gs.player.portVisitDays[iid] = gs.player.days;
}

// Bulk trade penalty: larger single transactions have diminishing returns
function getBulkTradePenalty(qty) {
    if (!CONFIG.balance.bulkTrade.enabled) return 0;
    const bt = CONFIG.balance.bulkTrade;
    const excessUnits = Math.max(0, qty - bt.threshold);
    return Math.min(bt.maxPenalty, excessUnits * bt.penaltyPerUnit);
}

// Combined anti-spam price modifier (for selling)
function getAntiSpamSellMult(gs, iid, qty) {
    const fatiguePenalty = getTradeFatigue(gs, iid);
    const visitPenalty = getPortVisitPenalty(gs, iid);
    const bulkPenalty = getBulkTradePenalty(qty);
    return Math.max(0.5, 1 - fatiguePenalty - visitPenalty - bulkPenalty);
}

// Combined anti-spam price modifier (for buying - less punitive)
function getAntiSpamBuyMult(gs, iid, qty) {
    const fatiguePenalty = getTradeFatigue(gs, iid) * 0.5; // Half penalty for buying
    const visitPenalty = getPortVisitPenalty(gs, iid) * 0.5;
    const bulkPenalty = getBulkTradePenalty(qty) * 0.5;
    return Math.min(1.5, 1 + fatiguePenalty + visitPenalty + bulkPenalty); // Prices go UP
}

// ==================== TITLE SYSTEM ====================
function getTitleTier(trackId, gs) {
    const track = CONFIG.titles[trackId];
    if (!track) return 0;
    const value = getTitleTrackValue(trackId, gs);
    let tier = 0;
    for (let i = 0; i < track.thresholds.length; i++) {
        if (value >= track.thresholds[i]) tier = i + 1;
        else break;
    }
    // Beyond last threshold: scale infinitely
    if (tier >= track.thresholds.length) {
        const lastThreshold = track.thresholds[track.thresholds.length - 1];
        const extraTiers = Math.floor((value - lastThreshold) / (lastThreshold * 0.5));
        tier = track.thresholds.length + extraTiers;
    }
    return tier;
}

function getTitleTrackValue(trackId, gs) {
    switch (trackId) {
        case 'merchant': return getNetWorth(gs);
        case 'smuggler': return gs.player.stats?.contrabandTraded || 0;
        case 'voyager': return gs.player.days || 0;
        default: return 0;
    }
}

function getTitleName(trackId, tier) {
    const track = CONFIG.titles[trackId];
    if (!track) return 'Unknown';
    if (tier < track.tierNames.length) return track.tierNames[tier];
    return track.tierNames[track.tierNames.length - 1] + ' ' + (tier - track.tierNames.length + 2);
}

function getNextThreshold(trackId, gs) {
    const track = CONFIG.titles[trackId];
    if (!track) return null;
    const value = getTitleTrackValue(trackId, gs);
    for (const t of track.thresholds) {
        if (value < t) return t;
    }
    // Beyond last: calculate next scaling threshold
    const lastThreshold = track.thresholds[track.thresholds.length - 1];
    const extraTiers = Math.floor((value - lastThreshold) / (lastThreshold * 0.5)) + 1;
    return lastThreshold + extraTiers * (lastThreshold * 0.5);
}

function getTitleModifiers(gs) {
    const mods = {
        repGainMult: 1.0,      // Multiplier for rep gains
        repLossReduction: 0,   // % reduction in rep losses
        inspectionReduction: 0, // % reduction in inspection chance
        tributeReduction: 0,   // % reduction in tribute costs
        tariffReduction: 0     // % reduction in tariffs
    };

    for (const [trackId, track] of Object.entries(CONFIG.titles)) {
        const tier = getTitleTier(trackId, gs);
        if (tier > 0 && track.effects) {
            if (track.effects.repGainMult) mods.repGainMult += track.effects.repGainMult * tier;
            if (track.effects.repLossReduction) mods.repLossReduction += track.effects.repLossReduction * tier;
            if (track.effects.inspectionReduction) mods.inspectionReduction += track.effects.inspectionReduction * tier;
            if (track.effects.tributeReduction) mods.tributeReduction += track.effects.tributeReduction * tier;
            if (track.effects.tariffReduction) mods.tariffReduction += track.effects.tariffReduction * tier;
        }
    }

    // Faction standing bonuses
    for (const faction of ['english', 'eitc', 'pirates']) {
        const rep = gs.player.reputation[faction] || 0;
        if (rep > 50) mods.tariffReduction += 0.05; // High standing = better tariffs
    }

    // Cap modifiers
    mods.repLossReduction = Math.min(0.5, mods.repLossReduction); // Max 50% reduction
    mods.inspectionReduction = Math.min(0.5, mods.inspectionReduction);
    mods.tributeReduction = Math.min(0.4, mods.tributeReduction);
    mods.tariffReduction = Math.min(0.2, mods.tariffReduction);

    return mods;
}

function updateTitles(gs, showToast = null) {
    if (!gs.player.titles) gs.player.titles = {};

    for (const trackId of Object.keys(CONFIG.titles)) {
        const oldTier = gs.player.titles[trackId] || 0;
        const newTier = getTitleTier(trackId, gs);

        if (newTier > oldTier) {
            gs.player.titles[trackId] = newTier;
            if (showToast) {
                const track = CONFIG.titles[trackId];
                showToast(track.icon, getTitleName(trackId, newTier), `${track.name} title earned!`);
            }
        }
    }
}

// ==================== REPUTATION SYSTEM ====================
function applyRepChange(gs, faction, delta, source = null) {
    const mods = getTitleModifiers(gs);

    // Apply modifiers
    if (delta > 0) {
        delta = Math.round(delta * mods.repGainMult);
    } else if (delta < 0) {
        delta = Math.round(delta * (1 - mods.repLossReduction));
    }

    // Apply change with clamping
    const oldRep = gs.player.reputation[faction] || 0;
    gs.player.reputation[faction] = Math.max(-100, Math.min(100, oldRep + delta));

    // Track stats
    if (!gs.player.stats) gs.player.stats = {};
    if (!gs.player.stats.repChanges) gs.player.stats.repChanges = {};
    if (!gs.player.stats.repChanges[faction]) gs.player.stats.repChanges[faction] = { gained: 0, lost: 0 };

    if (delta > 0) gs.player.stats.repChanges[faction].gained += delta;
    else if (delta < 0) gs.player.stats.repChanges[faction].lost += Math.abs(delta);

    return gs.player.reputation[faction] - oldRep;
}

// ==================== CONTRACT SYSTEM ====================

function generateContractId() {
    return 'c_' + (contractIdCounter++) + '_' + Date.now().toString(36);
}

function generateContractsForIsland(gs, iid) {
    const contracts = [];
    const island = CONFIG.islands[iid];
    if (!island) return contracts;

    const numContracts = 3 + Math.floor(Math.random() * (CONFIG.settings.contractBoardSize - 2));
    const otherIslands = Object.keys(CONFIG.islands).filter(id => id !== iid);

    for (let i = 0; i < numContracts; i++) {
        const destId = otherIslands[Math.floor(Math.random() * otherIslands.length)];
        const dest = CONFIG.islands[destId];
        const dist = getIslandDistance(island.position, dest.position);
        const baseDays = Math.ceil(dist / 30);

        // Pick contract type based on island faction
        const types = ['delivery', 'courier', 'supply'];
        if (island.faction === 'pirates' || dest.faction === 'pirates') types.push('smuggling', 'smuggling');
        if (island.faction !== 'neutral') types.push('faction');

        const typeId = types[Math.floor(Math.random() * types.length)];
        const type = CONFIG.contractTypes[typeId];

        // Calculate rewards based on distance, urgency, risk
        const urgency = 0.8 + Math.random() * 0.4; // 0.8-1.2
        const deadline = Math.max(2, Math.floor(baseDays * (1.5 + (1 - urgency) * 2)));
        const riskFactor = type.riskMult * (1 + getRouteRiskBetween(gs, iid, destId) * 0.5);

        // === BALANCE: Contract rewards scale down with player power ===
        // Prevents snowballing - as player gets richer, contracts become less lucrative
        const prog = CONFIG.balance.progression;
        const powerRewardMult = getPowerScaling(gs, prog.contractRewardBase, prog.contractRewardPowerMult, prog.contractRewardMin, 1.0);

        let goldReward = Math.floor(type.baseReward * (1 + dist / 100) * riskFactor * urgency * powerRewardMult);
        let repReward = type.repReward;
        let repFaction = island.faction !== 'neutral' ? island.faction : (Math.random() > 0.5 ? 'english' : 'eitc');

        // Contract-specific requirements
        let requirement = null;
        let goodId = null;
        let qty = 0;

        if (typeId === 'delivery') {
            const goods = Object.keys(CONFIG.goods).filter(g => CONFIG.goods[g].category !== 'contraband');
            goodId = goods[Math.floor(Math.random() * goods.length)];
            qty = 3 + Math.floor(Math.random() * 8);
            requirement = { type: 'deliver', goodId, qty };
        } else if (typeId === 'smuggling') {
            goodId = 'gunpowder';
            qty = 2 + Math.floor(Math.random() * 5);
            requirement = { type: 'deliver', goodId, qty };
            repFaction = 'pirates';
            goldReward = Math.floor(goldReward * 1.5);
        } else if (typeId === 'courier') {
            requirement = { type: 'reach', noInspection: Math.random() > 0.5 };
        } else if (typeId === 'supply') {
            requirement = { type: 'supplies', minSupplies: 10 + Math.floor(Math.random() * 10) };
        } else if (typeId === 'faction') {
            requirement = { type: 'reach' };
            goldReward = Math.floor(goldReward * 0.6);
            repReward = Math.floor(repReward * 1.5);
        }

        contracts.push({
            id: generateContractId(),
            typeId,
            title: generateContractTitle(typeId, goodId, dest.name),
            fromIsland: iid,
            toIsland: destId,
            deadline,
            requirement,
            rewards: { gold: goldReward, rep: repReward, repFaction },
            dayAccepted: null,
            status: 'available'
        });
    }

    return contracts;
}

function generateContractTitle(typeId, goodId, destName) {
    const good = goodId ? CONFIG.goods[goodId] : null;
    switch (typeId) {
        case 'delivery': return `Deliver ${good?.name || 'goods'} to ${destName}`;
        case 'smuggling': return `Smuggle cargo to ${destName}`;
        case 'courier': return `Urgent dispatch to ${destName}`;
        case 'supply': return `Supply run to ${destName}`;
        case 'faction': return `Official business at ${destName}`;
        default: return `Contract to ${destName}`;
    }
}

function getIslandDistance(pos1, pos2) {
    return Math.sqrt((pos1.x - pos2.x) ** 2 + (pos1.z - pos2.z) ** 2);
}

function getRouteRiskBetween(gs, fromId, toId) {
    const from = CONFIG.islands[fromId];
    const to = CONFIG.islands[toId];
    let risk = 0;
    if (to.faction === 'pirates') risk += 0.3;
    if (from.faction === 'pirates') risk += 0.2;
    return Math.min(1, risk);
}

function acceptContract(gs, contractId) {
    const active = gs.player.contracts.active || [];
    if (active.length >= CONFIG.settings.maxActiveContracts) return { success: false, reason: 'Too many active contracts' };

    // Find contract in any board
    for (const iid of Object.keys(gs.world.boards)) {
        const board = gs.world.boards[iid];
        const idx = board.contracts.findIndex(c => c.id === contractId);
        if (idx !== -1) {
            const contract = board.contracts[idx];
            const type = CONFIG.contractTypes[contract.typeId];

            // === BALANCE: Contract acceptance costs ===
            // Courier contracts require a deposit (refunded on completion)
            if (type.depositPct) {
                const deposit = Math.floor(contract.rewards.gold * type.depositPct);
                if (gs.player.gold < deposit) {
                    return { success: false, reason: `Need ${deposit}g deposit` };
                }
                gs.player.gold -= deposit;
                contract.deposit = deposit;
            }

            // Supply contracts consume supplies upfront
            if (type.supplyCost) {
                if (gs.player.supplies < type.supplyCost) {
                    return { success: false, reason: `Need ${type.supplyCost} supplies` };
                }
                gs.player.supplies -= type.supplyCost;
            }

            // Remove from board and activate
            board.contracts.splice(idx, 1);
            contract.dayAccepted = gs.player.days;
            contract.status = 'active';
            active.push(contract);
            gs.player.contracts.active = active;
            return { success: true, contract };
        }
    }
    return { success: false, reason: 'Contract not found' };
}

function abandonContract(gs, contractId) {
    const idx = gs.player.contracts.active.findIndex(c => c.id === contractId);
    if (idx === -1) return false;

    const contract = gs.player.contracts.active.splice(idx, 1)[0];
    contract.status = 'abandoned';
    gs.player.contracts.failed.push(contract);

    // Small rep penalty
    applyRepChange(gs, contract.rewards.repFaction, -3, 'abandon_contract');

    if (gs.player.trackedContractId === contractId) {
        gs.player.trackedContractId = null;
    }

    return true;
}

function evaluateContractsOnDock(gs, iid) {
    const completed = [];
    const toRemove = [];

    for (const contract of gs.player.contracts.active) {
        if (contract.toIsland !== iid) continue;

        let success = false;
        const req = contract.requirement;

        if (req.type === 'deliver') {
            const have = gs.player.cargo[req.goodId] || 0;
            if (have >= req.qty) {
                gs.player.cargo[req.goodId] = have - req.qty;
                if (gs.player.cargo[req.goodId] <= 0) delete gs.player.cargo[req.goodId];
                success = true;

                // Track contraband for smuggler title
                if (CONFIG.goods[req.goodId]?.category === 'contraband') {
                    if (!gs.player.stats) gs.player.stats = {};
                    gs.player.stats.contrabandTraded = (gs.player.stats.contrabandTraded || 0) + req.qty;
                }
            }
        } else if (req.type === 'reach') {
            if (req.noInspection && contract.wasInspected) {
                success = false;
            } else {
                success = true;
            }
        } else if (req.type === 'supplies') {
            if (gs.player.supplies >= req.minSupplies) {
                success = true;
            }
        } else {
            success = true;
        }

        if (success) {
            completed.push(contract);
            toRemove.push(contract.id);
        }
    }

    // Remove completed from active
    gs.player.contracts.active = gs.player.contracts.active.filter(c => !toRemove.includes(c.id));

    // Award rewards
    for (const contract of completed) {
        gs.player.gold += contract.rewards.gold;

        // === BALANCE: Refund deposit if any ===
        if (contract.deposit) {
            gs.player.gold += contract.deposit;
        }

        applyRepChange(gs, contract.rewards.repFaction, contract.rewards.rep, 'contract_complete');
        contract.status = 'completed';
        gs.player.contracts.completed.push(contract);

        // Track stats
        if (!gs.player.stats) gs.player.stats = {};
        gs.player.stats.contractsCompleted = (gs.player.stats.contractsCompleted || 0) + 1;

        // Smuggling increases crackdown
        if (contract.typeId === 'smuggling') {
            gs.world.crackdown.level = Math.min(
                CONFIG.settings.crackdownMaxLevel,
                (gs.world.crackdown.level || 0) + 15
            );
        }

        if (gs.player.trackedContractId === contract.id) {
            gs.player.trackedContractId = null;
        }
    }

    return completed;
}

function expireContracts(gs) {
    const expired = [];
    const toRemove = [];

    for (const contract of gs.player.contracts.active) {
        const daysElapsed = gs.player.days - contract.dayAccepted;
        if (daysElapsed >= contract.deadline) {
            expired.push(contract);
            toRemove.push(contract.id);
        }
    }

    gs.player.contracts.active = gs.player.contracts.active.filter(c => !toRemove.includes(c.id));

    for (const contract of expired) {
        contract.status = 'failed';
        gs.player.contracts.failed.push(contract);
        applyRepChange(gs, contract.rewards.repFaction, -Math.abs(contract.rewards.rep), 'contract_failed');

        if (gs.player.trackedContractId === contract.id) {
            gs.player.trackedContractId = null;
        }
    }

    return expired;
}

function getTrackedContract(gs) {
    if (!gs.player.trackedContractId) return null;
    return gs.player.contracts.active.find(c => c.id === gs.player.trackedContractId);
}

function refreshContractBoard(gs, iid) {
    if (!gs.world.boards) gs.world.boards = {};

    const board = gs.world.boards[iid];
    const shouldRefresh = !board ||
        (gs.player.days - board.dayGenerated) >= CONFIG.settings.contractRefreshDays ||
        board.contracts.length === 0;

    if (shouldRefresh) {
        gs.world.boards[iid] = {
            dayGenerated: gs.player.days,
            contracts: generateContractsForIsland(gs, iid)
        };
    }

    return gs.world.boards[iid];
}

// ==================== LIVING WORLD SYSTEM ====================
function tickWorldStatePerDay(gs) {
    if (!gs.world) gs.world = {};

    // Crackdown decay
    if (gs.world.crackdown) {
        gs.world.crackdown.level = Math.max(0, (gs.world.crackdown.level || 0) - CONFIG.settings.crackdownDecayPerDay);
    }

    // Regional event management
    if (gs.world.regionalEvent) {
        gs.world.regionalEvent.daysRemaining--;
        if (gs.world.regionalEvent.daysRemaining <= 0) {
            gs.world.regionalEvent = null;
        }
    }

    // Chance to spawn new regional event
    if (!gs.world.regionalEvent && Math.random() < 0.05) {
        const event = CONFIG.regionalEvents[Math.floor(Math.random() * CONFIG.regionalEvents.length)];
        gs.world.regionalEvent = {
            id: event.id,
            name: event.name,
            desc: event.desc,
            categoryMult: { ...event.categoryMult },
            daysRemaining: event.duration,
            affectedIslands: getRandomIslandSubset(3 + Math.floor(Math.random() * 3))
        };
    }

    // === LIVING SEA UPDATES ===

    // Update drift entities (storms, fleets, markets move across map)
    updateDriftEntities(gs);

    // Update port states
    updatePortStates(gs);

    // Update faction influence, blockades, and war zones
    updateFactionInfluence(gs);

    // Seasonal event management
    if (gs.world.seasonalEvent) {
        gs.world.seasonalEvent.daysRemaining--;
        if (gs.world.seasonalEvent.daysRemaining <= 0) {
            gs.world.seasonalEvent = null;
        }
    }

    // Chance to spawn seasonal event (based on current season)
    if (!gs.world.seasonalEvent && Math.random() < 0.03) {
        const season = getCurrentSeason(gs);
        const eligibleEvents = CONFIG.seasonalEvents.filter(e =>
            e.season === 'any' || e.season === season.id
        );
        if (eligibleEvents.length > 0) {
            const event = eligibleEvents[Math.floor(Math.random() * eligibleEvents.length)];
            gs.world.seasonalEvent = {
                id: event.id,
                name: event.name,
                desc: event.desc,
                effects: { ...event.effects },
                daysRemaining: event.duration,
                startDay: gs.player.days
            };
        }
    }

    // Check for season change notification
    const prevSeason = gs.world.lastSeason;
    const currentSeason = getCurrentSeason(gs);
    if (prevSeason && prevSeason !== currentSeason.id) {
        gs.world.seasonChanged = { from: prevSeason, to: currentSeason.id };
    }
    gs.world.lastSeason = currentSeason.id;
}

function getRandomIslandSubset(count) {
    const islands = Object.keys(CONFIG.islands);
    const shuffled = islands.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, islands.length));
}

function getCrackdownLevel(gs) {
    return gs.world?.crackdown?.level || 0;
}

// ==================== LIVING SEA - SEASONS ====================
function getCurrentSeason(gs) {
    const day = ((gs.player.days - 1) % CONFIG.settings.seasonCycleDays) + 1;
    for (const [id, season] of Object.entries(CONFIG.seasons)) {
        if (day >= season.dayStart && day <= season.dayEnd) {
            return { id, ...season, currentDay: day };
        }
    }
    return { id: 'calmWinds', ...CONFIG.seasons.calmWinds, currentDay: day };
}

function getSeasonLabel(gs) {
    const season = getCurrentSeason(gs);
    const daysInSeason = season.dayEnd - season.dayStart + 1;
    const dayInSeason = season.currentDay - season.dayStart + 1;
    return {
        label: season.name,
        icon: season.icon,
        class: season.id === 'monsoon' ? 'storm-season' : '',
        desc: season.desc,
        progress: `Day ${dayInSeason}/${daysInSeason}`
    };
}

function isStormSeason(gs) {
    const season = getCurrentSeason(gs);
    return season.id === 'monsoon';
}

function getSeasonModifiers(gs) {
    const season = getCurrentSeason(gs);
    return {
        stormMult: season.stormMult || 1,
        priceMult: season.priceMult || 1,
        piratesMult: season.piratesMult || 1,
        speedMult: season.speedMult || 1,
        supplyCostMult: season.supplyCostMult || 1,
        windStrengthBias: season.windStrengthBias || 0
    };
}

// ==================== LIVING SEA - PORT STATES ====================
function getPortState(gs, iid) {
    return gs.world?.portStates?.[iid] || 'prosperous';
}

function getPortStateConfig(gs, iid) {
    const stateId = getPortState(gs, iid);
    return CONFIG.portStates[stateId] || CONFIG.portStates.prosperous;
}

function updatePortStates(gs) {
    if (!gs.world.portStates) gs.world.portStates = {};

    for (const iid of Object.keys(CONFIG.islands)) {
        const island = gs.islands[iid];
        const currentState = gs.world.portStates[iid] || 'prosperous';

        // Check for state transitions based on conditions
        if (Math.random() < CONFIG.settings.portStateChangeChance) {
            const newState = determinePortState(gs, iid, island);
            if (newState !== currentState) {
                gs.world.portStates[iid] = newState;
                gs.world.portStateChanges = gs.world.portStateChanges || [];
                gs.world.portStateChanges.push({ iid, from: currentState, to: newState, day: gs.player.days });
            }
        }
    }
}

function determinePortState(gs, iid, island) {
    const season = getCurrentSeason(gs);
    const roll = Math.random();

    // Seasonal influences
    if (season.id === 'monsoon' && roll < 0.2) return 'flooded';
    if (season.id === 'doldrums' && roll < 0.15) return 'struggling';

    // Faction influences
    if (island.faction === 'pirates' && roll < 0.25) return 'lawless';

    // Supply-based states
    let totalSupply = 0, totalDemand = 0;
    Object.values(island.markets).forEach(m => {
        totalSupply += m.supply;
        totalDemand += m.demand;
    });

    const ratio = totalSupply / Math.max(1, totalDemand);
    if (ratio < 0.3) return Math.random() < 0.5 ? 'starving' : 'struggling';
    if (ratio > 1.5) return 'prosperous';

    // Random events
    if (roll < 0.05) return 'blockaded';
    if (roll < 0.08) return 'lawless';

    // Tendency toward normalcy
    return roll < 0.6 ? 'prosperous' : 'struggling';
}

// ==================== LIVING SEA - FACTION INFLUENCE & WAR FRONTS ====================
function initIslandInfluence(gs) {
    if (!gs.world.islandInfluence) gs.world.islandInfluence = {};

    // Initialize influence for each island based on base faction
    for (const [iid, island] of Object.entries(CONFIG.islands)) {
        if (!gs.world.islandInfluence[iid]) {
            gs.world.islandInfluence[iid] = {
                english: island.faction === 'english' ? 60 : (island.faction === 'neutral' ? 30 : 15),
                eitc: island.faction === 'eitc' ? 60 : (island.faction === 'neutral' ? 30 : 15),
                pirates: island.faction === 'pirates' ? 60 : (island.faction === 'neutral' ? 30 : 15),
                stability: 100
            };
        }
    }
}

function getIslandInfluence(gs, iid) {
    initIslandInfluence(gs);
    return gs.world.islandInfluence[iid] || { english: 33, eitc: 33, pirates: 33, stability: 100 };
}

function getDominantFaction(gs, iid) {
    const inf = getIslandInfluence(gs, iid);
    const threshold = CONFIG.warFronts.controlThreshold;

    // Check if any faction has control
    if (inf.english >= threshold) return 'english';
    if (inf.eitc >= threshold) return 'eitc';
    if (inf.pirates >= threshold) return 'pirates';

    // No clear control - contested
    return 'contested';
}

function isIslandContested(gs, iid) {
    return getDominantFaction(gs, iid) === 'contested';
}

function modifyInfluence(gs, iid, faction, amount) {
    initIslandInfluence(gs);
    const inf = gs.world.islandInfluence[iid];
    if (!inf) return;

    // Add to the specified faction
    inf[faction] = Math.max(0, Math.min(100, (inf[faction] || 0) + amount));

    // Proportionally reduce others to keep total around 100
    const total = inf.english + inf.eitc + inf.pirates;
    if (total > 100) {
        const excess = total - 100;
        const others = ['english', 'eitc', 'pirates'].filter(f => f !== faction);
        const otherTotal = others.reduce((sum, f) => sum + inf[f], 0);
        if (otherTotal > 0) {
            for (const f of others) {
                inf[f] = Math.max(0, inf[f] - (inf[f] / otherTotal) * excess);
            }
        }
    }

    // Reduce stability when influence changes rapidly
    if (Math.abs(amount) > 2) {
        inf.stability = Math.max(0, inf.stability - Math.abs(amount) * 0.5);
    }
}

function applyTradeInfluence(gs, iid, playerFaction) {
    const wf = CONFIG.warFronts;
    modifyInfluence(gs, iid, playerFaction, wf.influencePerTrade);
}

function applyQuestInfluence(gs, iid, faction) {
    const wf = CONFIG.warFronts;
    modifyInfluence(gs, iid, faction, wf.influencePerQuest);
}

function applySmuggleInfluence(gs, iid) {
    const wf = CONFIG.warFronts;
    // Smuggling destabilizes all factions
    const inf = getIslandInfluence(gs, iid);
    modifyInfluence(gs, iid, 'pirates', Math.abs(wf.influencePerSmuggle));
    inf.stability = Math.max(0, inf.stability - 5);
}

function updateFactionInfluence(gs) {
    initIslandInfluence(gs);
    const wf = CONFIG.warFronts;

    // Daily stability recovery
    for (const [iid, inf] of Object.entries(gs.world.islandInfluence)) {
        inf.stability = Math.min(100, inf.stability + wf.stabilityRecoveryPerDay);

        // Natural drift toward base faction
        const baseFaction = CONFIG.islands[iid]?.faction;
        if (baseFaction && baseFaction !== 'neutral') {
            modifyInfluence(gs, iid, baseFaction, 0.2);
        }
    }

    // Update blockades
    updateBlockades(gs);

    // Update war zones
    updateWarZones(gs);
}

// ==================== LIVING SEA - BLOCKADES ====================
function getActiveBlockades(gs) {
    return gs.world.activeBlockades || [];
}

function isIslandBlockaded(gs, iid) {
    return getActiveBlockades(gs).some(b => b.islandId === iid && b.daysRemaining > 0);
}

function getBlockadeInfo(gs, iid) {
    return getActiveBlockades(gs).find(b => b.islandId === iid && b.daysRemaining > 0);
}

function startBlockade(gs, iid, blockadingFaction) {
    if (!gs.world.activeBlockades) gs.world.activeBlockades = [];

    // Check if already blockaded
    if (isIslandBlockaded(gs, iid)) return null;

    const blockade = {
        id: 'blockade_' + Date.now(),
        islandId: iid,
        blockadingFaction,
        daysRemaining: CONFIG.warFronts.blockadeDuration,
        startDay: gs.player.days,
        strength: 50 + Math.floor(Math.random() * 50) // 50-100%
    };

    gs.world.activeBlockades.push(blockade);

    // Set port state to blockaded
    if (!gs.world.portStates) gs.world.portStates = {};
    gs.world.portStates[iid] = 'blockaded';

    return blockade;
}

function updateBlockades(gs) {
    if (!gs.world.activeBlockades) gs.world.activeBlockades = [];

    // Decrement days and remove expired blockades
    gs.world.activeBlockades = gs.world.activeBlockades.filter(b => {
        b.daysRemaining--;
        if (b.daysRemaining <= 0) {
            // Remove blockaded port state
            if (gs.world.portStates?.[b.islandId] === 'blockaded') {
                gs.world.portStates[b.islandId] = 'struggling';
            }
            return false;
        }
        return true;
    });

    // Random chance to spawn new blockade during unstable periods
    if (Math.random() < 0.02) {
        // Pick a contested or low-stability island
        const candidates = Object.entries(gs.world.islandInfluence || {})
            .filter(([iid, inf]) => inf.stability < 50 || isIslandContested(gs, iid))
            .filter(([iid]) => !isIslandBlockaded(gs, iid));

        if (candidates.length > 0) {
            const [targetId] = candidates[Math.floor(Math.random() * candidates.length)];
            const island = CONFIG.islands[targetId];

            // Opposing faction blockades
            const blockader = island.faction === 'english' ? 'pirates' :
                             island.faction === 'pirates' ? 'english' :
                             (Math.random() < 0.5 ? 'english' : 'pirates');

            startBlockade(gs, targetId, blockader);
        }
    }
}

// ==================== LIVING SEA - WAR ZONES ====================
function getActiveWarZones(gs) {
    return gs.world.activeWarZones || [];
}

function isIslandWarZone(gs, iid) {
    return getActiveWarZones(gs).some(w => w.islandId === iid && w.daysRemaining > 0);
}

function getWarZoneInfo(gs, iid) {
    return getActiveWarZones(gs).find(w => w.islandId === iid && w.daysRemaining > 0);
}

function startWarZone(gs, iid, factions) {
    if (!gs.world.activeWarZones) gs.world.activeWarZones = [];

    if (isIslandWarZone(gs, iid)) return null;

    const warZone = {
        id: 'warzone_' + Date.now(),
        islandId: iid,
        factions,
        daysRemaining: CONFIG.warFronts.warZoneDuration,
        startDay: gs.player.days,
        intensity: 50 + Math.floor(Math.random() * 50)
    };

    gs.world.activeWarZones.push(warZone);
    return warZone;
}

function updateWarZones(gs) {
    if (!gs.world.activeWarZones) gs.world.activeWarZones = [];

    // Decrement days and remove expired war zones
    gs.world.activeWarZones = gs.world.activeWarZones.filter(w => {
        w.daysRemaining--;
        if (w.daysRemaining <= 0) {
            // War resolution affects influence
            const winner = Math.random() < 0.5 ? w.factions[0] : w.factions[1];
            modifyInfluence(gs, w.islandId, winner, 15);
            return false;
        }
        return true;
    });

    // Random chance to spawn war zone in contested areas
    if (Math.random() < 0.01) {
        const contested = Object.keys(gs.world.islandInfluence || {})
            .filter(iid => isIslandContested(gs, iid) && !isIslandWarZone(gs, iid));

        if (contested.length > 0) {
            const targetId = contested[Math.floor(Math.random() * contested.length)];
            const inf = getIslandInfluence(gs, targetId);

            // Two highest factions fight
            const sorted = ['english', 'eitc', 'pirates'].sort((a, b) => inf[b] - inf[a]);
            startWarZone(gs, targetId, [sorted[0], sorted[1]]);
        }
    }
}

// Get risk modifier for traveling near blockaded/warzone islands
function getBlockadeRisk(gs, iid) {
    let risk = 0;
    if (isIslandBlockaded(gs, iid)) risk += 0.3;
    if (isIslandWarZone(gs, iid)) risk += 0.2;
    return risk;
}

// ==================== LIVING SEA - HIDDEN COVES & EXPLORATION ====================
function getDiscoveredCoves(gs) {
    return gs.player.discoveredCoves || [];
}

function isCoveDiscovered(gs, coveId) {
    return getDiscoveredCoves(gs).includes(coveId);
}

function discoverCove(gs, coveId) {
    if (!gs.player.discoveredCoves) gs.player.discoveredCoves = [];
    if (!isCoveDiscovered(gs, coveId)) {
        gs.player.discoveredCoves.push(coveId);
        return true;
    }
    return false;
}

function getChartFragments(gs) {
    return gs.player.chartFragments || 0;
}

function addChartFragment(gs) {
    if (!gs.player.chartFragments) gs.player.chartFragments = 0;
    gs.player.chartFragments++;

    // Auto-reveal cove when 3 fragments collected
    if (gs.player.chartFragments >= 3) {
        const result = useChartFragments(gs);
        if (result) {
            return { discovered: true, coveId: result.coveId };
        }
    }
    return { discovered: false };
}

function canRevealCove(gs) {
    // 3 chart fragments reveal a random undiscovered cove
    return getChartFragments(gs) >= 3;
}

function useChartFragments(gs) {
    if (!canRevealCove(gs)) return null;
    gs.player.chartFragments -= 3;

    // Find undiscovered coves
    const undiscovered = Object.keys(CONFIG.hiddenCoves).filter(id => !isCoveDiscovered(gs, id));
    if (undiscovered.length === 0) return null;

    // Reveal random cove
    const coveId = undiscovered[Math.floor(Math.random() * undiscovered.length)];
    discoverCove(gs, coveId);
    return { coveId, cove: CONFIG.hiddenCoves[coveId] };
}

function getCoveByPosition(gs, radius = 40) {
    const pp = gs.player.position;
    for (const [coveId, cove] of Object.entries(CONFIG.hiddenCoves)) {
        if (!isCoveDiscovered(gs, coveId)) continue;
        const dist = Math.sqrt((cove.position.x - pp.x) ** 2 + (cove.position.z - pp.z) ** 2);
        if (dist < radius) {
            return { coveId, cove, distance: dist };
        }
    }
    return null;
}

function exploreForCove(gs) {
    // Exploration has a chance to discover nearby coves
    const pp = gs.player.position;
    for (const [coveId, cove] of Object.entries(CONFIG.hiddenCoves)) {
        if (isCoveDiscovered(gs, coveId)) continue;
        const dist = Math.sqrt((cove.position.x - pp.x) ** 2 + (cove.position.z - pp.z) ** 2);
        // Within 100 units, chance scales with proximity
        if (dist < 100) {
            const chance = 0.1 * (1 - dist / 100); // 10% at close range
            if (Math.random() < chance) {
                discoverCove(gs, coveId);
                return { coveId, cove };
            }
        }
    }
    return null;
}

function getCoveHint(gs, iid) {
    // Port rumors may reveal cove hints
    const rumors = getRumorsForPort(gs, iid);
    const hintRumor = rumors.find(r => r.type === 'cove' && r.isTrue);
    if (hintRumor) {
        const undiscovered = Object.keys(CONFIG.hiddenCoves).filter(id => !isCoveDiscovered(gs, id));
        if (undiscovered.length > 0) {
            const coveId = undiscovered[Math.floor(Math.random() * undiscovered.length)];
            return CONFIG.hiddenCoves[coveId];
        }
    }
    return null;
}

// ==================== LIVING SEA - DRIFT ENTITIES ====================
function initDriftEntities(gs) {
    if (!gs.world.driftEntities) gs.world.driftEntities = [];
}

function spawnDriftEntity(gs, typeId = null) {
    if (gs.world.driftEntities.length >= CONFIG.settings.maxDriftEntities) return null;

    const types = Object.keys(CONFIG.driftEntities);
    if (!typeId) {
        // Weight spawn chances by season
        const season = getCurrentSeason(gs);
        const weights = types.map(t => {
            let w = 1;
            if (t === 'stormFront' && season.id === 'monsoon') w = 3;
            if (t === 'pirateFleet' && season.id === 'doldrums') w = 2;
            if (t === 'floatingMarket' && season.id === 'tradeWinds') w = 2;
            if (t === 'navyConvoy' && gs.world.crackdown.level > 30) w = 2;
            return w;
        });
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let r = Math.random() * totalWeight;
        for (let i = 0; i < types.length; i++) {
            r -= weights[i];
            if (r <= 0) { typeId = types[i]; break; }
        }
    }

    const config = CONFIG.driftEntities[typeId];
    const islands = Object.values(CONFIG.islands);

    // Spawn at edge of map or near island
    let pos;
    if (Math.random() < 0.3) {
        // Near random island
        const isl = islands[Math.floor(Math.random() * islands.length)];
        pos = { x: isl.position.x + (Math.random() - 0.5) * 100, z: isl.position.z + (Math.random() - 0.5) * 100 };
    } else {
        // Edge of map
        const edge = Math.floor(Math.random() * 4);
        switch (edge) {
            case 0: pos = { x: -250, z: (Math.random() - 0.5) * 400 }; break;
            case 1: pos = { x: 250, z: (Math.random() - 0.5) * 400 }; break;
            case 2: pos = { x: (Math.random() - 0.5) * 500, z: -200 }; break;
            case 3: pos = { x: (Math.random() - 0.5) * 500, z: 200 }; break;
        }
    }

    // Random heading
    const heading = Math.random() * Math.PI * 2;

    const entity = {
        id: 'drift_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        typeId,
        position: pos,
        heading,
        velocity: { x: Math.sin(heading) * config.speed, z: Math.cos(heading) * config.speed },
        daysRemaining: config.lifetime + Math.floor(Math.random() * 5),
        spawnDay: gs.player.days
    };

    gs.world.driftEntities.push(entity);
    return entity;
}

function updateDriftEntities(gs) {
    initDriftEntities(gs);

    // Move existing entities
    for (const entity of gs.world.driftEntities) {
        entity.position.x += entity.velocity.x;
        entity.position.z += entity.velocity.z;
        entity.daysRemaining--;

        // Slight course changes
        if (Math.random() < 0.2) {
            entity.heading += (Math.random() - 0.5) * 0.5;
            const config = CONFIG.driftEntities[entity.typeId];
            entity.velocity.x = Math.sin(entity.heading) * config.speed;
            entity.velocity.z = Math.cos(entity.heading) * config.speed;
        }

        // Wrap around map edges
        if (entity.position.x < -280) entity.position.x = 280;
        if (entity.position.x > 280) entity.position.x = -280;
        if (entity.position.z < -230) entity.position.z = 230;
        if (entity.position.z > 230) entity.position.z = -230;
    }

    // Remove expired entities
    gs.world.driftEntities = gs.world.driftEntities.filter(e => e.daysRemaining > 0);

    // Spawn new entities
    if (Math.random() < CONFIG.settings.driftEntitySpawnChance) {
        spawnDriftEntity(gs);
    }
}

function getNearbyDriftEntities(gs, radius = 50) {
    const pp = gs.player.position;
    const nearby = [];

    for (const entity of (gs.world.driftEntities || [])) {
        const dist = Math.sqrt((entity.position.x - pp.x) ** 2 + (entity.position.z - pp.z) ** 2);
        const config = CONFIG.driftEntities[entity.typeId];
        const effectRadius = config.dangerRadius || config.inspectRadius || config.interactRadius || 30;

        if (dist < radius + effectRadius) {
            nearby.push({ ...entity, distance: dist, config });
        }
    }

    return nearby;
}

// ==================== LIVING SEA - RUMORS ====================
function generateRumors(gs, iid) {
    const rumors = [];
    const islands = Object.keys(CONFIG.islands);
    const goods = Object.keys(CONFIG.goods);
    const factions = ['Navy', 'Company', 'Pirates'];
    const directions = ['north', 'south', 'east', 'west'];

    const numRumors = 2 + Math.floor(Math.random() * (CONFIG.settings.maxRumorsPerPort - 1));

    for (let i = 0; i < numRumors; i++) {
        const template = CONFIG.rumorTemplates[Math.floor(Math.random() * CONFIG.rumorTemplates.length)];
        const otherIslands = islands.filter(id => id !== iid);

        let text = template.template
            .replace('{island}', CONFIG.islands[otherIslands[Math.floor(Math.random() * otherIslands.length)]].name)
            .replace('{good}', CONFIG.goods[goods[Math.floor(Math.random() * goods.length)]].name)
            .replace('{faction}', factions[Math.floor(Math.random() * factions.length)])
            .replace('{direction}', directions[Math.floor(Math.random() * directions.length)]);

        // Handle cove hint rumors
        if (template.type === 'cove') {
            const undiscoveredCoves = Object.entries(CONFIG.hiddenCoves)
                .filter(([id, _]) => !isCoveDiscovered(gs, id));
            if (undiscoveredCoves.length > 0) {
                const [_, cove] = undiscoveredCoves[Math.floor(Math.random() * undiscoveredCoves.length)];
                text = cove.discoveryHint;
            } else {
                // All coves discovered, skip this rumor
                continue;
            }
        }

        // Determine if rumor is true
        const isTrue = Math.random() < template.accuracy;
        const daysOld = Math.floor(Math.random() * 3);

        rumors.push({
            id: 'rumor_' + Date.now() + '_' + i,
            text,
            type: template.type,
            isTrue,
            daysOld,
            generatedDay: gs.player.days
        });
    }

    return rumors;
}

function refreshRumors(gs, iid) {
    if (!gs.world.rumors) gs.world.rumors = {};

    const existing = gs.world.rumors[iid];
    const shouldRefresh = !existing ||
        (gs.player.days - existing.generatedDay) >= CONFIG.settings.rumorRefreshDays;

    if (shouldRefresh) {
        gs.world.rumors[iid] = {
            generatedDay: gs.player.days,
            rumors: generateRumors(gs, iid)
        };
    }

    return gs.world.rumors[iid];
}

function getRumorsForPort(gs, iid) {
    refreshRumors(gs, iid);
    return gs.world.rumors[iid]?.rumors || [];
}

// ==================== SHIP STAT HELPERS ====================
// Returns effective ship speed factoring in upgrades
function getShipSpeed(gs) {
// Get ship class base speed
const shipClass = CONFIG.shipClasses[gs.player.shipClass] || CONFIG.shipClasses.brigantine;
let s = CONFIG.settings.baseShipSpeed * shipClass.baseSpeed;

// Faction bonus
if (gs.player.faction === 'pirates') s *= 1.2;

// Apply upgrade penalties
if (gs.player.upgrades?.reinforcedHold) s *= (1 - CONFIG.upgrades.reinforcedHold.effects.speedPenalty);
if (gs.player.upgrades?.vault) s *= (1 - CONFIG.upgrades.vault.effects.speedPenalty);

// Officer navigator speed bonus
if (hasOfficer(gs, 'navigator')) s *= (1 + CONFIG.officers.navigator.effects.speedBonus);

// Low rigging penalty
const rigging = gs.player.ship?.rigging ?? 100;
if (rigging < CONFIG.shipCondition.criticalThreshold) {
    s *= (1 - CONFIG.shipCondition.lowRiggingSpeedPenalty);
}

return s;
}

// Returns effective cargo capacity factoring in upgrades, faction, and ship class
function getCargoCapacity(gs) {
// Get ship class cargo capacity
const shipClass = CONFIG.shipClasses[gs.player.shipClass] || CONFIG.shipClasses.brigantine;
let c = shipClass.cargoCapacity;

// Faction bonus
if (gs.player.faction === 'eitc') c *= 1.2;

// Apply upgrade effects
if (gs.player.upgrades?.reinforcedHold) c -= CONFIG.upgrades.reinforcedHold.effects.capacityPenalty;
if (gs.player.upgrades?.smugglerCompartments) c -= CONFIG.upgrades.smugglerCompartments.effects.capacityPenalty;
if (gs.player.upgrades?.vault) c -= CONFIG.upgrades.vault.effects.capacityPenalty;

return Math.floor(Math.max(20, c)); // minimum 20
}

// Returns supplies consumed per day
function getSupplyRate(gs) {
let rate = CONFIG.settings.baseSupplyRate;
if (gs.player.upgrades?.swiftSails) rate += CONFIG.upgrades.swiftSails.effects.supplyCostExtra;
if (gs.player.upgrades?.smugglerCompartments) rate += CONFIG.upgrades.smugglerCompartments.effects.supplyCostExtra;

// Officer surgeon supply cost
if (hasOfficer(gs, 'surgeon')) rate += CONFIG.officers.surgeon.effects.supplyCostExtra;

// Apply season supply cost multiplier
const seasonMods = getSeasonModifiers(gs);
rate *= (seasonMods.supplyCostMult || 1);
return rate;
}

// ==================== LIVING SEA: SHIP CONDITION SYSTEM ====================
function getShipHull(gs) {
    return gs.player.ship?.hull ?? 100;
}

function getShipRigging(gs) {
    return gs.player.ship?.rigging ?? 100;
}

function getShipMorale(gs) {
    return gs.player.ship?.morale ?? 100;
}

function getMaxHull(gs) {
    const shipClass = CONFIG.shipClasses[gs.player.shipClass] || CONFIG.shipClasses.brigantine;
    return shipClass.hullMax;
}

function getMaxRigging(gs) {
    const shipClass = CONFIG.shipClasses[gs.player.shipClass] || CONFIG.shipClasses.brigantine;
    return shipClass.riggingMax;
}

function getMaxMorale(gs) {
    let max = 100;
    if (hasOfficer(gs, 'surgeon')) max += CONFIG.officers.surgeon.effects.maxMoraleBonus;
    return max;
}

function damageHull(gs, amount) {
    if (!gs.player.ship) gs.player.ship = { hull: 100, rigging: 100, morale: 100 };
    gs.player.ship.hull = Math.max(0, gs.player.ship.hull - amount);
    if (CONFIG.debug.logWear) console.log(`[Wear] Hull -${amount} = ${gs.player.ship.hull}`);
}

function damageRigging(gs, amount) {
    if (!gs.player.ship) gs.player.ship = { hull: 100, rigging: 100, morale: 100 };
    // Bosun reduces rigging wear
    if (hasOfficer(gs, 'bosun')) amount *= CONFIG.officers.bosun.effects.riggingWearMult;
    gs.player.ship.rigging = Math.max(0, gs.player.ship.rigging - amount);
    if (CONFIG.debug.logWear) console.log(`[Wear] Rigging -${amount} = ${gs.player.ship.rigging}`);
}

function damageMorale(gs, amount) {
    if (!gs.player.ship) gs.player.ship = { hull: 100, rigging: 100, morale: 100 };
    // Bosun's strict discipline affects morale
    if (hasOfficer(gs, 'bosun')) amount += CONFIG.officers.bosun.effects.moralePenalty * 0.1;
    gs.player.ship.morale = Math.max(0, gs.player.ship.morale - amount);
    if (CONFIG.debug.logWear) console.log(`[Wear] Morale -${amount} = ${gs.player.ship.morale}`);
}

function repairHull(gs, amount, atSea = false) {
    if (!gs.player.ship) return;
    // Sea repairs less effective with low hull
    if (atSea && gs.player.ship.hull < CONFIG.shipCondition.criticalThreshold) {
        amount *= (1 - CONFIG.shipCondition.lowHullRepairPenalty);
    }
    gs.player.ship.hull = Math.min(getMaxHull(gs), gs.player.ship.hull + amount);
}

function repairRigging(gs, amount) {
    if (!gs.player.ship) return;
    gs.player.ship.rigging = Math.min(getMaxRigging(gs), gs.player.ship.rigging + amount);
}

function restoreMorale(gs, amount) {
    if (!gs.player.ship) return;
    // Surgeon improves morale recovery
    if (hasOfficer(gs, 'surgeon')) amount *= CONFIG.officers.surgeon.effects.moraleRecovery;
    gs.player.ship.morale = Math.min(getMaxMorale(gs), gs.player.ship.morale + amount);
}

function applyDailyWear(gs, isStorm = false, windStrength = 0) {
    const sc = CONFIG.shipCondition;
    const seasonMods = getSeasonModifiers(gs);

    // Hull wear
    let hullWear = sc.hullWearBase;
    if (isStorm) hullWear += sc.hullWearStorm;
    // Cargo overload
    const cargoUsed = getCargoUsed(gs);
    const capacity = getCargoCapacity(gs);
    if (cargoUsed > capacity * 0.9) hullWear += sc.hullWearOverload;
    damageHull(gs, hullWear);

    // Rigging wear
    let riggingWear = sc.riggingWearBase;
    if (isStorm) riggingWear += sc.riggingWearStorm;
    if (windStrength >= 3) riggingWear += sc.riggingWearHighWind;
    damageRigging(gs, riggingWear);

    // Morale wear
    let moraleWear = sc.moraleWearBase;
    // Doldrums season
    if (seasonMods.speedMult && seasonMods.speedMult < 1) moraleWear += sc.moraleDoldrumsExtra;
    // Low supplies
    if (gs.player.supplies < 10) moraleWear += sc.moraleLowSuppliesExtra;
    damageMorale(gs, moraleWear);
}

function getRepairCost(gs, type, amount = 0) {
    const sc = CONFIG.shipCondition;
    const shipClass = CONFIG.shipClasses[gs.player.shipClass] || CONFIG.shipClasses.brigantine;
    let cost = 0;

    if (type === 'hull') cost = amount * sc.dockRepairCostHull;
    else if (type === 'rigging') cost = amount * sc.dockRepairCostRigging;
    else if (type === 'rest' || type === 'morale') {
        // Scale morale cost with amount, minimum 5g
        cost = Math.max(5, Math.ceil(amount * 0.5)) + 5;
    }

    // Ship class cost multiplier
    cost *= shipClass.repairCostMult || 1;

    // Bosun discount
    if (hasOfficer(gs, 'bosun')) cost *= (1 - (CONFIG.officers.bosun?.effects?.repairDiscount || 0));

    // Minimum cost of 1g for any repair
    return Math.max(1, Math.ceil(cost));
}

function isShipCritical(gs) {
    const sc = CONFIG.shipCondition;
    return getShipHull(gs) < sc.criticalThreshold ||
           getShipRigging(gs) < sc.criticalThreshold ||
           getShipMorale(gs) < sc.criticalThreshold;
}

function checkMutinyRisk(gs) {
    if (getShipMorale(gs) < CONFIG.shipCondition.criticalThreshold) {
        if (Math.random() < CONFIG.shipCondition.lowMoraleMutinyChance) {
            return true;
        }
    }
    return false;
}

// ==================== LIVING SEA: OFFICERS SYSTEM ====================
function hasOfficer(gs, role) {
    return gs.player.officers?.some(o => o.role === role) || false;
}

function getOfficer(gs, role) {
    return gs.player.officers?.find(o => o.role === role) || null;
}

function hireOfficer(gs, officerId) {
    const officerConfig = CONFIG.officers[officerId];
    if (!officerConfig) return { success: false, reason: 'Unknown officer type' };
    if (gs.player.officers.length >= 3) return { success: false, reason: 'Crew full (max 3 officers)' };
    if (hasOfficer(gs, officerConfig.role)) return { success: false, reason: 'Already have this role' };

    const officer = {
        id: officerId,
        role: officerConfig.role,
        name: generateOfficerName(officerConfig.role),
        hiredDay: gs.player.days,
        wage: officerConfig.baseWage
    };

    gs.player.officers.push(officer);
    return { success: true, officer };
}

function fireOfficer(gs, officerId) {
    const index = gs.player.officers.findIndex(o => o.id === officerId || o.role === officerId);
    if (index >= 0) {
        gs.player.officers.splice(index, 1);
        return true;
    }
    return false;
}

function getOfficerWages(gs) {
    return gs.player.officers?.reduce((total, o) => {
        const config = Object.values(CONFIG.officers).find(c => c.role === o.role);
        return total + (config?.baseWage || 5);
    }, 0) || 0;
}

function generateOfficerName(role) {
    const firstNames = ['James', 'William', 'Thomas', 'Edward', 'John', 'Mary', 'Anne', 'Elizabeth', 'Grace', 'Sarah'];
    const lastNames = ['Blackwood', 'Stormwind', 'Ironside', 'Wavecrest', 'Saltborne', 'Tidebringer', 'Keel', 'Compass'];
    return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
}

function getAvailableOfficersAtPort(gs, islandId) {
    // Generate 1-2 random officers available at this port
    const allOfficers = Object.keys(CONFIG.officers);
    const available = [];
    const count = 1 + Math.floor(Math.random() * 2);

    for (let i = 0; i < count && i < allOfficers.length; i++) {
        const idx = Math.floor(Math.random() * allOfficers.length);
        const officerId = allOfficers[idx];
        const cfg = CONFIG.officers[officerId];
        if (!available.some(o => o.type === officerId) && !hasOfficer(gs, cfg.role)) {
            available.push({
                type: officerId,
                name: generateOfficerName(cfg.role)
            });
        }
    }
    return available;
}

// ==================== LIVING SEA: CHASE ENCOUNTER SYSTEM ====================
function calculateEscapeChance(gs) {
    const chase = CONFIG.chase;
    const shipClass = CONFIG.shipClasses[gs.player.shipClass] || CONFIG.shipClasses.brigantine;

    let chance = chase.baseEscapeChance;

    // Ship class bonus
    chance += shipClass.escapeBonus;

    // Wind factor
    const windStr = gs.wind?.strength || 0;
    chance += windStr * chase.windSpeedFactor;

    // Cargo weight penalty
    const cargoUsed = getCargoUsed(gs);
    chance -= cargoUsed * chase.cargoWeightPenalty;

    // Rigging condition
    const rigging = getShipRigging(gs);
    if (rigging < CONFIG.shipCondition.criticalThreshold) {
        chance -= CONFIG.shipCondition.lowRiggingEscapePenalty;
    } else {
        chance += (rigging - 50) * chase.riggingFactor;
    }

    // Gunner officer makes fighting more attractive but doesn't help escape
    // Navigator helps with escape
    if (hasOfficer(gs, 'navigator')) chance += 0.1;

    // Bounty level makes escape harder
    const bountyLevel = getBountyLevel(gs);
    if (bountyLevel === 'wanted') chance -= 0.05;
    else if (bountyLevel === 'hunted') chance -= 0.1;
    else if (bountyLevel === 'infamous') chance -= 0.15;

    return Math.max(0.1, Math.min(0.9, chance));
}

function getChaseDuration(gs) {
    const chase = CONFIG.chase;
    const shipClass = CONFIG.shipClasses[gs.player.shipClass] || CONFIG.shipClasses.brigantine;

    // Base duration modified by ship speed
    let duration = chase.baseDuration;
    duration -= (shipClass.baseSpeed - 1) * 3000; // Faster ships = shorter chase

    // Cargo slows you down
    const cargoUsed = getCargoUsed(gs);
    duration += cargoUsed * 50;

    return Math.max(chase.minDuration, Math.min(chase.maxDuration, duration));
}

// ==================== LIVING SEA: COVE RUMORS ====================
function getCoveRumor(gs) {
    const undiscovered = Object.keys(CONFIG.hiddenCoves).filter(id => !isCoveDiscovered(gs, id));
    if (undiscovered.length === 0) return null;

    const coveId = undiscovered[Math.floor(Math.random() * undiscovered.length)];
    const cove = CONFIG.hiddenCoves[coveId];
    return { coveId, hint: cove.discoveryHint };
}

// ==================== LIVING SEA: BOUNTY HUNTER SYSTEM ====================
function spawnBountyHunter(gs) {
    const bountyLevel = getBountyLevel(gs);
    const hunters = CONFIG.bountyHunters.hunters;

    // Get undefeated hunters
    const available = hunters.filter((h, i) => !gs.player.huntersDefeated.includes(i));
    if (available.length === 0) return null;

    // Pick based on bounty level
    let hunterIndex = 0;
    if (bountyLevel === 'infamous') {
        hunterIndex = Math.min(available.length - 1, gs.player.stats.huntersDefeated || 0);
    }

    return { ...available[Math.min(hunterIndex, available.length - 1)], index: hunters.indexOf(available[hunterIndex]) };
}

function defeatHunter(gs, hunterIndex) {
    if (!gs.player.huntersDefeated.includes(hunterIndex)) {
        gs.player.huntersDefeated.push(hunterIndex);
        gs.player.stats.huntersDefeated = (gs.player.stats.huntersDefeated || 0) + 1;
    }
}

function getPardonCost(gs, islandId) {
    const island = CONFIG.islands[islandId];
    if (!island) return null;

    const faction = island.faction;
    if (faction === 'pirates') return null; // Pirates don't offer pardons

    const costs = CONFIG.bountyHunters.pardonCosts[faction] || CONFIG.bountyHunters.pardonCosts.neutral;
    const bounty = getBounty(gs);

    return Math.ceil(costs.base + bounty * costs.perBounty);
}

function grantPardon(gs) {
    gs.player.bounty = 0;
    gs.player.huntersDefeated = [];
}

// ==================== LIVING SEA: QUESTLINE SYSTEM ====================
function startQuestline(gs, questlineId) {
    const questline = CONFIG.questlines[questlineId];
    if (!questline) return { success: false, reason: 'Unknown questline' };
    if (gs.player.activeQuestline) return { success: false, reason: 'Already on a questline' };

    gs.player.activeQuestline = questlineId;
    gs.player.questlineProgress[questlineId] = {
        currentStep: 0,
        startDay: gs.player.days,
        stepProgress: {}
    };

    return { success: true, questline };
}

function getQuestlineProgress(gs) {
    if (!gs.player.activeQuestline) return null;
    const questlineId = gs.player.activeQuestline;
    const questline = CONFIG.questlines[questlineId];
    const progress = gs.player.questlineProgress[questlineId];

    if (!questline || !progress) return null;

    const currentStep = questline.steps[progress.currentStep];
    const daysRemaining = questline.deadline - (gs.player.days - progress.startDay);

    return {
        questlineId,
        questline,
        currentStep,
        stepIndex: progress.currentStep,
        totalSteps: questline.steps.length,
        daysRemaining,
        stepProgress: progress.stepProgress
    };
}

function advanceQuestline(gs) {
    const progress = getQuestlineProgress(gs);
    if (!progress) return { success: false };

    const questlineId = gs.player.activeQuestline;
    gs.player.questlineProgress[questlineId].currentStep++;
    gs.player.questlineProgress[questlineId].stepProgress = {};

    // Check if completed
    if (gs.player.questlineProgress[questlineId].currentStep >= progress.questline.steps.length) {
        return completeQuestline(gs);
    }

    return { success: true, advanced: true };
}

function completeQuestline(gs) {
    const questlineId = gs.player.activeQuestline;
    const questline = CONFIG.questlines[questlineId];
    if (!questline) return { success: false };

    const rewards = questline.rewards;

    // Apply rewards
    if (rewards.gold) gs.player.gold += rewards.gold;
    if (rewards.reputation) {
        Object.entries(rewards.reputation).forEach(([fid, amount]) => {
            applyRepChange(gs, fid, amount, 'questline_' + questlineId);
        });
    }
    if (rewards.pardon) grantPardon(gs);
    if (rewards.unlocks) discoverCove(gs, rewards.unlocks);

    // Mark questline as completed (prevents repeat, unlocks next tier)
    gs.player.questlineProgress[questlineId].completed = true;
    gs.player.activeQuestline = null;

    // Track questlines completed for leaderboard
    if (!gs.player.stats) gs.player.stats = {};
    gs.player.stats.questlinesCompleted = (gs.player.stats.questlinesCompleted || 0) + 1;

    return { success: true, completed: true, rewards };
}

function failQuestline(gs) {
    gs.player.activeQuestline = null;
    return { success: true, failed: true };
}

function checkQuestlineDeadline(gs) {
    const progress = getQuestlineProgress(gs);
    if (!progress) return false;

    if (progress.daysRemaining <= 0) {
        failQuestline(gs);
        return true;
    }
    return false;
}

// Check and advance questline step based on event
function checkQuestlineStep(gs, event, eventData = {}) {
    const progress = getQuestlineProgress(gs);
    if (!progress) return { advanced: false };

    const step = progress.currentStep;
    if (!step) return { advanced: false };

    // Only check on dock events
    if (event !== 'dock' || !eventData.islandId) {
        return { advanced: false };
    }

    const qProgress = gs.player.questlineProgress[progress.questlineId];

    switch (step.type) {
        case 'deliver_count':
            // Repeated delivery task - check if at right island with goods
            if (step.to === eventData.islandId && step.goods) {
                const hasGoods = Object.entries(step.goods).every(([gid, qty]) =>
                    (gs.player.cargo[gid] || 0) >= qty
                );
                if (hasGoods) {
                    // Anti-cheese: goods must be from a different island than destination
                    const purchaseLocs = gs.player.purchaseLocations || {};
                    const goodsFromHere = Object.keys(step.goods).some(gid =>
                        purchaseLocs[gid] === eventData.islandId
                    );
                    if (goodsFromHere) {
                        return {
                            advanced: false,
                            blocked: true,
                            message: 'Goods must be sourced from another port!'
                        };
                    }

                    // Remove delivered goods
                    Object.entries(step.goods).forEach(([gid, qty]) => {
                        gs.player.cargo[gid] = (gs.player.cargo[gid] || 0) - qty;
                        // Clear purchase location for delivered goods
                        if (gs.player.cargo[gid] <= 0 && gs.player.purchaseLocations) {
                            delete gs.player.purchaseLocations[gid];
                        }
                    });
                    // Increment delivery count
                    qProgress.stepProgress.delivered = (qProgress.stepProgress.delivered || 0) + 1;
                    const delivered = qProgress.stepProgress.delivered;
                    const needed = step.count || 1;
                    // Give per-delivery reward
                    const reward = step.reward || 0;
                    if (reward > 0) gs.player.gold += reward;

                    if (delivered >= needed) {
                        // Step complete - move to next
                        qProgress.stepProgress = {}; // Reset for next step
                        const result = advanceQuestline(gs);
                        return {
                            advanced: true,
                            completed: result.completed,
                            rewards: result.rewards,
                            stepDone: true,
                            message: `${step.desc} complete!`,
                            reward: reward
                        };
                    } else {
                        // Partial progress
                        return {
                            advanced: false,
                            progress: true,
                            delivered: delivered,
                            needed: needed,
                            message: `Delivery ${delivered}/${needed}`,
                            reward: reward
                        };
                    }
                }
            }
            break;

        case 'collect':
            // Final collection step - just visit the island
            if (step.at === eventData.islandId) {
                qProgress.stepProgress = {};
                const result = advanceQuestline(gs);
                return {
                    advanced: true,
                    completed: result.completed,
                    rewards: result.rewards,
                    stepDone: true,
                    message: 'Payment collected!'
                };
            }
            break;

        case 'deliver':
            // Single delivery (legacy support)
            const atDestination = !step.to || step.to === eventData.islandId;
            if (atDestination && step.goods) {
                const hasGoods = Object.entries(step.goods).every(([gid, qty]) =>
                    (gs.player.cargo[gid] || 0) >= qty
                );
                if (hasGoods) {
                    Object.entries(step.goods).forEach(([gid, qty]) => {
                        gs.player.cargo[gid] = (gs.player.cargo[gid] || 0) - qty;
                    });
                    const result = advanceQuestline(gs);
                    return { advanced: true, completed: result.completed, rewards: result.rewards, stepDone: true };
                }
            }
            break;

        case 'visit':
            if (!step.at || step.at === eventData.islandId) {
                const result = advanceQuestline(gs);
                return { advanced: true, completed: result.completed, rewards: result.rewards, stepDone: true };
            }
            break;
    }

    return { advanced: false };
}

// Category-aware capacity check: luxury locker gives bonus for luxury, penalty for commodity
function getCategoryCapacity(gs, category) {
let cap = getCargoCapacity(gs);
// luxuryLocker: +8 for luxury, -3 for commodity
if (gs.player.upgrades?.luxuryLocker) {
if (category === 'luxury') cap += CONFIG.upgrades.luxuryLocker.effects.luxuryCapBonus;
else if (category === 'commodity') cap -= CONFIG.upgrades.luxuryLocker.effects.commodityCapPenalty;
}
return Math.max(0, cap);
}

// Check if player can carry more of a specific good (category-aware)
function canCarryMore(gid, qty, gs) {
const good = CONFIG.goods[gid];
const currentUsed = getCargoUsed(gs);
const catCap = getCategoryCapacity(gs, good.category);
const catUsed = getCargoUsedByCategory(gs, good.category);
const newWeight = good.weight * qty;
// Check total capacity and category-specific capacity
const totalOk = currentUsed + newWeight <= getCargoCapacity(gs);
const catOk = catUsed + newWeight <= catCap;

return { canCarry: totalOk && catOk, reason: !totalOk ? 'Hold full' : !catOk ? 'Category limit' : null };

}

function getCargoUsed(gs) {
let t = 0;
Object.entries(gs.player.cargo).forEach(([g, q]) => t += (CONFIG.goods[g]?.weight || 1) * q);
return t;
}

function getCargoUsedByCategory(gs, category) {
let t = 0;
Object.entries(gs.player.cargo).forEach(([gid, q]) => {
const g = CONFIG.goods[gid];
if (g && g.category === category) t += g.weight * q;
});
return t;
}

// Wind effect on speed
function getWindEffect(gs, moveDir) {
if (!gs.wind) return { mult: 1, label: '' };
const wd = WIND_DIRS[gs.wind.direction], ws = WIND_STR[gs.wind.strength];
if (ws.m === 0) return { mult: 1, label: '' };
const dot = moveDir.x * wd.v.x + moveDir.z * wd.v.z;
const bonus = gs.player.upgrades?.swiftSails ? CONFIG.upgrades.swiftSails.effects.windBonus : 0;
if (dot > 0.5) return { mult: 1 + ws.m * (1 + bonus), label: `+${Math.round(ws.m * (1 + bonus) * 100)}%` };
if (dot < -0.5) return { mult: 1 - ws.m * 0.7, label: `-${Math.round(ws.m * 70)}%` };
return { mult: 1, label: '' };
}

// Cargo protection (fights, storms)
function calcCargoLoss(gs, base) {
if (gs.player.upgrades?.reinforcedHold) base *= (1 - CONFIG.upgrades.reinforcedHold.effects.cargoProtection);
return base;
}

// Gold loss protection
function calcGoldLoss(gs, base) {
if (gs.player.upgrades?.vault) base *= (1 - CONFIG.upgrades.vault.effects.goldProtection);
return Math.floor(base);
}

// Tribute cost reduction
function calcTributeCost(gs, base) {
if (gs.player.upgrades?.vault) base *= (1 - CONFIG.upgrades.vault.effects.tributeReduction);
const fc = CONFIG.factions[gs.player.faction];
if (fc.tributeMult) base *= fc.tributeMult;
// Title modifiers
const mods = getTitleModifiers(gs);
base *= (1 - mods.tributeReduction);
return Math.floor(base);
}

// ==================== RISK & VALUE HELPERS ====================
// Estimate cargo value using recorded prices or base prices
// IMPORTANT: Do NOT call calcPrice here - it causes circular dependency:
// estimateCargoValue → calcPrice → calcTariff → getTitleModifiers → getTitleTier → getTitleTrackValue → getNetWorth → estimateCargoValue
function estimateCargoValue(gs) {
let value = 0;
const iid = gs.currentIsland;
Object.entries(gs.player.cargo).forEach(([gid, qty]) => {
let price = CONFIG.goods[gid].basePrice;
// Use recorded prices only - never call calcPrice to avoid circular dependency
if (iid && gs.player.visitedIslands?.[iid]?.lastPrices?.[gid]) {
    // Use last recorded price for current island
    price = gs.player.visitedIslands[iid].lastPrices[gid];
} else if (gs.player.visitedIslands) {
    // Use any known recorded price from visited islands
    for (const vid of Object.keys(gs.player.visitedIslands)) {
        const lp = gs.player.visitedIslands[vid]?.lastPrices?.[gid];
        if (lp) { price = lp; break; }
    }
}
// Falls back to CONFIG.goods[gid].basePrice if no recorded prices
value += price * qty;
});
return value;
}

function getNetWorth(gs) {
    return gs.player.gold + estimateCargoValue(gs);
}

// Route risk score (0-1): influenced by cargo value, faction, destination, heat
function getRouteRisk(gs) {
let risk = 0;
// Cargo value contribution (0-0.4)
const cargoVal = estimateCargoValue(gs);
risk += Math.min(0.4, cargoVal / 2000);

// Faction contribution (0-0.15)
if (gs.player.faction === 'pirates') risk += 0.1;
else if (gs.player.faction === 'eitc') risk += 0.05;

// Destination faction waters (0-0.15)
if (gs.player.destinationIslandId) {
    const destFaction = CONFIG.islands[gs.player.destinationIslandId]?.faction;
    if (destFaction === 'pirates') risk += 0.15;
    else if (destFaction === 'english' || destFaction === 'eitc') risk += 0.05;
}

// Heat contribution (0-0.2)
risk += (gs.player.heat || 0) / 500;

// Days since dock contribution (0-0.1)
risk += Math.min(0.1, (gs.player.daysSinceDock || 0) / 20);

return Math.min(1, Math.max(0, risk));

}

function getRiskLabel(risk) {
if (risk < 0.3) return { label: 'Low', class: 'risk-low' };
if (risk < 0.6) return { label: 'Med', class: 'risk-med' };
return { label: 'High', class: 'risk-high' };
}

// Check if near English/EITC controlled waters (for inspections)
function isNearHostileWaters(gs) {
const pp = gs.player.position;
for (const [id, isl] of Object.entries(CONFIG.islands)) {
if (isl.faction === 'english' || isl.faction === 'eitc') {
const dist = Math.sqrt((isl.position.x - pp.x)**2 + (isl.position.z - pp.z)**2);
if (dist < 100) return true;
}
}
return false;
}

// Count contraband in cargo
function getContrabandCount(gs) {
let count = 0;
Object.entries(gs.player.cargo).forEach(([gid, qty]) => {
if (CONFIG.goods[gid]?.category === 'contraband') count += qty;
});
return count;
}

// ==================== HEAT SYSTEM ====================
function addHeat(gs, amount) {
gs.player.heat = Math.min(100, Math.max(0, (gs.player.heat || 0) + amount));
}

function decayHeat(gs) {
gs.player.heat = Math.max(0, (gs.player.heat || 0) - CONFIG.settings.heatDecayPerDay);
}

// Balanced heat decay - slower at sea, faster when docked at friendly ports
function decayHeatBalanced(gs, isDocked = false, isFriendlyPort = false) {
    const smug = CONFIG.balance.smuggling;
    let decay = smug.heatDecayBase;
    if (!isDocked) {
        // At sea: slower decay
        decay = smug.heatDecayAtSea;
    } else if (isFriendlyPort) {
        // Docked at friendly port: faster decay
        decay = smug.heatDecayBase * 2;
    }
    gs.player.heat = Math.max(0, (gs.player.heat || 0) - decay);
}

// ==================== ECONOMY ====================
// Base market price without player-specific bonuses (used for logbook/intel)
function calcBasePrice(gid, iid, gs) {
const g = CONFIG.goods[gid], isl = gs.islands[iid], m = isl?.markets?.[gid];
if (!g || !m) return g?.basePrice || 0;
const scarcity = Math.max(0.5, Math.min(2, 1 + (m.targetSupply - m.supply) / m.targetSupply));
const demand = Math.max(0.5, Math.min(2, 1 + (m.demand - m.targetDemand) / m.targetDemand));
let bias = m.preference === 'exports' ? 0.8 : m.preference === 'imports' ? 1.2 : 1;
const tariff = calcTariff(gs.player.faction, isl.faction, gs, iid);
let evMult = 1;
if (isl.activeEvent) { const ev = CONFIG.events.find(e => e.id === isl.activeEvent.id); if (ev?.affects.includes(g.category)) evMult = ev.multiplier; }

// Regional event multiplier
if (gs.world?.regionalEvent?.affectedIslands?.includes(iid)) {
    const catMult = gs.world.regionalEvent.categoryMult[g.category];
    if (catMult) evMult *= catMult;
}

// Port state effects
const portState = getPortStateConfig(gs, iid);
let portMult = portState.priceMult || 1;
if (portState.foodMult && g.category === 'commodity') portMult *= portState.foodMult;
if (portState.smugglerBonus && g.category === 'contraband') portMult *= portState.smugglerBonus;
if (portState.materialBonus && (gid === 'timber' || gid === 'iron')) portMult *= portState.materialBonus;

// Season effects on prices
const seasonMods = getSeasonModifiers(gs);
let seasonMult = seasonMods.priceMult || 1;

// Seasonal event effects
if (gs.world?.seasonalEvent?.effects) {
    const seFx = gs.world.seasonalEvent.effects;
    if (seFx[g.category]) seasonMult *= seFx[g.category];
    if (seFx.luxury && g.category === 'luxury') seasonMult *= seFx.luxury;
}

return Math.max(1, Math.round(g.basePrice * scarcity * demand * bias * tariff * evMult * portMult * seasonMult));
}

// Buy price: player bonuses REDUCE price (discounts help buying)
function calcBuyPrice(gid, iid, gs) {
const base = calcBasePrice(gid, iid, gs);
const g = CONFIG.goods[gid];
let discount = 1;

// EITC gets 5% discount when BUYING
if (gs.player.faction === 'eitc') discount *= 0.95;

// Pirates get 50% discount on contraband when BUYING (underworld connections)
if (gs.player.faction === 'pirates' && g?.category === 'contraband') discount *= 0.5;

// Smuggler compartments: 10% discount on contraband when buying
if (gs.player.upgrades?.smugglerCompartments && g?.category === 'contraband') {
    discount *= (1 - CONFIG.upgrades.smugglerCompartments.effects.contrabandProfitBonus);
}

// Merchant favor: 2% discount per point, max 10%
const favor = gs.player.merchantFavor || 0;
if (favor > 0) {
    discount *= (1 - Math.min(0.10, favor * 0.02));
}

return Math.max(1, Math.round(base * discount));
}

// Sell price: player bonuses INCREASE price (bonuses help selling)
function calcSellPrice(gid, iid, gs) {
const base = calcBasePrice(gid, iid, gs);
const g = CONFIG.goods[gid];
let bonus = 1;

// EITC gets 5% bonus when SELLING (better negotiation)
if (gs.player.faction === 'eitc') bonus *= 1.05;

// Pirates get 50% bonus on contraband when SELLING (know the black market)
if (gs.player.faction === 'pirates' && g?.category === 'contraband') bonus *= 1.5;

// Smuggler compartments: 10% bonus on contraband when selling
if (gs.player.upgrades?.smugglerCompartments && g?.category === 'contraband') {
    bonus *= (1 + CONFIG.upgrades.smugglerCompartments.effects.contrabandProfitBonus);
}

// === META PRESSURE: Good bias reduces prices (markets flooded with your favorite goods) ===
const metaMods = metaGetModifiers(gs, { good: gid });
bonus *= metaMods.priceMultSell;

return Math.max(1, Math.round(base * bonus));
}

// Legacy function for backward compatibility (uses base price)
function calcPrice(gid, iid, gs) {
return calcBasePrice(gid, iid, gs);
}

function calcTariff(pf, if_, gs, iid = null) {
if (if_ === 'neutral' || pf === if_) return 1;
const rep = gs.player.reputation[if_] || 0;
let t = 1 + (CONFIG.factions[if_]?.taxRate || 0);
if (rep < -50) t += 0.3; else if (rep < -20) t += 0.15; else if (rep > 50) t -= 0.1;
// Title modifier
const mods = getTitleModifiers(gs);
t *= (1 - mods.tariffReduction);
// Port state tariff multiplier (blockaded = higher tariffs, lawless = no tariffs)
if (iid) {
    const portState = getPortStateConfig(gs, iid);
    t *= (portState.tariffMult ?? 1);
}
return Math.max(0.9, Math.min(2, t));
}

function buyGood(gid, qty, iid, gs) {
const m = gs.islands[iid].markets[gid], g = CONFIG.goods[gid];
// === BALANCE: Apply anti-spam price increase ===
const antiSpamMult = getAntiSpamBuyMult(gs, iid, qty);
const price = Math.max(1, Math.round(calcBuyPrice(gid, iid, gs) * antiSpamMult));

const check = canCarryMore(gid, qty, gs);
if (qty > m.supply || price * qty > gs.player.gold || !check.canCarry) return { success: false, reason: check.reason };
gs.player.gold -= price * qty;
gs.player.cargo[gid] = (gs.player.cargo[gid] || 0) + qty;
gs.player.purchaseHistory[gid] = price;
// Track where goods were purchased (for questline anti-cheese)
if (!gs.player.purchaseLocations) gs.player.purchaseLocations = {};
gs.player.purchaseLocations[gid] = iid;
m.supply -= qty;
recordPrice(gid, iid, calcBasePrice(gid, iid, gs), gs); // Record base price for logbook
// === BALANCE: Track trade fatigue ===
addTradeFatigue(gs, iid);
// === LIVING SEA: Apply faction influence ===
applyTradeInfluence(gs, iid, gs.player.faction);
// Heat for buying contraband
if (g.category === 'contraband') addHeat(gs, CONFIG.settings.heatGainContraband);
return { success: true, cost: price * qty };
}

function sellGood(gid, qty, iid, gs) {
const stock = gs.player.cargo[gid] || 0, g = CONFIG.goods[gid];
if (qty > stock) return { success: false, reason: 'Not enough stock' };

// Fence limit check for contraband
if (g.category === 'contraband') {
    const fenceRemaining = getFenceRemaining(gs, iid);
    if (qty > fenceRemaining) {
        return { success: false, reason: `Fence can only take ${fenceRemaining} more units today` };
    }
}

// Calculate price with saturation penalty AND anti-spam penalty
let price = calcSellPrice(gid, iid, gs);
const satPenalty = getSaturationPenalty(gs, iid, gid);
// === BALANCE: Apply anti-spam sell penalty ===
const antiSpamMult = getAntiSpamSellMult(gs, iid, qty);
price = Math.max(1, Math.round(price * satPenalty * antiSpamMult));

const revenue = price * qty;
gs.player.gold += revenue;
gs.player.cargo[gid] = stock - qty;
if (gs.player.cargo[gid] <= 0) delete gs.player.cargo[gid];
gs.islands[iid].markets[gid].supply += qty;
recordPrice(gid, iid, calcBasePrice(gid, iid, gs), gs); // Record base price for logbook

// Add market saturation
addMarketSaturation(gs, iid, gid, qty);

// === BALANCE: Track trade fatigue ===
addTradeFatigue(gs, iid);

// === META PRESSURE: Record profitable trade ===
const purchasePrice = gs.player.purchaseHistory[gid] || 0;
const profit = (price - purchasePrice) * qty;
if (profit > 0) {
    metaRecordTrade(gs, gid, profit);
    // Track total profit for leaderboard
    if (!gs.player.stats) gs.player.stats = {};
    gs.player.stats.totalProfit = (gs.player.stats.totalProfit || 0) + profit;
}

// === LIVING SEA: Apply faction influence ===
applyTradeInfluence(gs, iid, gs.player.faction);

// Heat and tracking for contraband
if (g.category === 'contraband') {
    // Enhanced heat gain with scaling
    const smug = CONFIG.balance.smuggling;
    const heatGain = smug.heatGainBase + (qty * smug.heatGainPerUnit);
    addHeat(gs, heatGain);

    // Track fence usage
    addFenceUsage(gs, iid, qty);

    // Track for smuggler title
    if (!gs.player.stats) gs.player.stats = {};
    gs.player.stats.contrabandTraded = (gs.player.stats.contrabandTraded || 0) + qty;

    // === LIVING SEA: Smuggling destabilizes region ===
    applySmuggleInfluence(gs, iid);
}
return { success: true, revenue };
}

function recordPrice(gid, iid, price, gs) {
if (!gs.player.visitedIslands[iid]) gs.player.visitedIslands[iid] = { lastPrices: {}, lastVisitDay: 0 };
gs.player.visitedIslands[iid].lastPrices[gid] = price;
gs.player.visitedIslands[iid].lastVisitDay = gs.player.days;
}

function recordAllPrices(iid, gs) { Object.keys(CONFIG.goods).forEach(gid => recordPrice(gid, iid, calcPrice(gid, iid, gs), gs)); }

function getPriceTrend(gid, iid, cp, gs) {
const v = gs.player.visitedIslands[iid];
if (!v?.lastPrices[gid]) return 'none';
const last = v.lastPrices[gid];
return cp > last * 1.05 ? 'up' : cp < last * 0.95 ? 'down' : 'stable';
}

function getConfidence(iid, gs) {
const v = gs.player.visitedIslands[iid];
if (!v) return { level: 'none', label: 'None', days: 999 };
const age = gs.player.days - v.lastVisitDay;
const bonus = gs.player.faction === 'eitc' ? 2 : 0;
if (age <= 3 + bonus) return { level: 'high', label: 'High', days: age };
if (age <= 7 + bonus) return { level: 'med', label: 'Med', days: age };
return { level: 'low', label: 'Low', days: age };
}

function simMarketDay(gs) {
Object.keys(gs.islands).forEach(id => {
const isl = gs.islands[id];
Object.keys(isl.markets).forEach(gid => {
const m = isl.markets[gid];
m.supply = Math.max(0, Math.min(m.targetSupply * 2, Math.round(m.supply + (m.targetSupply - m.supply) * 0.05 + (Math.random() - 0.5) * 4)));
m.demand = Math.max(0, Math.min(m.targetDemand * 2, Math.round(m.demand + (m.targetDemand - m.demand) * 0.03 + (Math.random() - 0.5) * 2)));
});
if (isl.activeEvent) { isl.activeEvent.daysRemaining--; if (isl.activeEvent.daysRemaining <= 0) isl.activeEvent = null; }
if (!isl.activeEvent && Math.random() < 0.08) {
const ev = CONFIG.events[Math.floor(Math.random() * CONFIG.events.length)];
isl.activeEvent = { id: ev.id, daysRemaining: ev.duration };
}
});
}

// Calculate deals and mark top 3 as high-margin candidates
function calcDeals(gs, iid) {
const deals = [], curPrices = {};
Object.keys(CONFIG.goods).forEach(gid => { curPrices[gid] = calcPrice(gid, iid, gs); });
Object.keys(gs.player.visitedIslands).forEach(did => {
if (did === iid) return;
const dData = gs.player.visitedIslands[did], conf = getConfidence(did, gs);
if (conf.level === 'none') return;
Object.keys(CONFIG.goods).forEach(gid => {
const g = CONFIG.goods[gid], bp = curPrices[gid], sp = dData.lastPrices[gid];
if (!sp) return;
const profit = sp - bp;
if (profit > 5) deals.push({ gid, good: g, buyIsland: iid, sellIsland: did, buyPrice: bp, sellPrice: sp, profit, profitPerWeight: profit / g.weight, confidence: conf });
});
});
return deals.sort((a, b) => b.profitPerWeight - a.profitPerWeight).slice(0, 5);
}

// Smarter high-margin detection: top 3 deals or profit/weight > threshold
function getHighMarginGoods(gs) {
if (!gs.currentIsland) return new Set();
const deals = calcDeals(gs, gs.currentIsland);
const highMargin = new Set();
// Top 3 by profit/weight
deals.slice(0, 3).forEach(d => highMargin.add(d.gid));
// Also anything above threshold
deals.forEach(d => {
if (d.profitPerWeight >= CONFIG.settings.highMarginThreshold) highMargin.add(d.gid);
});
return highMargin;
}

function getSafeSpawn(iid = 'portRoyal') {
const isl = CONFIG.islands[iid];
return { x: isl.position.x, z: isl.position.z + CONFIG.settings.islandCollisionRadius + 15 };
}

function createState(faction) {
const fc = CONFIG.factions[faction], islands = {};
Object.entries(CONFIG.islands).forEach(([id, cfg]) => {
const markets = {};
Object.entries(cfg.markets).forEach(([gid, mc]) => {
markets[gid] = { supply: mc.targetSupply + Math.floor((Math.random() - 0.5) * 20), demand: mc.targetDemand + Math.floor((Math.random() - 0.5) * 10), targetSupply: mc.targetSupply, targetDemand: mc.targetDemand, preference: mc.preference };
});
islands[id] = { id, name: cfg.name, faction: cfg.faction, markets, activeEvent: null };
});
return {
saveVersion: CONFIG.saveVersion,
player: {
faction, gold: CONFIG.settings.startingGold, days: 1, supplies: CONFIG.settings.startingSupplies,
cargo: {}, position: getSafeSpawn(), reputation: { ...fc.startingRep },
visitedIslands: {}, purchaseHistory: {}, upgrades: {}, destinationIslandId: null,
heat: 0, daysSinceDock: 0,
// New fields
titles: {},
stats: { contrabandTraded: 0, contractsCompleted: 0, questlinesCompleted: 0, totalProfit: 0, repChanges: {}, chasesEscaped: 0, huntersDefeated: 0 },
contracts: { active: [], completed: [], failed: [] },
trackedContractId: null,
tokens: 0,
inspectionTriggeredThisContract: false,
// Living Sea Update fields
shipClass: 'brigantine',
ship: {
    hull: 100,
    rigging: 100,
    morale: 100
},
officers: [],
discoveredCoves: [],
chartFragments: 0,
covesTreasured: [],
destinationCoveId: null,
activeQuestline: null,
questlineProgress: {},
huntersDefeated: [],
// Meta Pressure tracking
meta: {
    recentRoutes: [],      // Last N route keys "PortA>PortB"
    recentGoods: [],       // Last N main profit goods traded
    recentPorts: [],       // Last N port IDs visited
    recentFactions: [],    // Last N faction territories interacted with
    routeCounts: {},       // Frequency map for routes in window
    goodCounts: {},        // Frequency map for goods in window
    portCounts: {},        // Frequency map for ports in window
    factionCounts: {},     // Frequency map for factions in window
    pressure: {            // Current pressure scores (0-1)
        route: 0,
        good: 0,
        port: 0,
        faction: 0,
        total: 0
    },
    lastPort: null,        // Track last port for route recording
    lastMilestones: { route: 0, good: 0, port: 0, faction: 0 }, // Track feedback milestones
    lastUpdateDay: 0       // Day of last pressure update
}
},
islands,
wind: { direction: Math.floor(Math.random() * 8), strength: Math.floor(Math.random() * 4), daysUntilChange: CONFIG.settings.windChangeDays },
world: {
    seasonDay: 1,
    crackdown: { level: 0 },
    regionalEvent: null,
    boards: {},
    // Living Sea fields
    driftEntities: [],
    portStates: {},
    rumors: {},
    seasonalEvent: null,
    // War front / influence tracking per island
    islandInfluence: {},
    activeBlockades: [],
    activeWarZones: []
},
currentIsland: null, isDocked: false
};
}

// Migrate old saves - add defaults for new fields
function migrateState(gs) {
if (!gs.player.purchaseHistory) gs.player.purchaseHistory = {};
if (!gs.player.upgrades) gs.player.upgrades = {};
if (gs.player.destinationIslandId === undefined) gs.player.destinationIslandId = null;
if (gs.player.heat === undefined) gs.player.heat = 0;
if (gs.player.daysSinceDock === undefined) gs.player.daysSinceDock = 0;
if (!gs.wind) gs.wind = { direction: Math.floor(Math.random() * 8), strength: Math.floor(Math.random() * 4), daysUntilChange: 5 };
if (gs.isDocked && !gs.currentIsland) gs.isDocked = false;

// New migrations for contracts/titles/world
if (!gs.player.titles) gs.player.titles = {};
if (!gs.player.stats) gs.player.stats = { contrabandTraded: 0, contractsCompleted: 0, repChanges: {} };
if (!gs.player.stats.contrabandTraded) gs.player.stats.contrabandTraded = 0;
if (!gs.player.stats.contractsCompleted) gs.player.stats.contractsCompleted = 0;
if (!gs.player.stats.questlinesCompleted) gs.player.stats.questlinesCompleted = 0;
if (!gs.player.stats.totalProfit) gs.player.stats.totalProfit = 0;
if (!gs.player.stats.repChanges) gs.player.stats.repChanges = {};
if (!gs.player.contracts) gs.player.contracts = { active: [], completed: [], failed: [] };
if (!gs.player.contracts.active) gs.player.contracts.active = [];
if (!gs.player.contracts.completed) gs.player.contracts.completed = [];
if (!gs.player.contracts.failed) gs.player.contracts.failed = [];
if (gs.player.trackedContractId === undefined) gs.player.trackedContractId = null;
if (gs.player.tokens === undefined) gs.player.tokens = 0;
if (gs.player.inspectionTriggeredThisContract === undefined) gs.player.inspectionTriggeredThisContract = false;

// World state
if (!gs.world) gs.world = {};
if (gs.world.seasonDay === undefined) gs.world.seasonDay = 1;
if (!gs.world.crackdown) gs.world.crackdown = { level: 0 };
if (gs.world.regionalEvent === undefined) gs.world.regionalEvent = null;
if (!gs.world.boards) gs.world.boards = {};

// === BALANCE: New state migrations ===
// Bounty/notoriety system
if (gs.player.bounty === undefined) gs.player.bounty = 0;
// Market saturation tracking { islandId: { goodId: saturationLevel } }
if (!gs.player.saturation) gs.player.saturation = {};
// Fence usage tracking { islandId: { units: number, lastVisitDay: number } }
if (!gs.player.fenceUsage) gs.player.fenceUsage = {};
// Track total upkeep paid
if (!gs.player.stats.totalUpkeep) gs.player.stats.totalUpkeep = 0;
// Port visit days for cooldown system { islandId: lastVisitDay }
if (!gs.player.portVisitDays) gs.player.portVisitDays = {};
// Trade fatigue per port (resets on undock) { islandId: transactionCount }
if (!gs.player.tradeFatigue) gs.player.tradeFatigue = {};

// Living Sea migrations
if (!gs.world.driftEntities) gs.world.driftEntities = [];
if (!gs.world.portStates) gs.world.portStates = {};
if (!gs.world.rumors) gs.world.rumors = {};
if (gs.world.seasonalEvent === undefined) gs.world.seasonalEvent = null;

// === LIVING SEA UPDATE v2 MIGRATIONS ===
// Save version tracking
if (gs.saveVersion === undefined) gs.saveVersion = 1;

// Ship class system
if (!gs.player.shipClass) gs.player.shipClass = 'brigantine';

// Ship condition system
if (!gs.player.ship) {
    const shipClass = CONFIG.shipClasses[gs.player.shipClass] || CONFIG.shipClasses.brigantine;
    gs.player.ship = {
        hull: shipClass.hullMax,
        rigging: shipClass.riggingMax,
        morale: 100
    };
}

// Officers system
if (!gs.player.officers) gs.player.officers = [];

// Exploration system
if (!gs.player.discoveredCoves) gs.player.discoveredCoves = [];
if (gs.player.chartFragments === undefined) gs.player.chartFragments = 0;
if (!gs.player.covesTreasured) gs.player.covesTreasured = [];
if (gs.player.destinationCoveId === undefined) gs.player.destinationCoveId = null;

// Questline system
if (gs.player.activeQuestline === undefined) gs.player.activeQuestline = null;
if (!gs.player.questlineProgress) gs.player.questlineProgress = {};

// Bounty hunter tracking
if (!gs.player.huntersDefeated) gs.player.huntersDefeated = [];
if (!gs.player.stats.chasesEscaped) gs.player.stats.chasesEscaped = 0;
if (!gs.player.stats.huntersDefeated) gs.player.stats.huntersDefeated = 0;

// Meta Pressure system migration
if (!gs.player.meta) {
    gs.player.meta = {
        recentRoutes: [],
        recentGoods: [],
        recentPorts: [],
        recentFactions: [],
        routeCounts: {},
        goodCounts: {},
        portCounts: {},
        factionCounts: {},
        pressure: { route: 0, good: 0, port: 0, faction: 0, total: 0 },
        lastPort: null,
        lastMilestones: { route: 0, good: 0, port: 0, faction: 0 },
        lastUpdateDay: 0
    };
}
// Ensure all meta pressure sub-fields exist (for partial migrations)
if (!gs.player.meta.pressure) gs.player.meta.pressure = { route: 0, good: 0, port: 0, faction: 0, total: 0 };
if (!gs.player.meta.lastMilestones) gs.player.meta.lastMilestones = { route: 0, good: 0, port: 0, faction: 0 };
if (!gs.player.meta.recentRoutes) gs.player.meta.recentRoutes = [];
if (!gs.player.meta.recentGoods) gs.player.meta.recentGoods = [];
if (!gs.player.meta.recentPorts) gs.player.meta.recentPorts = [];
if (!gs.player.meta.recentFactions) gs.player.meta.recentFactions = [];
if (!gs.player.meta.routeCounts) gs.player.meta.routeCounts = {};
if (!gs.player.meta.goodCounts) gs.player.meta.goodCounts = {};
if (!gs.player.meta.portCounts) gs.player.meta.portCounts = {};
if (!gs.player.meta.factionCounts) gs.player.meta.factionCounts = {};

// World war fronts
if (!gs.world.islandInfluence) gs.world.islandInfluence = {};
if (!gs.world.activeBlockades) gs.world.activeBlockades = [];
if (!gs.world.activeWarZones) gs.world.activeWarZones = [];

// Update save version
gs.saveVersion = CONFIG.saveVersion;

return gs;
}

// ==================== EXPORTS ====================
// Export all public functions for use in other modules
export {
    // Power system
    getPlayerPower, getTitleTierSafe, getGamePhase, getPowerScaling,
    // Bounty system
    getBounty, addBounty, decayBounty, getBountyLevel,
    // Meta pressure system
    metaInit, clamp01, metaAddToWindow, metaCalcBias, metaGetTopItem,
    metaRecordRoute, metaRecordTrade, metaRecalcPressure, metaUpdateDaily,
    metaCheckMilestones, metaGetModifiers, metaGetSummary,
    // Demand saturation
    getMarketSaturation, addMarketSaturation, decayMarketSaturation, getSaturationPenalty,
    // Fence limit
    getFenceUsage, addFenceUsage, canFence, getFenceRemaining,
    // Upkeep
    calculateDailyUpkeep, calculateDockingFee,
    // Anti-spam
    getTradeFatigue, addTradeFatigue, resetTradeFatigue, getPortVisitPenalty,
    recordPortVisit, getBulkTradePenalty, getAntiSpamSellMult, getAntiSpamBuyMult,
    // Titles
    getTitleTier, getTitleTrackValue, getTitleName, getNextThreshold,
    getTitleModifiers, updateTitles,
    // Reputation
    applyRepChange,
    // Contracts
    generateContractId, generateContractsForIsland, generateContractTitle,
    getIslandDistance, getRouteRiskBetween, acceptContract, abandonContract,
    evaluateContractsOnDock, expireContracts, getTrackedContract, refreshContractBoard,
    // Seasons
    getCurrentSeason, getSeasonModifiers,
    // Port states
    getPortState, updatePortStates,
    // Faction influence
    updateFactionInfluence,
    // Blockades
    getActiveBlockades, isIslandBlockaded, startBlockade, updateBlockades,
    // War zones
    getActiveWarZones, isIslandWarZone, startWarZone, updateWarZones,
    // Hidden coves
    discoverCove, getDiscoveredCoves, addChartFragment, canRevealCove, getCoveHint,
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
    // Economy helpers
    buyGood, sellGood, calcBuyPrice, calcSellPrice,
    // State
    createState, migrateState,
    // Misc helpers
    tickWorldStatePerDay, simMarketDay, getNetWorth, estimateCargoValue,
    getWindEffect, getShipSpeed, getSupplyRate, applyDailyWear, checkMutinyRisk
};
