export const WIDTH = 720;
export const HEIGHT = 420;

export const PATH = [
  { x: 40, y: 220 },
  { x: 180, y: 220 },
  { x: 180, y: 90 },
  { x: 380, y: 90 },
  { x: 380, y: 300 },
  { x: 660, y: 300 },
];

const TOWER_COST = 40;
const TOWER_RANGE = 120;
const TOWER_DAMAGE = 22;
const TOWER_COOLDOWN = 0.45;
const ENEMY_HEALTH = 70;
const ENEMY_SPEED = 48;
const KILL_REWARD = 10;
const HIT_RADIUS = 30;

/** 创建塔防游戏初始状态。 */
export function createGame() {
  return {
    gold: 120,
    lives: 10,
    wave: 1,
    selected: null,
    enemies: [],
    towers: [],
    shots: [],
    spawnTimer: 0,
    spawnLeft: 0,
    nextEnemyId: 1,
    status: 'ready',
    message: '点击开始波次',
  };
}

/** 判断坐标是否落在敌人路线附近，路线附近禁止放塔。 */
export function isOnPath(x, y) {
  return PATH.some((point, index) => {
    const next = PATH[index + 1];
    if (!next) return false;

    const dx = next.x - point.x;
    const dy = next.y - point.y;
    const lengthSq = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((x - point.x) * dx + (y - point.y) * dy) / lengthSq));
    const px = point.x + t * dx;
    const py = point.y + t * dy;
    return Math.hypot(x - px, y - py) < HIT_RADIUS;
  });
}

/** 在指定坐标放置防御塔，返回不可变的新游戏状态。 */
export function placeTower(game, x, y) {
  if (game.status === 'lost' || game.status === 'won') throw new Error('游戏已结束');
  if (game.gold < TOWER_COST) throw new Error('金币不足');
  if (isOnPath(x, y)) throw new Error('路线附近不能放塔');
  if (game.towers.some((tower) => Math.hypot(tower.x - x, tower.y - y) < 44)) {
    throw new Error('防御塔太近');
  }

  return {
    ...game,
    gold: game.gold - TOWER_COST,
    message: '防御塔已建造',
    towers: [
      ...game.towers,
      { x, y, range: TOWER_RANGE, damage: TOWER_DAMAGE, cooldown: 0 },
    ],
  };
}

/** 生成一个敌人，敌人从路线起点向终点移动。 */
export function spawnEnemy(game) {
  const start = PATH[0];
  return {
    ...game,
    nextEnemyId: game.nextEnemyId + 1,
    enemies: [
      ...game.enemies,
      {
        id: game.nextEnemyId,
        x: start.x,
        y: start.y,
        hp: ENEMY_HEALTH + game.wave * 8,
        maxHp: ENEMY_HEALTH + game.wave * 8,
        speed: ENEMY_SPEED + game.wave * 3,
        segment: 0,
        progress: 0,
      },
    ],
  };
}

/** 开始下一波敌人。 */
export function startWave(game) {
  if (game.status === 'running') return game;
  if (game.status === 'lost' || game.status === 'won') return game;

  return {
    ...game,
    status: 'running',
    spawnLeft: 6 + game.wave * 2,
    spawnTimer: 0,
    message: `第 ${game.wave} 波进攻中`,
  };
}

/** 推进一帧游戏状态：生成敌人、移动敌人、塔攻击、结算胜负。 */
export function stepGame(game, deltaSeconds) {
  if (game.status === 'lost' || game.status === 'won') return game;

  const spawned = tickSpawn(game, deltaSeconds);
  const moved = moveEnemies(spawned, deltaSeconds);
  const attacked = attackEnemies(moved, deltaSeconds);
  return settleWave(attacked);
}

/** 绘制当前游戏画面。 */
export function drawGame(ctx, game) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawBackground(ctx);
  drawPath(ctx);
  drawTowers(ctx, game);
  drawEnemies(ctx, game);
  drawShots(ctx, game);
  drawHud(ctx, game);
}

function tickSpawn(game, deltaSeconds) {
  if (game.status !== 'running' || game.spawnLeft <= 0) return game;

  const spawnTimer = game.spawnTimer - deltaSeconds;
  if (spawnTimer > 0) return { ...game, spawnTimer };

  return spawnEnemy({
    ...game,
    spawnLeft: game.spawnLeft - 1,
    spawnTimer: 0.85,
  });
}

function moveEnemies(game, deltaSeconds) {
  let lives = game.lives;
  const enemies = [];

  for (const enemy of game.enemies) {
    const moved = moveEnemy(enemy, deltaSeconds);
    if (moved.segment >= PATH.length - 1) {
      lives -= 1;
    } else {
      enemies.push(moved);
    }
  }

  return {
    ...game,
    lives,
    enemies,
    status: lives <= 0 ? 'lost' : game.status,
    message: lives <= 0 ? '基地被攻破' : game.message,
  };
}

