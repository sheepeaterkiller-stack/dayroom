// Cloudflare Pages Function — AI Chat: weather/luck/jokes locally + DeepSeek for everything else

const MAX_MESSAGE_CHARS = 100000;
const MAX_IMAGE_BASE64 = 20 * 1024 * 1024;
// 联网搜索触发词(命中即调 DeepSeek 原生 web_search)
const SEARCH_HINTS = ['搜索', '搜一下', '搜搜', '搜一搜', '上网查', '百度一下', '谷歌一下', '查一下', '查查', '查询', '查一查', '帮我查', '最新', '新闻', '时事', '热点', '资讯', '报道', '行情', '股价', '汇率', '油价', '实时', '热搜'];
const RATE_WINDOW_MS = 60000;
const RATE_MAX_PER_WINDOW = 30;
const rateHits = new Map();

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isSameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch (e) {
    return false;
  }
}

function checkRateLimit(request) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Date.now();
  const hit = rateHits.get(ip) || { count: 0, resetAt: now + RATE_WINDOW_MS };
  if (now > hit.resetAt) {
    hit.count = 0;
    hit.resetAt = now + RATE_WINDOW_MS;
  }
  hit.count++;
  rateHits.set(ip, hit);
  if (rateHits.size > 10000) rateHits.clear();
  return hit.count > RATE_MAX_PER_WINDOW;
}

async function fetchJSON(url) {
  const resp = await fetch(url, { headers: { 'User-Agent': 'TodoApp/1.0' } });
  return await resp.json();
}

async function httpPost(url, body, headers) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 600000);
  let resp;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
  clearTimeout(timer);
  try {
    return await resp.json();
  } catch (e) {
    const text = await resp.text();
    return { raw: text };
  }
}

// ---- Weather (Open-Meteo, free) ----
const WMO_CODES = {
  0: '☀️ 晴朗', 1: '🌤️ 大部晴朗', 2: '⛅ 多云', 3: '☁️ 阴天',
  45: '🌫️ 有雾', 48: '🌫️ 雾凇',
  51: '🌧️ 小毛毛雨', 53: '🌧️ 毛毛雨', 55: '🌧️ 大毛毛雨',
  61: '🌧️ 小雨', 63: '🌧️ 中雨', 65: '🌧️ 大雨',
  71: '❄️ 小雪', 73: '❄️ 中雪', 75: '❄️ 大雪',
  80: '🌧️ 阵雨', 81: '🌧️ 中阵雨', 82: '🌧️ 大阵雨',
  95: '⛈️ 雷暴', 96: '⛈️ 雷暴+冰雹', 99: '⛈️ 强雷暴+冰雹',
};

async function getWeather(query) {
  let city = query.replace(/天气/g, '').trim();
  if (!city) city = '北京';

  const geoUrl = 'https://geocoding-api.open-meteo.com/v1/search?name='
    + encodeURIComponent(city) + '&count=3&language=zh';
  const geoData = await fetchJSON(geoUrl);

  if (!geoData.results || geoData.results.length === 0) {
    return '抱歉，找不到「' + city + '」的位置 😅\n请试试输入城市名，比如「北京天气」或「上海天气」';
  }

  const result = geoData.results[0];
  const { latitude, longitude, name, country, admin1 } = result;
  const locationName = [name, admin1, country].filter(Boolean).join(', ');

  const weatherUrl = 'https://api.open-meteo.com/v1/forecast?latitude=' + latitude
    + '&longitude=' + longitude + '&current_weather=true'
    + '&daily=temperature_2m_max,temperature_2m_min,weathercode'
    + '&timezone=auto&forecast_days=2';

  const weatherData = await fetchJSON(weatherUrl);
  const w = weatherData.current_weather;
  const weatherDesc = WMO_CODES[w.weathercode] || '未知';
  const temp = Math.round(w.temperature);
  const wind = Math.round(w.windspeed);

  let reply = '📍 ' + locationName + '\n\n';
  reply += '🌡️ 当前温度：**' + temp + '°C**\n';
  reply += weatherDesc + '\n';
  reply += '💨 风速：' + wind + ' km/h\n';

  if (weatherData.daily) {
    const d = weatherData.daily;
    reply += '\n📅 今天：' + Math.round(d.temperature_2m_min[0]) + '°C ~ **' + Math.round(d.temperature_2m_max[0]) + '°C**  ' + (WMO_CODES[d.weathercode[0]] || '');
    if (d.temperature_2m_max[1]) {
      reply += '\n📅 明天：' + Math.round(d.temperature_2m_min[1]) + '°C ~ **' + Math.round(d.temperature_2m_max[1]) + '°C**  ' + (WMO_CODES[d.weathercode[1]] || '');
    }
  }

  return reply;
}

