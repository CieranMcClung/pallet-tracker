// Plan & Pack Screen: SKU Management and Packing UI Logic

async function handleAddOrEditSkuToCurrentShipment(isEditMode = false) {
    const shipment = getCurrentShipment();
    if (!shipment) {
        await showModal({title: "Error", prompt: "Please select or create a shipment first.", inputType: "none", confirmButtonText: "OK"});
        return;
    }
    if (shipment.isArchived) {
         await showModal({title: "Archived Shipment", prompt: `This shipment is archived. Cannot ${isEditMode ? 'edit' : 'add'} SKUs.`, inputType: "none", confirmButtonText: "OK"});
         return;
    }

    let skuToEdit = null;
    let skuToEditIndex = -1;
    if (isEditMode) {
        skuToEdit = getCurrentSku();
        if (!skuToEdit) {
            await showModal({title: "No SKU Selected", prompt: "Please select an SKU to edit.", inputType: "none", confirmButtonText: "OK"});
            return;
        }
        skuToEditIndex = shipment.skus.findIndex(s => s === skuToEdit);
    }

    const modalTitle = isEditMode ? `Edit SKU: ${skuToEdit.code}` : "Add New SKU to Shipment";
    const confirmText = isEditMode ? "Save SKU Changes" : "Add SKU";

    const contentHTML = `
        <div class="form-field">
            <label for="modalSkuCode">SKU Code*</label>
            <input type="text" id="modalSkuCode" class="input-field" value="${isEditMode ? skuToEdit.code : ''}" placeholder="Enter unique SKU identifier">
        </div>
        <div class="form-field">
            <label for="modalSkuTarget">Target Units*</label>
            <input type="number" id="modalSkuTarget" class="input-field" min="0" value="${isEditMode ? (skuToEdit.target || 0) : '0'}" placeholder="e.g., 1000 (0 for no target)">
        </div>
        <div class="form-field">
            <label for="modalSkuCapacities">Pallet Capacities (comma-separated)</label>
            <input type="text" id="modalSkuCapacities" class="input-field" placeholder="e.g., 20,25,30 (optional)" value="${isEditMode && skuToEdit.capacities ? skuToEdit.capacities.join(',') : ''}">
        </div>
        ${isEditMode ? '<p class="modal-info-text">Note: Pallet build info and packed entries for this SKU will be retained unless capacities relevant to entries are removed.</p>' : ''}
    `;

    const result = await showModal({
        title: modalTitle,
        contentHTML: contentHTML,
        confirmButtonText: confirmText,
        actionType: 'addOrEditSkuInShipment',
        skuToEditIndex: isEditMode ? skuToEditIndex : -1
    });

    if (result) {
        const skuCode = result.code;
        const targetUnits = result.target; 
        const capacities = result.capacities || [];

        if (isEditMode && skuToEdit) {
            skuToEdit.code = skuCode;
            skuToEdit.target = targetUnits;
            skuToEdit.capacities = capacities.sort((a,b) => a - b);
        } else {
            const newSku = {
                code: skuCode,
                target: targetUnits,
                capacities: capacities.sort((a,b) => a - b),
                entries: [],
                palletBuildInfo: { text: '', imageUrls: [] }
            };
            shipment.skus.push(newSku);
            shipment.currentSkuIndex = shipment.skus.length - 1;
            appState.lastSkuIndexPerShipment[shipment.id] = shipment.currentSkuIndex;
        }
        saveAppState();
        initPlanAndPackScreen();
    }
}

