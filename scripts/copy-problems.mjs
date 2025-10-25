import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SRC = 'Chess_problems';
const DEST = join('dist', '_data', 'Chess_problems');

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
} catch (err) {
  console.error('[copy-problems] Failed to copy problem CSVs:', err);
  process.exit(1);
}

