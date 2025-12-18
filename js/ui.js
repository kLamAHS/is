// ==================== UI SYSTEM ====================
// Handles all user interface updates and interactions

import { CONFIG, WIND_DIRS, WIND_STR } from './config.js';
import {
    getPlayerPower, getGamePhase, getBountyLevel, getBounty,
    getTitleTier, getTitleName, getNextThreshold, getTitleModifiers,
    getCargoCapacity, getCargoUsed,
    getShipHull, getShipRigging, getShipMorale, getRepairCost, isShipCritical,
    getOfficer, getOfficerWages, getAvailableOfficersAtPort,
    getDiscoveredCoves,
    getCurrentSeason, getSeasonModifiers, getPortState,
    isIslandBlockaded, getActiveBlockades,
    isIslandWarZone, getActiveWarZones,
    getQuestlineProgress,
    getTrackedContract, getRumorsForPort,
    getRouteRisk, getHighMarginGoods, calcBuyPrice, calcSellPrice,
    canFence, getFenceRemaining, getSaturationPenalty,
    calculateDockingFee
} from './systems.js';

class UI {
constructor(game) { this.game = game; this.el = {}; this.cache(); this.bind(); }
cache() {
['loading-screen','faction-screen','game-container','gold-value','day-value','supplies-value','faction-badge','faction-icon','faction-name','cargo-count','cargo-preview','compass-needle','compass-dest-marker','destination-info','dest-name','dest-distance','event-toast','event-title','event-desc','trade-modal','trade-island-name','trade-island-faction','trade-tariff','trade-port-state','buy-panel','sell-panel','logbook-panel','shipyard-panel','contracts-panel','tavern-panel','buy-goods-list','sell-goods-list','trade-gold','trade-cargo','close-trade','leave-port-btn','menu-modal','close-menu','save-btn','new-game-btn','rep-english','rep-eitc','rep-pirates','rep-english-val','rep-eitc-val','rep-pirates-val','ship-speed','ship-cargo-cap','ship-supply-rate','ship-upgrades','pirate-modal','pay-tribute','fight-pirates','pirate-pass','tribute-cost','warning-modal','warning-icon','warning-title','warning-text','warning-dismiss','continue-btn','btn-dock','btn-map','btn-menu','speed-fill','wind-effect','island-indicator','nearby-island-name','nearby-island-faction','nearby-island-dist','map-modal','map-container','map-info','close-map','clear-course-btn','wind-indicator','wind-arrow','wind-strength','menu-wind-dir','menu-wind-change','menu-route-risk','menu-heat','buy-best-btn','sell-best-btn','logbook-island-select','logbook-prices','spotlight-list','upgrades-list','encounter-modal','encounter-icon','encounter-title','encounter-desc','encounter-result','encounter-options','heat-indicator','heat-fill','heat-label','bounty-indicator','bounty-level','notoriety-indicator','notoriety-fill','notoriety-label','contract-tracker','tracker-title','tracker-meta','world-indicator','world-icon','world-status','available-contracts','active-contracts','active-count','contracts-badge','titles-list','menu-season','menu-crackdown','menu-regional','title-modal','title-icon','title-earned-name','title-earned-desc','title-dismiss','contract-complete-modal','contract-complete-icon','contract-complete-title','contract-complete-desc','contract-complete-rewards','contract-complete-dismiss','ship-condition','ship-class-icon','ship-class-label','hull-fill','hull-value','rigging-fill','rigging-value','morale-fill','morale-value','chase-modal','chase-desc','chase-player','chase-pirate','chase-chance','chase-timer','chase-trim','chase-jettison','chase-risky','chase-result','officer-count','current-officers','available-officers','tavern-rumors','questline-section','questline-content','chart-fragments','fragments-count','cove-modal','cove-icon','cove-name','cove-desc','cove-services','close-cove'].forEach(id => this.el[id] = document.getElementById(id));
this.el.tradeTabs = document.querySelectorAll('.trade-tab'); this.el.factionCards = document.querySelectorAll('.faction-card');
}
bind() {
this.el.factionCards.forEach(c => c.addEventListener('click', () => { this.el.factionCards.forEach(x => x.classList.remove('selected')); c.classList.add('selected'); this.el['continue-btn']?.classList.remove('hidden'); this.game.selectedFaction = c.dataset.faction; console.log('Selected faction:', c.dataset.faction); }));
this.el['continue-btn']?.addEventListener('click', () => { if (this.game.selectedFaction) this.game.startGame(this.game.selectedFaction); });
this.el.tradeTabs.forEach(tab => tab.addEventListener('click', () => { this.el.tradeTabs.forEach(t => t.classList.remove('active')); tab.classList.add('active'); ['buy','sell','contracts','tavern','logbook','shipyard'].forEach(p => this.el[p+'-panel'].classList.toggle('hidden', p !== tab.dataset.tab)); if (tab.dataset.tab === 'logbook') this.renderLogbook(); if (tab.dataset.tab === 'shipyard') this.renderShipyard(); if (tab.dataset.tab === 'contracts') this.renderContracts(); if (tab.dataset.tab === 'tavern') this.renderTavern(); }));
this.el['close-trade']?.addEventListener('click', () => this.closeTrade());
this.el['leave-port-btn']?.addEventListener('click', () => { this.closeTrade(); this.game.undock(); });
this.el['btn-dock']?.addEventListener('click', () => this.game.dock());
this.el['btn-menu']?.addEventListener('click', () => this.showMenu());
this.el['btn-map']?.addEventListener('click', () => this.showMap());
this.el['close-menu']?.addEventListener('click', () => this.el['menu-modal'].classList.add('hidden'));
this.el['close-map']?.addEventListener('click', () => this.el['map-modal'].classList.add('hidden'));
this.el['close-cove']?.addEventListener('click', () => this.closeCove());
this.el['clear-course-btn']?.addEventListener('click', () => { this.game.gameState.player.destinationIslandId = null; this.game.gameState.player.destinationCoveId = null; this.toast('Cleared', 'No course'); this.el['map-modal'].classList.add('hidden'); });
this.el['save-btn']?.addEventListener('click', () => { this.game.save(); this.toast('Saved', 'Progress saved'); });
this.el['new-game-btn']?.addEventListener('click', () => { if (confirm('New game?')) { localStorage.removeItem('merchantSeasSave'); location.reload(); } });
this.el['pay-tribute']?.addEventListener('click', () => this.game.payTribute());
this.el['fight-pirates']?.addEventListener('click', () => this.game.fight());
this.el['pirate-pass']?.addEventListener('click', () => { this.el['pirate-modal'].classList.add('hidden'); this.toast('Parley', 'Safe passage'); });
this.el['warning-dismiss']?.addEventListener('click', () => this.el['warning-modal'].classList.add('hidden'));
this.el['title-dismiss']?.addEventListener('click', () => this.el['title-modal'].classList.add('hidden'));
this.el['contract-complete-dismiss']?.addEventListener('click', () => this.el['contract-complete-modal'].classList.add('hidden'));
this.el['buy-best-btn']?.addEventListener('click', () => this.game.buyBest());
this.el['sell-best-btn']?.addEventListener('click', () => this.game.sellBest());
this.el['logbook-island-select']?.addEventListener('change', e => this.renderLogPrices(e.target.value));
this.el['contract-tracker']?.addEventListener('click', () => { if (this.game.gameState?.isDocked) { this.el.tradeTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'contracts')); ['buy','sell','contracts','logbook','shipyard'].forEach(p => this.el[p+'-panel'].classList.toggle('hidden', p !== 'contracts')); this.renderContracts(); } });
// Chase action bindings - Living Sea Update
this.el['chase-trim']?.addEventListener('click', () => this.game.chaseAction('trim'));
this.el['chase-jettison']?.addEventListener('click', () => this.game.chaseAction('jettison'));
this.el['chase-risky']?.addEventListener('click', () => this.game.chaseAction('risky'));
}
showLoading(p) { document.querySelector('.loading-progress').style.width = p + '%'; }
hideLoading() { this.el['loading-screen'].classList.add('hidden'); }
showFaction() { this.el['faction-screen'].classList.remove('hidden'); }
hideFaction() { this.el['faction-screen'].classList.add('hidden'); }
showGame() { this.el['game-container'].classList.remove('hidden'); }
updateHUD(gs) {
    this.el['gold-value'].textContent = gs.player.gold.toLocaleString();
    this.el['day-value'].textContent = gs.player.days;
    this.el['supplies-value'].textContent = gs.player.supplies;
    const f = CONFIG.factions[gs.player.faction];
    this.el['faction-icon'].textContent = f.icon;
    this.el['faction-name'].textContent = f.name;
    this.el['faction-badge'].className = gs.player.faction;
    this.el['cargo-count'].textContent = `${getCargoUsed(gs)}/${getCargoCapacity(gs)}`;

    // Cargo preview with smart high-margin glow
    const prev = this.el['cargo-preview']; prev.innerHTML = '';
    const highMargin = getHighMarginGoods(gs);
    Object.entries(gs.player.cargo).forEach(([gid, qty]) => {
        const g = CONFIG.goods[gid];
        const isContraband = g.category === 'contraband';
        const isHM = highMargin.has(gid);
        for (let i = 0; i < Math.min(qty, 8); i++) {
            const d = document.createElement('span');
            d.className = 'cargo-dot' + (isContraband ? ' contraband' : isHM ? ' high-margin' : '');
            prev.appendChild(d);
        }
    });

    // Wind
    if (gs.wind) {
        const wd = WIND_DIRS[gs.wind.direction], ws = WIND_STR[gs.wind.strength];
        this.el['wind-arrow'].style.transform = `rotate(${wd.angle}deg)`;
        this.el['wind-strength'].textContent = `${ws.name} ${wd.name}`;
    }

    // Heat indicator
    const heat = gs.player.heat || 0;
    this.el['heat-fill'].style.width = heat + '%';
    this.el['heat-label'].textContent = heat;
    this.el['heat-indicator'].className = heat < 30 ? 'low' : heat < 60 ? 'med' : 'high';

    // Bounty indicator - Living Sea Update
    const bountyLevel = getBountyLevel(gs);
    const bountyLabels = { clean: 'Clean', wanted: 'Wanted', hunted: 'Hunted!', infamous: 'INFAMOUS' };
    this.el['bounty-level'].textContent = bountyLabels[bountyLevel];
    this.el['bounty-indicator'].className = bountyLevel;

    // Notoriety indicator - Meta Pressure System
    this.updateNotorietyIndicator(gs);

    // Ship condition - Living Sea Update
    this.updateShipCondition(gs);

    // Contract tracker
    this.updateContractTracker(gs);

    // World indicator
    this.updateWorldIndicator(gs);

    // Chart fragments indicator
    this.updateChartFragments(gs);
}

