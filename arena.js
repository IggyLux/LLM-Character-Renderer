import { BattleManager } from './battle/BattleManager.js';
import { vault } from './vault.js';
import { showError, STAGE, ev, evc, executionBridge } from './helpers.js';
import { renderMiniCharacter } from './renderer.js';

let battleManager     = null;
let arenaCanvas       = null;
let arenaDomLayer     = null;
let selectedPlayerChar = null;
let selectedNPCs      = [];
let zoomLevel         = 1.0;
let domAnimFrameId    = null;

// ── DOM element layer: per-entity containers ─────────────────────
// Maps entity → div (inside #arena-dom-layer)
const entityDomContainers = new Map();

// ── Zoom ─────────────────────────────────────────────────────────
function applyZoom(val) {
  zoomLevel = val;
  const wrap = document.getElementById('arena-stage-wrap');
  if (wrap) wrap.style.transform = `scale(${val})`;
  const readout = document.getElementById('arena-zoom-readout');
  if (readout) readout.textContent = Math.round(val * 100) + '%';
}

export function initArena() {
  arenaCanvas   = document.getElementById('arena-canvas');
  arenaDomLayer = document.getElementById('arena-dom-layer');

  document.getElementById('add-random-npc').addEventListener('click', addRandomNPC);
  document.getElementById('start-battle-btn').addEventListener('click', startBattle);

  // Zoom slider
  const slider = document.getElementById('arena-zoom-slider');
  if (slider) {
    slider.addEventListener('input', () => applyZoom(parseFloat(slider.value)));
    applyZoom(parseFloat(slider.value));
  }

  // Resize canvas buffer when viewport changes
  window.addEventListener('resize', () => {
    if (battleManager && battleManager.isRunning) resizeArenaCanvas();
  });

  populateCharacterLists();
}

export function showArena() {
  document.getElementById('arena-view').style.display = 'flex';
  document.getElementById('enter-arena-btn').style.display = 'none';
  document.getElementById('exit-arena-btn').style.display = 'block';
  document.getElementById('frame').style.display = 'none';
  document.getElementById('load-ui').style.display = 'none';
  document.getElementById('vault-panel').classList.remove('visible');
  document.getElementById('inline-json-panel').classList.remove('visible');
  document.getElementById('scale-panel').classList.remove('visible');
  populateCharacterLists();
}

export function hideArena() {
  if (battleManager) battleManager.stop();
  stopDomAnimations();
  clearEntityDomContainers();

  document.getElementById('arena-view').style.display = 'none';
  document.getElementById('enter-arena-btn').style.display = 'block';
  document.getElementById('exit-arena-btn').style.display = 'none';
  document.getElementById('frame').style.display = 'flex';
  document.getElementById('load-ui').style.display = 'flex';
  document.getElementById('vault-panel').classList.add('visible');
  document.getElementById('inline-json-panel').classList.add('visible');
  document.getElementById('scale-panel').classList.add('visible');
  selectedPlayerChar = null;
  selectedNPCs = [];
  updateStartButton();
}

// ── Canvas sizing ─────────────────────────────────────────────────
function resizeArenaCanvas() {
  const viewport = document.getElementById('arena-canvas-viewport');
  if (!viewport) return;
  const rect = viewport.getBoundingClientRect();
  arenaCanvas.width  = rect.width;
  arenaCanvas.height = rect.height;
  if (arenaDomLayer) {
    arenaDomLayer.style.width  = rect.width  + 'px';
    arenaDomLayer.style.height = rect.height + 'px';
  }
  if (battleManager) {
    battleManager.width  = rect.width;
    battleManager.height = rect.height;
  }
}