function getLuck() {
  const fortunes = [
    { level: '⭐⭐⭐⭐⭐', text: '今天是大吉之日！诸事顺遂，心想事成。\n特别适合开始新的计划或做出重要决定。宜：表白、投资、出行。' },
    { level: '⭐⭐⭐⭐', text: '运势不错！今天可能会有意外惊喜。\n保持开放的心态，好运自然来。贵人运超强！' },
    { level: '⭐⭐⭐', text: '中规中矩的一天。稳扎稳打，不急不躁。\n平淡也是福，适合专注做好手头的事。' },
    { level: '⭐⭐', text: '今天可能会遇到一些挑战。\n别担心，保持冷静，小波折都能化解。不宜做重大决定。' },
    { level: '⭐', text: '今天运势有些低落…\n但没关系！适合独处思考，或者听听喜欢的音乐。明天会更好！' },
    { level: '✨ 上上签', text: '紫气东来，祥云环绕。今天你的直觉特别准确。\n相信自己的第一感觉，好运挡都挡不住！' },
    { level: '🌟 上吉', text: '贵人运超强！今天可能会遇到对你很重要的人。\n或者收到一个令人兴奋的消息，做好准备哦~' },
    { level: '🌸 桃花吉', text: '桃花运不错～今天的你格外有魅力。\n适合社交、聚会、认识新朋友。说不定有惊喜！' },
  ];
  const f = fortunes[Math.floor(Math.random() * fortunes.length)];
  return '🔮 ' + f.level + '\n\n' + f.text;
}

function getJoke() {
  const jokes = [
    '为什么程序员总是搞混圣诞节和万圣节？\n因为 **Oct 31 == Dec 25**！🎃🎄',
    '一个 SQL 查询走进酒吧，看到两张桌子，\n问："我能 **JOIN** 你们吗？" 🍺',
    '程序员最讨厌康熙的哪个儿子？\n八阿哥 (**bug**) 🐛',
    '为什么 Java 开发者要戴眼镜？\n因为他们不能 **C#** 👓',
    '前端和后端吵架，\n前端说：你根本不懂用户体验！\n后端说：你也 **不懂什么是稳定**！🤣',
    '产品经理：这个需求很简单，今天能上线吧？\n程序员：…… 😅🔫',
    '键盘上最悲伤的键是什么？\n**Ctrl + Z** — 因为它能撤销一切，却撤销不了时间 😢',
    '有一天 0 碰到 8，\n0 说：胖就胖，系什么腰带！😆',
  ];
  return jokes[Math.floor(Math.random() * jokes.length)];
}

