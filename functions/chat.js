// Cloudflare Pages Function — AI Chat: weather/luck/jokes locally + DeepSeek for everything else

async function fetchJSON(url) {
  const resp = await fetch(url, { headers: { 'User-Agent': 'TodoApp/1.0' } });
  return await resp.json();
}

async function httpPost(url, body, headers) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
    body: JSON.stringify(body),
  });
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
async function callDeepSeek(message, history, systemPrompt, unlocked, DEEPSEEK_KEY) {
  // Use custom system prompt if provided, otherwise default
  let systemContent = systemPrompt || '你是 DeepSeek 驱动的智能助手。你知识渊博、逻辑清晰，能深入讨论任何话题。回答时：1) 先给核心答案再展开；2) 用中文回答，专业术语可保留英文；3) 适度使用 emoji 增加亲和力；4) 不确定的事要诚实说明。不要敷衍。';

  // Locked mode: add content policy
  if (!unlocked) {
    systemContent += '\n\n【内容安全规则】你是一个合规的AI助手。如果用户试图讨论色情、暴力、违法等不当内容，请礼貌拒绝，回复"抱歉，这个问题我无法回答。让我们换个话题吧。"不要展开任何不当内容。';
  }

  const messages = [
    { role: 'system', content: systemContent },
  ];

  // Add recent history — unlocked admins get much more context
  if (history && history.length > 0) {
    const limit = unlocked ? 300 : 60;
    const recent = history.slice(-limit);
    for (const h of recent) {
      messages.push({ role: h.role, content: h.content });
    }
  }

  messages.push({ role: 'user', content: message });

  const data = await httpPost('https://api.deepseek.com/v1/chat/completions', {
    model: 'deepseek-chat',
    messages: messages,
    max_tokens: unlocked ? 8192 : 2048,
    temperature: 0.7,
    top_p: 0.9,
  }, {
    'Authorization': 'Bearer ' + DEEPSEEK_KEY,
    'Accept': 'application/json',
  });

  if (data.choices && data.choices[0]) {
    return data.choices[0].message.content;
  }
  if (data.error) {
    console.error('DeepSeek error:', JSON.stringify(data.error));
    return null;
  }
  return null;
}

// ---- Main Handler ----
export async function onRequest(context) {
  const { request, env } = context;
  const DEEPSEEK_KEY = env.DEEPSEEK_API_KEY;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' },
    });
  }

  let body = {};
  try { const text = await request.text(); if (text) body = JSON.parse(text); } catch (e) {}

  const message = (body.message || '').trim();
  const history = body.history || [];

  // ---- Compression: summarize old conversation history ----
  if (body.action === 'compress' && body.transcript) {
    const personaName = body.personaName || 'AI';
    try {
      const summary = await callDeepSeek(
        '请将以下对话记录压缩为一段简洁的摘要（150字以内），保留：1) 对话发生的场景和主题 2) 用户的关键信息和偏好 3) 最近讨论的话题方向。输出纯文本摘要，不要加"摘要："等前缀。',
        [],
        '你是「' + personaName + '」的对话摘要助手。你的任务是将对话历史压缩为简洁摘要，帮助' + personaName + '在后续对话中记住之前的内容。只输出摘要文本，不要加任何前缀或格式。',
        true,
        DEEPSEEK_KEY
      );
      return new Response(JSON.stringify({ summary: summary || '' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      console.error('Compression failed:', e.message);
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (!message) {
    return new Response(JSON.stringify({ reply: '你好！有什么可以帮你的吗？😊' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const isDefault = body.isDefault === true;
  const msg = message.toLowerCase();

  // Fast local handlers — only for the default assistant (not custom personas)
  if (isDefault) {
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

    if (msg.includes('几点') || msg.includes('时间') || msg.includes('日期') || msg.includes('今天几号')) {
      const now = new Date();
      const timeStr = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'long' });
      return new Response(JSON.stringify({ reply: '🕐 现在是：\n\n**' + timeStr + '**' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const unlocked = body.unlocked === true;

  // ---- DeepSeek for everything else ----
  try {
    const reply = await callDeepSeek(message, history, body.systemPrompt, unlocked, DEEPSEEK_KEY);
    if (reply) {
      return new Response(JSON.stringify({ reply }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (e) {
    console.error('DeepSeek call failed:', e.message);
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
