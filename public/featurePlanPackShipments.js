// Plan & Pack Screen: Shipment Management Logic

async function handleNewShipment() {
    const shipmentName = await showModal({
        title: "New Shipment Name",
        placeholder: `e.g., Container ${appState.shipments.length + 1}`,
        inputType: "text",
        inputValue: `Shipment - ${new Date().toLocaleDateString([], {month: 'short', day: 'numeric'})}`,
        confirmButtonText: "Create Shipment"
    });
    if (shipmentName === null || shipmentName === undefined || String(shipmentName).trim() === "") return;

    const newShipmentId = `ship_${Date.now()}_${Math.random().toString(36).substring(2,7)}`;
    const newShipment = {
        id: newShipmentId,
        name: String(shipmentName).trim(),
        skus: [],
        currentSkuIndex: -1,
        isArchived: false,
        forkliftDriver: '',
        loaderName: '',
        startTime: null,
        userSetStartTime: false,
    };
    appState.shipments.push(newShipment);
    appState.currentShipmentIndex = appState.shipments.length - 1;
    appState.lastSkuIndexPerShipment[newShipment.id] = -1; 
    saveAppState();
    renderShipmentSelector(); 
    initPlanAndPackScreen();  

    requestAnimationFrame(async () => {
        const setTime = await showModal({
            title: `Set Start Time for "${newShipment.name}"?`,
            prompt: "Shipment created. It's recommended to set the start time now to enable packing and progress tracking.",
            inputType: 'none',
            confirmButtonText: "Set Start Time",
            cancelButtonText: "Later"
        });
        if (setTime) {
            handleSetShipmentStartTime();
        }
    });
}

async function handleEditShipmentDetails() {
    const shipment = getCurrentShipment();
    if (!shipment) {
        await showModal({title:"Error", prompt:"No shipment selected to edit.", inputType:"none", confirmButtonText:"OK"});
        return;
    }

    const contentHTML = `
        <div class="form-field">
            <label for="modalShipmentName">Shipment Name*</label>
            <input type="text" id="modalShipmentName" class="input-field" value="${shipment.name}">
        </div>
        <div class="form-field">
            <label for="modalForkliftDriver">Forklift Driver</label>
            <input type="text" id="modalForkliftDriver" class="input-field" value="${shipment.forkliftDriver || ''}" placeholder="Enter driver's name">
        </div>
        <div class="form-field">
            <label for="modalLoaderName">Loader Name</label>
            <input type="text" id="modalLoaderName" class="input-field" value="${shipment.loaderName || ''}" placeholder="Enter loader's name">
        </div>
    `;
    const result = await showModal({
        title: "Edit Shipment Details",
        contentHTML: contentHTML,
        confirmButtonText: "Save Changes",
        actionType: 'editShipmentDetails',
    });

    if (result) { 
        shipment.name = result.name;
        shipment.forkliftDriver = result.forkliftDriver;
        shipment.loaderName = result.loaderName;
        saveAppState();
        renderShipmentSelector();
        initPlanAndPackScreen();
    }
}

