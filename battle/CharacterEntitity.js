export class CharacterEntity {
  constructor(jsonData, startX, startY, isPlayer = false) {
    this.data = jsonData;
    this.name = jsonData.name || "Nameless";
    this.isPlayer = isPlayer;
    // Merge default stats
    const defaultStats = {
      hp: 80, max_hp: 80,
      attack: 20, defense: 5,
      speed: 80,        // pixels per second
      attack_range: 45,
      attack_cooldown: 1.2
    };
    this.stats = { ...defaultStats, ...(jsonData.stats || {}) };
    this.stats.max_hp = this.stats.hp;
    this.currentHp = this.stats.hp;
    
    this.pos = { x: startX, y: startY };
    this.vel = { x: 0, y: 0 };
    this.attackTimer = 0;
    this.isAlive = true;
    this.target = null;
    this.size = 28; // collision radius
  }

  takeDamage(amount) {
    const mitigated = Math.max(1, amount - this.stats.defense);
    this.currentHp = Math.max(0, this.currentHp - mitigated);
    if (this.currentHp <= 0) {
      this.isAlive = false;
    }
    return mitigated;
  }

  findClosestEnemy(allEntities) {
    let closest = null;
    let minDist = Infinity;
    for (let other of allEntities) {
      if (other === this) continue;
      if (other.isPlayer === this.isPlayer) continue; // same side? In FFA, everyone is enemy? Actually we want FFA - everyone fights everyone.
      // For FFA: any entity that is not this is enemy. So skip only self.
      // But we want NPCs to fight player AND each other. So condition: other !== this
      // However to avoid attacking own side? There's no side. So we treat everyone as enemy.
      // But we must ensure NPCs also attack each other. So remove the isPlayer check.
      // Let's treat everyone as enemy except self.
      if (other === this) continue;
      const dx = other.pos.x - this.pos.x;
      const dy = other.pos.y - this.pos.y;
      const dist = Math.hypot(dx, dy);
      if (dist < minDist) {
        minDist = dist;
        closest = other;
      }
    }
    return closest;
  }

  update(deltaTime, allEntities, arenaWidth, arenaHeight) {
    if (!this.isAlive) return;
    // Cooldown
    if (this.attackTimer > 0) this.attackTimer -= deltaTime;

    // Find target (closest enemy)
    this.target = this.findClosestEnemy(allEntities);
    if (this.target && this.target.isAlive) {
      const dx = this.target.pos.x - this.pos.x;
      const dy = this.target.pos.y - this.pos.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 5) {
        const angle = Math.atan2(dy, dx);
        this.vel.x = Math.cos(angle) * this.stats.speed;
        this.vel.y = Math.sin(angle) * this.stats.speed;
      } else {
        this.vel.x = 0;
        this.vel.y = 0;
      }
      // Attack if in range and cooldown ready
      if (dist < this.stats.attack_range && this.attackTimer <= 0) {
        const dmg = this.stats.attack;
        const actualDmg = this.target.takeDamage(dmg);
        this.attackTimer = this.stats.attack_cooldown;
        // Emit event (will be caught by BattleManager)
        if (window.battleLogCallback) {
          window.battleLogCallback(`${this.name} hits ${this.target.name} for ${actualDmg} damage!`);
        }
      }
    } else {
      this.vel.x = 0;
      this.vel.y = 0;
    }

    // Update position
    this.pos.x += this.vel.x * deltaTime;
    this.pos.y += this.vel.y * deltaTime;
    // Boundaries
    const margin = 30;
    this.pos.x = Math.min(arenaWidth - margin, Math.max(margin, this.pos.x));
    this.pos.y = Math.min(arenaHeight - margin, Math.max(margin, this.pos.y));

    // Simple collision resolution (bounce apart)
    for (let other of allEntities) {
      if (other === this) continue;
      const dx = this.pos.x - other.pos.x;
      const dy = this.pos.y - other.pos.y;
      const dist = Math.hypot(dx, dy);
      const minDist = this.size + other.size;
      if (dist < minDist) {
        const angle = Math.atan2(dy, dx);
        const overlap = minDist - dist;
        const moveX = Math.cos(angle) * overlap * 0.5;
        const moveY = Math.sin(angle) * overlap * 0.5;
        this.pos.x += moveX;
        this.pos.y += moveY;
        other.pos.x -= moveX;
        other.pos.y -= moveY;
      }
    }
  }
}