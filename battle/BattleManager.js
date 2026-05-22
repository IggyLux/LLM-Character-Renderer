import { renderMiniCharacter } from '../renderer.js';
import { CharacterEntity } from './CharacterEntity.js';

export class BattleManager {
  constructor(canvas, width, height) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = width;
    this.height = height;
    this.entities = [];
    this.animationId = null;
    this.lastTimestamp = 0;
    this.isRunning = false;
    this.logCallback = null;
  }

  setLogCallback(cb) {
    this.logCallback = cb;
    window.battleLogCallback = cb;
  }

  setCharacters(playerChar, npcChars) {
    this.entities = [];
    // Player spawn (left side)
    const playerEntity = new CharacterEntity(playerChar, 150, this.height/2, true);
    this.entities.push(playerEntity);
    // NPCs spawn scattered on right side
    npcChars.forEach((npc, i) => {
      const x = this.width - 150;
      const y = 100 + (i * 100) % (this.height - 200);
      const npcEntity = new CharacterEntity(npc, x, y, false);
      this.entities.push(npcEntity);
    });
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTimestamp = performance.now();
    this.loop();
  }

  stop() {
    this.isRunning = false;
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.animationId = null;
  }

  loop() {
    if (!this.isRunning) return;
    const now = performance.now();
    let dt = Math.min(0.033, (now - this.lastTimestamp) / 1000);
    this.lastTimestamp = now;
    
    this.update(dt);
    this.render();
    
    this.animationId = requestAnimationFrame(() => this.loop());
  }

  update(dt) {
    // Update each entity
    for (let entity of this.entities) {
      entity.update(dt, this.entities, this.width, this.height);
    }
    // Remove dead entities
    const aliveBefore = this.entities.length;
    this.entities = this.entities.filter(e => e.isAlive);
    if (this.entities.length !== aliveBefore && this.logCallback) {
      this.logCallback(`⚰️ A warrior has fallen.`);
    }

    // Determine winner
    const hasPlayer = this.entities.some(e => e.isPlayer);
    const hasNPC = this.entities.some(e => !e.isPlayer);
    if (!hasPlayer) {
      this.stop();
      if (this.logCallback) this.logCallback("💀 DEFEAT! All your champions are dead.");
      alert("YOU LOST!");
      document.getElementById('arena-status').textContent = "DEFEAT";
    } else if (!hasNPC) {
      this.stop();
      if (this.logCallback) this.logCallback("🏆 VICTORY! You conquered the arena.");
      alert("YOU WIN!");
      document.getElementById('arena-status').textContent = "VICTORY";
    }
  }

  render() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    // Draw ground grid
    this.ctx.strokeStyle = "rgba(200,169,110,0.1)";
    this.ctx.lineWidth = 1;
    for (let i = 0; i < this.width; i += 50) {
      this.ctx.beginPath();
      this.ctx.moveTo(i, 0);
      this.ctx.lineTo(i, this.height);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(0, i);
      this.ctx.lineTo(this.width, i);
      this.ctx.stroke();
    }

    // Draw each character
    for (let entity of this.entities) {
      this.drawCharacter(entity);
      this.drawHealthBar(entity);
    }
  }

  drawCharacter(entity) {
    const size = 56;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = offCanvas.height = 120;
    renderMiniCharacter(entity.data, offCanvas);
    this.ctx.drawImage(offCanvas, entity.pos.x - size/2, entity.pos.y - size/2, size, size);
    // Highlight player with a subtle ring
    if (entity.isPlayer) {
      this.ctx.beginPath();
      this.ctx.arc(entity.pos.x, entity.pos.y, size/2 + 4, 0, Math.PI*2);
      this.ctx.strokeStyle = "#c8a96e";
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();
    }
  }

  drawHealthBar(entity) {
    const hpPercent = entity.currentHp / entity.stats.max_hp;
    const barWidth = 50;
    const barHeight = 6;
    const x = entity.pos.x - barWidth/2;
    const y = entity.pos.y - 32;
    this.ctx.fillStyle = "#330000";
    this.ctx.fillRect(x, y, barWidth, barHeight);
    this.ctx.fillStyle = "#cc5555";
    this.ctx.fillRect(x, y, barWidth * hpPercent, barHeight);
    // Name label
    this.ctx.font = "8px 'Courier New', monospace";
    this.ctx.fillStyle = "rgba(200,169,110,0.8)";
    this.ctx.fillText(entity.name.slice(0,10), x, y-2);
  }
}