// CharacterEntity.js — Archetype-driven AI with state machine movement

// ─────────────────────────────────────────────
//  ARCHETYPE DEFINITIONS
//  Each archetype has: preferred range band, movement style,
//  target preference, and state transition rules.
// ─────────────────────────────────────────────
const ARCHETYPES = {
  BRAWLER:    'brawler',    // Rush nearest, attack fast, stay in melee
  SKIRMISHER: 'skirmisher', // Flank at angles, dart in/out
  RANGER:     'ranger',     // Maintain distance, strafe, retreat if closed
  TANK:       'tank',       // Slow advance, target strongest threat
  BERSERKER:  'berserker',  // Target lowest HP, speed burst when hurt
  DRIFTER:    'drifter',    // Sine-wave erratic path (vehicles, creatures, objects)
  PREDATOR:   'predator',   // Circle until opening, then burst in
};

// ─────────────────────────────────────────────
//  STATES — shared across all archetypes
// ─────────────────────────────────────────────
const STATES = {
  IDLE:       'idle',
  APPROACH:   'approach',
  STRAFE:     'strafe',
  ENGAGE:     'engage',
  RETREAT:    'retreat',
  REPOSITION: 'reposition',
  FLANK:      'flank',
  CIRCLE:     'circle',
};

export class CharacterEntity {
  constructor(jsonData, startX, startY, isPlayer = false) {
    this.data     = jsonData;
    this.name     = jsonData.name || 'Nameless';
    this.isPlayer = isPlayer;

    // ── Stat normalization ─────────────────────
    // Accept any capitalisation. Aliases: pwr→atk, pow→atk, spd→speed,
    // rng→attack_range, cdn→attack_cooldown
    const rawStats = jsonData.stats || {};
    const norm = {};
    for (const [k, v] of Object.entries(rawStats)) {
      norm[k.toLowerCase()] = Number(v) || 0;
    }
    // Aliases
    if (norm.pwr  !== undefined) norm.atk   = norm.atk   ?? norm.pwr;
    if (norm.pow  !== undefined) norm.atk   = norm.atk   ?? norm.pow;
    if (norm.spd  !== undefined) norm.speed = norm.speed ?? norm.spd;
    if (norm.rng  !== undefined) norm.attack_range    = norm.attack_range    ?? norm.rng;
    if (norm.cdn  !== undefined) norm.attack_cooldown = norm.attack_cooldown ?? norm.cdn;
    if (norm.def  !== undefined) norm.defense = norm.defense ?? norm.def;

    // Weapon overrides range / cooldown if present
    const wpn = jsonData.weapon || {};
    if (wpn.range)           norm.attack_range    = wpn.range;
    if (wpn.attack_cooldown) norm.attack_cooldown = wpn.attack_cooldown;

    const defaults = {
      hp: 80, max_hp: 80,
      atk: 20, attack: 20,
      defense: 5, def: 5,
      speed: 80,
      attack_range: 65,
      attack_cooldown: 1.2,
    };
    this.stats = { ...defaults, ...norm };
    // Ensure both .attack and .atk resolve the same
    this.stats.attack  = this.stats.atk   || this.stats.attack;
    this.stats.defense = this.stats.def   || this.stats.defense;
    this.stats.max_hp  = this.stats.hp;
    this.currentHp     = this.stats.hp;

    this.pos  = { x: startX, y: startY };
    this.vel  = { x: 0, y: 0 };
    this.attackTimer = 0;
    this.isAlive     = true;
    this.target      = null;
    this.size        = 28; // collision radius

    // ── Archetype & AI state ───────────────────
    this.archetype    = this._detectArchetype();
    this.state        = STATES.APPROACH;
    this.stateTimer   = 0;  // how long we've been in current state
    this.stateData    = {}; // scratch data per state (flank angle, etc.)

    // Flank angle offset — randomised so entities don't all pile on same side
    this.flankSide    = Math.random() < 0.5 ? 1 : -1;
    this.driftPhase   = Math.random() * Math.PI * 2; // unique drift offset

    // Attack event — read by BattleManager each frame then cleared
    this.attackEvent  = null; // { target, type, origin, targetPos }
  }

