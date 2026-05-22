import { STAGE, showError } from './helpers.js';
import { renderMiniCharacter } from './renderer.js';

export let vault = [];
export let selectedVaultId = null;

const STORAGE_KEY = 'character_vault';

export function vaultLoad(callback) {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      vault = JSON.parse(stored);
    } catch(e) { showError('Vault load error'); }
  }
  renderVaultGrid(callback);
}

export function saveToVault(charData, bgStyle, callback) {
  if (!charData) return;
  const id = Date.now();
  const record = { id, data: charData, bgStyle, name: charData.name || 'Unknown' };
  vault.unshift(record);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(vault));
  renderVaultGrid(callback);
  const btn = document.getElementById('save-vault-btn');
  if (btn) {
    btn.classList.add('flash');
    setTimeout(() => btn.classList.remove('flash'), 300);
  }
}

export function renderVaultGrid(callback) {
  const grid = document.getElementById('vault-grid');
  if (!grid) return;
  grid.innerHTML = '';
  if (vault.length === 0) {
    grid.innerHTML = '<div id="vault-empty">NO CHARACTERS<br>SAVED YET</div>';
    if (callback) callback();
    return;
  }
  vault.forEach(entry => {
    const card = document.createElement('div');
    card.className = 'vault-card';
    if (selectedVaultId === entry.id) card.classList.add('selected');
    const bgDiv = document.createElement('div');
    bgDiv.className = 'vault-card-bg';
    const miniCanvas = document.createElement('canvas');
    miniCanvas.width = miniCanvas.height = 120;
    renderMiniCharacter(entry.data, miniCanvas);
    bgDiv.appendChild(miniCanvas);
    const label = document.createElement('div');
    label.className = 'vault-card-label';
    label.textContent = (entry.data.name || '???').slice(0, 12);
    card.appendChild(bgDiv);
    card.appendChild(label);
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedVaultId = entry.id;
      renderVaultGrid(callback);
    });
    grid.appendChild(card);
  });
  if (callback) callback();
}

export function setSelectedVaultId(id) {
  selectedVaultId = id;
  renderVaultGrid(() => {});
}

export async function vaultDeleteRecord(id) {
  vault = vault.filter(v => v.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(vault));
  if (selectedVaultId === id) selectedVaultId = null;
}