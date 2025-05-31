const DARK_THEME_CLASS = 'dark-theme';

function loadTheme() {
    const currentTheme = localStorage.getItem(THEME_KEY);
    document.body.classList.toggle(DARK_THEME_CLASS, currentTheme === DARK_THEME_CLASS);
    if (themeToggleBtnLight && themeToggleBtnDark) {
        themeToggleBtnLight.style.display = document.body.classList.contains(DARK_THEME_CLASS) ? 'none' : 'inline-flex';
        themeToggleBtnDark.style.display = document.body.classList.contains(DARK_THEME_CLASS) ? 'inline-flex' : 'none';
    }
}

function toggleTheme() {
    document.body.classList.toggle(DARK_THEME_CLASS);
    localStorage.setItem(THEME_KEY, document.body.classList.contains(DARK_THEME_CLASS) ? DARK_THEME_CLASS : '');
    if (themeToggleBtnLight && themeToggleBtnDark) {
        themeToggleBtnLight.style.display = document.body.classList.contains(DARK_THEME_CLASS) ? 'none' : 'inline-flex';
        themeToggleBtnDark.style.display = document.body.classList.contains(DARK_THEME_CLASS) ? 'inline-flex' : 'none';
    }
    if (appState.activeScreenId === 'planAndPackScreen') {
        renderShipmentSelector(); 
        renderSkuOptionsForCurrentShipment(skuSearchInput ? skuSearchInput.value : '');
    }
    if (appState.activeScreenId === 'tasksScreen') {
        renderTasksList(); // Task cards might have theme-dependent styles for priority
    }
}

function toggleSideNav() {
    if (!sideNav || !navToggleBtn || !navOverlay) return;
    const isOpen = sideNav.classList.toggle('open');
    navToggleBtn.setAttribute('aria-expanded', String(isOpen));
    navOverlay.classList.toggle('active', isOpen);
    bodyElement.classList.toggle('sidenav-open', isOpen);
}

function closeSideNav() {
    if (!sideNav || !navToggleBtn || !navOverlay) return;
    sideNav.classList.remove('open');
    navToggleBtn.setAttribute('aria-expanded', 'false');
    navOverlay.classList.remove('active');
    bodyElement.classList.remove('sidenav-open');
}

function handleNavClick(event) {
    const targetScreenId = event.currentTarget.dataset.screen;
    if (targetScreenId && targetScreenId !== appState.activeScreenId) {
        navigateToScreen(targetScreenId);
    }
    closeSideNav();
}