  // ─────────────────────────────────────────────
  //  ARCHETYPE DETECTION
  //  Derives from stats and type string heuristics
  // ─────────────────────────────────────────────
  _detectArchetype() {
    const s    = this.stats;
    const type = (this.data.type || '').toLowerCase();
    const name = (this.data.name || '').toLowerCase();
    const wpn  = (this.data.weapon?.type || '').toLowerCase();

    // Type-string keywords → archetype
    const drifterKeywords  = ['ship','vehicle','drone','craft','bot','mech','robot','machine','tank','car','plane','train','rocket','vessel','beast','creature','animal','bug','fish','bird','insect','critter'];
    const rangerKeywords   = ['archer','sniper','mage','wizard','witch','caster','gunner','hunter','marksman','rifleman','shooter'];
    const berserkerKeywords= ['berserker','barbarian','fury','rage','wild','feral','demon','fiend','brute'];
    const tankKeywords     = ['tank','guardian','paladin','golem','giant','titan','knight','warden'];
    const skirmishKeywords = ['rogue','thief','ninja','assassin','scout','fox','cat','dart','swift'];
    const predatorKeywords = ['predator','hawk','wolf','lion','shark','spider','snake','stalker','hunter'];

    const matchesAny = (keywords, str) => keywords.some(k => str.includes(k));

    if (matchesAny(drifterKeywords,   type + ' ' + name)) return ARCHETYPES.DRIFTER;
    if (matchesAny(berserkerKeywords, type + ' ' + name)) return ARCHETYPES.BERSERKER;
    if (matchesAny(tankKeywords,      type + ' ' + name)) return ARCHETYPES.TANK;
    if (matchesAny(predatorKeywords,  type + ' ' + name)) return ARCHETYPES.PREDATOR;
    if (matchesAny(skirmishKeywords,  type + ' ' + name)) return ARCHETYPES.SKIRMISHER;
    if (matchesAny(rangerKeywords,    type + ' ' + name)) return ARCHETYPES.RANGER;

    // Weapon type hints
    if (wpn.includes('bow') || wpn.includes('gun') || wpn.includes('staff') || wpn.includes('wand') || wpn.includes('beam') || wpn.includes('rifle')) return ARCHETYPES.RANGER;
    if (wpn.includes('axe') || wpn.includes('hammer') || wpn.includes('maul')) return ARCHETYPES.BERSERKER;

    // Stat-based fallbacks
    const rangeVal = s.attack_range || 65;
    const speedVal = s.speed        || 80;
    const hpVal    = s.hp           || 80;
    const atkVal   = s.attack       || 20;
    const defVal   = s.defense      || 5;

    if (rangeVal > 120)                            return ARCHETYPES.RANGER;
    if (hpVal > 90 && defVal > 30)                 return ARCHETYPES.TANK;
    if (atkVal > 70 && hpVal < 50)                 return ARCHETYPES.BERSERKER;
    if (speedVal > 85 && rangeVal < 80)            return ARCHETYPES.SKIRMISHER;
    if (speedVal > 75 && atkVal > 50)              return ARCHETYPES.PREDATOR;

    return ARCHETYPES.BRAWLER; // safe default
  }