updateChartFragments(gs) {
    const fragments = gs.player.chartFragments || 0;
    const el = this.el['chart-fragments'];
    if (!el) return;
    if (fragments > 0) {
        el.classList.remove('hidden');
        if (this.el['fragments-count']) this.el['fragments-count'].textContent = fragments;
        el.classList.toggle('can-reveal', fragments >= 3);
    } else {
        el.classList.add('hidden');
    }
}

updateContractTracker(gs) {
    const tracked = getTrackedContract(gs);
    if (tracked) {
        this.el['contract-tracker'].classList.remove('hidden');
        this.el['tracker-title'].textContent = tracked.title.substring(0, 15) + (tracked.title.length > 15 ? '...' : '');
        const daysLeft = tracked.deadline - (gs.player.days - tracked.dayAccepted);
        const dest = CONFIG.islands[tracked.toIsland];
        const dist = getIslandDistance(gs.player.position, dest.position);
        this.el['tracker-meta'].textContent = `${daysLeft}d left · ~${Math.ceil(dist/30)}d`;
    } else {
        this.el['contract-tracker'].classList.add('hidden');
    }
}

updateNotorietyIndicator(gs) {
    const ind = this.el['notoriety-indicator'];
    const fill = this.el['notoriety-fill'];
    const label = this.el['notoriety-label'];
    if (!ind || !fill || !label) return;

    // Get meta pressure summary
    const summary = typeof metaGetSummary === 'function' ? metaGetSummary(gs) : null;
    if (!summary || !CONFIG.metaPressure?.enabled) {
        ind.classList.remove('visible');
        return;
    }

    const total = summary.totalPressure || 0;
    // Only show indicator if there's some notoriety
    if (total < 0.1) {
        ind.classList.remove('visible');
        return;
    }

    ind.classList.add('visible');
    fill.style.width = Math.round(total * 100) + '%';

    // Determine level and label
    let level = 'low';
    let labelText = 'Watched';
    if (total >= 0.7) {
        level = 'notorious';
        labelText = 'Notorious';
    } else if (total >= 0.5) {
        level = 'high';
        labelText = 'Known';
    } else if (total >= 0.3) {
        level = 'rising';
        labelText = 'Noted';
    }

    label.textContent = labelText;
    ind.className = 'visible ' + level;

    // Build tooltip with flavor text
    const tips = [];
    if (summary.routeBias > 0.2) tips.push('Routes predictable');
    if (summary.goodBias > 0.2) tips.push('Trading patterns noticed');
    if (summary.portBias > 0.2) tips.push('Port habits known');
    if (summary.factionBias > 0.2) tips.push('Affiliations watched');
    ind.title = tips.length > 0 ? tips.join(' • ') : 'How predictable your trading patterns have become';
}

updateShipCondition(gs) {
    // Ship class display
    const shipClass = CONFIG.shipClasses?.[gs.player.shipClass] || CONFIG.shipClasses?.brigantine;
    const shipIcons = { sloop: '⛵', brigantine: '🚢', galleon: '🛳️' };
    this.el['ship-class-icon'].textContent = shipIcons[gs.player.shipClass] || '⛵';
    this.el['ship-class-label'].textContent = shipClass?.name || 'Brigantine';

    // Get condition values
    const hull = getShipHull(gs);
    const rigging = getShipRigging(gs);
    const morale = getShipMorale(gs);
    const maxHull = getMaxHull(gs);
    const maxRigging = getMaxRigging(gs);
    const maxMorale = getMaxMorale(gs);
    const critThreshold = CONFIG.shipCondition?.criticalThreshold || 30;

    // Update hull bar
    const hullPct = Math.round((hull / maxHull) * 100);
    this.el['hull-fill'].style.width = hullPct + '%';
    this.el['hull-value'].textContent = Math.round(hull);
    this.el['hull-fill'].classList.toggle('critical', hull < critThreshold);

    // Update rigging bar
    const riggingPct = Math.round((rigging / maxRigging) * 100);
    this.el['rigging-fill'].style.width = riggingPct + '%';
    this.el['rigging-value'].textContent = Math.round(rigging);
    this.el['rigging-fill'].classList.toggle('critical', rigging < critThreshold);

    // Update morale bar
    const moralePct = Math.round((morale / maxMorale) * 100);
    this.el['morale-fill'].style.width = moralePct + '%';
    this.el['morale-value'].textContent = Math.round(morale);
    this.el['morale-fill'].classList.toggle('critical', morale < critThreshold);

    // Critical state styling for whole widget
    const isCritical = isShipCritical(gs);
    this.el['ship-condition'].classList.toggle('critical', isCritical);
}

updateWorldIndicator(gs) {
    const season = getSeasonLabel(gs);
    const crackdown = getCrackdownLevel(gs);
    const seasonalEvent = gs.world?.seasonalEvent;

    this.el['world-icon'].textContent = season.icon;

    if (crackdown > 50) {
        this.el['world-status'].textContent = 'Crackdown!';
        this.el['world-indicator'].className = 'crackdown';
    } else if (seasonalEvent) {
        // Show active seasonal event
        const eventConfig = CONFIG.seasonalEvents.find(e => e.id === seasonalEvent.id);
        if (eventConfig) {
            this.el['world-icon'].textContent = eventConfig.icon || season.icon;
            this.el['world-status'].textContent = eventConfig.name;
            this.el['world-indicator'].className = eventConfig.severity === 'major' ? 'storm-season' : '';
            this.el['world-indicator'].title = eventConfig.desc;
        }
    } else if (season.class === 'storm-season') {
        this.el['world-status'].textContent = season.label;
        this.el['world-indicator'].className = season.class;
        this.el['world-indicator'].title = season.desc;
    } else {
        this.el['world-status'].textContent = season.label;
        this.el['world-indicator'].className = '';
        this.el['world-indicator'].title = season.desc;
    }
}

updateCompass(h, gs) {
    // Check for tracked contract destination first
    const tracked = getTrackedContract(gs);
    const destId = tracked?.toIsland || gs?.player?.destinationIslandId;
    const coveId = gs?.player?.destinationCoveId;

    if (destId) {
        const d = CONFIG.islands[destId], dx = d.position.x - gs.player.position.x, dz = d.position.z - gs.player.position.z, a = Math.atan2(dx, -dz);
        this.el['compass-needle'].style.transform = `translate(-50%, -100%) rotate(${a * 180 / Math.PI}deg)`;
        this.el['compass-dest-marker'].classList.remove('hidden');
        this.el['destination-info'].classList.remove('hidden');
        this.el['dest-name'].textContent = d.name;
        this.el['dest-distance'].textContent = `~${Math.ceil(Math.sqrt(dx*dx+dz*dz)/30)}d`;
    } else if (coveId) {
        // Point to hidden cove destination
        const cove = CONFIG.hiddenCoves[coveId];
        if (cove) {
            const dx = cove.position.x - gs.player.position.x, dz = cove.position.z - gs.player.position.z, a = Math.atan2(dx, -dz);
            this.el['compass-needle'].style.transform = `translate(-50%, -100%) rotate(${a * 180 / Math.PI}deg)`;
            this.el['compass-dest-marker'].classList.remove('hidden');
            this.el['destination-info'].classList.remove('hidden');
            this.el['dest-name'].textContent = cove.name;
            this.el['dest-distance'].textContent = `~${Math.ceil(Math.sqrt(dx*dx+dz*dz)/30)}d`;
        }
    } else {
        this.el['compass-needle'].style.transform = `translate(-50%, -100%) rotate(${h * 180 / Math.PI}deg)`;
        this.el['compass-dest-marker'].classList.add('hidden');
        this.el['destination-info'].classList.add('hidden');
    }
}

updateSpeed(s, we) {
    this.el['speed-fill'].style.width = s * 100 + '%';
    this.el['wind-effect'].textContent = we?.label || '';
    this.el['wind-effect'].className = we?.mult > 1 ? 'wind-boost' : we?.mult < 1 ? 'wind-penalty' : '';
}

updateNearby(isl, dist) {
    if (isl) {
        this.el['island-indicator'].classList.add('visible');
        this.el['nearby-island-name'].textContent = isl.name;
        // Handle coves vs islands
        if (isl.type === 'cove') {
            this.el['nearby-island-faction'].textContent = 'Hidden Cove';
        } else {
            this.el['nearby-island-faction'].textContent = CONFIG.factions[isl.faction]?.name || 'Neutral';
        }
        this.el['nearby-island-dist'].textContent = dist < CONFIG.settings.dockDistance ? '⚓ Dock' : Math.round(dist) + 'm';
        this.el['btn-dock'].classList.toggle('available', dist < CONFIG.settings.dockDistance);
    }
    else { this.el['island-indicator'].classList.remove('visible'); this.el['btn-dock'].classList.remove('available'); }
}

