// Netlify Function — proxies requests to jsonblob (server-side, no CORS)
exports.handler = async (event) => {
  const { httpMethod, queryStringParameters, body } = event;

  try {
    const id = queryStringParameters?.id || null;
    let url = 'https://jsonblob.com/api/jsonBlob';
    if (id) url += '/' + id;

    const fetchOptions = {
      method: httpMethod,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    // Only attach body for methods that support it
    if (body && (httpMethod === 'POST' || httpMethod === 'PUT')) {
      fetchOptions.body = body;
    }

    // If no ID for GET, create a new blob
    if (httpMethod === 'GET' && !id) {
      fetchOptions.method = 'POST';
      fetchOptions.body = JSON.stringify({ todos: [] });
    }

    const resp = await fetch(url, fetchOptions);
    const data = await resp.json();

    // Extract blob ID for newly created blobs
    let blobId = id;
    if (!blobId) {
      blobId =
        resp.headers.get('X-jsonblob-id') ||
        (resp.headers.get('Location') || '').split('/').pop() ||
        '';
    }

    return {
      statusCode: resp.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: blobId, todos: data.todos ?? data }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
