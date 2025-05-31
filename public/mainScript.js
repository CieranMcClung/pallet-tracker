document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

// CORE APP INITIALIZATION
async function initializeApp() {
    loadLocalAppState(); // from appState.js
    
    if (typeof templatesCollection !== 'undefined') {
        listenForTemplateChanges(); // from featureTemplates.js
    } else {
        console.warn("Firebase templatesCollection not ready, template changes won't be listened for initially.");
    }
    if (typeof tasksCollection !== 'undefined') {
        listenForTaskChanges(); // from tasks.js
    } else {
        console.warn("Firebase tasksCollection not ready, task changes won't be listened for initially.");
    }

    loadTheme(); // from uiMain.js
    setupEventListeners(); // from uiMain.js
    // Default to dashboardScreen if no activeScreenId or if activeScreenId is invalid
    const validStartScreen = appState.activeScreenId && screens[appState.activeScreenId] ? appState.activeScreenId : 'dashboardScreen';
    navigateToScreen(validStartScreen, true); // from uiMain.js
    updateNetworkStatus(); // from uiMain.js

    requestIdleCallback(checkRequiredInitialData);
    if (typeof initializePalletLocatorPlus === 'function') {
         initializePalletLocatorPlus();
    }
}

function checkRequiredInitialData() {
    const currentShipment = getCurrentShipment();
    if (currentShipment && !currentShipment.startTime && !currentShipment.isArchived && !currentShipment.userSetStartTime) {
         if (appState.activeScreenId === 'planAndPackScreen' && !document.querySelector('.modal-overlay:not(.hidden)')) {
            // This logic for prompting start time on first load can be refined or moved if needed.
            // console.log("Shipment start time check: Eligible for prompt.");
         }
    }
}