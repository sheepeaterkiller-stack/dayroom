// Cloudflare Pages Function — Webpage fetch & text scraper
// Supports: GET /fetch?url=... or POST /fetch with JSON body { url: "..." }

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

function isPrivateHost(hostname) {
  const h = (hostname || '').toLowerCase();
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '0.0.0.0' ||
    h === '::1' ||
    h.endsWith('.local') ||
    h.startsWith('10.') ||
    h.startsWith('192.168.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h)
  );
}

export function extractWebContent(html, url) {
  if (typeof html !== 'string') return { title: '', content: '', url };

  // 1. Extract title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';

  // 2. Strip non-content blocks
  let text = html
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // 3. Convert block elements to newlines
  text = text.replace(/<\/(p|div|h[1-6]|li|tr|section|article|blockquote|header|footer)>/gi, '\n');
  text = text.replace(/<br\s*[\/]?>/gi, '\n');

  // 4. Strip remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // 5. Decode common HTML entities
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&hellip;/gi, '…');

  // 6. Clean and filter lines
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let cleanText = lines.join('\n');
  if (cleanText.length > 25000) {
    cleanText = cleanText.slice(0, 25000) + '\n\n...(内容较长，已截取前 25,000 字)...';
  }

  return { title, content: cleanText, url };
}

export async function fetchWebPage(targetUrl) {
  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch (e) {
    return { ok: false, error: '无效的 URL 地址' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: '仅支持 HTTP/HTTPS 协议' };
  }

  if (isPrivateHost(parsed.hostname)) {
    return { ok: false, error: '出于安全考虑，禁止抓取内网或本地地址' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const resp = await fetch(parsed.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);

    if (!resp.ok) {
      return { ok: false, error: `HTTP ${resp.status} ${resp.statusText}` };
    }

    const contentType = (resp.headers.get('content-type') || '').toLowerCase();

    // Plain text or JSON
    if (contentType.includes('application/json') || contentType.includes('text/plain')) {
      const raw = await resp.text();
      return {
        ok: true,
        url: targetUrl,
        title: parsed.hostname,
        content: raw.slice(0, 25000),
      };
    }

    // HTML content
    const html = await resp.text();
    const result = extractWebContent(html, targetUrl);
    return {
      ok: true,
      url: targetUrl,
      title: result.title,
      content: result.content,
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      ok: false,
      error: err.name === 'AbortError' ? '网页抓取超时（超过 12 秒无响应）' : (err.message || '抓取失败'),
    };
  }
}

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  let targetUrl = '';
  if (request.method === 'GET') {
    const urlObj = new URL(request.url);
    targetUrl = (urlObj.searchParams.get('url') || '').trim();
  } else if (request.method === 'POST') {
    try {
      const body = await request.json();
      targetUrl = (body && typeof body.url === 'string' ? body.url : '').trim();
    } catch (e) {
      return jsonResponse({ ok: false, error: '请求体需为合法 JSON 且包含 url 字段' }, 400);
    }
  } else {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  }

  if (!targetUrl) {
    return jsonResponse({ ok: false, error: '缺少 url 参数' }, 400);
  }

  const result = await fetchWebPage(targetUrl);
  return jsonResponse(result, result.ok ? 200 : 502);
}
