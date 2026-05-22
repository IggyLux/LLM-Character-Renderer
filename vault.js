import { renderMiniCharacter } from './renderer.js';
import { showError, imgCache } from './helpers.js';

let db = null;
export let vault = [];
export let selectedVaultId = null;

export function setSelectedVaultId(id) {
  selectedVaultId = id;
}

export function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('CharacterRendererDB', 1);
    request.onupgradeneeded = (e) => {
      let database = e.target.result;
      if (!database.objectStoreNames.contains('characters')) {
        database.createObjectStore('characters', { keyPath: 'id' });
      }
    };
    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };
    request.onerror = (e) => {
      showError('Database error: ' + e.target.error.message);
      reject(e.target.error);
    };
  });
}

export async function vaultLoad(onUpdateCallback) {
  if (!db) await initDB();
  const tx = db.transaction('characters', 'readonly');
  const store = tx.objectStore('characters');
  const getAllReq = store.getAll();

  getAllReq.onsuccess = () => {
    vault = getAllReq.result || [];
    if (onUpdateCallback) onUpdateCallback();
  };
}

export function vaultSaveRecord(record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('characters', 'readwrite');
    const store = tx.objectStore('characters');
    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export function vaultDeleteRecord(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('characters', 'readwrite');
    const store = tx.objectStore('characters');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function preloadCharacterImages(data) {
  const urls = [];
  (data.canvas_shapes || []).forEach(s => { if (s.type === 'image' && s.src) urls.push(s.src); });
  if (!urls.length) return Promise.resolve();

  return Promise.all(urls.map(url => {
    return new Promise(resolve => {
      if (imgCache[url] && imgCache[url].complete) return resolve();
      imgCache[url] = new Image();
      imgCache[url].src = url;
      imgCache[url].onload = imgCache[url].onerror = () => resolve();
    });
  }));
}

export async function saveToVault(charData, bgStyle, onUpdateCallback) {
  if (!charData) return;
  const newId = Date.now();
  const entry = { id: newId, data: JSON.parse(JSON.stringify(charData)), bgStyle };
  
  try {
    await vaultSaveRecord(entry);
    vault.push(entry);
    
    if (onUpdateCallback) onUpdateCallback();

    const btn = document.getElementById('save-vault-btn');
    if (btn) {
      btn.classList.add('flash');
      btn.textContent = '✓ Saved!';
      setTimeout(() => {
        btn.classList.remove('flash');
        btn.textContent = '⊕ Save to Vault';
      }, 900);
    }
  } catch (e) {
    showError('Vault save failed: ' + e.message);
  }
}

export function renderVaultGrid(onCardSelectCallback) {
  const grid = document.getElementById('vault-grid');
  const countEl = document.getElementById('vault-count');
  if (!grid || !countEl) return;
  
  countEl.textContent = vault.length + ' SAVED';
  grid.innerHTML = vault.length === 0 ? '<div id="vault-empty">NO CHARACTERS<br>SAVED YET</div>' : '';

  vault.forEach(entry => {
    const card = document.createElement('div');
    card.className = 'vault-card' + (entry.id === selectedVaultId ? ' selected' : '');
    card.dataset.id = entry.id;

    const bg = document.createElement('div');
    bg.className = 'vault-card-bg';
    bg.style.background = entry.bgStyle || '#06060e';
    card.appendChild(bg);

    const miniCanvas = document.createElement('canvas');
    miniCanvas.width = miniCanvas.height = 120;
    miniCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    card.appendChild(miniCanvas);
    
    preloadCharacterImages(entry.data).then(() => {
      renderMiniCharacter(entry.data, miniCanvas);
    });

    const label = document.createElement('div');
    label.className = 'vault-card-label';
    label.textContent = (entry.data.name || 'UNKNOWN').toUpperCase();
    card.appendChild(label);

    card.addEventListener('click', () => {
      selectedVaultId = (selectedVaultId === entry.id) ? null : entry.id;
      document.querySelectorAll('.vault-card').forEach(c => {
        c.classList.toggle('selected', Number(c.dataset.id) === selectedVaultId);
      });
      if (onCardSelectCallback) onCardSelectCallback();
    });
    grid.appendChild(card);
  });
}