async function handleSetShipmentStartTime() {
    const shipment = getCurrentShipment();
    if (!shipment) {
        await showModal({title:"Error", prompt:"No shipment selected.", inputType:"none", confirmButtonText:"OK"});
        return;
    }
    if (shipment.isArchived) {
        await showModal({ title: "Archived Shipment", prompt: "Cannot change start time for an archived shipment.", inputType: 'none', confirmButtonText: "OK" });
        return;
    }

    let defaultTime = "";
    if (shipment.startTime) {
        const d = new Date(shipment.startTime);
        defaultTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } else {
         const now = new Date();
         defaultTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }

    const setTimeContentHTML = `
        <p id="modalSetTimeMainPrompt" class="modal-prompt">Select a preset time or enter a custom time. This time is crucial for progress tracking.</p>
        <div id="presetTimeButtonsContainer" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 15px;">
            <button id="btnSetTime800Modal" class="btn btn-secondary">Set to 8:00 AM</button>
            <button id="btnSetTime1200Modal" class="btn btn-secondary">Set to 12:00 PM (Noon)</button>
            <button id="btnSetTimeToNowModal" class="btn btn-secondary">Set to Current Time</button>
            <button id="btnShowCustomTimeModal" class="btn btn-secondary">Enter Custom Time...</button>
        </div>
        <div id="customTimeInputContainerModal" style="display: none; margin-top: 10px; padding-top:15px; border-top: 1px solid var(--border-secondary);">
            <div class="form-field">
                <label for="customTimeInputModal">Custom Time (HH:MM, 24-hour format):</label>
                <input type="time" id="customTimeInputModal" class="input-field" value="${defaultTime}">
            </div>
            <button id="btnSetCustomTimeConfirmModal" class="btn btn-primary" style="width:100%; margin-top:10px;">Confirm This Custom Time</button>
            <button id="btnCancelCustomTimeModal" class="btn btn-secondary" style="width:100%; margin-top:5px;">Back to Preset Options</button>
        </div>
    `;

    const modalPromise = showModal({
        title: `Set Start Time for: ${shipment.name}`,
        contentHTML: setTimeContentHTML,
        confirmButtonText: "Close", 
        cancelButtonText: "", 
        actionType: 'setShipmentStartTimeInternal',
    });

    requestAnimationFrame(() => {
        if (modalCancelBtn && modalCancelBtn.textContent === "") modalCancelBtn.style.display = 'none';
        else if (modalCancelBtn) modalCancelBtn.style.display = 'inline-flex';

        const mainPrompt = document.getElementById('modalSetTimeMainPrompt');
        const presetButtonsDiv = document.getElementById('presetTimeButtonsContainer');
        const customTimeDiv = document.getElementById('customTimeInputContainerModal');
        const customTimeInputEl = document.getElementById('customTimeInputModal');
        
        if (modalErrorText) { modalErrorText.classList.add('hidden'); modalErrorText.textContent = '';}

        const applyTimeAndClose = (hours, minutes) => {
            const dateToSet = new Date();
            dateToSet.setHours(hours, minutes, 0, 0);
            shipment.startTime = dateToSet.getTime();
            shipment.userSetStartTime = true;
            saveAppState();
            initPlanAndPackScreen();
            closeModal({ success: true, timeSet: shipment.startTime });
        };

        document.getElementById('btnSetTime800Modal')?.addEventListener('click', () => applyTimeAndClose(8, 0));
        document.getElementById('btnSetTime1200Modal')?.addEventListener('click', () => applyTimeAndClose(12, 0));
        document.getElementById('btnSetTimeToNowModal')?.addEventListener('click', () => {
            const now = new Date();
            applyTimeAndClose(now.getHours(), now.getMinutes());
        });
        document.getElementById('btnShowCustomTimeModal')?.addEventListener('click', () => {
            if(mainPrompt) mainPrompt.style.display = 'none';
            if(presetButtonsDiv) presetButtonsDiv.style.display = 'none';
            if(customTimeDiv) customTimeDiv.style.display = 'block';
            if(customTimeInputEl) customTimeInputEl.focus();
            if(modalErrorText) modalErrorText.classList.add('hidden');
        });
        document.getElementById('btnCancelCustomTimeModal')?.addEventListener('click', () => {
            if(mainPrompt) mainPrompt.style.display = 'block';
            if(presetButtonsDiv) presetButtonsDiv.style.display = 'flex';
            if(customTimeDiv) customTimeDiv.style.display = 'none';
            if(modalErrorText) modalErrorText.classList.add('hidden');
        });
        document.getElementById('btnSetCustomTimeConfirmModal')?.addEventListener('click', () => {
            const customTimeValue = customTimeInputEl.value;
            if (customTimeValue) {
                const [hoursStr, minutesStr] = customTimeValue.split(':');
                const hours = parseInt(hoursStr);
                const minutes = parseInt(minutesStr);
                if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
                    if (modalErrorText) { modalErrorText.textContent = 'Invalid time format. Use HH:MM.'; modalErrorText.classList.remove('hidden'); }
                    return;
                }
                applyTimeAndClose(hours, minutes);
            } else {
                if (modalErrorText) { modalErrorText.textContent = 'Please enter a valid time.'; modalErrorText.classList.remove('hidden'); }
            }
        });
    });
    await modalPromise;
}


async function handleFinishShipment() {
    const shipment = getCurrentShipment();
    if (!shipment) {
        await showModal({title:"Error", prompt:"No shipment selected.", inputType:"none", confirmButtonText:"OK"});
        return;
    }
    if (!shipment.startTime) {
        const setTimeFirst = await showModal({
            title: "Start Time Required",
            prompt: "Shipment start time must be set before finishing. Set it now?",
            inputType: 'none',
            confirmButtonText: "Set Start Time",
            cancelButtonText: "Cancel"
        });
        if (setTimeFirst) handleSetShipmentStartTime();
        return;
    }
    const confirmed = await showModal({
        title: `Finish Shipment: ${shipment.name}?`,
        prompt: `This will archive the shipment, making it read-only. Type "FINISH" to confirm.`,
        inputType: 'text', placeholder: 'Type FINISH', needsConfirmation: true,
        confirmKeyword: "FINISH", confirmButtonText: "Archive Shipment"
    });
    if (String(confirmed).toUpperCase() === "FINISH") {
        shipment.isArchived = true;
        saveAppState();
        initPlanAndPackScreen();
    }
}

async function handleUnarchiveShipment() {
    const shipment = getCurrentShipment();
    if (!shipment || !shipment.isArchived) return;

    const confirmed = await showModal({
        title: `Reactivate Shipment: ${shipment.name}?`,
        prompt: `This will unarchive the shipment, making it editable again. Are you sure?`,
        inputType: 'none',
        confirmButtonText: "Yes, Reactivate",
        cancelButtonText: "No, Keep Archived"
    });
    if (confirmed) {
        shipment.isArchived = false;
        saveAppState();
        initPlanAndPackScreen();
    }
}