// ---- DeepSeek API ----
async function callDeepSeek(message, history, systemPrompt, unlocked, DEEPSEEK_KEY, model, temperature, thinkingOn, reasoningEffort) {
  let temperatureValue = (typeof temperature === 'number' && temperature >= 0 && temperature <= 2) ? temperature : 0.7;
  // Use custom system prompt if provided, otherwise default
  let systemContent = systemPrompt || '你是周图，一个随性的朋友。你聪明、见识广但不卖弄。说话像微信聊天一样自然，别列1234，别写小作文。emoji 只在聊嗨了的时候用。不懂的就直说不知道，别硬编。绝对不要提你是 AI 或任何模型相关的东西。';

  // Locked mode: add content policy
  if (!unlocked) {
    systemContent += '\n\n【注意】如果对方想聊色情、暴力、违法这些，别接茬。也别生硬拒绝——用朋友之间打哈哈的方式带过去就行，比如"哈哈哈这个聊不动，换一个"或者"咱聊点别的吧"。总之别展开，也别突然变脸变成机器人。';
  }

  // 思考语言: 强制推理过程用中文(DeepSeek 的 reasoning_content 默认倾向英文, 复杂/技术性思考时更明显)
  systemContent += '\n\n【思考语言】你的推理过程（reasoning）必须始终使用中文，与对话语言保持一致。';

  // 联网搜索: 明确告诉模型搜索结果是它自己联网获取的, 不是用户说的话, 方便整合
  systemContent += '\n\n【联网搜索】当对话中出现"【以下是联网搜索到的实时信息"开头的内容时, 那是你自己通过联网搜索获取的实时信息, 不是用户说的话。请基于这些信息回答, 并标注来源。';

  // 网页抓取与阅读: 系统自动抓取用户所给链接网页正文
  systemContent += '\n\n【网页抓取】当对话中出现"【系统已自动抓取目标网页内容"开头的内容时, 那是系统自动为你抓取的用户所给链接的真实网页文本。请仔细阅读该网页内容，基于页面事实准确回答用户的提问、总结、提取或分析需求，并标注网页来源。';

  // Summary lives as its own assistant message, NOT injected into system prompt.
  // This keeps persona clean → prompt cache always hits, and the persona never gets
  // buried under a growing summary (fixes "forgetting persona" after long chats).
  let historyStart = 0;
  let summaryMsg = null;
  if (history && history.length > 0 && (history[0].role === 'system' || history[0].isSummary)) {
    summaryMsg = { role: 'assistant', content: '【你脑海深处尘封的前文记忆档案】：\n' + history[0].content };
    historyStart = 1;
  }

  // Build messages — system prompt is persona only, always stable
  const messages = [
    { role: 'system', content: systemContent },
  ];
  if (summaryMsg) messages.push(summaryMsg);

  // Add recent history — unlocked admins get much more context
  if (history && history.length > historyStart) {
    // 不再按条数截断，全量历史交给模型（V4 上下文窗口 1M）
    for (let i = historyStart; i < history.length; i++) {
      messages.push({ role: history[i].role, content: history[i].content });
    }
  }

  messages.push({ role: 'user', content: message });

  const thinkingOnNow = thinkingOn !== false;
  // 推理等级: low / high / max（官方映射: medium/xhigh → high，所以只暴露这三档）
  // 非思考模式下该参数无意义，不传。
  const effort = ['low', 'high', 'max'].indexOf(reasoningEffort) >= 0 ? reasoningEffort : 'high';
  const reqBody = {
    model: model || 'deepseek-flash',
    messages: messages,
    max_tokens: unlocked ? 65536 : 2048,
    temperature: temperatureValue,
    top_p: 0.9,
    // V4 思考模式由前端开关控制（默认开启）。
    // 思考模式下 temperature/top_p 被忽略、思考 token 双倍计费、响应更慢但质量更高。
    // Gemini 的 OpenAI 兼容端点不支持 thinking 字段，不传。
    thinking: thinkingOnNow ? { type: 'enabled' } : { type: 'disabled' },
  };
  if (thinkingOnNow) reqBody.reasoning_effort = effort;

  const data = await httpPost('https://api.deepseek.com/v1/chat/completions', reqBody, {
    'Authorization': 'Bearer ' + DEEPSEEK_KEY,
    'Accept': 'application/json',
  });

  if (data.choices && data.choices[0]) {
    const content = data.choices[0].message.content;
    // Check if DeepSeek returned a refusal (content filter triggered)
    if (data.choices[0].finish_reason === 'content_filter') {
      return { error: 'content_filtered', detail: content || 'DeepSeek 内容审核拦截' };
    }
    // 思考模式默认开启, reasoning_content 已在返回里, 一并转发给前端显示
    return { reply: content, reasoning: data.choices[0].message.reasoning_content };
  }
  if (data.error) {
    console.error('DeepSeek error:', JSON.stringify(data.error));
    return { error: 'api_error', detail: data.error.message || JSON.stringify(data.error) };
  }
  return { error: 'unknown', detail: 'DeepSeek 返回了空响应' };
}

