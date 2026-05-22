import { STAGE, darken, rgba, showError } from './helpers.js';
import { drawShape } from './renderer.js';
import { vaultLoad, saveToVault, renderVaultGrid, updateVaultBadge, updateVaultButtons, vault, selectedVaultId, setSelectedVaultId, vaultSave } from './vault.js';

const stageBg    = document.getElementById('stage-bg');
const stageDom   = document.getElementById('stage-dom');
const canvas     = document.getElementById('stage-canvas');
const ctx        = canvas.getContext('2d');
const loadUI     = document.getElementById('load-ui');
const hudName    = document.getElementById('hud-name');
const hudType    = document.getElementById('hud-type');
const hudId      = document.getElementById('hud-id');
const hudLore    = document.getElementById('hud-lore');
const statA      = document.getElementById('stat-a');
const statB      = document.getElementById('stat-b');
const stageEmpty = document.getElementById('stage-empty');

let animId = null;
let globalT = 0;
let charData = null;
let currentScale = 1;

const STAT_PALETTE = {
  hp:'#e05555', mp:'#5577ee', atk:'#e09944', def:'#44aa88',
  spd:'#aa66cc', lck:'#55cccc', pow:'#ee6644', wis:'#88aadd',
  vit:'#77cc66', str:'#dd7744', int:'#6688dd', agi:'#55bb99',
};

// Exporting so that module operations, drag-and-drop, and window messages link up properly
export function renderCharacter(data) {
  charData = data;
  if (animId) cancelAnimationFrame(animId);
  globalT = 0;
  canvas.width = canvas.height = STAGE;
  stageBg.innerHTML = stageDom.innerHTML = '';
  ctx.clearRect(0, 0, STAGE, STAGE);

  loadUI.classList.add('hidden');
  setTimeout(() => { loadUI.style.display = 'none'; }, 420);
  stageEmpty.style.display = 'none';

  document.getElementById('scale-panel').classList.add('visible');
  document.getElementById('vault-panel').classList.add('visible');
  document.getElementById('inline-json-panel').classList.add('visible');
  
  const svb = document.getElementById('save-vault-btn');
  svb.style.display = 'block';
  svb.style.opacity = '1';
  svb.style.cursor = 'pointer';
  svb.style.pointerEvents = 'all';

  applyBackground(data);
  applyHUD(data);
  buildDOM(data.dom_elements || []);

  if (data.global_style) {
    const s = document.createElement('style');
    s.textContent = data.global_style;
    document.head.appendChild(s);
  }

  loop();
}

function enterViewMode() {
  loadUI.classList.add('hidden');
  setTimeout(() => { loadUI.style.display = 'none'; }, 420);

  document.getElementById('scale-panel').classList.add('visible');
  document.getElementById('vault-panel').classList.add('visible');
  document.getElementById('inline-json-panel').classList.add('visible');

  const svb = document.getElementById('save-vault-btn');
  svb.style.display = 'block';
  svb.style.opacity = '0.35';
  svb.style.cursor = 'default';
  svb.style.pointerEvents = 'none';
}

