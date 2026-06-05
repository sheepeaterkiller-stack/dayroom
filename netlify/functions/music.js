// Netlify Function — search higequ.com, extract audio URLs
exports.handler = async (event) => {
  const { queryStringParameters } = event;
  const action = queryStringParameters?.action || 'search';
  const keyword = queryStringParameters?.keyword || '';
  const rid = queryStringParameters?.rid || '';

  const UA = 'Mozilla/5.0 (compatible; NetlifyBot/1.0)';

  async function fetchWithTimeout(url, timeoutMs = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { signal: controller.signal, headers: { 'User-Agent': UA } });
    } finally {
      clearTimeout(timer);
    }
  }

  try {
    // ===== SEARCH =====
    if (action === 'search') {
      if (!keyword) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing keyword' }) };
      }

      const url = 'https://higequ.com/s/' + encodeURIComponent(keyword) + '/';
      console.log('Searching:', url);
      const resp = await fetchWithTimeout(url);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const html = await resp.text();

      const songs = [];
      const itemRegex = /<div[^>]*class="[^"]*result-item[^"]*"[^>]*data-rid="(\d+)"[^>]*>([\s\S]*?)<\/div>\s*(?=<div[^>]*class="[^"]*result-item|<div[^>]*class="[^"]*pagination|$)/gi;

      let match;
      while ((match = itemRegex.exec(html)) !== null) {
        const ridVal = match[1];
        const block = match[2];
        const titleMatch = block.match(/<div[^>]*class="[^"]*result-title[^"]*"[^>]*>([^<]+)<\/div>/i);
        const artistMatch = block.match(/<div[^>]*class="[^"]*result-artist[^"]*"[^>]*>([^<]+)<\/div>/i);

        if (titleMatch) {
          songs.push({
            rid: ridVal,
            name: titleMatch[1].trim(),
            artist: artistMatch ? artistMatch[1].trim() : '未知歌手',
          });
        }
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
        body: JSON.stringify(songs),
      };
    }

    // ===== GET AUDIO URL =====
    if (action === 'url') {
      if (!rid) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing rid' }) };
      }

      const url = 'https://higequ.com/player/' + rid + '/';
      console.log('Fetching player:', url);
      const resp = await fetchWithTimeout(url);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const html = await resp.text();

      // Extract Base64 code: let code = "..." (the audio URL is base64-encoded)
      const codeMatch = html.match(/let\s+code\s*=\s*"([^"]+)"/);
      if (!codeMatch || !codeMatch[1]) {
        return { statusCode: 404, body: JSON.stringify({ error: 'No audio code found' }) };
      }

      const decoded = Buffer.from(codeMatch[1], 'base64').toString('utf-8');
      console.log('Decoded URL:', decoded.substring(0, 80) + '...');

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
        body: JSON.stringify({ url: decoded }),
      };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Unknown action' }) };
  } catch (err) {
    console.error('Error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
