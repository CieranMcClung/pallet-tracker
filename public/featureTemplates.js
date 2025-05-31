// Manage Templates Screen: Logic for creating, editing, deleting, importing/exporting templates via Firestore.

let localContainerTemplatesCache = [];
let currentTemplateBeingCreated = null; 

function listenForTemplateChanges() {
    if (!templatesCollection) {
        console.warn("Templates collection not available. Cannot listen for changes.");
        if (appState.activeScreenId === 'manageTemplatesScreen' && templatesListContainer) {
            templatesListContainer.innerHTML = `<p class="error-message">Template service connection failed. Templates cannot be loaded or saved.</p>`;
            if(noTemplatesState) noTemplatesState.classList.add('hidden');
        }
        return;
    }
    templatesCollection.orderBy("name")
        .onSnapshot(snapshot => {
            localContainerTemplatesCache = [];
            snapshot.forEach(doc => {
                localContainerTemplatesCache.push({ id: doc.id, ...doc.data() });
            });
            if (appState.activeScreenId === 'manageTemplatesScreen') {
                renderTemplatesList();
            }
            console.log("Templates updated from Firestore:", localContainerTemplatesCache.length);
        }, error => {
            console.error("Error fetching templates from Firestore: ", error);
             if (appState.activeScreenId === 'manageTemplatesScreen' && templatesListContainer) {
                templatesListContainer.innerHTML = `<p class="error-message">Could not load templates. Check network. Error: ${error.message}</p>`;
                if(noTemplatesState) noTemplatesState.classList.add('hidden');
            }
        });
}

function initManageTemplatesScreen() {
    renderTemplatesList();
    updateTemplateCreationAvailability(); // Update button visibility based on role
}

function updateTemplateCreationAvailability() {
    const canCreate = canCurrentUserCreateTemplates();
    if (initiateCreateTemplateBtnScreen) {
        initiateCreateTemplateBtnScreen.disabled = !canCreate;
        initiateCreateTemplateBtnScreen.title = canCreate ? "Create new template" : "Template creation restricted (Admin only)";
    }
    if (saveAsTemplateBtn) { // This button is on Plan & Pack screen
        const shipment = getCurrentShipment();
        saveAsTemplateBtn.disabled = !canCreate || !shipment;
        saveAsTemplateBtn.title = canCreate ? "Save shipment as template" : "Template creation restricted (Admin only)";

    }
}


function renderTemplatesList() {
    if (!templatesListContainer || !noTemplatesState) return;
    templatesListContainer.innerHTML = '';
    const canManage = isUserAdmin(); // Only admin can edit/delete templates

    if (localContainerTemplatesCache.length === 0) {
        noTemplatesState.classList.remove('hidden');
        templatesListContainer.classList.add('hidden');
    } else {
        noTemplatesState.classList.add('hidden');
        templatesListContainer.classList.remove('hidden');
        localContainerTemplatesCache.forEach(template => {
            const card = document.createElement('div');
            card.className = 'template-card';
            const skuCount = (template.predefinedSkus || []).length;
            let totalImages = 0;
            (template.predefinedSkus || []).forEach(sku => {
                totalImages += (sku.palletBuildInfo?.imageUrls || []).length;
            });

            card.innerHTML = `
                <div class="template-card-header">
                    <h3>${template.name}</h3>
                    <div class="template-card-actions">
                        <button class="btn btn-primary btn-small btn-icon-text" data-action="use" data-id="${template.id}" title="Use this template">
                            <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Use
                        </button>
                        ${canManage ? `
                        <button class="btn btn-secondary btn-small btn-icon-text" data-action="edit" data-id="${template.id}" title="Edit template">
                            <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit
                        </button>
                        <button class="btn btn-danger btn-small btn-icon-text" data-action="delete" data-id="${template.id}" title="Delete template">
                            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Delete
                        </button>
                        ` : ''}
                    </div>
                </div>
                <p class="template-description">${template.description || 'No description.'}</p>
                <div class="template-meta">
                    <span class="template-sku-count"><strong>${skuCount}</strong> SKU${skuCount === 1 ? '' : 's'}</span>
                    ${totalImages > 0 ? `<span class="template-image-count"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> ${totalImages} image${totalImages === 1 ? '' : 's'}</span>` : ''}
                </div>
            `;
            templatesListContainer.appendChild(card);
        });
        templatesListContainer.querySelectorAll('button[data-action]').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = e.currentTarget.dataset.action;
                const templateId = e.currentTarget.dataset.id;
                const template = localContainerTemplatesCache.find(t => t.id === templateId);
                if (!template) {
                    showModal({title: "Error", prompt: "Template not found.", inputType:"none", confirmButtonText:"OK"});
                    return;
                }
                if (action === 'edit') {
                    if (!isUserAdmin()) {
                        showModal({title: "Permission Denied", prompt: "Only Admins can edit templates.", inputType:"none", confirmButtonText:"OK"});
                        return;
                    }
                    manageTemplate(template);
                }
                else if (action === 'delete') {
                     if (!isUserAdmin()) {
                        showModal({title: "Permission Denied", prompt: "Only Admins can delete templates.", inputType:"none", confirmButtonText:"OK"});
                        return;
                    }
                    deleteTemplateFromFirestore(template);
                }
                else if (action === 'use') createShipmentWithTemplate(template);
            });
        });
    }
}

