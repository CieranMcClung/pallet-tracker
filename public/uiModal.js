let modalResolve;

function showModal({ title, prompt = '', placeholder = '', inputType = 'text', inputValue = '', needsConfirmation = false, confirmKeyword = '', confirmButtonText = "Confirm", cancelButtonText = "Cancel", contentHTML = '', actionType = 'generic', currentValues = {}, skuToEditIndex = -1 }) {
    return new Promise(async resolve => {
        if (!modalOverlay || !modalTitleText || !modalPromptText || !modalInput || !modalErrorText || !modalConfirmBtn || !modalCustomContent || !modalCancelBtn) {
            console.error("Modal elements not found."); resolve(null); return;
        }
        modalTitleText.textContent = title;
        if (contentHTML) {
            modalCustomContent.innerHTML = contentHTML; modalCustomContent.classList.remove('hidden');
            modalPromptText.classList.add('hidden'); modalInput.classList.add('hidden');
        } else {
            modalCustomContent.innerHTML = ''; modalCustomContent.classList.add('hidden');
            modalPromptText.textContent = prompt; modalPromptText.classList.toggle('hidden', !prompt);
            modalInput.type = inputType; modalInput.placeholder = placeholder; modalInput.value = inputValue;
            modalInput.classList.toggle('hidden', inputType === 'none');
            if (inputType !== 'none' && !contentHTML) requestAnimationFrame(() => { modalInput.focus(); modalInput.select(); });
        }
        modalErrorText.textContent = ''; modalErrorText.classList.add('hidden');
        modalErrorText.classList.remove('saving-in-progress');

        modalConfirmBtn.innerHTML = confirmButtonText; 
        modalCancelBtn.textContent = cancelButtonText;
        modalCancelBtn.style.display = cancelButtonText ? 'inline-flex' : 'none';
        modalConfirmBtn.disabled = false; modalCancelBtn.disabled = false;

        modalOverlay.classList.remove('hidden');
        modalResolve = { resolve, needsConfirmation, confirmKeyword, inputType, actionType, currentValues, skuToEditIndex, title };
    });
}