async function handleDeleteSelectedSkuFromCurrentShipment() {
    const shipment = getCurrentShipment();
    const skuToDelete = getCurrentSku();

    if (!shipment || !skuToDelete) {
        await showModal({ title: "No SKU Selected", prompt: "Please select an SKU to delete.", inputType: "none", confirmButtonText: "OK" });
        return;
    }
    if (shipment.isArchived) {
         await showModal({title: "Archived Shipment", prompt: "This shipment is archived. Cannot delete SKUs.", inputType: "none", confirmButtonText: "OK"});
         return;
    }

    const confirmed = await showModal({
        title: `Delete SKU: ${skuToDelete.code}?`,
        prompt: `All data for SKU "${skuToDelete.code}" will be removed. Type DELETE to confirm.`,
        inputType: "text", placeholder: 'Type DELETE', needsConfirmation: true,
        confirmKeyword: "DELETE", confirmButtonText: "Confirm Delete SKU"
    });

    if (String(confirmed).toUpperCase() === "DELETE") {
        const skuCodeForMessage = skuToDelete.code;
        const skuIndexToDelete = shipment.skus.findIndex(s => s === skuToDelete);
        if (skuIndexToDelete > -1) {
            shipment.skus.splice(skuIndexToDelete, 1);
            if (shipment.currentSkuIndex === skuIndexToDelete) {
                shipment.currentSkuIndex = Math.max(0, skuIndexToDelete - 1);
                if (shipment.skus.length === 0) shipment.currentSkuIndex = -1;
            } else if (shipment.currentSkuIndex > skuIndexToDelete) {
                shipment.currentSkuIndex--;
            }
            appState.lastSkuIndexPerShipment[shipment.id] = shipment.currentSkuIndex;
            saveAppState();
            initPlanAndPackScreen();
            await showModal({ title: "SKU Deleted", prompt: `SKU "${skuCodeForMessage}" removed.`, inputType: "none", confirmButtonText: "OK" });
        }
    }
}

