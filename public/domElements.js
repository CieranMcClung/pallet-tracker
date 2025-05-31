// DOM Element References

const bodyElement = document.body;
const navToggleBtn = document.getElementById('navToggleBtn');
const sideNav = document.getElementById('sideNav');
const navOverlay = document.getElementById('navOverlay');
const themeToggleBtnLight = document.getElementById('themeToggleBtnLight');
const themeToggleBtnDark = document.getElementById('themeToggleBtnDark');
const navItems = document.querySelectorAll('.nav-item');
const appTitleText = document.getElementById('appTitle');
const networkStatusIndicator = document.getElementById('networkStatusIndicator');

// Screens
const planAndPackScreen = document.getElementById('planAndPackScreen');
const quickCountScreen = document.getElementById('quickCountScreen');
const manageTemplatesScreen = document.getElementById('manageTemplatesScreen');
const palletLocatorScreen = document.getElementById('palletLocatorScreen'); 
const tasksScreen = document.getElementById('tasksScreen');
const settingsScreen = document.getElementById('settingsScreen');
const dashboardScreen = document.getElementById('dashboardScreen');
const accountScreen = document.getElementById('accountScreen');
const screens = { planAndPackScreen, quickCountScreen, manageTemplatesScreen, palletLocatorScreen, tasksScreen, settingsScreen, dashboardScreen, accountScreen };

// Plan & Pack Screen Elements
const shipmentSelectionContainer = document.getElementById('shipmentSelectionContainer');
const shipmentTabsContainer = document.getElementById('shipmentTabsContainer');
const shipmentSelect = document.getElementById('shipmentSelect');
const newShipmentBtn = document.getElementById('newShipmentBtn');
const createFromTemplateBtn = document.getElementById('createFromTemplateBtn');
const finishShipmentBtn = document.getElementById('finishShipmentBtn');
const editShipmentDetailsBtn = document.getElementById('editShipmentDetailsBtn');
const saveAsTemplateBtn = document.getElementById('saveAsTemplateBtn');
const deleteCurrentShipmentBtn = document.getElementById('deleteCurrentShipmentBtn');
const shipmentArchivedMessage = document.getElementById('shipmentArchivedMessage');
const unarchiveShipmentBtn = document.getElementById('unarchiveShipmentBtn');
const shipmentDetailsDisplay = document.getElementById('shipmentDetailsDisplay');
const displayForkliftDriver = document.getElementById('displayForkliftDriver');
const displayLoaderName = document.getElementById('displayLoaderName');
const displayShipmentStartTime = document.getElementById('displayShipmentStartTime');
const setShipmentStartTimeBtn = document.getElementById('setShipmentStartTimeBtn');
const setShipmentStartTimeBtnText = document.getElementById('setShipmentStartTimeBtnText');
const shipmentTimeSection = document.getElementById('shipmentTimeSection');
const startTimeMissingWarning = document.getElementById('startTimeMissingWarning');
const shipmentHealthMeterContainer = document.getElementById('shipmentHealthMeterContainer');
const shipmentHealthMeterFill = document.getElementById('shipmentHealthMeterFill');
const timeDurationDisplay = document.getElementById('timeDuration');
const estFinishTimeDisplay = document.getElementById('estFinishTime');
const avgTimePerPalletDisplay = document.getElementById('avgTimePerPallet');
const timeRemainingInLimitDisplay = document.getElementById('timeRemainingInLimit');
const shipmentHealthWarning = document.getElementById('shipmentHealthWarning');

const skuSearchInput = document.getElementById('skuSearchInput');
const skuTabsContainer = document.getElementById('skuTabsContainer');
const skuSelectElement = document.getElementById('skuSelect');
const addSkuBtn = document.getElementById('addSkuBtn');
const editSelectedSkuBtn = document.getElementById('editSelectedSkuBtn');
const deleteSelectedSkuBtn = document.getElementById('deleteSelectedSkuBtn');

const shipmentEmptyState = document.getElementById('shipmentEmptyState');
const skuSelectEmptyState = document.getElementById('skuSelectEmptyState');
const skuPackingUI = document.getElementById('skuPackingUI');
const packingDisabledOverlay = document.getElementById('packingDisabledOverlay');
const setStartTimeFromOverlayBtn = document.getElementById('setStartTimeFromOverlayBtn');
const skuCodeDisplay = document.getElementById('codeDisplay');
const skuTargetDisplay = document.getElementById('totalDisplay');
const skuUnitsLeftDisplay = document.getElementById('leftDisplay');
const skuPalletsUsedDisplay = document.getElementById('palletsDisplay');
const skuPalletsLeftDisplay = document.getElementById('palletsLeftDisplay');
const palletCapacitiesContainer = document.getElementById('palletCapacitiesContainer');
const palletCapacityDisplay = document.getElementById('palletCapacityDisplay');
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

// Quick Count Screen Elements
const quickCountModeToggle = document.getElementById('quickCountModeToggle');
const quickCountDisplayContainer = document.getElementById('quickCountDisplayContainer');
const quickCountDisplay = document.getElementById('quickCountDisplay');
const recordQuickCountBtn = document.getElementById('recordQuickCountBtn');
const quickCountAdvancedSection = document.getElementById('quickCountAdvancedSection');
const quickCountReturnsDisplay = document.getElementById('quickCountReturnsDisplay');
const incrementQuickCountReturnsBtn = document.getElementById('incrementQuickCountReturnsBtn');
const decrementQuickCountReturnsBtn = document.getElementById('decrementQuickCountReturnsBtn');
const quickCountCollarsDisplay = document.getElementById('quickCountCollarsDisplay');
const incrementQuickCountCollarsBtn = document.getElementById('incrementQuickCountCollarsBtn');
const decrementQuickCountCollarsBtn = document.getElementById('decrementQuickCountCollarsBtn');
const undoQuickCountBtn = document.getElementById('undoQuickCountBtn');
const resetQuickCountBtn = document.getElementById('resetQuickCountBtn');

// Manage Templates Screen Elements
const initiateCreateTemplateBtnScreen = document.getElementById('initiateCreateTemplateBtnScreen');
const templatesListContainer = document.getElementById('templatesListContainer');
const noTemplatesState = document.getElementById('noTemplatesState');
const importTemplatesBtn = document.getElementById('importTemplatesBtn');
const exportTemplatesBtn = document.getElementById('exportTemplatesBtn');

// Tasks Screen Elements
const createNewTaskBtn = document.getElementById('createNewTaskBtn'); 
const tasksListContainer = document.getElementById('tasksListContainer');
const noTasksState = document.getElementById('noTasksState');
const taskFilterStatus = document.getElementById('taskFilterStatus');
const taskFilterPriority = document.getElementById('taskFilterPriority');
const taskFilterDueDate = document.getElementById('taskFilterDueDate');
const taskFilterAssignedTo = document.getElementById('taskFilterAssignedTo');
const taskFilterTags = document.getElementById('taskFilterTags');
const taskFilterArchived = document.getElementById('taskFilterArchived');
const taskSearchInput = document.getElementById('taskSearchInput'); 
const taskSortSelect = document.getElementById('taskSortSelect');
const taskGlobalStatusMessage = document.getElementById('taskGlobalStatusMessage');


// Modal Elements
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