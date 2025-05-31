function listenForTaskChanges() {
    if (!tasksCollection) {
        console.warn("Tasks collection (Firestore) not available. Cannot listen for task changes.");
        if (appState.activeScreenId === 'tasksScreen' && taskGlobalStatusMessage) {
            taskGlobalStatusMessage.textContent = 'Error: Cannot connect to task service.';
            taskGlobalStatusMessage.className = 'settings-status-message error';
            taskGlobalStatusMessage.classList.remove('hidden');
        }
        if (appState.activeScreenId === 'tasksScreen') renderTasksList();
        return;
    }

    let query = tasksCollection.orderBy("createdAt", "desc");

    query.onSnapshot(snapshot => {
        const newTasks = [];
        snapshot.forEach(doc => {
            const taskData = doc.data();
            newTasks.push({
                id: doc.id, ...taskData,
                dueDate: taskData.dueDate?.toDate ? taskData.dueDate.toDate() : (taskData.dueDate ? new Date(taskData.dueDate) : null),
                createdAt: taskData.createdAt?.toDate ? taskData.createdAt.toDate() : new Date(),
                updatedAt: taskData.updatedAt?.toDate ? taskData.updatedAt.toDate() : new Date(),
                completedAt: taskData.completedAt?.toDate ? taskData.completedAt.toDate() : null,
                isArchived: taskData.isArchived === undefined ? false : taskData.isArchived,
                createdBy: taskData.createdBy || { uid: 'unknown', name: 'Unknown' }
            });
        });
        appState.localTasksCache = newTasks;
        if (appState.activeScreenId === 'tasksScreen') {
            renderTasksList();
        }
        saveAppState();
    }, error => {
        console.error("Error fetching tasks from Firestore: ", error);
        if (appState.activeScreenId === 'tasksScreen') {
            if(tasksListContainer) tasksListContainer.innerHTML = `<p class="error-message centered-text">Could not load tasks. Displaying locally cached tasks if available. Error: ${error.message}</p>`;
            if(noTasksState) noTasksState.classList.remove('hidden');
            renderTasksList();
        }
        if (taskGlobalStatusMessage) {
            taskGlobalStatusMessage.textContent = `Error loading tasks: ${error.message}. Offline data may be shown.`;
            taskGlobalStatusMessage.className = 'settings-status-message error';
            taskGlobalStatusMessage.classList.remove('hidden');
        }
    });
}

function initTasksScreen() {
    if(taskFilterStatus) taskFilterStatus.value = appState.tasksView.filterStatus;
    if(taskFilterPriority) taskFilterPriority.value = appState.tasksView.filterPriority;
    if(taskFilterDueDate) taskFilterDueDate.value = appState.tasksView.filterDueDate ? new Date(appState.tasksView.filterDueDate).toISOString().split('T')[0] : '';
    if(taskFilterAssignedTo) taskFilterAssignedTo.value = appState.tasksView.filterAssignedTo;
    if(taskFilterTags) taskFilterTags.value = appState.tasksView.filterTags;
    if(taskFilterArchived) taskFilterArchived.value = appState.tasksView.filterArchived || 'no';
    if(taskSearchInput) taskSearchInput.value = appState.tasksView.searchTerm;
    if(taskSortSelect) taskSortSelect.value = appState.tasksView.sortBy;

    renderTasksList();
    setupTaskControlListeners();
    if (taskGlobalStatusMessage) taskGlobalStatusMessage.classList.add('hidden');
}

function setupTaskControlListeners() {
    const controls = [
        {el: createNewTaskBtn, event: 'click', handler: () => openTaskModal()}, // Changed to openTaskModal
        {el: taskFilterStatus, event: 'change', handler: handleTaskFilterChange},
        {el: taskFilterPriority, event: 'change', handler: handleTaskFilterChange},
        {el: taskFilterDueDate, event: 'change', handler: handleTaskFilterChange},
        {el: taskFilterAssignedTo, event: 'input', handler: handleTaskFilterChange},
        {el: taskFilterTags, event: 'input', handler: handleTaskFilterChange},
        {el: taskFilterArchived, event: 'change', handler: handleTaskFilterChange},
        {el: taskSearchInput, event: 'input', handler: handleTaskFilterChange},
        {el: taskSortSelect, event: 'change', handler: handleTaskFilterChange}
    ];
    controls.forEach(c => {
        if (c.el && !c.el.dataset.listenerAttached) {
            c.el.addEventListener(c.event, c.handler);
            c.el.dataset.listenerAttached = 'true';
        }
    });
}