showTrade(iid, gs) {
    const isl = gs.islands[iid];
    this.el['trade-island-name'].textContent = isl.name;
    this.el['trade-island-faction'].textContent = CONFIG.factions[isl.faction]?.name || 'Neutral';
    this.el['trade-island-faction'].className = 'faction-tag ' + isl.faction;
    const t = calcTariff(gs.player.faction, isl.faction, gs), tp = Math.round((t - 1) * 100);
    this.el['trade-tariff'].textContent = tp > 0 ? '+' + tp + '%' : 'No Tariff';

    // Show port state
    const portStateConfig = getPortStateConfig(gs, iid);
    const portStateId = getPortState(gs, iid);
    if (portStateConfig && portStateId !== 'prosperous') {
        this.el['trade-port-state'].textContent = `${portStateConfig.icon} ${portStateConfig.name}`;
        this.el['trade-port-state'].className = 'port-state-tag ' + portStateId;
        this.el['trade-port-state'].title = portStateConfig.desc;
        this.el['trade-port-state'].classList.remove('hidden');
    } else {
        this.el['trade-port-state'].classList.add('hidden');
    }

    recordAllPrices(iid, gs);
    this.renderBuy(iid, gs);
    this.renderSell(iid, gs);
    this.updateFooter(gs);

    // Update contracts badge
    const board = gs.world.boards[iid];
    const availableCount = board?.contracts?.length || 0;
    if (availableCount > 0) {
        this.el['contracts-badge'].textContent = availableCount;
        this.el['contracts-badge'].classList.remove('hidden');
    } else {
        this.el['contracts-badge'].classList.add('hidden');
    }

    this.el.tradeTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'buy'));
    ['buy','sell','contracts','logbook','shipyard'].forEach(p => this.el[p+'-panel'].classList.toggle('hidden', p !== 'buy'));
    this.el['trade-modal'].classList.remove('hidden');
}

renderBuy(iid, gs) {
    const list = this.el['buy-goods-list']; list.innerHTML = '';
    Object.entries(CONFIG.goods).forEach(([gid, g]) => {
        const m = gs.islands[iid].markets[gid];
        // Show actual price including anti-spam penalty
        const antiSpamMult = getAntiSpamBuyMult(gs, iid, 1);
        const price = Math.max(1, Math.round(calcBuyPrice(gid, iid, gs) * antiSpamMult));
        const trend = getPriceTrend(gid, iid, price, gs);
        const check = canCarryMore(gid, 1, gs);
        const canBuy = m.supply > 0 && price <= gs.player.gold && check.canCarry;

        const item = document.createElement('div');
        item.className = 'good-item' + (!canBuy && check.reason ? ' blocked' : '');
        item.innerHTML = `
            <div class="good-info">
                <span class="good-icon">${g.icon}</span>
                <span class="good-name">${g.name}</span>
                <span class="good-price">${price}g<span class="price-trend ${trend}">${trend === 'up' ? '↑' : trend === 'down' ? '↓' : ''}</span></span>
            </div>
            <div class="good-details">Stock:${m.supply} Wt:${g.weight} ${check.reason && !canBuy ? `<span class="block-reason">${check.reason}</span>` : ''}</div>
            <div class="good-actions"><button class="qty-btn buy" ${!canBuy ? 'disabled' : ''}>+</button></div>
        `;
        item.querySelector('.qty-btn').addEventListener('click', () => {
            if (buyGood(gid, 1, iid, gs).success) {
                this.renderBuy(iid, gs); this.renderSell(iid, gs); this.updateFooter(gs); this.game.save();
            }
        });
        list.appendChild(item);
    });
}

renderSell(iid, gs) {
    const list = this.el['sell-goods-list']; list.innerHTML = '';
    if (!Object.keys(gs.player.cargo).length) { list.innerHTML = '<p style="text-align:center;color:var(--ink-light);padding:20px">Empty</p>'; return; }
    Object.entries(gs.player.cargo).forEach(([gid, qty]) => {
        const g = CONFIG.goods[gid];
        // Show actual price including saturation and anti-spam penalties
        const satPenalty = getSaturationPenalty(gs, iid, gid);
        const antiSpamMult = getAntiSpamSellMult(gs, iid, 1);
        const price = Math.max(1, Math.round(calcSellPrice(gid, iid, gs) * satPenalty * antiSpamMult));
        const trend = getPriceTrend(gid, iid, price, gs);
        const pp = gs.player.purchaseHistory[gid];
        const item = document.createElement('div'); item.className = 'good-item';
        item.innerHTML = `<div class="good-info"><span class="good-icon">${g.icon}</span><span class="good-name">${g.name}</span><span class="good-price">${price}g${pp ? (price > pp ? '📈' : '📉') : ''}<span class="price-trend ${trend}">${trend === 'up' ? '↑' : trend === 'down' ? '↓' : ''}</span></span></div><div class="good-details">Have:${qty}${pp ? ' @' + pp + 'g' : ''}</div><div class="good-actions"><button class="qty-btn sell">−</button></div>`;
        item.querySelector('.qty-btn').addEventListener('click', () => { if (sellGood(gid, 1, iid, gs).success) { this.renderBuy(iid, gs); this.renderSell(iid, gs); this.updateFooter(gs); this.game.save(); } });
        list.appendChild(item);
    });
}

renderContracts() {
    const gs = this.game.gameState;
    const iid = gs.currentIsland;
    if (!iid) return;

    // Render questlines section
    this.renderQuestlines();

    // Refresh board if needed
    refreshContractBoard(gs, iid);
    const board = gs.world.boards[iid];

    // Render available contracts
    const availEl = this.el['available-contracts'];
    if (board.contracts.length === 0) {
        availEl.innerHTML = '<div class="contract-empty">No contracts available. Check back later!</div>';
    } else {
        availEl.innerHTML = board.contracts.map(c => this.renderContractCard(c, gs, 'available')).join('');
        availEl.querySelectorAll('.accept-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const result = acceptContract(gs, btn.dataset.id);
                if (result.success) {
                    this.renderContracts();
                    this.updateContractTracker(gs);
                    this.updateHUD(gs);
                    this.toast('Contract Accepted', 'Check your active contracts');
                    this.game.save();
                } else {
                    this.toast('Cannot Accept', result.reason || 'Unknown error');
                }
            });
        });
    }

    // Render active contracts
    const activeEl = this.el['active-contracts'];
    this.el['active-count'].textContent = gs.player.contracts.active.length;

    if (gs.player.contracts.active.length === 0) {
        activeEl.innerHTML = '<div class="contract-empty">No active contracts</div>';
    } else {
        activeEl.innerHTML = gs.player.contracts.active.map(c => this.renderContractCard(c, gs, 'active')).join('');
        activeEl.querySelectorAll('.track-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                gs.player.trackedContractId = gs.player.trackedContractId === btn.dataset.id ? null : btn.dataset.id;
                this.renderContracts();
                this.updateContractTracker(gs);
                this.game.save();
            });
        });
        activeEl.querySelectorAll('.abandon-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (confirm('Abandon this contract? You will lose reputation.')) {
                    abandonContract(gs, btn.dataset.id);
                    this.renderContracts();
                    this.updateContractTracker(gs);
                    this.toast('Contract Abandoned', '-3 reputation');
                    this.game.save();
                }
            });
        });
    }
}

renderContractCard(contract, gs, mode) {
    const type = CONFIG.contractTypes[contract.typeId];
    const dest = CONFIG.islands[contract.toIsland];
    if (!type || !dest) return ''; // Safety check

    const isTracked = gs.player.trackedContractId === contract.id;

    let daysLeft = contract.deadline;
    let progress = '';

    if (mode === 'active') {
        daysLeft = contract.deadline - (gs.player.days - contract.dayAccepted);
        if (contract.requirement?.type === 'deliver' && contract.requirement.goodId) {
            const good = CONFIG.goods[contract.requirement.goodId];
            if (good) {
                const have = gs.player.cargo[contract.requirement.goodId] || 0;
                const need = contract.requirement.qty;
                progress = `<div class="contract-details">📦 ${good.icon} ${have}/${need}</div>`;
            }
        }
    }

    const deadlineClass = daysLeft <= 2 ? 'urgent' : '';
    const cardClass = mode === 'active' ? 'active' : '';
    const trackedClass = isTracked ? 'tracked' : '';

    let actions = '';
    if (mode === 'available') {
        const canAccept = gs.player.contracts.active.length < CONFIG.settings.maxActiveContracts;
        actions = `<button class="btn-small ${canAccept ? 'btn-primary' : 'btn-secondary'} accept-btn" data-id="${contract.id}" ${canAccept ? '' : 'disabled'}>Accept</button>`;
    } else {
        actions = `
            <button class="btn-small ${isTracked ? 'btn-primary' : 'btn-secondary'} track-btn" data-id="${contract.id}">${isTracked ? '✓ Tracked' : 'Track'}</button>
            <button class="btn-small btn-secondary abandon-btn" data-id="${contract.id}">✕</button>
        `;
    }

    let requirementText = '';
    if (contract.requirement?.type === 'deliver' && contract.requirement.goodId) {
        const good = CONFIG.goods[contract.requirement.goodId];
        if (good) {
            requirementText = `Deliver ${contract.requirement.qty}x ${good.icon} ${good.name}`;
        } else {
            requirementText = `Deliver ${contract.requirement.qty}x goods`;
        }
    } else if (contract.requirement?.type === 'reach') {
        requirementText = contract.requirement.noInspection ? 'Reach without inspection' : 'Reach destination';
    } else if (contract.requirement?.type === 'supplies') {
        requirementText = `Arrive with ${contract.requirement.minSupplies}+ supplies`;
    }

    // === BALANCE: Show contract costs ===
    let costText = '';
    if (mode === 'available') {
        const costs = [];
        if (type.depositPct) {
            const deposit = Math.floor(contract.rewards.gold * type.depositPct);
            costs.push(`${deposit}g deposit`);
        }
        if (type.supplyCost) {
            costs.push(`${type.supplyCost} supplies`);
        }
        if (costs.length > 0) {
            costText = `<div class="contract-cost">📤 Cost: ${costs.join(', ')}</div>`;
        }
    }

    return `
        <div class="contract-card ${cardClass} ${trackedClass}">
            <div class="contract-header">
                <span class="contract-title">${contract.title}</span>
                <span class="contract-type ${contract.typeId}">${type.icon} ${type.name}</span>
            </div>
            <div class="contract-details">📍 ${dest.name} · ${requirementText}</div>
            ${progress}
            <div class="contract-deadline ${deadlineClass}">⏱️ ${daysLeft} days left</div>
            <div class="contract-rewards">
                <span class="contract-reward gold">🪙 ${contract.rewards.gold}g</span>
                <span class="contract-reward rep">${contract.rewards.rep > 0 ? '+' : ''}${contract.rewards.rep} ${contract.rewards.repFaction} rep</span>
            </div>
            ${costText}
            <div class="contract-actions">${actions}</div>
        </div>
    `;
}

