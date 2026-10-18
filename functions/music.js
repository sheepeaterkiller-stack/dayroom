// Cloudflare Pages Function — Music Search & Audio Source
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'search';
  const keyword = url.searchParams.get('keyword') || '';
  const rid = url.searchParams.get('rid') || '';

  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  async function fetchWithTimeout(targetUrl, options = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(targetUrl, {
        ...options,
        signal: controller.signal,
        headers: { 'User-Agent': UA, ...(options.headers || {}) },
      });
    } finally {
      clearTimeout(timer);
    }
  }

  function cleanText(str) {
    if (!str) return '';
    return str
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, c) => String.fromCharCode(parseInt(c, 16)))
      .trim();
  }

  try {
    // ===== 1. SEARCH =====
    if (action === 'search') {
      const q = keyword.trim();
      if (!q) {
        return new Response(JSON.stringify({ error: 'Missing keyword' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const searchUrl = 'https://search.kuwo.cn/r.s?all=' + encodeURIComponent(q) + '&ft=music&itemset=web_2013&client=kt&pn=0&rn=30&rformat=json&encoding=utf8';
      const resp = await fetchWithTimeout(searchUrl);
      if (!resp.ok) throw new Error('Search request failed: HTTP ' + resp.status);
      const text = await resp.text();

      const regex = /'ARTIST':'([^']*)'[\s\S]*?'MUSICRID':'(?:MUSIC_)?(\d+)'[\s\S]*?'SONGNAME':'([^']*)'/g;
      const songs = [];
      const seenRids = new Set();
      let m;
      while ((m = regex.exec(text)) !== null) {
        const itemRid = m[2];
        if (seenRids.has(itemRid)) continue;
        seenRids.add(itemRid);

        songs.push({
          rid: itemRid,
          name: cleanText(m[3]) || '未知歌曲',
          artist: cleanText(m[1]) || '未知歌手',
        });
      }

      return new Response(JSON.stringify(songs), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
        },
      });
    }

    // ===== 2. GET AUDIO URL =====
    if (action === 'url') {
      if (!rid) {
        return new Response(JSON.stringify({ error: 'Missing rid' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const cleanRid = rid.replace(/^(?:kw_|MUSIC_)/, '');
      const playUrl = 'https://antiserver.kuwo.cn/anti.s?type=convert_url&rid=' + cleanRid + '&format=mp3&response=url';
      const resp = await fetchWithTimeout(playUrl);
      if (!resp.ok) throw new Error('Audio conversion failed: HTTP ' + resp.status);
      const audioUrl = (await resp.text()).trim();

      if (!audioUrl || !audioUrl.startsWith('http')) {
        return new Response(JSON.stringify({ error: 'Audio stream unavailable', raw: audioUrl }), {
          status: 404,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
      }

      return new Response(JSON.stringify({ url: audioUrl }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=1800',
        },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
}
