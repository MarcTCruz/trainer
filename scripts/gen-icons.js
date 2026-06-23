// Generates minimal PWA icons: 192x192 and 512x512 PNG
// Dark bg (#0a0a1a) with a cross/plus mark in accent teal (#64ffda)
// Replace with proper branded icons before production.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../public/icons');

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (const b of buf) {
    crc ^= b;
    for (let k = 0; k < 8; k++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function makePNG(size) {
  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const cx = Math.floor(size / 2);
  const cy = Math.floor(size / 2);
  const armLen = Math.floor(size * 0.3);
  const thickness = Math.max(2, Math.floor(size / 32));

  const rawRows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(size * 3);
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const inVertical = Math.abs(dx) <= thickness && Math.abs(dy) <= armLen;
      const inHorizontal = Math.abs(dy) <= thickness && Math.abs(dx) <= armLen;
      if (inVertical || inHorizontal) {
        row[x * 3]     = 0x64; // #64ffda — accent teal
        row[x * 3 + 1] = 0xff;
        row[x * 3 + 2] = 0xda;
      } else {
        row[x * 3]     = 0x0a; // #0a0a1a — bg
        row[x * 3 + 1] = 0x0a;
        row[x * 3 + 2] = 0x1a;
      }
    }
    // Prepend filter byte 0 (None) for each scanline
    rawRows.push(Buffer.concat([Buffer.from([0]), row]));
  }

  const idat = deflateSync(Buffer.concat(rawRows));

  return Buffer.concat([
    PNG_SIG,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'icon-192.png'), makePNG(192));
writeFileSync(join(OUT_DIR, 'icon-512.png'), makePNG(512));
process.stdout.write('Icons written to public/icons/\n');