  // ─────────────────────────────────────────────
  //  TARGET SELECTION — varies by archetype
  // ─────────────────────────────────────────────
  findTarget(allEntities) {
    const enemies = allEntities.filter(e => e !== this && e.isAlive);
    if (!enemies.length) return null;

    switch (this.archetype) {
      case ARCHETYPES.BERSERKER:
        // Target lowest HP (finish off wounded)
        return enemies.reduce((a, b) => a.currentHp < b.currentHp ? a : b);

      case ARCHETYPES.TANK:
        // Target highest threat (highest ATK stat)
        return enemies.reduce((a, b) => (a.stats.attack > b.stats.attack ? a : b));

      case ARCHETYPES.RANGER:
      case ARCHETYPES.SKIRMISHER:
      case ARCHETYPES.PREDATOR:
        // Target nearest but prefer low-DEF targets when equidistant
        return enemies.reduce((best, e) => {
          const dBest = Math.hypot(best.pos.x - this.pos.x, best.pos.y - this.pos.y);
          const dE    = Math.hypot(e.pos.x    - this.pos.x, e.pos.y    - this.pos.y);
          const scoreBest = dBest - best.stats.defense * 0.5;
          const scoreE    = dE    - e.stats.defense    * 0.5;
          return scoreE < scoreBest ? e : best;
        });

      default:
        // Nearest enemy
        return enemies.reduce((best, e) => {
          const dBest = Math.hypot(best.pos.x - this.pos.x, best.pos.y - this.pos.y);
          const dE    = Math.hypot(e.pos.x    - this.pos.x, e.pos.y    - this.pos.y);
          return dE < dBest ? e : best;
        });
    }
  }

  // ─────────────────────────────────────────────
  //  STATE TRANSITIONS — per archetype rules
  // ─────────────────────────────────────────────
  _updateState(dist, dt) {
    this.stateTimer += dt;
    const range    = this.stats.attack_range;
    const hpRatio  = this.currentHp / this.stats.max_hp;
    const a        = this.archetype;

    switch (a) {
      // ── BRAWLER ─────────────────────────────
      case ARCHETYPES.BRAWLER:
        if (dist <= range)              this.state = STATES.ENGAGE;
        else                            this.state = STATES.APPROACH;
        break;

      // ── SKIRMISHER ──────────────────────────
      case ARCHETYPES.SKIRMISHER:
        if (dist <= range) {
          // Dart in, attack, then reposition
          if (this.state !== STATES.ENGAGE) {
            this.state = STATES.ENGAGE;
            this.stateTimer = 0;
          } else if (this.stateTimer > 0.6) {
            this.state = STATES.REPOSITION;
            this.stateTimer = 0;
          }
        } else if (this.state === STATES.REPOSITION && this.stateTimer < 0.8) {
          // stay in reposition
        } else {
          this.state = STATES.FLANK;
        }
        break;

      // ── RANGER ──────────────────────────────
      case ARCHETYPES.RANGER:
        const preferredMin = range * 0.55;
        const preferredMax = range * 0.85;
        if (dist < preferredMin) {
          this.state = STATES.RETREAT;
        } else if (dist > preferredMax) {
          this.state = STATES.APPROACH;
        } else {
          // In sweet spot — strafe
          this.state = STATES.STRAFE;
        }
        // Panic retreat if HP very low and enemy close
        if (hpRatio < 0.25 && dist < range * 0.7) this.state = STATES.RETREAT;
        break;

      // ── TANK ────────────────────────────────
      case ARCHETYPES.TANK:
        if (dist <= range * 1.1)        this.state = STATES.ENGAGE;
        else                            this.state = STATES.APPROACH;
        break;

      // ── BERSERKER ───────────────────────────
      case ARCHETYPES.BERSERKER:
        // Always charge, faster when hurt
        this.state = STATES.APPROACH;
        break;

      // ── DRIFTER ─────────────────────────────
      case ARCHETYPES.DRIFTER:
        if (dist <= range)              this.state = STATES.ENGAGE;
        else                            this.state = STATES.APPROACH; // drift applied to movement
        break;

      // ── PREDATOR ────────────────────────────
      case ARCHETYPES.PREDATOR:
        if (this.state !== STATES.CIRCLE && this.state !== STATES.ENGAGE) {
          this.state = STATES.CIRCLE;
          this.stateTimer = 0;
          this.stateData.circleAngle = Math.atan2(
            this.pos.y - (this.target?.pos.y || 0),
            this.pos.x - (this.target?.pos.x || 0)
          );
        }
        if (dist <= range * 0.75) {
          // Close enough — burst in
          this.state = STATES.ENGAGE;
          this.stateTimer = 0;
        } else if (this.state === STATES.ENGAGE && this.stateTimer > 0.5) {
          // After short engage, go back to circling
          this.state = STATES.CIRCLE;
          this.stateTimer = 0;
        }
        break;
    }
  }

