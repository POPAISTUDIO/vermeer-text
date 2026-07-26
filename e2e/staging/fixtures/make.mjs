// Génère les fixtures d'upload de la suite E2E.
//
// Pourquoi générer plutôt que committer : les fixtures historiques de
// ~/qa-staging-vermeer/shots/sample-*.png ne sont PAS des images (signature PNG suivie
// d'un remplissage d'espaces — `file` les identifie comme « data »). Un serveur qui
// refuse une image invalide renverrait un 4xx de validation, ce qui masquerait le vrai
// sujet des cas FILE-* (limite de taille / prise en compte du contenu visuel).
//
// Les images produites ici sont de vrais PNG valides et déterministes :
//   sample-small.png    ~ 640x480, formes et couleurs franches (contenu décrivable)
//   sample-1.5mb.png    ~ 1,5 Mo de bruit (incompressible → taille maîtrisée)
//   sample-8mb.png      ~ 8 Mo de bruit
//
// Usage : node fixtures/make.mjs [nom-de-fixture…]

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

const crcTable = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
};

/** Encode un PNG 8 bits RGB à partir de scanlines brutes (filtre 0). */
const encodePng = (width, height, raw) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 2; // truecolor RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

const scanlines = (width, height, pixel) => {
  const rowLength = width * 3 + 1;
  const raw = Buffer.alloc(rowLength * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * rowLength;
    raw[rowStart] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y);
      const offset = rowStart + 1 + x * 3;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
    }
  }
  return raw;
};

/**
 * Image à contenu visuel non ambigu : fond blanc, gros disque rouge centré,
 * rectangle bleu en bas à gauche. Un modèle de vision doit pouvoir nommer
 * au moins une couleur et une forme.
 */
const smallImage = () => {
  const width = 640;
  const height = 480;
  const cx = 320;
  const cy = 210;
  const radius = 140;
  const raw = scanlines(width, height, (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy <= radius * radius) {
      return [220, 30, 45];
    }
    if (x >= 60 && x <= 220 && y >= 370 && y <= 450) {
      return [30, 80, 200];
    }
    return [255, 255, 255];
  });
  return encodePng(width, height, raw);
};

/**
 * Bruit déterministe (xorshift32) : entropie suffisante pour que deflate ne compresse
 * quasiment pas, donc la taille finale du PNG est pilotable par les dimensions.
 */
const noiseImage = (targetBytes) => {
  const side = Math.max(16, Math.round(Math.sqrt(targetBytes / 3)));
  let seed = 0x9e3779b9;
  const next = () => {
    seed ^= seed << 13;
    seed >>>= 0;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    seed >>>= 0;
    return seed & 0xff;
  };
  const raw = scanlines(side, side, () => [next(), next(), next()]);
  return encodePng(side, side, raw);
};

const FIXTURES = {
  'sample-small.png': smallImage,
  'sample-1.5mb.png': () => noiseImage(1.5 * 1024 * 1024),
  'sample-8mb.png': () => noiseImage(8 * 1024 * 1024),
};

const requested = process.argv.slice(2);
const names = requested.length > 0 ? requested : Object.keys(FIXTURES);

for (const name of names) {
  const build = FIXTURES[name];
  if (build == null) {
    console.error(`Fixture inconnue : ${name} (connues : ${Object.keys(FIXTURES).join(', ')})`);
    process.exit(1);
  }
  const target = path.join(here, name);
  const png = build();
  fs.writeFileSync(target, png);
  console.log(`${name} — ${(png.length / (1024 * 1024)).toFixed(2)} Mo`);
}