async function handleSaveShipmentAsTemplate() {
    const shipment = getCurrentShipment();
    if (!shipment) {
        await showModal({ title: "Error", prompt: "No active shipment to save as template.", inputType: 'none', confirmButtonText: "OK" });
        return;
    }
    if (!shipment.skus || shipment.skus.length === 0) {
        await showModal({ title: "Error", prompt: "Shipment has no SKUs to save in a template.", inputType: 'none', confirmButtonText: "OK" });
        return;
    }

    const templateName = await showModal({
        title: "Save as New Template",
        placeholder: `e.g., Template from ${shipment.name}`,
        inputType: "text", inputValue: `Copy of ${shipment.name}`,
        confirmButtonText: "Next"
    });
    if (!templateName || String(templateName).trim() === "") return;

    const templateDescription = await showModal({
        title: "Template Description (Optional)",
        placeholder: `Optional: Describe this template's use or contents`,
        inputType: "text", inputValue: `Created from shipment: ${shipment.name} on ${new Date().toLocaleDateString()}`,
        confirmButtonText: "Save Template"
    });

    const templateSKUs = shipment.skus.map(sku => ({
        code: sku.code,
        target: sku.target || 0,
        capacities: [...(sku.capacities || [])],
        palletBuildInfo: sku.palletBuildInfo ? JSON.parse(JSON.stringify(sku.palletBuildInfo)) : { text: '', imageUrls: [] }
    }));

    const templateData = {
        name: String(templateName).trim(),
        description: templateDescription ? String(templateDescription).trim() : '',
        predefinedSkus: templateSKUs
    };

    showModal({
        title: "Saving Template",
        prompt: "Saving template to the cloud... Please wait.",
        inputType: "none",
        confirmButtonText: "", cancelButtonText: ""
    });
    if (modalConfirmBtn) modalConfirmBtn.style.display = 'none';
    if (modalCancelBtn) modalCancelBtn.style.display = 'none';

    try {
        const docRef = await templatesCollection.add(templateData);
        console.log("Template saved from shipment with ID:", docRef.id);
        closeModal();
        await showModal({ title: "Success!", prompt: `Template "${templateData.name}" saved successfully.`, inputType: "none", confirmButtonText: "OK" });
    } catch (error) {
        console.error("Error saving shipment as template to Firestore: ", error);
        closeModal();
        await showModal({ title: "Error Saving Template", prompt: `Could not save template to cloud. Error: ${error.message}`, inputType: "none", confirmButtonText: "OK" });
    }
}

async function handleCreateShipmentFromTemplate() {
    if (!templatesCollection) {
        await showModal({title: "Service Unavailable", prompt: "Template service is not available. Check connection.", inputType: 'none', confirmButtonText: "OK"});
        return;
    }
    if (localContainerTemplatesCache.length === 0) {
        const createFirst = await showModal({
            title: "No Templates Exist",
            prompt: "No templates found. Go to template manager to create or import one?",
            inputType: 'none',
            confirmButtonText: "Manage Templates",
            cancelButtonText: "Maybe Later"
        });
        if (createFirst) navigateToScreen('manageTemplatesScreen');
        return;
    }

    let templateOptionsHTML = localContainerTemplatesCache.map(t => `<option value="${t.id}">${t.name} (${(t.predefinedSkus || []).length} SKUs)</option>`).join('');
    let templateSelectionHTML = `
        <div class="form-field">
            <label for="templateSelectForShipmentModal">Choose a template:</label>
            <select id="templateSelectForShipmentModal" class="select-field">
                <option value="" disabled selected>-- Select a Template --</option>
                ${templateOptionsHTML}
            </select>
        </div>
        <p class="modal-prompt-divider">Or</p>
        <button id="modalBtnCreateNewTemplate" class="btn btn-secondary" style="width:100%;">Go to Template Manager</button>
    `;
    const modalPromise = showModal({
        title: "New Shipment from Template",
        contentHTML: templateSelectionHTML,
        confirmButtonText: "Use Selected Template",
        cancelButtonText: "Cancel",
        actionType: 'selectTemplateForShipment'
    });

    requestAnimationFrame(() => {
        document.getElementById('modalBtnCreateNewTemplate')?.addEventListener('click', () => closeModal({ type: 'goToManager' }));
        const templateSelectDropdown = document.getElementById('templateSelectForShipmentModal');
        if(modalConfirmBtn && templateSelectDropdown) {
            modalConfirmBtn.disabled = (templateSelectDropdown.value === "");
            templateSelectDropdown.onchange = () => { modalConfirmBtn.disabled = (templateSelectDropdown.value === ""); };
        }
    });

    const modalResult = await modalPromise;

    if (modalResult && modalResult.type === 'useSelected' && modalResult.template) {
        createShipmentWithTemplate(modalResult.template);
    } else if (modalResult && modalResult.type === 'goToManager') {
        navigateToScreen('manageTemplatesScreen');
    }
}

