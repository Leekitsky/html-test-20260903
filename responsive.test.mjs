import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');

assert.match(html, /width=device-width,\s*initial-scale=1/);
assert.match(html, /min-height:\s*100dvh/);
assert.match(html, /env\(safe-area-inset-top\)/);
assert.match(html, /同屏对战小游戏/);
assert.match(html, /blueCards/);
assert.match(html, /redCards/);
assert.match(html, /@media \(max-width:\s*560px\)/);
assert.match(html, /flex-direction:\s*column/);
assert.match(html, /touch-action:\s*manipulation/);
assert.match(html, /touch-action:\s*none/);
assert.match(html, /overscroll-behavior:\s*none/);
assert.match(html, /addEventListener\('pointerdown'/);
assert.match(html, /event\.preventDefault\(\)/);
assert.match(html, /aspect-ratio:\s*12 \/ 7/);

console.log('responsive tests passed');
