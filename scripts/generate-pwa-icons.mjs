import { writeFile, mkdir } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

const output = new URL('../public/icons/', import.meta.url);
const paper = [245, 241, 232];
const ink = [39, 37, 31];
const rust = [164, 65, 41];

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length);
  name.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8);
  return result;
}

// Four diagram nodes match the site's header. The maskable mark fits completely
// inside the central 80% safe circle, including the corners of its outer nodes.
function icon(size, maskable) {
  const scale = size / 512;
  const start = maskable ? 132 : 100;
  const node = maskable ? 108 : 138;
  const gap = maskable ? 32 : 36;
  const stroke = maskable ? 18 : 20;
  const rows = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = (x + 0.5) / scale;
      const py = (y + 0.5) / scale;
      let color = paper;
      for (let row = 0; row < 2; row++) for (let column = 0; column < 2; column++) {
        const left = start + column * (node + gap);
        const top = start + row * (node + gap);
        if (px < left || px >= left + node || py < top || py >= top + node) continue;
        const filled = row === 0 && column === 1;
        const border = px < left + stroke || px >= left + node - stroke || py < top + stroke || py >= top + node - stroke;
        if (filled || border) color = row === 1 && column === 0 ? rust : ink;
      }
      const offset = y * (size * 3 + 1) + 1 + x * 3;
      rows.set(color, offset);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size); header.writeUInt32BE(size, 4);
  header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

await mkdir(output, { recursive: true });
for (const [filename, size, maskable] of [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['maskable-512.png', 512, true], ['apple-touch-icon.png', 180, false]]) {
  await writeFile(new URL(filename, output), icon(size, maskable));
}