async function createShipmentWithTemplate(template) {
    const shipmentName = await showModal({
        title: `New Shipment from: ${template.name}`,
        placeholder: `e.g., ${template.name} - ${new Date().toLocaleDateString([], {month: 'short', day: 'numeric'})}`,
        inputType: "text", inputValue: `${template.name} - ${new Date().toLocaleDateString([], {month: 'short', day: 'numeric'})}`,
        confirmButtonText: "Create Shipment"
    });
    if (shipmentName === null || shipmentName === undefined || String(shipmentName).trim() === "") return;

    const newShipmentId = `ship_${Date.now()}_${Math.random().toString(36).substring(2,7)}`;
    const newShipment = {
        id: newShipmentId, name: String(shipmentName).trim(),
        skus: (template.predefinedSkus || []).filter(skuTemplate => skuTemplate && skuTemplate.code && String(skuTemplate.code).trim() !== "").map(skuTemplate => ({
            code: skuTemplate.code, target: skuTemplate.target || 0,
            capacities: [...(skuTemplate.capacities || [])],
            entries: [],
            palletBuildInfo: skuTemplate.palletBuildInfo ? JSON.parse(JSON.stringify(skuTemplate.palletBuildInfo)) : { text: '', imageUrls: [] }
        })),
        currentSkuIndex: (template.predefinedSkus || []).filter(st => st && st.code && String(st.code).trim() !== "").length > 0 ? 0 : -1,
        templateIdUsed: template.id,
        isArchived: false, forkliftDriver: '', loaderName: '', startTime: null, userSetStartTime: false,
    };
    appState.shipments.push(newShipment);
    appState.currentShipmentIndex = appState.shipments.length - 1;
    appState.lastSkuIndexPerShipment[newShipment.id] = newShipment.currentSkuIndex;
    saveAppState();
    
    navigateToScreen('planAndPackScreen');
    renderShipmentSelector();
    initPlanAndPackScreen();

    requestAnimationFrame(async () => {
        const setTime = await showModal({
            title: `Set Start Time for "${newShipment.name}"?`,
            prompt: "Shipment created from template. Set start time to begin packing.",
            inputType: 'none',
            confirmButtonText: "Set Start Time",
            cancelButtonText: "Later"
        });
        if (setTime) handleSetShipmentStartTime();
    });
}

async function handleDeleteCurrentShipment() {
    const shipment = getCurrentShipment();
    if (!shipment) {
        await showModal({ title: "Error", prompt: "No shipment selected to delete.", inputType: 'none', confirmButtonText: "OK"});
        return;
    }
    const confirmed = await showModal({
        title: `Delete Shipment: ${shipment.name}?`,
        prompt: `Permanently delete "${shipment.name}"? This cannot be undone. Type "DELETE" to confirm.`,
        inputType: 'text', placeholder: `Type DELETE`, needsConfirmation: true,
        confirmKeyword: "DELETE", confirmButtonText: "Delete Shipment Forever"
    });
    if (String(confirmed).toUpperCase() === "DELETE") {
        const shipmentIdToDelete = shipment.id;
        const shipmentName = shipment.name; 
        appState.shipments.splice(appState.currentShipmentIndex, 1);

        if (appState.currentShipmentIndex >= appState.shipments.length) {
            appState.currentShipmentIndex = appState.shipments.length - 1;
        }
        if (appState.shipments.length > 0) {
            const firstNonArchived = appState.shipments.findIndex(s => !s.isArchived);
            appState.currentShipmentIndex = (firstNonArchived !== -1) ? firstNonArchived : 0;
        } else {
            appState.currentShipmentIndex = -1;
        }

        delete appState.lastSkuIndexPerShipment[shipmentIdToDelete];
        saveAppState();
        renderShipmentSelector();
        initPlanAndPackScreen();
        await showModal({title: "Shipment Deleted", prompt: `Shipment "${shipmentName}" has been deleted.`, inputType: 'none', confirmButtonText: "OK"});
    }
}