async function deleteTemplateFromFirestore(template) {
    if (!isUserAdmin()) {
        showModal({title: "Permission Denied", prompt: "Only Admins can delete templates.", inputType:"none", confirmButtonText:"OK"});
        return;
    }
    const confirmed = await showModal({
        title: `Delete Template: ${template.name}?`,
        prompt: `Permanently delete "${template.name}"? Associated images in storage will NOT be auto-deleted. Type template name "${template.name}" to confirm.`,
        inputType: 'text', placeholder: `Type: ${template.name}`, needsConfirmation: true,
        confirmKeyword: template.name, confirmButtonText: "Delete Template Forever"
    });
    if (confirmed === template.name) {
        try {
            await templatesCollection.doc(template.id).delete();
            console.log("Template deleted:", template.id);
            await showModal({title: "Template Deleted", prompt: `"${template.name}" removed.`, inputType: "none", confirmButtonText: "OK"});
        } catch (error) {
            console.error("Error deleting template: ", error);
            await showModal({title: "Error", prompt: `Could not delete. Error: ${error.message}`, inputType: "none", confirmButtonText: "OK"});
        }
    }
}

async function manageTemplate(existingTemplate = null) {
    if (!canCurrentUserCreateTemplates() && !existingTemplate) { // Deny creating new if no permission
        showModal({title: "Permission Denied", prompt: "You do not have permission to create new templates.", inputType:"none", confirmButtonText:"OK"});
        return;
    }
    if (existingTemplate && !isUserAdmin()){ // Deny editing if not admin
        showModal({title: "Permission Denied", prompt: "Only Admins can edit existing templates.", inputType:"none", confirmButtonText:"OK"});
        return;
    }


    currentTemplateBeingCreated = existingTemplate
        ? JSON.parse(JSON.stringify(existingTemplate))
        : { name: '', description: '', predefinedSkus: [] };

    if (!currentTemplateBeingCreated.predefinedSkus) currentTemplateBeingCreated.predefinedSkus = [];
    currentTemplateBeingCreated.predefinedSkus.forEach(sku => {
        sku.palletBuildInfo = sku.palletBuildInfo || { text: '', imageUrls: [] };
        sku.palletBuildInfo.text = sku.palletBuildInfo.text || '';
        sku.palletBuildInfo.imageUrls = sku.palletBuildInfo.imageUrls || [];
        sku.newImageFiles = []; sku.newImageFilePreviews = []; sku.removedImageUrls = [];
    });

    // (Rest of manageTemplate function remains largely the same as previous response,
    // just ensure the initial permission check above is in place)
    let modalHTML = `
        <div class.form-field">
            <label for="tplName">Template Name*</label>
            <input type="text" id="tplName" class="input-field" value="${currentTemplateBeingCreated.name || ''}" placeholder="e.g., Standard Export">
        </div>
        <div class="form-field">
            <label for="tplDesc">Description</label>
            <textarea id="tplDesc" class="input-field" rows="2" placeholder="Brief note...">${currentTemplateBeingCreated.description || ''}</textarea>
        </div>
        <h4 class="subsection-title" style="margin-top:20px; margin-bottom:10px;">SKUs (<span id="templateSkuCountDisplayInternal">0</span>)</h4>
        <div id="templateSkuEditorFormContainer" class="sku-entry-for-template">
            <h5 id="skuEditorFormTitle">Add New SKU</h5>
            <div class="form-field"><label for="tplSkuCode">SKU Code*</label><input type="text" id="tplSkuCode" class="input-field"></div>
            <div class="form-field"><label for="tplSkuTarget">Target Units*</label><input type="number" id="tplSkuTarget" class="input-field" min="0" value="0"></div>
            <div class="form-field"><label for="tplSkuCapacities">Pallet Capacities (comma-sep)</label><input type="text" id="tplSkuCapacities" class="input-field"></div>
            <div class="form-field"><label for="tplSkuBuildInfoText">Build Info/Notes</label><textarea id="tplSkuBuildInfoText" class="input-field" rows="3"></textarea></div>
            <div class="form-field">
                <label>Build Images (Max ${MAX_IMAGES_PER_SKU} total)</label>
                <div class="image-input-controls">
                    <label class="btn btn-secondary btn-small btn-file-upload"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Upload<input type="file" id="tplSkuBuildImagesUpload" multiple accept="image/*"></label>
                    <label class="btn btn-secondary btn-small btn-file-upload"><svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Capture<input type="file" id="tplSkuBuildImagesCapture" accept="image/*" capture="environment"></label>
                </div>
                <div id="tplSkuFormImagePreviews" class="sku-image-previews-container"><small>No new images for this form entry.</small></div>
                <div id="existingImagesForSkuInForm" class="sku-image-previews-container existing-images-preview"><small>No existing images for this SKU.</small></div>
            </div>
            <div style="display:flex; gap:10px; margin-top:15px;">
                <button id="addSkuToTemplateInternalBtn" class="btn btn-primary btn-small">Add SKU to List</button>
                <button id="cancelEditSkuInTemplateInternalBtn" type="button" class="btn btn-secondary btn-small" style="display:none;">Cancel Edit</button>
            </div>
            <input type="hidden" id="editingSkuIndexInternal" value="-1">
        </div>
        <ul id="templateSkusListDisplayInternal" class="compact-list" style="margin-top:16px;"><li class="empty-list-item"><small>No SKUs added yet.</small></li></ul>
    `;
    const modalPromise = showModal({
        title: existingTemplate ? `Edit Template: ${existingTemplate.name}` : "Create New Template",
        contentHTML: modalHTML,
        confirmButtonText: "Save Template <span id='saveSpinner' class='upload-spinner hidden'></span>",
        actionType: 'createOrEditTemplate',
        editIndex: existingTemplate ? existingTemplate.id : null
    });

    requestAnimationFrame(() => {
        renderTemplateSkusListInternal();
        clearSkuFormInTemplateModal(true);
        document.getElementById('addSkuToTemplateInternalBtn').onclick = handleAddOrUpdateSkuInTemplateInternal;
        document.getElementById('cancelEditSkuInTemplateInternalBtn').onclick = () => clearSkuFormInTemplateModal(true);
        document.getElementById('tplSkuBuildImagesUpload').onchange = (e) => handleSkuFormImageSelection(e.target.files, e.target);
        document.getElementById('tplSkuBuildImagesCapture').onchange = (e) => handleSkuFormImageSelection(e.target.files, e.target);
    });

    const result = await modalPromise;
    if (result && result.savedTemplateId) {
        currentTemplateBeingCreated = null; return result.savedTemplateId;
    }
    if (currentTemplateBeingCreated) { 
        currentTemplateBeingCreated.predefinedSkus.forEach(sku => {
            (sku.newImageFilePreviews || []).forEach(p => { if (p.url && p.url.startsWith('blob:')) URL.revokeObjectURL(p.url); });
        });
    }
    currentTemplateBeingCreated = null;
    return null;
}

