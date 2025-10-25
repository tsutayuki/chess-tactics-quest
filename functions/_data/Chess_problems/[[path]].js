export function onRequest() {
  // Block direct access to CSV assets under /_data/Chess_problems/*
  return new Response('Not Found', { status: 404 });
}

