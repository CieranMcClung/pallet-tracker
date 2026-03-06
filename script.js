// --- STATE MANAGEMENT (Uses LocalStorage) ---
let appState = {
    containers: [],
    activeContainerId: null
};

// Load state from local storage on startup
function loadState() {
    const saved = localStorage.getItem('containerTrackerState');
    if (saved) {
        appState = JSON.parse(saved);
    }
}

// Save state to local storage
function saveState() {
    localStorage.setItem('containerTrackerState', JSON.stringify(appState));
}

// Get the currently active container object
function getActiveContainer() {
    return appState.containers.find(c => c.id === appState.activeContainerId);
}

// --- CORE METRICS CALCULATOR ---
function calculateMetrics(container) {
    let totalTarget = 0;
    let totalUnitsPacked = 0;
    let totalPallets = 0;

    // Calculate totals across all SKUs
    container.skus.forEach(sku => {
        totalTarget += sku.target;
        sku.entries.forEach(entry => {
            totalUnitsPacked += entry.units;
            totalPallets += 1;
        });
    });

    const progress = totalTarget > 0 ? Math.min(100, (totalUnitsPacked / totalTarget) * 100) : 0;
    
    // Time calculations
    let activeTimeHours = 0;
    let pph = 0;
    let eta = "--:--";

    if (container.startTime) {
        const activeTimeMs = Date.now() - container.startTime;
        activeTimeHours = activeTimeMs / (1000 * 60 * 60);

        if (activeTimeHours > 0) {
            pph = totalPallets / activeTimeHours;
        }

        // ETA Calculation
        const unitsRemaining = Math.max(0, totalTarget - totalUnitsPacked);
        const unitsPerHour = activeTimeHours > 0 ? (totalUnitsPacked / activeTimeHours) : 0;

        if (unitsRemaining > 0 && unitsPerHour > 0) {
            const timeRemainingHours = unitsRemaining / unitsPerHour;
            const finishTimeMs = Date.now() + (timeRemainingHours * 60 * 60 * 1000);
            const finishDate = new Date(finishTimeMs);
            eta = finishDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (unitsRemaining === 0 && totalTarget > 0) {
            eta = "Complete";
        } else {
            eta = "Calculating...";
        }
    } else {
        eta = "Not Started";
    }

    return {
        totalTarget,
        totalUnitsPacked,
        totalPallets,
        progress,
        pph: pph.toFixed(1),
        eta
    };
}


// --- UI RENDERING ---

function renderSidebar() {
    const list = document.getElementById('containerList');
    list.innerHTML = '';

    appState.containers.forEach(container => {
        const li = document.createElement('li');
        li.className = `container-item ${container.id === appState.activeContainerId ? 'active' : ''}`;
        li.onclick = () => selectContainer(container.id);
        
        const startedText = container.startTime ? 'In Progress' : 'Not Started';
        
        li.innerHTML = `
            <strong>${container.name}</strong>
            <span>${container.notes || 'No ID'} • ${startedText}</span>
        `;
        list.appendChild(li);
    });
}

function renderMainView() {
    const emptyState = document.getElementById('emptyState');
    const activeView = document.getElementById('activeContainerView');
    const container = getActiveContainer();

    if (!container) {
        emptyState.classList.remove('hidden');
        activeView.classList.add('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    activeView.classList.remove('hidden');

    // Header
    document.getElementById('displayContainerName').textContent = container.name;
    document.getElementById('displayContainerNotes').textContent = container.notes || 'No additional notes.';

    updateMetricsDisplay();
    renderSkus();
}

function updateMetricsDisplay() {
    const container = getActiveContainer();
    if (!container) return;

    const metrics = calculateMetrics(container);

    document.getElementById('metricProgress').textContent = `${Math.round(metrics.progress)}%`;
    document.getElementById('progressBarFill').style.width = `${metrics.progress}%`;
    document.getElementById('metricPacked').textContent = `${metrics.totalUnitsPacked.toLocaleString()} / ${metrics.totalTarget.toLocaleString()}`;
    document.getElementById('metricPPH').textContent = metrics.pph;
    document.getElementById('metricETA').textContent = metrics.eta;
}

function renderSkus() {
    const container = getActiveContainer();
    const list = document.getElementById('skuList');
    list.innerHTML = '';

    if (container.skus.length === 0) {
        list.innerHTML = '<p class="text-secondary">No SKUs added yet. Click "Add SKU" to begin.</p>';
        return;
    }

    container.skus.forEach(sku => {
        const unitsPacked = sku.entries.reduce((sum, entry) => sum + entry.units, 0);
        const isComplete = unitsPacked >= sku.target;

        const card = document.createElement('div');
        card.className = `sku-card`;
        
        card.innerHTML = `
            <div class="sku-info">
                <h4>${sku.code} ${isComplete ? '✅' : ''}</h4>
                <p>Packed: <strong>${unitsPacked}</strong> / ${sku.target} Units</p>
                <p>Pallets Logged: ${sku.entries.length}</p>
            </div>
            <div class="sku-actions">
                ${!container.startTime 
                    ? `<button class="btn btn-primary" onclick="startContainerTimer()">Start Timer to Pack</button>` 
                    : `<button class="btn btn-primary" onclick="showPackPalletModal('${sku.id}')" ${isComplete ? 'disabled' : ''}>+ Pack Pallet</button>`
                }
            </div>
        `;
        list.appendChild(card);
    });
}


// --- INTERACTIONS & LOGIC ---

function selectContainer(id) {
    appState.activeContainerId = id;
    saveState();
    renderSidebar();
    renderMainView();
}

function startContainerTimer() {
    const container = getActiveContainer();
    if (!container) return;
    container.startTime = Date.now();
    saveState();
    renderMainView();
}

function deleteCurrentContainer() {
    if(confirm("Are you sure you want to delete this container?")) {
        appState.containers = appState.containers.filter(c => c.id !== appState.activeContainerId);
        appState.activeContainerId = null;
        saveState();
        renderSidebar();
        renderMainView();
    }
}


// --- MODAL SYSTEM ---

let modalConfirmCallback = null;

function showModal(title, contentHtml, onConfirm) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalContent').innerHTML = contentHtml;
    modalConfirmCallback = onConfirm;
    document.getElementById('modalOverlay').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.add('hidden');
    modalConfirmCallback = null;
}

document.getElementById('modalConfirmBtn').addEventListener('click', () => {
    if (modalConfirmCallback) {
        modalConfirmCallback();
    }
});

// --- SPECIFIC MODALS ---

function showNewContainerModal() {
    const html = `
        <div class="form-field">
            <label>Container Name</label>
            <input type="text" id="newContainerName" class="input-field" placeholder="e.g. Shipment 101">
        </div>
        <div class="form-field">
            <label>Container ID / Notes (Optional)</label>
            <input type="text" id="newContainerNotes" class="input-field" placeholder="e.g. Trailer #4521">
        </div>
    `;
    showModal("Create New Container", html, () => {
        const name = document.getElementById('newContainerName').value.trim();
        if (!name) return alert("Name is required.");
        
        const newContainer = {
            id: 'c_' + Date.now(),
            name: name,
            notes: document.getElementById('newContainerNotes').value.trim(),
            startTime: null,
            skus: []
        };

        appState.containers.unshift(newContainer);
        appState.activeContainerId = newContainer.id;
        saveState();
        closeModal();
        renderSidebar();
        renderMainView();
    });
}

function showNewSkuModal() {
    const html = `
        <div class="form-field">
            <label>SKU Code</label>
            <input type="text" id="newSkuCode" class="input-field" placeholder="e.g. LAPTOP-X1">
        </div>
        <div class="form-field">
            <label>Target Units to Pack</label>
            <input type="number" id="newSkuTarget" class="input-field" placeholder="e.g. 500">
        </div>
    `;
    showModal("Add SKU to Container", html, () => {
        const code = document.getElementById('newSkuCode').value.trim();
        const target = parseInt(document.getElementById('newSkuTarget').value, 10);
        
        if (!code || isNaN(target) || target <= 0) return alert("Valid code and target required.");
        
        const container = getActiveContainer();
        container.skus.push({
            id: 's_' + Date.now(),
            code: code,
            target: target,
            entries: []
        });

        saveState();
        closeModal();
        renderMainView();
    });
}

function showPackPalletModal(skuId) {
    const container = getActiveContainer();
    const sku = container.skus.find(s => s.id === skuId);
    
    // Auto-calculate how many units are left so we can suggest it
    const unitsPacked = sku.entries.reduce((sum, entry) => sum + entry.units, 0);
    const unitsLeft = Math.max(0, sku.target - unitsPacked);

    const html = `
        <p style="margin-bottom:16px;">How many units are on this pallet for <strong>${sku.code}</strong>?</p>
        <div class="form-field">
            <label>Units on this Pallet</label>
            <input type="number" id="packUnits" class="input-field" value="${unitsLeft}">
        </div>
    `;
    showModal(`Pack Pallet`, html, () => {
        const units = parseInt(document.getElementById('packUnits').value, 10);
        if (isNaN(units) || units <= 0) return alert("Must be a valid number.");

        sku.entries.push({
            timestamp: Date.now(),
            units: units
        });

        saveState();
        closeModal();
        renderMainView();
    });
}

// --- BOOTSTRAP & BACKGROUND LOOPS ---

// Auto-update metrics every second (to keep ETA and PPH live)
setInterval(() => {
    if (appState.activeContainerId && getActiveContainer()?.startTime) {
        updateMetricsDisplay();
    }
}, 1000);

// Start app
loadState();
renderSidebar();
renderMainView();
