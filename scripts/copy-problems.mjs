import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';

const SRC = 'Chess_problems';
const DEST = join('dist', '_data', 'Chess_problems');
const MANIFEST = join('dist', 'problems.json');

try {
  if (!existsSync(SRC)) {
    console.error(`[copy-problems] Source not found: ${SRC}`);
    process.exit(0); // nothing to copy, don't fail build
  }
  const destDir = dirname(DEST);
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }
  cpSync(SRC, DEST, { recursive: true });
  console.log(`[copy-problems] Copied ${SRC} -> ${DEST}`);

  // Build a manifest that the client can download at page load.
  // It scans Chess_problems for .json files, extracts rating from filename,
  // reads puzzle content, and groups into difficulty buckets.
  const files = walkJsonFiles(SRC);
  const entries = [];
  for (const filePath of files) {
    const rating = extractRatingFromName(basename(filePath));
    if (!Number.isFinite(rating)) continue;
    try {
      const raw = readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      const list = normalizeToPuzzleArray(parsed);
      list.forEach((p, idx) => {
        const id = p.id ?? p.PuzzleId ?? `${basename(filePath)}#${idx}`;
        const fen = p.FEN || p.fen;
        const rawMoves = p.Moves || p.moves;
        let moves = [];
        if (typeof rawMoves === 'string') {
          moves = rawMoves.split(' ').filter(Boolean);
        } else if (Array.isArray(rawMoves)) {
          moves = rawMoves;
        }

        if (typeof fen === 'string' && moves.length > 0) {
          entries.push({ id, fen, moves, rating });
        }
      });
    } catch (err) {
      console.warn(`[copy-problems] Skip invalid JSON ${filePath}:`, err?.message || err);
    }
  }

  const buckets = buildBuckets(entries);
  const manifest = {
    levels: buckets.map((b, i) => ({ id: i + 1, label: b.label })),
    puzzles: Object.fromEntries(buckets.map((b, i) => [String(i + 1), b.items.map(({ id, fen, moves }) => ({ id, fen, moves }))])),
  };
  writeFileSync(MANIFEST, JSON.stringify(manifest), 'utf8');
  console.log(`[copy-problems] Wrote manifest ${MANIFEST} with ${entries.length} puzzles`);
} catch (err) {
  console.error('[copy-problems] Failed to copy problem CSVs:', err);
  process.exit(1);
}

function walkJsonFiles(dir) {
  const out = [];
  const ents = readdirSync(dir);
  for (const name of ents) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walkJsonFiles(full));
    } else if (st.isFile() && extname(name).toLowerCase() === '.json') {
      out.push(full);
    }
  }
  return out;
}

function extractRatingFromName(name) {
  // e.g. "1234.json" or "puzzle_1450.json" -> 1234 / 1450
  const m = String(name).match(/(\d{3,4})/);
  return m ? Number(m[1]) : NaN;
}

function normalizeToPuzzleArray(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.puzzles)) return parsed.puzzles;
    // single puzzle object case
    const hasFen = 'fen' in parsed || 'FEN' in parsed;
    const hasMoves = 'moves' in parsed || 'Moves' in parsed;
    if (hasFen && hasMoves) return [parsed];
  }
  return [];
}

function buildBuckets(entries) {
  // Define difficulty buckets by rating ranges (inclusive-exclusive except last).
  const ranges = [
    { lo: 0, hi: 1200, label: 'Rating ≤ 1200' },
    { lo: 1200, hi: 1500, label: '1200–1500' },
    { lo: 1500, hi: 1800, label: '1500–1800' },
    { lo: 1800, hi: 2100, label: '1800–2100' },
    { lo: 2100, hi: 2400, label: '2100–2400' },
    { lo: 2400, hi: Infinity, label: '2400+' },
  ];
  const buckets = ranges.map((r) => ({ label: r.label, items: [] }));
  for (const e of entries) {
    const idx = ranges.findIndex((r) => e.rating >= r.lo && e.rating < r.hi);
    const bi = idx >= 0 ? idx : ranges.length - 1;
    buckets[bi].items.push(e);
  }
  return buckets;
}
