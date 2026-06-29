/**
 * Extract text from a PDF as visual lines, using pdfjs-dist.
 *
 * The Chime statement parser (parse.ts) depends on one transaction per line
 * (like pdfplumber gave the Python version), so we reconstruct lines from
 * pdfjs text items by grouping them on their Y baseline and ordering by X.
 * A space is inserted between items only when there is a real horizontal gap,
 * which keeps tokens like dates and amounts ("6/22/2026", "-$204.67") intact.
 */
import * as fs from 'fs';

// pdfjs-dist v4 is ESM-only. A plain `import()` gets rewritten to `require()`
// by tsc's CommonJS output (which throws ERR_REQUIRE_ESM at runtime), so we use
// a Function-wrapped import that survives down-leveling and stays a real dynamic
// import in the compiled JS.
const importEsm = new Function('specifier', 'return import(specifier)') as (
  specifier: string,
) => Promise<any>;

interface Item {
  x: number;
  y: number;
  width: number;
  str: string;
}

const Y_TOLERANCE = 2; // points — items within this Y delta are the same line
const GAP = 1.5; // points — horizontal gap above which we insert a space

export async function extractLines(src: string | Uint8Array): Promise<string[]> {
  // pdfjs-dist v4 ships as ESM; import the legacy build for Node.
  const pdfjs: any = await importEsm('pdfjs-dist/legacy/build/pdf.mjs');
  const data = typeof src === 'string' ? new Uint8Array(fs.readFileSync(src)) : src;
  const doc = await pdfjs.getDocument({
    data,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  const lines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();

    const items: Item[] = [];
    for (const it of content.items as any[]) {
      if (typeof it.str !== 'string' || it.str.length === 0) continue;
      items.push({ x: it.transform[4], y: it.transform[5], width: it.width ?? 0, str: it.str });
    }
    // Top-to-bottom (PDF Y grows upward), then left-to-right.
    items.sort((a, b) => b.y - a.y || a.x - b.x);

    let line: Item[] = [];
    let lineY: number | null = null;
    const flush = () => {
      if (!line.length) return;
      line.sort((a, b) => a.x - b.x);
      let out = '';
      let prevEnd: number | null = null;
      for (const it of line) {
        if (prevEnd !== null && it.x - prevEnd > GAP) out += ' ';
        out += it.str;
        prevEnd = it.x + it.width;
      }
      out = out.replace(/\s+/g, ' ').trim();
      if (out) lines.push(out);
      line = [];
    };

    for (const it of items) {
      if (lineY === null || Math.abs(it.y - lineY) <= Y_TOLERANCE) {
        if (lineY === null) lineY = it.y;
        line.push(it);
      } else {
        flush();
        lineY = it.y;
        line.push(it);
      }
    }
    flush();
    page.cleanup();
  }
  await doc.destroy();
  return lines;
}