function closeModal(value) {
    if (typeof currentTemplateBeingCreated !== 'undefined' && currentTemplateBeingCreated?.predefinedSkus) {
        currentTemplateBeingCreated.predefinedSkus.forEach(sku => {
            (sku.newImageFilePreviews || []).forEach(p => { if (p.url?.startsWith('blob:')) URL.revokeObjectURL(p.url); });
        });
    }
    const form = document.getElementById('templateSkuEditorFormContainer');
    if (form?._stagedFiles?.files) {
        form._stagedFiles.files.forEach(imgData => { if (imgData.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(imgData.previewUrl); });
        form._stagedFiles.files = [];
    }

    if(modalOverlay) modalOverlay.classList.add('hidden');
    if (modalResolve?.resolve) modalResolve.resolve(value);
    modalResolve = null;

    if (modalCustomContent) modalCustomContent.innerHTML = '';
    if (modalInput) modalInput.value = '';
    if (modalErrorText) { modalErrorText.textContent = ''; modalErrorText.classList.add('hidden'); modalErrorText.classList.remove('saving-in-progress'); }
    if (modalConfirmBtn) modalConfirmBtn.disabled = false; if (modalCancelBtn) modalCancelBtn.disabled = false;
}

function handleModalConfirm() {
    if (!modalResolve || !modalResolve.resolve || !modalInput || !modalErrorText || !modalTitleText) {
        console.error("Modal confirmation error: essential elements missing."); return;
    }
    const { resolve, needsConfirmation, confirmKeyword, inputType, actionType, currentValues, skuToEditIndex, title: modalOriginalTitle } = modalResolve;
    let value = modalCustomContent?.innerHTML && !modalCustomContent.classList.contains('hidden') ? true : (modalInput && !modalInput.classList.contains('hidden') ? modalInput.value.trim() : true);
    
    modalErrorText.textContent = ''; modalErrorText.classList.add('hidden'); modalErrorText.classList.remove('saving-in-progress');

    if (actionType === 'createOrEditTemplate') { handleSaveTemplateConfirm(modalResolve.editIndex); return; }
    // For the new task modal, the logic to extract values and save is in tasks.js (openTaskModal)
    // So, if actionType is 'genericTaskModal', we just resolve true, and tasks.js handles the rest.
    if (actionType === 'genericTaskModal') {
        // Validation might still happen here, or passed to a callback in tasks.js
        // For now, assuming validation and data extraction happens in tasks.js after this resolves.
        closeModal(true); // Resolve with true to indicate confirmation
        return;
    }
    if (actionType === 'selectTemplateForShipment') {
        const templateSelect = document.getElementById('templateSelectForShipmentModal');
        if (templateSelect?.value && templateSelect.value !== "-1") {
            const selectedTemplate = localContainerTemplatesCache.find(t => t.id === templateSelect.value);
            if (selectedTemplate) closeModal({ type: 'useSelected', template: selectedTemplate });
            else { modalErrorText.textContent = "Selected template not found."; modalErrorText.classList.remove('hidden'); }
        } else { modalErrorText.textContent = "Please select a template."; modalErrorText.classList.remove('hidden'); }
        return;
    }
    if (actionType === 'importTemplatesChoice') {
        const choice = document.querySelector('input[name="importChoice"]:checked');
        if (choice) closeModal(choice.value);
        else { modalErrorText.textContent = "Please select an import option."; modalErrorText.classList.remove('hidden'); }
        return;
    }
    if (actionType === 'editShipmentDetails') {
        const name = document.getElementById('modalShipmentName')?.value.trim();
        if (!name) { modalErrorText.textContent = "Shipment name cannot be empty."; modalErrorText.classList.remove('hidden'); return; }
        closeModal({ name, forkliftDriver: document.getElementById('modalForkliftDriver')?.value.trim() || '', loaderName: document.getElementById('modalLoaderName')?.value.trim() || '' });
        return;
    }
    if (actionType === 'addOrEditSkuInShipment') {
        const code = document.getElementById('modalSkuCode')?.value.trim();
        const targetStr = document.getElementById('modalSkuTarget')?.value;
        const capacitiesStr = document.getElementById('modalSkuCapacities')?.value.trim();
        if (!code) { modalErrorText.textContent = "SKU Code cannot be empty."; modalErrorText.classList.remove('hidden'); return; }
        const target = parseInt(targetStr);
        if (isNaN(target) || target < 0) { modalErrorText.textContent = "Target Units must be a non-negative number."; modalErrorText.classList.remove('hidden'); return; }
        let capacities = [];
        if (capacitiesStr) {
            capacities = capacitiesStr.split(',').map(c => parseInt(c.trim())).filter(c => !isNaN(c) && c > 0).sort((a,b) => a - b);
            if (capacities.length !== capacitiesStr.split(',').filter(Boolean).length) { modalErrorText.textContent = "Invalid capacities. Positive numbers, comma-separated."; modalErrorText.classList.remove('hidden'); return; }
        }
        const shipment = getCurrentShipment();
        if (shipment?.skus.some((s, i) => i !== skuToEditIndex && s.code.toLowerCase() === code.toLowerCase())) {
            modalErrorText.textContent = `SKU "${code}" already exists.`; modalErrorText.classList.remove('hidden'); return;
        }
        closeModal({ code, target, capacities }); return;
    }

    if (needsConfirmation) {
        const enteredValue = (modalInput && !modalInput.classList.contains('hidden')) ? modalInput.value : String(value);
        if (String(enteredValue).toUpperCase() !== String(confirmKeyword).toUpperCase()) {
            modalErrorText.textContent = `Confirmation failed. Type "${confirmKeyword}" to proceed.`; modalErrorText.classList.remove('hidden'); return;
        }
        value = (modalInput && !modalInput.classList.contains('hidden')) ? modalInput.value.trim() : confirmKeyword;
    }

    if (modalInput && !modalInput.classList.contains('hidden')) {
        if (inputType === 'number') {
            const num = parseFloat(value);
            if (value === '' || isNaN(num)) { modalErrorText.textContent = 'Enter a valid number.'; modalErrorText.classList.remove('hidden'); return; }
            if (num <= 0 && (modalOriginalTitle.includes("Target") || modalOriginalTitle.includes("Capacity") || modalOriginalTitle.includes("pallets"))) {
                 modalErrorText.textContent = "Value must be > 0."; modalErrorText.classList.remove('hidden'); return;
            }
            value = num;
        } else if (inputType === 'text' && value === '' && (modalOriginalTitle.includes("Name") || modalOriginalTitle.includes("Code"))) {
            modalErrorText.textContent = "Field cannot be empty."; modalErrorText.classList.remove('hidden'); return;
        }
    }
    closeModal(value);
}