// === LIVING SEA: Questline UI ===
renderQuestlines() {
    const gs = this.game.gameState;
    const contentEl = this.el['questline-content'];
    if (!contentEl) return;

    const activeProgress = getQuestlineProgress(gs);

    if (activeProgress) {
        // Show active questline
        const { questline, currentStep, stepIndex, totalSteps, daysRemaining } = activeProgress;
        const qProgress = gs.player.questlineProgress[activeProgress.questlineId] || {};
        const stepsHtml = questline.steps.map((step, i) => {
            let status = 'pending';
            let icon = '○';
            let progressText = '';
            if (i < stepIndex) { status = 'completed'; icon = '✓'; }
            else if (i === stepIndex) {
                status = 'current';
                icon = '▶';
                // Show delivery progress for deliver_count steps
                if (step.type === 'deliver_count' && step.count > 1) {
                    const delivered = qProgress.stepProgress?.delivered || 0;
                    progressText = ` <span style="color:var(--gold)">(${delivered}/${step.count})</span>`;
                }
            }
            const destText = step.to ? ` → ${CONFIG.islands[step.to]?.name || step.to}` : (step.at ? ` @ ${CONFIG.islands[step.at]?.name || step.at}` : '');
            let goodsText = '';
            if (step.goods && i === stepIndex) {
                const goodsList = Object.entries(step.goods).map(([gid, qty]) => `${qty}x ${CONFIG.goods[gid]?.name || gid}`).join(', ');
                goodsText = ` <span style="font-size:0.65rem;color:var(--ink-light)">[${goodsList}]</span>`;
            }
            const rewardText = step.reward && i === stepIndex ? ` <span style="color:var(--gold);font-size:0.65rem">+${step.reward}g ea</span>` : '';
            return `<div class="questline-step ${status}"><span class="step-icon">${icon}</span><span>${step.desc}${destText}${goodsText}${progressText}${rewardText}</span></div>`;
        }).join('');

        const rewardsHtml = [];
        if (questline.rewards.gold) rewardsHtml.push(`<span>🪙 ${questline.rewards.gold}g</span>`);
        if (questline.rewards.reputation) {
            Object.entries(questline.rewards.reputation).forEach(([fid, amt]) => {
                rewardsHtml.push(`<span>${amt > 0 ? '+' : ''}${amt} ${fid}</span>`);
            });
        }
        if (questline.rewards.title) rewardsHtml.push(`<span>🏅 "${questline.rewards.title}"</span>`);
        if (questline.rewards.pardon) rewardsHtml.push(`<span>⚖️ Pardon</span>`);

        contentEl.innerHTML = `
            <div class="questline-card active">
                <div class="questline-header">
                    <span class="questline-title">${questline.icon} ${questline.name}</span>
                    <span class="questline-deadline">${daysRemaining} days left</span>
                </div>
                <p class="questline-desc">${questline.desc}</p>
                <div class="questline-steps">${stepsHtml}</div>
                <div class="questline-rewards">${rewardsHtml.join('')}</div>
                <div class="questline-actions">
                    <button class="btn-small btn-danger abandon-quest-btn">Abandon Quest</button>
                </div>
            </div>
        `;

        contentEl.querySelector('.abandon-quest-btn')?.addEventListener('click', () => {
            if (confirm('Abandon this questline? All progress will be lost.')) {
                this.game.abandonQuestline();
                this.renderQuestlines();
            }
        });
    } else {
        // Show available questlines with tier filtering (per-faction progression)
        // Calculate highest completed tier PER FACTION
        const completedTiersByFaction = {};
        Object.entries(gs.player.questlineProgress || {}).forEach(([qid, prog]) => {
            if (prog.completed) {
                const q = CONFIG.questlines[qid];
                if (q?.tier && q?.faction) {
                    const faction = q.faction;
                    completedTiersByFaction[faction] = Math.max(completedTiersByFaction[faction] || 0, q.tier);
                }
            }
        });

        const availableQuests = Object.entries(CONFIG.questlines).filter(([id, q]) => {
            // Already completed - can't repeat
            if (gs.player.questlineProgress[id]?.completed) return false;
            // Check tier requirements - must have completed previous tier OF SAME FACTION
            const requiredTier = q.requires || 0;
            if (requiredTier > 0) {
                const factionProgress = completedTiersByFaction[q.faction] || 0;
                if (requiredTier > factionProgress) return false;
            }
            return true;
        });

        if (availableQuests.length === 0) {
            contentEl.innerHTML = '<div class="questline-empty">No questlines available. Complete quests to unlock more!</div>';
        } else {
            contentEl.innerHTML = availableQuests.map(([id, q]) => {
                const rewardsHtml = [];
                if (q.rewards.gold) rewardsHtml.push(`<span>🪙 ${q.rewards.gold}g</span>`);
                if (q.rewards.reputation) {
                    Object.entries(q.rewards.reputation).forEach(([fid, amt]) => {
                        rewardsHtml.push(`<span>${amt > 0 ? '+' : ''}${amt} ${fid}</span>`);
                    });
                }
                if (q.rewards.title) rewardsHtml.push(`<span>🏅 "${q.rewards.title}"</span>`);
                if (q.rewards.pardon) rewardsHtml.push(`<span>⚖️ Pardon</span>`);

                const tierLabel = q.tier ? `<span class="questline-tier">Tier ${q.tier}</span>` : '';

                return `
                    <div class="questline-card">
                        <div class="questline-header">
                            <span class="questline-title">${q.icon} ${q.name} ${tierLabel}</span>
                            <span class="questline-deadline">${q.deadline} day limit</span>
                        </div>
                        <p class="questline-desc">${q.desc}</p>
                        <div class="questline-rewards">${rewardsHtml.join('')}</div>
                        <div class="questline-actions">
                            <button class="btn-small btn-primary start-quest-btn" data-id="${id}">Start Quest</button>
                        </div>
                    </div>
                `;
            }).join('');

            contentEl.querySelectorAll('.start-quest-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const result = this.game.startQuestline(btn.dataset.id);
                    if (result.success) {
                        this.toast('Quest Started', result.questline.name);
                        this.renderQuestlines();
                    } else {
                        this.toast('Cannot Start', result.reason);
                    }
                });
            });
        }
    }
}

renderLogbook() {
    const gs = this.game.gameState, iid = gs.currentIsland, deals = calcDeals(gs, iid);
    this.el['spotlight-list'].innerHTML = deals.length ? deals.map(d => `<div class="spotlight-card" data-dest="${d.sellIsland}"><div class="spotlight-header"><span class="spotlight-good">${d.good.icon} ${d.good.name}</span><span class="spotlight-profit">+${d.profit}g</span></div><div class="spotlight-route">Buy @${d.buyPrice}g → ${CONFIG.islands[d.sellIsland].name} @${d.sellPrice}g <span class="confidence-tag confidence-${d.confidence.level}">${d.confidence.label}</span></div></div>`).join('') : '<div class="spotlight-empty">Visit more ports!</div>';
    this.el['spotlight-list'].querySelectorAll('.spotlight-card').forEach(c => c.addEventListener('click', () => { this.game.gameState.player.destinationIslandId = c.dataset.dest; this.toast('Course Set', CONFIG.islands[c.dataset.dest].name); }));
    const sel = this.el['logbook-island-select']; sel.innerHTML = '';
    Object.entries(CONFIG.islands).forEach(([id, isl]) => { const v = gs.player.visitedIslands[id]; const o = document.createElement('option'); o.value = id; o.textContent = isl.name + (v ? ` (D${v.lastVisitDay})` : ''); if (id === iid) o.selected = true; sel.appendChild(o); });
    this.renderLogPrices(iid);
}

