// dashboard.js - Logic for the Dashboard Screen

function initDashboardScreen() {
    console.log("Dashboard Screen Initialized");
    const dashboardScreenContent = document.getElementById('dashboardScreenContent');
    if (!dashboardScreenContent) {
        const dashboardScreen = document.getElementById('dashboardScreen');
        if (dashboardScreen) dashboardScreen.innerHTML = '<p>Loading Dashboard...</p>';
        return;
    }

    // --- Data Collection for Dashboard ---
    let activeShipmentsCount = 0;
    let totalPalletsPackedToday = 0;
    let upcomingDueTasksCount = 0;
    let completedTasksTodayCount = 0;
    let recentShipmentActivity = []; // Array of { name, progress, id }

    if (appState.shipments) {
        const activeShipments = appState.shipments.filter(s => !s.isArchived);
        activeShipmentsCount = activeShipments.length;

        const todayStart = new Date().setHours(0, 0, 0, 0);
        activeShipments.forEach(shipment => {
            let shipmentPalletsToday = 0;
            let totalShipmentTarget = 0;
            let totalShipmentPacked = 0;

            (shipment.skus || []).forEach(sku => {
                totalShipmentTarget += (sku.target || 0);
                (sku.entries || []).forEach(entry => {
                    totalShipmentPacked += (entry.capacityUsed * entry.palletCount);
                    if (new Date(entry.timestamp).setHours(0,0,0,0) === todayStart) {
                        shipmentPalletsToday += entry.palletCount;
                    }
                });
            });
            totalPalletsPackedToday += shipmentPalletsToday;
            if (activeShipmentsCount <= 5 || shipment.startTime) {
                 let percentage = (totalShipmentTarget > 0) ? (totalShipmentPacked / totalShipmentTarget) * 100 : (totalShipmentPacked > 0 ? 0 : 0); // Handle case where only packed but no target
                 percentage = Math.max(0, Math.min(100, percentage));
                recentShipmentActivity.push({ name: shipment.name, progress: Math.round(percentage), id: shipment.id, startTime: shipment.startTime });
            }
        });
        recentShipmentActivity.sort((a,b) => (b.startTime || 0) - (a.startTime || 0));
        recentShipmentActivity = recentShipmentActivity.slice(0,5);
    }

    if (appState.localTasksCache) {
        const today = new Date();
        const todayStart = new Date().setHours(0, 0, 0, 0);
        const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        appState.localTasksCache.forEach(task => {
            if (!task.isArchived && task.status !== 'completed') {
                if (task.dueDate && new Date(task.dueDate) >= today && new Date(task.dueDate) <= sevenDaysFromNow) {
                    upcomingDueTasksCount++;
                }
            }
            if (task.completedAt && new Date(task.completedAt).setHours(0,0,0,0) === todayStart) {
                completedTasksTodayCount++;
            }
        });
    }
    // --- End Data Collection ---

    const htmlContent = `
        <div class="dashboard-header-stats">
            <div class="stat-item">
                <span class="stat-label">Active Shipments</span>
                <span class="stat-value highlight-value">${activeShipmentsCount}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Pallets Packed Today</span>
                <span class="stat-value">${totalPalletsPackedToday}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Upcoming Tasks (7 days)</span>
                <span class="stat-value ${upcomingDueTasksCount > 0 ? 'warning-value' : ''}">${upcomingDueTasksCount}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Tasks Completed Today</span>
                <span class="stat-value">${completedTasksTodayCount}</span>
            </div>
        </div>

        <div class="dashboard-main-grid">
            <div class="dashboard-widget widget-shipment-activity">
                <h4>Recent Shipment Activity</h4>
                ${recentShipmentActivity.length > 0 ? `
                    <ul class="activity-list">
                        ${recentShipmentActivity.map(ship => `
                            <li>
                                <span class="activity-name" title="${ship.name}">${ship.name}</span>
                                <div class="activity-progress-bar">
                                    <div class="activity-progress-fill" style="width: ${ship.progress}%;"></div>
                                </div>
                                <span class="activity-percentage">${ship.progress}%</span>
                                <button class="btn btn-secondary btn-very-small view-shipment-details" data-shipment-id="${ship.id}">View</button>
                            </li>
                        `).join('')}
                    </ul>` : '<p class="no-activity">No recent shipment activity or no active shipments.</p>'
                }
                <button class="btn btn-primary btn-small full-width-btn view-all-shipments-btn">View All Shipments</button>
            </div>

            <div class="dashboard-widget widget-quick-actions">
                <h4>Quick Actions</h4>
                <button class="btn btn-secondary full-width-btn action-new-shipment"><svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>New Shipment</button>
                <button class="btn btn-secondary full-width-btn action-new-task"><svg viewBox="0 0 24 24"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><line x1="12" y1="10" x2="12" y2="16"></line><line x1="9" y1="13" x2="15" y2="13"></line></svg>Create Task</button>
                <button class="btn btn-secondary full-width-btn action-go-quickcount"><svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>Quick Count</button>
            </div>
            
            <div class="dashboard-widget widget-task-overview">
                <h4>Task Overview</h4>
                <div class="task-summary-chart">
                    ${generateTaskChartHTML(appState.localTasksCache)}
                </div>
                <button class="btn btn-primary btn-small full-width-btn view-all-tasks-btn">Manage All Tasks</button>
            </div>
        </div>
    `;

    dashboardScreenContent.innerHTML = htmlContent;
    addDashboardEventListeners();
}