// --- MODIFIED: renderShipmentSelector ---
function renderShipmentSelector() {
    if (!shipmentSelect || !shipmentTabsContainer || !shipmentSelectionContainer) return;

    const activeShipments = appState.shipments.filter(s => !s.isArchived);
    const hasActiveShipments = activeShipments.length > 0;

    shipmentTabsContainer.innerHTML = '';
    shipmentSelect.innerHTML = ''; 

    let determinedActiveIndex = appState.currentShipmentIndex;
    if (appState.shipments.length === 0) {
        determinedActiveIndex = -1;
    } else if (determinedActiveIndex === -1 || 
               (determinedActiveIndex >= 0 && appState.shipments[determinedActiveIndex]?.isArchived)) {
        const firstActiveIdx = activeShipments.length > 0 ? appState.shipments.findIndex(s => s.id === activeShipments[0].id) : -1;
        determinedActiveIndex = (firstActiveIdx !== -1) ? firstActiveIdx : (appState.shipments.length > 0 ? 0 : -1); 
    }
    appState.currentShipmentIndex = determinedActiveIndex;


    if (!hasActiveShipments && appState.shipments.length === 0) { 
        shipmentSelect.style.display = 'block';
        shipmentTabsContainer.classList.add('hidden');
        const opt = document.createElement('option');
        opt.textContent = "No Shipments Yet. Create one!";
        opt.disabled = true; opt.selected = true;
        shipmentSelect.appendChild(opt);
    } else if (!hasActiveShipments && appState.shipments.length > 0) { 
        shipmentSelect.style.display = 'block';
        shipmentTabsContainer.classList.add('hidden');
        populateShipmentSelectWithAll(true); 
    } else if (activeShipments.length <= SHIPMENT_TAB_THRESHOLD) {
        shipmentSelect.style.display = 'none';
        shipmentTabsContainer.classList.remove('hidden');
        activeShipments.forEach((shipment) => {
            const originalIndex = appState.shipments.findIndex(s => s.id === shipment.id);
            let totalShipmentTarget = 0, totalShipmentPacked = 0;
            (shipment.skus || []).forEach(s => {
                totalShipmentTarget += (s.target || 0);
                totalShipmentPacked += (s.entries || []).reduce((sum, entry) => sum + (entry.capacityUsed * entry.palletCount), 0);
            });
            let percentage = (totalShipmentTarget > 0) ? (totalShipmentPacked / totalShipmentTarget) * 100 : (totalShipmentPacked > 0 ? 0 : 0);
            percentage = Math.max(0, Math.min(100, percentage));

            const tabData = {
                id: shipment.id,
                name: shipment.name,
                progress: percentage,
                active: originalIndex === appState.currentShipmentIndex,
                originalIndex: originalIndex 
            };
            const tabEl = createGenericTabElement(tabData, 'shipment-tab', 'shipments');
            shipmentTabsContainer.appendChild(tabEl);
        });

        if (appState.shipments.some(s => s.isArchived)) {
            const archivedTab = createGenericTabElement(
                { id: 'viewArchivedShipments', name: 'View Archived', type: 'special', iconSVG: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>' },
                'shipment-tab',
                'shipments'
            );
            archivedTab.title = "View Archived Shipments";
            archivedTab.addEventListener('click', () => {
                shipmentTabsContainer.classList.add('hidden');
                shipmentSelect.style.display = 'block';
                populateShipmentSelectWithAll();
                const firstArchivedIdx = appState.shipments.findIndex(s => s.isArchived);
                if (firstArchivedIdx !== -1) {
                    shipmentSelect.value = firstArchivedIdx.toString();
                    appState.currentShipmentIndex = firstArchivedIdx; 
                    saveAppState();
                    initPlanAndPackScreen();
                }
            });
            shipmentTabsContainer.appendChild(archivedTab);
        }

    } else { 
        shipmentSelect.style.display = 'block';
        shipmentTabsContainer.classList.add('hidden');
        populateShipmentSelectWithAll();
    }

    if (shipmentSelect.style.display !== 'none' && appState.currentShipmentIndex > -1) {
         shipmentSelect.value = appState.currentShipmentIndex.toString();
    }
}

function createGenericTabElement(tabData, typeClass, groupName) {
    const tabButton = document.createElement('button');
    tabButton.className = typeClass;
    tabButton.dataset.tabId = tabData.id;
    tabButton.dataset.tabGroup = groupName;
    if (tabData.originalIndex !== undefined) { 
        tabButton.dataset.originalIndex = tabData.originalIndex.toString();
    }

    const tabTextSpan = document.createElement('span');
    tabTextSpan.className = 'tab-text';

    if (tabData.type === 'special') {
        tabButton.classList.add('special-tab');
        if (tabData.iconSVG) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = tabData.iconSVG; 
            const svgElement = tempDiv.firstChild;
            if (svgElement) {
                svgElement.classList.add('icon'); 
                tabTextSpan.appendChild(svgElement);
            }
        }
        tabTextSpan.appendChild(document.createTextNode((tabData.iconSVG ? ' ' : '') + tabData.name));
    } else {
        tabTextSpan.textContent = tabData.name;
        if (typeof tabData.progress === 'number' && tabData.progress >= 0) {
            tabButton.classList.add('tab-with-progress');
            _updateTabProgressVisuals(tabButton, tabData.progress);
        }
    }
    
    tabButton.appendChild(tabTextSpan);

    if (tabData.active) {
        tabButton.classList.add('active');
    }

    tabButton.addEventListener('click', tabData.type === 'special' ? (e) => {
        if (tabData.id === 'viewArchivedShipments') {
        } else {
             console.log(`Special tab ${tabData.id} clicked.`);
        }
    } : handleGenericTabClick);
    return tabButton;
}

function _updateTabProgressVisuals(tabElement, progressPercentage) {
    const currentProgress = Math.max(0, Math.min(100, parseFloat(progressPercentage) || 0));
    tabElement.style.setProperty('--progress-width', `${currentProgress}%`);

    let tabTextSpan = tabElement.querySelector('.tab-text');
    let percentageSpan = tabElement.querySelector('.tab-progress-percentage');

    if (currentProgress > 0 && currentProgress < 100) { 
        if (!percentageSpan) {
            percentageSpan = document.createElement('span');
            percentageSpan.className = 'tab-progress-percentage';
            if (tabTextSpan) tabTextSpan.appendChild(percentageSpan);
        }
        percentageSpan.textContent = `(${Math.round(currentProgress)}%)`;
        percentageSpan.style.display = '';
    } else if (percentageSpan) {
        percentageSpan.style.display = 'none'; 
    }
    
    tabElement.classList.remove('progress-complete', 'progress-warning', 'progress-critical');
    if (currentProgress >= 99.9) { 
        tabElement.classList.add('progress-complete');
    }
}