renderLogPrices(iid) {
    const gs = this.game.gameState, v = gs.player.visitedIslands[iid];
    if (!v?.lastPrices) { this.el['logbook-prices'].innerHTML = '<p style="text-align:center;color:var(--ink-light)">No data</p>'; return; }
    this.el['logbook-prices'].innerHTML = Object.entries(CONFIG.goods).map(([gid, g]) => {
        const lp = v.lastPrices[gid]; if (!lp) return '';
        let cmp = ''; if (iid !== gs.currentIsland) { const cp = calcPrice(gid, gs.currentIsland, gs), diff = lp - cp; if (Math.abs(diff) > 2) cmp = diff > 0 ? `<span style="color:#1e7d34">+${diff}</span>` : `<span style="color:var(--blood-red)">${diff}</span>`; }
        return `<div class="logbook-item"><div class="good-info"><span>${g.icon}</span><span>${g.name}</span></div><div>${lp}g ${cmp}</div></div>`;
    }).join('');
}

renderShipyard() {
    const gs = this.game.gameState;

    // === LIVING SEA: Ship Repairs Section ===
    const hull = getShipHull(gs), rigging = getShipRigging(gs), morale = getShipMorale(gs);
    const maxHull = getMaxHull(gs), maxRigging = getMaxRigging(gs), maxMorale = getMaxMorale(gs);
    const hullDmg = maxHull - hull, riggingDmg = maxRigging - rigging, moraleDmg = maxMorale - morale;
    const hullCost = hullDmg > 0 ? getRepairCost(gs, 'hull', hullDmg) : 0;
    const riggingCost = riggingDmg > 0 ? getRepairCost(gs, 'rigging', riggingDmg) : 0;
    const moraleCost = moraleDmg > 0 ? getRepairCost(gs, 'rest', moraleDmg) : 0;
    const canAffordHull = gs.player.gold >= hullCost && hullDmg > 0;
    const canAffordRigging = gs.player.gold >= riggingCost && riggingDmg > 0;
    const canAffordMorale = gs.player.gold >= moraleCost && moraleDmg > 0;
    const shipClass = CONFIG.shipClasses?.[gs.player.shipClass] || CONFIG.shipClasses?.brigantine;

    const repairsHtml = `
        <div class="shipyard-section">
            <h4>🛠️ Ship Repairs - ${shipClass?.name || 'Brigantine'}</h4>
            <div class="repair-grid">
                <div class="repair-card ${hullDmg <= 0 ? 'full' : ''}">
                    <div class="repair-header"><span>🪵 Hull</span><span>${Math.round(hull)}/${maxHull}</span></div>
                    <div class="repair-bar"><div class="repair-fill hull" style="width: ${(hull/maxHull)*100}%"></div></div>
                    ${hullDmg > 0 ? `<button class="btn-secondary btn-small repair-btn" data-type="hull" ${canAffordHull ? '' : 'disabled'}>Repair ${hullCost}g</button>` : '<span class="repair-full">Full</span>'}
                </div>
                <div class="repair-card ${riggingDmg <= 0 ? 'full' : ''}">
                    <div class="repair-header"><span>🪢 Rigging</span><span>${Math.round(rigging)}/${maxRigging}</span></div>
                    <div class="repair-bar"><div class="repair-fill rigging" style="width: ${(rigging/maxRigging)*100}%"></div></div>
                    ${riggingDmg > 0 ? `<button class="btn-secondary btn-small repair-btn" data-type="rigging" ${canAffordRigging ? '' : 'disabled'}>Repair ${riggingCost}g</button>` : '<span class="repair-full">Full</span>'}
                </div>
                <div class="repair-card ${moraleDmg <= 0 ? 'full' : ''}">
                    <div class="repair-header"><span>👥 Morale</span><span>${Math.round(morale)}/${maxMorale}</span></div>
                    <div class="repair-bar"><div class="repair-fill morale" style="width: ${(morale/maxMorale)*100}%"></div></div>
                    ${moraleDmg > 0 ? `<button class="btn-secondary btn-small repair-btn" data-type="morale" ${canAffordMorale ? '' : 'disabled'}>Rest & Resupply ${moraleCost}g</button>` : '<span class="repair-full">High Spirits</span>'}
                </div>
            </div>
        </div>
        <div class="shipyard-section">
            <h4>⛵ Ships for Sale</h4>
            <div class="ship-grid" id="ships-for-sale"></div>
        </div>
        <div class="shipyard-section">
            <h4>⚙️ Ship Upgrades</h4>
        </div>
    `;

    // Ship classes for sale
    const currentShip = gs.player.shipClass || 'brigantine';
    const shipsHtml = Object.entries(CONFIG.shipClasses || {}).map(([id, ship]) => {
        const isOwned = currentShip === id;
        const canAfford = gs.player.gold >= ship.cost;
        return `
            <div class="ship-card ${isOwned ? 'owned' : ''}">
                <div class="ship-header">
                    <span class="ship-name">${ship.icon || '⛵'} ${ship.name}</span>
                    <span class="ship-cost">${isOwned ? 'Current' : ship.cost + 'g'}</span>
                </div>
                <div class="ship-stats">
                    <div class="ship-stat"><span>Speed:</span><span>${ship.baseSpeed}x</span></div>
                    <div class="ship-stat"><span>Cargo:</span><span>${ship.cargoCapacity}</span></div>
                    <div class="ship-stat"><span>Hull:</span><span>${ship.hullMax}</span></div>
                    <div class="ship-stat"><span>Rigging:</span><span>${ship.riggingMax}</span></div>
                </div>
                <p class="ship-desc">${ship.desc || ''}</p>
                ${!isOwned ? `<button class="btn-primary btn-small buy-ship-btn" data-id="${id}" ${canAfford ? '' : 'disabled'}>${canAfford ? 'Purchase' : 'Need Gold'}</button>` : ''}
            </div>
        `;
    }).join('');

    // Upgrades section
    const upgradesHtml = Object.entries(CONFIG.upgrades).map(([id, u]) => {
        // === BALANCE: Use scaled upgrade cost ===
        const scaledCost = this.game.getUpgradeCost(id);
        const owned = gs.player.upgrades[id], afford = gs.player.gold >= scaledCost;
        const prosHtml = u.pros.map(p => `<span class="upgrade-stat positive">${p}</span>`).join('');
        const consHtml = u.cons.map(c => `<span class="upgrade-stat negative">${c}</span>`).join('');
        return `<div class="upgrade-card ${owned ? 'owned' : ''}">
            <div class="upgrade-header"><span class="upgrade-name">${u.icon} ${u.name}</span><span class="upgrade-cost">${owned ? '✓' : scaledCost + 'g'}</span></div>
            <div class="upgrade-desc">${u.desc}</div>
            <div class="upgrade-stats">${prosHtml}${consHtml}</div>
            ${!owned ? `<button class="btn-secondary btn-small upg-btn" data-id="${id}" ${afford ? '' : 'disabled'}>${afford ? 'Buy' : 'Need gold'}</button>` : ''}
        </div>`;
    }).join('');

    // === LIVING SEA: Pardon section ===
    const bountyLevel = getBountyLevel(gs);
    const bounty = getBounty(gs);
    const pardonCost = getPardonCost(gs, gs.currentIsland);
    const canPardon = pardonCost !== null && bounty > 0 && gs.player.gold >= pardonCost;
    const bountyColors = { clean: '#4a9', wanted: '#da4', hunted: '#e83', infamous: '#c33' };
    const bountyIcons = { clean: '✓', wanted: '⚠️', hunted: '🔴', infamous: '💀' };

    let pardonHtml = '';
    if (bounty > 0) {
        pardonHtml = `
            <div class="shipyard-section">
                <h4>⚖️ Legal Status</h4>
                <div class="pardon-card">
                    <div class="pardon-status">
                        <span class="bounty-icon">${bountyIcons[bountyLevel]}</span>
                        <span class="bounty-level" style="color: ${bountyColors[bountyLevel]}; text-transform: capitalize;">${bountyLevel}</span>
                        <span class="bounty-amount">(${bounty} bounty)</span>
                    </div>
                    ${pardonCost !== null ? `
                        <p class="pardon-desc">The authorities here can clear your record... for a price.</p>
                        <button class="btn-primary btn-small pardon-btn" ${canPardon ? '' : 'disabled'}>
                            ${canPardon ? `Buy Pardon (${pardonCost}g)` : (gs.player.gold < pardonCost ? `Need ${pardonCost}g` : 'Unavailable')}
                        </button>
                    ` : `
                        <p class="pardon-desc">This port doesn't offer pardons. Try an English, EITC, or neutral port.</p>
                    `}
                </div>
            </div>
        `;
    }

    this.el['upgrades-list'].innerHTML = repairsHtml + `<div class="ship-grid">${shipsHtml}</div>` + upgradesHtml + pardonHtml;

    // Bind repair buttons
    this.el['upgrades-list'].querySelectorAll('.repair-btn').forEach(b => b.addEventListener('click', () => {
        const type = b.dataset.type;
        if (this.game.repairShip(type)) {
            this.renderShipyard();
            this.updateFooter(gs);
            this.updateHUD(gs);
        }
    }));

    // Bind ship purchase buttons
    this.el['upgrades-list'].querySelectorAll('.buy-ship-btn').forEach(b => b.addEventListener('click', () => {
        if (this.game.buyShip(b.dataset.id)) {
            this.renderShipyard();
            this.updateFooter(gs);
            this.updateHUD(gs);
        }
    }));

    // Bind upgrade buttons
    this.el['upgrades-list'].querySelectorAll('.upg-btn').forEach(b => b.addEventListener('click', () => { if (this.game.buyUpgrade(b.dataset.id)) { this.renderShipyard(); this.updateFooter(gs); } }));

    // Bind pardon button
    const pardonBtn = this.el['upgrades-list'].querySelector('.pardon-btn');
    if (pardonBtn) {
        pardonBtn.addEventListener('click', () => {
            if (this.game.buyPardon()) {
                this.renderShipyard();
                this.updateFooter(gs);
                this.updateHUD(gs);
            }
        });
    }
}

