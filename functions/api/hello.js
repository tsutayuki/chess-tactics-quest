export async function onRequest() {
  return new Response("Hello from Pages Functions (route)!", {
    headers: { "content-type": "text/plain" },
  });
}
