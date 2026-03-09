// ==========================================
// 1. LOCAL STATE & SETUP
// ==========================================
let appState = {
    shipments: [],
    currentShipmentIndex: -1,
    settings: { shipmentTimeLimitHours: 3 }
};

let currentPackingState = {
    selectedCapacity: null,
    quantity: 1,
};

let deadlineCountdownInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    loadAppState();
    
    // Inject the HTML shell
    const screenContent = document.getElementById('planAndPackScreenContent');
    if (screenContent) {
        initPlanAndPackScreen();
    }
});

function loadAppState() {
    const saved = localStorage.getItem('palletTrackerOfflinePro');
    if (saved) {
        try { appState = JSON.parse(saved); } 
        catch (e) { console.error("Error parsing local data", e); }
    }
}

function saveAppState() {
    localStorage.setItem('palletTrackerOfflinePro', JSON.stringify(appState));
}

function getCurrentWorkableItem() {
    if (appState.currentShipmentIndex > -1 && appState.shipments[appState.currentShipmentIndex]) {
        return appState.shipments[appState.currentShipmentIndex];
    }
    return null;
}

function getCurrentSku() {
    const item = getCurrentWorkableItem();
    if (!item || !item.skus || item.currentSkuIndex === undefined || item.currentSkuIndex === -1) return null;
    return item.skus[item.currentSkuIndex];
}

function generateId() {
    return 'ship_' + Math.random().toString(36).substr(2, 9);
}

function timeAgo(timestamp) {
    if (!timestamp) return 'never';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + "m ago";
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + "h ago";
    return new Date(timestamp).toLocaleDateString();
}

function formatMinutesToHours(totalMinutes) {
    if (isNaN(totalMinutes) || totalMinutes < 1) return '0m';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);
    let result = '';
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0 || hours === 0) result += `${minutes}m`;
    return result.trim();
}

