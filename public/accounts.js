// accounts.js - Logic for the Account Screen & GDPR considerations

const ADMIN_USERNAME = "Admin";
const ADMIN_PASSWORD = "Admin";

async function initAccountScreen() {
    console.log("Account Screen Initialized");
    renderAccountScreenContent();
}

function renderAccountScreenContent() {
    const accountScreenContent = document.getElementById('accountScreenContent');
    if (!accountScreenContent) return;

    const currentUser = appState.currentUser;
    let contentHTML = '';

    if (currentUser) { // User is "logged in"
        contentHTML = `
            <div class="account-header">
                <div class="account-avatar">${currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : (currentUser.email ? currentUser.email.charAt(0).toUpperCase() : 'U')}</div>
                <div class="account-info">
                    <h2>Welcome, ${currentUser.displayName || currentUser.email}!</h2>
                    <p class="user-role-badge role-${currentUser.role}">${currentUser.role.toUpperCase()}</p>
                </div>
                <button id="logoutBtn" class="btn btn-secondary btn-small">Logout</button>
            </div>
        `;

        if (currentUser.role === 'admin') {
            contentHTML += renderAdminPanel();
        } else {
            contentHTML += renderUserProfilePanel(currentUser);
        }

    } else { // User is not "logged in"
        contentHTML = `
            <div class="login-container">
                <h2>Sign In</h2>
                <p>Access your Pallet Tracker Pro account.</p>
                <div class="form-field"><label for="loginUsername">Username/Email:</label><input type="text" id="loginUsername" class="input-field" value="Admin"></div>
                <div class="form-field"><label for="loginPassword">Password:</label><input type="password" id="loginPassword" class="input-field" value="Admin"></div>
                <button id="loginBtn" class="btn btn-primary full-width-btn">Login</button>
                <p class="note">Mock login. Use 'Admin'/'Admin', 'testlow'/'passwordlow', or 'testhigh'/'passwordhigh'.</p>
            </div>
        `;
    }

    accountScreenContent.innerHTML = contentHTML;
    addAccountScreenEventListeners();
}

function renderAdminPanel() {
    return `
        <div class="admin-panel">
            <h3>Admin Dashboard</h3>
            <div class="admin-sections">
                <div class="admin-section user-management-section">
                    <h4>User Management</h4>
                    <button id="showAddUserFormBtn" class="btn btn-primary btn-small"><svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg> Add New User</button>
                    <div id="addUserFormContainer" class="add-user-form hidden">
                        <h5>Create New User</h5>
                        <div class="form-field"><label for="newUsername">Username:</label><input type="text" id="newUsername" class="input-field"></div>
                        <div class="form-field"><label for="newUserDisplayName">Display Name:</label><input type="text" id="newUserDisplayName" class="input-field"></div>
                        <div class="form-field"><label for="newUserEmail">Email:</label><input type="email" id="newUserEmail" class="input-field"></div>
                        <div class="form-field"><label for="newUserTempPassword">Temporary Password:</label><input type="text" id="newUserTempPassword" class="input-field"></div>
                        <p style="margin-bottom:10px; font-weight:500;">Permissions:</p>
                        <div class="form-field-inline">
                           <input type="checkbox" id="permCanCreateTemplates">
                           <label for="permCanCreateTemplates">Can Create Templates</label>
                        </div>
                         <div class="form-field-inline">
                           <input type="checkbox" id="permCanEditAnyTask">
                           <label for="permCanEditAnyTask">Can Edit Any Task</label>
                        </div>
                        <div class="form-actions">
                            <button id="confirmAddUserBtn" class="btn btn-success btn-small">Create User</button>
                            <button id="cancelAddUserBtn" class="btn btn-secondary btn-small">Cancel</button>
                        </div>
                    </div>
                    <div id="managedUsersList" class="managed-users-table-container">
                        ${renderManagedUsersTable()}
                    </div>
                </div>
                <div class="admin-section app-settings-placeholder">
                    <h4>Application Settings (Placeholder)</h4>
                    <p>Global settings like default time limits, feature flags, etc.</p>
                    <button class="btn btn-secondary btn-small" disabled>Configure App</button>
                </div>
                <div class="admin-section audit-log-placeholder">
                    <h4>Audit Log (Placeholder)</h4>
                    <p>Track important admin actions and system events.</p>
                    <button class="btn btn-secondary btn-small" disabled>View Logs</button>
                </div>
            </div>
        </div>
    `;
}

