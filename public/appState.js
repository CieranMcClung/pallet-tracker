const APP_STATE_KEY = 'palletTrackerAppState_v6.2_pro'; // Incremented for new user structures
const THEME_KEY = 'palletTrackerTheme';
const MAX_IMAGES_PER_SKU = 5;
const SHIPMENT_TAB_THRESHOLD = 4;
const SKU_TAB_THRESHOLD = 6;
const SHIPMENT_LOADING_TIME_LIMIT_HOURS = 3;

// --- NEW: Define Permission Keys ---
const PERMISSIONS = {
    CAN_CREATE_TEMPLATES: 'canCreateTemplates',
    CAN_MANAGE_USERS: 'canManageUsers', // Admin only
    CAN_VIEW_ALL_SHIPMENTS: 'canViewAllShipments', // Example for future
    CAN_EDIT_ANY_TASK: 'canEditAnyTask' // Example for future
};
// --- End NEW ---

let appState = {
    shipments: [],
    currentShipmentIndex: -1,
    quickCountMode: 'basic',
    quickCountValue: 0,
    quickCountReturns: 0,
    quickCountCollars: 0,
    activeScreenId: 'dashboardScreen',
    lastSkuIndexPerShipment: {},
    localTasksCache: [],
    tasksView: {
        searchTerm: '',
        filterStatus: 'all',
        filterPriority: 'all',
        filterDueDate: '',
        filterAssignedTo: '',
        filterTags: '',
        filterArchived: 'no',
        sortBy: 'createdAt_desc'
    },
    settings: {
        shipmentTimeLimitHours: SHIPMENT_LOADING_TIME_LIMIT_HOURS
    },
    currentUser: null, // { uid, email, displayName, role: 'admin' | 'user', permissions: {} }
    managedUsers: [ // Predefined test users + any created by admin
        {
            id: 'managed_testlow_001',
            username: 'testlow',
            tempPassword: 'passwordlow', // INSECURE
            displayName: 'Low Priv User',
            email: 'testlow@example.com',
            role: 'user',
            permissions: {
                [PERMISSIONS.CAN_CREATE_TEMPLATES]: false,
                [PERMISSIONS.CAN_VIEW_ALL_SHIPMENTS]: true, // Can view but not manage fully
                [PERMISSIONS.CAN_EDIT_ANY_TASK]: false,
            }
        },
        {
            id: 'managed_testhigh_002',
            username: 'testhigh',
            tempPassword: 'passwordhigh', // INSECURE
            displayName: 'High Priv User',
            email: 'testhigh@example.com',
            role: 'user',
            permissions: {
                [PERMISSIONS.CAN_CREATE_TEMPLATES]: true,
                [PERMISSIONS.CAN_VIEW_ALL_SHIPMENTS]: true,
                [PERMISSIONS.CAN_EDIT_ANY_TASK]: true, // Can edit tasks, not just their own
            }
        }
    ],
};

