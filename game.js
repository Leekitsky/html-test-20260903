export const WIDTH = 720;
export const HEIGHT = 420;

export const CARDS = {
  knight: { name: '骑士', cost: 3, hp: 260, damage: 32, range: 28, speed: 42, cooldown: 0.75 },
  archer: { name: '弓手', cost: 2, hp: 130, damage: 22, range: 115, speed: 36, cooldown: 0.9 },
  giant: { name: '巨人', cost: 5, hp: 520, damage: 48, range: 34, speed: 24, cooldown: 1.1 },
};

const CARD_ORDER = ['knight', 'archer', 'giant'];
const BASE_HP = 1200;
const MAX_ENERGY = 10;
const ENERGY_SPEED = 0.7;
const BASE_RANGE = 44;
const UNIT_RADIUS = 14;
const ARENA_TOP = 78;
const ARENA_BOTTOM = 342;
const BLUE_BASE = { x: 58, y: 210 };
const RED_BASE = { x: 662, y: 210 };

/** 创建同屏双人对战初始状态。 */
export function createGame() {
  return {
    status: 'playing',
    message: '双方选卡后点击己方半场出兵',
    players: {
      blue: createPlayer('blue', '蓝方', 'knight'),
      red: createPlayer('red', '红方', 'knight'),
    },
    units: [],
    effects: [],
    nextUnitId: 1,
  };
}

/** 选择玩家下一次要派出的卡牌。 */
export function selectCard(game, team, cardId) {
  validatePlayer(game, team);
  if (!CARDS[cardId]) throw new Error('未知卡牌');

  return {
    ...game,
    message: `${game.players[team].name} 已选择 ${CARDS[cardId].name}`,
    players: {
      ...game.players,
      [team]: { ...game.players[team], selectedCard: cardId },
    },
  };
}

/** 在玩家己方半场生成单位，并扣除对应能量。 */
export function spawnUnit(game, team, x, y) {
  validatePlayer(game, team);
  if (game.status !== 'playing') throw new Error('游戏已结束');
  if (!isOwnHalf(team, x) || y < ARENA_TOP || y > ARENA_BOTTOM) throw new Error('只能在己方半场出兵');

  const player = game.players[team];
  const card = CARDS[player.selectedCard];
  if (player.energy < card.cost) throw new Error('能量不足');

  return {
    ...game,
    message: `${player.name} 派出 ${card.name}`,
    nextUnitId: game.nextUnitId + 1,
    players: {
      ...game.players,
      [team]: { ...player, energy: player.energy - card.cost },
    },
    units: [
      ...game.units,
      {
        id: game.nextUnitId,
        team,
        cardId: player.selectedCard,
        x,
        y,
        hp: card.hp,
        maxHp: card.hp,
        damage: card.damage,
        range: card.range,
        speed: card.speed,
        cooldown: 0,
      },
    ],
  };
}

/** 推进一帧对战：回能量、单位寻敌、攻击、移动、基地胜负结算。 */
export function stepGame(game, deltaSeconds) {
  if (game.status !== 'playing') return game;

  const energized = recoverEnergy(game, deltaSeconds);
  const battled = updateUnits(energized, deltaSeconds);
  return settleBattle(battled);
}

/** 绘制当前同屏对战画面。 */
export function drawGame(ctx, game) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawArena(ctx);
  drawBases(ctx, game);
  drawUnits(ctx, game);
  drawEffects(ctx, game);
  drawHud(ctx, game);
}

/** 获取界面卡牌固定顺序。 */
export function getCardOrder() {
  return CARD_ORDER;
}

function createPlayer(team, name, selectedCard) {
  return {
    team,
    name,
    baseHp: BASE_HP,
    energy: 5,
    selectedCard,
  };
}

function validatePlayer(game, team) {
  if (!game.players[team]) throw new Error('未知玩家');
}

function isOwnHalf(team, x) {
  return team === 'blue' ? x < WIDTH / 2 : x > WIDTH / 2;
}

function recoverEnergy(game, deltaSeconds) {
  return {
    ...game,
    players: {
      blue: recoverPlayerEnergy(game.players.blue, deltaSeconds),
      red: recoverPlayerEnergy(game.players.red, deltaSeconds),
    },
    effects: game.effects
      .map((effect) => ({ ...effect, life: effect.life - deltaSeconds }))
      .filter((effect) => effect.life > 0),
  };
}

function recoverPlayerEnergy(player, deltaSeconds) {
  return {
    ...player,
    energy: Math.min(MAX_ENERGY, player.energy + ENERGY_SPEED * deltaSeconds),
  };
}

function updateUnits(game, deltaSeconds) {
  let units = game.units.map((unit) => ({ ...unit, cooldown: Math.max(0, unit.cooldown - deltaSeconds) }));
  let players = {
    blue: { ...game.players.blue },
    red: { ...game.players.red },
  };
  const effects = [...game.effects];

  for (const unit of units) {
    if (unit.hp <= 0) continue;

    const enemies = units.filter((target) => target.team !== unit.team && target.hp > 0);
    const target = findTarget(unit, enemies, players);

    if (target.kind === 'unit' && target.distance <= unit.range + UNIT_RADIUS) {
      const result = attackUnit(units, unit, target.id, effects);
      units = result.units;
    } else if (target.kind === 'base' && target.distance <= unit.range + BASE_RANGE) {
      players = attackBase(players, unit, effects);
    } else {
      units = moveUnit(units, unit, target, deltaSeconds);
    }
  }

  return {
    ...game,
    players,
    effects,
    units: units.filter((unit) => unit.hp > 0),
  };
}

