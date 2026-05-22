import { renderMiniCharacter } from './renderer.js';
import { showError } from './helpers.js';

const VAULT_KEY = 'char_renderer_vault';
export let vault = [];
export let selectedVaultId = null;

export function setSelectedVaultId(id) {
  selectedVaultId = id;
}

export function vaultLoad(onGridRender, onBadgeUpdate) {
  try {
    const raw = localStorage.getItem(VAULT_KEY);
    if (raw) vault = JSON.parse(raw);
  } catch (e) {
    vault = [];
  }
  renderVaultGrid(onGridRender, onBadgeUpdate);
  updateVaultBadge(onBadgeUpdate);
}

export function vaultSave() {
  try {
    localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
  } catch (e) {
    showError('Vault save failed (storage full?): ' + e.message);
  }
}

export function saveToVault(charData, bgStyle, onGridRender, onBadgeUpdate) {
  if (!charData) return;
  const newId = Date.now();
  vault.push({ id: newId, data: JSON.parse(JSON.stringify(charData)), bgStyle });
  vaultSave();
  renderVaultGrid(onGridRender, onBadgeUpdate);
  updateVaultBadge(onBadgeUpdate);

  const btn = document.getElementById('save-vault-btn');
  if (btn) {
    btn.classList.add('flash');
    btn.textContent = '✓ Saved!';
    setTimeout(() => {
      btn.classList.remove('flash');
      btn.textContent = '⊕ Save to Vault';
    }, 900);
  }
}

export function renderVaultGrid(onGridRender, onBadgeUpdate) {
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
    renderMiniCharacter(entry.data, miniCanvas);

    const label = document.createElement('div');
    label.className = 'vault-card-label';
    label.textContent = (entry.data.name || 'UNKNOWN').toUpperCase();
    card.appendChild(label);

    card.addEventListener('click', () => {
      selectedVaultId = (selectedVaultId === entry.id) ? null : entry.id;
      document.querySelectorAll('.vault-card').forEach(c => {
        c.classList.toggle('selected', Number(c.dataset.id) === selectedVaultId);
      });
      updateVaultButtons();
    });
    grid.appendChild(card);
  });

  updateVaultButtons();
}

export function updateVaultButtons() {
  const active = selectedVaultId !== null;
  const viewBtn = document.getElementById('vault-view-btn');
  const delBtn = document.getElementById('vault-delete-btn');
  if (viewBtn && delBtn) {
    viewBtn.disabled = !active;
    delBtn.disabled = !active;
    viewBtn.classList.toggle('active', active);
    delBtn.classList.toggle('active', active);
  }
}

export function updateVaultBadge(onBadgeUpdate) {
  const badge = document.getElementById('vcb-badge');
  if (!badge) return;
  badge.textContent = vault.length;
  badge.classList.toggle('show', vault.length > 0);
  if (onBadgeUpdate) onBadgeUpdate(vault.length);
}