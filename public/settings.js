// settings.js - Handles UI interactions specific to the settings screen.
document.addEventListener('DOMContentLoaded', function () {
    const settingsThemeToggleBtn = document.getElementById('settingsThemeToggleBtn');
    const versionNumberSpan = document.getElementById('versionNumber');
    const shipmentTimeLimitInput = document.getElementById('settingShipmentTimeLimit');
    const saveAppSettingsBtn = document.getElementById('saveAppSettingsBtn');
    const settingsStatusMessage = document.getElementById('settingsStatusMessage');

    // Load current settings into form fields
    if (shipmentTimeLimitInput) {
        shipmentTimeLimitInput.value = appState.settings.shipmentTimeLimitHours || SHIPMENT_LOADING_TIME_LIMIT_HOURS;
    }

    if (versionNumberSpan) {
        fetch('version.json?t=' + new Date().getTime())
            .then(response => {
                if (!response.ok) throw new Error('Failed to load version info');
                return response.json();
            })
            .then(data => {
                versionNumberSpan.textContent = data && data.version ? data.version.replace('pallet-tracker-v', 'v') : "Unknown";
            })
            .catch(error => {
                console.error("Error fetching version.json for settings:", error);
                versionNumberSpan.textContent = "Error";
            });
    }

    if (settingsThemeToggleBtn) {
        settingsThemeToggleBtn.addEventListener('click', () => {
            toggleTheme(); // from uiMain.js
        });
    }

    if (saveAppSettingsBtn && shipmentTimeLimitInput && settingsStatusMessage) {
        saveAppSettingsBtn.addEventListener('click', () => {
            const newLimit = parseFloat(shipmentTimeLimitInput.value);
            if (isNaN(newLimit) || newLimit < 0.1 || newLimit > 99) {
                settingsStatusMessage.textContent = 'Invalid time limit. Must be between 0.1 and 99 hours.';
                settingsStatusMessage.className = 'settings-status-message error';
                settingsStatusMessage.classList.remove('hidden');
                return;
            }
            appState.settings.shipmentTimeLimitHours = newLimit;
            saveAppState();
            settingsStatusMessage.textContent = 'Settings saved successfully!';
            settingsStatusMessage.className = 'settings-status-message success';
            settingsStatusMessage.classList.remove('hidden');
            setTimeout(() => settingsStatusMessage.classList.add('hidden'), 3000);

            // If on Plan & Pack, re-render health meter as limit might have changed
            if (appState.activeScreenId === 'planAndPackScreen') {
                updateShipmentHealthMeter();
            }
        });
    }

});

// Called when settings screen is navigated to
function initSettingsScreen() {
    const shipmentTimeLimitInput = document.getElementById('settingShipmentTimeLimit');
    if (shipmentTimeLimitInput) {
        shipmentTimeLimitInput.value = appState.settings.shipmentTimeLimitHours || SHIPMENT_LOADING_TIME_LIMIT_HOURS;
    }
    const settingsStatusMessage = document.getElementById('settingsStatusMessage');
    if (settingsStatusMessage) {
        settingsStatusMessage.classList.add('hidden');
    }
}