function moveEnemy(enemy, deltaSeconds) {
  let segment = enemy.segment;
  let x = enemy.x;
  let y = enemy.y;
  let distance = enemy.speed * deltaSeconds;

  while (distance > 0 && segment < PATH.length - 1) {
    const from = { x, y };
    const to = PATH[segment + 1];
    const left = Math.hypot(to.x - from.x, to.y - from.y);

    if (distance >= left) {
      x = to.x;
      y = to.y;
      segment += 1;
      distance -= left;
    } else {
      const ratio = distance / left;
      x += (to.x - from.x) * ratio;
      y += (to.y - from.y) * ratio;
      distance = 0;
    }
  }

  return { ...enemy, x, y, segment };
}

function attackEnemies(game, deltaSeconds) {
  let gold = game.gold;
  let enemies = game.enemies.map((enemy) => ({ ...enemy }));
  const shots = game.shots
    .map((shot) => ({ ...shot, life: shot.life - deltaSeconds }))
    .filter((shot) => shot.life > 0);

  const towers = game.towers.map((tower) => {
    const cooldown = Math.max(0, tower.cooldown - deltaSeconds);
    if (cooldown > 0) return { ...tower, cooldown };

    const target = enemies.find((enemy) => Math.hypot(enemy.x - tower.x, enemy.y - tower.y) <= tower.range);
    if (!target) return { ...tower, cooldown };

    enemies = enemies.map((enemy) => (
      enemy.id === target.id ? { ...enemy, hp: enemy.hp - tower.damage } : enemy
    ));
    shots.push({ fromX: tower.x, fromY: tower.y, toX: target.x, toY: target.y, life: 0.12 });

    return { ...tower, cooldown: TOWER_COOLDOWN };
  });

  const aliveEnemies = [];
  for (const enemy of enemies) {
    if (enemy.hp <= 0) {
      gold += KILL_REWARD;
    } else {
      aliveEnemies.push(enemy);
    }
  }

  return { ...game, gold, enemies: aliveEnemies, towers, shots };
}

function settleWave(game) {
  if (game.status === 'lost') return game;
  if (game.status === 'running' && game.spawnLeft === 0 && game.enemies.length === 0) {
    if (game.wave >= 5) {
      return { ...game, status: 'won', message: '防守成功' };
    }

    return {
      ...game,
      wave: game.wave + 1,
      status: 'ready',
      gold: game.gold + 25,
      message: '本波结束，点击开始下一波',
    };
  }

  return game;
}

function drawBackground(ctx) {
  ctx.fillStyle = '#eef2f7';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = '#d6dde8';
  ctx.lineWidth = 1;

  for (let x = 0; x <= WIDTH; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }

  for (let y = 0; y <= HEIGHT; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
}

function drawPath(ctx) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 54;
  ctx.strokeStyle = '#d7b98b';
  ctx.beginPath();
  PATH.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();

  ctx.lineWidth = 4;
  ctx.strokeStyle = '#8f6c3c';
  ctx.stroke();
}

function drawTowers(ctx, game) {
  for (const tower of game.towers) {
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, tower.range, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(37, 99, 235, 0.08)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#2563eb';
    ctx.fill();
    ctx.strokeStyle = '#173d8f';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

function drawEnemies(ctx, game) {
  for (const enemy of game.enemies) {
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, 15, 0, Math.PI * 2);
    ctx.fillStyle = '#dc2626';
    ctx.fill();

    ctx.fillStyle = '#111827';
    ctx.fillRect(enemy.x - 18, enemy.y - 26, 36, 5);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(enemy.x - 18, enemy.y - 26, 36 * Math.max(0, enemy.hp / enemy.maxHp), 5);
  }
}

function drawShots(ctx, game) {
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 3;

  for (const shot of game.shots) {
    ctx.beginPath();
    ctx.moveTo(shot.fromX, shot.fromY);
    ctx.lineTo(shot.toX, shot.toY);
    ctx.stroke();
  }
}

function drawHud(ctx, game) {
  ctx.fillStyle = '#111827';
  ctx.font = '18px Arial, Microsoft YaHei, sans-serif';
  ctx.fillText(`金币 ${game.gold}`, 18, 30);
  ctx.fillText(`生命 ${game.lives}`, 120, 30);
  ctx.fillText(`波次 ${game.wave}/5`, 220, 30);
  ctx.fillText(game.message, 330, 30);
}
