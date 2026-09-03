import assert from 'node:assert/strict';
import {
  createGame,
  drawGame,
  placeTower,
  spawnEnemy,
  startWave,
  stepGame,
} from './game.js';

const game = createGame();

assert.equal(game.gold, 120);
assert.equal(game.lives, 10);
assert.equal(game.wave, 1);

const withTower = placeTower(game, 260, 180);
assert.equal(withTower.towers.length, 1);
assert.equal(withTower.gold, 80);
assert.equal(game.towers.length, 0);

assert.throws(() => placeTower(withTower, 90, 220), /路线/);
assert.throws(() => placeTower({ ...withTower, gold: 10 }, 420, 180), /金币/);

const withEnemy = spawnEnemy(withTower);
const afterFight = Array.from({ length: 70 }).reduce(
  (state) => stepGame(state, 0.1),
  withEnemy,
);

assert.equal(afterFight.enemies.length, 0);
assert.equal(afterFight.gold, 90);

const leaked = Array.from({ length: 400 }).reduce(
  (state) => stepGame(state, 0.1),
  spawnEnemy(createGame()),
);

assert.equal(leaked.lives, 9);
assert.equal(leaked.enemies.length, 0);

const running = startWave(createGame());
assert.equal(running.status, 'running');
assert.equal(running.spawnLeft, 8);

const won = { ...createGame(), wave: 5, spawnLeft: 0, enemies: [], status: 'running' };
assert.equal(stepGame(won, 0.1).status, 'won');

const calls = [];
const ctx = {
  fillStyle: '',
  font: '',
  lineCap: '',
  lineJoin: '',
  lineWidth: 0,
  strokeStyle: '',
  arc: (...args) => calls.push(['arc', ...args]),
  beginPath: () => calls.push(['beginPath']),
  clearRect: (...args) => calls.push(['clearRect', ...args]),
  fill: () => calls.push(['fill']),
  fillRect: (...args) => calls.push(['fillRect', ...args]),
  fillText: (...args) => calls.push(['fillText', ...args]),
  lineTo: (...args) => calls.push(['lineTo', ...args]),
  moveTo: (...args) => calls.push(['moveTo', ...args]),
  stroke: () => calls.push(['stroke']),
};

drawGame(ctx, spawnEnemy(withTower));
assert.ok(calls.some((call) => call[0] === 'clearRect'));
assert.ok(calls.some((call) => call[0] === 'fillText'));
assert.ok(calls.some((call) => call[0] === 'arc'));

console.log('tower-defense tests passed');