// ... (handleSkuFormImageSelection, _getSkuFormStagedFiles, renderSkuFormImagePreviews, clearSkuFormInTemplateModal, populateSkuFormInTemplateModal, renderTemplateSkusListInternal, handleAddOrUpdateSkuInTemplateInternal are the same as previous response)

async function handleSaveTemplateConfirm(templateIdToEdit = null) {
     if (!canCurrentUserCreateTemplates() && !templateIdToEdit) { // Deny creating new if no permission
        showModal({title: "Permission Denied", prompt: "You do not have permission to create new templates.", inputType:"none", confirmButtonText:"OK"});
        closeModal({error: "Permission Denied"}); // Close the save modal
        return;
    }
    if (templateIdToEdit && !isUserAdmin()){ // Deny editing if not admin
        showModal({title: "Permission Denied", prompt: "Only Admins can edit existing templates.", inputType:"none", confirmButtonText:"OK"});
        closeModal({error: "Permission Denied"});
        return;
    }

    const name = document.getElementById('tplName').value.trim();
    const description = document.getElementById('tplDesc')?.value.trim() || '';
    const errorEl = modalErrorText; const spinner = modalConfirmBtn?.querySelector('#saveSpinner');
    if (!errorEl || !modalConfirmBtn || !modalCancelBtn || !name || !currentTemplateBeingCreated) return;

    errorEl.classList.add('hidden'); errorEl.textContent = ''; errorEl.classList.remove('saving-in-progress');
    if (!name) { errorEl.textContent = "Template Name required."; errorEl.classList.remove('hidden'); return; }
    if (!currentTemplateBeingCreated.predefinedSkus || currentTemplateBeingCreated.predefinedSkus.length === 0) {
        errorEl.textContent = "Template must have at least one SKU."; errorEl.classList.remove('hidden'); return;
    }

    modalConfirmBtn.disabled = true; modalCancelBtn.disabled = true;
    if(spinner) spinner.classList.remove('hidden');
    errorEl.textContent = "Saving template... Processing images. This may take a moment.";
    errorEl.classList.add('saving-in-progress'); errorEl.classList.remove('hidden');

    try {
        // ... (Image upload logic remains the same as previous response)
        for (const sku of currentTemplateBeingCreated.predefinedSkus) {
            sku.palletBuildInfo = sku.palletBuildInfo || { text: '', imageUrls: [] };
            sku.palletBuildInfo.imageUrls = sku.palletBuildInfo.imageUrls || [];

            if (sku.removedImageUrls?.length > 0) {
                for (const urlToRemove of sku.removedImageUrls) {
                    const idx = sku.palletBuildInfo.imageUrls.indexOf(urlToRemove);
                    if (idx > -1) sku.palletBuildInfo.imageUrls.splice(idx, 1);
                    try {
                        if (urlToRemove.includes('firebasestorage.googleapis.com')) await storage.refFromURL(urlToRemove).delete();
                    } catch (storageError) { console.warn("Could not delete from storage:", urlToRemove, storageError); }
                }
            }
            if (sku.newImageFiles?.length > 0) {
                const uploadPromises = sku.newImageFiles.map(file => {
                    const imageName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
                    const tplId = templateIdToEdit || `newTpl_${Date.now()}`;
                    const skuCodeId = sku.code.replace(/[^a-zA-Z0-9]/g, '_');
                    const imagePath = `palletBuildImages/templates/${tplId}/${skuCodeId}/${imageName}`;
                    return storage.ref(imagePath).put(file).then(snap => snap.ref.getDownloadURL());
                });
                const newImageUrls = await Promise.all(uploadPromises);
                sku.palletBuildInfo.imageUrls.push(...newImageUrls);
            }
            delete sku.newImageFiles; delete sku.newImageFilePreviews; delete sku.removedImageUrls;
        }


        const templateDataToSave = {
            name, description,
            predefinedSkus: currentTemplateBeingCreated.predefinedSkus.map(sku => ({
                code: sku.code, target: sku.target, capacities: sku.capacities || [],
                palletBuildInfo: { text: sku.palletBuildInfo.text || '', imageUrls: sku.palletBuildInfo.imageUrls || [] }
            }))
        };
        // Add creator info
        if (appState.currentUser) {
            templateDataToSave.createdBy = { uid: appState.currentUser.uid, name: appState.currentUser.displayName || appState.currentUser.email };
        } else {
            templateDataToSave.createdBy = { uid: 'anonymous', name: 'Anonymous' };
        }
        templateDataToSave.lastUpdatedBy = templateDataToSave.createdBy;
        templateDataToSave.createdAt = templateIdToEdit ? (currentTemplateBeingCreated.createdAt || firebase.firestore.FieldValue.serverTimestamp()) : firebase.firestore.FieldValue.serverTimestamp();
        templateDataToSave.updatedAt = firebase.firestore.FieldValue.serverTimestamp();


        let savedTemplateId = templateIdToEdit;
        if (templateIdToEdit) await templatesCollection.doc(templateIdToEdit).set(templateDataToSave, {merge: true}); // Use merge to be safe with existing fields
        else { const docRef = await templatesCollection.add(templateDataToSave); savedTemplateId = docRef.id; }
        
        closeModal({ savedTemplateId });
    } catch (error) {
        console.error("Error saving template: ", error);
        errorEl.classList.remove('saving-in-progress');
        errorEl.textContent = "Error saving: " + error.message;
        modalConfirmBtn.disabled = false; modalCancelBtn.disabled = false;
        if(spinner) spinner.classList.add('hidden');
    }
}

