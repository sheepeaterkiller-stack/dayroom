// Cloudflare Pages Function — proxies requests to jsonblob
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get('id') || null;

  try {
    let apiUrl = 'https://jsonblob.com/api/jsonBlob';
    if (id) apiUrl += '/' + id;

    const fetchOptions = {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    // Only attach body for methods that support it
    if (request.method === 'POST' || request.method === 'PUT') {
      fetchOptions.body = await request.text();
    }

    // If no ID for GET, create a new blob
    if (request.method === 'GET' && !id) {
      fetchOptions.method = 'POST';
      fetchOptions.body = JSON.stringify({ todos: [] });
    }

    const resp = await fetch(apiUrl, fetchOptions);
    const data = await resp.json();

    // Extract blob ID for newly created blobs
    let blobId = id;
    if (!blobId) {
      blobId =
        resp.headers.get('X-jsonblob-id') ||
        (resp.headers.get('Location') || '').split('/').pop() ||
        '';
    }

    return new Response(JSON.stringify({ id: blobId, todos: data.todos ?? data }), {
      status: resp.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