function handleGenericTabClick(event) {
    const clickedTab = event.currentTarget;
    const originalIndex = parseInt(clickedTab.dataset.originalIndex);
    const groupName = clickedTab.dataset.tabGroup;

    if (groupName === 'shipments' && !isNaN(originalIndex) && originalIndex >= 0 && originalIndex < appState.shipments.length) {
        appState.currentShipmentIndex = originalIndex;
        saveAppState();
        renderShipmentSelector(); 
        initPlanAndPackScreen();
    } else if (groupName === 'skus') {
        const shipment = getCurrentShipment();
        if (shipment && !isNaN(originalIndex) && originalIndex >= 0 && originalIndex < shipment.skus.length) {
            shipment.currentSkuIndex = originalIndex;
            appState.lastSkuIndexPerShipment[shipment.id] = originalIndex;
            saveAppState();
            renderSkuOptionsForCurrentShipment(skuSearchInput ? skuSearchInput.value : '');
        }
    }
}


function populateShipmentSelectWithAll(onlyArchivedAvailable = false) {
    shipmentSelect.innerHTML = '';

    if (appState.shipments.length === 0) {
        const opt = document.createElement('option');
        opt.textContent = "No Shipments Yet"; opt.disabled = true; opt.selected = true;
        shipmentSelect.appendChild(opt);
        return;
    }

    if (onlyArchivedAvailable) {
        const opt = document.createElement('option');
        opt.value = "-1"; 
        opt.textContent = "No Active Shipments (View Archived Below)";
        opt.disabled = true; opt.selected = true;
        shipmentSelect.appendChild(opt);
    }

    const activeGroup = document.createElement('optgroup'); activeGroup.label = 'Active Shipments';
    const archivedGroup = document.createElement('optgroup'); archivedGroup.label = 'Archived Shipments';
    let hasActive = false, hasArchived = false;

    appState.shipments.forEach((shipment, index) => {
        const opt = document.createElement('option');
        opt.value = index.toString();
        opt.textContent = shipment.name;
        if (shipment.isArchived) { archivedGroup.appendChild(opt); hasArchived = true; }
        else { activeGroup.appendChild(opt); hasActive = true; }
    });

    if (hasActive) shipmentSelect.appendChild(activeGroup);
    if (hasArchived) shipmentSelect.appendChild(archivedGroup);

    if (appState.currentShipmentIndex > -1 && appState.currentShipmentIndex < appState.shipments.length) {
        shipmentSelect.value = appState.currentShipmentIndex.toString();
    } else if (onlyArchivedAvailable && hasArchived) { 
        const firstArchivedIdx = appState.shipments.findIndex(s => s.isArchived);
        if (firstArchivedIdx !== -1) shipmentSelect.value = firstArchivedIdx.toString();
    } else if (hasActive) { 
        const firstActiveIdx = appState.shipments.findIndex(s => !s.isArchived);
         if (firstActiveIdx !== -1) shipmentSelect.value = firstActiveIdx.toString();
    }
}


async function handleShipmentSelectionChange() {
    if (!shipmentSelect) return;
    const newIndex = parseInt(shipmentSelect.value);
    if (!isNaN(newIndex) && newIndex >= 0 && newIndex < appState.shipments.length) {
        appState.currentShipmentIndex = newIndex;
        saveAppState();
        if (shipmentSelect.style.display !== 'none') {
            initPlanAndPackScreen();
        } else {
            renderShipmentSelector();
            initPlanAndPackScreen();
        }
    }
}

