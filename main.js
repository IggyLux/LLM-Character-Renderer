import { initViewer, renderCharacter, stopViewerLoop, startViewerLoop, getCurrentCharacter, setScale } from './viewer.js';
import { initArena, showArena, hideArena } from './arena.js';
import { vaultLoad } from './vault.js';
import { showError } from './helpers.js';

let currentMode = 'viewer'; // 'viewer' or 'arena'

function switchToViewer() {
  if (currentMode === 'viewer') return;
  hideArena();
  stopViewerLoop();
  startViewerLoop();
  currentMode = 'viewer';
}

function switchToArena() {
  if (currentMode === 'arena') return;
  stopViewerLoop();
  showArena();
  currentMode = 'arena';
}

document.addEventListener('DOMContentLoaded', () => {
  initViewer();
  initArena();

  // Mode buttons
  document.getElementById('enter-arena-btn').addEventListener('click', switchToArena);
  document.getElementById('exit-arena-btn').addEventListener('click', switchToViewer);

  // Load vault and then optionally load initial demo character
  vaultLoad(() => {
    // if no character loaded, maybe load a default?
  });

  // Drag & drop support
  ['dragenter','dragover'].forEach(e => document.addEventListener(e, ev => { ev.preventDefault(); document.body.classList.add('drag-over'); }));
  ['dragleave','drop'].forEach(e => document.addEventListener(e, ev => { ev.preventDefault(); document.body.classList.remove('drag-over'); }));
  document.addEventListener('drop', e => {
    const f = e.dataTransfer.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => { try { renderCharacter(JSON.parse(ev.target.result)); } catch(err) { showError('File: ' + err.message); } };
    r.readAsText(f);
  });

  // URL param
  const qp = new URLSearchParams(window.location.search);
  if (qp.has('data')) { try { renderCharacter(JSON.parse(decodeURIComponent(qp.get('data')))); } catch(e) { showError('URL: ' + e.message); } }

  // postMessage API
  window.addEventListener('message', e => {
    if (e.data && e.data.type === 'RENDER_CHARACTER') {
      try { renderCharacter(typeof e.data.payload === 'string' ? JSON.parse(e.data.payload) : e.data.payload); }
      catch(err) { showError('postMessage: ' + err.message); }
    }
  });
});