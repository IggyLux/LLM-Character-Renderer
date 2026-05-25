// BattleManager.js — Weapon effects, richer arena, overlay victory screen

import { renderMiniCharacter } from '../renderer.js';
import { CharacterEntity }     from './CharacterEntity.js';

// ─────────────────────────────────────────────
//  ATTACK EFFECT RENDERERS
//  Each function receives: ctx, event, progress (0→1)
//  event = { type, origin, targetPos, color, color2, damage }
//  All effects originate from the attacker and extend toward the target.
// ─────────────────────────────────────────────

const AttackEffects = {

  // ── Melee slash arc ──────────────────────────────────────────
  melee_slash(ctx, ev, p) {
    const { origin: o, targetPos: t, color } = ev;
    const angle  = Math.atan2(t.y - o.y, t.x - o.x);
    const len    = Math.min(80, Math.hypot(t.x - o.x, t.y - o.y) * 0.6);
    const spread = Math.PI * 0.45;
    const alpha  = p < 0.5 ? p * 2 : (1 - p) * 2;

    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.globalAlpha = alpha * 0.85;

    // Arc sweep
    for (let i = 0; i < 3; i++) {
      const startA = angle - spread * 0.5 + (spread * p * (1 + i * 0.1));
      ctx.beginPath();
      ctx.arc(0, 0, len - i * 8, startA - 0.35, startA + 0.35);
      ctx.strokeStyle = i === 0 ? '#ffffff' : color;
      ctx.lineWidth   = 4 - i;
      ctx.shadowColor = color;
      ctx.shadowBlur  = 12;
      ctx.stroke();
    }

    // Impact flash at target
    if (p > 0.5) {
      ctx.translate(t.x - o.x, t.y - o.y);
      ctx.globalAlpha = (1 - p) * 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 16 * (1 - p) * 2, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowBlur = 20;
      ctx.fill();
    }
    ctx.restore();
  },

  // ── Projectile — travels from origin to target ───────────────
  projectile(ctx, ev, p) {
    const { origin: o, targetPos: t, color, color2 } = ev;
    const px   = o.x + (t.x - o.x) * p;
    const py   = o.y + (t.y - o.y) * p;
    const tail = 0.18;
    const tx   = o.x + (t.x - o.x) * Math.max(0, p - tail);
    const ty   = o.y + (t.y - o.y) * Math.max(0, p - tail);

    ctx.save();

    // Tail trail
    const grad = ctx.createLinearGradient(tx, ty, px, py);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(1, color);
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(px, py);
    ctx.strokeStyle = grad;
    ctx.lineWidth   = 4;
    ctx.shadowColor = color;
    ctx.shadowBlur  = 14;
    ctx.stroke();

    // Projectile head
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fillStyle   = color2 || '#ffffff';
    ctx.shadowBlur  = 20;
    ctx.fill();

    // Impact burst when arriving
    if (p > 0.85) {
      const burstAlpha = (p - 0.85) / 0.15;
      ctx.globalAlpha  = burstAlpha * 0.9;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 14 * burstAlpha, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.restore();
  },

  // ── Energy beam — continuous line, flickers ──────────────────
  beam(ctx, ev, p) {
    const { origin: o, targetPos: t, color, color2 } = ev;
    // Beam extends from origin to (origin + progress * distance)
    const ex = o.x + (t.x - o.x) * Math.min(1, p * 1.6);
    const ey = o.y + (t.y - o.y) * Math.min(1, p * 1.6);
    const alpha = p < 0.15 ? p / 0.15 : p > 0.8 ? (1 - p) / 0.2 : 1.0;

    ctx.save();
    ctx.globalAlpha = alpha * 0.95;

    // Core beam
    const grad = ctx.createLinearGradient(o.x, o.y, ex, ey);
    grad.addColorStop(0, color2 || '#ffffff');
    grad.addColorStop(1, color);
    ctx.beginPath();
    ctx.moveTo(o.x, o.y);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = grad;
    ctx.lineWidth   = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur  = 22;
    ctx.stroke();

    // Glow halo
    ctx.lineWidth   = 8;
    ctx.globalAlpha = alpha * 0.25;
    ctx.stroke();

    // Flicker particles along beam
    const count = 5;
    for (let i = 0; i < count; i++) {
      const frac  = (i / count + p * 0.5) % 1;
      const fpx   = o.x + (ex - o.x) * frac;
      const fpy   = o.y + (ey - o.y) * frac;
      ctx.globalAlpha = alpha * (0.3 + Math.random() * 0.5);
      ctx.beginPath();
      ctx.arc(fpx + (Math.random() - 0.5) * 6, fpy + (Math.random() - 0.5) * 6, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    ctx.restore();
  },

  // ── Lightning arc — jagged bolt ──────────────────────────────
  lightning(ctx, ev, p) {
    const { origin: o, targetPos: t, color } = ev;
    const alpha = p < 0.2 ? p / 0.2 : p > 0.7 ? (1 - p) / 0.3 : 1.0;
    const segments = 8;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Draw 2 layered bolts for thickness
    for (let layer = 0; layer < 2; layer++) {
      ctx.beginPath();
      ctx.moveTo(o.x, o.y);

      let cx = o.x, cy = o.y;
      const dx = t.x - o.x, dy = t.y - o.y;
      for (let i = 1; i <= segments; i++) {
        const frac = i / segments;
        const nx   = o.x + dx * frac;
        const ny   = o.y + dy * frac;
        const jitter = (layer === 0 ? 14 : 6) * (1 - frac * 0.5);
        cx = nx + (Math.random() - 0.5) * jitter;
        cy = ny + (Math.random() - 0.5) * jitter;
        if (i === segments) { cx = t.x; cy = t.y; }
        ctx.lineTo(cx, cy);
      }
      ctx.strokeStyle = layer === 0 ? color : '#ffffff';
      ctx.lineWidth   = layer === 0 ? 2 : 1;
      ctx.shadowColor = color;
      ctx.shadowBlur  = layer === 0 ? 20 : 8;
      ctx.stroke();
    }

    // Strike flash at target
    ctx.globalAlpha = alpha * 0.6;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowBlur = 25;
    ctx.fill();

    ctx.restore();
  },

  // ── Poison cloud — expanding blob ───────────────────────────
  poison_cloud(ctx, ev, p) {
    const { origin: o, targetPos: t, color } = ev;
    const cx    = o.x + (t.x - o.x) * 0.7;
    const cy    = o.y + (t.y - o.y) * 0.7;
    const alpha = p < 0.3 ? p / 0.3 : p > 0.6 ? (1 - p) / 0.4 : 1.0;
    const radius = 8 + p * 28;

    ctx.save();

    // Drifting cloud blobs
    const blobs = 6;
    for (let i = 0; i < blobs; i++) {
      const bAngle = (i / blobs) * Math.PI * 2 + p * 3;
      const bDist  = radius * 0.5;
      const bx     = cx + Math.cos(bAngle) * bDist * (0.5 + Math.random() * 0.5);
      const by     = cy + Math.sin(bAngle) * bDist * (0.5 + Math.random() * 0.5);
      const bRad   = radius * (0.4 + Math.random() * 0.4);
      ctx.globalAlpha = alpha * 0.35;
      ctx.beginPath();
      ctx.arc(bx, by, bRad, 0, Math.PI * 2);
      ctx.fillStyle = color || '#44ff44';
      ctx.shadowColor = color;
      ctx.shadowBlur  = 12;
      ctx.fill();
    }

    // Drip trail from origin to cloud center
    ctx.globalAlpha = alpha * 0.5;
    ctx.beginPath();
    ctx.moveTo(o.x, o.y);
    ctx.lineTo(cx, cy);
    ctx.strokeStyle = color || '#44ff44';
    ctx.lineWidth   = 2;
    ctx.setLineDash([3, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  },

  // ── Frost lance — crystalline spike ─────────────────────────
  frost_lance(ctx, ev, p) {
    const { origin: o, targetPos: t, color } = ev;
    const angle  = Math.atan2(t.y - o.y, t.x - o.x);
    const len    = Math.hypot(t.x - o.x, t.y - o.y) * Math.min(1, p * 1.4);
    const alpha  = p < 0.1 ? p / 0.1 : p > 0.8 ? (1 - p) / 0.2 : 1.0;
    const tipX   = o.x + Math.cos(angle) * len;
    const tipY   = o.y + Math.sin(angle) * len;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Main lance shaft
    ctx.beginPath();
    ctx.moveTo(o.x, o.y);
    ctx.lineTo(tipX, tipY);
    ctx.strokeStyle = color || '#aaddff';
    ctx.lineWidth   = 5;
    ctx.shadowColor = color || '#aaddff';
    ctx.shadowBlur  = 18;
    ctx.stroke();

    // Crystal facets along shaft
    const facets = 5;
    for (let i = 1; i < facets; i++) {
      const frac = i / facets;
      if (frac > p) break;
      const fx   = o.x + Math.cos(angle) * len * frac;
      const fy   = o.y + Math.sin(angle) * len * frac;
      const perpA = angle + Math.PI / 2;
      const fLen  = 7 * (1 - frac * 0.4);
      ctx.beginPath();
      ctx.moveTo(fx + Math.cos(perpA) * fLen, fy + Math.sin(perpA) * fLen);
      ctx.lineTo(fx - Math.cos(perpA) * fLen, fy - Math.sin(perpA) * fLen);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth   = 1.5;
      ctx.globalAlpha = alpha * 0.6;
      ctx.stroke();
    }

    // Tip burst
    if (p > 0.7) {
      ctx.globalAlpha = (p - 0.7) / 0.3 * alpha;
      ctx.beginPath();
      ctx.arc(tipX, tipY, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    ctx.restore();
  },

  // ── AOE pulse — expanding ring from attacker ─────────────────
  aoe_pulse(ctx, ev, p) {
    const { origin: o, color, color2 } = ev;
    const maxR  = 70;
    const r     = p * maxR;
    const alpha = (1 - p) * 0.9;

    ctx.save();

    // Outer ring
    ctx.beginPath();
    ctx.arc(o.x, o.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth   = 3 * (1 - p);
    ctx.globalAlpha = alpha;
    ctx.shadowColor = color;
    ctx.shadowBlur  = 20;
    ctx.stroke();

    // Inner fill fade
    ctx.beginPath();
    ctx.arc(o.x, o.y, r * 0.6, 0, Math.PI * 2);
    ctx.fillStyle   = color2 || color;
    ctx.globalAlpha = alpha * 0.15;
    ctx.fill();

    // Radial spikes
    const spikes = 8;
    for (let i = 0; i < spikes; i++) {
      const sa = (i / spikes) * Math.PI * 2;
      ctx.globalAlpha = alpha * 0.5;
      ctx.beginPath();
      ctx.moveTo(o.x + Math.cos(sa) * r * 0.7, o.y + Math.sin(sa) * r * 0.7);
      ctx.lineTo(o.x + Math.cos(sa) * r * 1.1, o.y + Math.sin(sa) * r * 1.1);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth   = 1;
      ctx.stroke();
    }
    ctx.restore();
  },

  // ── Spinning blade — rotates toward target ───────────────────
  spinning_blade(ctx, ev, p) {
    const { origin: o, targetPos: t, color } = ev;
    const px     = o.x + (t.x - o.x) * p;
    const py     = o.y + (t.y - o.y) * p;
    const angle  = Math.atan2(t.y - o.y, t.x - o.x) + p * Math.PI * 6;
    const size   = 10;
    const alpha  = p > 0.85 ? (1 - p) / 0.15 : 1.0;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.shadowColor = color;
    ctx.shadowBlur  = 16;

    // Blade shape
    for (let blade = 0; blade < 3; blade++) {
      ctx.rotate(Math.PI * 2 / 3);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(size, -size * 0.3);
      ctx.lineTo(size * 1.6, 0);
      ctx.lineTo(size, size * 0.3);
      ctx.closePath();
      ctx.fillStyle = blade === 0 ? '#ffffff' : color;
      ctx.fill();
    }

    // Motion trail
    ctx.globalAlpha = alpha * 0.3;
    ctx.beginPath();
    ctx.arc(0, 0, size * 1.2, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2;
    ctx.stroke();

    ctx.restore();
  },

  // ── Fire trail — flame stream ────────────────────────────────
  fire_trail(ctx, ev, p) {
    const { origin: o, targetPos: t, color, color2 } = ev;
    const segments = 12;
    ctx.save();

    for (let i = 0; i < segments; i++) {
      const frac   = (i / segments) * p;
      const fx     = o.x + (t.x - o.x) * frac;
      const fy     = o.y + (t.y - o.y) * frac;
      const radius = 4 + (frac * 12);
      const alpha  = (1 - frac) * 0.75 * (p < 0.1 ? p / 0.1 : 1);

      ctx.beginPath();
      ctx.arc(
        fx + (Math.random() - 0.5) * radius * 0.4,
        fy + (Math.random() - 0.5) * radius * 0.4,
        radius * (0.5 + Math.random() * 0.5),
        0, Math.PI * 2
      );
      // Fire gradient: white core → orange → color
      const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, radius);
      g.addColorStop(0,   '#ffffff');
      g.addColorStop(0.3, color2 || '#ff8800');
      g.addColorStop(1,   color  || '#ff2200');
      ctx.fillStyle   = g;
      ctx.globalAlpha = alpha;
      ctx.shadowColor = color || '#ff4400';
      ctx.shadowBlur  = 14;
      ctx.fill();
    }
    ctx.restore();
  },
};

// Map attack_type strings to effect functions
function resolveEffect(type) {
  const map = {
    melee_slash:    'melee_slash',
    slash:          'melee_slash',
    melee:          'melee_slash',
    projectile:     'projectile',
    bullet:         'projectile',
    arrow:          'projectile',
    orb:            'projectile',
    beam:           'beam',
    laser:          'beam',
    ray:            'beam',
    lightning:      'lightning',
    thunder:        'lightning',
    electric:       'lightning',
    poison:         'poison_cloud',
    toxic:          'poison_cloud',
    acid:           'poison_cloud',
    frost:          'frost_lance',
    ice:            'frost_lance',
    freeze:         'frost_lance',
    aoe:            'aoe_pulse',
    pulse:          'aoe_pulse',
    explosion:      'aoe_pulse',
    shockwave:      'aoe_pulse',
    blade:          'spinning_blade',
    boomerang:      'spinning_blade',
    chakram:        'spinning_blade',
    fire:           'fire_trail',
    flame:          'fire_trail',
    burn:           'fire_trail',
  };
  return AttackEffects[map[type]] || AttackEffects.melee_slash;
}

// ─────────────────────────────────────────────
//  ACTIVE EFFECTS — pooled list of in-flight effects
// ─────────────────────────────────────────────
class ActiveEffect {
  constructor(event) {
    this.event    = event;
    this.progress = 0;
    this.duration = this._duration(event.type);
    this.done     = false;
    this.fn       = resolveEffect(event.type);
  }
  _duration(type) {
    const fast = { melee_slash: 0.22, aoe_pulse: 0.45, lightning: 0.28 };
    const slow = { beam: 0.55, fire_trail: 0.50, poison_cloud: 0.60 };
    return fast[type] || slow[type] || 0.35;
  }
  update(dt) {
    this.progress += dt / this.duration;
    if (this.progress >= 1) { this.progress = 1; this.done = true; }
  }
  render(ctx) {
    this.fn(ctx, this.event, this.progress);
  }
}

// ─────────────────────────────────────────────
//  BATTLE MANAGER
// ─────────────────────────────────────────────
export class BattleManager {
  constructor(canvas, width, height) {
    this.canvas        = canvas;
    this.ctx           = canvas.getContext('2d');
    this.width         = width;
    this.height        = height;
    this.entities      = [];
    this.effects       = [];   // active attack effects
    this.animationId   = null;
    this.lastTimestamp = 0;
    this.isRunning     = false;
    this.logCallback   = null;
    this.globalT       = 0;    // passed to CharacterEntity for drift

    // Offscreen character cache: Map<entity, {canvas, dirty}>
    this._charCache = new Map();
  }

  setLogCallback(cb) {
    this.logCallback           = cb;
    window.battleLogCallback   = cb;
  }

  setCharacters(playerChar, npcChars) {
    this.entities    = [];
    this._charCache  = new Map();
    this.effects     = [];

    const playerEntity = new CharacterEntity(playerChar, this.width * 0.2, this.height / 2, true);
    this.entities.push(playerEntity);

    const npcCount = npcChars.length;
    npcChars.forEach((npc, i) => {
      // Spread NPCs on the right side
      const x = this.width * 0.78;
      const spread = Math.min(this.height * 0.65, npcCount * 110);
      const y = this.height / 2 - spread / 2 + (spread / Math.max(1, npcCount - 1)) * i;
      const npcEntity = new CharacterEntity(npc, x, y + (npcCount === 1 ? 0 : 0), false);
      this.entities.push(npcEntity);
    });
  }

  start() {
    if (this.isRunning) return;
    this.isRunning     = true;
    this.lastTimestamp = performance.now();
    this._loop();
  }

  stop() {
    this.isRunning = false;
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.animationId = null;
  }

  _loop() {
    if (!this.isRunning) return;
    const now = performance.now();
    const dt  = Math.min(0.033, (now - this.lastTimestamp) / 1000);
    this.lastTimestamp = now;
    this.globalT      += dt;
    this._update(dt);
    this._render();
    this.animationId = requestAnimationFrame(() => this._loop());
  }

  _update(dt) {
    // Update entities — pass globalT for drifter sine waves
    for (const entity of this.entities) {
      entity.update(dt, this.entities, this.width, this.height, this.globalT);
      // Collect attack events
      if (entity.attackEvent) {
        this.effects.push(new ActiveEffect(entity.attackEvent));
      }
    }

    // Update & prune effects
    for (const fx of this.effects) fx.update(dt);
    this.effects = this.effects.filter(fx => !fx.done);

    // Prune dead entities
    const before = this.entities.length;
    this.entities = this.entities.filter(e => e.isAlive);
    if (this.entities.length < before && this.logCallback) {
      this.logCallback('⚰️ A warrior has fallen.');
    }

    // Victory / defeat check
    const hasPlayer = this.entities.some(e => e.isPlayer);
    const hasNPC    = this.entities.some(e => !e.isPlayer);
    if (!hasPlayer || !hasNPC) {
      this.stop();
      this._showOutcome(!hasNPC);
    }
  }

  _showOutcome(victory) {
    const msg    = victory ? '🏆 VICTORY' : '💀 DEFEAT';
    const status = document.getElementById('arena-status');
    if (status) status.textContent = victory ? 'VICTORY' : 'DEFEAT';
    if (this.logCallback) {
      this.logCallback(victory ? '🏆 VICTORY! You conquered the arena.' : '💀 DEFEAT! All your champions are dead.');
    }
    // Overlay — no alert()
    this._renderOutcomeOverlay(msg, victory);
  }

  _renderOutcomeOverlay(msg, victory) {
    const ctx = this.ctx;
    ctx.save();

    // Dim background
    ctx.fillStyle   = victory ? 'rgba(10,30,10,0.78)' : 'rgba(30,5,5,0.78)';
    ctx.fillRect(0, 0, this.width, this.height);

    // Glow ring
    const grd = ctx.createRadialGradient(
      this.width / 2, this.height / 2, 0,
      this.width / 2, this.height / 2, this.width * 0.4
    );
    grd.addColorStop(0, victory ? 'rgba(100,255,100,0.15)' : 'rgba(255,60,60,0.15)');
    grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, this.width, this.height);

    // Text
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.font         = `bold ${Math.round(this.width * 0.09)}px 'Courier New', monospace`;
    ctx.shadowColor  = victory ? '#88ffaa' : '#ff4444';
    ctx.shadowBlur   = 40;
    ctx.fillStyle    = victory ? '#c8ffc8' : '#ffcccc';
    ctx.fillText(msg, this.width / 2, this.height / 2);

    ctx.font         = `${Math.round(this.width * 0.028)}px 'Courier New', monospace`;
    ctx.shadowBlur   = 10;
    ctx.fillStyle    = 'rgba(200,169,110,0.7)';
    ctx.fillText('CLICK STOP TO RETURN', this.width / 2, this.height / 2 + this.width * 0.12);

    ctx.restore();
  }

  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    this._drawArena();

    // Characters
    for (const entity of this.entities) {
      this._drawCharacter(entity);
      this._drawHealthBar(entity);
    }

    // Attack effects rendered on top
    for (const fx of this.effects) {
      fx.render(ctx);
    }
  }

  _drawArena() {
    const ctx = this.ctx;
    const w = this.width, h = this.height;

    // Background gradient
    const bg = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, w * 0.7);
    bg.addColorStop(0,   '#0e0e1a');
    bg.addColorStop(0.6, '#080810');
    bg.addColorStop(1,   '#030308');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Ground grid
    ctx.save();
    ctx.strokeStyle = 'rgba(200,169,110,0.07)';
    ctx.lineWidth   = 1;
    const step = 50;
    for (let x = 0; x < w; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.restore();

    // Arena circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.44, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(200,169,110,0.12)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // Center mark
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 4, 0, Math.PI * 2);
    ctx.fillStyle   = 'rgba(200,169,110,0.15)';
    ctx.fill();
    ctx.restore();
  }

  _drawCharacter(entity) {
    const finalSize = 112;
    const offSize   = 224;

    // Use cached offscreen canvas (characters don't change mid-battle)
    if (!this._charCache.has(entity)) {
      const off = document.createElement('canvas');
      off.width = off.height = offSize;
      renderMiniCharacter(entity.data, off);
      this._charCache.set(entity, off);
    }
    const offCanvas = this._charCache.get(entity);

    const ctx = this.ctx;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Subtle shadow under each character
    ctx.shadowColor  = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur   = 12;
    ctx.shadowOffsetY = 6;

    ctx.drawImage(
      offCanvas,
      entity.pos.x - finalSize / 2,
      entity.pos.y - finalSize / 2,
      finalSize,
      finalSize
    );

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur  = 0;
    ctx.shadowOffsetY = 0;

    // Player indicator ring
    if (entity.isPlayer) {
      ctx.beginPath();
      ctx.arc(entity.pos.x, entity.pos.y, finalSize / 2 + 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#c8a96e';
      ctx.lineWidth   = 2;
      ctx.shadowColor = '#c8a96e';
      ctx.shadowBlur  = 10;
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawHealthBar(entity) {
    const ctx        = this.ctx;
    const hpPercent  = entity.currentHp / entity.stats.max_hp;
    const barWidth   = 60;
    const barHeight  = 5;
    const x          = entity.pos.x - barWidth / 2;
    const y          = entity.pos.y - 68;

    // Background track
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x - 1, y - 1, barWidth + 2, barHeight + 2);

    // HP color: green → yellow → red
    let barColor;
    if (hpPercent > 0.6)      barColor = '#44cc66';
    else if (hpPercent > 0.3) barColor = '#ccaa22';
    else                      barColor = '#cc3333';

    ctx.fillStyle   = barColor;
    ctx.shadowColor = barColor;
    ctx.shadowBlur  = 6;
    ctx.fillRect(x, y, barWidth * hpPercent, barHeight);
    ctx.shadowBlur  = 0;

    // Name label
    ctx.font      = "9px 'Courier New', monospace";
    ctx.fillStyle = entity.isPlayer ? '#c8a96e' : 'rgba(200,169,110,0.7)';
    ctx.textAlign = 'center';
    ctx.fillText(entity.name.slice(0, 14).toUpperCase(), entity.pos.x, y - 5);

    // Archetype badge (tiny)
    ctx.font      = "7px 'Courier New', monospace";
    ctx.fillStyle = 'rgba(200,169,110,0.3)';
    ctx.fillText(entity.archetype.toUpperCase(), entity.pos.x, y + barHeight + 9);
  }
}