function loadLocalAppState() {
    const storedState = localStorage.getItem(APP_STATE_KEY);
    if (storedState) {
        try {
            let parsedState = JSON.parse(storedState);
            if (parsedState === null) parsedState = {};

            // Merge predefined users with stored users, avoiding duplicates by username
            let combinedManagedUsers = [...appState.managedUsers]; // Start with new predefined
            if (parsedState.managedUsers && Array.isArray(parsedState.managedUsers)) {
                parsedState.managedUsers.forEach(storedUser => {
                    if (!combinedManagedUsers.some(predef => predef.username === storedUser.username)) {
                        combinedManagedUsers.push(storedUser);
                    }
                });
            }


            appState = {
                ...appState, // Load new defaults first (like predefined managedUsers)
                ...parsedState, // Then override with stored values
                shipments: parsedState.shipments || [],
                lastSkuIndexPerShipment: parsedState.lastSkuIndexPerShipment || {},
                quickCountMode: parsedState.quickCountMode || 'basic',
                quickCountValue: parsedState.quickCountValue || 0,
                quickCountReturns: parsedState.quickCountReturns || 0,
                quickCountCollars: parsedState.quickCountCollars || 0,
                localTasksCache: (parsedState.localTasksCache || []).map(task => ({
                    ...task,
                    isArchived: task.isArchived === undefined ? false : task.isArchived,
                    dueDate: task.dueDate ? new Date(task.dueDate) : null,
                    createdAt: task.createdAt ? new Date(task.createdAt) : new Date(),
                    updatedAt: task.updatedAt ? new Date(task.updatedAt) : new Date(),
                    completedAt: task.completedAt ? new Date(task.completedAt) : null,
                    createdBy: task.createdBy || { uid: 'unknown', name: 'Unknown' }
                })),
                tasksView: {
                    ...appState.tasksView, // Default from current code
                    ...(parsedState.tasksView || {}),
                    filterArchived: (parsedState.tasksView?.filterArchived) || 'no',
                },
                settings: {
                    ...appState.settings, // Default from current code
                    ...(parsedState.settings || {})
                },
                currentUser: parsedState.currentUser || null,
                managedUsers: combinedManagedUsers.map(u => ({ // Ensure permissions structure for all
                    ...u,
                    role: u.role || 'user', // Default role if missing
                    permissions: {
                        [PERMISSIONS.CAN_CREATE_TEMPLATES]: u.permissions?.[PERMISSIONS.CAN_CREATE_TEMPLATES] || false,
                        [PERMISSIONS.CAN_MANAGE_USERS]: u.permissions?.[PERMISSIONS.CAN_MANAGE_USERS] || false, // Should be false for non-admins
                        [PERMISSIONS.CAN_VIEW_ALL_SHIPMENTS]: u.permissions?.[PERMISSIONS.CAN_VIEW_ALL_SHIPMENTS] || false,
                        [PERMISSIONS.CAN_EDIT_ANY_TASK]: u.permissions?.[PERMISSIONS.CAN_EDIT_ANY_TASK] || false,
                    }
                })),
            };

            // Sanitize currentShipmentIndex (existing logic)
            // ... (keep existing sanitization) ...
             if (appState.currentShipmentIndex >= appState.shipments.length || appState.currentShipmentIndex < -1) {
                appState.currentShipmentIndex = appState.shipments.length > 0 ? 0 : -1;
            }

            appState.shipments.forEach(shipment => {
                if (!shipment.id) shipment.id = `ship_${Date.now()}_${Math.random().toString(36).substring(2,7)}`;
                if (shipment.isArchived === undefined) shipment.isArchived = false;
                // ... (rest of shipment sanitization)
                 if (shipment.forkliftDriver === undefined) shipment.forkliftDriver = '';
                if (shipment.loaderName === undefined) shipment.loaderName = '';
                if (shipment.startTime === undefined) shipment.startTime = null;
                if (shipment.userSetStartTime === undefined) shipment.userSetStartTime = false;
                if (!shipment.skus) shipment.skus = [];

                if (typeof shipment.currentSkuIndex !== 'number' || shipment.currentSkuIndex < -1 || shipment.currentSkuIndex >= shipment.skus.length) {
                    const lastKnownGoodIndex = appState.lastSkuIndexPerShipment[shipment.id];
                    if (typeof lastKnownGoodIndex === 'number' && lastKnownGoodIndex >=0 && lastKnownGoodIndex < shipment.skus.length) {
                        shipment.currentSkuIndex = lastKnownGoodIndex;
                    } else {
                        shipment.currentSkuIndex = shipment.skus.length > 0 ? 0 : -1;
                    }
                }
                shipment.skus.forEach(sku => {
                    if (!sku.palletBuildInfo) sku.palletBuildInfo = { text: '', imageUrls: [] };
                    if (sku.capacities === undefined) sku.capacities = [];
                    if (sku.entries === undefined) sku.entries = [];
                    if (sku.target === undefined) sku.target = 0;
                });
            });


        } catch (e) {
            console.error("Error loading local app state from localStorage:", e);
        }
    }

    // Further sanitization for currentShipmentIndex (existing logic)
    // ... (keep existing sanitization) ...
    if (appState.shipments.length > 0 && appState.currentShipmentIndex === -1) {
        const firstNonArchivedIndex = appState.shipments.findIndex(s => !s.isArchived);
        appState.currentShipmentIndex = firstNonArchivedIndex !== -1 ? firstNonArchivedIndex : 0;
    } else if (appState.currentShipmentIndex > -1 && appState.currentShipmentIndex < appState.shipments.length && appState.shipments[appState.currentShipmentIndex]?.isArchived) {
        const firstNonArchivedIndex = appState.shipments.findIndex(s => !s.isArchived);
        if (firstNonArchivedIndex !== -1) {
            appState.currentShipmentIndex = firstNonArchivedIndex;
        }
    }
}

const saveAppState = () => {
    try {
        const stateToSave = {
            // ... (all existing properties to save)
            shipments: appState.shipments,
            currentShipmentIndex: appState.currentShipmentIndex,
            quickCountMode: appState.quickCountMode,
            quickCountValue: appState.quickCountValue,
            quickCountReturns: appState.quickCountReturns,
            quickCountCollars: appState.quickCountCollars,
            activeScreenId: appState.activeScreenId,
            lastSkuIndexPerShipment: appState.lastSkuIndexPerShipment,
            localTasksCache: appState.localTasksCache.map(task => ({
                ...task,
                dueDate: task.dueDate ? task.dueDate.toISOString() : null,
                createdAt: task.createdAt ? task.createdAt.toISOString() : new Date().toISOString(),
                updatedAt: task.updatedAt ? task.updatedAt.toISOString() : new Date().toISOString(),
                completedAt: task.completedAt ? task.completedAt.toISOString() : null,
            })),
            tasksView: appState.tasksView,
            settings: appState.settings,
            currentUser: appState.currentUser,
            managedUsers: appState.managedUsers,
        };
        const stateString = JSON.stringify(stateToSave);
        if (stateString.length < 5 * 1024 * 1024) {
            requestIdleCallback(() => localStorage.setItem(APP_STATE_KEY, stateString));
        } else {
            console.warn("App state too large to save to localStorage. Size:", (stateString.length / (1024*1024)).toFixed(2) + "MB");
            showModal({
                title: "Storage Warning",
                prompt: "Application data is getting very large and might not save correctly. Consider exporting and clearing some old shipments.",
                inputType: 'none',
                confirmButtonText: "OK"
            });
        }
    } catch (e) {
        console.error("Error saving app state:", e);
    }
};

function getCurrentShipment() { /* ... same ... */ }
function getCurrentSku() { /* ... same ... */ }

function hasPermission(permissionKey) {
    if (!appState.currentUser) return false;
    if (appState.currentUser.role === 'admin') return true; // Admins have all permissions
    return !!appState.currentUser.permissions?.[permissionKey];
}

function canCurrentUserCreateTemplates() {
    return hasPermission(PERMISSIONS.CAN_CREATE_TEMPLATES);
}

function isUserAdmin() {
    return appState.currentUser && appState.currentUser.role === 'admin';
}