function applyBackground(data) {
  const p    = data.palette || {};
  const mood = (data.mood || 'neutral').toLowerCase();
  const pri  = p.primary   || '#334466';
  const sec  = p.secondary || '#112233';
  const acc  = p.accent    || '#aabbcc';
  const d1   = darken(pri, 0.80), d2 = darken(sec, 0.87);
  const g1   = rgba(pri, 0.16), g2 = rgba(acc, 0.07), g3 = rgba(acc, 0.12);

  const presets = {
    fire:`radial-gradient(ellipse 65% 45% at 50% 85%,${g3} 0%,transparent 65%),radial-gradient(ellipse 40% 25% at 50% 100%,${rgba(acc,.15)} 0%,transparent 55%),linear-gradient(to top,${d1} 0%,${d2} 55%,#07070f 100%)`,
    hot:`radial-gradient(ellipse 65% 45% at 50% 85%,${g3} 0%,transparent 65%),linear-gradient(to top,${d1} 0%,#07070f 100%)`,
    aggressive:`radial-gradient(ellipse 55% 55% at 50% 70%,${g1} 0%,transparent 65%),linear-gradient(to top,${d1},#06060e)`,
    ice:`radial-gradient(ellipse 80% 55% at 50% 15%,${g1} 0%,transparent 70%),linear-gradient(to bottom,${d1} 0%,${d2} 65%,#040810 100%)`,
    cold:`radial-gradient(ellipse 80% 55% at 50% 15%,${g1} 0%,transparent 70%),linear-gradient(to bottom,${d1},#040810)`,
    calm:`radial-gradient(ellipse 70% 60% at 50% 30%,${g1} 0%,transparent 70%),linear-gradient(to bottom,${d2},#060810)`,
    dark:`radial-gradient(ellipse 50% 50% at 50% 50%,${g1} 0%,transparent 55%),#030308`,
    shadow:`radial-gradient(ellipse 45% 45% at 50% 50%,${g1} 0%,transparent 50%),#030307`,
    void:`radial-gradient(ellipse 35% 35% at 50% 50%,${rgba(pri,.1)} 0%,transparent 45%),#020205`,
    nature:`radial-gradient(ellipse 65% 75% at 30% 65%,${g1} 0%,transparent 65%),radial-gradient(ellipse 45% 35% at 80% 20%,${g2} 0%,transparent 55%),linear-gradient(155deg,${d2},${d1} 45%,#05080a 100%)`,
    forest:`radial-gradient(ellipse 70% 80% at 25% 60%,${g1} 0%,transparent 65%),linear-gradient(155deg,${d2},#040807)`,
    earth:`radial-gradient(ellipse 60% 60% at 40% 60%,${g1} 0%,transparent 60%),linear-gradient(to bottom,${d1},#060605)`,
    electric:`radial-gradient(ellipse 30% 75% at 50% 50%,${g1} 0%,transparent 65%),radial-gradient(ellipse 55% 55% at 50% 50%,${g2} 0%,transparent 50%),linear-gradient(to bottom,#060610,${d1} 50%,#040408)`,
    storm:`radial-gradient(ellipse 40% 80% at 50% 40%,${g1} 0%,transparent 65%),linear-gradient(to bottom,#07070f,${d1},#040408)`,
    lightning:`radial-gradient(ellipse 25% 90% at 50% 30%,${g3} 0%,transparent 60%),linear-gradient(to bottom,#08080f,#040408)`,
    cosmic:`radial-gradient(ellipse 85% 85% at 50% 50%,${g1} 0%,transparent 60%),radial-gradient(ellipse 35% 35% at 20% 80%,${g2} 0%,transparent 55%),radial-gradient(ellipse 28% 28% at 80% 18%,${rgba(acc,.09)} 0%,transparent 55%),#03030d`,
    space:`radial-gradient(ellipse 80% 80% at 50% 50%,${g1} 0%,transparent 60%),radial-gradient(ellipse 30% 30% at 75% 75%,${g2} 0%,transparent 50%),#03030c`,
    mystic:`radial-gradient(ellipse 70% 70% at 50% 40%,${g1} 0%,transparent 60%),radial-gradient(ellipse 40% 40% at 80% 80%,${g2} 0%,transparent 55%),#04030c`,
    neutral:`radial-gradient(ellipse 72% 58% at 50% 50%,${g1} 0%,transparent 68%),radial-gradient(ellipse 38% 38% at 78% 78%,${g2} 0%,transparent 58%),linear-gradient(to bottom,${d1} 0%,#060710 100%)`,
  };
  stageBg.style.background = presets[mood] || presets.neutral;
}

function applyHUD(data) {
  hudName.textContent = (data.name || 'UNKNOWN').toUpperCase();
  hudType.textContent = (data.type || '???').toUpperCase();
  hudId.textContent   = 'ID: ' + (data.id || String(Math.floor(Math.random()*9000+1000)));
  hudLore.textContent = data.lore || '';

  const stats = data.stats || {};
  const keys  = Object.keys(stats);
  statA.innerHTML = statB.innerHTML = '';
  document.getElementById('hud-stats').style.display = keys.length ? 'flex' : 'none';

  keys.forEach((k, i) => {
    const val = Math.min(100, Math.max(0, Number(stats[k]) || 0));
    const col = STAT_PALETTE[k.toLowerCase()] || '#c8a96e';
    const target = i % 2 === 0 ? statA : statB;
    target.innerHTML += `<div class="stat-row">
      <span class="stat-label">${k.slice(0,3).toUpperCase()}</span>
      <div class="stat-track"><div class="stat-fill" style="width:${val}%;background:${col};box-shadow:0 0 5px ${col}55;"></div></div>
      <span class="stat-val">${val}</span>
    </div>`;
  });
}

function buildDOM(elements) {
  elements.forEach((el, i) => {
    const div = document.createElement('div');
    div.id = el.id || `dom-${i}`;
    div.style.cssText = `position:absolute;left:${el.x||0}px;top:${el.y||0}px;${el.style||''}`;
    if (el.html)  div.innerHTML   = el.html;
    if (el.text)  div.textContent = el.text;
    if (el.class) div.className   = el.class;
    if (el.css_animation) {
      const n = `ka${i}_${Date.now()}`;
      const s = document.createElement('style');
      s.textContent = `@keyframes ${n}{${el.css_animation.keyframes||''}}`;
      document.head.appendChild(s);
      div.style.animation = `${n} ${el.css_animation.duration||'1s'} ${el.css_animation.timing||'ease-in-out'} ${el.css_animation.delay||'0s'} ${el.css_animation.iteration||'infinite'}`;
    }
    stageDom.appendChild(div);
  });
}

