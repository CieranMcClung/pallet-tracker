document.addEventListener('DOMContentLoaded', () => {
    // --- App Constants ---
    const APP_STATE_KEY = 'palletTrackerAppState_v4.3'; // Key for storing app state in localStorage
    const THEME_KEY = 'palletTrackerTheme';             // Key for storing theme preference
    const DARK_THEME_CLASS = 'dark-theme';              // CSS class for dark theme
    const DEFAULT_TEMPLATES_URL = './pallet_tracker_templates.json'; // URL for default templates

    // --- Initial State ---
    let appState = {
        shipments: [],
        currentShipmentIndex: -1,
        containerTemplates: [], 
        quickCountValue: 0,
        activeScreenId: 'planAndPackScreen',
        lastSkuIndexPerShipment: {}
    };
    let currentTemplateBeingCreated = null; 

    // --- DOM Element References ---
    const navToggleBtn = document.getElementById('navToggleBtn');
    const sideNav = document.getElementById('sideNav');
    const navOverlay = document.getElementById('navOverlay');
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const navItems = document.querySelectorAll('.nav-item');
    const appTitleText = document.getElementById('appTitle');
    const planAndPackScreen = document.getElementById('planAndPackScreen');
    const quickCountScreen = document.getElementById('quickCountScreen');
    const manageTemplatesScreen = document.getElementById('manageTemplatesScreen');
    const screens = { planAndPackScreen, quickCountScreen, manageTemplatesScreen };
    const shipmentSelect = document.getElementById('shipmentSelect');
    const newShipmentBtn = document.getElementById('newShipmentBtn');
    const createFromTemplateBtn = document.getElementById('createFromTemplateBtn');
    const deleteShipmentBtn = document.getElementById('deleteShipmentBtn');
    const skuSearchInput = document.getElementById('skuSearchInput');
    const skuSelect = document.getElementById('skuSelect');
    const addSkuBtn = document.getElementById('addSkuBtn');
    const shipmentEmptyState = document.getElementById('shipmentEmptyState');
    const skuSelectEmptyState = document.getElementById('skuSelectEmptyState');
    const skuPackingUI = document.getElementById('skuPackingUI');
    const skuCodeDisplay = document.getElementById('codeDisplay');
    const skuTargetDisplay = document.getElementById('totalDisplay');
    const skuUnitsLeftDisplay = document.getElementById('leftDisplay');
    const skuPalletsUsedDisplay = document.getElementById('palletsDisplay');
    const skuPalletsLeftDisplay = document.getElementById('palletsLeftDisplay');
    const palletCapacitiesContainer = document.getElementById('palletCapacitiesContainer');
    const packingSuggestionText = document.getElementById('suggestionText');
    const undoEntryBtn = document.getElementById('undoEntryBtn');
    const resetSkuBtn = document.getElementById('resetSkuBtn');
    const palletEntriesLog = document.getElementById('entriesLog');
    const skuProgressBarElement = document.querySelector('#skuPackingUI .progress-bar');
    const skuProgressText = document.getElementById('skuProgressText');
    const skuProgressBarFill = document.getElementById('skuProgressBarFill');
    const shipmentProgressContainer = document.getElementById('shipmentProgressContainer');
    const shipmentProgressBarElement = document.querySelector('#shipmentProgressContainer .progress-bar');
    const shipmentNameForProgress = document.getElementById('shipmentNameForProgress');
    const shipmentProgressText = document.getElementById('shipmentProgressText');
    const shipmentProgressBarFill = document.getElementById('shipmentProgressBarFill');
    const quickCountDisplay = document.getElementById('quickCountDisplay');
    const recordQuickCountBtn = document.getElementById('recordQuickCountBtn');
    const undoQuickCountBtn = document.getElementById('undoQuickCountBtn');
    const resetQuickCountBtn = document.getElementById('resetQuickCountBtn');
    const modalOverlay = document.getElementById('modalOverlay');
    const modalDialog = document.getElementById('modalDialog');
    const modalTitleText = document.getElementById('modalTitleText');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const modalPromptText = document.getElementById('modalPrompt');
    const modalInput = document.getElementById('modalInput');
    const modalCustomContent = document.getElementById('modalCustomContent');
    const modalErrorText = document.getElementById('modalError');
    const modalCancelBtn = document.getElementById('modalCancelBtn');
    const modalConfirmBtn = document.getElementById('modalConfirmBtn');
    let modalResolve;
    const networkStatusIndicator = document.getElementById('networkStatusIndicator');
    const initiateCreateTemplateBtnScreen = document.getElementById('initiateCreateTemplateBtnScreen');
    const templatesListContainer = document.getElementById('templatesListContainer');
    const noTemplatesState = document.getElementById('noTemplatesState');
    const importTemplatesBtn = document.getElementById('importTemplatesBtn');
    const exportTemplatesBtn = document.getElementById('exportTemplatesBtn');

    // --- Initialization ---
    async function initializeApp() {
        await loadAppState(); // Ensure app state (including templates) is loaded before setting up UI
        loadTheme();
        setupEventListeners();
        navigateToScreen(appState.activeScreenId || 'planAndPackScreen', true);
        updateNetworkStatus();
    }
    initializeApp();


    // --- App State Management ---

    /**
     * Loads the application state from localStorage.
     * If no state is found, or if templates are missing, it attempts to load defaults from a JSON file.
     */
    async function loadAppState() {
        const storedState = localStorage.getItem(APP_STATE_KEY);
        let stateNeedsSavingAfterLoad = false;

        if (storedState) {
            try {
                const parsedState = JSON.parse(storedState);
                appState = {
                    shipments: parsedState.shipments || [],
                    currentShipmentIndex: (typeof parsedState.currentShipmentIndex === 'number' && parsedState.currentShipmentIndex < (parsedState.shipments || []).length) ? parsedState.currentShipmentIndex : -1,
                    containerTemplates: parsedState.containerTemplates || [],
                    quickCountValue: parsedState.quickCountValue || 0,
                    activeScreenId: parsedState.activeScreenId || 'planAndPackScreen',
                    lastSkuIndexPerShipment: parsedState.lastSkuIndexPerShipment || {}
                };
                appState.containerTemplates.forEach(t => { if (!t.id) t.id = `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`; });
                
                if (appState.currentShipmentIndex >= appState.shipments.length) {
                    appState.currentShipmentIndex = appState.shipments.length > 0 ? 0 : -1;
                }
            } catch (e) {
                console.error("Error loading app state from localStorage:", e);
                appState = { shipments: [], currentShipmentIndex: -1, containerTemplates: [], quickCountValue: 0, activeScreenId: 'planAndPackScreen', lastSkuIndexPerShipment: {} };
            }
        }
        
        // If no templates were loaded from storage, try fetching default templates.
        if (!appState.containerTemplates || appState.containerTemplates.length === 0) {
            try {
                const response = await fetch(DEFAULT_TEMPLATES_URL);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const defaultTemplates = await response.json();
                if (Array.isArray(defaultTemplates) && defaultTemplates.every(isValidTemplate)) {
                    appState.containerTemplates = defaultTemplates;
                    stateNeedsSavingAfterLoad = true; // Save defaults to localStorage
                    console.log("Default templates loaded from JSON file.");
                } else {
                    console.warn("Default templates file is not a valid template array.");
                }
            } catch (error) {
                console.error("Could not load default templates:", error);
                // Proceed with empty templates if defaults can't be loaded.
                appState.containerTemplates = []; 
            }
        }

        if (appState.shipments.length > 0 && appState.currentShipmentIndex === -1) {
            appState.currentShipmentIndex = 0;
        }

        if (stateNeedsSavingAfterLoad) {
            saveAppState(); // Persist the newly loaded default templates
        }
    }

    /**
     * Saves the current application state to localStorage.
     */
    const saveAppState = () => {
        try {
            const stateString = JSON.stringify(appState);
            if (stateString.length < 5 * 1024 * 1024) { 
                 requestIdleCallback(() => localStorage.setItem(APP_STATE_KEY, stateString));
            } else {
                console.warn("App state too large to save.");
            }
        } catch (e) {
            console.error("Error saving app state:", e);
        }
    };

    // --- Event Listeners ---
    function setupEventListeners() {
        if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);
        if (navToggleBtn) navToggleBtn.addEventListener('click', toggleSideNav);
        if (navOverlay) navOverlay.addEventListener('click', closeSideNav);
        navItems.forEach(item => item.addEventListener('click', handleNavClick));
        window.addEventListener('online', updateNetworkStatus);
        window.addEventListener('offline', updateNetworkStatus);
        if (modalCloseBtn) modalCloseBtn.addEventListener('click', () => closeModal(null));
        if (modalCancelBtn) modalCancelBtn.addEventListener('click', () => closeModal(null)); 
        if (modalConfirmBtn) modalConfirmBtn.addEventListener('click', handleModalConfirm); 
        if (modalOverlay) modalOverlay.addEventListener('click', (e) => { if(e.target === modalOverlay) closeModal(null); });
        window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modalOverlay && !modalOverlay.classList.contains('hidden')) closeModal(null); });
        if (shipmentSelect) shipmentSelect.addEventListener('change', handleShipmentSelectionChange);
        if (newShipmentBtn) newShipmentBtn.addEventListener('click', handleNewShipment);
        if (createFromTemplateBtn) createFromTemplateBtn.addEventListener('click', handleCreateShipmentFromTemplate);
        if (deleteShipmentBtn) deleteShipmentBtn.addEventListener('click', handleDeleteCurrentShipment);
        if (skuSearchInput) skuSearchInput.addEventListener('input', () => renderSkuOptionsForCurrentShipment(skuSearchInput.value));
        if (skuSelect) skuSelect.addEventListener('change', handleSkuSelectionChange);
        if (addSkuBtn) addSkuBtn.addEventListener('click', handleAddSkuToCurrentShipment);
        if (undoEntryBtn) undoEntryBtn.addEventListener('click', handleUndoSkuEntry);
        if (resetSkuBtn) resetSkuBtn.addEventListener('click', handleResetSkuData);
        if (recordQuickCountBtn) recordQuickCountBtn.addEventListener('click', incrementQuickCount);
        if (undoQuickCountBtn) undoQuickCountBtn.addEventListener('click', decrementQuickCount);
        if (resetQuickCountBtn) resetQuickCountBtn.addEventListener('click', confirmResetQuickCount);
        if (initiateCreateTemplateBtnScreen) initiateCreateTemplateBtnScreen.addEventListener('click', () => manageTemplate());
        if (importTemplatesBtn) importTemplatesBtn.addEventListener('click', handleImportTemplates);
        if (exportTemplatesBtn) exportTemplatesBtn.addEventListener('click', handleExportTemplates);
    }

    // --- Theme ---
    function loadTheme() { if (localStorage.getItem(THEME_KEY) === DARK_THEME_CLASS) document.body.classList.add(DARK_THEME_CLASS); }
    function toggleTheme() { document.body.classList.toggle(DARK_THEME_CLASS); localStorage.setItem(THEME_KEY, document.body.classList.contains(DARK_THEME_CLASS) ? DARK_THEME_CLASS : ''); }

    // --- Navigation ---
    function toggleSideNav() { if(!sideNav || !navToggleBtn || !navOverlay) return; const isOpen = sideNav.classList.toggle('open'); navToggleBtn.setAttribute('aria-expanded', isOpen.toString()); navOverlay.classList.toggle('active', isOpen); }
    function closeSideNav() { if(!sideNav || !navToggleBtn || !navOverlay) return; sideNav.classList.remove('open'); navToggleBtn.setAttribute('aria-expanded', 'false'); navOverlay.classList.remove('active'); }
    function handleNavClick(event) { const targetScreenId = event.currentTarget.dataset.screen; if (targetScreenId && targetScreenId !== appState.activeScreenId) navigateToScreen(targetScreenId); closeSideNav(); }
    
    async function navigateToScreen(screenId, isInitialNav = false) {
        appState.activeScreenId = screenId;
        if (!isInitialNav) saveAppState();
        Object.values(screens).forEach(s => { if(s) s.classList.remove('active-screen'); });
        const targetScreen = screens[screenId] || screens.planAndPackScreen;
        targetScreen.classList.add('active-screen');
        if (!screens[screenId]) {
             console.warn(`Screen with ID "${screenId}" not found. Defaulting to Plan & Pack.`);
             appState.activeScreenId = 'planAndPackScreen';
        }
        navItems.forEach(item => item.classList.toggle('active', item.dataset.screen === appState.activeScreenId));
        let title = "Pallet Tracker";
        const activeNavItem = document.querySelector(`.nav-item[data-screen="${appState.activeScreenId}"]`);
        if (activeNavItem) {
            title = activeNavItem.textContent.trim();
        }
        if (appTitleText) appTitleText.textContent = title;
        if (appState.activeScreenId === 'planAndPackScreen') initPlanAndPackScreen();
        if (appState.activeScreenId === 'quickCountScreen') updateQuickCountUIDisplay();
        if (appState.activeScreenId === 'manageTemplatesScreen') initManageTemplatesScreen();
    }
    
    // --- Network Status ---
    function updateNetworkStatus() { if (!networkStatusIndicator) return; const online = navigator.onLine; networkStatusIndicator.textContent = online ? 'Online' : 'Offline'; networkStatusIndicator.classList.toggle('online', online); networkStatusIndicator.classList.toggle('offline', !online); }

    // --- Modal ---
    function showModal({ title, prompt = '', placeholder = '', inputType = 'text', inputValue = '', needsConfirmation = false, confirmKeyword = '', confirmButtonText = "Confirm", cancelButtonText = "Cancel", contentHTML = '', actionType = 'generic' }) {
        return new Promise(async resolve => {
            if (!modalOverlay || !modalTitleText || !modalPromptText || !modalInput || !modalErrorText || !modalConfirmBtn || !modalCustomContent) {
                console.error("Modal elements not found."); resolve(null); return;
            }
            modalTitleText.textContent = title;
            if (contentHTML) {
                modalCustomContent.innerHTML = contentHTML;
                modalCustomContent.classList.remove('hidden');
                modalPromptText.classList.add('hidden');
                modalInput.classList.add('hidden');
            } else {
                modalCustomContent.innerHTML = '';
                modalCustomContent.classList.add('hidden');
                modalPromptText.textContent = prompt;
                modalPromptText.classList.toggle('hidden', !prompt);
                modalInput.type = inputType;
                modalInput.placeholder = placeholder;
                modalInput.value = inputValue;
                modalInput.classList.toggle('hidden', inputType === 'none');
                if (inputType !== 'none' && !contentHTML) requestAnimationFrame(() => modalInput.focus());
            }
            modalErrorText.textContent = '';
            modalErrorText.classList.add('hidden');
            modalConfirmBtn.textContent = confirmButtonText;
            modalCancelBtn.textContent = cancelButtonText;
            modalOverlay.classList.remove('hidden');
            modalResolve = { resolve, needsConfirmation, confirmKeyword, inputType, actionType };
        });
    }
    function closeModal(value) { 
        if(modalOverlay) modalOverlay.classList.add('hidden'); 
        if (modalResolve && typeof modalResolve.resolve === 'function') { modalResolve.resolve(value); } 
        modalResolve = null; 
        if (modalCustomContent) modalCustomContent.innerHTML = '';
        if (modalInput) modalInput.value = '';
        if (modalErrorText) modalErrorText.textContent = '';
    }
    function handleModalConfirm() {
        if (!modalResolve) return;
        const { resolve, needsConfirmation, confirmKeyword, inputType, actionType } = modalResolve;
        if (!resolve || !modalInput || !modalErrorText || !modalTitleText) return;
        let value = modalInput.classList.contains('hidden') || modalCustomContent.innerHTML !== '' ? true : modalInput.value.trim();
        modalErrorText.textContent = '';
        modalErrorText.classList.add('hidden');
        if (actionType === 'createOrEditTemplate') {
            handleSaveTemplateConfirm(); 
            return; 
        }
        if (actionType === 'selectTemplateForShipment') {
            const templateSelect = document.getElementById('templateSelectForShipmentModal');
            if (templateSelect && templateSelect.value !== "" && templateSelect.value !== "-1" ) {
                closeModal({ type: 'useSelected', templateIndex: parseInt(templateSelect.value) });
            } else if (!templateSelect || templateSelect.value === "" || templateSelect.value === "-1") {
                 modalErrorText.textContent = "Please select a template or cancel.";
                 modalErrorText.classList.remove('hidden');
            }
            return;
        }
        if (actionType === 'importTemplatesChoice') {
            const choiceReplace = document.getElementById('importChoiceReplace');
            const choiceMerge = document.getElementById('importChoiceMerge');
            if (choiceReplace && choiceReplace.checked) closeModal('replace');
            else if (choiceMerge && choiceMerge.checked) closeModal('merge');
            else {
                modalErrorText.textContent = "Please select an import option.";
                modalErrorText.classList.remove('hidden');
            }
            return;
        }
        if (needsConfirmation && String(value).toLowerCase() !== String(confirmKeyword).toLowerCase()) {
            modalErrorText.textContent = `Please type "${confirmKeyword}" to confirm.`;
            modalErrorText.classList.remove('hidden'); return;
        }
        if (inputType === 'number') {
            const num = parseFloat(value);
            if (value === '' || isNaN(num)) { modalErrorText.textContent = 'Please enter a valid number.'; modalErrorText.classList.remove('hidden'); return; }
            const positiveCheckTitles = ["Target Units", "Pallet Capacity", "Number of pallets", `Add Pallets of`];
            if (num <= 0 && positiveCheckTitles.some(t => modalTitleText.textContent.includes(t))) {
                 modalErrorText.textContent = "Value must be greater than 0."; modalErrorText.classList.remove('hidden'); return;
            }
            value = num;
        }
        if (inputType === 'text' && value === '') {
            const nonEmptyCheckTitles = ["SKU Code", "Shipment Name", "Template Name"];
            if (nonEmptyCheckTitles.some(t => modalTitleText.textContent.includes(t))) {
                 modalErrorText.textContent = "Name/Code cannot be empty."; modalErrorText.classList.remove('hidden'); return;
            }
        }
        closeModal(value);
    }

    // --- SHIPMENT MANAGEMENT ---
    function getCurrentShipment() {
        return (appState.currentShipmentIndex > -1 && appState.shipments && appState.shipments[appState.currentShipmentIndex])
               ? appState.shipments[appState.currentShipmentIndex]
               : null;
    }
    function getCurrentSku() {
        const shipment = getCurrentShipment();
        if (shipment && shipment.skus && typeof shipment.currentSkuIndex === 'number' && shipment.currentSkuIndex > -1 && shipment.skus[shipment.currentSkuIndex]) {
            return shipment.skus[shipment.currentSkuIndex];
        }
        return null;
    }
    async function handleNewShipment() {
        const shipmentName = await showModal({ 
            title: "New Shipment Name", 
            placeholder: `e.g., Container ${appState.shipments.length + 1}`, 
            inputType: "text",
            inputValue: `Shipment ${new Date().toLocaleDateString()}`,
            confirmButtonText: "Create Shipment" 
        });
        if (shipmentName === null || shipmentName === undefined || String(shipmentName).trim() === "") return;
        const newShipment = {
            id: `ship_${Date.now()}`, 
            name: String(shipmentName), 
            skus: [], 
            currentSkuIndex: -1,
        };
        appState.shipments.push(newShipment);
        appState.currentShipmentIndex = appState.shipments.length - 1;
        appState.lastSkuIndexPerShipment[newShipment.id] = -1;
        saveAppState();
        renderShipmentSelector();
        initPlanAndPackScreen();
    }
    async function handleCreateShipmentFromTemplate() {
        if (appState.containerTemplates.length === 0) {
            const createFirst = await showModal({
                title: "No Templates Exist",
                prompt: "You don't have any shipment templates yet. Would you like to create one now or import from a file?",
                inputType: 'none',
                confirmButtonText: "Create Template",
                cancelButtonText: "Maybe Later"
            });
            if (createFirst) {
                navigateToScreen('manageTemplatesScreen'); 
                requestAnimationFrame(() => manageTemplate()); 
            }
            return;
        }
        let templateOptionsHTML = appState.containerTemplates.map((t, index) => `<option value="${index}">${t.name}</option>`).join('');
        let templateSelectionHTML = `
            <div class="form-field">
                <label for="templateSelectForShipmentModal">Choose a template:</label>
                <select id="templateSelectForShipmentModal" class="select-field">
                    <option value="-1" disabled selected>-- Select a Template --</option>
                    ${templateOptionsHTML}
                </select>
            </div>
            <p class="modal-prompt-divider">Or</p>
            <button id="modalBtnCreateNewTemplate" class="btn btn-secondary" style="width:100%;">Create New Template From Here</button>
        `;
        const modalPromise = showModal({
            title: "New Shipment from Template",
            contentHTML: templateSelectionHTML,
            confirmButtonText: "Use Selected Template",
            cancelButtonText: "Cancel",
            actionType: 'selectTemplateForShipment' 
        });
        requestAnimationFrame(() => { 
            const modalBtnCreateNew = modalDialog.querySelector('#modalBtnCreateNewTemplate');
            if (modalBtnCreateNew) {
                modalBtnCreateNew.onclick = async () => {
                    closeModal({ type: 'createNew' }); 
                };
            }
        });
        const modalResult = await modalPromise;
        if (modalResult && modalResult.type === 'useSelected') {
            const selectedTemplate = appState.containerTemplates[modalResult.templateIndex];
            if (selectedTemplate) {
                createShipmentWithTemplate(selectedTemplate);
            }
        } else if (modalResult && modalResult.type === 'createNew') {
            navigateToScreen('manageTemplatesScreen');
            requestAnimationFrame(() => manageTemplate().then(newTemplate => {
                if (newTemplate) {
                    showModal({
                        title: "Use New Template?",
                        prompt: `Shipment template "${newTemplate.name}" created. Would you like to use it for a new shipment now?`,
                        inputType: "none",
                        confirmButtonText: "Yes, Use It",
                        cancelButtonText: "Not Now"
                    }).then(useIt => {
                        if (useIt) createShipmentWithTemplate(newTemplate);
                        else navigateToScreen('planAndPackScreen'); 
                    });
                } else {
                     navigateToScreen('planAndPackScreen'); 
                }
            }));
        }
    }
    async function createShipmentWithTemplate(template) {
        const shipmentName = await showModal({
            title: `New Shipment from: ${template.name}`,
            placeholder: `e.g., ${template.name} - Run ${new Date().toLocaleDateString()}`,
            inputType: "text", inputValue: `${template.name} - ${new Date().toLocaleDateString()}`,
            confirmButtonText: "Create Shipment"
        });
        if (shipmentName === null || shipmentName === undefined || String(shipmentName).trim() === "") return;
        const newShipment = {
            id: `ship_${Date.now()}`, name: String(shipmentName),
            skus: template.predefinedSkus.map(skuTemplate => ({
                code: skuTemplate.code, target: skuTemplate.target,
                capacities: [...(skuTemplate.capacities || [])], entries: [], 
                palletBuildInfo: skuTemplate.palletBuildInfo ? { ...skuTemplate.palletBuildInfo } : null
            })),
            currentSkuIndex: template.predefinedSkus.length > 0 ? 0 : -1,
            templateIdUsed: template.id
        };
        appState.shipments.push(newShipment);
        appState.currentShipmentIndex = appState.shipments.length - 1;
        appState.lastSkuIndexPerShipment[newShipment.id] = newShipment.currentSkuIndex;
        saveAppState(); renderShipmentSelector(); initPlanAndPackScreen();
        navigateToScreen('planAndPackScreen'); 
    }
    async function handleDeleteCurrentShipment() {
        const shipment = getCurrentShipment();
        if (!shipment) {
            await showModal({ title: "Error", prompt: "No shipment selected to delete.", inputType: 'none', confirmButtonText: "OK"});
            return;
        }
        const confirmed = await showModal({
            title: `Delete Shipment: ${shipment.name}?`,
            prompt: `Are you sure? Type "${shipment.name}" to confirm.`,
            inputType: 'text', placeholder: `Type shipment name`, needsConfirmation: true,
            confirmKeyword: shipment.name, confirmButtonText: "Delete Shipment"
        });
        if (confirmed === shipment.name) {
            appState.shipments.splice(appState.currentShipmentIndex, 1);
            if (appState.currentShipmentIndex >= appState.shipments.length) {
                appState.currentShipmentIndex = appState.shipments.length - 1;
            }
            delete appState.lastSkuIndexPerShipment[shipment.id];
            saveAppState(); renderShipmentSelector(); initPlanAndPackScreen();
        }
    }
    function renderShipmentSelector() {
        if (!shipmentSelect) return;
        shipmentSelect.innerHTML = '';
        if (appState.shipments.length === 0) {
            const opt = document.createElement('option');
            opt.textContent = "No Shipments Yet"; opt.disabled = true;
            shipmentSelect.appendChild(opt);
            shipmentSelect.style.display = 'none';
            if(deleteShipmentBtn) deleteShipmentBtn.disabled = true;
        } else {
            shipmentSelect.style.display = '';
            if(deleteShipmentBtn) deleteShipmentBtn.disabled = false;
            appState.shipments.forEach((shipment, index) => {
                const opt = document.createElement('option');
                opt.value = index.toString(); opt.textContent = shipment.name;
                shipmentSelect.appendChild(opt);
            });
            shipmentSelect.value = appState.currentShipmentIndex.toString();
        }
    }
    async function handleShipmentSelectionChange() {
        if (!shipmentSelect) return;
        const newIndex = parseInt(shipmentSelect.value);
        if (!isNaN(newIndex) && newIndex >= 0 && newIndex < appState.shipments.length) {
            appState.currentShipmentIndex = newIndex;
            saveAppState();
            initPlanAndPackScreen();
        }
    }
    
    // --- PLAN & PACK SCREEN LOGIC ---
    function initPlanAndPackScreen() {
        renderShipmentSelector();
        const currentShipment = getCurrentShipment();
        if (shipmentEmptyState) shipmentEmptyState.classList.toggle('hidden', !!currentShipment);
        const skuControlsDisabled = !currentShipment;
        if (skuSearchInput) skuSearchInput.disabled = skuControlsDisabled;
        if (skuSelect) skuSelect.disabled = skuControlsDisabled;
        if (addSkuBtn) addSkuBtn.disabled = skuControlsDisabled;
        if (!currentShipment) {
            if (skuSelect) skuSelect.innerHTML = '<option disabled>Select or create shipment</option>';
            if (skuSelectEmptyState) skuSelectEmptyState.classList.add('hidden');
            if (skuPackingUI) skuPackingUI.classList.add('hidden');
            updateShipmentProgressBar();
            return;
        }
        const shipmentId = currentShipment.id;
        if (appState.lastSkuIndexPerShipment.hasOwnProperty(shipmentId) && 
            currentShipment.skus &&
            currentShipment.skus[appState.lastSkuIndexPerShipment[shipmentId]]) {
             currentShipment.currentSkuIndex = appState.lastSkuIndexPerShipment[shipmentId];
        } else if (currentShipment.skus && currentShipment.skus.length > 0) {
             currentShipment.currentSkuIndex = 0;
        } else {
             currentShipment.currentSkuIndex = -1;
        }
        renderSkuOptionsForCurrentShipment(skuSearchInput ? skuSearchInput.value : '');
        updateShipmentProgressBar(); 
    }
    async function handleAddSkuToCurrentShipment() {
        const shipment = getCurrentShipment();
        if (!shipment) {
            await showModal({title: "Error", prompt: "Please select or create a shipment first.", inputType: "none", confirmButtonText: "OK"});
            return;
        }
        const code = await showModal({ title: "New SKU Code", placeholder: "e.g., ABC-123", inputType: "text", confirmButtonText: "Add SKU" });
        if (code === null || code === undefined || String(code).trim() === "") return;
        const sCode = String(code).trim();
        if (shipment.skus.some(s => String(s.code).toLowerCase() === sCode.toLowerCase())) {
            await showModal({ title: "Error", prompt: `SKU "${sCode}" already exists in this shipment.`, inputType: "none", confirmButtonText: "OK" });
            return;
        }
        const targetUnits = await showModal({ title: `Target Units for ${sCode}`, placeholder: "e.g., 1000", inputType: "number", confirmButtonText: "Set Target" });
        if (targetUnits === null || targetUnits === undefined) return;
        const newSku = { code: sCode, target: Number(targetUnits), capacities: [], entries: [], palletBuildInfo: null };
        shipment.skus.push(newSku);
        shipment.currentSkuIndex = shipment.skus.length - 1;
        appState.lastSkuIndexPerShipment[shipment.id] = shipment.currentSkuIndex;
        saveAppState();
        renderSkuOptionsForCurrentShipment(); 
    }
    function renderSkuOptionsForCurrentShipment(filter = '') {
        if (!skuSelect) { updateSkuPackingUI(); return; }
        const shipment = getCurrentShipment();
        skuSelect.innerHTML = '';
        if (!shipment || !shipment.skus || shipment.skus.length === 0) {
            const opt = document.createElement('option');
            opt.textContent = shipment ? "No SKUs in shipment" : "Select shipment";
            opt.disabled = true;
            skuSelect.appendChild(opt);
            if (skuSelectEmptyState) skuSelectEmptyState.classList.toggle('hidden', !shipment);
            if (skuPackingUI) skuPackingUI.classList.add('hidden');
            updateSkuPackingUI(); 
            return;
        }
        const normalizedFilter = String(filter).toLowerCase();
        const filteredSkus = shipment.skus.filter(s => String(s.code).toLowerCase().includes(normalizedFilter));
        if (filteredSkus.length === 0) {
            const opt = document.createElement('option');
            opt.textContent = filter ? "No SKUs match search" : "No SKUs available";
            opt.disabled = true;
            skuSelect.appendChild(opt);
            if (skuSelectEmptyState) skuSelectEmptyState.classList.remove('hidden'); 
        } else {
            if (skuSelectEmptyState) skuSelectEmptyState.classList.add('hidden');
            filteredSkus.forEach((sku) => {
                const originalIndex = shipment.skus.findIndex(s => s.code === sku.code);
                const opt = document.createElement('option');
                opt.value = originalIndex.toString(); opt.textContent = sku.code;
                skuSelect.appendChild(opt);
            });
            if(shipment.currentSkuIndex > -1 && shipment.skus[shipment.currentSkuIndex] && filteredSkus.some(s => s.code === shipment.skus[shipment.currentSkuIndex].code)) {
                skuSelect.value = shipment.currentSkuIndex.toString();
            } else if (filteredSkus.length > 0) {
                const firstFilteredOriginalIndex = shipment.skus.findIndex(s => s.code === filteredSkus[0].code);
                skuSelect.value = firstFilteredOriginalIndex.toString();
                if (shipment.currentSkuIndex === -1 || !filteredSkus.some(s => shipment.skus.findIndex(orig_s => orig_s.code === s.code) === shipment.currentSkuIndex)) {
                    shipment.currentSkuIndex = firstFilteredOriginalIndex;
                    appState.lastSkuIndexPerShipment[shipment.id] = shipment.currentSkuIndex;
                }
            } else {
                 shipment.currentSkuIndex = -1; 
            }
        }
        updateSkuPackingUI();
    }
    async function handleSkuSelectionChange() {
        if (!skuSelect) return;
        const shipment = getCurrentShipment();
        if (!shipment || !skuSelect.value) return; 
        const newIndex = parseInt(skuSelect.value);
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
        if (!sku) return;
        const confirmed = await showModal({ 
            title: `Reset Data for SKU: ${sku.code}?`, 
            prompt: `All packed pallet entries and capacities for ${sku.code} will be cleared. This cannot be undone. Type RESET to confirm.`,
            inputType: "text", placeholder: 'Type RESET to confirm', needsConfirmation: true, confirmKeyword: "RESET",
            confirmButtonText: "Confirm Reset"
        });
        if (String(confirmed).toUpperCase() === "RESET") {
            sku.entries = []; sku.capacities = []; 
            saveAppState();
            updateSkuPackingUI();
        }
    }
    async function handleUndoSkuEntry() {
        const sku = getCurrentSku();
        if (sku && sku.entries && sku.entries.length > 0) {
            sku.entries.pop();
            saveAppState();
            updateSkuPackingUI();
        }
    }
    function updateSkuPackingUI() {
        const sku = getCurrentSku();
        const shipment = getCurrentShipment();
        const showPackingUI = !!(sku && shipment);
        if(skuPackingUI) skuPackingUI.classList.toggle('hidden', !showPackingUI);
        if(skuSelectEmptyState) {
            const hasSkusInShipment = shipment && shipment.skus && shipment.skus.length > 0;
            skuSelectEmptyState.classList.toggle('hidden', hasSkusInShipment || !shipment);
        }
        const parentCapContainer = palletCapacitiesContainer ? palletCapacitiesContainer.parentNode : null;
        if (parentCapContainer) { 
            const buildInfoBtn = parentCapContainer.querySelector('.pallet-build-info-btn');
            if ((!showPackingUI || !sku) && buildInfoBtn) buildInfoBtn.remove();
        }
        if (!showPackingUI) {
            if(skuCodeDisplay) skuCodeDisplay.textContent = '–'; 
            if(skuTargetDisplay) skuTargetDisplay.textContent = '0';
            if(skuUnitsLeftDisplay) skuUnitsLeftDisplay.textContent = '0'; 
            if(skuPalletsUsedDisplay) skuPalletsUsedDisplay.textContent = '0';
            if(skuPalletsLeftDisplay) skuPalletsLeftDisplay.textContent = '–';
            if(palletCapacitiesContainer) palletCapacitiesContainer.innerHTML = '';
            if(packingSuggestionText) packingSuggestionText.textContent = 'Select an SKU to see suggestions.';
            if(palletEntriesLog) palletEntriesLog.innerHTML = '<li class="empty-log">No pallets packed for this SKU.</li>';
            if(skuProgressBarFill) skuProgressBarFill.style.width = '0%';
            if(skuProgressBarElement) skuProgressBarElement.setAttribute('aria-valuenow', '0');
            if(skuProgressText) skuProgressText.textContent = '0% (0/0)';
            updateShipmentProgressBar();
            return;
        }
        let totalUnitsPacked = 0; let totalPalletsUsed = 0;
        if(sku.entries) {
            sku.entries.forEach(entry => {
                totalUnitsPacked += entry.capacityUsed * entry.palletCount;
                totalPalletsUsed += entry.palletCount;
            });
        }
        const unitsLeft = (sku.target || 0) - totalUnitsPacked;
        const targetUnits = sku.target || 0;
        if(skuCodeDisplay) skuCodeDisplay.textContent = sku.code; 
        if(skuTargetDisplay) skuTargetDisplay.textContent = targetUnits;
        if(skuUnitsLeftDisplay) {
             skuUnitsLeftDisplay.textContent = unitsLeft;
             skuUnitsLeftDisplay.classList.toggle('attention-value', unitsLeft > 0 && unitsLeft < (sku.target * 0.1) && unitsLeft > 0);
        }
        if(skuPalletsUsedDisplay) skuPalletsUsedDisplay.textContent = totalPalletsUsed;
        if(skuPalletsLeftDisplay) {
            if (targetUnits > 0 && sku.capacities && sku.capacities.length > 0) {
                const positiveCaps = sku.capacities.filter(c => c > 0);
                if (positiveCaps.length > 0) {
                    const avgCapacity = positiveCaps.reduce((a,b) => a+b, 0) / positiveCaps.length;
                    const estimatedTotalPallets = Math.ceil(targetUnits / avgCapacity);
                    skuPalletsLeftDisplay.textContent = Math.max(0, estimatedTotalPallets - totalPalletsUsed);
                } else {
                    skuPalletsLeftDisplay.textContent = 'N/A';
                }
            } else {
                skuPalletsLeftDisplay.textContent = 'N/A';
            }
        }
        if (skuProgressBarFill && skuProgressText && skuProgressBarElement) {
            let percentage = 0;
            if (targetUnits > 0) {
                percentage = (totalUnitsPacked / targetUnits) * 100;
            } else if (totalUnitsPacked > 0 && targetUnits === 0) { 
                percentage = 100; 
            }
            percentage = Math.max(0, Math.min(100, percentage)); 
            skuProgressBarFill.style.width = `${percentage}%`;
            skuProgressBarElement.setAttribute('aria-valuenow', percentage.toFixed(2));
            skuProgressBarFill.classList.toggle('progress-bar-fill-complete', percentage >= 100 && targetUnits > 0);
            if (targetUnits > 0) {
                skuProgressText.textContent = `${Math.round(percentage)}% (${totalUnitsPacked}/${targetUnits})`;
            } else {
                skuProgressText.textContent = `${totalUnitsPacked} units packed (No Target Set)`;
            }
        }
        renderPalletCapacityChips(sku);
        renderPackingSuggestion(sku, unitsLeft);
        renderPalletEntriesLog(sku.entries || []);
        updateShipmentProgressBar();
    }
    async function addPalletCapacityToSku(sku) {
        if (!sku) return;
        const capacity = await showModal({
            title: "Add Pallet Capacity", prompt: `Units per pallet for SKU: ${sku.code}`,
            placeholder: "e.g., 25", inputType: "number", confirmButtonText: "Add Capacity"
        });
        if (capacity === null || capacity === undefined ) return; 
        const numCapacity = Number(capacity);
        if (isNaN(numCapacity) || numCapacity <= 0) { 
             await showModal({title: "Invalid Capacity", prompt: `Capacity must be a positive number.`, inputType: "none", confirmButtonText: "OK"});
             return;
        }
        if (!sku.capacities) sku.capacities = [];
        if (!sku.capacities.includes(numCapacity)) {
            sku.capacities.push(numCapacity);
            sku.capacities.sort((a, b) => a - b); 
            saveAppState();
            updateSkuPackingUI();
        } else {
            await showModal({title: "Info", prompt: `Capacity ${numCapacity} already exists.`, inputType: "none", confirmButtonText: "OK"});
        }
    }
    async function handleCapacityChipClick(sku, capacity) {
        const shipment = getCurrentShipment();
        if (!sku || !shipment || capacity <= 0) return;
        let totalUnitsPackedSoFar = 0;
        (sku.entries || []).forEach(entry => { totalUnitsPackedSoFar += entry.capacityUsed * entry.palletCount; });
        const unitsInThisBatch = Number(capacity) * 1; 
        const unitsLeftForSku = (sku.target || 0) - totalUnitsPackedSoFar;
        if ((sku.target || 0) > 0 && (totalUnitsPackedSoFar + unitsInThisBatch > (sku.target || 0))) {
            const packRemaining = await showModal({
                title: "Target Alert",
                prompt: `Adding 1 pallet of ${capacity} units would exceed target. Current: ${totalUnitsPackedSoFar}/${sku.target}. Pack remaining ${unitsLeftForSku} units instead?`,
                inputType: 'none',
                confirmButtonText: (unitsLeftForSku > 0) ? `Pack ${unitsLeftForSku}` : "OK",
                cancelButtonText: (unitsLeftForSku > 0) ? "Cancel Add" : "Close"
            });
            if (packRemaining && (unitsLeftForSku > 0)) {
                 handleFinishLastPallet(sku, unitsLeftForSku);
            }
            return;
        }
        if (!sku.entries) sku.entries = [];
        sku.entries.push({ 
            capacityUsed: Number(capacity), 
            palletCount: 1, 
            timestamp: Date.now() 
        });
        saveAppState();
        updateSkuPackingUI();
    }
    async function handleFinishLastPallet(sku, unitsToPack) {
        const shipment = getCurrentShipment();
        if (!sku || !shipment || unitsToPack <= 0) {
            console.warn("Invalid state for finishing last pallet.");
            return;
        }
        if (!sku.entries) sku.entries = [];
        sku.entries.push({
            capacityUsed: Number(unitsToPack),
            palletCount: 1,
            timestamp: Date.now()
        });
        saveAppState();
        updateSkuPackingUI();
    }
    function renderPalletCapacityChips(sku) {
        if (!palletCapacitiesContainer) return;
        const parentContainer = palletCapacitiesContainer.parentNode; 
        let buildInfoBtn = parentContainer.querySelector('.pallet-build-info-btn');
        if (sku && sku.palletBuildInfo && sku.palletBuildInfo.text) {
            if (!buildInfoBtn) {
                buildInfoBtn = document.createElement('button');
                buildInfoBtn.className = 'btn btn-secondary btn-small btn-icon-text pallet-build-info-btn';
                const capacitiesTitle = parentContainer.querySelector('.subsection-title');
                if(capacitiesTitle) parentContainer.insertBefore(buildInfoBtn, capacitiesTitle);
                else parentContainer.insertBefore(buildInfoBtn, palletCapacitiesContainer); 
            }
            buildInfoBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg> Pallet Build Info`;
            buildInfoBtn.onclick = () => { 
                showModal({
                    title: `Pallet Build: ${sku.code}`,
                    prompt: sku.palletBuildInfo.text, 
                    inputType: 'none',
                    confirmButtonText: "OK"
                });
            };
        } else if (buildInfoBtn) {
            buildInfoBtn.remove(); 
        }
        palletCapacitiesContainer.innerHTML = ''; 
        if (sku && sku.capacities) {
            sku.capacities.filter(cap => cap > 0).forEach(cap => { 
                const chip = document.createElement('button');
                chip.className = 'chip';
                chip.textContent = String(cap); 
                chip.onclick = () => handleCapacityChipClick(sku, cap);
                palletCapacitiesContainer.appendChild(chip);
            });
        }
        const addChip = document.createElement('button');
        addChip.className = 'chip add-capacity-chip';
        addChip.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Add Capacity`;
        addChip.onclick = () => addPalletCapacityToSku(sku);
        palletCapacitiesContainer.appendChild(addChip);
        if (sku) {
            let totalUnitsPackedForSku = 0;
            if(sku.entries) {
                sku.entries.forEach(entry => {
                    totalUnitsPackedForSku += entry.capacityUsed * entry.palletCount;
                });
            }
            const unitsLeftForSku = (sku.target || 0) - totalUnitsPackedForSku;
            const validPositiveCapacities = sku.capacities ? sku.capacities.filter(c => c > 0 && typeof c === 'number') : [];
            const smallestCapacity = validPositiveCapacities.length > 0 ? Math.min(...validPositiveCapacities) : Infinity;
            const showFinishButtonCondition = unitsLeftForSku > 0 && 
                                            ( 
                                                (validPositiveCapacities.length > 0 && unitsLeftForSku < smallestCapacity) ||
                                                (validPositiveCapacities.length === 0 && sku.target > 0) 
                                            );
            if (showFinishButtonCondition) {
                const finishButton = document.createElement('button');
                finishButton.id = 'finishLastPalletButton'; 
                finishButton.className = 'chip btn-primary'; 
                finishButton.textContent = `Pack Last ${unitsLeftForSku}`;
                finishButton.onclick = () => handleFinishLastPallet(sku, unitsLeftForSku);
                palletCapacitiesContainer.appendChild(finishButton);
            }
        }
    }
    function renderPackingSuggestion(sku, unitsLeft) { 
        if (!packingSuggestionText || !sku) return;
        if (unitsLeft <= 0) {
            packingSuggestionText.textContent = "All units packed!";
            return;
        }
        const capacities = sku.capacities ? sku.capacities.filter(c => c > 0 && typeof c === 'number') : [];
        if (capacities.length === 0) {
            packingSuggestionText.textContent = `Define pallet capacities (current: ${unitsLeft} left).`;
            return;
        }
        const sortedCaps = [...capacities].sort((a, b) => b - a); 
        let suggestion = {};
        let remaining = unitsLeft;
        let covered = 0;
        for (const cap of sortedCaps) {
            if (remaining >= cap) {
                const count = Math.floor(remaining / cap);
                if (count > 0) {
                    suggestion[cap] = (suggestion[cap] || 0) + count;
                    remaining -= count * cap;
                    covered += count * cap;
                }
            }
        }
        if (covered > 0) {
            const suggestionString = Object.entries(suggestion)
                .map(([cap, count]) => `${count}x${cap}`)
                .join(', ');
            packingSuggestionText.textContent = `Use: ${suggestionString} (covers ${covered} units). ${remaining > 0 ? `${remaining} units still left.` : 'Perfect fit!'}`;
        } else if (unitsLeft < Math.min(...sortedCaps)) {
            packingSuggestionText.textContent = `Remaining ${unitsLeft} units is less than smallest pallet capacity (${Math.min(...sortedCaps)}). Use "Pack Last ${unitsLeft}".`;
        } else {
            packingSuggestionText.textContent = `No standard pallet combination for ${unitsLeft} units. Consider "Pack Last ${unitsLeft}" or add more capacity options.`;
        }
    }
    function renderPalletEntriesLog(entries) {
        if (!palletEntriesLog) return;
        palletEntriesLog.innerHTML = '';
        if (!entries || entries.length === 0) {
            const emptyLi = document.createElement('li');
            emptyLi.className = 'empty-log'; emptyLi.textContent = 'No pallet batches logged for this SKU.';
            palletEntriesLog.appendChild(emptyLi); return;
        }
        [...entries].reverse().forEach((entry) => {
            const batchItem = document.createElement('li'); batchItem.className = 'entry-batch-item';
            const summary = document.createElement('div'); summary.className = 'entry-batch-summary';
            const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
            const expandButtonHTML = entry.palletCount > 1 ? `<button class="btn-icon expand-icon" aria-label="Expand details" aria-expanded="false"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></button>` : '';
            summary.innerHTML = `<div class="info"><span class="main-text">${entry.capacityUsed} units/pallet (x${entry.palletCount} pallets)</span><span class="sub-text">Total: ${entry.capacityUsed * entry.palletCount} units</span></div><div class="actions"><span class="timestamp">Added @ ${time}</span>${expandButtonHTML}</div>`;
            batchItem.appendChild(summary);
            if (entry.palletCount > 1) {
                const details = document.createElement('div'); details.className = 'entry-batch-details';
                const ul = document.createElement('ul');
                for (let i = 0; i < entry.palletCount; i++) {
                    const li = document.createElement('li'); li.textContent = `Pallet ${i + 1} of ${entry.palletCount} (${entry.capacityUsed} units) - Added @ ${time}`;
                    ul.appendChild(li);
                }
                details.appendChild(ul); batchItem.appendChild(details);
                const expandButton = summary.querySelector('.expand-icon');
                if (expandButton) { expandButton.addEventListener('click', (e) => { e.stopPropagation(); const isExpanded = batchItem.classList.toggle('expanded'); expandButton.setAttribute('aria-expanded', isExpanded.toString()); }); }
                summary.addEventListener('click', (e) => { if (e.target.closest('.expand-icon')) return; const isExpanded = batchItem.classList.toggle('expanded'); const btn = summary.querySelector('.expand-icon'); if (btn) btn.setAttribute('aria-expanded', isExpanded.toString()); });
            }
            palletEntriesLog.appendChild(batchItem);
        });
    }
    function updateShipmentProgressBar() {
        const shipment = getCurrentShipment();
        if (!shipmentProgressContainer || !shipmentNameForProgress || !shipmentProgressBarFill || !shipmentProgressText || !shipmentProgressBarElement) {
            if (shipmentProgressContainer) shipmentProgressContainer.classList.add('hidden');
            return;
        }
        if (!shipment) { shipmentProgressContainer.classList.add('hidden'); return; }
        let totalShipmentTarget = 0; let totalShipmentPacked = 0;
        if (shipment.skus && shipment.skus.length > 0) {
            shipment.skus.forEach(s => {
                const skuTarget = s.target || 0;
                totalShipmentTarget += skuTarget;
                const packedForSku = (s.entries || []).reduce((skuSum, entry) => skuSum + (entry.capacityUsed * entry.palletCount), 0);
                totalShipmentPacked += packedForSku;
            });
        }
        let percentage = 0;
        if (totalShipmentTarget > 0) {
            percentage = (totalShipmentPacked / totalShipmentTarget) * 100;
        } else if (totalShipmentPacked > 0 && totalShipmentTarget === 0) {
            percentage = 100; 
        }
        percentage = Math.max(0, Math.min(100, percentage));
        shipmentNameForProgress.textContent = shipment.name;
        shipmentProgressBarFill.style.width = `${percentage}%`;
        shipmentProgressBarElement.setAttribute('aria-valuenow', percentage.toFixed(2));
        shipmentProgressBarFill.classList.toggle('progress-bar-fill-complete', percentage >= 100 && totalShipmentTarget > 0);
        if (totalShipmentTarget > 0) {
            shipmentProgressText.textContent = `${Math.round(percentage)}% (${totalShipmentPacked}/${totalShipmentTarget})`;
        } else {
            shipmentProgressText.textContent = `${totalShipmentPacked} units packed (Target Not Set or 0)`;
        }
        shipmentProgressContainer.classList.remove('hidden');
    }

    // --- QUICK COUNT LOGIC ---
    function updateQuickCountUIDisplay() { 
        if (quickCountDisplay) {
            quickCountDisplay.textContent = appState.quickCountValue;
            quickCountDisplay.classList.add('updated');
            quickCountDisplay.addEventListener('animationend', () => {
                quickCountDisplay.classList.remove('updated');
            }, { once: true });
        }
    }
    function incrementQuickCount() { appState.quickCountValue++; updateQuickCountUIDisplay(); saveAppState(); }
    function decrementQuickCount() { if (appState.quickCountValue > 0) { appState.quickCountValue--; updateQuickCountUIDisplay(); saveAppState(); } }
    async function confirmResetQuickCount() {
        if (appState.quickCountValue === 0) return;
        const confirmed = await showModal({
            title: "Reset Quick Count?", prompt: `Current count is ${appState.quickCountValue}. This will reset it to 0.`,
            inputType: "text", placeholder: 'Type RESET to confirm', needsConfirmation: true, confirmKeyword: "RESET",
            confirmButtonText: "Confirm Reset"
        });
        if (String(confirmed).toUpperCase() === "RESET") { appState.quickCountValue = 0; updateQuickCountUIDisplay(); saveAppState(); }
    }

    // --- TEMPLATE MANAGEMENT ---
    function initManageTemplatesScreen() {
        renderTemplatesList();
    }
    function renderTemplatesList() {
        if (!templatesListContainer || !noTemplatesState) return;
        templatesListContainer.innerHTML = '';
        if (appState.containerTemplates.length === 0) {
            noTemplatesState.classList.remove('hidden');
            templatesListContainer.classList.add('hidden');
        } else {
            noTemplatesState.classList.add('hidden');
            templatesListContainer.classList.remove('hidden');
            appState.containerTemplates.forEach((template, index) => {
                const card = document.createElement('div');
                card.className = 'template-card';
                card.innerHTML = `
                    <div class="template-card-header">
                        <h3>${template.name}</h3>
                        <div class="template-card-actions">
                            <button class="btn btn-secondary btn-small btn-icon-text" data-action="use" data-index="${index}" title="Use this template for a new shipment">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Use
                            </button>
                            <button class="btn btn-secondary btn-small btn-icon-text" data-action="edit" data-index="${index}" title="Edit this template">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg> Edit
                            </button>
                            <button class="btn btn-danger btn-small btn-icon-text" data-action="delete" data-index="${index}" title="Delete this template">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> Delete
                            </button>
                        </div>
                    </div>
                    <p class="template-description">${template.description || 'No description.'}</p>
                    <p class="template-sku-count"><strong>${template.predefinedSkus.length}</strong> SKU(s) in this template.</p>
                `;
                templatesListContainer.appendChild(card);
            });
            templatesListContainer.querySelectorAll('button[data-action]').forEach(button => {
                button.addEventListener('click', (e) => {
                    const action = e.currentTarget.dataset.action;
                    const index = parseInt(e.currentTarget.dataset.index);
                    const template = appState.containerTemplates[index];
                    if (action === 'edit') manageTemplate(template, index);
                    else if (action === 'delete') deleteTemplate(template, index);
                    else if (action === 'use') createShipmentWithTemplate(template);
                });
            });
        }
    }
    async function deleteTemplate(template, index) {
        const confirmed = await showModal({
            title: `Delete Template: ${template.name}?`,
            prompt: `Are you sure? This cannot be undone. Type "${template.name}" to confirm.`,
            inputType: 'text', placeholder: 'Type template name', needsConfirmation: true,
            confirmKeyword: template.name, confirmButtonText: "Delete Template"
        });
        if (confirmed === template.name) {
            appState.containerTemplates.splice(index, 1);
            saveAppState();
            renderTemplatesList();
        }
    }
    async function manageTemplate(existingTemplate = null, editIndex = -1) {
        currentTemplateBeingCreated = existingTemplate 
            ? JSON.parse(JSON.stringify(existingTemplate)) 
            : { id: `tpl_${Date.now()}_${Math.random().toString(36).substr(2,5)}`, name: '', description: '', predefinedSkus: [] };
        let modalHTML = `
            <div class="form-field">
                <label for="tplName">Template Name*</label>
                <input type="text" id="tplName" class="input-field" value="${currentTemplateBeingCreated.name}">
            </div>
            <div class="form-field">
                <label for="tplDesc">Description</label>
                <textarea id="tplDesc" class="input-field" rows="2">${currentTemplateBeingCreated.description || ''}</textarea>
            </div>
            <h4 class="subsection-title" style="margin-top:20px; margin-bottom:10px; border-bottom:none; padding-bottom:0;">SKUs in Template</h4>
            <div id="templateSkuEditor" class="sku-entry-for-template">
                <div class="form-field"><label for="tplSkuCode">SKU Code*</label><input type="text" id="tplSkuCode" class="input-field"></div>
                <div class="form-field"><label for="tplSkuTarget">Target Units*</label><input type="number" id="tplSkuTarget" class="input-field" min="1"></div>
                <div class="form-field">
                    <label for="tplSkuCapacities">Capacities (comma-separated, e.g., 20,25)</label>
                    <input type="text" id="tplSkuCapacities" class="input-field" placeholder="e.g., 20,25,30">
                </div>
                <div class="form-field">
                    <label for="tplSkuBuildInfo">Pallet Build Info (use Shift+Enter for new lines)</label>
                    <textarea id="tplSkuBuildInfo" class="input-field" rows="3"></textarea>
                </div>
                <button id="addSkuToTemplateInternalBtn" class="btn btn-secondary btn-small" style="margin-top:10px;">Add SKU to List</button>
            </div>
            <ul id="templateSkusListDisplayInternal" class="compact-list" style="margin-top:10px; max-height: 200px;"></ul>
        `;
        const modalPromise = showModal({
            title: existingTemplate ? `Edit Template: ${existingTemplate.name}` : "Create New Template",
            contentHTML: modalHTML,
            confirmButtonText: "Save Template",
            actionType: 'createOrEditTemplate', 
            editIndex: editIndex 
        });
        requestAnimationFrame(() => { 
            renderTemplateSkusListInternal(); 
            const addSkuBtnInternal = document.getElementById('addSkuToTemplateInternalBtn');
            if(addSkuBtnInternal) addSkuBtnInternal.onclick = handleAddSkuToTemplateInternal;
        });
        const result = await modalPromise;
        if (result && result.savedTemplate) {
            currentTemplateBeingCreated = null; 
            return result.savedTemplate; 
        }
        currentTemplateBeingCreated = null; 
        return null;
    }
    function renderTemplateSkusListInternal() {
        const listElement = document.getElementById('templateSkusListDisplayInternal');
        if (!listElement || !currentTemplateBeingCreated) return;
        listElement.innerHTML = '';
        currentTemplateBeingCreated.predefinedSkus.forEach((sku, index) => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${sku.code} (Target: ${sku.target}, Caps: ${sku.capacities.join(',') || 'N/A'})</span>
                            <button class="btn-icon btn-danger btn-small remove-sku-tpl-btn" data-index="${index}" aria-label="Remove SKU">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>`;
            listElement.appendChild(li);
        });
        listElement.querySelectorAll('.remove-sku-tpl-btn').forEach(btn => {
            btn.onclick = (e) => {
                const skuIndex = parseInt(e.currentTarget.dataset.index);
                currentTemplateBeingCreated.predefinedSkus.splice(skuIndex, 1);
                renderTemplateSkusListInternal();
            };
        });
    }
    function handleAddSkuToTemplateInternal() {
        const codeInput = document.getElementById('tplSkuCode');
        const targetInput = document.getElementById('tplSkuTarget');
        const capacitiesInput = document.getElementById('tplSkuCapacities');
        const buildInfoInput = document.getElementById('tplSkuBuildInfo');
        const errorEl = modalErrorText; 
        const code = codeInput.value.trim();
        const target = parseInt(targetInput.value);
        const capacitiesStr = capacitiesInput.value.trim();
        const buildInfo = buildInfoInput.value.trim();
        errorEl.classList.add('hidden'); errorEl.textContent = '';
        if (!code) { errorEl.textContent = "SKU Code is required."; errorEl.classList.remove('hidden'); return; }
        if (isNaN(target) || target <= 0) { errorEl.textContent = "Target Units must be a positive number."; errorEl.classList.remove('hidden'); return; }
        let capacities = [];
        if (capacitiesStr) {
            const parsedCaps = capacitiesStr.split(',')
                .map(c => parseInt(c.trim()))
                .filter(c => !isNaN(c) && c > 0);
            const originalCapCount = capacitiesStr.split(',').filter(s => s.trim() !== "").length;
            if (parsedCaps.length !== originalCapCount && originalCapCount > 0) {
                 errorEl.textContent = "Invalid capacities. Ensure all are positive numbers, comma-separated."; 
                 errorEl.classList.remove('hidden'); 
            }
            capacities = parsedCaps;
        }
        if (currentTemplateBeingCreated.predefinedSkus.some(s => s.code.toLowerCase() === code.toLowerCase())) {
            errorEl.textContent = `SKU ${code} already added to this template.`; errorEl.classList.remove('hidden'); return;
        }
        currentTemplateBeingCreated.predefinedSkus.push({
            code, target, capacities, palletBuildInfo: buildInfo ? { text: buildInfo } : null
        });
        renderTemplateSkusListInternal();
        codeInput.value = ''; targetInput.value = ''; capacitiesInput.value = ''; buildInfoInput.value = '';
        codeInput.focus();
    }
    function handleSaveTemplateConfirm() {
        const nameInput = document.getElementById('tplName');
        const descInput = document.getElementById('tplDesc');
        const errorEl = modalErrorText;
        const name = nameInput.value.trim();
        const description = descInput.value.trim();
        errorEl.classList.add('hidden'); errorEl.textContent = '';
        if (!name) { errorEl.textContent = "Template Name is required."; errorEl.classList.remove('hidden'); return; }
        if (!currentTemplateBeingCreated.predefinedSkus || currentTemplateBeingCreated.predefinedSkus.length === 0) {
            errorEl.textContent = "Template must have at least one SKU."; errorEl.classList.remove('hidden'); return;
        }
        currentTemplateBeingCreated.name = name;
        currentTemplateBeingCreated.description = description;
        const editIndex = modalResolve.editIndex; 
        if (editIndex !== undefined && editIndex > -1 && appState.containerTemplates[editIndex]) { 
            appState.containerTemplates[editIndex] = currentTemplateBeingCreated;
        } else { 
            appState.containerTemplates.push(currentTemplateBeingCreated);
        }
        saveAppState();
        if (appState.activeScreenId === 'manageTemplatesScreen') renderTemplatesList();
        closeModal({ savedTemplate: currentTemplateBeingCreated }); 
    }
    function handleExportTemplates() {
        if (appState.containerTemplates.length === 0) {
            showModal({title: "No Templates", prompt: "There are no templates to export.", inputType: "none", confirmButtonText: "OK"});
            return;
        }
        const jsonData = JSON.stringify(appState.containerTemplates, null, 2); 
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'pallet_tracker_templates.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showModal({title: "Export Successful", prompt: "Templates exported to pallet_tracker_templates.json (usually in your Downloads folder).", inputType: "none", confirmButtonText: "OK"});
    }
    async function handleImportTemplates() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';
        fileInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const importedData = JSON.parse(e.target.result);
                    if (!Array.isArray(importedData) || !importedData.every(isValidTemplate)) {
                        await showModal({title: "Import Error", prompt: "Invalid template file format. Ensure it's an array of valid templates.", inputType: "none", confirmButtonText: "OK"});
                        return;
                    }
                    const choiceHTML = `
                        <p>Found ${importedData.length} template(s) in the file. How would you like to import them?</p>
                        <div class="form-field" style="margin-top:15px;">
                            <label for="importChoiceReplace" class="radio-label">
                                <input type="radio" name="importChoice" id="importChoiceReplace" value="replace" checked>
                                Replace all current templates
                            </label>
                        </div>
                        <div class="form-field">
                            <label for="importChoiceMerge" class="radio-label">
                                <input type="radio" name="importChoice" id="importChoiceMerge" value="merge">
                                Merge with existing (new templates will be added, duplicates by ID will be skipped)
                            </label>
                        </div>
                    `;
                    const importChoice = await showModal({
                        title: `Import Templates`,
                        contentHTML: choiceHTML,
                        confirmButtonText: "Proceed",
                        cancelButtonText: "Cancel Import",
                        actionType: 'importTemplatesChoice'
                    });
                    if (importChoice === 'replace') {
                        appState.containerTemplates = importedData;
                        appState.containerTemplates.forEach(t => { if (!t.id || t.id.startsWith("tpl_rs90_") || t.id.startsWith("tpl_tab26_")) t.id = `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`; });
                    } else if (importChoice === 'merge') {
                        const existingIds = new Set(appState.containerTemplates.map(t => t.id));
                        let mergedCount = 0;
                        let skippedCount = 0;
                        importedData.forEach(importedTpl => {
                            if (!existingIds.has(importedTpl.id)) {
                                appState.containerTemplates.push(importedTpl);
                                existingIds.add(importedTpl.id); 
                                mergedCount++;
                            } else {
                                skippedCount++;
                            }
                        });
                        await showModal({title: "Merge Complete", prompt: `${mergedCount} templates merged. ${skippedCount} duplicates (by ID) skipped.`, inputType:"none", confirmButtonText:"OK"});
                    } else { 
                        return;
                    }
                    saveAppState();
                    renderTemplatesList();
                    if (importChoice === 'replace') {
                       await showModal({title: "Import Successful", prompt: `All templates replaced successfully.`, inputType: "none", confirmButtonText: "OK"});
                    }
                } catch (error) {
                    console.error("Error importing templates:", error);
                    await showModal({title: "Import Error", prompt: "Could not parse the template file. Ensure it's a valid JSON.", inputType: "none", confirmButtonText: "OK"});
                }
            };
            reader.readAsText(file);
        });
        document.body.appendChild(fileInput);
        fileInput.click();
        document.body.removeChild(fileInput);
    }
    function isValidTemplate(template) { 
        return template && 
               typeof template.id === 'string' && 
               typeof template.name === 'string' && 
               Array.isArray(template.predefinedSkus) &&
               template.predefinedSkus.every(sku => 
                    sku && 
                    typeof sku.code === 'string' &&
                    typeof sku.target === 'number' &&
                    Array.isArray(sku.capacities) &&
                    sku.capacities.every(cap => typeof cap === 'number') &&
                    (sku.palletBuildInfo === null || (typeof sku.palletBuildInfo === 'object' && typeof sku.palletBuildInfo.text === 'string'))
               );
    }

    // --- SERVICE WORKER REGISTRATION ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => console.log('Service Worker: Registered', reg))
                .catch(err => console.error('Service Worker: Registration Failed', err));
        });
    }
});