// (handleExportTemplates and handleImportTemplates are the same as previous response)
// Make sure import only works for admin
async function handleImportTemplates() {
    if (!isUserAdmin()) {
        showModal({title: "Permission Denied", prompt: "Only Admins can import templates.", inputType: "none", confirmButtonText: "OK"});
        return;
    }
    // ... rest of the function
    const fileInput = document.createElement('input'); fileInput.type = 'file'; fileInput.accept = '.json';
    fileInput.onchange = async (event) => {
        const file = event.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (!Array.isArray(importedData) || !importedData.every(tpl => isValidTemplate(tpl, true))) { // isValidTemplate might need adjustment for createdBy fields if strict
                    await showModal({title: "Import Error", prompt: "Invalid template file format/content.", inputType: "none", confirmButtonText: "OK"}); return;
                }
                const choiceHTML = `
                    <p>Found ${importedData.length} template(s). How to import?</p>
                    <div class="form-field"><label class="radio-label"><input type="radio" name="importChoice" value="replace"> <strong>Replace All:</strong> Deletes ALL current templates first. (DANGEROUS)</label></div>
                    <div class="form-field"><label class="radio-label"><input type="radio" name="importChoice" value="merge" checked> <strong>Add as New:</strong> Adds all as new entries. (Recommended)</label></div>`;
                const importChoice = await showModal({
                    title: `Import Templates`, contentHTML: choiceHTML,
                    confirmButtonText: "Proceed", cancelButtonText: "Cancel Import",
                    actionType: 'importTemplatesChoice'
                });
                if (!importChoice) return;

                showModal({ title: "Importing...", prompt: "Processing, please wait...", inputType: "none", confirmButtonText: "", cancelButtonText: "" });
                if (modalConfirmBtn) modalConfirmBtn.style.display = 'none';
                if (modalCancelBtn) modalCancelBtn.style.display = 'none';

                const batch = db.batch(); let operationSummary = "";
                const defaultCreator = appState.currentUser ? { uid: appState.currentUser.uid, name: appState.currentUser.displayName || appState.currentUser.email } : { uid: 'imported_admin', name: 'Imported by Admin' };

                if (importChoice === 'replace') {
                    const confirmReplace = await showModal({
                        title: "ARE YOU SURE?", prompt: 'This DELETES ALL existing templates. Type REPLACEALL to confirm.',
                        inputType: "text", needsConfirmation: true, confirmKeyword: "REPLACEALL", confirmButtonText: "Confirm Mass Delete & Import"
                    });
                    if (String(confirmReplace).toUpperCase() !== "REPLACEALL") {
                         closeModal(); await showModal({title:"Cancelled", prompt:"Replace operation cancelled.", inputType:"none", confirmButtonText:"OK"}); return;
                    }
                    const snapshot = await templatesCollection.get();
                    snapshot.docs.forEach(doc => batch.delete(doc.ref));
                    
                    importedData.forEach(tpl => {
                        const tplToSave = {...tpl};
                        if (!tplToSave.createdBy) tplToSave.createdBy = defaultCreator;
                        if (!tplToSave.lastUpdatedBy) tplToSave.lastUpdatedBy = defaultCreator;
                        if (!tplToSave.createdAt) tplToSave.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                        tplToSave.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
                        batch.set(templatesCollection.doc(), tplToSave);
                    });
                    operationSummary = `All existing templates deleted. ${importedData.length} new imported.`;
                } else if (importChoice === 'merge') {
                     importedData.forEach(tpl => {
                        const tplToSave = {...tpl};
                        if (!tplToSave.createdBy) tplToSave.createdBy = defaultCreator;
                        if (!tplToSave.lastUpdatedBy) tplToSave.lastUpdatedBy = defaultCreator;
                        if (!tplToSave.createdAt) tplToSave.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                        tplToSave.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
                        batch.set(templatesCollection.doc(), tplToSave);
                    });
                    operationSummary = `${importedData.length} templates added as new.`;
                }
                await batch.commit(); closeModal();
                await showModal({title: "Import Successful", prompt: operationSummary, inputType:"none", confirmButtonText:"OK"});
            } catch (error) {
                console.error("Error importing templates:", error); closeModal();
                await showModal({title: "Import Failed", prompt: `Error: ${error.message}`, inputType: "none", confirmButtonText: "OK"});
            }
        };
        reader.readAsText(file);
    };
    document.body.appendChild(fileInput); fileInput.click(); document.body.removeChild(fileInput);
}


// Function to handle saving shipment as template, now with permission check
async function handleSaveShipmentAsTemplate() {
    if (!canCurrentUserCreateTemplates()) {
        await showModal({ title: "Permission Denied", prompt: "You do not have permission to create templates from shipments.", inputType: 'none', confirmButtonText: "OK" });
        return;
    }
    // ... (rest of the existing logic for handleSaveShipmentAsTemplate)
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
        predefinedSkus: templateSKUs,
        createdBy: appState.currentUser ? { uid: appState.currentUser.uid, name: appState.currentUser.displayName || appState.currentUser.email } : { uid: 'unknown', name: 'Unknown' },
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    templateData.lastUpdatedBy = templateData.createdBy;


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

// (handleSkuFormImageSelection, _getSkuFormStagedFiles, renderSkuFormImagePreviews, clearSkuFormInTemplateModal, populateSkuFormInTemplateModal, renderTemplateSkusListInternal, handleAddOrUpdateSkuInTemplateInternal remain the same)