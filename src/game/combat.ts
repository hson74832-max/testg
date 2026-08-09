import { GameState, Monster } from './types';
import { addFloat, addParticles, addLog, checkLevelUp } from './engine';

export function playerAttackMonster(state: GameState, monster: Monster, now: number) {
  if (now - state.lastAttack < 1000) return;
  state.lastAttack = now;
  state.lastCombat = now;
  state.hudActivity = now;

  const rawDmg = state.playerDamage + Math.floor(Math.random() * 3);
  const dmg = Math.max(1, rawDmg - monster.defense);

  monster.hp -= dmg;
  monster.attackedByPlayer = true;

  addFloat(state, monster.x, monster.y, `-${dmg}`, '#ff4444');
  addParticles(state, monster.x, monster.y, 5, '#8a2222', 2);
  state.screenShake = 0.15;
  addLog(state, `You hit ${monster.type} for ${dmg} damage.`, '#ffaa44');

  if (monster.hp <= 0) {
    monster.dead = true;
    monster.deathTime = now;
    state.xp += monster.xp;
    state.monstersKilled++;
    addFloat(state, monster.x, monster.y, `+${monster.xp} XP`, '#44ff44');
    addLog(state, `${monster.type} defeated! +${monster.xp} XP`, '#44ff44');
    
    // Items / Gold drop logic
    for (const drop of monster.drops) {
      if (Math.random() < 0.6) {
        state.items.push({ id: state.nextId++, x: monster.x, y: monster.y, name: drop.name, color: drop.color, value: drop.value, spawnTime: now });
      }
    }
    state.items.push({ id: state.nextId++, x: monster.x, y: monster.y, name: 'Gold', color: '#d4a430', value: Math.floor(Math.random() * monster.xp) + 1, spawnTime: now });
    
    checkLevelUp(state);
    state.attackTarget = null;
  }
}

export function monsterAttackPlayer(state: GameState, monster: Monster, now: number) {
  if (now - monster.lastAttack < 1200) return;
  monster.lastAttack = now;
  state.lastCombat = now;
  state.hudActivity = now;
  monster.attackingPlayer = true;

  const rawDmg = monster.damage + Math.floor(Math.random() * 2);
  const dmg = Math.max(1, rawDmg - state.playerDefense);

  state.hp -= dmg;
  state.playerUnderAttack = true;
  state.playerUnderAttackTime = now;

  addFloat(state, state.px, state.py, `-${dmg}`, '#ff6666');
  addParticles(state, state.px, state.py, 4, '#aa3333', 1.5);
  state.screenShake = 0.1;
  addLog(state, `${monster.type} hits you for ${dmg}!`, '#ff6666');
  
  if (state.hp <= 0) {
    state.dead = true;
    state.deathTime = now;
    const goldLost = Math.floor(state.gold * 0.1);
    state.gold = Math.max(0, state.gold - goldLost);
    addLog(state, `You have died! Lost ${goldLost} gold.`, '#ff2222');
  }
}
