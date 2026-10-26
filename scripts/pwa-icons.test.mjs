import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

function png(filename) {
  const data = readFileSync(new URL(`../public/icons/${filename}`, import.meta.url));
  assert.deepEqual([...data.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const width = data.readUInt32BE(16);
  const height = data.readUInt32BE(20);
  const chunks = [];
  for (let offset = 8; offset < data.length;) {
    const length = data.readUInt32BE(offset);
    if (data.toString('ascii', offset + 4, offset + 8) === 'IDAT') chunks.push(data.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  return { width, height, pixels: inflateSync(Buffer.concat(chunks)) };
}

test('install icons have their advertised dimensions and opaque RGB pixels', () => {
  for (const [filename, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['maskable-512.png', 512], ['apple-touch-icon.png', 180]]) {
    const image = png(filename);
    assert.equal(image.width, size, filename);
    assert.equal(image.height, size, filename);
    assert.equal(image.pixels.length, size * (size * 3 + 1), filename);
  }
});

test('maskable icon keeps the complete mark inside its circular safe zone', () => {
  const { width, height, pixels } = png('maskable-512.png');
  let markPixels = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = y * (width * 3 + 1) + 1 + x * 3;
    const background = pixels[offset] === 245 && pixels[offset + 1] === 241 && pixels[offset + 2] === 232;
    if (!background) {
      markPixels++;
      assert.ok(Math.hypot(x + 0.5 - width / 2, y + 0.5 - height / 2) <= width * 0.4, `Mark is cropped at ${x},${y}`);
    }
  }
  assert.ok(markPixels > 20000, 'The mark remains visible at app-icon size');
});