function handleTaskFilterChange() {
    appState.tasksView.filterStatus = taskFilterStatus?.value || 'all';
    appState.tasksView.filterPriority = taskFilterPriority?.value || 'all';
    appState.tasksView.filterDueDate = taskFilterDueDate?.value || '';
    appState.tasksView.filterAssignedTo = taskFilterAssignedTo?.value.trim().toLowerCase() || '';
    appState.tasksView.filterTags = taskFilterTags?.value.trim().toLowerCase() || '';
    appState.tasksView.filterArchived = taskFilterArchived?.value || 'no';
    appState.tasksView.searchTerm = taskSearchInput?.value.trim().toLowerCase() || '';
    appState.tasksView.sortBy = taskSortSelect?.value || 'createdAt_desc';
    saveAppState();
    renderTasksList();
}

function getFilteredAndSortedTasks() {
    let filtered = [...appState.localTasksCache];

    if (appState.tasksView.filterArchived === 'no') {
        filtered = filtered.filter(task => !task.isArchived);
    } else if (appState.tasksView.filterArchived === 'yes') {
        filtered = filtered.filter(task => task.isArchived);
    }

    if (appState.tasksView.searchTerm) {
        filtered = filtered.filter(task =>
            task.title.toLowerCase().includes(appState.tasksView.searchTerm) ||
            (task.description && task.description.toLowerCase().includes(appState.tasksView.searchTerm)) ||
            (task.tags && task.tags.some(tag => tag.toLowerCase().includes(appState.tasksView.searchTerm)))
        );
    }
    if (appState.tasksView.filterStatus !== 'all') filtered = filtered.filter(t => t.status === appState.tasksView.filterStatus);
    if (appState.tasksView.filterPriority !== 'all') filtered = filtered.filter(t => t.priority === appState.tasksView.filterPriority);
    if (appState.tasksView.filterDueDate) {
        const filterDate = new Date(appState.tasksView.filterDueDate).setHours(0,0,0,0);
        filtered = filtered.filter(t => t.dueDate && new Date(t.dueDate).setHours(0,0,0,0) === filterDate);
    }
    if (appState.tasksView.filterAssignedTo) filtered = filtered.filter(t => t.assignedTo?.toLowerCase().includes(appState.tasksView.filterAssignedTo));
    if (appState.tasksView.filterTags) {
        const searchTags = appState.tasksView.filterTags.split(',').map(t => t.trim()).filter(t => t);
        if (searchTags.length > 0) filtered = filtered.filter(t => t.tags?.some(taskTag => searchTags.some(sTag => taskTag.toLowerCase().includes(sTag))));
    }

    const [sortField, sortOrder] = appState.tasksView.sortBy.split('_');
    const priorityOrder = { 'low': 0, 'medium': 1, 'high': 2, 'urgent': 3 };
    filtered.sort((a, b) => {
        let valA = a[sortField], valB = b[sortField];
        if (sortField === 'priority') {
            valA = priorityOrder[a.priority] ?? -1; valB = priorityOrder[b.priority] ?? -1;
        } else if (['dueDate', 'createdAt', 'updatedAt', 'completedAt'].includes(sortField)) {
            if (!valA && valB) return sortOrder === 'asc' ? 1 : -1; if (valA && !valB) return sortOrder === 'asc' ? -1 : 1;
            if (!valA && !valB) return 0;
            valA = new Date(valA).getTime(); valB = new Date(valB).getTime();
        } else if (typeof valA === 'string') { valA = valA.toLowerCase(); valB = (valB || '').toLowerCase(); }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;

        if (a.createdAt && b.createdAt) {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return 0;
    });
    return filtered;
}

function renderTasksList() {
    if (!tasksListContainer || !noTasksState) return;
    tasksListContainer.innerHTML = '';
    const tasksToRender = getFilteredAndSortedTasks();

    if (tasksToRender.length === 0) {
        noTasksState.classList.remove('hidden');
        tasksListContainer.classList.add('hidden');
    } else {
        noTasksState.classList.add('hidden');
        tasksListContainer.classList.remove('hidden');
        tasksToRender.forEach(task => tasksListContainer.appendChild(createTaskCard(task)));
    }
}

function createTaskCard(task) {
    const card = document.createElement('div');
    card.className = `task-card status-${task.status || 'default'} priority-${task.priority || 'default'}`;
    if (task.isArchived) card.classList.add('is-archived');
    card.dataset.taskId = task.id;

    const priorityColors = { low: 'var(--accent-info)', medium: 'var(--accent-secondary)', high: 'var(--accent-warning)', urgent: 'var(--accent-danger)' };
    const priorityText = task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : 'N/A';

    let dueDateString = 'No Due Date';
    if (task.dueDate) {
        try {
            dueDateString = new Date(task.dueDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
            if (!task.isArchived && new Date(task.dueDate) < new Date().setHours(0,0,0,0) && task.status !== 'completed') {
                dueDateString += ' (Overdue)'; card.classList.add('overdue');
            }
        } catch (e) { console.error("Error formatting due date:", e); }
    }
    const tagsHTML = (task.tags?.length > 0) ? `<div class="task-tags">${task.tags.map(tag => `<span class="task-tag">${tag}</span>`).join('')}</div>` : '';

    let shipmentName = findShipmentNameById(task.relatedShipmentId);
    if (task.relatedShipmentId && !shipmentName) shipmentName = "[Deleted Shipment]";
    const shipmentLinkHTML = task.relatedShipmentId ? `<div class="task-shipment-link">Shipment: <a href="#" data-shipment-id="${task.relatedShipmentId}" class="link-to-shipment">${shipmentName || task.relatedShipmentId}</a></div>` : '';

    const createdByText = task.createdBy ? (task.createdBy.name || task.createdBy.uid || 'Unknown') : 'Unknown';
    const createdByHTML = `<span class="task-created-by"><svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="4"></circle><path d="M12 14s-4-2-4-4 1.5-3 4-3 4 1 4 3-4 4-4 4zm0 1c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path></svg> By: ${createdByText}</span>`;

    let actionsHTML = '';
    if (task.isArchived) {
        actionsHTML = `
            <button class="btn btn-secondary btn-small btn-icon-text task-action-unarchive" title="Unarchive">
                <svg viewBox="0 0 24 24"><polyline points="22 12 16 12 14 15 10 9 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg> Unarchive
            </button>
            ${isUserAdmin() ? `
            <button class="btn btn-danger btn-small btn-icon-text task-action-delete-permanent" title="Delete Permanently">
                <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg> Delete Forever
            </button>` : ''}`;
    } else {
        actionsHTML = `
            <button class="btn btn-secondary btn-small btn-icon-text task-action-edit" title="Edit"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit</button>
            <select class="select-field select-field-small task-action-status-change" title="Change Status">${['todo', 'inprogress', 'completed', 'onhold'].map(s => `<option value="${s}" ${task.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join('')}</select>
            <button class="btn btn-secondary btn-small btn-icon-text task-action-archive" title="Archive">
                <svg viewBox="0 0 24 24"><path d="M21.19 5.81A2 2 0 0 0 19.77 5H4.23A2 2 0 0 0 2.44 7.77L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-.44-4.23a2 2 0 0 0-1.37-1.96z"/><polyline points="22 12 16 12 14 15 10 9 8 12 2 12"/></svg> Archive
            </button>`;
    }

    card.innerHTML = `
        <div class="task-card-header">
            <h3 class="task-title">${task.title}</h3>
            <div class="task-priority" style="background-color: ${priorityColors[task.priority] || 'var(--border-secondary)'}; color: ${['high', 'urgent'].includes(task.priority) && !document.body.classList.contains('dark-theme') ? 'var(--text-primary)' : 'var(--text-on-dark)'};">${priorityText}</div>
        </div>
        ${task.description ? `<p class="task-description">${task.description.substring(0, 150)}${task.description.length > 150 ? '...' : ''}</p>` : ''}
        ${tagsHTML}
        <div class="task-meta">
            <span class="task-status-badge status-${task.status}">${task.status.charAt(0).toUpperCase() + task.status.slice(1)}</span>
            <span class="task-due-date"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ${dueDateString}</span>
            ${task.assignedTo ? `<span class="task-assignee"><svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ${task.assignedTo}</span>` : ''}
            ${createdByHTML}
        </div>
        ${shipmentLinkHTML}
        <div class="task-actions">
            ${actionsHTML}
        </div>`;

    if (!task.isArchived) {
        card.querySelector('.task-action-edit')?.addEventListener('click', () => openTaskModal(task));
        card.querySelector('.task-action-status-change')?.addEventListener('change', (e) => updateTaskStatus(task.id, e.target.value));
        card.querySelector('.task-action-archive')?.addEventListener('click', () => archiveTask(task.id, task.title));
    } else {
        card.querySelector('.task-action-unarchive')?.addEventListener('click', () => unarchiveTask(task.id, task.title));
        card.querySelector('.task-action-delete-permanent')?.addEventListener('click', () => permanentlyDeleteTask(task.id, task.title));
    }

    card.querySelector('.link-to-shipment')?.addEventListener('click', (e) => {
        e.preventDefault(); const shipmentId = e.currentTarget.dataset.shipmentId;
        const shipmentIndex = appState.shipments.findIndex(s => s.id === shipmentId);
        if (shipmentIndex !== -1) { appState.currentShipmentIndex = shipmentIndex; saveAppState(); navigateToScreen('planAndPackScreen'); }
        else showModal({title:"Not Found", prompt:`Shipment ID ${shipmentId} is no longer available or was deleted.`, inputType: "none", confirmButtonText:"OK"});
    });
    return card;
}

function findShipmentNameById(shipmentId) { return appState.shipments.find(s => s.id === shipmentId)?.name || null; }

async function openTaskModal(existingTask = null) {
    if (existingTask?.isArchived) {
        await showModal({title: "Archived Task", prompt: "Archived tasks cannot be edited directly. Unarchive first.", inputType: "none", confirmButtonText: "OK"});
        return;
    }

    const modalTitle = existingTask ? `Edit Task: ${existingTask.title}` : "Create New Task";
    const confirmText = existingTask ? "Save Changes" : "Create Task";
    let shipmentOptions = '<option value="">-- None --</option>' + 
        appState.shipments
            .filter(s => !s.isArchived) // Only show non-archived shipments
            .sort((a,b) => a.name.localeCompare(b.name)) // Sort alphabetically
            .map(ship => `<option value="${ship.id}" ${existingTask?.relatedShipmentId === ship.id ? 'selected' : ''}>${ship.name}</option>`)
            .join('');

    const contentHTML = `
        <div class="task-modal-form">
            <div class="form-field">
                <label for="taskModalTitle">Title*</label>
                <input type="text" id="taskModalTitle" class="input-field" value="${existingTask?.title || ''}" placeholder="Brief and descriptive title">
            </div>
            <div class="form-field">
                <label for="taskModalDesc">Description</label>
                <textarea id="taskModalDesc" class="input-field" rows="4" placeholder="Provide more details, context, or steps for this task.">${existingTask?.description || ''}</textarea>
            </div>
            
            <div class="form-grid-2col">
                <div class="form-field">
                    <label for="taskModalStatus">Status*</label>
                    <select id="taskModalStatus" class="select-field">
                        ${['todo', 'inprogress', 'completed', 'onhold'].map(s => `<option value="${s}" ${existingTask?.status === s ? 'selected' : (!existingTask && s === 'todo' ? 'selected' : '')}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-field">
                    <label for="taskModalPriority">Priority*</label>
                    <select id="taskModalPriority" class="select-field">
                        ${['low', 'medium', 'high', 'urgent'].map(p => `<option value="${p}" ${existingTask?.priority === p ? 'selected' : (!existingTask && p === 'medium' ? 'selected' : '')}>${p.charAt(0).toUpperCase() + p.slice(1)}</option>`).join('')}
                    </select>
                </div>
            </div>

            <div class="form-grid-2col">
                <div class="form-field">
                    <label for="taskModalDueDate">Due Date</label>
                    <input type="date" id="taskModalDueDate" class="input-field" value="${existingTask?.dueDate ? new Date(existingTask.dueDate).toISOString().split('T')[0] : ''}">
                </div>
                <div class="form-field">
                    <label for="taskModalAssignedTo">Assigned To</label>
                    <input type="text" id="taskModalAssignedTo" class="input-field" value="${existingTask?.assignedTo || ''}" placeholder="Name or team (e.g., John D., QC Team)">
                </div>
            </div>
            
            <div class="form-field">
                <label for="taskModalRelatedShipment">Related Shipment (Optional)</label>
                <select id="taskModalRelatedShipment" class="select-field">${shipmentOptions}</select>
            </div>
            <div class="form-field">
                <label for="taskModalTags">Tags (comma-separated)</label>
                <input type="text" id="taskModalTags" class="input-field" value="${existingTask?.tags?.join(', ') || ''}" placeholder="e.g., urgent, inspection, followup">
            </div>
        </div>
    `;
    // Using actionType 'genericTaskModal' to distinguish from the simpler 'createOrEditTask' in modal.js
    const result = await showModal({ title: modalTitle, contentHTML, confirmButtonText, actionType: 'genericTaskModal' }); 

    if (result) { // `result` is true if confirm was clicked without specific data passthrough needed from showModal
        const taskData = {
            title: document.getElementById('taskModalTitle').value.trim(),
            description: document.getElementById('taskModalDesc').value.trim(),
            status: document.getElementById('taskModalStatus').value,
            priority: document.getElementById('taskModalPriority').value,
            dueDate: document.getElementById('taskModalDueDate').value ? new Date(document.getElementById('taskModalDueDate').value) : null,
            assignedTo: document.getElementById('taskModalAssignedTo').value.trim(),
            relatedShipmentId: document.getElementById('taskModalRelatedShipment').value || null,
            tags: document.getElementById('taskModalTags').value.split(',').map(t => t.trim()).filter(t => t),
            isArchived: existingTask ? existingTask.isArchived : false,
        };

        if (!taskData.title) {
            await showModal({ title: "Validation Error", prompt: "Task title is required.", inputType: "none", confirmButtonText: "OK"});
            openTaskModal(existingTask); // Re-open with existing data
            return;
        }
        
        const currentUser = appState.currentUser;
        const creatorInfo = currentUser ? { uid: currentUser.uid, name: currentUser.displayName || currentUser.email } : { uid: 'local_user', name: 'Local User' };
        taskData.createdBy = existingTask ? (existingTask.createdBy || creatorInfo) : creatorInfo;

        await saveTask(taskData, existingTask?.id);
    }
}


async function saveTask(taskData, taskId = null) {
    if (taskGlobalStatusMessage) taskGlobalStatusMessage.classList.add('hidden');
    try {
        const timestamp = firebase.firestore.FieldValue.serverTimestamp();
        const dataToSave = { ...taskData, 
            dueDate: taskData.dueDate ? firebase.firestore.Timestamp.fromDate(new Date(taskData.dueDate)) : null, 
            updatedAt: timestamp 
        };

        if (taskId) {
            delete dataToSave.createdBy; // Don't overwrite original creator on edit
            await tasksCollection.doc(taskId).update(dataToSave);
            displayTaskStatus(`Task "${taskData.title}" updated.`, 'success');
        } else {
            dataToSave.createdAt = timestamp;
            if (!dataToSave.status) dataToSave.status = 'todo';
            if (!dataToSave.priority) dataToSave.priority = 'medium';
            if (dataToSave.isArchived === undefined) dataToSave.isArchived = false;
            // createdBy is already in taskData from openTaskModal
            await tasksCollection.add(dataToSave);
            displayTaskStatus(`Task "${taskData.title}" created.`, 'success');
        }
    } catch (error) {
        console.error("Error saving task: ", error);
        displayTaskStatus(`Error saving task: ${error.message}`, 'error');
    }
}

async function archiveTask(taskId, taskTitle) {
    const confirmed = await showModal({ title: "Archive Task?", prompt: `Archive task "${taskTitle}"? It can be unarchived later.`, inputType: "none", confirmButtonText: "Archive", cancelButtonText: "Cancel" });
    if (confirmed) {
        if (taskGlobalStatusMessage) taskGlobalStatusMessage.classList.add('hidden');
        try {
            await tasksCollection.doc(taskId).update({ isArchived: true, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
            displayTaskStatus(`Task "${taskTitle}" archived.`, 'success');
        } catch (error) {
            console.error("Error archiving task: ", error);
            displayTaskStatus(`Error archiving: ${error.message}`, 'error');
        }
    }
}

async function unarchiveTask(taskId, taskTitle) {
    if (taskGlobalStatusMessage) taskGlobalStatusMessage.classList.add('hidden');
    try {
        await tasksCollection.doc(taskId).update({ isArchived: false, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        displayTaskStatus(`Task "${taskTitle}" unarchived.`, 'success');
    } catch (error) {
        console.error("Error unarchiving task: ", error);
        displayTaskStatus(`Error unarchiving: ${error.message}`, 'error');
    }
}

async function permanentlyDeleteTask(taskId, taskTitle) {
    if (!isUserAdmin()) {
         showModal({title: "Permission Denied", prompt: "Only Admins can permanently delete tasks.", inputType:"none", confirmButtonText:"OK"});
        return;
    }
    const confirmed = await showModal({
        title: "Delete Task Permanently?",
        prompt: `PERMANENTLY delete task "${taskTitle}"? This cannot be undone. Type "DELETE" to confirm.`,
        inputType: 'text', placeholder: 'Type DELETE', needsConfirmation: true, confirmKeyword: "DELETE",
        confirmButtonText: "Confirm Permanent Delete"
    });
    if (String(confirmed).toUpperCase() === "DELETE") {
        if (taskGlobalStatusMessage) taskGlobalStatusMessage.classList.add('hidden');
        try {
            await tasksCollection.doc(taskId).delete();
            displayTaskStatus(`Task "${taskTitle}" permanently deleted.`, 'success');
        } catch (error) {
            console.error("Error permanently deleting task: ", error);
            displayTaskStatus(`Error deleting: ${error.message}`, 'error');
        }
    }
}

async function updateTaskStatus(taskId, newStatus) {
    const task = appState.localTasksCache.find(t => t.id === taskId);
    if (task?.isArchived) {
        await showModal({title: "Archived Task", prompt: "Status cannot be changed for archived tasks. Unarchive first.", inputType: "none", confirmButtonText: "OK"});
        renderTasksList();
        return;
    }
    if (taskGlobalStatusMessage) taskGlobalStatusMessage.classList.add('hidden');
    try {
        const updateData = { status: newStatus, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
        if (newStatus === 'completed') updateData.completedAt = firebase.firestore.FieldValue.serverTimestamp();
        else updateData.completedAt = null;
        await tasksCollection.doc(taskId).update(updateData);
        displayTaskStatus(`Task status updated to "${newStatus}".`, 'success');
    } catch (error) {
        console.error("Error updating task status: ", error);
        displayTaskStatus(`Error updating status: ${error.message}`, 'error');
    }
}

function displayTaskStatus(message, type = 'success') {
    if (!taskGlobalStatusMessage) return;
    taskGlobalStatusMessage.textContent = message;
    taskGlobalStatusMessage.className = 'settings-status-message ' + type;
    taskGlobalStatusMessage.classList.remove('hidden');
    setTimeout(() => taskGlobalStatusMessage.classList.add('hidden'), 3500);
}