  // ─────────────────────────────────────────────
  //  MOVEMENT CALCULATION — returns desired velocity
  // ─────────────────────────────────────────────
  _calcVelocity(dt) {
    if (!this.target) return { x: 0, y: 0 };

    const dx    = this.target.pos.x - this.pos.x;
    const dy    = this.target.pos.y - this.pos.y;
    const dist  = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const spd   = this.stats.speed;
    const a     = this.archetype;
    const hpR   = this.currentHp / this.stats.max_hp;

    // Berserker rage — up to 1.6× speed when < 40% HP
    const rageMultiplier = (a === ARCHETYPES.BERSERKER && hpR < 0.4)
      ? 1.0 + (1 - hpR) * 1.5
      : 1.0;

    switch (this.state) {
      case STATES.APPROACH:
        return {
          x: Math.cos(angle) * spd * rageMultiplier,
          y: Math.sin(angle) * spd * rageMultiplier,
        };

      case STATES.ENGAGE:
        // Move very slowly toward target (closing micro-gaps)
        if (dist > 5) return { x: Math.cos(angle) * spd * 0.15, y: Math.sin(angle) * spd * 0.15 };
        return { x: 0, y: 0 };

      case STATES.RETREAT:
        return {
          x: -Math.cos(angle) * spd * 1.2,
          y: -Math.sin(angle) * spd * 1.2,
        };

      case STATES.STRAFE: {
        // Perpendicular to target, alternating direction based on time
        const perpAngle = angle + Math.PI / 2 * this.flankSide;
        // Occasionally flip direction so it doesn't just orbit one way forever
        if (Math.floor(this.stateTimer / 1.8) % 2 === 1) this.flankSide *= -1;
        return {
          x: Math.cos(perpAngle) * spd * 0.75,
          y: Math.sin(perpAngle) * spd * 0.75,
        };
      }

      case STATES.FLANK: {
        // Approach at 45° offset
        const flankAngle = angle + (Math.PI / 4) * this.flankSide;
        return {
          x: Math.cos(flankAngle) * spd * 0.9,
          y: Math.sin(flankAngle) * spd * 0.9,
        };
      }

      case STATES.REPOSITION: {
        // Move away at a perpendicular angle to create space
        const awayAngle = angle + Math.PI * 0.75 * this.flankSide;
        return {
          x: Math.cos(awayAngle) * spd * 1.1,
          y: Math.sin(awayAngle) * spd * 1.1,
        };
      }

      case STATES.CIRCLE: {
        // Orbit the target at current distance, slowly tightening
        this.stateData.circleAngle = (this.stateData.circleAngle || angle) + dt * 1.8 * this.flankSide;
        const circleAngle = this.stateData.circleAngle;
        const orbitRadius = this.stats.attack_range * 0.9;
        const desiredX = (this.target?.pos.x || 0) + Math.cos(circleAngle) * orbitRadius;
        const desiredY = (this.target?.pos.y || 0) + Math.sin(circleAngle) * orbitRadius;
        const toDX = desiredX - this.pos.x;
        const toDY = desiredY - this.pos.y;
        const toDist = Math.hypot(toDX, toDY);
        if (toDist < 2) return { x: 0, y: 0 };
        return {
          x: (toDX / toDist) * spd * 0.85,
          y: (toDY / toDist) * spd * 0.85,
        };
      }

      default:
        return { x: 0, y: 0 };
    }
  }