function renderManagedUsersTable() {
    if (appState.managedUsers.length === 0) return '<p class="empty-list-item">No users managed yet.</p>';
    return `
        <table class="managed-users-table">
            <thead>
                <tr>
                    <th>Username</th>
                    <th>Display Name</th>
                    <th>Email</th>
                    <th>Templates</th>
                    <th>Edit Tasks</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
            ${appState.managedUsers.map(user => `
                <tr class="role-${user.role}">
                    <td>${user.username}</td>
                    <td>${user.displayName || '-'}</td>
                    <td>${user.email || '-'}</td>
                    <td>${user.permissions[PERMISSIONS.CAN_CREATE_TEMPLATES] ? '✅ Yes' : '❌ No'}</td>
                    <td>${user.permissions[PERMISSIONS.CAN_EDIT_ANY_TASK] ? '✅ Yes' : '❌ No'}</td>
                    <td class="actions-cell">
                        <button class="btn btn-icon btn-very-small edit-managed-user-btn" data-userid="${user.id}" title="Edit User">
                            <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="btn btn-icon btn-very-small btn-danger delete-managed-user-btn" data-userid="${user.id}" title="Delete User">
                             <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </td>
                </tr>
            `).join('')}
            </tbody>
        </table>
    `;
}

function renderUserProfilePanel(user) {
     return `
        <div class="user-profile-panel">
            <h3>Your Profile</h3>
            <p><strong>Display Name:</strong> ${user.displayName || 'Not Set'}</p>
            <p><strong>Email:</strong> ${user.email || 'Not Set'}</p>
            <h4>Your Permissions:</h4>
            <ul class="permissions-list">
                <li>Create Templates: ${user.permissions?.[PERMISSIONS.CAN_CREATE_TEMPLATES] ? '<span class="perm-yes">Yes</span>' : '<span class="perm-no">No</span>'}</li>
                <li>Edit Any Task: ${user.permissions?.[PERMISSIONS.CAN_EDIT_ANY_TASK] ? '<span class="perm-yes">Yes</span>' : '<span class="perm-no">No</span>'}</li>
                <!-- Add more permission displays as needed -->
            </ul>
            <p class="note">Contact an administrator to request changes to your permissions.</p>
        </div>
    `;
}


function addAccountScreenEventListeners() {
    document.getElementById('loginBtn')?.addEventListener('click', handleMockLogin);
    document.getElementById('logoutBtn')?.addEventListener('click', handleMockLogout);
    
    document.getElementById('showAddUserFormBtn')?.addEventListener('click', () => {
        document.getElementById('addUserFormContainer').classList.remove('hidden');
        document.getElementById('showAddUserFormBtn').classList.add('hidden');
        clearAddUserForm();
    });
    document.getElementById('cancelAddUserBtn')?.addEventListener('click', () => {
        document.getElementById('addUserFormContainer').classList.add('hidden');
        document.getElementById('showAddUserFormBtn').classList.remove('hidden');
    });
    document.getElementById('confirmAddUserBtn')?.addEventListener('click', handleAddOrUpdateManagedUser);

    document.querySelectorAll('.edit-managed-user-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const userId = e.currentTarget.dataset.userid;
            openEditUserModal(userId);
        });
    });
    document.querySelectorAll('.delete-managed-user-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const userId = e.currentTarget.dataset.userid;
            deleteManagedUser(userId);
        });
    });
}

function clearAddUserForm(editingUser = null) {
    document.getElementById('newUsername').value = editingUser?.username || '';
    document.getElementById('newUserDisplayName').value = editingUser?.displayName || '';
    document.getElementById('newUserEmail').value = editingUser?.email || '';
    document.getElementById('newUserTempPassword').value = editingUser?.tempPassword || ''; // Show for edit for mock, real app would have "reset password"
    document.getElementById('permCanCreateTemplates').checked = editingUser?.permissions?.[PERMISSIONS.CAN_CREATE_TEMPLATES] || false;
    document.getElementById('permCanEditAnyTask').checked = editingUser?.permissions?.[PERMISSIONS.CAN_EDIT_ANY_TASK] || false;
    document.getElementById('newUsername').disabled = !!editingUser; // Don't allow username change on edit
    document.getElementById('confirmAddUserBtn').dataset.editingUserId = editingUser?.id || '';
    document.getElementById('confirmAddUserBtn').textContent = editingUser ? 'Update User' : 'Create User';
    document.querySelector('#addUserFormContainer h5').textContent = editingUser ? 'Edit User' : 'Create New User';
}


function openEditUserModal(userId) {
    const userToEdit = appState.managedUsers.find(u => u.id === userId);
    if (userToEdit) {
        clearAddUserForm(userToEdit); // Populate form with user's data
        document.getElementById('addUserFormContainer').classList.remove('hidden');
        document.getElementById('showAddUserFormBtn').classList.add('hidden');
    }
}