// ── DOM element rendering ─────────────────────────────────────────
// Builds per-entity DOM containers from character JSON dom_elements.
// These sit in #arena-dom-layer, positioned to track entity.pos each frame.
function buildEntityDomContainers(entities) {
  clearEntityDomContainers();
  if (!arenaDomLayer) return;

  entities.forEach(entity => {
    const domEls = entity.data.dom_elements;
    if (!domEls || !domEls.length) return;

    // Outer container tracks entity world position
    const container = document.createElement('div');
    container.className = 'arena-entity-dom';
    container.style.cssText = 'position:absolute; pointer-events:none; overflow:visible;';

    // Scale factor: arena characters render at 112px on a 480px stage
    const domScale = 112 / STAGE;

    // Inner wrapper applies the scale
    const inner = document.createElement('div');
    inner.style.cssText = `
      position:absolute;
      transform-origin: top left;
      transform: scale(${domScale}) translate(-50%, -50%);
      width: ${STAGE}px;
      height: ${STAGE}px;
      pointer-events:none;
    `;

    // Inject global_style if present
    if (entity.data.global_style) {
      const styleEl = document.createElement('style');
      styleEl.textContent = entity.data.global_style;
      inner.appendChild(styleEl);
    }

    domEls.forEach((el, i) => {
      const div = document.createElement('div');
      div.id = `arena_${entity.name.replace(/\W/g,'_')}_dom_${i}`;
      div.style.cssText = `position:absolute; left:${el.x||0}px; top:${el.y||0}px; ${el.style||''}`;
      if (el.html)  div.innerHTML   = el.html;
      if (el.text)  div.textContent = el.text;
      if (el.class) div.className   = el.class;

      if (el.css_animation) {
        const animName = `arena_anim_${entity.name.replace(/\W/g,'_')}_${i}`;
        const styleEl  = document.createElement('style');
        styleEl.textContent = `@keyframes ${animName}{${el.css_animation.keyframes||''}}`;
        document.head.appendChild(styleEl);
        div.style.animation = `${animName} ${el.css_animation.duration||'1s'} ${el.css_animation.timing||'ease-in-out'} ${el.css_animation.delay||'0s'} ${el.css_animation.iteration||'infinite'}`;
      }
      inner.appendChild(div);
    });

    container.appendChild(inner);
    arenaDomLayer.appendChild(container);
    entityDomContainers.set(entity, { container, domEls: entity.data.dom_elements || [], domAnimations: entity.data.dom_animations || [] });
  });
}

function clearEntityDomContainers() {
  if (arenaDomLayer) arenaDomLayer.innerHTML = '';
  entityDomContainers.clear();
}

// Update DOM container positions to follow entity world coords each frame
function updateDomPositions(entities, globalT) {
  entities.forEach(entity => {
    const entry = entityDomContainers.get(entity);
    if (!entry) return;
    const { container, domAnimations } = entry;
    // Position outer container at entity's canvas position
    container.style.left = entity.pos.x + 'px';
    container.style.top  = entity.pos.y + 'px';

    // Run dom_animations if present
    domAnimations.forEach((anim, i) => {
      const targetId = `arena_${entity.name.replace(/\W/g,'_')}_dom_${i}`;
      const el = document.getElementById(targetId) || container.querySelector(`[id$="_dom_${i}"]`);
      if (el && anim.code) {
        try {
          new Function('el','t','data','helpers',
            'with(helpers){' + anim.code + '}'
          )(el, globalT, entity.data, executionBridge);
        } catch(e) {}
      }
    });
  });
}

// Kick off a lightweight rAF loop just for DOM position sync
// (BattleManager has its own loop; we piggyback here)
function startDomAnimations() {
  stopDomAnimations();
  let lastT = performance.now();
  function tick(now) {
    const dt = (now - lastT) / 1000;
    lastT = now;
    if (battleManager) {
      updateDomPositions(battleManager.entities, battleManager.globalT);
    }
    domAnimFrameId = requestAnimationFrame(tick);
  }
  domAnimFrameId = requestAnimationFrame(tick);
}

function stopDomAnimations() {
  if (domAnimFrameId) cancelAnimationFrame(domAnimFrameId);
  domAnimFrameId = null;
}