// --- MODIFIED: renderSkuOptionsForCurrentShipment ---
function renderSkuOptionsForCurrentShipment(filterText = '') {
    const shipment = getCurrentShipment();
    const hasShipment = !!shipment;

    if (!skuTabsContainer || !skuSelectElement || !skuSelectEmptyState) {
         if (skuPackingUI) skuPackingUI.classList.add('hidden');
         return;
    }

    skuTabsContainer.innerHTML = ''; skuTabsContainer.classList.add('hidden');
    skuSelectElement.innerHTML = ''; skuSelectElement.classList.add('hidden');
    skuSelectEmptyState.classList.add('hidden');

    const isArchived = hasShipment && shipment.isArchived;
    const currentSku = getCurrentSku(); 

    if(addSkuBtn) addSkuBtn.disabled = !hasShipment || isArchived;
    if(editSelectedSkuBtn) editSelectedSkuBtn.disabled = !hasShipment || isArchived || !currentSku;
    if(deleteSelectedSkuBtn) deleteSelectedSkuBtn.disabled = !hasShipment || isArchived || !currentSku;

    if (!hasShipment || !shipment.skus || shipment.skus.length === 0) {
        skuSelectEmptyState.textContent = hasShipment ? "No SKUs in shipment. Use 'Add SKU'." : "Select or create a shipment first.";
        skuSelectEmptyState.classList.remove('hidden');
        if (skuPackingUI) skuPackingUI.classList.add('hidden');
        updateSkuPackingUI();
        return;
    }

    const normalizedFilter = String(filterText).trim().toLowerCase();
    let skusToDisplay = shipment.skus;
    if (normalizedFilter) {
        skusToDisplay = shipment.skus.filter(s => String(s.code).toLowerCase().includes(normalizedFilter));
    }

    const useTabs = !normalizedFilter && skusToDisplay.length > 0 && skusToDisplay.length <= SKU_TAB_THRESHOLD;
    const useSelect = normalizedFilter || (skusToDisplay.length > 0 && skusToDisplay.length > SKU_TAB_THRESHOLD);

    if (useTabs) {
        skuTabsContainer.classList.remove('hidden');
        skusToDisplay.forEach((sku) => {
            const originalIndex = shipment.skus.findIndex(s => s === sku);
            let totalUnitsPacked = (sku.entries || []).reduce((sum, entry) => sum + (entry.capacityUsed * entry.palletCount), 0);
            const targetUnits = sku.target || 0;
            let percentage = (targetUnits > 0) ? Math.min(100, (totalUnitsPacked / targetUnits) * 100) : (totalUnitsPacked > 0 ? 0 : 0);
            percentage = Math.max(0, percentage);
            
            const tabData = {
                id: sku.code, 
                name: sku.code,
                progress: percentage,
                active: originalIndex === shipment.currentSkuIndex,
                originalIndex: originalIndex
            };
            const tabEl = createGenericTabElement(tabData, 'sku-tab', 'skus'); 
            tabEl.disabled = isArchived; 
            skuTabsContainer.appendChild(tabEl);
        });

        if (shipment.currentSkuIndex === -1 || shipment.currentSkuIndex >= shipment.skus.length) {
            if (skusToDisplay.length > 0) {
                const firstDisplayableSku = skusToDisplay[0];
                const firstValidOriginalIndex = shipment.skus.findIndex(s => s === firstDisplayableSku);
                shipment.currentSkuIndex = firstValidOriginalIndex;
                appState.lastSkuIndexPerShipment[shipment.id] = shipment.currentSkuIndex;
            } else { 
                shipment.currentSkuIndex = -1;
                 appState.lastSkuIndexPerShipment[shipment.id] = -1;
            }
        }
        skuTabsContainer.querySelectorAll('.sku-tab').forEach(t => t.classList.remove('active'));
        if (shipment.currentSkuIndex > -1) {
            const activeTab = skuTabsContainer.querySelector(`.sku-tab[data-original-index="${shipment.currentSkuIndex}"]`);
            if (activeTab) activeTab.classList.add('active');
        }

    } else if (useSelect) {
        skuSelectElement.classList.remove('hidden');
        if (skusToDisplay.length === 0 && normalizedFilter) {
            const opt = document.createElement('option');
            opt.textContent = "No SKUs match search"; opt.disabled = true; opt.selected = true;
            skuSelectElement.appendChild(opt);
            if (skuPackingUI) skuPackingUI.classList.add('hidden');
        } else {
            skusToDisplay.forEach((sku) => {
                const originalIndex = shipment.skus.findIndex(s => s === sku);
                const opt = document.createElement('option');
                opt.value = originalIndex.toString();
                opt.textContent = sku.code;
                if (originalIndex === shipment.currentSkuIndex) opt.selected = true;
                skuSelectElement.appendChild(opt);
            });
            const currentSkuStillInFilteredList = skusToDisplay.some(s_filt => shipment.skus.findIndex(s_orig => s_orig === s_filt) === shipment.currentSkuIndex);
            if (!currentSkuStillInFilteredList && skusToDisplay.length > 0) {
                const firstFilteredOriginalIndex = shipment.skus.findIndex(s => s === skusToDisplay[0]);
                shipment.currentSkuIndex = firstFilteredOriginalIndex;
                skuSelectElement.value = shipment.currentSkuIndex.toString();
                if (hasShipment) appState.lastSkuIndexPerShipment[shipment.id] = shipment.currentSkuIndex;
            } else if (shipment.currentSkuIndex > -1) {
                skuSelectElement.value = shipment.currentSkuIndex.toString();
            } else if (skusToDisplay.length > 0) { 
                const firstOriginalIndex = shipment.skus.findIndex(s => s === skusToDisplay[0]);
                shipment.currentSkuIndex = firstOriginalIndex;
                skuSelectElement.value = shipment.currentSkuIndex.toString();
                if (hasShipment) appState.lastSkuIndexPerShipment[shipment.id] = shipment.currentSkuIndex;
            } else { 
                shipment.currentSkuIndex = -1;
                 if (hasShipment) appState.lastSkuIndexPerShipment[shipment.id] = -1;
            }
        }
        skuSelectElement.disabled = isArchived;
    } else { 
         skuSelectEmptyState.textContent = normalizedFilter ? "No SKUs match search." : "No SKUs found in shipment.";
         skuSelectEmptyState.classList.remove('hidden');
         if (skuPackingUI) skuPackingUI.classList.add('hidden');
    }
    updateSkuPackingUI(); 
}


async function handleSkuSelectionChange() {
    if (!skuSelectElement) return;
    const shipment = getCurrentShipment();
    if (!shipment || !skuSelectElement.value || shipment.skus.length === 0) {
        if(shipment) shipment.currentSkuIndex = -1;
        updateSkuPackingUI(); return;
    }
    const newIndex = parseInt(skuSelectElement.value);
    if(!isNaN(newIndex) && newIndex >=0 && shipment.skus && newIndex < shipment.skus.length) {
        shipment.currentSkuIndex = newIndex;
        appState.lastSkuIndexPerShipment[shipment.id] = newIndex;
        saveAppState();
        updateSkuPackingUI();
    } else { 
        shipment.currentSkuIndex = -1;
        updateSkuPackingUI();
    }
}