function generateTaskChartHTML(tasks) {
    if (!tasks || tasks.length === 0) return '<p class="no-activity">No tasks to display.</p>';
    
    const statusCounts = { todo: 0, inprogress: 0, completed: 0, onhold: 0 };
    let activeTasksCount = 0;
    tasks.forEach(task => {
        if (!task.isArchived) {
            statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
            activeTasksCount++;
        }
    });

    if (activeTasksCount === 0) return '<p class="no-activity">No active tasks.</p>';

    const chartItems = Object.entries(statusCounts).map(([status, count]) => {
        const percentage = activeTasksCount > 0 ? (count / activeTasksCount) * 100 : 0;
        return { status, count, percentage };
    });

    return `
        <div class="chart-legend">
            ${chartItems.map(item => `
                <div class="legend-item">
                    <span class="legend-color-box status-${item.status}"></span>
                    <span class="legend-label">${item.status.charAt(0).toUpperCase() + item.status.slice(1)}: ${item.count}</span>
                </div>
            `).join('')}
        </div>
        <div class="bar-chart-container">
            ${chartItems.map(item => `
                <div class="bar-chart-bar status-${item.status}" style="width: ${item.percentage.toFixed(2)}%;" title="${item.status.charAt(0).toUpperCase() + item.status.slice(1)}: ${item.count} (${item.percentage.toFixed(1)}%)">
                </div>
            `).join('')}
        </div>
    `;
}


function addDashboardEventListeners() {
    document.querySelectorAll('.view-shipment-details').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const shipmentId = e.currentTarget.dataset.shipmentId;
            const shipmentIndex = appState.shipments.findIndex(s => s.id === shipmentId);
            if (shipmentIndex !== -1) {
                appState.currentShipmentIndex = shipmentIndex;
                saveAppState();
                navigateToScreen('planAndPackScreen');
            } else {
                showModal({title: "Error", prompt: "Shipment not found.", inputType: 'none', confirmButtonText: "OK"});
            }
        });
    });
    document.querySelector('.view-all-shipments-btn')?.addEventListener('click', () => navigateToScreen('planAndPackScreen'));
    document.querySelector('.action-new-shipment')?.addEventListener('click', () => {
        navigateToScreen('planAndPackScreen'); 
        setTimeout(() => handleNewShipment(), 50); 
    });
    document.querySelector('.action-new-task')?.addEventListener('click', () => {
        navigateToScreen('tasksScreen');
        setTimeout(() => handleCreateOrEditTask(), 50);
    });
    document.querySelector('.action-go-quickcount')?.addEventListener('click', () => navigateToScreen('quickCountScreen'));
    document.querySelector('.view-all-tasks-btn')?.addEventListener('click', () => navigateToScreen('tasksScreen'));
}