function getPalletLocatorPlusHTML() {
    return `
    <div class="plp-dashboard">
        <aside class="plp-sidebar">
            <div class="plp-sidebar-header">
                <h2>Pallet Locator (Under Develpement)</h2>
            </div>
            <nav class="plp-sidebar-nav">
                <ul>
                    <li><a href="#" class="active"><span class="plp-nav-icon plp-icon-dashboard"></span>Dashboard</a></li>
                    <li><a href="#"><span class="plp-nav-icon plp-icon-live"></span>Live Locations</a></li>
                    <li><a href="#"><span class="plp-nav-icon plp-icon-add"></span>Add Pallet</a></li>
                    <li><a href="#"><span class="plp-nav-icon plp-icon-update"></span>Update Item</a></li>
                    <li><a href="#"><span class="plp-nav-icon plp-icon-history"></span>Movement History</a></li>
                    <li><a href="#"><span class="plp-nav-icon plp-icon-logs"></span>Driver Logs</a></li>
                    <li><a href="#"><span class="plp-nav-icon plp-icon-reports"></span>Reports</a></li>
                    <li><a href="#"><span class="plp-nav-icon plp-icon-backups"></span>Backups</a></li>
                    <li><a href="#"><span class="plp-nav-icon plp-icon-settings"></span>Settings</a></li>
                </ul>
            </nav>
            <div class="plp-sidebar-footer">
            </div>
        </aside>

        <div class="plp-main-content">
            <header class="plp-header">
                <h1>Warehouse Location Manager</h1>
                <div class="plp-user-profile">
                    <span>Welcome, User!</span>
                    <div class="plp-user-avatar">U</div>
                </div>
            </header>

            <main class="plp-content-area">
                <div class="plp-controls">
                    <div class="plp-search-bar">
                         <span class="plp-search-icon"></span>
                        <input type="search" placeholder="Search Item Code (e.g., GATE91, SKU12345)..." disabled>
                    </div>
                    <div class="plp-filters">
                        <select id="plp-filter-zone" disabled><option value="">All Zones</option><option value="zone1">Zone 1</option><option value="zone2">Zone 2</option><option value="staging">Staging</option></select>
                        <select id="plp-filter-status" disabled><option value="">All Statuses</option><option value="active">Active</option><option value="pending">Pending</option><option value="empty">Empty</option></select>
                         <button class="plp-btn plp-btn-filter" disabled>Apply Filters</button>
                         <button class="plp-btn plp-btn-primary" disabled><span class="plp-icon-add" style="margin-right: 5px;"></span>New Entry</button>
                    </div>
                </div>

                <table class="plp-data-table">
                    <thead>
                        <tr>
                            <th>Item Code</th><th>Location</th><th>Status</th><th>Last Updated</th><th>Updated By</th><th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                    </tbody>
                </table>
                 <div class="plp-pagination">
                    <button class="plp-btn plp-btn-secondary" disabled>&laquo; Prev</button>
                    <span>Page 1 of 1</span>
                    <button class="plp-btn plp-btn-secondary" disabled>Next &raquo;</button>
                </div>
            </main>
            <div class="plp-development-notice">
                <strong>Pallet Locator Plus</strong>
                This is a visual demonstration. Functionality is currently limited.
            </div>
        </div>
    </div>
    `;
}

function initializePalletLocatorPlus() {
    const plpScreenContainer = document.getElementById('palletLocatorScreen');
    if (plpScreenContainer && !plpScreenContainer.querySelector('.plp-dashboard')) {
        plpScreenContainer.innerHTML = getPalletLocatorPlusHTML();
        if (!document.querySelector('link[href="palletLocatorPlus.css"]')) {
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet'; cssLink.href = 'palletLocatorPlus.css';
            document.head.appendChild(cssLink);
        }
        const navLinks = plpScreenContainer.querySelectorAll('.plp-sidebar-nav li a');
        if (navLinks.length > 0) {
            navLinks.forEach(link => {
                if (!link.dataset.plpListener) {
                    link.addEventListener('click', function(e) {
                        e.preventDefault();
                        navLinks.forEach(l => l.classList.remove('active'));
                        this.classList.add('active');
                    });
                    link.dataset.plpListener = 'true';
                }
            });
        }
    } else if (!plpScreenContainer) {
        console.error('Pallet Locator Plus container (#palletLocatorScreen) not found!');
    }
}