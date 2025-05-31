function initQuickCountScreen() {
    if (quickCountModeToggle) quickCountModeToggle.value = appState.quickCountMode;
    updateQuickCountUIDisplay();
}

function handleQuickCountModeChange() {
    if (!quickCountModeToggle) return;
    appState.quickCountMode = quickCountModeToggle.value;
    saveAppState();
    updateQuickCountUIDisplay();
}

function updateQuickCountUIDisplay() {
    if (quickCountDisplay) {
        quickCountDisplay.textContent = appState.quickCountValue;

        if (quickCountDisplay.classList.contains('updated')) {
            quickCountDisplay.classList.remove('updated');
            void quickCountDisplay.offsetWidth; 
        }
        quickCountDisplay.classList.add('updated');
    }
    if (quickCountAdvancedSection) {
        quickCountAdvancedSection.classList.toggle('hidden', appState.quickCountMode === 'basic');
    }
    if (appState.quickCountMode === 'advanced') {
        if (quickCountReturnsDisplay) {
             quickCountReturnsDisplay.textContent = appState.quickCountReturns;

        }
        if (quickCountCollarsDisplay) {
            quickCountCollarsDisplay.textContent = appState.quickCountCollars;
        }
    }
}

function incrementQuickCountLoaded() {
    appState.quickCountValue++;
    updateQuickCountUIDisplay(); 
    saveAppState();
}
function decrementQuickCountLoaded() {
    if (appState.quickCountValue > 0) {
        appState.quickCountValue--;
        updateQuickCountUIDisplay(); 
        saveAppState();
    } else {
        if(quickCountDisplay) {
            quickCountDisplay.classList.add('shake');
            setTimeout(() => quickCountDisplay.classList.remove('shake'), 300);
        }
    }
}

function updateQuickCountSubValue(type, change) {
    if (appState.quickCountMode !== 'advanced') return;
    let displayElement;
    let oldValue;

    if (type === 'returns') {
        oldValue = appState.quickCountReturns;
        appState.quickCountReturns = Math.max(0, appState.quickCountReturns + change);
        displayElement = quickCountReturnsDisplay;
        if (appState.quickCountReturns === oldValue && change < 0 && oldValue === 0) { 
             if(displayElement) { displayElement.classList.add('shake'); setTimeout(() => displayElement.classList.remove('shake'), 300); }
        }
    } else if (type === 'Collars') {
        oldValue = appState.quickCountCollars;
        appState.quickCountCollars = Math.max(0, appState.quickCountCollars + change);
        displayElement = quickCountCollarsDisplay;
        if (appState.quickCountCollars === oldValue && change < 0 && oldValue === 0) { 
             if(displayElement) { displayElement.classList.add('shake'); setTimeout(() => displayElement.classList.remove('shake'), 300); }
        }
    }

    if (displayElement) {
        displayElement.textContent = type === 'returns' ? appState.quickCountReturns : appState.quickCountCollars;
        if (displayElement.classList.contains('updated')) {
            displayElement.classList.remove('updated');
            void displayElement.offsetWidth; 
        }
        displayElement.classList.add('updated');
    }
    saveAppState();
}

async function confirmResetAllQuickCounts() {
    if (appState.quickCountValue === 0 && appState.quickCountReturns === 0 && appState.quickCountCollars === 0) {

        return;
    }
    let currentCounts = `Loaded: ${appState.quickCountValue}`;
    if (appState.quickCountMode === 'advanced') {
        currentCounts += `, Returns: ${appState.quickCountReturns}, Collars: ${appState.quickCountCollars}`;
    }
    const confirmed = await showModal({
        title: "Reset All Quick Counts?", prompt: `Current counts are:\n${currentCounts}.\n\nThis will reset ALL displayed counts to 0. Type "RESET" to confirm.`,
        inputType: "text", placeholder: 'Type RESET to confirm', needsConfirmation: true, confirmKeyword: "RESET",
        confirmButtonText: "Confirm Reset"
    });
    if (String(confirmed).toUpperCase() === "RESET") {
        appState.quickCountValue = 0;
        appState.quickCountReturns = 0;
        appState.quickCountCollars = 0;
        if (quickCountDisplay) quickCountDisplay.textContent = appState.quickCountValue;
        if (quickCountReturnsDisplay) quickCountReturnsDisplay.textContent = appState.quickCountReturns;
        if (quickCountCollarsDisplay) quickCountCollarsDisplay.textContent = appState.quickCountCollars;
        saveAppState();
    }
}