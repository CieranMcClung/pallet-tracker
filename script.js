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

// — Refs —
const homeScreen        = document.getElementById('homeScreen');
const containerSection  = document.getElementById('containerSection');
const yodelSection      = document.getElementById('yodelSection');

const productSelect     = document.getElementById('productSelect');
const addProductBtn     = document.getElementById('addProductBtn');
const newContainerBtn   = document.getElementById('newContainerBtn');
const containerEmpty    = document.getElementById('containerEmpty');
const containerUI       = document.getElementById('containerUI');

const codeDisplay       = document.getElementById('codeDisplay');
const totalDisplay      = document.getElementById('totalDisplay');
const leftDisplay       = document.getElementById('leftDisplay');
const palletsDisplay    = document.getElementById('palletsDisplay');
const palletsLeftDisplay= document.getElementById('palletsLeftDisplay');

const sizesContainer    = document.getElementById('sizesContainer');
const undoEntryBtn      = document.getElementById('undoEntryBtn');
const resetProductBtn   = document.getElementById('resetProductBtn');

const entriesDiv        = document.getElementById('entries');
const suggestionEl      = document.getElementById('suggestion');

const recordYodelBtn    = document.getElementById('recordYodelBtn');
const yodelCountDisplay = document.getElementById('yodelCountDisplay');
const undoYodelBtn      = document.getElementById('undoYodelBtn');
const resetYodelBtn     = document.getElementById('resetYodelBtn');

// Modal
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle   = document.getElementById('modalTitle');
const modalInput   = document.getElementById('modalInput');
const modalCancel  = document.getElementById('modalCancel');
const modalOk      = document.getElementById('modalOk');
let   modalResolve;

// Persistence
const saveContainer = ()=> localStorage.setItem('container', JSON.stringify(container));
const saveYodel     = ()=> localStorage.setItem('yodelCount', yodelCount);

// Navigation & Init
document.getElementById('btnContainerHome').onclick = () => {
  homeScreen.classList.add('hidden');
  containerSection.classList.remove('hidden');
  initContainer();
};
document.getElementById('btnYodelHome').onclick = () => {
  homeScreen.classList.add('hidden');
  yodelSection.classList.remove('hidden');
  updateYodelUI();
};
document.getElementById('backFromContainer').onclick = () => {
  containerSection.classList.add('hidden');
  homeScreen.classList.remove('hidden');
};
document.getElementById('backFromYodel').onclick = () => {
  yodelSection.classList.add('hidden');
  homeScreen.classList.remove('hidden');
};

// Modal Helper
function showModal({ title, placeholder, type }) {
  modalTitle.textContent   = title;
  modalInput.value         = '';
  modalInput.placeholder   = placeholder;
  modalInput.type          = type;
  modalOverlay.classList.remove('hidden');
  setTimeout(() => modalInput.focus(), 50);
  return new Promise(res => modalResolve = res);
}
modalCancel.onclick = ()=> { modalOverlay.classList.add('hidden'); modalResolve(null); };
modalOk.onclick     = ()=> { modalOverlay.classList.add('hidden'); modalResolve(modalInput.value); };

// Container Logic
async function initContainer(){
  renderProducts();
  if (container.products.length) {
    containerEmpty.classList.add('hidden');
    containerUI.classList.remove('hidden');
    updateContainerUI();
  }
}

function renderProducts(){
  productSelect.innerHTML = '';
  container.products.forEach((p,i)=>{
    let o = document.createElement('option');
    o.value = i; o.textContent = p.code;
    productSelect.appendChild(o);
  });
  productSelect.value = container.currentIndex;
  containerEmpty.classList.toggle('hidden', container.products.length>0);
  containerUI.classList.toggle('hidden', container.products.length===0);
}

addProductBtn.onclick = async () => {
  const code  = await showModal({ title:'New SKU', placeholder:'e.g. TAB26', type:'text' });
  if (!code) return;
  const total = parseInt(await showModal({ title:`Total items for ${code}`, placeholder:'100', type:'number' }),10);
  if (!total || total<1) return alert('Enter a valid number.');
  container.products.push({ code, target: total, sizes: [], entries: [] });
  container.currentIndex = container.products.length - 1;
  saveContainer(); renderProducts(); updateContainerUI();
};

