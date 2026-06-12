// Cloudflare Pages Function — search higequ.com, extract audio URLs
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'search';
  const keyword = url.searchParams.get('keyword') || '';
  const rid = url.searchParams.get('rid') || '';

  const UA = 'Mozilla/5.0 (compatible; CloudflareBot/1.0)';

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
        return new Response(JSON.stringify({ error: 'Missing keyword' }), { status: 400 });
      }

      const searchUrl = 'https://higequ.com/s/' + encodeURIComponent(keyword) + '/';
      console.log('Searching:', searchUrl);
      const resp = await fetchWithTimeout(searchUrl);
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

      return new Response(JSON.stringify(songs), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
      });
    }

    // ===== GET AUDIO URL =====
    if (action === 'url') {
      if (!rid) {
        return new Response(JSON.stringify({ error: 'Missing rid' }), { status: 400 });
      }

      const playerUrl = 'https://higequ.com/player/' + rid + '/';
      console.log('Fetching player:', playerUrl);
      const resp = await fetchWithTimeout(playerUrl);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const html = await resp.text();

      // Extract Base64 code: let code = "..." (the audio URL is base64-encoded)
      const codeMatch = html.match(/let\s+code\s*=\s*"([^"]+)"/);
      if (!codeMatch || !codeMatch[1]) {
        return new Response(JSON.stringify({ error: 'No audio code found' }), { status: 404 });
      }

      const decoded = atob(codeMatch[1]);
      console.log('Decoded URL:', decoded.substring(0, 80) + '...');

      return new Response(JSON.stringify({ url: decoded }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400 });
  } catch (err) {
    console.error('Error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