async function navigateToScreen(screenId, isInitialNav = false) {
    appState.activeScreenId = screenId;
    if (!isInitialNav) saveAppState();

    Object.values(screens).forEach(s => s?.classList.remove('active-screen'));
    
    const targetScreen = screens[screenId];
    if (targetScreen) targetScreen.classList.add('active-screen');
    else {
         console.warn(`Screen ID "${screenId}" not found. Defaulting to Dashboard.`);
         screens.dashboardScreen?.classList.add('active-screen'); // Default to dashboard
         appState.activeScreenId = 'dashboardScreen';
    }

    navItems.forEach(item => item.classList.toggle('active', item.dataset.screen === appState.activeScreenId));

    let title = "Pallet Tracker Pro";
    const activeNavItem = document.querySelector(`.nav-item[data-screen="${appState.activeScreenId}"]`);
    if (activeNavItem) {
        const textNode = Array.from(activeNavItem.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
        if (textNode) title = textNode.textContent.trim();
    }
    if (appTitleText) appTitleText.textContent = title;
    document.title = title + " - Pallet Tracker Pro";

    // Screen-specific initializations
    if (appState.activeScreenId === 'dashboardScreen' && typeof initDashboardScreen === 'function') initDashboardScreen();
    else if (appState.activeScreenId === 'planAndPackScreen' && typeof initPlanAndPackScreen === 'function') initPlanAndPackScreen();
    else if (appState.activeScreenId === 'quickCountScreen' && typeof initQuickCountScreen === 'function') initQuickCountScreen();
    else if (appState.activeScreenId === 'manageTemplatesScreen' && typeof initManageTemplatesScreen === 'function') initManageTemplatesScreen();
    else if (appState.activeScreenId === 'palletLocatorScreen' && typeof initializePalletLocatorPlus === 'function') initializePalletLocatorPlus();
    else if (appState.activeScreenId === 'tasksScreen' && typeof initTasksScreen === 'function') initTasksScreen();
    else if (appState.activeScreenId === 'settingsScreen' && typeof initSettingsScreen === 'function') initSettingsScreen();
    else if (appState.activeScreenId === 'accountScreen' && typeof initAccountScreen === 'function') initAccountScreen();

}

function updateNetworkStatus() {
    if (!networkStatusIndicator) return;
    const online = navigator.onLine;
    networkStatusIndicator.textContent = online ? 'Online' : 'Offline';
    networkStatusIndicator.className = `network-status ${online ? 'online' : 'offline'}`;
    networkStatusIndicator.title = online ? 'Network connection active.' : 'Network connection lost. Offline mode.';
}

function setupEventListeners() {
    if (themeToggleBtnLight) themeToggleBtnLight.addEventListener('click', toggleTheme);
    if (themeToggleBtnDark) themeToggleBtnDark.addEventListener('click', toggleTheme);
    // Removed accountAreaBtn listener as it's replaced by a nav item
    
    if (navToggleBtn) navToggleBtn.addEventListener('click', toggleSideNav);
    if (navOverlay) navOverlay.addEventListener('click', closeSideNav);
    navItems.forEach(item => item.addEventListener('click', handleNavClick));
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', () => closeModal(null));
    if (modalCancelBtn) modalCancelBtn.addEventListener('click', () => closeModal(null));
    if (modalConfirmBtn) modalConfirmBtn.addEventListener('click', handleModalConfirm);
    if (modalOverlay) modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(null); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modalOverlay && !modalOverlay.classList.contains('hidden')) closeModal(null); });

    // Plan & Pack
    if (shipmentSelect) shipmentSelect.addEventListener('change', handleShipmentSelectionChange);
    if (newShipmentBtn) newShipmentBtn.addEventListener('click', handleNewShipment);
    if (createFromTemplateBtn) createFromTemplateBtn.addEventListener('click', handleCreateShipmentFromTemplate);
    if (finishShipmentBtn) finishShipmentBtn.addEventListener('click', handleFinishShipment);
    if (editShipmentDetailsBtn) editShipmentDetailsBtn.addEventListener('click', handleEditShipmentDetails);
    if (saveAsTemplateBtn) saveAsTemplateBtn.addEventListener('click', handleSaveShipmentAsTemplate);
    if (deleteCurrentShipmentBtn) deleteCurrentShipmentBtn.addEventListener('click', handleDeleteCurrentShipment);
    if (unarchiveShipmentBtn) unarchiveShipmentBtn.addEventListener('click', handleUnarchiveShipment);
    if (setShipmentStartTimeBtn) setShipmentStartTimeBtn.addEventListener('click', handleSetShipmentStartTime);
    if (setStartTimeFromOverlayBtn) setStartTimeFromOverlayBtn.addEventListener('click', handleSetShipmentStartTime);
    if (skuSearchInput) skuSearchInput.addEventListener('input', () => renderSkuOptionsForCurrentShipment(skuSearchInput.value));
    if (skuSelectElement) skuSelectElement.addEventListener('change', handleSkuSelectionChange);
    if (addSkuBtn) addSkuBtn.addEventListener('click', () => handleAddOrEditSkuToCurrentShipment(false));
    if (editSelectedSkuBtn) editSelectedSkuBtn.addEventListener('click', () => handleAddOrEditSkuToCurrentShipment(true));
    if (deleteSelectedSkuBtn) deleteSelectedSkuBtn.addEventListener('click', handleDeleteSelectedSkuFromCurrentShipment);
    if (undoEntryBtn) undoEntryBtn.addEventListener('click', handleUndoSkuEntry);
    if (resetSkuBtn) resetSkuBtn.addEventListener('click', handleResetSkuData);

    // Quick Count
    if (quickCountModeToggle) quickCountModeToggle.addEventListener('change', handleQuickCountModeChange);
    if (recordQuickCountBtn) recordQuickCountBtn.addEventListener('click', incrementQuickCountLoaded);
    if (undoQuickCountBtn) undoQuickCountBtn.addEventListener('click', decrementQuickCountLoaded);
    if (resetQuickCountBtn) resetQuickCountBtn.addEventListener('click', confirmResetAllQuickCounts);
    if (incrementQuickCountReturnsBtn) incrementQuickCountReturnsBtn.addEventListener('click', () => updateQuickCountSubValue('returns', 1));
    if (decrementQuickCountReturnsBtn) decrementQuickCountReturnsBtn.addEventListener('click', () => updateQuickCountSubValue('returns', -1));
    if (incrementQuickCountCollarsBtn) incrementQuickCountCollarsBtn.addEventListener('click', () => updateQuickCountSubValue('Collars', 1));
    if (decrementQuickCountCollarsBtn) decrementQuickCountCollarsBtn.addEventListener('click', () => updateQuickCountSubValue('Collars', -1));

    // Manage Templates
    if (initiateCreateTemplateBtnScreen) initiateCreateTemplateBtnScreen.addEventListener('click', () => manageTemplate());
    if (importTemplatesBtn) importTemplatesBtn.addEventListener('click', handleImportTemplates);
    if (exportTemplatesBtn) exportTemplatesBtn.addEventListener('click', handleExportTemplates);

    // Tasks (event listeners for filters are in initTasksScreen -> setupTaskControlListeners)
}