async function handleResetSkuData() {
    const sku = getCurrentSku();
    const shipment = getCurrentShipment();
    if (!sku || !shipment) return;
    if (shipment.isArchived) {
        await showModal({title: "Archived Shipment", prompt: "Cannot reset SKU data for archived shipment.", inputType: "none", confirmButtonText: "OK"});
        return;
    }
    if (!shipment.startTime) {
        const setTime = await showModal({title: "Start Time Required", prompt: "Shipment start time must be set to reset SKU data. Set it now?", inputType: "none", confirmButtonText: "Set Start Time", cancelButtonText: "Cancel"});
        if (setTime) handleSetShipmentStartTime();
        return;
    }

    const confirmed = await showModal({
        title: `Reset Data for SKU: ${sku.code}?`,
        prompt: `All packed pallet entries for ${sku.code} will be cleared. Type RESET to confirm.`,
        inputType: "text", placeholder: 'Type RESET', needsConfirmation: true, confirmKeyword: "RESET",
        confirmButtonText: "Confirm Reset"
    });
    if (String(confirmed).toUpperCase() === "RESET") {
        sku.entries = [];
        if (palletCapacityDisplay) palletCapacityDisplay.textContent = "N/A";
        saveAppState();
        initPlanAndPackScreen(); 
    }
}

async function handleUndoSkuEntry() {
    const sku = getCurrentSku();
    const shipment = getCurrentShipment();
    if (!sku || !shipment) return;
    if (shipment.isArchived) {
        await showModal({title: "Archived Shipment", prompt: "Cannot undo entries for archived shipment.", inputType: "none", confirmButtonText: "OK"});
        return;
    }
    if (!shipment.startTime) {
        await showModal({title: "Start Time Required", prompt: "Shipment start time must be set. Please set it first.", inputType: "none", confirmButtonText: "OK"});
        return;
    }
    if (sku && sku.entries && sku.entries.length > 0) {
        sku.entries.pop();
        saveAppState();
        initPlanAndPackScreen(); 
    }
}

