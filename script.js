// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .catch(err => console.error('SW failed:', err));
  });
}

// Online/Offline indicator
const statusEl = document.getElementById('statusIndicator');
function updateStatus() {
  if (navigator.onLine) {
    statusEl.textContent = 'Online';
    statusEl.classList.remove('offline');
  } else {
    statusEl.textContent = 'Offline';
    statusEl.classList.add('offline');
  }
}
window.addEventListener('online',  updateStatus);
window.addEventListener('offline', updateStatus);
updateStatus();

// — State —
let container  = JSON.parse(localStorage.getItem('container')) || { products: [], currentIndex: 0 };
let yodelCount = parseInt(localStorage.getItem('yodelCount')) || 0;
@@ -39,11 +62,11 @@ const modalCancel  = document.getElementById('modalCancel');
const modalOk      = document.getElementById('modalOk');
let   modalResolve;

// — Persistence —
// Persistence
const saveContainer = ()=> localStorage.setItem('container', JSON.stringify(container));
const saveYodel     = ()=> localStorage.setItem('yodelCount', yodelCount);

// — Navigation & Init —
// Navigation & Init
document.getElementById('btnContainerHome').onclick = () => {
  homeScreen.classList.add('hidden');
  containerSection.classList.remove('hidden');
@@ -63,7 +86,7 @@ document.getElementById('backFromYodel').onclick = () => {
  homeScreen.classList.remove('hidden');
};

// — Modal Helper —
// Modal Helper
function showModal({ title, placeholder, type }) {
  modalTitle.textContent   = title;
  modalInput.value         = '';
@@ -76,7 +99,7 @@ function showModal({ title, placeholder, type }) {
modalCancel.onclick = ()=> { modalOverlay.classList.add('hidden'); modalResolve(null); };
modalOk.onclick     = ()=> { modalOverlay.classList.add('hidden'); modalResolve(modalInput.value); };

// — Container Logic —
// Container Logic
async function initContainer(){
  renderProducts();
  if (container.products.length) {
@@ -127,7 +150,7 @@ async function addSize(){
  saveContainer(); updateContainerUI();
}

// — Update UI —
// Update UI
function updateContainerUI(){
  const p   = container.products[container.currentIndex];
  const sum = p.entries.reduce((a,b)=>a+b,0);
@@ -137,10 +160,9 @@ function updateContainerUI(){
  totalDisplay.textContent        = p.target;
  leftDisplay.textContent         = left;

  // pallet projections
  const size = p.sizes[0] || 1;
  const needed    = Math.ceil(p.target / size);
  const leftP     = Math.ceil(left / size);
  const size    = p.sizes[0] || 1;
  const needed  = Math.ceil(p.target / size);
  const leftP   = Math.ceil(left / size);
  palletsDisplay.textContent      = needed;
  palletsLeftDisplay.textContent  = leftP;

@@ -160,7 +182,6 @@ function renderSizes(sizes){
    btn.onclick     = ()=> addEntry(sz);
    sizesContainer.appendChild(btn);
  });
  // final "+ Size" chip
  const add = document.createElement('button');
  add.className   = 'chip';
  add.textContent = '+ Size';
@@ -216,7 +237,7 @@ function renderSuggestion(sizes,left){
  suggestionEl.textContent = best||'–';
}

// — Yodel Logic —
// Yodel Logic
recordYodelBtn.onclick = ()=>{
  yodelCount++; saveYodel(); updateYodelUI();
};
