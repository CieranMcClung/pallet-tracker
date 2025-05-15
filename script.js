// —— State: Multiple Containers ——
let containers  = JSON.parse(localStorage.getItem('containers') || '[]');
let currentIdx  = 0;

// —— Utility Functions ——
function saveContainers() {
  localStorage.setItem('containers', JSON.stringify(containers));
}
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => t.remove(), 2000);
}

// —— Element Refs ——
const homeScreen           = document.getElementById('homeScreen');
const containerSection     = document.getElementById('containerSection');
const yodelSection         = document.getElementById('yodelSection');
const startOverlay         = document.getElementById('containerStartOverlay');
const startNewBtn          = document.getElementById('startNew');
const viewSavedBtn         = document.getElementById('viewSaved');
const tabsEl               = document.getElementById('containerTabs');
const containerUI          = document.getElementById('containerUI');
const chipGrid             = document.getElementById('chipGrid');
const addPalletBtn         = document.getElementById('addPallet');
const resetContainerBtn    = document.getElementById('resetContainer');
const btnContainerHome     = document.getElementById('btnContainerHome');
const backFromContainerBtn = document.getElementById('backFromContainer');
const btnYodelHome         = document.getElementById('btnYodelHome');

// —— Show Container Mode & Overlay ——
btnContainerHome.onclick = () => {
  homeScreen.classList.add('hidden');
  containerSection.classList.remove('hidden');
  startOverlay.classList.remove('hidden');
};

// —— Overlay Actions ——
startNewBtn.onclick = () => {
  startOverlay.classList.add('hidden');
  const n = parseInt(prompt('How many containers?', '1'), 10) || 1;
  containers = [];
  for (let i = 0; i < n; i++) {
    containers.push({ name: `Container ${i+1}`, entries: {} });
  }
  currentIdx = 0;
  saveContainers();
  renderTabs();
  renderContainerUI();
};
viewSavedBtn.onclick = () => {
  startOverlay.classList.add('hidden');
  renderTabs();
  renderContainerUI();
};

// —— Back to Home ——
backFromContainerBtn.onclick = () => {
  containerSection.classList.add('hidden');
  homeScreen.classList.remove('hidden');
};

// —— Render Tabs ——
function renderTabs() {
  tabsEl.innerHTML = '';
  tabsEl.classList.toggle('hidden', containers.length === 0);
  containers.forEach((c, i) => {
    const tab = document.createElement('div');
    tab.className = 'tab' + (i === currentIdx ? ' active' : '');
    tab.textContent = c.name;
    tab.onclick = () => {
      currentIdx = i;
      renderTabs();
      renderContainerUI();
    };
    tabsEl.appendChild(tab);
  });
}

// —— Render Container UI ——
function renderContainerUI() {
  containerUI.classList.remove('hidden');
  chipGrid.innerHTML = '';
  const cont = containers[currentIdx];
  Object.entries(cont.entries || {}).forEach(([size, count]) => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.innerHTML = `<span>${size}"</span><span class="count">${count}</span>`;
    chip.onclick = () => updateEntry(size, 1);
    chip.ondblclick = () => {
      if (confirm('Remove this entry?')) {
        delete cont.entries[size];
        saveContainers();
        renderContainerUI();
      }
    };
    chipGrid.appendChild(chip);
  });
}

// —— Add Pallet Button ——
addPalletBtn.onclick = () => {
  const sz = prompt('Pallet size? (e.g. 22×40)', '');
  if (!sz) return;
  updateEntry(sz, 1);
};

// —— Update Entry & Toast ——
function updateEntry(size, delta) {
  const cont = containers[currentIdx];
  cont.entries = cont.entries || {};
  cont.entries[size] = (cont.entries[size] || 0) + delta;
  if (cont.entries[size] <= 0) delete cont.entries[size];
  saveContainers();
  renderContainerUI();
  toast(`+${delta} added`);
}

// —— Reset Container (double-tap) ——
let lastTap = 0;
resetContainerBtn.onclick = () => {
  const now = Date.now();
  if (now - lastTap < 500) {
    containers[currentIdx].entries = {};
    saveContainers();
    renderContainerUI();
    toast('Reset');
  } else {
    toast('Double-tap to confirm reset');
  }
  lastTap = now;
};

// —— Yodel Mode (unchanged) ——
btnYodelHome.onclick = () => {
  homeScreen.classList.add('hidden');
  yodelSection.classList.remove('hidden');
  // …your existing Yodel logic…
};