// === LIVING SEA: Tavern / Officers Panel ===
renderTavern() {
    const gs = this.game.gameState;
    const officers = gs.player.officers || [];
    const islandId = gs.currentIsland;

    // Update officer count
    this.el['officer-count'].textContent = officers.length;

    // Render current officers
    if (officers.length === 0) {
        this.el['current-officers'].innerHTML = '<div class="officers-empty">No officers hired. Visit the tavern to recruit!</div>';
    } else {
        this.el['current-officers'].innerHTML = officers.map(off => {
            const cfg = CONFIG.officers?.[off.id] || {};
            return `
                <div class="officer-card hired">
                    <div class="officer-header">
                        <span class="officer-name">${cfg.icon || '👤'} ${off.name}</span>
                        <span class="officer-wage">${off.wage || cfg.baseWage || 5}g/day</span>
                    </div>
                    <span class="officer-type">${cfg.name || off.role}</span>
                    <div class="officer-traits">
                        ${cfg.perk ? `<span class="officer-trait positive">✓ ${cfg.perk}</span>` : ''}
                        ${cfg.drawback ? `<span class="officer-trait negative">✗ ${cfg.drawback}</span>` : ''}
                    </div>
                    <div class="officer-actions">
                        <button class="btn-danger btn-small fire-officer-btn" data-id="${off.id}">Dismiss</button>
                    </div>
                </div>
            `;
        }).join('');

        // Bind fire buttons
        this.el['current-officers'].querySelectorAll('.fire-officer-btn').forEach(b => {
            b.addEventListener('click', () => {
                if (this.game.fireOfficer(b.dataset.id)) {
                    this.renderTavern();
                    this.updateFooter(gs);
                }
            });
        });
    }

    // Render available officers at this port
    const available = getAvailableOfficersAtPort(gs, islandId);
    if (available.length === 0) {
        this.el['available-officers'].innerHTML = '<div class="officers-empty">No officers looking for work here. Try another port.</div>';
    } else {
        this.el['available-officers'].innerHTML = available.map(off => {
            const cfg = CONFIG.officers?.[off.type] || {};
            const hireCost = cfg.hireCost || 100;
            const canHire = officers.length < 3 && gs.player.gold >= hireCost;
            return `
                <div class="officer-card">
                    <div class="officer-header">
                        <span class="officer-name">${cfg.icon || '👤'} ${off.name}</span>
                        <span class="officer-wage">${cfg.baseWage || 5}g/day</span>
                    </div>
                    <span class="officer-type">${cfg.name || off.type}</span>
                    <div class="officer-traits">
                        ${cfg.perk ? `<span class="officer-trait positive">✓ ${cfg.perk}</span>` : ''}
                        ${cfg.drawback ? `<span class="officer-trait negative">✗ ${cfg.drawback}</span>` : ''}
                    </div>
                    <div class="officer-actions">
                        <button class="btn-primary btn-small hire-officer-btn" data-type="${off.type}" data-name="${off.name}" ${canHire ? '' : 'disabled'}>
                            ${canHire ? `Hire (${hireCost}g)` : officers.length >= 3 ? 'Crew Full' : 'Need Gold'}
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Bind hire buttons
        this.el['available-officers'].querySelectorAll('.hire-officer-btn').forEach(b => {
            b.addEventListener('click', () => {
                if (this.game.hireOfficer(b.dataset.type, b.dataset.name)) {
                    this.renderTavern();
                    this.updateFooter(gs);
                    this.updateHUD(gs);
                }
            });
        });
    }

    // Render port rumors
    this.renderRumors(islandId, gs);
}

renderRumors(islandId, gs) {
    const rumorsEl = this.el['tavern-rumors'];
    if (!rumorsEl) return;

    const rumors = getRumorsForPort(gs, islandId);
    if (!rumors || rumors.length === 0) {
        rumorsEl.innerHTML = '<div class="officers-empty">The tavern is quiet. No interesting news.</div>';
        return;
    }

    const rumorIcons = {
        convoy: '🚢',
        shortage: '📉',
        surplus: '📈',
        danger: '⚠️',
        opportunity: '💰',
        weather: '🌊',
        political: '👑'
    };

    rumorsEl.innerHTML = rumors.map(r => {
        const icon = rumorIcons[r.type] || '🗣️';
        const truthClass = r.truth ? 'rumor-true' : 'rumor-false';
        const freshness = gs.player.days - r.createdDay;
        const freshnessLabel = freshness <= 1 ? 'Fresh' : freshness <= 3 ? 'Recent' : 'Old';
        return `
            <div class="rumor-card ${truthClass}">
                <span class="rumor-icon">${icon}</span>
                <span class="rumor-text">"${r.text}"</span>
                <span class="rumor-age">${freshnessLabel}</span>
            </div>
        `;
    }).join('');
}

updateFooter(gs) { this.el['trade-gold'].textContent = gs.player.gold.toLocaleString(); this.el['trade-cargo'].textContent = getCargoUsed(gs) + '/' + getCargoCapacity(gs); }
closeTrade() { this.el['trade-modal'].classList.add('hidden'); }

// ==================== LIVING SEA: Cove UI ====================
showCove(coveId, gs) {
    const cove = CONFIG.hiddenCoves[coveId];
    if (!cove || !cove.services || !Array.isArray(cove.services)) return;

    this.el['cove-icon'].textContent = cove.icon || '🏴‍☠️';
    this.el['cove-name'].textContent = cove.name || 'Hidden Cove';
    this.el['cove-desc'].textContent = cove.desc || '';

    // Build service buttons
    const servicesEl = this.el['cove-services'];
    if (!servicesEl) return;
    servicesEl.innerHTML = '';

    const serviceLabels = {
        fence: { icon: '💰', label: 'Fence Contraband', desc: 'Sell at 150%, no heat' },
        salvage: { icon: '⚓', label: 'Buy Salvage (50g)', desc: 'Random goods cheap' },
        repair: { icon: '🔧', label: 'Cheap Repairs', desc: '50% off repairs' },
        rest: { icon: '🛏️', label: 'Rest Crew (25g)', desc: 'Restore morale' },
        treasure: { icon: '💎', label: 'Search Treasure', desc: 'One-time gold find' },
        charts: { icon: '🗺️', label: 'Buy Charts (75g)', desc: 'Get chart fragment' },
        rumors: { icon: '👂', label: 'Hear Rumors', desc: 'Learn cove locations' }
    };

    for (const service of cove.services) {
        const info = serviceLabels[service];
        if (!info) continue;

        const btn = document.createElement('button');
        btn.className = 'btn-secondary cove-service-btn';
        btn.innerHTML = `${info.icon} ${info.label} <small style="opacity:0.7">(${info.desc})</small>`;
        btn.addEventListener('click', () => {
            this.game.useCoveService(coveId, service);
        });
        servicesEl.appendChild(btn);
    }

    this.el['cove-modal'].classList.remove('hidden');
}

closeCove() {
    this.el['cove-modal'].classList.add('hidden');
    this.game.undockCove();
}

showMenu() {
    const gs = this.game.gameState;
    ['english','eitc','pirates'].forEach(f => { const r = gs.player.reputation[f] || 0; this.el['rep-' + f].style.width = (r + 100) / 2 + '%'; this.el['rep-' + f].className = 'rep-fill' + (r < -30 ? ' hostile' : r > 30 ? ' friendly' : ''); this.el['rep-' + f + '-val'].textContent = r; });
    this.el['ship-speed'].textContent = getShipSpeed(gs).toFixed(2) + 'x';
    this.el['ship-cargo-cap'].textContent = getCargoCapacity(gs);
    this.el['ship-supply-rate'].textContent = getSupplyRate(gs).toFixed(1);
    const upgs = Object.keys(gs.player.upgrades).filter(k => gs.player.upgrades[k]).map(k => CONFIG.upgrades[k]?.name);
    this.el['ship-upgrades'].textContent = upgs.length ? upgs.join(', ') : 'None';
    if (gs.wind) {
        this.el['menu-wind-dir'].textContent = WIND_DIRS[gs.wind.direction].name + ' ' + WIND_STR[gs.wind.strength].name;
        this.el['menu-wind-change'].textContent = gs.wind.daysUntilChange + 'd';
    }
    // Risk
    const risk = getRouteRisk(gs), rl = getRiskLabel(risk);
    this.el['menu-route-risk'].textContent = rl.label;
    this.el['menu-route-risk'].className = rl.class;
    this.el['menu-heat'].textContent = (gs.player.heat || 0) + '/100';

    // Titles
    this.renderTitles(gs);

    // World status
    const season = getSeasonLabel(gs);
    this.el['menu-season'].textContent = `${season.icon} ${season.label} (Day ${gs.world?.seasonDay || 1}/${CONFIG.settings.seasonCycleDays})`;

    const crackdown = getCrackdownLevel(gs);
    this.el['menu-crackdown'].textContent = crackdown > 0 ? `Level ${crackdown}` : 'None';
    this.el['menu-crackdown'].className = crackdown > 50 ? 'risk-high' : crackdown > 25 ? 'risk-med' : '';

    const regional = gs.world?.regionalEvent;
    this.el['menu-regional'].textContent = regional ? `${regional.name} (${regional.daysRemaining}d)` : 'None';

    this.el['menu-modal'].classList.remove('hidden');
}

renderTitles(gs) {
    const titlesEl = this.el['titles-list'];
    titlesEl.innerHTML = Object.entries(CONFIG.titles).map(([trackId, track]) => {
        const tier = getTitleTier(trackId, gs);
        const name = getTitleName(trackId, tier);
        const value = getTitleTrackValue(trackId, gs);
        const nextThreshold = getNextThreshold(trackId, gs);
        const tierClass = `tier-${Math.min(tier, 5)}`;

        return `
            <div class="title-item">
                <div>
                    <span class="title-name">${track.icon} ${track.name}</span>
                    <span class="title-tier ${tierClass}">${name}</span>
                </div>
                <span class="title-progress">${Math.floor(value)}/${nextThreshold}</span>
            </div>
        `;
    }).join('');
}

showMap() {
    const c = this.el['map-container'], gs = this.game.gameState; c.innerHTML = '';
    const minX = -220, maxX = 240, minZ = -180, maxZ = 160, toP = (v, mn, mx) => (v - mn) / (mx - mn) * 100;

    // Show course to tracked contract or manual destination
    const tracked = getTrackedContract(gs);
    const destId = tracked?.toIsland || gs.player.destinationIslandId;

    if (destId) {
        const d = CONFIG.islands[destId], px = toP(gs.player.position.x, minX, maxX), py = toP(gs.player.position.z, minZ, maxZ), dx = toP(d.position.x, minX, maxX), dy = toP(d.position.z, minZ, maxZ);
        const len = Math.sqrt((dx-px)**2 + (dy-py)**2), ang = Math.atan2(dy-py, dx-px) * 180 / Math.PI;
        const line = document.createElement('div'); line.className = 'map-course-line'; line.style.cssText = `left:${px}%;top:${py}%;width:${len}%;transform:rotate(${ang}deg)`; c.appendChild(line);
    }

    // Show faction influence zones (behind everything)
    Object.entries(CONFIG.islands).forEach(([id, isl]) => {
        const inf = getIslandInfluence(gs, id);
        const dominant = getDominantFaction(gs, id);
        const zoneSize = 60 + (inf.stability / 100) * 40; // 60-100px based on stability

        const zone = document.createElement('div');
        zone.className = 'map-influence-zone ' + dominant;
        zone.style.cssText = `left:${toP(isl.position.x, minX, maxX)}%;top:${toP(isl.position.z, minZ, maxZ)}%;width:${zoneSize}px;height:${zoneSize}px`;
        c.appendChild(zone);
    });

    // Show drift entities (storms, fleets, markets)
    if (gs.world?.driftEntities) {
        for (const entity of gs.world.driftEntities) {
            const config = CONFIG.driftEntities[entity.typeId];
            if (config) {
                const de = document.createElement('div');
                de.className = 'map-drift-entity';
                de.style.cssText = `left:${toP(entity.position.x, minX, maxX)}%;top:${toP(entity.position.z, minZ, maxZ)}%;background:${config.color}`;
                de.textContent = config.icon;
                de.title = config.name;
                c.appendChild(de);
            }
        }
    }

    // Show blockade lines from blockading fleets to blocked islands
    const blockades = getActiveBlockades(gs);
    for (const b of blockades) {
        const isl = CONFIG.islands[b.islandId];
        if (!isl) continue;
        // Draw blockade indicator line
        const ix = toP(isl.position.x, minX, maxX);
        const iy = toP(isl.position.z, minZ, maxZ);
        // Small blockade ring
        const ring = document.createElement('div');
        ring.className = 'map-blockade-line';
        ring.style.cssText = `left:${ix - 3}%;top:${iy}%;width:6%;transform:rotate(0deg)`;
        ring.title = `Blockaded by ${b.blockadingFaction} (${b.daysRemaining}d)`;
        c.appendChild(ring);
    }

    Object.entries(CONFIG.islands).forEach(([id, isl]) => {
        const isBlockaded = isIslandBlockaded(gs, id);
        const isWarzone = isIslandWarZone(gs, id);
        const inf = getIslandInfluence(gs, id);
        const dominant = getDominantFaction(gs, id);

        // Use dominant faction color if contested
        const factionClass = dominant === 'contested' ? 'neutral' : (dominant || isl.faction);
        let classes = 'map-island ' + factionClass + (id === destId ? ' selected' : '');
        if (isBlockaded) classes += ' blockaded';
        if (isWarzone) classes += ' warzone';

        const dot = document.createElement('div');
        dot.className = classes;
        dot.style.cssText = `left:${toP(isl.position.x, minX, maxX)}%;top:${toP(isl.position.z, minZ, maxZ)}%`;
        dot.textContent = isl.name[0];

        // Enhanced tooltip with influence info
        let tooltip = isl.name;
        if (isBlockaded) {
            const bInfo = getBlockadeInfo(gs, id);
            tooltip += ` [BLOCKADED by ${bInfo.blockadingFaction}]`;
        }
        if (isWarzone) {
            const wInfo = getWarZoneInfo(gs, id);
            tooltip += ` [WAR: ${wInfo.factions.join(' vs ')}]`;
        }
        if (dominant === 'contested') {
            tooltip += ` (Contested: E${Math.round(inf.english)}% C${Math.round(inf.eitc)}% P${Math.round(inf.pirates)}%)`;
        }
        dot.title = tooltip;

        dot.addEventListener('click', () => { gs.player.destinationIslandId = id; this.showMap(); this.toast('Course', isl.name); });
        c.appendChild(dot);
    });

    // Show discovered hidden coves
    const discoveredCoves = getDiscoveredCoves(gs);
    for (const coveId of discoveredCoves) {
        const cove = CONFIG.hiddenCoves[coveId];
        if (!cove) continue;
        const coveDot = document.createElement('div');
        coveDot.className = 'map-cove' + (gs.player.destinationCoveId === coveId ? ' selected' : '');
        coveDot.style.cssText = `left:${toP(cove.position.x, minX, maxX)}%;top:${toP(cove.position.z, minZ, maxZ)}%`;
        coveDot.textContent = cove.icon;
        coveDot.title = cove.name + ' - ' + cove.desc;
        coveDot.addEventListener('click', () => {
            gs.player.destinationCoveId = coveId;
            gs.player.destinationIslandId = null;
            this.showMap();
            this.toast('Course', cove.name);
        });
        c.appendChild(coveDot);
    }

    const p = document.createElement('div'); p.className = 'map-player'; p.style.cssText = `left:${toP(gs.player.position.x, minX, maxX)}%;top:${toP(gs.player.position.z, minZ, maxZ)}%`; c.appendChild(p);

    // Enhanced map info with blockade/warzone warnings
    let mapInfo = 'Click island';
    if (destId) {
        mapInfo = 'Course: ' + CONFIG.islands[destId].name;
        if (isIslandBlockaded(gs, destId)) mapInfo += ' ⚠️ BLOCKADED';
        if (isIslandWarZone(gs, destId)) mapInfo += ' ⚠️ WAR ZONE';
    } else if (gs.player.destinationCoveId) {
        const destCove = CONFIG.hiddenCoves[gs.player.destinationCoveId];
        if (destCove) mapInfo = 'Course: ' + destCove.name + ' (Hidden)';
    }
    this.el['map-info'].textContent = mapInfo;
    this.el['map-modal'].classList.remove('hidden');
}

showPirate(cost, parley) { this.el['tribute-cost'].textContent = cost + 'g'; this.el['pirate-pass'].classList.toggle('hidden', !parley); this.el['pirate-modal'].classList.remove('hidden'); }
closePirate() { this.el['pirate-modal'].classList.add('hidden'); }

// === LIVING SEA: Chase UI Methods ===
showChase(escapeChance, duration) {
    this.el['chase-chance'].textContent = Math.round(escapeChance * 100) + '%';
    this.el['chase-timer'].textContent = Math.ceil(duration / 1000) + 's';
    this.el['chase-player'].style.left = '20%';
    this.el['chase-result'].classList.add('hidden');
    this.el['chase-result'].className = 'chase-result hidden';
    // Enable all action buttons
    this.el['chase-trim'].disabled = false;
    this.el['chase-jettison'].disabled = false;
    this.el['chase-risky'].disabled = false;
    this.el['chase-modal'].classList.remove('hidden');
}

updateChase(escapeChance, timeLeft, playerProgress) {
    this.el['chase-chance'].textContent = Math.round(escapeChance * 100) + '%';
    this.el['chase-timer'].textContent = Math.ceil(timeLeft / 1000) + 's';
    // Player position: 20% (start) to 5% (escaped) based on progress
    const pos = 20 - (playerProgress * 15);
    this.el['chase-player'].style.left = pos + '%';
}

showChaseResult(escaped, message) {
    this.el['chase-result'].textContent = message;
    this.el['chase-result'].className = 'chase-result ' + (escaped ? 'escaped' : 'caught');
    this.el['chase-result'].classList.remove('hidden');
    // Disable action buttons
    this.el['chase-trim'].disabled = true;
    this.el['chase-jettison'].disabled = true;
    this.el['chase-risky'].disabled = true;
}

closeChase() { this.el['chase-modal'].classList.add('hidden'); }

showTitleEarned(icon, name, desc) {
    this.el['title-icon'].textContent = icon;
    this.el['title-earned-name'].textContent = name;
    this.el['title-earned-desc'].textContent = desc;
    this.el['title-modal'].classList.remove('hidden');
}

showContractComplete(contracts) {
    if (!contracts || contracts.length === 0) return;

    const totalGold = contracts.reduce((sum, c) => sum + c.rewards.gold, 0);
    const repChanges = {};
    for (const c of contracts) {
        const faction = c.rewards.repFaction;
        repChanges[faction] = (repChanges[faction] || 0) + c.rewards.rep;
    }

    const contractNames = contracts.map(c => c.title).join(', ');
    const repText = Object.entries(repChanges)
        .map(([f, r]) => `${r > 0 ? '+' : ''}${r} ${f}`)
        .join(', ');

    this.el['contract-complete-icon'].textContent = contracts.length > 1 ? '📜📜' : '📜';
    this.el['contract-complete-title'].textContent = contracts.length > 1 ? `${contracts.length} Contracts Complete!` : 'Contract Complete!';
    this.el['contract-complete-desc'].textContent = contractNames;
    this.el['contract-complete-rewards'].innerHTML = `
        <div style="margin-top:10px;text-align:center">
            <div style="font-size:1.2rem;color:var(--gold-dark);font-weight:bold">🪙 +${totalGold}g</div>
            <div style="font-size:0.9rem;color:var(--ink-light);margin-top:4px">${repText} reputation</div>
        </div>
    `;
    this.el['contract-complete-modal'].classList.remove('hidden');
}

// === LIVING SEA: Quest Complete Modal ===
showQuestComplete(rewards) {
    if (!rewards) return;

    const rewardLines = [];
    if (rewards.gold) rewardLines.push(`<div style="font-size:1.2rem;color:var(--gold-dark);font-weight:bold">🪙 +${rewards.gold}g</div>`);
    if (rewards.reputation) {
        const repText = Object.entries(rewards.reputation)
            .map(([f, r]) => `${r > 0 ? '+' : ''}${r} ${f}`)
            .join(', ');
        rewardLines.push(`<div style="font-size:0.9rem;color:var(--ink-light);margin-top:4px">${repText} reputation</div>`);
    }
    if (rewards.title) rewardLines.push(`<div style="font-size:0.9rem;margin-top:4px">🏅 Title earned: "${rewards.title}"</div>`);
    if (rewards.pardon) rewardLines.push(`<div style="font-size:0.9rem;color:#1e7d34;margin-top:4px">⚖️ Royal Pardon granted!</div>`);

    this.el['contract-complete-icon'].textContent = '📜';
    this.el['contract-complete-title'].textContent = 'Questline Complete!';
    this.el['contract-complete-desc'].textContent = 'You have completed an epic questline!';
    this.el['contract-complete-rewards'].innerHTML = `
        <div style="margin-top:10px;text-align:center">
            ${rewardLines.join('')}
        </div>
    `;
    this.el['contract-complete-modal'].classList.remove('hidden');
}

showEncounter(enc, opts, result) {
    this.el['encounter-icon'].textContent = enc.icon; this.el['encounter-title'].textContent = enc.name; this.el['encounter-desc'].textContent = enc.desc;
    if (result) {
        this.el['encounter-result'].innerHTML = `<div class="encounter-${result.positive ? 'reward' : 'penalty'}">${result.text}</div>`;
        this.el['encounter-options'].innerHTML = '<button class="btn-primary" id="enc-close">OK</button>';
        document.getElementById('enc-close').addEventListener('click', () => this.el['encounter-modal'].classList.add('hidden'));
    }
    else {
        this.el['encounter-result'].innerHTML = '';
        this.el['encounter-options'].innerHTML = opts.map((o, i) => `<button class="btn-${o.style || 'secondary'}" data-i="${i}">${o.label}</button>`).join('');
        this.el['encounter-options'].querySelectorAll('button').forEach(b => b.addEventListener('click', () => opts[b.dataset.i].action()));
    }
    this.el['encounter-modal'].classList.remove('hidden');
}
closeEncounter() { this.el['encounter-modal'].classList.add('hidden'); }
showWarning(icon, title, text) { this.el['warning-icon'].textContent = icon; this.el['warning-title'].textContent = title; this.el['warning-text'].textContent = text; this.el['warning-modal'].classList.remove('hidden'); }
toast(title, desc) { this.el['event-title'].textContent = title; this.el['event-desc'].textContent = desc; this.el['event-toast'].classList.remove('hidden'); setTimeout(() => this.el['event-toast'].classList.add('hidden'), 3000); }

// ==================== LEADERBOARD UI ====================
initLeaderboard(leaderboard) {
    this.leaderboard = leaderboard;

    // Cache leaderboard elements
    this.el['leaderboard-modal'] = document.getElementById('leaderboard-modal');
    this.el['leaderboard-tabs'] = document.getElementById('leaderboard-tabs');
    this.el['leaderboard-list'] = document.getElementById('leaderboard-list');
    this.el['leaderboard-status'] = document.getElementById('leaderboard-status');
    this.el['leaderboard-btn'] = document.getElementById('leaderboard-btn');
    this.el['leaderboard-close'] = document.getElementById('leaderboard-close');
    this.el['leaderboard-name'] = document.getElementById('leaderboard-name');
    this.el['leaderboard-name-btn'] = document.getElementById('leaderboard-name-btn');
    this.el['leaderboard-submit'] = document.getElementById('leaderboard-submit');

    // Bind events
    this.el['leaderboard-btn']?.addEventListener('click', () => this.showLeaderboard());
    this.el['leaderboard-close']?.addEventListener('click', () => this.closeLeaderboard());
    this.el['leaderboard-name-btn']?.addEventListener('click', () => this.setLeaderboardName());
    this.el['leaderboard-submit']?.addEventListener('click', () => this.submitToLeaderboard());

    // Set saved name
    if (leaderboard.getPlayerName()) {
        this.el['leaderboard-name'].value = leaderboard.getPlayerName();
    }
}

async showLeaderboard() {
    if (!this.leaderboard) return;

    this.el['leaderboard-modal'].classList.remove('hidden');

    // Render tabs
    const categories = this.leaderboard.getCategories();
    this.el['leaderboard-tabs'].innerHTML = Object.entries(categories).map(([id, cat], i) =>
        `<button class="leaderboard-tab${i === 0 ? ' active' : ''}" data-category="${id}">${cat.icon} ${cat.name}</button>`
    ).join('');

    // Bind tab clicks
    this.el['leaderboard-tabs'].querySelectorAll('.leaderboard-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            this.el['leaderboard-tabs'].querySelectorAll('.leaderboard-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            this.loadLeaderboardCategory(tab.dataset.category);
        });
    });

    // Load first category
    const firstCategory = Object.keys(categories)[0];
    await this.loadLeaderboardCategory(firstCategory);
}

async loadLeaderboardCategory(categoryId) {
    if (!this.leaderboard) return;

    this.el['leaderboard-list'].innerHTML = '<div class="leaderboard-loading">Loading...</div>';

    const result = await this.leaderboard.getTopScores(categoryId, 10);
    const category = this.leaderboard.getCategories()[categoryId];

    if (!result.success || result.scores.length === 0) {
        this.el['leaderboard-list'].innerHTML = `
            <div class="leaderboard-empty">
                <p>No scores yet!</p>
                <p style="font-size:0.8rem;opacity:0.7">Be the first to submit your score.</p>
            </div>
        `;
        return;
    }

    const playerName = this.leaderboard.getPlayerName();
    this.el['leaderboard-list'].innerHTML = result.scores.map((score, i) => {
        const isPlayer = score.name === playerName;
        const rankIcons = ['🥇', '🥈', '🥉'];
        const rankIcon = rankIcons[i] || `#${i + 1}`;
        const factionIcon = CONFIG.factions[score.faction]?.icon || '⚓';

        return `
            <div class="leaderboard-entry${isPlayer ? ' player' : ''}">
                <span class="leaderboard-rank">${rankIcon}</span>
                <span class="leaderboard-name">${factionIcon} ${score.name}</span>
                <span class="leaderboard-score">${category.format(score.score)}</span>
            </div>
        `;
    }).join('');
}

setLeaderboardName() {
    if (!this.leaderboard) return;

    const name = this.el['leaderboard-name'].value.trim();
    if (!name) {
        this.setLeaderboardStatus('Please enter a name', 'error');
        return;
    }

    const sanitized = this.leaderboard.setPlayerName(name);
    this.el['leaderboard-name'].value = sanitized;
    this.setLeaderboardStatus(`Name set to "${sanitized}"`, 'success');
}

async submitToLeaderboard() {
    if (!this.leaderboard || !this.game.gameState) return;

    if (!this.leaderboard.getPlayerName()) {
        this.setLeaderboardStatus('Please set your name first', 'error');
        return;
    }

    if (!this.leaderboard.isAvailable()) {
        this.setLeaderboardStatus('Leaderboard not configured', 'error');
        return;
    }

    this.setLeaderboardStatus('Submitting scores...', '');

    const results = await this.leaderboard.submitAllScores(this.game.gameState);

    const successCount = Object.values(results).filter(r => r.success).length;
    const totalCount = Object.keys(results).length;

    if (successCount === totalCount) {
        this.setLeaderboardStatus('All scores submitted!', 'success');
    } else if (successCount > 0) {
        this.setLeaderboardStatus(`${successCount}/${totalCount} scores submitted`, 'success');
    } else {
        this.setLeaderboardStatus('Failed to submit scores', 'error');
    }

    // Refresh the current view
    const activeTab = this.el['leaderboard-tabs'].querySelector('.leaderboard-tab.active');
    if (activeTab) {
        await this.loadLeaderboardCategory(activeTab.dataset.category);
    }
}

setLeaderboardStatus(message, type) {
    this.el['leaderboard-status'].textContent = message;
    this.el['leaderboard-status'].className = 'leaderboard-status ' + type;
}

closeLeaderboard() {
    this.el['leaderboard-modal'].classList.add('hidden');
}

}

export { UI };