function showToastNotification(message, type = 'info') {
    let container = document.getElementById('toast-notification-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ==========================================
// 2. YOUR EXACT MATH & PERFORMANCE LOGIC
// ==========================================
function getShipmentMetrics(shipment) {
    const metrics = {
        totalPalletsPacked: 0, totalUnitsPacked: 0, totalTargetUnits: 0,
        activeDurationMs: 0, palletsPerHour: '0.0', currentPalletsPerHour: '0.0',
        projectedFinishTime: null, timeVsHardDeadlineMs: 0,
        health: 'default'
    };

    if (!shipment) return metrics;

    metrics.totalTargetUnits = (shipment.skus || []).reduce((sum, sku) => sum + (sku.target || 0), 0);
    const allEntries = (shipment.skus || []).flatMap(s => s.entries || []);
    
    metrics.totalPalletsPacked = allEntries.reduce((sum, entry) => sum + entry.palletCount, 0);
    metrics.totalUnitsPacked = allEntries.reduce((sum, entry) => sum + entry.units, 0); // Uses explicit units

    if (!shipment.startTime) return metrics;

    // Calculate Active Time
    metrics.activeDurationMs = Date.now() - shipment.startTime;
    const activeDurationHours = metrics.activeDurationMs / 3600000;
    
    if (activeDurationHours > 0) {
        const overallPPH = (metrics.totalPalletsPacked / activeDurationHours);
        metrics.palletsPerHour = overallPPH.toFixed(1);
        metrics.currentPalletsPerHour = metrics.palletsPerHour; // Simplified for offline

        // ETA MATH
        const unitsPerPallet = metrics.totalPalletsPacked > 0 ? metrics.totalUnitsPacked / metrics.totalPalletsPacked : 1;
        const unitsPerHour = overallPPH * unitsPerPallet;
        const unitsRemaining = metrics.totalTargetUnits - metrics.totalUnitsPacked;

        if (unitsPerHour > 0 && unitsRemaining > 0) {
            const timeToFinishMs = (unitsRemaining / unitsPerHour) * 3600000;
            metrics.projectedFinishTime = Date.now() + timeToFinishMs;
        }
    }

    const hardTimeLimitMs = appState.settings.shipmentTimeLimitHours * 3600000;
    const hardDeadline = shipment.startTime + hardTimeLimitMs;

    if (metrics.projectedFinishTime) {
        metrics.timeVsHardDeadlineMs = hardDeadline - metrics.projectedFinishTime;
    }

    // Health Colors
    if (metrics.totalUnitsPacked >= metrics.totalTargetUnits && metrics.totalTargetUnits > 0) metrics.health = 'green';
    else if (!metrics.projectedFinishTime && metrics.totalUnitsPacked === 0) metrics.health = 'default';
    else if (metrics.projectedFinishTime > hardDeadline) metrics.health = 'red';
    else if (metrics.projectedFinishTime > hardDeadline - (hardTimeLimitMs * 0.1)) metrics.health = 'yellow';
    else metrics.health = 'green';

    return metrics;
}

function startDeadlineCountdown(shipment) {
    if (deadlineCountdownInterval) clearInterval(deadlineCountdownInterval);
    const deadlineEl = document.getElementById('displayDeadline');

    if (!deadlineEl || !shipment.startTime) {
        if (deadlineEl) deadlineEl.textContent = 'N/A';
        return;
    }

    const timeLimitMs = appState.settings.shipmentTimeLimitHours * 3600000;
    const deadlineTime = shipment.startTime + timeLimitMs;

    const updateCountdown = () => {
        const remainingMs = deadlineTime - Date.now();
        if (remainingMs <= 0) {
            deadlineEl.textContent = 'Overdue';
            deadlineEl.className = 'value is-urgent';
        } else {
            const hours = Math.floor(remainingMs / 3600000);
            const minutes = Math.floor((remainingMs % 3600000) / 60000);
            const seconds = Math.floor((remainingMs % 60000) / 1000);
            deadlineEl.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            
            if (remainingMs < timeLimitMs * 0.1) deadlineEl.className = 'value is-urgent';
            else if (remainingMs < timeLimitMs * 0.3) deadlineEl.className = 'value is-warning';
            else deadlineEl.className = 'value is-safe';
        }
    };
    updateCountdown();
    deadlineCountdownInterval = setInterval(updateCountdown, 1000);
}

function updateShipmentPerformanceMetrics() {
    const shipment = getCurrentWorkableItem();
    const performancePanel = document.getElementById('shipmentPerformancePanel');
    const panelHeader = document.getElementById('shipmentInfoPanel');
    
    if (!performancePanel || !panelHeader) return;
    if (!shipment || !shipment.startTime) {
        performancePanel.classList.add('hidden');
        panelHeader.parentElement.className = 'collapsible-panel';
        panelHeader.querySelector('.health-meter-header .value').textContent = 'N/A';
        return;
    }

    performancePanel.classList.remove('hidden');
    const metrics = getShipmentMetrics(shipment);
    
    // Update Header
    panelHeader.parentElement.className = `collapsible-panel health-${metrics.health}`;
    const healthMeterValue = panelHeader.querySelector('.health-meter-header .value');
    if (healthMeterValue) {
        if (metrics.health === 'green' && metrics.totalUnitsPacked >= metrics.totalTargetUnits && metrics.totalTargetUnits > 0) healthMeterValue.textContent = 'COMPLETE';
        else healthMeterValue.textContent = metrics.projectedFinishTime ? new Date(metrics.projectedFinishTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'N/A';
    }

    // Update Grid
    document.getElementById('perfTimeElapsed').textContent = formatMinutesToHours(metrics.activeDurationMs / 60000);
    document.getElementById('perfPalletsPerHour').textContent = parseFloat(metrics.currentPalletsPerHour).toFixed(1);
    
    const unitsPerHour = metrics.totalPalletsPacked > 0 ? (parseFloat(metrics.currentPalletsPerHour) * (metrics.totalUnitsPacked / metrics.totalPalletsPacked)) : 0;
    document.getElementById('perfUnitsPerHour').textContent = Math.round(unitsPerHour);
    
    // PACING LOGIC
    const pacingEl = document.getElementById('perfPacing');
    if (pacingEl) {
        const pacingMs = metrics.timeVsHardDeadlineMs;
        const timeDiffMins = Math.round(pacingMs / 60000);

        if (metrics.projectedFinishTime) {
            const ahead = timeDiffMins >= 0;
            const formattedTime = formatMinutesToHours(Math.abs(timeDiffMins));
            
            pacingEl.textContent = `${formattedTime} ${ahead ? 'Ahead' : 'Behind'}`;
            pacingEl.className = `value pacing-value ${ahead ? 'positive' : 'negative'}`;
            
            // BONUS: Alert the forklift driver to call security if ahead and close to done
            const progress = (metrics.totalUnitsPacked / metrics.totalTargetUnits) * 100;
            if (progress > 85 && ahead && Math.abs(timeDiffMins) < 30) {
                 showToastNotification("🚚 Almost Done! Notify Security to prep the Yard.", "success");
            } else if (!ahead && Math.abs(timeDiffMins) > 15) {
                 showToastNotification("⚠️ Falling Behind. Consider requesting an extra person.", "error");
            }

        } else {
            pacingEl.textContent = 'N/A';
            pacingEl.className = 'value pacing-value neutral';
        }
    }
}


// ==========================================
// 3. UI RENDERING (YOUR EXACT HTML STRUCTURE)
// ==========================================
function initPlanAndPackScreen() {
    const screenContent = document.getElementById('planAndPackScreenContent');
    if(!screenContent) return;

    if (appState.currentShipmentIndex === -1) {
        // HUB VIEW
        screenContent.innerHTML = `
            <div class="hub-browser-card">
                <div class="hub-browser-header">
                    <h3>Shipment Hub</h3>
                    <button class="btn btn-primary btn-xl" onclick="handleCreateShipment()">+ New Shipment</button>
                </div>
                <ul id="hubShipmentList" class="hub-shipment-list"></ul>
            </div>
        `;
        _renderHubLists();
    } else {
        // ACTIVE SHIPMENT VIEW
        screenContent.innerHTML = `
            <div id="shipmentActiveContent">
                 <div class="screen-header">
                    <h2 id="planAndPackHeaderTitle">Plan & Pack</h2>
                    <div class="screen-header-actions">
                        <button class="btn btn-secondary btn-xl" onclick="handleBackToHub()">Back to Hub</button>
                        <button class="btn btn-danger-outline btn-xl" onclick="handleDeleteShipment()">Delete Container</button>
                    </div>
                 </div>

                 <!-- Your exact collapsible info panel -->
                 <details id="collapsibleInfoPanel" class="collapsible-panel" open>
                    <summary id="shipmentInfoPanel" class="panel-header">
                        <span>Shipment Details & Performance</span>
                        <div class="health-meter-header"><span class="label">Est. Finish:</span><span class="value">N/A</span></div>
                    </summary>
                    <div class="shipment-info-panel-content">
                        <div class="shipment-info-details">
                            <div class="detail-item"><span class="label">Container #:</span><span id="displayContainerNumber" class="value"></span></div>
                            <div class="detail-item detail-item-deadline">
                                <span class="label">Final Deadline</span>
                                <div id="displayDeadline" class="value"></div>
                            </div>
                            <div class="detail-item time-detail-item">
                                <span class="label">Start Time:</span>
                                <div class="value" style="display:flex; justify-content:space-between; align-items:center;">
                                    <span id="displayShipmentStartTime"></span>
                                    <button class="btn btn-secondary btn-small" onclick="handleSetShipmentStartTime()">Set Time</button>
                                </div>
                            </div>
                        </div>
                        <div id="shipmentPerformancePanel" class="performance-grid hidden">
                            <div class="performance-stat"><span class="label">Active Time</span><strong class="value" id="perfTimeElapsed">--:--</strong></div>
                            <div class="performance-stat"><span class="label">Current PPH</span><strong class="value" id="perfPalletsPerHour">0.0</strong></div>
                            <div class="performance-stat"><span class="label">Units / Hour</span><strong class="value" id="perfUnitsPerHour">0</strong></div>
                            <div class="performance-stat"><span class="label">Deadline Pacing</span><strong class="value pacing-value" id="perfPacing">N/A</strong></div>
                        </div>
                    </div>
                 </details>
                
                 <!-- Overall Progress -->
                 <div class="progress-bar-container">
                     <div class="progress-bar-label"><strong id="shipmentNameForProgress"></strong> Overall Progress: <span id="shipmentProgressText"></span></div>
                     <div class="progress-bar"><div id="shipmentProgressBarFill" class="progress-bar-fill"></div></div>
                 </div>

                 <!-- SKU Nav -->
                 <div class="nav-wrapper">
                     <button class="btn btn-icon nav-arrow-btn" onclick="navigateSku('left')"><svg viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg></button>
                     <div id="skuTabsContainer" class="sku-tabs"></div>
                     <button class="btn btn-icon nav-arrow-btn" onclick="navigateSku('right')"><svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></button>
                     <button class="btn btn-secondary btn-small" onclick="handleAddSku()">+ Add SKU</button>
                 </div>

                 <!-- The Packing Cockpit -->
                 <div id="skuPackingUI" class="sku-packing-ui hidden">
                     <div id="packingDisabledOverlay" class="packing-disabled-overlay hidden">
                         <h2>Start the timer to enable packing!</h2>
                         <button class="btn btn-primary btn-xl" onclick="handleSetShipmentStartTime()">Set Start Time Now</button>
                     </div>

                     <div class="status-grid">
                        <div class="status-item is-sku-code"><span class="label">SKU Code</span><strong id="codeDisplay" class="value"></strong></div>
                        <div class="status-item is-sku-target"><span class="label">Target</span><strong id="totalDisplay" class="value">0</strong></div>
                        <div class="status-item is-sku-left"><span class="label">Units Left</span><strong id="leftDisplay" class="value">0</strong></div>
                        <div class="status-item is-sku-packed"><span class="label">Total Packed</span><strong id="palletsDisplay" class="value">0</strong></div>
                        <div class="status-item"><span class="label">Est. Pallets Left</span><strong id="palletsLeftDisplay" class="value">N/A</strong></div>
                     </div>
                     
                     <div class="packing-cockpit">
                        <div class="packing-actions-panel">
                            <div class="pallet-capacities">
                                <h3 class="subsection-title">Pack Pallets</h3>
                                <div class="chips-container" id="palletCapacitiesContainer"></div>
                                
                                <div class="multi-pallet-entry-form">
                                    <button id="quickAddBtn" class="btn quick-add-btn" onclick="handleQuickAddOnePallet(this)">+1 Pallet</button>
                                    <button id="finishPalletBtn" class="btn finish-last-pallet-btn hidden" onclick="handleFinishLastPallet(this)">Finish Remaining</button>
                                    
                                    <div class="batch-add-controls" id="batchControls">
                                        <div class="quantity-control" style="display:flex;">
                                            <button class="btn btn-secondary quantity-btn" onclick="adjustQty(-1)">-</button>
                                            <input type="number" id="palletQuantity" class="input-field quantity-input" value="1" readonly>
                                            <button class="btn btn-secondary quantity-btn" onclick="adjustQty(1)">+</button>
                                        </div>
                                        <button class="btn btn-primary" style="font-size:1.2rem; flex-grow:1;" onclick="handleAddMultiplePallets(this)">Add Batch</button>
                                    </div>
                                </div>
                            </div>
                            <div id="packingSuggestion" class="suggestion-box state-optimal"><span class="label">Suggestion:</span><span class="value" id="suggestionText"></span></div>
                        </div>

                        <div class="packing-info-panel">
                            <div class="entry-log-section">
                                <div class="entry-actions">
                                    <h3 class="subsection-title">Log</h3>
                                    <div>
                                        <button class="btn btn-secondary btn-small" onclick="handleUndoSkuEntry()">Undo Last</button>
                                        <button class="btn btn-danger-outline btn-small" onclick="handleResetSkuData()">Reset SKU</button>
                                    </div>
                                </div>
                                <div class="entries-scroller"><ul id="entriesLog"></ul></div>
                            </div>
                        </div>
                     </div>
                 </div>
            </div>
        `;
        initActiveShipmentScreen();
    }
}

function _renderHubLists() {
    const list = document.getElementById('hubShipmentList');
    if (!list) return;
    
    if (appState.shipments.length === 0) {
        list.innerHTML = '<p class="text-secondary" style="padding: 20px; font-size:1.2rem;">No shipments created yet. Click "+ New Container" to start.</p>';
        return;
    }

    list.innerHTML = appState.shipments.map((s, index) => {
        const metrics = getShipmentMetrics(s);
        const progress = metrics.totalTargetUnits > 0 ? (metrics.totalUnitsPacked / metrics.totalTargetUnits) * 100 : 0;
        
        return `
        <li class="shipment-list-card is-${metrics.health}" onclick="openShipment(${index})">
            <div class="shipment-card-header">
                <h4>${s.name}</h4>
                <span class="status-badge status-active">${metrics.health}</span>
            </div>
            <div class="shipment-card-metrics" style="margin-top:12px;">
                <div><span>${metrics.totalUnitsPacked.toLocaleString()}</span><label>Units</label></div>
                <div><span>${metrics.totalPalletsPacked.toLocaleString()}</span><label>Pallets</label></div>
                <div><span>${metrics.palletsPerHour}</span><label>PPH</label></div>
            </div>
            <div class="progress-bar-container" style="padding:0; box-shadow:none; margin-top: 12px; background:transparent;">
                <div class="progress-bar" style="height: 8px;"><div class="progress-bar-fill" style="width: ${progress}%"></div></div>
            </div>
        </li>`;
    }).join('');
}

function initActiveShipmentScreen() {
    const shipment = getCurrentWorkableItem();
    if (!shipment) return;

    document.getElementById('planAndPackHeaderTitle').textContent = shipment.name;
    document.getElementById('displayContainerNumber').textContent = shipment.containerNumber || 'N/A';
    document.getElementById('shipmentNameForProgress').textContent = shipment.name;

    const startTimeEl = document.getElementById('displayShipmentStartTime');
    if (startTimeEl) {
        startTimeEl.textContent = shipment.startTime ? new Date(shipment.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Not Set';
        startTimeEl.style.color = shipment.startTime ? 'var(--text-primary)' : 'var(--accent-danger)';
        startTimeEl.style.fontWeight = shipment.startTime ? 'bold' : 'bold';
    }
    
    startDeadlineCountdown(shipment);
    updateShipmentPerformanceMetrics();
    renderSkuTabs();
    updateSkuPackingUI();
}

function renderSkuTabs() {
    const container = document.getElementById('skuTabsContainer');
    const shipment = getCurrentWorkableItem();
    if (!container || !shipment) return;

    if (shipment.skus.length === 0) {
        container.innerHTML = '<span style="padding:10px; font-weight:bold; color:gray;">No SKUs added yet.</span>';
        return;
    }

    container.innerHTML = shipment.skus.map((sku, index) => {
        const metrics = getShipmentMetrics({ skus: [sku] });
        const isComplete = sku.target > 0 && metrics.totalUnitsPacked >= sku.target;
        const isActive = index === shipment.currentSkuIndex;
        return `<button class="sku-tab ${isActive ? 'active' : ''} ${isComplete ? 'is-complete' : ''}" onclick="selectSku(${index})">${sku.code} ${isComplete ? '✓' : ''}</button>`;
    }).join('');
}

function updateSkuPackingUI() {
    const shipment = getCurrentWorkableItem();
    const sku = getCurrentSku();
    const skuPackingUI = document.getElementById('skuPackingUI');
    const packingDisabledOverlay = document.getElementById('packingDisabledOverlay');

    if (!skuPackingUI || !packingDisabledOverlay) return;

    const showPackingUI = !!shipment && !!sku;
    skuPackingUI.classList.toggle('hidden', !showPackingUI);
    
    const isPackingDisabled = !shipment || !shipment.startTime;
    packingDisabledOverlay.classList.toggle('hidden', !isPackingDisabled);

    if(shipment) {
        const sm = getShipmentMetrics(shipment);
        const sp = sm.totalTargetUnits > 0 ? Math.min(100, (sm.totalUnitsPacked / sm.totalTargetUnits) * 100) : 0;
        document.getElementById('shipmentProgressBarFill').style.width = `${sp}%`;
        document.getElementById('shipmentProgressText').textContent = `${Math.round(sp)}% (${sm.totalUnitsPacked}/${sm.totalTargetUnits})`;
    }

    if (!showPackingUI) return;

    document.getElementById('codeDisplay').textContent = sku.code || 'N/A';
    document.getElementById('totalDisplay').textContent = (sku.target || 0).toLocaleString();

    const metrics = getShipmentMetrics({ skus: [sku] });
    const unitsLeft = Math.max(0, (sku.target || 0) - metrics.totalUnitsPacked);
    
    document.getElementById('leftDisplay').textContent = unitsLeft.toLocaleString();
    document.getElementById('palletsDisplay').textContent = metrics.totalPalletsPacked.toLocaleString();

    // Pallets Left Logic (Uses selected capacity or largest available)
    let palletsLeft = 'N/A';
    const capToUse = currentPackingState.selectedCapacity || Math.max(...(sku.capacities.length > 0 ? sku.capacities : [Infinity]));
    
    if (capToUse && capToUse !== Infinity && unitsLeft > 0) {
        palletsLeft = Math.ceil(unitsLeft / capToUse).toLocaleString();
    } else if (unitsLeft === 0) {
        palletsLeft = 0;
    }
    document.getElementById('palletsLeftDisplay').textContent = palletsLeft;

    renderPalletCapacities(sku, unitsLeft, capToUse);
    renderEntriesLog(sku.entries || []);
    updatePackingSuggestion(sku, unitsLeft, capToUse);
}

function renderPalletCapacities(sku, unitsLeft, capToUse) {
    const container = document.getElementById('palletCapacitiesContainer');
    if (!container) return;

    const capacities = sku.capacities || [];
    
    // Auto select first capacity if null
    if(currentPackingState.selectedCapacity === null && capacities.length > 0) {
        currentPackingState.selectedCapacity = capacities[0]; // First one (should be largest since we sorted)
    }

    let chipsHTML = capacities.map(cap => `
        <button class="chip ${cap === currentPackingState.selectedCapacity ? 'active' : ''}" onclick="handleCapacityChipClick(${cap})">${cap} Units</button>
    `).join('');
    
    const addChipHTML = `<button class="chip" style="border-style:dashed;" onclick="handleAddCapacity()">+ Add Size</button>`;

    // --- YOUR EXACT PARTIAL PALLET LOGIC ---
    // If the units left are less than the smallest defined capacity, trigger Finish Mode
    const smallestCapacity = capacities.length > 0 ? Math.min(...capacities) : Infinity;
    const isFinishMode = unitsLeft > 0 && (unitsLeft < smallestCapacity || capacities.length === 0);

    const quickBtn = document.getElementById('quickAddBtn');
    const finishBtn = document.getElementById('finishPalletBtn');
    const batchBox = document.getElementById('batchControls');

    if (unitsLeft === 0) {
        quickBtn.classList.remove('hidden');
        quickBtn.disabled = true;
        quickBtn.textContent = "✓ Complete";
        finishBtn.classList.add('hidden');
        batchBox.style.opacity = '0.3';
        batchBox.style.pointerEvents = 'none';
    } else if (isFinishMode) {
        quickBtn.classList.add('hidden');
        finishBtn.classList.remove('hidden');
        finishBtn.textContent = `Log Final Partial (${unitsLeft.toLocaleString()} units)`;
        batchBox.style.opacity = '0.3';
        batchBox.style.pointerEvents = 'none';
    } else {
        quickBtn.classList.remove('hidden');
        finishBtn.classList.add('hidden');
        quickBtn.disabled = !currentPackingState.selectedCapacity;
        quickBtn.textContent = `+1 Pallet (${currentPackingState.selectedCapacity || '?'} units)`;
        batchBox.style.opacity = '1';
        batchBox.style.pointerEvents = 'auto';
    }

    container.innerHTML = `<div class="chips-container">${chipsHTML}${addChipHTML}</div>`;
}

function updatePackingSuggestion(sku, unitsLeft, capToUse) {
    const suggestionEl = document.getElementById('suggestionText');
    const suggestionBox = document.getElementById('packingSuggestion');
    if (!suggestionEl || !suggestionBox) return;

    if (unitsLeft <= 0) {
        const unitsOver = Math.abs((sku.target || 0) - getShipmentMetrics({ skus: [sku] }).totalUnitsPacked);
        suggestionEl.innerHTML = sku.target > 0 
            ? `Target reached. You are <strong>${unitsOver.toLocaleString()}</strong> units over.`
            : "No target set for this SKU.";
        suggestionBox.className = `suggestion-box ${unitsOver > 0 ? 'state-awkward' : 'state-optimal'}`;
        return;
    }

    // Try to find the perfect fit capacity
    const bestFit = (sku.capacities || []).reduce((best, cap) => {
        if (cap <= unitsLeft) {
            const remainder = unitsLeft % cap;
            if (remainder < best.remainder) { return { cap, remainder }; }
        }
        return best;
    }, { cap: null, remainder: Infinity });

    // Fallback to currently selected if no perfect fit
    const activeCap = bestFit.cap || currentPackingState.selectedCapacity;

    if (activeCap) {
        const numPallets = Math.floor(unitsLeft / activeCap);
        const rem = unitsLeft % activeCap;
        
        let suggestionText = `Pack <strong>${numPallets}</strong> pallet(s) of <strong>${activeCap}</strong>.`;
        if (rem > 0) {
            suggestionText += ` <strong>${rem}</strong> units will be left.`;
            suggestionBox.className = 'suggestion-box state-awkward';
        } else {
            suggestionBox.className = 'suggestion-box state-optimal';
        }
        if (numPallets > 0) suggestionEl.innerHTML = suggestionText;
        else {
            suggestionEl.textContent = `${unitsLeft} units remaining. Use 'Log Final Partial'.`;
            suggestionBox.className = 'suggestion-box state-info';
        }
    } else {
        suggestionEl.textContent = `No capacities available. Please add a size.`;
        suggestionBox.className = 'suggestion-box state-warning';
    }
}

function renderEntriesLog(entries) {
    const logEl = document.getElementById('entriesLog');
    if (!logEl) return;
    if (entries.length === 0) {
        logEl.innerHTML = `<li style="padding:20px; color:gray; text-align:center; font-style:italic;">No pallets packed for this SKU yet.</li>`;
        return;
    }
    logEl.innerHTML = [...entries].reverse().map((entry, reverseIdx) => {
        const actualIdx = entries.length - 1 - reverseIdx;
        return `<li class="entry-batch-item">
                    <div>
                        <span class="main-text">${entry.palletCount} Pallet(s)</span><br>
                        <span class="sub-text">${entry.units} units total @ ${entry.capacityUsed}/pallet - ${timeAgo(entry.timestamp)}</span>
                    </div>
                    <button class="entry-delete-btn" onclick="handleDeleteSkuEntry(${actualIdx})">×</button>
                </li>`;
    }).join('');
}


// ==========================================
// 4. ACTIONS & INTERACTION LOGIC
// ==========================================

function handleSetShipmentStartTime() {
    const shipment = getCurrentWorkableItem();
    if (!shipment) return;

    const now = new Date(shipment.startTime || Date.now());
    const defaultDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const defaultTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const html = `
        <div class="form-field"><label>Date</label><input type="date" id="customDateInput" class="input-field" value="${defaultDate}"></div>
        <div style="display:flex; gap:12px; margin-bottom: 1rem; flex-wrap: wrap;">
            <button onclick="document.getElementById('customTimeInput').value='08:00'" class="btn btn-secondary btn-small">Set 08:00</button>
            <button onclick="document.getElementById('customTimeInput').value='12:00'" class="btn btn-secondary btn-small">Set 12:00</button>
            <button onclick="const n=new Date(); document.getElementById('customTimeInput').value=n.toTimeString().slice(0,5)" class="btn btn-secondary btn-small">Set to Now</button>
        </div>
        <div class="form-field"><label>Time</label><input type="time" id="customTimeInput" class="input-field" value="${defaultTime}"></div>
    `;

    showModal("Set Start Time", html, () => {
        const d = document.getElementById('customDateInput').value;
        const t = document.getElementById('customTimeInput').value;
        if(d && t) {
            shipment.startTime = new Date(`${d}T${t}`).getTime();
            saveAppState();
            closeModal();
            initActiveShipmentScreen();
        } else {
            alert("Invalid date/time");
        }
    });
}

function handleCreateShipment() {
    const html = `
        <div class="form-field"><label>Shipment Name</label><input type="text" id="newName" class="input-field" placeholder="e.g. Amazon Trailer 1"></div>
        <div class="form-field"><label>Container / Notes</label><input type="text" id="newContainer" class="input-field" placeholder="e.g. TR-9982"></div>
    `;
    showModal("New Shipment", html, () => {
        const name = document.getElementById('newName').value.trim();
        if (!name) return alert("Name is required");

        appState.shipments.unshift({
            id: generateId(),
            name: name,
            containerNumber: document.getElementById('newContainer').value,
            startTime: null,
            skus: [],
            currentSkuIndex: -1
        });
        saveAppState();
        closeModal();
        appState.currentShipmentIndex = 0;
        initPlanAndPackScreen();
    });
}

function openShipment(index) {
    appState.currentShipmentIndex = index;
    saveAppState();
    initPlanAndPackScreen();
}

function handleBackToHub() {
    appState.currentShipmentIndex = -1;
    saveAppState();
    initPlanAndPackScreen();
}

function handleDeleteShipment() {
    if(confirm("Are you sure you want to permanently delete this shipment?")) {
        appState.shipments.splice(appState.currentShipmentIndex, 1);
        handleBackToHub();
    }
}

function toggleTimer() {
    handleSetShipmentStartTime();
}

function handleAddSku() {
    const html = `
        <div class="form-field"><label>SKU Code</label><input type="text" id="newSkuCode" class="input-field" placeholder="e.g. WIDGET-A"></div>
        <div class="form-field"><label>Target Units</label><input type="number" id="newSkuTarget" class="input-field" placeholder="e.g. 500"></div>
        <div class="form-field"><label>Pallet Capacities (comma separated)</label><input type="text" id="newSkuCaps" class="input-field" placeholder="e.g. 50, 25"></div>
    `;
    showModal("Add SKU", html, () => {
        const code = document.getElementById('newSkuCode').value.trim().toUpperCase();
        const target = parseInt(document.getElementById('newSkuTarget').value, 10);
        const caps = document.getElementById('newSkuCaps').value.split(',').map(n => parseInt(n)).filter(n => !isNaN(n));

        if (!code || isNaN(target)) return alert("Valid code and target required");

        const shipment = getCurrentWorkableItem();
        shipment.skus.push({
            code: code, target: target, capacities: caps.length > 0 ? caps.sort((a,b)=>b-a) : [50], entries: []
        });
        
        shipment.currentSkuIndex = shipment.skus.length - 1;
        currentPackingState.selectedCapacity = null;
        saveAppState();
        closeModal();
        initActiveShipmentScreen();
    });
}

function selectSku(index) {
    const shipment = getCurrentWorkableItem();
    shipment.currentSkuIndex = index;
    currentPackingState.selectedCapacity = null;
    saveAppState();
    renderSkuTabs();
    updateSkuPackingUI();
}

function navigateSku(direction) {
    const shipment = getCurrentWorkableItem();
    if (!shipment || shipment.skus.length === 0) return;
    
    if (direction === 'left') {
        shipment.currentSkuIndex = (shipment.currentSkuIndex - 1 + shipment.skus.length) % shipment.skus.length;
    } else {
        shipment.currentSkuIndex = (shipment.currentSkuIndex + 1) % shipment.skus.length;
    }
    currentPackingState.selectedCapacity = null;
    saveAppState();
    renderSkuTabs();
    updateSkuPackingUI();
}

function handleAddCapacity() {
    const html = `<div class="form-field"><label>New Capacity</label><input type="number" id="newCap" class="input-field"></div>`;
    showModal("Add Capacity", html, () => {
        const cap = parseInt(document.getElementById('newCap').value, 10);
        if (!isNaN(cap)) {
            const sku = getCurrentSku();
            if (!sku.capacities.includes(cap)) {
                sku.capacities.push(cap);
                sku.capacities.sort((a,b)=>b-a); // Sort descending
                currentPackingState.selectedCapacity = cap;
            }
        }
        saveAppState();
        closeModal();
        updateSkuPackingUI();
    });
}

function handleCapacityChipClick(cap) {
    currentPackingState.selectedCapacity = currentPackingState.selectedCapacity === cap ? null : cap;
    updateSkuPackingUI();
}

function adjustQty(amount) {
    let qty = parseInt(document.getElementById('palletQuantity').value, 10) || 1;
    qty = Math.max(1, qty + amount);
    document.getElementById('palletQuantity').value = qty;
    currentPackingState.quantity = qty;
}

// THE CORE LOGGING FUNCTIONS (YOUR EXACT PARTIAL PALLET MATH)
function handleQuickAddOnePallet(btnElement) {
    const { selectedCapacity } = currentPackingState;
    if (!selectedCapacity) return showToastNotification("Select a capacity first.", "error");
    addPalletEntry(1, selectedCapacity, btnElement);
}

function handleAddMultiplePallets(btnElement) {
    const { selectedCapacity, quantity } = currentPackingState;
    if (!selectedCapacity) return showToastNotification("Select a capacity first.", "error");
    addPalletEntry(quantity, selectedCapacity, btnElement);
    
    currentPackingState.quantity = 1;
    document.getElementById('palletQuantity').value = 1;
}

function handleFinishLastPallet(btnElement) {
    const sku = getCurrentSku();
    const metrics = getShipmentMetrics({ skus: [sku] });
    const unitsLeft = (sku.target || 0) - metrics.totalUnitsPacked;
    
    if (unitsLeft <= 0) return;
    addPalletEntry(1, unitsLeft, btnElement); // Send unitsLeft as the capacity of this 1 pallet
    showToastNotification(`Final partial pallet logged.`, 'success');
}

function addPalletEntry(palletCount, capacityUsed, btnElement = null) {
    const sku = getCurrentSku();
    if (!sku) return;

    sku.entries.push({
        palletCount: palletCount,
        capacityUsed: capacityUsed,
        units: palletCount * capacityUsed, // EXPLICITLY save total units
        timestamp: Date.now()
    });
    
    saveAppState();
    updateSkuPackingUI();
    updateShipmentPerformanceMetrics(); 

    if (btnElement) {
        const rect = btnElement.getBoundingClientRect();
        const flyUp = document.createElement('div');
        flyUp.className = 'fly-up-animation';
        flyUp.textContent = `+${palletCount}`;
        flyUp.style.left = `${rect.left + rect.width / 2}px`;
        flyUp.style.top = `${rect.top}px`;
        document.body.appendChild(flyUp);
        setTimeout(() => flyUp.remove(), 800);
    }
}

function handleDeleteSkuEntry(index) {
    if(confirm("Delete this pallet entry?")) {
        getCurrentSku().entries.splice(index, 1);
        saveAppState();
        updateSkuPackingUI();
        updateShipmentPerformanceMetrics();
    }
}

function handleUndoSkuEntry() {
    const sku = getCurrentSku();
    if(sku && sku.entries.length > 0) {
        sku.entries.pop();
        saveAppState();
        updateSkuPackingUI();
        updateShipmentPerformanceMetrics();
    }
}

function handleResetSkuData() {
    if(confirm("Clear ALL packed data for this SKU?")) {
        getCurrentSku().entries = [];
        saveAppState();
        updateSkuPackingUI();
        updateShipmentPerformanceMetrics();
    }
}

// ==========================================
// 5. MODAL SYSTEM
// ==========================================
let modalCallback = null;

function showModal(title, html, onConfirm) {
    document.getElementById('modalTitleText').textContent = title;
    document.getElementById('modalCustomContent').innerHTML = html;
    modalCallback = onConfirm;
    document.getElementById('modalOverlay').classList.remove('hidden');
    setTimeout(() => document.querySelector('#modalCustomContent input')?.focus(), 100);
}

function closeModal() {
    document.getElementById('modalOverlay').classList.add('hidden');
    modalCallback = null;
}

document.getElementById('modalCancelBtn').addEventListener('click', closeModal);
document.getElementById('modalConfirmBtn').addEventListener('click', () => {
    if (modalCallback) modalCallback();
});

// ==========================================
// 6. BOOTSTRAP
// ==========================================
// Wait for everything to be ready
window.addEventListener('load', () => {
    loadAppState();
    // Re-render everything
    initPlanAndPackScreen();
});