  // ─────────────────────────────────────────────
  //  DRIFT OVERLAY — applied on top of base velocity
  //  for DRIFTER archetype (vehicles, creatures, etc.)
  // ─────────────────────────────────────────────
  _applyDrift(vel, t) {
    if (this.archetype !== ARCHETYPES.DRIFTER) return vel;
    const driftAmt = this.stats.speed * 0.35;
    return {
      x: vel.x + Math.sin(t * 1.4 + this.driftPhase) * driftAmt,
      y: vel.y + Math.cos(t * 1.1 + this.driftPhase) * driftAmt * 0.6,
    };
  }

  // ─────────────────────────────────────────────
  //  MAIN UPDATE
  // ─────────────────────────────────────────────
  update(deltaTime, allEntities, arenaWidth, arenaHeight, globalT = 0) {
    if (!this.isAlive) return;

    this.attackEvent = null; // clear last frame's event

    if (this.attackTimer > 0) this.attackTimer -= deltaTime;

    this.target = this.findTarget(allEntities);

    if (this.target && this.target.isAlive) {
      const dx   = this.target.pos.x - this.pos.x;
      const dy   = this.target.pos.y - this.pos.y;
      const dist = Math.hypot(dx, dy);

      // Update AI state machine
      this._updateState(dist, deltaTime);

      // Calculate movement
      let vel = this._calcVelocity(deltaTime);
      vel = this._applyDrift(vel, globalT);
      this.vel = vel;

      // Attack if in range and ready
      if (dist < this.stats.attack_range && this.attackTimer <= 0) {
        const dmg       = this.stats.attack;
        const actualDmg = this.target.takeDamage(dmg);
        this.attackTimer = this.stats.attack_cooldown;

        // Emit attack event for BattleManager to render
        this.attackEvent = {
          type:       (this.data.weapon?.attack_type) || 'melee_slash',
          origin:     { x: this.pos.x, y: this.pos.y },
          targetPos:  { x: this.target.pos.x, y: this.target.pos.y },
          target:     this.target,
          damage:     actualDmg,
          color:      this.data.weapon?.color || this.data.palette?.accent || '#c8a96e',
          color2:     this.data.weapon?.color2 || null,
        };

        if (window.battleLogCallback) {
          window.battleLogCallback(
            `${this.name} → ${this.target.name}: ${actualDmg} dmg`
          );
        }
      }

    } else {
      this.vel  = { x: 0, y: 0 };
      this.state = STATES.IDLE;
    }

    // Apply movement
    this.pos.x += this.vel.x * deltaTime;
    this.pos.y += this.vel.y * deltaTime;

    // Arena boundary clamp
    const margin = 30;
    this.pos.x = Math.min(arenaWidth  - margin, Math.max(margin, this.pos.x));
    this.pos.y = Math.min(arenaHeight - margin, Math.max(margin, this.pos.y));

    // Collision resolution
    for (const other of allEntities) {
      if (other === this || !other.isAlive) continue;
      const dx = this.pos.x - other.pos.x;
      const dy = this.pos.y - other.pos.y;
      const d  = Math.hypot(dx, dy);
      const minD = this.size + other.size;
      if (d < minD && d > 0) {
        const push = (minD - d) * 0.5;
        const nx   = dx / d;
        const ny   = dy / d;
        this.pos.x  += nx * push;
        this.pos.y  += ny * push;
        other.pos.x -= nx * push;
        other.pos.y -= ny * push;
      }
    }
  }

  takeDamage(amount) {
    const mitigated = Math.max(1, amount - this.stats.defense);
    this.currentHp  = Math.max(0, this.currentHp - mitigated);
    if (this.currentHp <= 0) this.isAlive = false;
    return mitigated;
  }
}