// ── Character selection UI ────────────────────────────────────────
function populateCharacterLists() {
  const playerListDiv = document.getElementById('player-character-list');
  const npcListDiv    = document.getElementById('npc-character-list');
  playerListDiv.innerHTML = '';
  npcListDiv.innerHTML    = '';

  if (!vault.length) {
    playerListDiv.innerHTML = '<div class="arena-char-item">No characters in vault</div>';
    npcListDiv.innerHTML    = '<div class="arena-char-item">No characters in vault</div>';
    return;
  }

  vault.forEach(entry => {
    const char = entry.data;
    const playerItem = createCharacterItem(char, true);
    playerItem.addEventListener('click', () => selectPlayerCharacter(char, playerItem));
    playerListDiv.appendChild(playerItem);

    const npcItem = createCharacterItem(char, false);
    npcItem.addEventListener('click', () => toggleNPCSelection(char, npcItem));
    npcListDiv.appendChild(npcItem);
  });
}

function createCharacterItem(char, isPlayer) {
  const div = document.createElement('div');
  div.className = 'arena-char-item';

  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = thumbCanvas.height = 56;
  thumbCanvas.className = 'arena-char-thumb';
  renderMiniCharacter(char, thumbCanvas);

  const infoDiv = document.createElement('div');
  infoDiv.className = 'arena-char-info';
  infoDiv.innerHTML = `
    <div class="arena-char-name">${char.name || 'Unknown'}</div>
    <div class="arena-char-stats">${Object.entries(char.stats || {}).slice(0,3).map(([k,v])=>`${k}:${v}`).join(' · ')}</div>
  `;
  div.appendChild(thumbCanvas);
  div.appendChild(infoDiv);

  if (isPlayer  && selectedPlayerChar === char) div.classList.add('selected');
  if (!isPlayer && selectedNPCs.includes(char))  div.classList.add('selected');
  return div;
}

function selectPlayerCharacter(char, element) {
  document.querySelectorAll('#player-character-list .arena-char-item').forEach(el => el.classList.remove('selected'));
  element.classList.add('selected');
  selectedPlayerChar = char;
  updateStartButton();
}

function toggleNPCSelection(char, element) {
  if (selectedNPCs.includes(char)) {
    selectedNPCs = selectedNPCs.filter(c => c !== char);
    element.classList.remove('selected');
  } else {
    if (selectedNPCs.length >= 5) { showError('Maximum 5 NPCs allowed'); return; }
    selectedNPCs.push(char);
    element.classList.add('selected');
  }
  updateStartButton();
}

function addRandomNPC() {
  if (!vault.length) return;
  const available = vault.filter(e => !selectedNPCs.includes(e.data) && e.data !== selectedPlayerChar);
  if (!available.length) return;
  const pick = available[Math.floor(Math.random() * available.length)].data;
  if (selectedNPCs.length < 5) {
    selectedNPCs.push(pick);
    populateCharacterLists();
  } else {
    showError('Maximum NPCs reached (5)');
  }
}

function updateStartButton() {
  const btn = document.getElementById('start-battle-btn');
  btn.disabled = !(selectedPlayerChar && selectedNPCs.length >= 1);
}

// ── Battle start ──────────────────────────────────────────────────
function startBattle() {
  if (!selectedPlayerChar || !selectedNPCs.length) return;
  if (battleManager) { battleManager.stop(); stopDomAnimations(); }

  resizeArenaCanvas();

  const w = arenaCanvas.width;
  const h = arenaCanvas.height;

  battleManager = new BattleManager(arenaCanvas, w, h);
  battleManager.setCharacters(selectedPlayerChar, selectedNPCs);
  battleManager.start();

  // Build DOM overlay containers for all entities
  buildEntityDomContainers(battleManager.entities);
  startDomAnimations();

  document.getElementById('arena-status').textContent = 'BATTLE IN PROGRESS';

  const logDiv = document.getElementById('battle-log');
  logDiv.innerHTML = '';
  battleManager.setLogCallback(msg => {
    const entry = document.createElement('div');
    entry.textContent = msg;
    logDiv.appendChild(entry);
    logDiv.scrollTop = logDiv.scrollHeight;
  });
}