function initPlanAndPackScreen() {
    renderShipmentSelector(); 
    const currentShipment = getCurrentShipment();
    const hasShipment = !!currentShipment;
    const isArchived = currentShipment ? currentShipment.isArchived : false;
    const startTimeSet = currentShipment ? !!currentShipment.startTime : false;

    if(finishShipmentBtn) finishShipmentBtn.classList.toggle('hidden', !hasShipment || isArchived || !startTimeSet);
    if(editShipmentDetailsBtn) editShipmentDetailsBtn.classList.toggle('hidden', !hasShipment);
    if(saveAsTemplateBtn) saveAsTemplateBtn.classList.toggle('hidden', !hasShipment);
    if(deleteCurrentShipmentBtn) deleteCurrentShipmentBtn.classList.toggle('hidden', !hasShipment);

    if (setShipmentStartTimeBtn && setShipmentStartTimeBtnText) {
        setShipmentStartTimeBtn.disabled = isArchived;
        setShipmentStartTimeBtnText.textContent = startTimeSet ? "Edit Time" : "Set Time";
        setShipmentStartTimeBtn.classList.toggle('btn-primary', !startTimeSet && hasShipment && !isArchived);
        setShipmentStartTimeBtn.classList.toggle('btn-secondary', startTimeSet || !hasShipment || isArchived);
    }
    if(shipmentTimeSection) shipmentTimeSection.classList.toggle('attention-required', hasShipment && !startTimeSet && !isArchived);
    if(startTimeMissingWarning) startTimeMissingWarning.classList.toggle('hidden', !hasShipment || startTimeSet || isArchived);

    if (shipmentEmptyState) shipmentEmptyState.classList.toggle('hidden', hasShipment);
    if (shipmentDetailsDisplay) shipmentDetailsDisplay.classList.toggle('hidden', !hasShipment);
    if (shipmentHealthMeterContainer) shipmentHealthMeterContainer.classList.toggle('hidden', !hasShipment || isArchived || !startTimeSet);
    if (shipmentProgressContainer) shipmentProgressContainer.classList.toggle('hidden', !hasShipment || isArchived);

    if (shipmentArchivedMessage) shipmentArchivedMessage.classList.toggle('hidden', !isArchived);
    if (unarchiveShipmentBtn) unarchiveShipmentBtn.classList.toggle('hidden', !isArchived);

    const skuAreaDisabled = !hasShipment;
    if (skuSearchInput) skuSearchInput.disabled = skuAreaDisabled;
    if (skuSelectElement) skuSelectElement.disabled = skuAreaDisabled;
    if (skuTabsContainer) skuTabsContainer.querySelectorAll('.sku-tab').forEach(tab => tab.disabled = skuAreaDisabled);
    if (addSkuBtn) addSkuBtn.disabled = !hasShipment || isArchived;

    if (!hasShipment) {
        renderSkuOptionsForCurrentShipment();
        updateShipmentProgressBar();
        updateShipmentHealthMeter();
        return;
    }

    if (displayForkliftDriver) displayForkliftDriver.textContent = currentShipment.forkliftDriver || 'Not Set';
    if (displayLoaderName) displayLoaderName.textContent = currentShipment.loaderName || 'Not Set';
    if (displayShipmentStartTime) {
        displayShipmentStartTime.textContent = startTimeSet
            ? new Date(currentShipment.startTime).toLocaleString([], {dateStyle: 'short', timeStyle: 'short'})
            : 'Not Set';
        displayShipmentStartTime.style.fontWeight = startTimeSet ? 'normal' : 'bold';
        displayShipmentStartTime.style.color = startTimeSet ? 'var(--text-secondary)' : (isArchived ? 'var(--text-secondary)' : 'var(--accent-danger)');
    }

    const shipmentId = currentShipment.id;
    if (appState.lastSkuIndexPerShipment.hasOwnProperty(shipmentId) &&
        currentShipment.skus && currentShipment.skus.length > 0 &&
        appState.lastSkuIndexPerShipment[shipmentId] > -1 &&
        appState.lastSkuIndexPerShipment[shipmentId] < currentShipment.skus.length) {
         currentShipment.currentSkuIndex = appState.lastSkuIndexPerShipment[shipmentId];
    } else if (currentShipment.skus && currentShipment.skus.length > 0) {
         currentShipment.currentSkuIndex = 0; 
         appState.lastSkuIndexPerShipment[shipmentId] = 0;
    } else {
         currentShipment.currentSkuIndex = -1;
         appState.lastSkuIndexPerShipment[shipmentId] = -1;
    }
    
    saveAppState(); 
    renderSkuOptionsForCurrentShipment(skuSearchInput ? skuSearchInput.value : '');
}

function updateShipmentProgressBar() {
    const shipment = getCurrentShipment();
    if (!shipmentProgressContainer || !shipmentNameForProgress || !shipmentProgressBarFill || !shipmentProgressText || !shipmentProgressBarElement) {
        if (shipmentProgressContainer) shipmentProgressContainer.classList.add('hidden');
        return;
    }
    if (!shipment || shipment.isArchived) {
        shipmentProgressContainer.classList.add('hidden'); return;
    }

    let totalShipmentTarget = 0; let totalShipmentPacked = 0;
    if (shipment.skus && shipment.skus.length > 0) {
        shipment.skus.forEach(s => {
            totalShipmentTarget += (s.target || 0);
            totalShipmentPacked += (s.entries || []).reduce((sum, entry) => sum + (entry.capacityUsed * entry.palletCount), 0);
        });
    }
    let percentage = (totalShipmentTarget > 0) ? (totalShipmentPacked / totalShipmentTarget) * 100 : (totalShipmentPacked > 0 ? 0 : 0);
    percentage = Math.max(0, Math.min(100, percentage));

    shipmentNameForProgress.textContent = shipment.name;
    shipmentProgressBarFill.style.width = `${percentage}%`;
    shipmentProgressBarElement.setAttribute('aria-valuenow', percentage.toFixed(2));
    shipmentProgressBarFill.classList.toggle('progress-bar-fill-complete', percentage >= 99.9 && totalShipmentTarget > 0);
    shipmentProgressText.textContent = totalShipmentTarget > 0
        ? `${Math.round(percentage)}% (${totalShipmentPacked}/${totalShipmentTarget} units)`
        : `${totalShipmentPacked} units packed (No Target)`;
    shipmentProgressContainer.classList.remove('hidden');
}

