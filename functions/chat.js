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
  let systemContent = systemPrompt || '你是周图，一个随性的朋友。你聪明、见识广但不卖弄。说话像微信聊天一样自然，别列1234，别写小作文。emoji 只在聊嗨了的时候用。不懂的就直说不知道，别硬编。绝对不要提你是 AI 或任何模型相关的东西。';

  // Locked mode: add content policy
  if (!unlocked) {
    systemContent += '\n\n【注意】如果对方想聊色情、暴力、违法这些，别接茬。也别生硬拒绝——用朋友之间打哈哈的方式带过去就行，比如"哈哈哈这个聊不动，换一个"或者"咱聊点别的吧"。总之别展开，也别突然变脸变成机器人。';
  }

  // Inject summary from history[0] into system prompt as subconscious memory
  // — avoids first-person confusion (Subaru won't think she "said" third-person summaries)
  // Prompt cache still hits between compressions; only invalidates on new summary (rare)
  let historyStart = 0;
  if (history && history.length > 0 && (history[0].role === 'system' || history[0].isSummary)) {
    systemContent += '\n\n【你脑海深处尘封的前文记忆档案】：\n' + history[0].content;
    historyStart = 1;
  }

  // Build messages with stable system prompt for prompt caching
  const messages = [
    { role: 'system', content: systemContent },
  ];

  // Add recent history — unlocked admins get much more context
  if (history && history.length > historyStart) {
    const limit = unlocked ? 300 : 60;
    const recent = history.slice(Math.max(historyStart, history.length - limit));
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

  let message = (body.message || '').trim();
  const history = body.history || [];

  // ---- File Upload: prepend extracted content to message ----
  if (body.file && body.file.data) {
    const file = body.file; // { name, type, data: base64, size, content?: string }
    const isImage = file.type && file.type.startsWith('image/');

    if (isImage) {
      // Build multimodal message for vision-capable deepseek-chat
      const dataUrl = 'data:' + file.type + ';base64,' + file.data;
      const contentParts = [
        { type: 'image_url', image_url: { url: dataUrl } },
      ];
      if (message) {
        contentParts.push({ type: 'text', text: message });
      } else {
        contentParts.push({ type: 'text', text: '请描述这张图片的内容' });
      }
      message = contentParts;
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

  // ---- Compression: summarize old conversation history ----
  if (body.action === 'compress' && body.transcript) {
    const personaName = body.personaName || 'AI';
    try {
      // Truncate transcript if too long (safety limit for API context window)
      let transcript = body.transcript;
      const MAX_LEN = 40000;
      if (transcript.length > MAX_LEN) {
        transcript = transcript.slice(-MAX_LEN);
        transcript = transcript.substring(transcript.indexOf('\n') + 1); // drop partial first line
      }

      const summary = await callDeepSeek(
        // —— 深度整合型对话摘要 ——
        // 不做原文搬运，而是理解、提炼、整合后重新叙述
        '你是一名顶级的对话分析师与传记写作者。请将以下对话记录深度整合成一份高密度记忆档案。\n' +
        '\n' +
        '【核心原则】\n' +
        '这份档案将完全替代原始对话，成为 AI 了解用户和对话历史的唯一来源。\n' +
        '你的工作不是"把原文分分类"，而是"读懂之后用自己的话写出精炼的整合报告"。\n' +
        '遵循：先理解 → 找模式 → 提炼本质 → 重新叙述。\n' +
        '宁可写多，不可遗漏。你没有字数限制。\n' +
        '\n' +
        '═══ 输出结构（每部分必写，按实际内容决定篇幅） ═══\n' +
        '\n' +
        '## 1. 🎬 场景概要\n' +
        '用一段连贯的叙述概括：这是什么场景（现实聊天/角色扮演/工作协作/其他）、\n' +
        '当前处于什么阶段、整体的氛围和基调。如果有多幕场景切换，按时间顺序串起来。\n' +
        '不要写"用户说…AI说…"的流水账，写成一个完整的故事梗概。\n' +
        '\n' +
        '## 2. 👤 用户深度档案\n' +
        '从对话中提取用户透露的所有个人信息，整合成一个立体的人物画像：\n' +
        '- 基本信息：称呼/年龄/职业/所在地/时区\n' +
        '- 性格画像：说话风格、情绪模式、决策方式、价值观——不只是罗列形容词，要结合对话中的具体表现来说明\n' +
        '- 矛盾与复杂性：真实的人常有矛盾（嘴上说无所谓其实很在意、表面理性内心感性），注意捕捉这类张力\n' +
        '- 人生经历：提到过的重要事件、回忆、当前处境\n' +
        '- 兴趣与品味：喜欢什么讨厌什么，对各类事物的口味\n' +
        '- 习惯与日常：作息规律、工作方式、常用的工具/平台\n' +
        '- 社交网络：提到过的家人/朋友/同事/伴侣，用户对他们的情感态度\n' +
        '- 近期的关注与焦虑：当前在操心什么、期待什么、害怕什么\n' +
        '\n' +
        '## 3. 🤖 AI 角色状态\n' +
        'AI 当前的身份/名字/人设；外貌与身材特征（年龄感、身高体型、发色发型、' +
        '五官特点、穿着风格、气质类型等，凡是角色设定或对话中出现过的外观信息都要记录）；\n' +
        '展现出的性格特质和说话风格（语气、口癖、常用词、句式习惯）；\n' +
        '与用户的关系定位（陌生人→熟人→朋友→亲密？关系的亲疏远近）；\n' +
        '用户对 AI 的反馈（满意什么/不满什么/希望调整什么）；\n' +
        '如果有角色扮演或设定变化，记录演变过程。\n' +
        '\n' +
        '## 4. 👥 人物图谱\n' +
        '对话中提到或涉及的每一个人物（真实、虚构、历史、公众人物），逐个建档：\n' +
        '- 姓名/称呼\n' +
        '- 身份（现实中是谁 / 在故事中扮演什么角色）\n' +
        '- 与用户的关系及关系质量（亲近/疏远/冲突/依赖）\n' +
        '- 外貌与身材（年龄、身高体型、发色发型、长相、穿着打扮、气质）、性格特征\n' +
        '- 与此人相关的关键事件\n' +
        '- 用户对此人的态度和情感（欣赏/厌恶/矛盾/怀念…）\n' +
        '- 引用用户的原话描述（如果用户说过的话能体现对此人的态度，原样保留）\n' +
        '如果对话中没有提到任何人物，写"暂无"。\n' +
        '\n' +
        '## 5. 📖 话题深度追踪\n' +
        '按话题（而非按时间顺序）逐一整合。每个话题写成一个有逻辑的段落：\n' +
        '- 这个话题是怎么开始的\n' +
        '- 交流过程中的核心观点和关键转折\n' +
        '- 达成的共识或结论是什么\n' +
        '- 是否还有未解决的问题\n' +
        '- 用户对这个话题的真实兴趣程度（从语气、追问频率等判断）\n' +
        '不要机械罗列"用户说了X，AI回复了Y"，而是写出"关于XX话题，用户持X立场，\n' +
        '经过讨论后倾向于Y方向，但Z问题尚未解决"这样的整合叙述。\n' +
        '\n' +
        '## 6. 💭 用户观点与立场库\n' +
        '不需要复述原文，而是提炼用户在各方面的态度体系：\n' +
        '- 喜欢什么、推崇什么、为什么会喜欢\n' +
        '- 讨厌什么、反感什么、触发点是什么\n' +
        '- 对具体事物/人物/事件的评价和判断\n' +
        '- 重要的世界观和价值观倾向\n' +
        '- 担忧和期待、内心的矛盾\n' +
        '标注用户原话：当某一句话特别能代表用户的个性或态度时，原文引用并标注"用户原话：..."\n' +
        '\n' +
        '## 7. 📋 行动清单\n' +
        '所有需要跟进的事项，区分优先级：\n' +
        '- 🔴 紧急/待办：用户明确要求做的、有时间期限的\n' +
        '- 🟡 AI 承诺过的：AI 说了要帮用户做但还没完成的事\n' +
        '- 🟢 约定/计划：双方约好的后续安排、聊天中提到的计划\n' +
        '- ⏳ 等待中：正在等待答复或结果的事项\n' +
        '- 💤 搁置话题：聊到一半被中断、以后再聊的话题\n' +
        '每个事项标注来源（哪条消息/上下文），便于追溯\n' +
        '\n' +
        '## 8. 🕐 关键事件时间线\n' +
        '按时间顺序列出对话中发生的重要事件/转折点（不是每条消息都记）：\n' +
        '- 事件的简要描述\n' +
        '- 事件在对话中的意义（为什么重要）\n' +
        '- 如果有明确的时间/日期标注，保留原值\n' +
        '日常寒暄、闲聊不算事件。只看真正推动故事或关系发展、或揭示重要信息的关键时刻。\n' +
        '\n' +
        '## 9. 💫 情感与关系动态\n' +
        '追踪对话全程的情感起伏和关系变化：\n' +
        '- 情绪走势：整体情绪是高是低？有没有明显的情绪波动点（兴奋/低落/愤怒/感动）？\n' +
        '- 关系温度：用户和 AI 之间的距离是拉近还是推远？发生了什么导致变化？\n' +
        '- 信任度评估：用户是否越来越开放？有没有试探、防备、或卸下心防的迹象？\n' +
        '- 未说出口的东西：用户在回避什么话题？有什么想说但没说出口的迹象？\n' +
        '\n' +
        '## 10. 🔢 精确信息库\n' +
        '以下类型的信息必须原样保留，一字不改，不概括、不转述：\n' +
        '- 人名、地名、机构名、品牌名\n' +
        '- 网址、邮箱、账号、手机号、地址\n' +
        '- 日期、时间、金额、数量、坐标\n' +
        '- 代码、命令、文件名、路径、API key 格式的字符串\n' +
        '- 用户自己写的内容（如用户说"帮我把这段话改一下：..."，引号内的原文保留）\n' +
        '- 任何你拿不准要不要保留的事实性数据——保留\n' +
        '\n' +
        '═══ 编写铁律 ═══\n' +
        '1. 整合 > 搬运。你的输出应该是你理解消化后的重新叙述，而不是原文的分类重组\n' +
        '2. 详细 > 简洁。信息密度越高越好。你漏掉的信息等于被永久删除\n' +
        '3. 不准编造对话中不存在的信息，但可以从上下文合理推断隐含信息并标注"推测：..."\n' +
        '4. 用户自我描述类的原话尽量保留原文表述方式（口语、语气词不删）\n' +
        '5. 精确信息绝对原样保留，不概括不转述\n' +
        '6. 每部分必须写，完全没有相关内容写「暂无」\n' +
        '7. 输出纯文本，不要加"摘要""总结""以下是整合报告"之类的前缀或后缀\n' +
        '8. 以下内容可以忽略不记：纯寒暄（"早""晚安"）、无信息量的附和（"嗯""好的""哈哈"）、\n' +
        '   重复确认、已完成的临时查询（查完天气就过了的那种）\n' +
        '\n' +
        '═══ 对话记录 ═══\n' + transcript,
        [],
        '你是一位顶级的对话分析师。你有极强的信息整合能力——能从散乱的聊天记录中提取模式、发现关联、\n' +
        '构建出立体的用户画像和完整的叙事。你写出的记忆档案读起来像一篇精炼的人物传记片段，\n' +
        '而不是一堆分好类的笔记。用户信任你——你漏掉的信息，AI 就永远不知道了。' +
        '你对细节有执念，但不会被细节淹没；你总能找到背后的脉络。',
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

  if (!message || (Array.isArray(message) && message.length === 0)) {
    return new Response(JSON.stringify({ reply: '你好！有什么可以帮你的吗？😊' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const isDefault = body.isDefault === true;
  // Skip local keyword handlers when message is multimodal (contains file/image)
  const hasFile = body.file && body.file.data;
  const msg = hasFile ? '' : (typeof message === 'string' ? message.toLowerCase() : '');

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
  const systemPrompt = body.systemPrompt || '';

  // ---- DeepSeek for everything else ----
  try {
    const reply = await callDeepSeek(message, history, systemPrompt, unlocked, DEEPSEEK_KEY);
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
