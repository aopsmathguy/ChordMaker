// Computes per-character width / em ratios for the TTFs bundled in fonts.js.
// Run: `node font-aspect-ratios.js`
//
// The width in jsPDF is `fontSize * (advanceWidth / unitsPerEm)`, so
// `advanceWidth / unitsPerEm` is the aspect ratio that should be plugged
// into the `fontAspectRatio` constant in content.js.

const fs = require('fs');
const path = require('path');

const fontsSrc = fs.readFileSync(path.join(__dirname, 'fonts.js'), 'utf8');

function extractBase64(varName) {
  const re = new RegExp(`${varName}\\s*=\\s*'([^']+)'`);
  const m = fontsSrc.match(re);
  if (!m) throw new Error(`could not find ${varName} in fonts.js`);
  return m[1];
}

function parseFont(base64) {
  const buf = Buffer.from(base64, 'base64');
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  const numTables = view.getUint16(4);
  const tables = {};
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    const tag = String.fromCharCode(buf[rec], buf[rec + 1], buf[rec + 2], buf[rec + 3]);
    tables[tag] = { offset: view.getUint32(rec + 8), length: view.getUint32(rec + 12) };
  }

  const head = tables['head'].offset;
  const unitsPerEm = view.getUint16(head + 18);

  const hhea = tables['hhea'].offset;
  const ascent = view.getInt16(hhea + 4);
  const descent = view.getInt16(hhea + 6);
  const lineGap = view.getInt16(hhea + 8);
  const numberOfHMetrics = view.getUint16(hhea + 34);

  const numGlyphs = view.getUint16(tables['maxp'].offset + 4);

  // hmtx: numberOfHMetrics × (advanceWidth uint16, lsb int16); remaining glyphs reuse the last advance.
  const hmtx = tables['hmtx'].offset;
  const advanceWidths = new Array(numGlyphs);
  let last = 0;
  for (let g = 0; g < numberOfHMetrics; g++) {
    last = view.getUint16(hmtx + g * 4);
    advanceWidths[g] = last;
  }
  for (let g = numberOfHMetrics; g < numGlyphs; g++) advanceWidths[g] = last;

  // cmap: pick a format-4 Unicode BMP subtable.
  const cmap = tables['cmap'].offset;
  const numSub = view.getUint16(cmap + 2);
  let fmt4 = null;
  const candidates = [];
  for (let i = 0; i < numSub; i++) {
    const rec = cmap + 4 + i * 8;
    const platformID = view.getUint16(rec);
    const encodingID = view.getUint16(rec + 2);
    const sub = cmap + view.getUint32(rec + 4);
    if (view.getUint16(sub) === 4) candidates.push({ platformID, encodingID, sub });
  }
  fmt4 = candidates.find(c => c.platformID === 3 && c.encodingID === 1)?.sub
      ?? candidates.find(c => c.platformID === 0)?.sub
      ?? candidates[0]?.sub;
  if (fmt4 == null) throw new Error('no format-4 cmap subtable');

  const segCount = view.getUint16(fmt4 + 6) / 2;
  const endCodeStart = fmt4 + 14;
  const startCodeStart = endCodeStart + segCount * 2 + 2; // skip reservedPad
  const idDeltaStart = startCodeStart + segCount * 2;
  const idRangeOffsetStart = idDeltaStart + segCount * 2;

  function glyphIdFor(cp) {
    let seg = -1;
    for (let i = 0; i < segCount; i++) {
      if (view.getUint16(endCodeStart + i * 2) >= cp) {
        if (view.getUint16(startCodeStart + i * 2) <= cp) seg = i;
        break;
      }
    }
    if (seg < 0) return 0;
    const startCode = view.getUint16(startCodeStart + seg * 2);
    const idDelta = view.getInt16(idDeltaStart + seg * 2);
    const idRangeOffset = view.getUint16(idRangeOffsetStart + seg * 2);
    if (idRangeOffset === 0) return (cp + idDelta) & 0xffff;
    const addr = idRangeOffsetStart + seg * 2 + idRangeOffset + (cp - startCode) * 2;
    const g = view.getUint16(addr);
    return g === 0 ? 0 : (g + idDelta) & 0xffff;
  }

  return { unitsPerEm, ascent, descent, lineGap, advanceWidths, glyphIdFor };
}

function report(label, font, chars) {
  const rows = [...chars].map(c => {
    const cp = c.codePointAt(0);
    const gid = font.glyphIdFor(cp);
    const adv = font.advanceWidths[gid] ?? 0;
    return { c, cp, gid, adv, ratio: adv / font.unitsPerEm };
  });

  console.log(`\n=== ${label} ===`);
  console.log(`unitsPerEm=${font.unitsPerEm}  ascent=${font.ascent}  descent=${font.descent}  lineGap=${font.lineGap}`);
  console.log(`ascent - descent = ${font.ascent - font.descent} (${((font.ascent - font.descent) / font.unitsPerEm).toFixed(4)} em)\n`);
  console.log('char  cp      gid   advance   ratio');
  console.log('----  ------  ----  -------   ------');
  for (const r of rows) {
    const cp = '0x' + r.cp.toString(16).padStart(4, '0');
    console.log(`${r.c.padEnd(4)}  ${cp}  ${String(r.gid).padStart(4)}  ${String(r.adv).padStart(7)}   ${r.ratio.toFixed(4)}`);
  }

  const ratios = rows.map(r => r.ratio).filter(r => r > 0);
  const min = Math.min(...ratios);
  const max = Math.max(...ratios);
  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  console.log(`\nmin=${min.toFixed(4)}  max=${max.toFixed(4)}  mean=${mean.toFixed(4)}  ${min === max ? '(monospace: all glyphs have the same advance)' : '(varies)'}`);
}

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const extras = '0123456789 #b/-()';

const regular = parseFont(extractBase64('robotoMonoBase64'));
const bold = parseFont(extractBase64('robotoMonoBoldBase64'));

report('Roboto Mono Regular — alphabet', regular, alphabet);
report('Roboto Mono Regular — digits & chord glyphs', regular, extras);
report('Roboto Mono Bold — alphabet', bold, alphabet);
report('Roboto Mono Bold — digits & chord glyphs', bold, extras);
