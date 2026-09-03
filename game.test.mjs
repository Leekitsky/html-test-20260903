import assert from 'node:assert/strict';
import {
  CARDS,
  createGame,
  drawGame,
  selectCard,
  spawnUnit,
  stepGame,
} from './game.js';

const game = createGame();

assert.equal(game.players.blue.baseHp, 1200);
assert.equal(game.players.red.baseHp, 1200);
assert.equal(game.players.blue.energy, 5);
assert.equal(game.players.red.energy, 5);
assert.equal(game.status, 'playing');

const selected = selectCard(game, 'blue', 'archer');
assert.equal(selected.players.blue.selectedCard, 'archer');
assert.equal(game.players.blue.selectedCard, 'knight');

const withBlueUnit = spawnUnit(selected, 'blue', 170, 155);
assert.equal(withBlueUnit.players.blue.energy, 3);
assert.equal(withBlueUnit.units.length, 1);
assert.equal(withBlueUnit.units[0].team, 'blue');

assert.throws(() => spawnUnit(withBlueUnit, 'blue', 510, 155), /己方半场/);
assert.throws(() => spawnUnit({ ...selected, players: {
  ...selected.players,
  blue: { ...selected.players.blue, energy: 1 },
} }, 'blue', 170, 155), /能量不足/);

const withRedUnit = spawnUnit(selectCard(withBlueUnit, 'red', 'archer'), 'red', 550, 260);
assert.equal(withRedUnit.players.red.energy, 3);
assert.equal(withRedUnit.units.length, 2);

const afterEnergy = stepGame(withRedUnit, 2);
assert.ok(afterEnergy.players.blue.energy > withRedUnit.players.blue.energy);
assert.ok(afterEnergy.players.red.energy > withRedUnit.players.red.energy);

const afterBattle = Array.from({ length: 120 }).reduce(
  (state) => stepGame(state, 0.1),
  withRedUnit,
);
assert.ok(afterBattle.units.length < withRedUnit.units.length || afterBattle.effects.length > 0);

const nearBase = {
  ...createGame(),
  units: [{
    id: 1,
    team: 'blue',
    cardId: 'giant',
    x: 635,
    y: 210,
    hp: CARDS.giant.hp,
    maxHp: CARDS.giant.hp,
    damage: CARDS.giant.damage,
    range: CARDS.giant.range,
    speed: CARDS.giant.speed,
    cooldown: 0,
  }],
  nextUnitId: 2,
};
const baseHit = stepGame(nearBase, 0.2);
assert.ok(baseHit.players.red.baseHp < 1200);

const lost = {
  ...nearBase,
  players: {
    ...nearBase.players,
    red: { ...nearBase.players.red, baseHp: 10 },
  },
};
assert.equal(stepGame(lost, 0.2).status, 'blue-win');

const calls = [];
const ctx = {
  fillStyle: '',
  font: '',
  lineWidth: 0,
  strokeStyle: '',
  textAlign: '',
  arc: (...args) => calls.push(['arc', ...args]),
  beginPath: () => calls.push(['beginPath']),
  clearRect: (...args) => calls.push(['clearRect', ...args]),
  fill: () => calls.push(['fill']),
  fillRect: (...args) => calls.push(['fillRect', ...args]),
  fillText: (...args) => calls.push(['fillText', ...args]),
  lineTo: (...args) => calls.push(['lineTo', ...args]),
  moveTo: (...args) => calls.push(['moveTo', ...args]),
  stroke: () => calls.push(['stroke']),
  strokeRect: (...args) => calls.push(['strokeRect', ...args]),
};

drawGame(ctx, withRedUnit);
assert.ok(calls.some((call) => call[0] === 'clearRect'));
assert.ok(calls.some((call) => call[0] === 'fillText'));
assert.ok(calls.some((call) => call[0] === 'arc'));

console.log('same-screen battle tests passed');
