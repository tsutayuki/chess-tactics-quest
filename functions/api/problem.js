export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Accept either `range=900-1200` or `min`/`max` query params
  const rangeParam = url.searchParams.get('range');
  const min = url.searchParams.get('min');
  const max = url.searchParams.get('max');

  let rangeKey = normalizeRange(rangeParam, min, max);
  if (!rangeKey) {
    // default range if not specified
    rangeKey = '1500-1800';
  }

  const fileMap = {
    '900-1200': 'problem_900to1200.csv',
    '1200-1500': 'problem_1200to1500.csv',
    '1500-1800': 'problem_1500to1800.csv',
    '1800-2100': 'problem_1800to2100.csv',
    '2100-2400': 'problem_2100to2400.csv',
    '2400-4000': 'problem_2400to4000.csv',
  };

  const filename = fileMap[rangeKey];
  if (!filename) {
    return json({ error: 'invalid_range', message: 'Unsupported range' }, 400);
  }

  try {
    // Fetch CSV from static assets folder that is not publicly reachable
    const assetPath = `/_data/Chess_problems/${filename}`;
    const assetUrl = new URL(assetPath, request.url);
    const res = await env.ASSETS.fetch(new Request(assetUrl.toString(), { method: 'GET' }));
    if (!res.ok) {
      return json({ error: 'not_found', message: `Asset missing: ${assetPath}` }, 500);
    }
    const csvText = await res.text();

    const rows = parseCsv(csvText);
    if (rows.length === 0) {
      return json({ error: 'empty', message: 'No problems available' }, 500);
    }
    const idx = Math.floor(Math.random() * rows.length);
    const rec = rows[idx];

    // CSV columns (expected): PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags,ID
    const payload = {
      id: rec.PuzzleId ?? rec.ID ?? undefined,
      fen: rec.FEN,
      moves: (rec.Moves || '').trim().split(/\s+/).filter(Boolean),
      rating: toNumber(rec.Rating),
      rd: toNumber(rec.RatingDeviation),
      popularity: toNumber(rec.Popularity),
      plays: toNumber(rec.NbPlays),
      themes: (rec.Themes || '').split(/\s+/).filter(Boolean),
      gameUrl: rec.GameUrl || undefined,
      opening: rec.OpeningTags || undefined,
      range: rangeKey,
      index: idx,
    };

    return json(payload, 200, { 'Cache-Control': 'no-store' });
  } catch (err) {
    return json({ error: 'server_error', message: String(err && err.message || err) }, 500);
  }
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function normalizeRange(rangeParam, min, max) {
  if (rangeParam) {
    const m = String(rangeParam).match(/^(\d{3,4})-(\d{3,4})$/);
    if (m) return `${m[1]}-${m[2]}`;
  }
  if (min && max) {
    const a = Number(min), b = Number(max);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      // snap to the nearest supported bucket
      const buckets = [
        [900, 1200],
        [1200, 1500],
        [1500, 1800],
        [1800, 2100],
        [2100, 2400],
        [2400, 4000],
      ];
      for (const [lo, hi] of buckets) {
        if (a >= lo && b <= hi) return `${lo}-${hi}`;
      }
    }
  }
  return null;
}

function parseCsv(text) {
  // Minimal CSV parser for simple, comma-separated lines without quoted commas.
  // Skips the header row; returns array of objects keyed by header.
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = splitCsvLine(lines[0]);
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length === 0) continue;
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = cols[j];
    }
    if (obj.FEN && obj.Moves) out.push(obj);
  }
  return out;
}

function splitCsvLine(line) {
  // Basic split; CSV appears simple (no embedded commas in fields we need).
  // If needed, upgrade to a proper CSV parser later.
  return line.split(',');
}
