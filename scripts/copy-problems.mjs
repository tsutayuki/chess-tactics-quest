import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';

const SRC = 'Chess_problems';
const DEST = join('dist', '_data', 'Chess_problems');
const MANIFEST_DIST = join('dist', 'problems.json');
const MANIFEST_PUBLIC = join('public', 'problems.json');

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
  // It scans Chess_problems for .json files, normalizes records, and groups by filename range.
  const files = walkJsonFiles(SRC);
  const entries = [];
  for (const filePath of files) {
    const base = basename(filePath);
    const group = extractRangeLabelFromName(base) || `File ${base}`;
    try {
      const raw = readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      const list = normalizeToPuzzleArray(parsed);
      list.forEach((p, idx) => {
        const id = p.id ?? p.PuzzleId ?? `${base}#${idx}`;
        const fen = p.fen ?? p.FEN;
        const rawMoves = p.moves ?? p.Moves;
        let moves = [];
        if (typeof rawMoves === 'string') {
          moves = rawMoves.trim().split(/\s+/).filter(Boolean);
        } else if (Array.isArray(rawMoves)) {
          moves = rawMoves;
        }

        if (typeof fen === 'string' && fen && moves.length > 0) {
          entries.push({ id, fen, moves, group });
        }
      });
    } catch (err) {
      console.warn(`[copy-problems] Skip invalid JSON ${filePath}:`, err?.message || err);
    }
  }

  const buckets = buildBucketsByGroup(entries);
  const manifest = {
    levels: buckets.map((b, i) => ({ id: i + 1, label: b.label })),
    puzzles: Object.fromEntries(buckets.map((b, i) => [String(i + 1), b.items.map(({ id, fen, moves }) => ({ id, fen, moves }))])),
  };
  if (!existsSync(dirname(MANIFEST_DIST))) mkdirSync(dirname(MANIFEST_DIST), { recursive: true });
  writeFileSync(MANIFEST_DIST, JSON.stringify(manifest), 'utf8');
  console.log(`[copy-problems] Wrote manifest ${MANIFEST_DIST} with ${entries.length} puzzles`);
  if (!existsSync(dirname(MANIFEST_PUBLIC))) mkdirSync(dirname(MANIFEST_PUBLIC), { recursive: true });
  writeFileSync(MANIFEST_PUBLIC, JSON.stringify(manifest), 'utf8');
  console.log(`[copy-problems] Wrote manifest ${MANIFEST_PUBLIC} with ${entries.length} puzzles`);
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

function extractRangeLabelFromName(name) {
  // e.g. problem_840to1060.json -> "840-1060"
  const m = String(name).match(/(\d+)to(\d+)/i);
  if (m) return `${m[1]}-${m[2]}`;
  const m2 = String(name).match(/(\d+)[_-](\d+)/);
  if (m2) return `${m2[1]}-${m2[2]}`;
  return String(name);
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

function buildBucketsByGroup(entries) {
  const groups = new Map();
  for (const e of entries) {
    const k = e.group || 'misc';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }
  const sorted = [...groups.entries()].sort((a, b) => {
    const aLo = parseInt(String(a[0]).split('-')[0], 10);
    const bLo = parseInt(String(b[0]).split('-')[0], 10);
    if (!Number.isFinite(aLo) && !Number.isFinite(bLo)) return String(a[0]).localeCompare(String(b[0]));
    if (!Number.isFinite(aLo)) return 1;
    if (!Number.isFinite(bLo)) return -1;
    return aLo - bLo;
  });
  return sorted.map(([label, items]) => ({ label: `Rating ${label}`, items }));
}