newContainerBtn.onclick = () => {
  if (confirm('Start a new container?')) {
    container = { products: [], currentIndex: 0 };
    saveContainer(); renderProducts();
  }
};

productSelect.onchange = () => {
  container.currentIndex = +productSelect.value;
  saveContainer(); updateContainerUI();
};

async function addSize(){
  const sz = parseInt(await showModal({ title:'Enter pallet size', placeholder:'10', type:'number' }),10);
  if (!sz||sz<1) return alert('Invalid size.');
  container.products[container.currentIndex].sizes.push(sz);
  saveContainer(); updateContainerUI();
}

// Update UI
function updateContainerUI(){
  const p   = container.products[container.currentIndex];
  const sum = p.entries.reduce((a,b)=>a+b,0);
  const left= Math.max(0, p.target - sum);

  codeDisplay.textContent         = p.code;
  totalDisplay.textContent        = p.target;
  leftDisplay.textContent         = left;

  const size    = p.sizes[0] || 1;
  const needed  = Math.ceil(p.target / size);
  const leftP   = Math.ceil(left / size);
  palletsDisplay.textContent      = needed;
  palletsLeftDisplay.textContent  = leftP;

  renderSizes(p.sizes);
  renderEntries(p.entries);
  renderSuggestion(p.sizes,left);

  saveContainer();
}

function renderSizes(sizes){
  sizesContainer.innerHTML = '';
  sizes.forEach(sz=>{
    const btn = document.createElement('button');
    btn.className   = 'chip';
    btn.textContent = sz;
    btn.onclick     = ()=> addEntry(sz);
    sizesContainer.appendChild(btn);
  });
  const add = document.createElement('button');
  add.className   = 'chip';
  add.textContent = '+ Size';
  add.onclick     = addSize;
  sizesContainer.appendChild(add);
}

function renderEntries(entries){
  entriesDiv.innerHTML = '';
  entries.forEach((sz,i)=>{
    const chip = document.createElement('div');
    chip.className   = 'entry-chip';
    chip.textContent = sz;
    let startX = 0;
    chip.addEventListener('touchstart', e=> startX = e.touches[0].clientX );
    chip.addEventListener('touchend',   e=>{
      if (startX - e.changedTouches[0].clientX > 60){
        chip.classList.add('removing');
        setTimeout(()=>{
          container.products[container.currentIndex].entries.splice(i,1);
          updateContainerUI();
        },300);
      }
    });
    entriesDiv.appendChild(chip);
  });
}

function addEntry(sz){
  const p = container.products[container.currentIndex];
  if (p.entries.reduce((a,b)=>a+b,0) + sz > p.target){
    return alert('Cannot exceed total.');
  }
  p.entries.push(sz);
  updateContainerUI();
}

undoEntryBtn.onclick = ()=>{ 
  const arr = container.products[container.currentIndex].entries;
  if (arr.length) arr.pop();
  updateContainerUI();
};
resetProductBtn.onclick = ()=>{
  if (confirm('Reset entries?')){
    container.products[container.currentIndex].entries = [];
    updateContainerUI();
  }
};

function renderSuggestion(sizes,left){
  let best=0;
  sizes.forEach(sz=>{ if (sz<=left&&sz>best) best=sz; });
  suggestionEl.textContent = best||'–';
}

// Yodel Logic
recordYodelBtn.onclick = ()=>{
  yodelCount++; saveYodel(); updateYodelUI();
};
undoYodelBtn.onclick = ()=>{
  if(yodelCount>0) yodelCount--; saveYodel(); updateYodelUI();
};
resetYodelBtn.onclick = ()=>{
  if(confirm('Reset count?')){
    yodelCount=0; saveYodel(); updateYodelUI();
  }
};
function updateYodelUI(){
  yodelCountDisplay.textContent = yodelCount;
}