function updateSkuPackingUI() {
    const sku = getCurrentSku();
    const shipment = getCurrentShipment();
    const hasShipment = !!shipment;
    const isArchived = shipment ? shipment.isArchived : false;
    const startTimeSet = shipment ? !!shipment.startTime : false;
    const showPackingUI = !!(sku && shipment);
    const packingActionsDisabled = isArchived || !startTimeSet;

    if(skuPackingUI) {
        skuPackingUI.classList.toggle('hidden', !showPackingUI);
        skuPackingUI.classList.toggle('archived-overlay', isArchived && showPackingUI);
    }
    if(packingDisabledOverlay) {
        packingDisabledOverlay.classList.toggle('hidden', !showPackingUI || isArchived || startTimeSet);
    }

    const currentSkuExists = !!sku;
    if (editSelectedSkuBtn) editSelectedSkuBtn.disabled = !currentSkuExists || isArchived;
    if (deleteSelectedSkuBtn) deleteSelectedSkuBtn.disabled = !currentSkuExists || isArchived;
    if(undoEntryBtn) undoEntryBtn.disabled = packingActionsDisabled || !(sku && sku.entries && sku.entries.length > 0);
    if(resetSkuBtn) resetSkuBtn.disabled = packingActionsDisabled || !currentSkuExists;

    const parentCapContainer = palletCapacitiesContainer ? palletCapacitiesContainer.parentNode : null;
    if (parentCapContainer) {
        let buildInfoBtn = parentCapContainer.querySelector('.pallet-build-info-btn');
        if (sku && ( (sku.palletBuildInfo && sku.palletBuildInfo.text) || (sku.palletBuildInfo && sku.palletBuildInfo.imageUrls && sku.palletBuildInfo.imageUrls.length > 0) )) {
            if (!buildInfoBtn) {
                buildInfoBtn = document.createElement('button');
                buildInfoBtn.className = 'btn btn-secondary btn-small btn-icon-text pallet-build-info-btn';
                const capacitiesTitle = parentCapContainer.querySelector('.subsection-title');
                if (capacitiesTitle && capacitiesTitle.nextSibling) capacitiesTitle.parentNode.insertBefore(buildInfoBtn, capacitiesTitle.nextSibling);
                else if (capacitiesTitle) capacitiesTitle.insertAdjacentElement('afterend', buildInfoBtn);
                else parentCapContainer.insertBefore(buildInfoBtn, palletCapacitiesContainer);
            }
            buildInfoBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg> Pallet Build Info`;
            buildInfoBtn.onclick = () => {
                 let buildInfoContent = '';
                 if (sku.palletBuildInfo.text) buildInfoContent += `<p style="white-space: pre-wrap; margin-bottom: ${(sku.palletBuildInfo.imageUrls && sku.palletBuildInfo.imageUrls.length > 0) ? '15px' : '0'};">${sku.palletBuildInfo.text}</p>`;
                 if (sku.palletBuildInfo.imageUrls && sku.palletBuildInfo.imageUrls.length > 0) {
                     buildInfoContent += `<div id="palletBuildInfoModalImagesContainer">`;
                     if (sku.palletBuildInfo.text && sku.palletBuildInfo.imageUrls.length > 0) buildInfoContent += `<hr style="margin-bottom:15px;">`;
                     sku.palletBuildInfo.imageUrls.forEach(url => { buildInfoContent += `<img src="${url}" alt="Pallet Build Image">`; });
                     buildInfoContent += `</div>`;
                 }
                showModal({ title: `Pallet Build: ${sku.code}`, contentHTML: buildInfoContent || '<p>No build information available.</p>', inputType: 'none', confirmButtonText: "OK"});
            };
        } else if (buildInfoBtn) {
            buildInfoBtn.remove();
        }
    }

    if (!showPackingUI || !sku) {
        if(skuCodeDisplay) skuCodeDisplay.textContent = '–';
        if(skuTargetDisplay) skuTargetDisplay.textContent = '0';
        if(skuUnitsLeftDisplay) { skuUnitsLeftDisplay.textContent = '0'; skuUnitsLeftDisplay.classList.remove('attention-value', 'complete-value'); }
        if(skuPalletsUsedDisplay) skuPalletsUsedDisplay.textContent = '0';
        if(skuPalletsLeftDisplay) skuPalletsLeftDisplay.textContent = '–';
        if(palletCapacitiesContainer) palletCapacitiesContainer.innerHTML = '';
        if (palletCapacityDisplay) palletCapacityDisplay.textContent = "N/A";
        if(packingSuggestionText && packingSuggestionText.parentElement) {
            packingSuggestionText.textContent = 'Select an SKU.';
            packingSuggestionText.parentElement.classList.remove('attention-required');
            packingSuggestionText.parentElement.style.borderColor = 'var(--border-secondary)';
        }
        if(palletEntriesLog) palletEntriesLog.innerHTML = '<li class="empty-log">No pallets packed.</li>';
        if(skuProgressBarFill) skuProgressBarFill.style.width = '0%';
        if(skuProgressBarElement) skuProgressBarElement.setAttribute('aria-valuenow', '0');
        if(skuProgressText) skuProgressText.textContent = '0% (0/0)';
        return; 
    }

    let totalUnitsPacked = 0; let totalPalletsUsed = 0;
    (sku.entries || []).forEach(entry => {
        totalUnitsPacked += entry.capacityUsed * entry.palletCount;
        totalPalletsUsed += entry.palletCount;
    });
    const targetUnits = sku.target || 0;
    const unitsLeft = targetUnits - totalUnitsPacked;

    if(skuCodeDisplay) skuCodeDisplay.textContent = sku.code;
    if(skuTargetDisplay) skuTargetDisplay.textContent = targetUnits > 0 ? targetUnits : 'None';
    if(skuUnitsLeftDisplay) {
         skuUnitsLeftDisplay.textContent = targetUnits > 0 ? unitsLeft : 'N/A';
         skuUnitsLeftDisplay.classList.toggle('attention-value', targetUnits > 0 && unitsLeft > 0 && unitsLeft <= (targetUnits * 0.1));
         skuUnitsLeftDisplay.classList.toggle('complete-value', targetUnits > 0 && unitsLeft <= 0);
    }
    if(skuPalletsUsedDisplay) skuPalletsUsedDisplay.textContent = totalPalletsUsed;

    if(skuPalletsLeftDisplay) {
        if (targetUnits > 0 && sku.capacities && sku.capacities.length > 0 && unitsLeft > 0) {
            const positiveCaps = sku.capacities.filter(c => c > 0);
            if (positiveCaps.length > 0) {
                const largestCapacity = Math.max(...positiveCaps);
                skuPalletsLeftDisplay.textContent = Math.ceil(unitsLeft / largestCapacity);
            } else skuPalletsLeftDisplay.textContent = 'N/A (No Caps)';
        } else if (unitsLeft <=0 && targetUnits > 0) skuPalletsLeftDisplay.textContent = '0';
        else skuPalletsLeftDisplay.textContent = 'N/A';
    }

    if (skuProgressBarFill && skuProgressText && skuProgressBarElement) {
        let percentage = (targetUnits > 0) ? (totalUnitsPacked / targetUnits) * 100 : (totalUnitsPacked > 0 ? 0 : 0);
        percentage = Math.max(0, Math.min(100, percentage));
        skuProgressBarFill.style.width = `${percentage}%`;
        skuProgressBarElement.setAttribute('aria-valuenow', percentage.toFixed(2));
        skuProgressBarFill.classList.toggle('progress-bar-fill-complete', percentage >= 99.9 && targetUnits > 0);
        skuProgressText.textContent = targetUnits > 0
            ? `${Math.round(percentage)}% (${totalUnitsPacked}/${targetUnits})`
            : `${totalUnitsPacked} units (No Target)`;
    }

    renderPalletCapacityChips(sku, packingActionsDisabled);
    renderPackingSuggestion(sku, unitsLeft);
    renderPalletEntriesLog(sku.entries || []);
    updateShipmentProgressBar(); 
    updateShipmentHealthMeter(); 

    if (shipment && !shipment.startTime && !shipment.userSetStartTime && sku.entries && sku.entries.length > 0) {
        const firstEntryTimestampThisSku = sku.entries[0].timestamp;
        const isFirstOverallEntry = shipment.skus.every(s => 
            s === sku || 
            !s.entries || s.entries.length === 0 || 
            s.entries[0].timestamp >= firstEntryTimestampThisSku 
        );
        if (isFirstOverallEntry) {
             shipment.startTime = firstEntryTimestampThisSku;
             saveAppState();
             initPlanAndPackScreen(); 
        }
    }
}

async function addPalletCapacityToSku(sku) {
    const shipment = getCurrentShipment();
    if (!sku || !shipment) return;
    if (shipment.isArchived) {
        await showModal({title: "Archived", prompt: "Cannot modify capacities for archived shipment.", inputType: "none", confirmButtonText: "OK"});
        return;
    }

    const capacity = await showModal({
        title: "Add Pallet Capacity", prompt: `Enter capacity (units/pallet) for SKU: ${sku.code}`,
        placeholder: "e.g., 25", inputType: "number", confirmButtonText: "Add Capacity"
    });
    if (capacity === null || capacity === undefined ) return;
    const numCapacity = Number(capacity);

    if (isNaN(numCapacity) || numCapacity <= 0) {
         await showModal({title: "Invalid", prompt: `Capacity must be a positive number.`, inputType: "none", confirmButtonText: "OK"});
         return;
    }
    if (!sku.capacities) sku.capacities = [];
    if (!sku.capacities.includes(numCapacity)) {
        sku.capacities.push(numCapacity);
        sku.capacities.sort((a, b) => a - b);
        saveAppState();
        updateSkuPackingUI(); 
        if (palletCapacityDisplay) palletCapacityDisplay.textContent = numCapacity;
    } else {
        await showModal({title: "Exists", prompt: `Capacity ${numCapacity} already exists.`, inputType: "none", confirmButtonText: "OK"});
        if (palletCapacityDisplay) palletCapacityDisplay.textContent = numCapacity;
    }
}

async function handleCapacityChipClick(sku, capacity) {
    const shipment = getCurrentShipment();
    if (!sku || !shipment || capacity <= 0) return;

    if (shipment.isArchived) {
        await showModal({title: "Archived", prompt: "Cannot pack pallets for archived shipment.", inputType: "none", confirmButtonText: "OK"});
        return;
    }
    if (!shipment.startTime) {
        const setTime = await showModal({title: "Start Time Required", prompt: "Shipment start time must be set to pack. Set it now?", inputType: "none", confirmButtonText: "Set Start Time", cancelButtonText: "Cancel"});
        if (setTime) handleSetShipmentStartTime(); 
        return;
    }

    if (palletCapacityDisplay) palletCapacityDisplay.textContent = capacity;
    let totalUnitsPackedSoFar = (sku.entries || []).reduce((sum, entry) => sum + (entry.capacityUsed * entry.palletCount), 0);
    const skuTarget = sku.target || 0;
    const unitsLeftForSku = skuTarget - totalUnitsPackedSoFar;

    if (skuTarget > 0 && unitsLeftForSku > 0 && unitsLeftForSku < Number(capacity)) {
        const packRemainingInstead = await showModal({
            title: "Target Alert",
            prompt: `Packing ${capacity} units would exceed target. ${unitsLeftForSku} units remain. Pack final ${unitsLeftForSku} units?`,
            inputType: 'none',
            confirmButtonText: `Pack Final ${unitsLeftForSku} Units`,
            cancelButtonText: `Cancel Add Pallet`
        });
        if (packRemainingInstead) handleFinishLastPallet(sku, unitsLeftForSku);
        return;
    }

    if (!sku.entries) sku.entries = [];
    sku.entries.push({ capacityUsed: Number(capacity), palletCount: 1, timestamp: Date.now() });
    saveAppState();
    initPlanAndPackScreen(); 
}

async function handleFinishLastPallet(sku, unitsToPack) {
    const shipment = getCurrentShipment();
    if (!sku || !shipment || unitsToPack <= 0 || shipment.isArchived || !shipment.startTime) return;

    if (!sku.entries) sku.entries = [];
    sku.entries.push({ capacityUsed: Number(unitsToPack), palletCount: 1, timestamp: Date.now() });
    saveAppState();
    initPlanAndPackScreen(); 
    if (palletCapacityDisplay) palletCapacityDisplay.textContent = unitsToPack + " (Final)";
}

function renderPalletCapacityChips(sku, packingIsDisabled) {
    if (!palletCapacitiesContainer) return;
    palletCapacitiesContainer.innerHTML = '';

    if (sku && sku.capacities) {
        sku.capacities.filter(cap => cap > 0 && typeof cap === 'number').forEach(cap => {
            const chip = document.createElement('button');
            chip.className = 'chip'; chip.textContent = String(cap);
            chip.onclick = () => handleCapacityChipClick(sku, cap);
            chip.disabled = packingIsDisabled;
            palletCapacitiesContainer.appendChild(chip);
        });
    }

    const addChip = document.createElement('button');
    addChip.className = 'chip add-capacity-chip';
    addChip.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add`;
    addChip.title = "Add New Pallet Capacity";
    addChip.onclick = () => addPalletCapacityToSku(sku);
    const shipment = getCurrentShipment();
    addChip.disabled = (shipment && shipment.isArchived);
    palletCapacitiesContainer.appendChild(addChip);

    if (sku) {
        let totalUnitsPackedForSku = (sku.entries || []).reduce((sum, entry) => sum + (entry.capacityUsed * entry.palletCount), 0);
        const skuTarget = sku.target || 0;
        const unitsLeftForSku = skuTarget - totalUnitsPackedForSku;
        const validPositiveCaps = sku.capacities ? sku.capacities.filter(c => c > 0 && typeof c === 'number') : [];
        const smallestCapacity = validPositiveCaps.length > 0 ? Math.min(...validPositiveCaps) : Infinity;

        if (skuTarget > 0 && unitsLeftForSku > 0 && (validPositiveCaps.length === 0 || unitsLeftForSku < smallestCapacity)) {
            const finishButton = document.createElement('button');
            finishButton.id = 'finishLastPalletButton';
            finishButton.className = 'chip btn-primary';
            finishButton.textContent = `Pack Final ${unitsLeftForSku}`;
            finishButton.onclick = () => handleFinishLastPallet(sku, unitsLeftForSku);
            finishButton.disabled = packingIsDisabled;
            palletCapacitiesContainer.appendChild(finishButton);
        }
    }
}

function renderPackingSuggestion(sku, unitsLeft) {
    if (!packingSuggestionText || !sku || !packingSuggestionText.parentElement) return;
    const suggestionBox = packingSuggestionText.parentElement;
    const skuTarget = sku.target || 0;

    if (skuTarget > 0 && unitsLeft <= 0) {
        packingSuggestionText.textContent = "All units packed for this SKU!";
        suggestionBox.classList.remove('attention-required');
        suggestionBox.style.borderColor = 'var(--accent-secondary)'; return;
    }
    if (skuTarget === 0) {
         packingSuggestionText.textContent = (sku.entries && sku.entries.length > 0) ? "Units packed. No target set." : "No target set for this SKU.";
         suggestionBox.classList.remove('attention-required');
         suggestionBox.style.borderColor = 'var(--border-secondary)'; return;
    }

    const capacities = sku.capacities ? sku.capacities.filter(c => c > 0 && typeof c === 'number') : [];
    if (capacities.length === 0) {
        packingSuggestionText.textContent = `Add pallet capacities for suggestions. ${unitsLeft} units remaining.`;
        suggestionBox.classList.add('attention-required');
        suggestionBox.style.borderColor = 'var(--accent-warning)'; return;
    }

    suggestionBox.classList.remove('attention-required');
    suggestionBox.style.borderColor = 'var(--border-secondary)';

    const sortedCaps = [...capacities].sort((a, b) => b - a);
    let currentSuggestion = {}; let remainingForSuggestion = unitsLeft;
    let suggestionOutputParts = [];

    for (const cap of sortedCaps) {
        if (remainingForSuggestion >= cap) {
            const numPallets = Math.floor(remainingForSuggestion / cap);
            if (numPallets > 0) {
                currentSuggestion[cap] = (currentSuggestion[cap] || 0) + numPallets;
                remainingForSuggestion -= numPallets * cap;
            }
        }
    }

    for (const cap in currentSuggestion) {
        suggestionOutputParts.push(`${currentSuggestion[cap]} pallet${currentSuggestion[cap] > 1 ? 's' : ''} of ${cap}`);
    }

    let finalSuggestionText = "";
    if (suggestionOutputParts.length > 0) {
        finalSuggestionText = "Use: " + suggestionOutputParts.join(', ');
        if (remainingForSuggestion > 0) finalSuggestionText += `, then 1 pallet with final ${remainingForSuggestion} units.`;
        else finalSuggestionText += ". This completes the SKU.";
    } else if (remainingForSuggestion > 0) {
        if (unitsLeft < Math.min(...sortedCaps)) {
            finalSuggestionText = `Pack 1 pallet with remaining ${unitsLeft} units.`;
            suggestionBox.style.borderColor = 'var(--accent-primary-light)';
        } else {
            finalSuggestionText = `No standard full pallet for ${unitsLeft} units. Consider "Pack Final ${unitsLeft}".`;
        }
    } else finalSuggestionText = `All units packed for this SKU!`;
    packingSuggestionText.textContent = finalSuggestionText;
}

function renderPalletEntriesLog(entries) {
    if (!palletEntriesLog) return;
    palletEntriesLog.innerHTML = '';
    if (!entries || entries.length === 0) {
        const emptyLi = document.createElement('li');
        emptyLi.className = 'empty-log'; emptyLi.textContent = 'No pallet batches logged.';
        palletEntriesLog.appendChild(emptyLi); return;
    }

    [...entries].reverse().forEach((entry) => {
        const batchItem = document.createElement('li'); batchItem.className = 'entry-batch-item';
        const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        batchItem.innerHTML = `
            <div class="entry-batch-summary">
                <div class="info">
                    <span class="main-text">${entry.capacityUsed} units/pallet (x${entry.palletCount} pallet${entry.palletCount > 1 ? 's' : ''})</span>
                    <span class="sub-text">Total: ${entry.capacityUsed * entry.palletCount} units</span>
                </div>
                <div class="actions">
                    <span class="timestamp">Added @ ${time}</span>
                </div>
            </div>`;
        palletEntriesLog.appendChild(batchItem);
    });
    if (palletEntriesLog.parentElement) palletEntriesLog.parentElement.scrollTop = 0;
}