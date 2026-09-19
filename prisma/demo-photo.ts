/**
 * Generates a simple placeholder "portrait" PNG (coloured background with a
 * head-and-shoulders silhouette) for demo patients. No external dependencies —
 * just raw pixels + zlib, so the seed works on any machine.
 */
import { deflateSync } from 'node:zlib';

const SIZE = 256;

function crc32(buf: Buffer): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([len, typeAndData, crc]);
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/**
 * `seed` picks the colour; `variant` nudges head size / shoulder width so the
 * placeholders don't all look identical.
 */
export function makeDemoPortrait(seed: number, variant = 0): Buffer {
  const hue = (seed * 47) % 360;
  const bg = hslToRgb(hue, 0.45, 0.86);
  const fg = hslToRgb(hue, 0.35, 0.42);
  const ring = hslToRgb(hue, 0.4, 0.7);

  const headR = SIZE * (0.19 + (variant % 3) * 0.015);
  const headCx = SIZE / 2;
  const headCy = SIZE * 0.4;
  const shoulderTop = SIZE * 0.66;
  const shoulderW = SIZE * (0.34 + (variant % 2) * 0.03);

  const rows: Buffer[] = [];
  for (let y = 0; y < SIZE; y++) {
    const row = Buffer.alloc(1 + SIZE * 3);
    row[0] = 0; // filter: none
    for (let x = 0; x < SIZE; x++) {
      let c = bg;
      const dx = x - headCx;
      const dyHead = y - headCy;
      const inHead = dx * dx + dyHead * dyHead <= headR * headR;
      // Shoulders: upper half of an ellipse centred on the bottom edge
      const ry = SIZE - shoulderTop;
      const ex = dx / shoulderW;
      const ey = (y - SIZE) / ry;
      const inShoulders = y >= shoulderTop && ex * ex + ey * ey <= 1;
      // Thin ring near the edge so the circle-cropped avatar still shows a border
      const dc = Math.hypot(x - SIZE / 2, y - SIZE / 2);
      const inRing = dc > SIZE * 0.47 && dc < SIZE * 0.5;
      if (inHead || inShoulders) c = fg;
      else if (inRing) c = ring;
      row[1 + x * 3] = c[0];
      row[2 + x * 3] = c[1];
      row[3 + x * 3] = c[2];
    }
    rows.push(row);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