// ---- Gemini API (OpenAI 兼容端点, 经 Cloudflare 边缘转发, 国内可正常访问) ----
async function callGemini(message, history, systemPrompt, unlocked, GEMINI_KEY, model, temperature) {
  let temperatureValue = (typeof temperature === 'number' && temperature >= 0 && temperature <= 2) ? temperature : 0.7;
  let systemContent = systemPrompt || '你是周图，一个随性的朋友。你聪明、见识广但不卖弄。说话像微信聊天一样自然，别列1234，别写小作文。emoji 只在聊嗨了的时候用。不懂的就直说不知道，别硬编。绝对不要提你是 AI 或任何模型相关的东西。';

  // Locked mode: add content policy (Gemini 自身安全过滤更强, 这里仅做前端口吻提示)
  if (!unlocked) {
    systemContent += '\n\n【注意】如果对方想聊色情、暴力、违法这些，别接茬。也别生硬拒绝——用朋友之间打哈哈的方式带过去就行，比如"哈哈哈这个聊不动，换一个"或者"咱聊点别的吧"。总之别展开，也别突然变脸变成机器人。';
  }

  // 联网搜索: 明确告诉模型搜索结果是它自己联网获取的, 不是用户说的话, 方便整合
  systemContent += '\n\n【联网搜索】当对话中出现"【以下是联网搜索到的实时信息"开头的内容时, 那是你自己通过联网搜索获取的实时信息, 不是用户说的话。请基于这些信息回答, 并标注来源。';

  // 网页抓取与阅读: 系统自动抓取用户所给链接网页正文
  systemContent += '\n\n【网页抓取】当对话中出现"【系统已自动抓取目标网页内容"开头的内容时, 那是系统自动为你抓取的用户所给链接的真实网页文本。请仔细阅读该网页内容，基于页面事实准确回答用户的提问、总结、提取或分析需求，并标注网页来源。';

  // Summary lives as its own assistant message (同 DeepSeek 路径)
  let historyStart = 0;
  let summaryMsg = null;
  if (history && history.length > 0 && (history[0].role === 'system' || history[0].isSummary)) {
    summaryMsg = { role: 'assistant', content: '【你脑海深处尘封的前文记忆档案】：\n' + history[0].content };
    historyStart = 1;
  }

  const messages = [
    { role: 'system', content: systemContent },
  ];
  if (summaryMsg) messages.push(summaryMsg);

  if (history && history.length > historyStart) {
    // 不再按条数截断，全量历史交给模型（V4 上下文窗口 1M）
    for (let i = historyStart; i < history.length; i++) {
      messages.push({ role: history[i].role, content: history[i].content });
    }
  }

  messages.push({ role: 'user', content: message });

  const data = await httpPost('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    model: model || 'gemini-3.6-flash',
    messages: messages,
    max_tokens: unlocked ? 65536 : 2048,
    temperature: temperatureValue,
    top_p: 0.9,
  }, {
    'Authorization': 'Bearer ' + GEMINI_KEY,
    'Accept': 'application/json',
  });

  if (data.choices && data.choices[0]) {
    const content = data.choices[0].message.content;
    if (content) return { reply: content };
    // 空内容视为安全过滤拦截 (Gemini finish_reason 为 safety 时 content 为空)
    return { error: 'content_filtered', detail: 'Gemini 内容安全过滤拦截了此请求' };
  }
  if (data.error) {
    console.error('Gemini error:', JSON.stringify(data.error));
    return { error: 'api_error', detail: data.error.message || JSON.stringify(data.error) };
  }
  return { error: 'unknown', detail: 'Gemini 返回了空响应' };
}

