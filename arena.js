import { BattleManager } from './battle/BattleManager.js';
import { vault } from './vault.js';
import { showError } from './helpers.js';
import { renderMiniCharacter } from './renderer.js';

let battleManager = null;
let arenaCanvas = null;
let selectedPlayerChar = null;
let selectedNPCs = []; // array of character objects

export function initArena() {
  arenaCanvas = document.getElementById('arena-canvas');
  document.getElementById('add-random-npc').addEventListener('click', addRandomNPC);
  document.getElementById('start-battle-btn').addEventListener('click', startBattle);
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
  populateCharacterLists(); // refresh in case vault changed
}

export function hideArena() {
  if (battleManager) battleManager.stop();
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

function populateCharacterLists() {
  const playerListDiv = document.getElementById('player-character-list');
  const npcListDiv = document.getElementById('npc-character-list');
  playerListDiv.innerHTML = '';
  npcListDiv.innerHTML = '';

  if (!vault.length) {
    playerListDiv.innerHTML = '<div class="arena-char-item">No characters in vault</div>';
    npcListDiv.innerHTML = '<div class="arena-char-item">No characters in vault</div>';
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
  thumbCanvas.width = 40;
  thumbCanvas.height = 40;
  thumbCanvas.className = 'arena-char-thumb';
  renderMiniCharacter(char, thumbCanvas);
  const infoDiv = document.createElement('div');
  infoDiv.className = 'arena-char-info';
  infoDiv.innerHTML = `
    <div class="arena-char-name">${char.name || 'Unknown'}</div>
    <div class="arena-char-stats">${Object.entries(char.stats || {}).slice(0,2).map(([k,v])=>`${k}:${v}`).join(' ')}</div>
  `;
  div.appendChild(thumbCanvas);
  div.appendChild(infoDiv);
  if (isPlayer && selectedPlayerChar === char) div.classList.add('selected');
  if (!isPlayer && selectedNPCs.includes(char)) div.classList.add('selected');
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
    if (selectedNPCs.length >= 5) {
      showError('Maximum 5 NPCs allowed');
      return;
    }
    selectedNPCs.push(char);
    element.classList.add('selected');
  }
  updateStartButton();
}

function addRandomNPC() {
  if (!vault.length) return;
  const available = vault.filter(entry => !selectedNPCs.includes(entry.data) && entry.data !== selectedPlayerChar);
  if (available.length === 0) return;
  const randomEntry = available[Math.floor(Math.random() * available.length)];
  const randomChar = randomEntry.data;
  if (selectedNPCs.length < 5) {
    selectedNPCs.push(randomChar);
    populateCharacterLists(); // refresh to show selection
  } else {
    showError('Maximum NPCs reached (5)');
  }
}

function updateStartButton() {
  const btn = document.getElementById('start-battle-btn');
  btn.disabled = !(selectedPlayerChar && selectedNPCs.length >= 2);
}

function startBattle() {
  if (!selectedPlayerChar || selectedNPCs.length < 2) return;
  if (battleManager) battleManager.stop();
  battleManager = new BattleManager(arenaCanvas, 1000, 600);
  battleManager.setCharacters(selectedPlayerChar, selectedNPCs);
  battleManager.start();
  document.getElementById('arena-status').textContent = 'BATTLE IN PROGRESS';
  const logDiv = document.getElementById('battle-log');
  battleManager.setLogCallback((msg) => {
    const entry = document.createElement('div');
    entry.textContent = msg;
    logDiv.appendChild(entry);
    logDiv.scrollTop = logDiv.scrollHeight;
  });
}