function loop() {
  ctx.clearRect(0, 0, STAGE, STAGE);
  const t = globalT;
  (charData.canvas_shapes || []).forEach(s => drawShape(ctx, canvas, s, t, charData));
  if (charData.canvas_code) {
    try { new Function('ctx','canvas','t','size','data',charData.canvas_code)(ctx,canvas,t,STAGE,charData); }
    catch(e) { showError('canvas_code: '+e.message); }
  }
  (charData.dom_animations || []).forEach(a => {
    try {
      const el = document.getElementById(a.target);
      if (el) new Function('el','t','data',a.code)(el,t,charData);
    } catch(e) { showError('dom_animation: '+e.message); }
  });
  globalT += (charData.scene?.speed || 0.018);
  animId = requestAnimationFrame(loop);
}

function setScale(s) {
  currentScale = s;
  const stageEl = document.getElementById('stage-canvas');
  const domEl   = document.getElementById('stage-dom');
  const vigEl   = document.getElementById('stage-vignette');
  const offset  = (STAGE - STAGE * s) / 2;
  const tx      = `translate(${offset}px, ${offset}px) scale(${s})`;
  
  [stageEl, domEl, vigEl].forEach(el => {
    if (el) {
      el.style.transformOrigin = 'top left';
      el.style.transform = s === 1 ? '' : tx;
    }
  });
  document.querySelectorAll('.scale-btn').forEach(b => {
    b.classList.toggle('active', parseFloat(b.dataset.scale) === s);
  });
  document.getElementById('scale-readout').textContent = Math.round(STAGE * s) + 'px';
}

/* UI Controls Event Configuration */
document.getElementById('load-btn').addEventListener('click', () => {
  try {
    const rawData = document.getElementById('load-textarea').value.trim();
    if (!rawData) return;
    renderCharacter(JSON.parse(rawData));
  } catch(e) { showError('JSON error: ' + e.message); }
});

document.getElementById('ijp-load-btn').addEventListener('click', () => {
  try {
    const rawData = document.getElementById('ijp-textarea').value.trim();
    if (!rawData) return;
    renderCharacter(JSON.parse(rawData));
  } catch(e) { showError('JSON error: ' + e.message); }
});

document.getElementById('view-chars-btn').addEventListener('click', enterViewMode);

document.getElementById('save-vault-btn').addEventListener('click', () => {
  saveToVault(charData, stageBg.style.background, () => renderVaultGrid(null, updateVaultBadge), updateVaultBadge);
});

document.getElementById('vault-view-btn').addEventListener('click', () => {
  if (!selectedVaultId) return;
  const entry = vault.find(v => v.id === selectedVaultId);
  if (entry) {
    renderCharacter(JSON.parse(JSON.stringify(entry.data)));
    setSelectedVaultId(null);
    updateVaultButtons();
    renderVaultGrid(() => renderVaultGrid(null, updateVaultBadge), updateVaultBadge);
  }
});

document.getElementById('vault-delete-btn').addEventListener('click', () => {
  if (!selectedVaultId) return;
  const idx = vault.findIndex(v => v.id === selectedVaultId);
  if (idx !== -1) vault.splice(idx, 1);
  setSelectedVaultId(null);
  vaultSave();
  renderVaultGrid(() => renderVaultGrid(null, updateVaultBadge), updateVaultBadge);
  updateVaultBadge();
});

document.querySelectorAll('.scale-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    setScale(parseFloat(e.target.dataset.scale));
  });
});

/* Drag and Drop Handlers */
['dragenter','dragover'].forEach(e => document.addEventListener(e, ev => { ev.preventDefault(); document.body.classList.add('drag-over'); }));
['dragleave','drop'].forEach(e => document.addEventListener(e, ev => { ev.preventDefault(); document.body.classList.remove('drag-over'); }));

document.addEventListener('drop', e => {
  const f = e.dataTransfer.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = ev => { try { renderCharacter(JSON.parse(ev.target.result)); } catch(err) { showError('File: ' + err.message); } };
  r.readAsText(f);
});

/* Context Parameters and Cross-Window Communications */
const qp = new URLSearchParams(window.location.search);
if (qp.has('data')) { try { renderCharacter(JSON.parse(decodeURIComponent(qp.get('data')))); } catch(e) { showError('URL: ' + e.message); } }

window.addEventListener('message', e => {
  if (e.data && e.data.type === 'RENDER_CHARACTER') {
    try { renderCharacter(typeof e.data.payload === 'string' ? JSON.parse(e.data.payload) : e.data.payload); }
    catch(err) { showError('postMessage: ' + err.message); }
  }
});

/* Initialize Vault System state on window setup */
vaultLoad(() => renderVaultGrid(null, updateVaultBadge), updateVaultBadge);
