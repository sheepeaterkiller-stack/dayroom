#!/usr/bin/env node
// vision.js — 看图工具（DeepSeek 原生视觉）
//
// 用法: node vision.js <图片路径...> [-p|--prompt "问题"] [--think]
//
// 引擎: DeepSeek `deepseek-flash`（即 V4.1 Flash，原生多模态，实测可直接读图）
//   Key 读取顺序: 环境变量 DEEPSEEK_API_KEY → ~/.dsh/.credentials.yaml
// --think 开启思考模式（更慢更贵，分析复杂图表时再用；默认关闭）
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

function readKey() {
  if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY.trim();
  try {
    const txt = fs.readFileSync(path.join(os.homedir(), '.dsh', '.credentials.yaml'), 'utf8');
    const m = txt.match(/DEEPSEEK_API_KEY:\s*(\S+)/);
    if (m) return m[1].replace(/^["']|["']$/g, '').trim();
  } catch { /* 读不到就走下面的报错 */ }
  return '';
}

// 附件文件没有扩展名，按文件头识别图片类型
function mimeOf(buf) {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 6 && (buf.toString('ascii', 0, 6) === 'GIF89a' || buf.toString('ascii', 0, 6) === 'GIF87a')) return 'image/gif';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buf.length >= 2 && buf[0] === 0x42 && buf[1] === 0x4d) return 'image/bmp';
  return 'image/png';
}

function parseArgs(argv) {
  const images = [];
  let prompt = '请详细描述这张图片的内容。';
  let think = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-p' || a === '--prompt') prompt = argv[++i] ?? prompt;
    else if (a === '--think') think = true;
    else images.push(a);
  }
  return { images, prompt, think };
}

async function main() {
  const { images, prompt, think } = parseArgs(process.argv.slice(2));
  if (!images.length) throw new Error('用法: node vision.js <图片路径...> [-p "问题"] [--think]');

  const key = readKey();
  if (!key) throw new Error('找不到 DeepSeek Key（设 DEEPSEEK_API_KEY 环境变量，或确认 ~/.dsh/.credentials.yaml 里有）');

  const content = [];
  for (const img of images) {
    let buf;
    try { buf = fs.readFileSync(img); } catch (e) { throw new Error(`无法读取 ${img}: ${e.message}`); }
    content.push({ type: 'image_url', image_url: { url: `data:${mimeOf(buf)};base64,${buf.toString('base64')}` } });
  }
  content.push({ type: 'text', text: prompt });

  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'deepseek-flash', // = V4.1 Flash，原生多模态
      messages: [{ role: 'user', content }],
      max_tokens: 4096,
      thinking: think ? { type: 'enabled' } : { type: 'disabled' },
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || (data && data.error)) {
    const detail = data && data.error ? JSON.stringify(data.error) : JSON.stringify(data);
    throw new Error(`API 错误 HTTP ${res.status}: ${detail}`);
  }
  const msg = data?.choices?.[0]?.message;
  console.log(msg?.content || '(模型返回了空内容)');
}

main().catch((e) => { console.error('错误:', e.message); process.exitCode = 1; });
