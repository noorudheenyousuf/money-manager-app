const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 1. Create Beautiful SVG Icon
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="50%" stop-color="#1e293b" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#10b981" flood-opacity="0.35"/>
    </filter>
  </defs>
  <!-- Background Rounded Rect -->
  <rect width="512" height="512" rx="128" fill="url(#bg)"/>
  <rect x="24" y="24" width="464" height="464" rx="104" fill="none" stroke="#334155" stroke-width="4" stroke-opacity="0.6"/>
  
  <!-- Glowing Center Circle -->
  <circle cx="256" cy="256" r="160" fill="url(#accent)" filter="url(#shadow)"/>
  <circle cx="256" cy="256" r="130" fill="#0f172a" opacity="0.92"/>

  <!-- Indian Rupee Symbol (₹) -->
  <g fill="#10b981">
    <!-- Top Bar -->
    <rect x="180" y="156" width="152" height="26" rx="13"/>
    <!-- Second Bar -->
    <rect x="180" y="206" width="152" height="26" rx="13"/>
    <!-- Stem & Upper Curve -->
    <path d="M 216 156 L 216 330 C 216 345, 230 356, 246 356 C 290 356, 316 320, 316 280 C 316 240, 280 206, 240 206 L 216 206" fill="none" stroke="#10b981" stroke-width="26" stroke-linecap="round"/>
    <!-- Diagonal Leg -->
    <path d="M 235 290 L 320 376" fill="none" stroke="#10b981" stroke-width="26" stroke-linecap="round"/>
  </g>
</svg>`;

fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svgIcon);
console.log('Saved icon.svg');

// 2. Pure Node.js Minimal PNG Builder
function createPng(width, height, r, g, b) {
  // Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // 8 bits per channel
  ihdr.writeUInt8(6, 9); // RGBA
  ihdr.writeUInt8(0, 10); // Deflate
  ihdr.writeUInt8(0, 11); // Filter
  ihdr.writeUInt8(0, 12); // Interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Raw Image Scanlines (Filter type 0 + RGBA)
  const rowLength = 1 + width * 4;
  const rawData = Buffer.alloc(rowLength * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLength;
    rawData[rowOffset] = 0; // Filter: none
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      // Simple circular badge design in RGBA
      const dx = x - width / 2;
      const dy = y - height / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const radius = width * 0.42;

      if (dist <= radius) {
        // Emerald green center with dark border
        if (dist > radius - 10) {
          rawData[pxOffset] = 16;     // R
          rawData[pxOffset + 1] = 185; // G
          rawData[pxOffset + 2] = 129; // B
          rawData[pxOffset + 3] = 255; // Alpha
        } else if (dist <= radius * 0.75 && dist >= radius * 0.65) {
          rawData[pxOffset] = 16;
          rawData[pxOffset + 1] = 185;
          rawData[pxOffset + 2] = 129;
          rawData[pxOffset + 3] = 255;
        } else {
          rawData[pxOffset] = 15;     // Slate 900
          rawData[pxOffset + 1] = 23;
          rawData[pxOffset + 2] = 42;
          rawData[pxOffset + 3] = 255;
        }
      } else {
        // Dark background rounded corner
        const cornerDist = Math.max(Math.abs(dx), Math.abs(dy));
        if (cornerDist < width * 0.48) {
          rawData[pxOffset] = 30;
          rawData[pxOffset + 1] = 41;
          rawData[pxOffset + 2] = 59;
          rawData[pxOffset + 3] = 255;
        } else {
          rawData[pxOffset] = 0;
          rawData[pxOffset + 1] = 0;
          rawData[pxOffset + 2] = 0;
          rawData[pxOffset + 3] = 0;
        }
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

// CRC32 implementation
function crc32(buf) {
  let table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  let c = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ table[(c ^ buf[i]) & 0xff];
  }
  return (c ^ (-1)) >>> 0;
}

// Generate 192x192 and 512x512
const png192 = createPng(192, 192);
fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), png192);
console.log('Saved icon-192.png');

const png512 = createPng(512, 512);
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), png512);
console.log('Saved icon-512.png');

const pngMaskable = createPng(512, 512);
fs.writeFileSync(path.join(iconsDir, 'icon-maskable.png'), pngMaskable);
console.log('Saved icon-maskable.png');