function updateShipmentHealthMeter() {
    const shipment = getCurrentShipment();
    const timeLimitHours = appState.settings.shipmentTimeLimitHours || SHIPMENT_LOADING_TIME_LIMIT_HOURS;

    if (!shipmentHealthMeterContainer || !timeDurationDisplay || !estFinishTimeDisplay || !avgTimePerPalletDisplay || !timeRemainingInLimitDisplay || !shipmentHealthMeterFill || !shipmentHealthWarning) {
        if(shipmentHealthMeterContainer) shipmentHealthMeterContainer.classList.add('hidden');
        return;
    }
    if (!shipment || shipment.isArchived || !shipment.startTime) {
        shipmentHealthMeterContainer.classList.add('hidden');
        timeDurationDisplay.textContent = 'N/A'; estFinishTimeDisplay.textContent = 'N/A';
        avgTimePerPalletDisplay.textContent = 'N/A'; timeRemainingInLimitDisplay.textContent = 'N/A';
        shipmentHealthWarning.classList.add('hidden'); shipmentHealthWarning.textContent = '';
        return;
    }

    shipmentHealthMeterContainer.classList.remove('hidden');
    shipmentHealthWarning.classList.add('hidden'); shipmentHealthWarning.textContent = '';

    let totalPalletsPacked = 0, totalUnitsPacked = 0, totalTargetUnits = 0;
    (shipment.skus || []).forEach(sku => {
        totalTargetUnits += (sku.target || 0);
        (sku.entries || []).forEach(entry => {
            totalPalletsPacked += entry.palletCount;
            totalUnitsPacked += entry.capacityUsed * entry.palletCount;
        });
    });

    const actualStartTime = shipment.startTime;
    const currentTime = Date.now();
    const durationMs = currentTime - actualStartTime;
    timeDurationDisplay.textContent = formatMilliseconds(durationMs, true);

    const loadingTimeLimitMs = timeLimitHours * 60 * 60 * 1000;
    const timeRemainingMs = loadingTimeLimitMs - durationMs;
    timeRemainingInLimitDisplay.textContent = formatMilliseconds(Math.max(0, timeRemainingMs), true);
    timeRemainingInLimitDisplay.style.color = timeRemainingMs < 0 ? 'var(--accent-danger)' : 'var(--text-primary)';

    if (totalPalletsPacked === 0) {
        estFinishTimeDisplay.textContent = 'N/A'; avgTimePerPalletDisplay.textContent = 'N/A';
        shipmentHealthMeterFill.className = 'health-meter-fill gray';
        let initialHealthProgressPercent = (durationMs / loadingTimeLimitMs) * 100;
        shipmentHealthMeterFill.style.width = `${Math.min(100, Math.max(0,initialHealthProgressPercent))}%`;
        if (durationMs > loadingTimeLimitMs) {
            shipmentHealthMeterFill.className = 'health-meter-fill red';
            shipmentHealthWarning.textContent = `Over limit by ${formatMilliseconds(durationMs - loadingTimeLimitMs, true)} with 0 pallets.`;
            shipmentHealthWarning.classList.remove('hidden');
        }
        return;
    }

    const avgTimePerPalletMs = durationMs / totalPalletsPacked;
    avgTimePerPalletDisplay.textContent = formatMilliseconds(avgTimePerPalletMs) + "/pallet";

    const unitsRemaining = totalTargetUnits - totalUnitsPacked;
    let estFinishTimestamp = null;

    if (totalTargetUnits > 0 && unitsRemaining > 0 && totalUnitsPacked > 0 ) {
        const avgUnitsPerPallet = totalUnitsPacked / totalPalletsPacked;
        if (avgUnitsPerPallet > 0) {
            const palletsRemainingEstimate = unitsRemaining / avgUnitsPerPallet;
            const estimatedTimeRemainingMs = palletsRemainingEstimate * avgTimePerPalletMs;
            estFinishTimestamp = currentTime + estimatedTimeRemainingMs;
            estFinishTimeDisplay.textContent = new Date(estFinishTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        } else {
             estFinishTimeDisplay.textContent = 'N/A (calc)';
        }
    } else if (totalTargetUnits > 0 && unitsRemaining <= 0) {
        estFinishTimeDisplay.textContent = 'Completed!';
        estFinishTimestamp = currentTime;
    } else {
        estFinishTimeDisplay.textContent = 'N/A';
    }

    let healthStatus = 'green';
    const effectiveTimeToCompare = (estFinishTimestamp && totalTargetUnits > 0) ? (estFinishTimestamp - actualStartTime) : durationMs;

    if (effectiveTimeToCompare > loadingTimeLimitMs) {
        healthStatus = 'red';
        const overdueMs = effectiveTimeToCompare - loadingTimeLimitMs;
        shipmentHealthWarning.textContent = (estFinishTimestamp && totalTargetUnits > 0 ? `Projected to exceed` : `Exceeded`) +
                                            ` ${timeLimitHours}hr limit by ${formatMilliseconds(overdueMs, true)}!`;
        shipmentHealthWarning.classList.remove('hidden');
    } else if (effectiveTimeToCompare > loadingTimeLimitMs * 0.85) {
        healthStatus = 'yellow';
        shipmentHealthWarning.textContent = `At risk: Approaching ${timeLimitHours}hr limit.`;
        shipmentHealthWarning.classList.remove('hidden');
    }
    shipmentHealthMeterFill.className = `health-meter-fill ${healthStatus}`;
    let healthProgressPercent = (effectiveTimeToCompare / loadingTimeLimitMs) * 100;
    shipmentHealthMeterFill.style.width = `${Math.min(100, Math.max(0,healthProgressPercent))}%`;
}