function handleMockLogin() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        appState.currentUser = {
            uid: 'admin_mock_uid',
            email: 'admin@pallettracker.pro',
            displayName: 'Administrator',
            role: 'admin',
            permissions: { // Admin has all permissions implicitly
                [PERMISSIONS.CAN_CREATE_TEMPLATES]: true,
                [PERMISSIONS.CAN_MANAGE_USERS]: true,
                [PERMISSIONS.CAN_VIEW_ALL_SHIPMENTS]: true,
                [PERMISSIONS.CAN_EDIT_ANY_TASK]: true,
            }
        };
    } else {
        const foundUser = appState.managedUsers.find(u => u.username.toLowerCase() === username.toLowerCase() && u.tempPassword === password);
        if (foundUser) {
            appState.currentUser = {
                uid: foundUser.id,
                email: foundUser.email || `${foundUser.username}@pallettracker.local`,
                displayName: foundUser.displayName || foundUser.username,
                role: 'user',
                permissions: foundUser.permissions || {} // Use stored permissions
            };
        } else {
            showModal({title: "Login Failed", prompt: "Invalid username or password.", inputType:'none', confirmButtonText:"OK"});
            return; // Stop if login fails
        }
    }
    saveAppState();
    renderAccountScreenContent();
    showModal({title: "Login Successful", prompt: `Logged in as ${appState.currentUser.displayName}.`, inputType:'none', confirmButtonText:"OK"});
    updateNavBasedOnLogin();
    updateTemplateCreationAvailability(); // Update UI elements that depend on permissions
}

function handleMockLogout() {
    appState.currentUser = null;
    saveAppState();
    renderAccountScreenContent();
    showModal({title: "Logout Successful", prompt: "You have been logged out.", inputType:'none', confirmButtonText:"OK"});
    updateNavBasedOnLogin();
    updateTemplateCreationAvailability();
}

function handleAddOrUpdateManagedUser() {
    const editingUserId = document.getElementById('confirmAddUserBtn').dataset.editingUserId;
    const username = document.getElementById('newUsername').value.trim();
    const displayName = document.getElementById('newUserDisplayName').value.trim();
    const email = document.getElementById('newUserEmail').value.trim();
    const tempPassword = document.getElementById('newUserTempPassword').value.trim();

    const canCreateTemplates = document.getElementById('permCanCreateTemplates').checked;
    const canEditAnyTask = document.getElementById('permCanEditAnyTask').checked;

    if (!username || (!editingUserId && !tempPassword)) { // Password required for new users
        showModal({title: "Error", prompt: "Username and temporary password are required for new users.", inputType: 'none', confirmButtonText: "OK"});
        return;
    }

    if (!editingUserId && appState.managedUsers.find(u => u.username.toLowerCase() === username.toLowerCase())) {
        showModal({title: "Error", prompt: `User "${username}" already exists.`, inputType: 'none', confirmButtonText: "OK"});
        return;
    }
    
    const userPermissions = {
        [PERMISSIONS.CAN_CREATE_TEMPLATES]: canCreateTemplates,
        [PERMISSIONS.CAN_EDIT_ANY_TASK]: canEditAnyTask,
        // Add other specific permissions here, default to false
        [PERMISSIONS.CAN_VIEW_ALL_SHIPMENTS]: true, // Example: all users can view
    };

    if (editingUserId) { // Editing existing user
        const userIndex = appState.managedUsers.findIndex(u => u.id === editingUserId);
        if (userIndex > -1) {
            appState.managedUsers[userIndex] = {
                ...appState.managedUsers[userIndex],
                displayName: displayName || appState.managedUsers[userIndex].displayName,
                email: email || appState.managedUsers[userIndex].email,
                tempPassword: tempPassword || appState.managedUsers[userIndex].tempPassword, // Update password if provided
                permissions: userPermissions,
                role: 'user' // Ensure role is user
            };
        }
    } else { // Adding new user
        const newUser = {
            id: `managed_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,
            username,
            displayName: displayName || username,
            email,
            tempPassword,
            permissions: userPermissions,
            role: 'user'
        };
        appState.managedUsers.push(newUser);
    }

    saveAppState();
    renderAccountScreenContent();
    document.getElementById('addUserFormContainer').classList.add('hidden');
    document.getElementById('showAddUserFormBtn').classList.remove('hidden');
}


async function deleteManagedUser(userId) {
    const user = appState.managedUsers.find(u => u.id === userId);
    if (!user) return;

    const confirmed = await showModal({
        title: "Delete Managed User?",
        prompt: `Are you sure you want to delete the user "${user.username}"? This action cannot be undone.`,
        inputType: 'none',
        confirmButtonText: "Yes, Delete User",
        cancelButtonText: "Cancel"
    });

    if (confirmed) {
        appState.managedUsers = appState.managedUsers.filter(u => u.id !== userId);
        saveAppState();
        renderAccountScreenContent();
    }
}