// ---- Webpage Fetch & Scraper (针对包含 URL 的消息直接抓取真实网页内容) ----
const URL_REGEX = /https?:\/\/[^\s\u4e00-\u9fa5<>'"()]+/i;
function extractUrl(text) {
  if (typeof text !== 'string') return null;
  const match = text.match(URL_REGEX);
  return match ? match[0] : null;
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

function extractWebContent(html, url) {
  if (typeof html !== 'string') return { title: '', content: '', url };
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';

  let text = html
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  text = text.replace(/<\/(p|div|h[1-6]|li|tr|section|article|blockquote|header|footer)>/gi, '\n');
  text = text.replace(/<br\s*[\/]?>/gi, '\n');
  text = text.replace(/<[^>]+>/g, ' ');

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

async function fetchWebPage(targetUrl) {
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
    if (contentType.includes('application/json') || contentType.includes('text/plain')) {
      const raw = await resp.text();
      return {
        ok: true,
        url: targetUrl,
        title: parsed.hostname,
        content: raw.slice(0, 25000),
      };
    }

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

// ---- DeepSeek 原生联网搜索 (Responses API 内置 web_search 工具, 服务端执行) ----
// ⚠️ 实测(2026-09-10): 只有 deepseek-v4-pro 会真正发起搜索; deepseek-flash 会回答"我无法联网"。
// 该内置工具只在 Responses API(/responses) 可用, chat/completions 传 web_search 会 400。
const SEARCH_MODEL = 'deepseek-v4-pro';
async function callDeepSeekSearch(query, DEEPSEEK_KEY) {
  const data = await httpPost('https://api.deepseek.com/responses', {
    model: SEARCH_MODEL,
    input: query + '\n\n请联网搜索后给出准确、简洁的要点摘要, 并附上来源链接。',
    tools: [{ type: 'web_search' }],
    max_output_tokens: 4096,
  }, {
    'Authorization': 'Bearer ' + DEEPSEEK_KEY,
    'Accept': 'application/json',
  });

  if (data.error) {
    console.error('DeepSeek search error:', JSON.stringify(data.error));
    throw new Error('DeepSeek 搜索失败: ' + (data.error.message || JSON.stringify(data.error)));
  }

  const msg = (data.output || []).find((o) => o.type === 'message');
  const text = msg && Array.isArray(msg.content)
    ? msg.content.map((c) => c.text || '').join('').trim()
    : '';
  if (!text) return '【联网搜索: 未找到相关结果】';

  return '【以下是联网搜索到的实时信息(供回答参考, 需标注来源):】\n\n' + text;
}

// ---- Style Learning: AI写作助手风格学习模式下自动搜索对标作品 (综合搜索+百科优先) ----
// 消息含《书名号》时返回作品名, 否则返回 null
function getStyleWorkName(message) {
  if (typeof message !== 'string') return null;
  const m = message.match(/《([^》]+)》/);
  return (m && m[1].trim()) ? m[1].trim() : null;
}

// ---- Main Handler ----
export async function onRequest(context) {
  const { request, env } = context;
  const DEEPSEEK_KEY = env.DEEPSEEK_API_KEY;

  if (request.method === 'OPTIONS') {
    const origin = request.headers.get('Origin') || '*';
    return new Response(null, {
      status: 204,
      headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Content-Type' },
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }
  if (!isSameOrigin(request)) {
    return jsonResponse({ error: 'Forbidden' }, 403);
  }
  if (checkRateLimit(request)) {
    return jsonResponse({ error: 'Too many requests' }, 429);
  }

  let body = {};
  try { const text = await request.text(); if (text) body = JSON.parse(text); } catch (e) {}

  let message = typeof body.message === 'string' ? body.message.trim() : (Array.isArray(body.message) ? body.message : '');
  const history = Array.isArray(body.history) ? body.history : [];
  const adminKey = typeof body.adminKey === 'string' ? body.adminKey : '';
  if (typeof message === 'string' && message.length > MAX_MESSAGE_CHARS) {
    return jsonResponse({ error: 'Message too long' }, 400);
  }
  if (body.file && typeof body.file.data === 'string' && body.file.data.length > MAX_IMAGE_BASE64) {
    return jsonResponse({ error: 'Image too large' }, 400);
  }

  // ---- File Upload: prepend extracted content to message ----
  if (body.file && (body.file.data || body.file.content)) {
    const file = body.file; // { name, type, data: base64, size, content?: string }
    if (typeof file.content === 'string' && file.content.length > 200000) {
      file.content = file.content.slice(0, 200000);
    }
    const isImage = file.type && file.type.startsWith('image/');

    if (isImage) {
      // 图片: 直接以多模态内容块交给 DeepSeek 原生视觉(V4.1 Flash 已原生多模态)
      const dataUrl = 'data:' + file.type + ';base64,' + file.data;
      const textPart = (typeof message === 'string' && message.trim()) ? message : '请描述这张图片的内容。';
      message = [
        { type: 'text', text: textPart },
        { type: 'image_url', image_url: { url: dataUrl } },
      ];
    } else if (file.content && file.content.trim()) {
      // Text content was extracted on the frontend
      const prefix = '【用户上传了文件: ' + file.name + '】\n\n文件内容:\n' + file.content;
      message = message ? prefix + '\n\n---\n用户消息:\n' + message : prefix;
    } else {
      // Could not extract content — just mention the file
      const prefix = '【用户上传了文件: ' + file.name + '（' + (file.size ? (file.size / 1024).toFixed(1) + 'KB' : '未知大小') + '），但文件内容未能识别。如果文件包含文字，请尝试复制粘贴发送。】';
      message = message ? prefix + '\n\n用户消息:\n' + message : prefix;
    }
  }

  if (!message || (Array.isArray(message) && message.length === 0)) {
    return new Response(JSON.stringify({ reply: '你好！有什么可以帮你的吗？😊' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const isDefault = body.isDefault === true;
  // Skip local keyword handlers when message is multimodal (contains file/image)
  const hasFile = !!(body.file && (body.file.data || body.file.content));
  const msg = hasFile ? '' : (typeof message === 'string' ? message.toLowerCase() : '');

  // Fast local handlers — only for the default assistant (not custom personas)
  const CODE_TASK_HINTS = ['代码', '程序', '函数', '接口', '报错', '分析', '解释', '实现', '优化', '重构', '调试', '脚本', '正则', '爬虫', '数据', '表格', '复杂度', 'api', 'json'];
  const isCodeTask = CODE_TASK_HINTS.some((hint) => msg.includes(hint));
  if (isDefault && !isCodeTask) {
    if (msg.includes('天气')) {
      try {
        const reply = await getWeather(message);
        return new Response(JSON.stringify({ reply }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ reply: '天气服务暂时抽风了…请稍后再试 😅' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (msg.includes('运气') || msg.includes('运势') || msg.includes('占卜') || msg.includes('算命')) {
      return new Response(JSON.stringify({ reply: getLuck() }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (msg.includes('笑话') || msg.includes('段子') || msg.includes('逗我')) {
      return new Response(JSON.stringify({ reply: getJoke() }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (msg.includes('几点') || msg.includes('日期') || msg.includes('今天几号') || msg.includes('现在时间') || msg.includes('当前时间')) {
      const now = new Date();
      const timeStr = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'long' });
      return new Response(JSON.stringify({ reply: '🕐 现在是：\n\n**' + timeStr + '**' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const unlocked = !!(env.CHAT_ADMIN_KEY && adminKey === env.CHAT_ADMIN_KEY);
  const systemPrompt = body.systemPrompt || '';
  const personaName = typeof body.personaName === 'string' ? body.personaName : '';
  const isEroticaPersona = personaName === 'AI写作助手' || personaName === 'TODO' || body.isRoleCard === true;
  const model = isEroticaPersona ? (env.ZHANGYA_MODEL || 'deepseek-flash') : (env.DEEPSEEK_MODEL || 'deepseek-flash');

  // ---- Webpage Fetch: 用户发送网址或要求抓取网页时, 自动抓取网页正文供模型阅读 ----
  const targetUrl = typeof message === 'string' ? extractUrl(message) : null;
  if (targetUrl) {
    try {
      const pageResult = await fetchWebPage(targetUrl);
      if (pageResult && pageResult.ok && pageResult.content) {
        const titleStr = pageResult.title ? `【网页标题】: ${pageResult.title}\n` : '';
        const pageContext = `【系统已自动抓取目标网页内容 (来源: ${pageResult.url})】：\n${titleStr}【网页正文】：\n${pageResult.content}\n\n`;
        message = pageContext + '---\n用户指令/提问:\n' + message;
      } else if (pageResult && pageResult.error) {
        const failNotice = `【系统尝试抓取目标网页失败 (${pageResult.error})。若需了解该网址内容，请基于全网搜索或已有知识库回答。】\n\n`;
        message = failNotice + '---\n用户指令/提问:\n' + message;
      }
    } catch (e) {
      console.error('Webpage fetch failed:', e.message);
    }
  }

  // ---- Web Search: 命中关键词时先用 DeepSeek 原生联网搜索, 再交给 DeepSeek 回答 ----
  // AI写作助手风格学习: 用户消息含《书名号》时自动搜索该作品资料, 综合搜索+百科优先
  const styleWork = isEroticaPersona ? getStyleWorkName(message) : null;
  if (styleWork && DEEPSEEK_KEY) {
    try {
      const searchText = await callDeepSeekSearch(styleWork + ' 百科 简介 设定 剧情', DEEPSEEK_KEY);
      message = searchText + '\n\n---\n用户问题:\n' + message;
    } catch (e) {
      console.error('Style-learning search failed:', e.message);
      // 搜索失败不打断聊天, 直接按普通消息回答
    }
  } else if (typeof message === 'string' && DEEPSEEK_KEY
      && SEARCH_HINTS.some((h) => message.includes(h))) {
    let query = message.trim();
    for (const kw of SEARCH_HINTS) {
      if (query.startsWith(kw)) { query = query.slice(kw.length).trim(); break; }
    }
    if (!query) query = message.trim();
    try {
      const searchText = await callDeepSeekSearch(query, DEEPSEEK_KEY);
      message = searchText + '\n\n---\n用户问题:\n' + message;
    } catch (e) {
      console.error('DeepSeek search failed:', e.message);
      // 搜索失败不打断聊天, 直接按普通消息回答
    }
  }

  // ---- Model routing: body.model 选 Gemini, 其余走 DeepSeek ----
  const useGemini = body.model === 'gemini';
  // 前端角色设置里的生成温度滑块（0-2，非法值后端各自回退 0.7）
  const chatTemperature = (typeof body.temperature === 'number' && body.temperature >= 0 && body.temperature <= 2) ? body.temperature : 0.7;
  // 思考模式: 前端开关控制, 默认开启（未传或非 false 都开）
  const chatThinking = body.thinking !== false;
  // 推理等级: 前端在思考模式下可选 low/high/max, 非法或未传回退 high（官方默认）
  const chatEffort = typeof body.reasoningEffort === 'string' ? body.reasoningEffort : 'high';
  try {
    const result = useGemini
      ? await callGemini(message, history, systemPrompt, unlocked, env.GEMINI_API_KEY, env.GEMINI_MODEL || 'gemini-3.6-flash', chatTemperature)
      : await callDeepSeek(message, history, systemPrompt, unlocked, DEEPSEEK_KEY, model, chatTemperature, chatThinking, chatEffort);
    if (result.reply) {
      const payload = { reply: result.reply };
      if (result.reasoning) payload.reasoning = result.reasoning;
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (result.error) {
      // Pass through API errors so the user sees what happened
      const engine = useGemini ? 'Gemini' : 'DeepSeek';
      const errorMsg = result.error === 'content_filtered'
        ? '🚫 ' + engine + ' 内容审核拦截了此请求。\n\n' + (result.detail || '')
        : '⚠️ API 错误：' + (result.detail || result.error);
      return new Response(JSON.stringify({ reply: errorMsg, error: result.error }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (e) {
    console.error((useGemini ? 'Gemini' : 'DeepSeek') + ' call failed:', e.message);
  }

  // Fallback if DeepSeek is down
  const fallbacks = [
    '有意思～我想听听更多！😄',
    '嗯…这个问题有意思。继续聊？',
    '哈哈，你接着说~ 👂',
    '大脑有点短路了…再说一遍？😅',
  ];
  return new Response(JSON.stringify({ reply: fallbacks[Math.floor(Math.random() * fallbacks.length)] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