function findTarget(unit, enemies, players) {
  const enemyBase = unit.team === 'blue' ? RED_BASE : BLUE_BASE;
  const enemyBaseHp = unit.team === 'blue' ? players.red.baseHp : players.blue.baseHp;
  const enemyUnit = enemies
    .map((enemy) => ({ ...enemy, distance: Math.hypot(enemy.x - unit.x, enemy.y - unit.y) }))
    .sort((left, right) => left.distance - right.distance)[0];

  if (enemyUnit && enemyUnit.distance <= 140) {
    return { kind: 'unit', id: enemyUnit.id, x: enemyUnit.x, y: enemyUnit.y, distance: enemyUnit.distance };
  }

  return {
    kind: 'base',
    x: enemyBase.x,
    y: enemyBase.y,
    distance: enemyBaseHp > 0 ? Math.hypot(enemyBase.x - unit.x, enemyBase.y - unit.y) : 0,
  };
}

function attackUnit(units, attacker, targetId, effects) {
  if (attacker.cooldown > 0) return { units };

  const target = units.find((unit) => unit.id === targetId);
  effects.push({ fromX: attacker.x, fromY: attacker.y, toX: target.x, toY: target.y, life: 0.12 });

  return {
    units: units.map((unit) => {
      if (unit.id === attacker.id) return { ...unit, cooldown: CARDS[unit.cardId].cooldown };
      if (unit.id === targetId) return { ...unit, hp: unit.hp - attacker.damage };
      return unit;
    }),
  };
}

function attackBase(players, attacker, effects) {
  if (attacker.cooldown > 0) return players;

  const targetTeam = attacker.team === 'blue' ? 'red' : 'blue';
  const base = targetTeam === 'red' ? RED_BASE : BLUE_BASE;
  effects.push({ fromX: attacker.x, fromY: attacker.y, toX: base.x, toY: base.y, life: 0.12 });

  return {
    ...players,
    [attacker.team]: players[attacker.team],
    [targetTeam]: {
      ...players[targetTeam],
      baseHp: Math.max(0, players[targetTeam].baseHp - attacker.damage),
    },
  };
}

function moveUnit(units, unit, target, deltaSeconds) {
  const dx = target.x - unit.x;
  const dy = target.y - unit.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return units;

  const step = Math.min(unit.speed * deltaSeconds, distance);
  const nextX = unit.x + (dx / distance) * step;
  const nextY = unit.y + (dy / distance) * step;

  return units.map((item) => (
    item.id === unit.id ? { ...item, x: nextX, y: clamp(nextY, ARENA_TOP, ARENA_BOTTOM) } : item
  ));
}

function settleBattle(game) {
  if (game.players.blue.baseHp <= 0) {
    return { ...game, status: 'red-win', message: '红方胜利' };
  }

  if (game.players.red.baseHp <= 0) {
    return { ...game, status: 'blue-win', message: '蓝方胜利' };
  }

  return game;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function drawArena(ctx) {
  ctx.fillStyle = '#eef2f7';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = '#dbeafe';
  ctx.fillRect(0, ARENA_TOP, WIDTH / 2, ARENA_BOTTOM - ARENA_TOP);
  ctx.fillStyle = '#fee2e2';
  ctx.fillRect(WIDTH / 2, ARENA_TOP, WIDTH / 2, ARENA_BOTTOM - ARENA_TOP);

  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(WIDTH / 2, ARENA_TOP);
  ctx.lineTo(WIDTH / 2, ARENA_BOTTOM);
  ctx.stroke();

  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(0, ARENA_TOP - 2, WIDTH, 4);
  ctx.fillRect(0, ARENA_BOTTOM - 2, WIDTH, 4);
}

function drawBases(ctx, game) {
  drawBase(ctx, BLUE_BASE, '#2563eb', game.players.blue.baseHp);
  drawBase(ctx, RED_BASE, '#dc2626', game.players.red.baseHp);
}

function drawBase(ctx, base, color, hp) {
  ctx.fillStyle = color;
  ctx.fillRect(base.x - 30, base.y - 42, 60, 84);
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 3;
  ctx.strokeRect(base.x - 30, base.y - 42, 60, 84);

  ctx.fillStyle = '#111827';
  ctx.fillRect(base.x - 38, base.y - 58, 76, 7);
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(base.x - 38, base.y - 58, 76 * Math.max(0, hp / BASE_HP), 7);
}

function drawUnits(ctx, game) {
  for (const unit of game.units) {
    ctx.beginPath();
    ctx.arc(unit.x, unit.y, UNIT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = unit.team === 'blue' ? '#1d4ed8' : '#b91c1c';
    ctx.fill();
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#111827';
    ctx.fillRect(unit.x - 18, unit.y - 24, 36, 5);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(unit.x - 18, unit.y - 24, 36 * Math.max(0, unit.hp / unit.maxHp), 5);
  }
}

function drawEffects(ctx, game) {
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 3;

  for (const effect of game.effects) {
    ctx.beginPath();
    ctx.moveTo(effect.fromX, effect.fromY);
    ctx.lineTo(effect.toX, effect.toY);
    ctx.stroke();
  }
}

function drawHud(ctx, game) {
  ctx.fillStyle = '#111827';
  ctx.font = '16px Arial, Microsoft YaHei, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`蓝方 ${Math.ceil(game.players.blue.baseHp)} HP`, 16, 28);
  ctx.fillText(`能量 ${game.players.blue.energy.toFixed(1)}`, 16, 52);
  ctx.textAlign = 'right';
  ctx.fillText(`红方 ${Math.ceil(game.players.red.baseHp)} HP`, WIDTH - 16, 28);
  ctx.fillText(`能量 ${game.players.red.energy.toFixed(1)}`, WIDTH - 16, 52);
  ctx.textAlign = 'center';
  ctx.fillText(game.message, WIDTH / 2, 32);
}
