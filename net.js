#!/usr/bin/env node
// net.js — 沙箱网络助手。
// 背景：沙箱里 curl 的 Schannel 拿不到 Windows 凭据（SEC_E_NO_CREDENTIALS），https 全部失败；
//       node 的 fetch 正常。本脚本直连优先，被墙/失败时自动改走本地代理（默认 http://127.0.0.1:10808，可用环境变量 GLM_PROXY 覆盖）。
// 用法:
//   node net.js <url>                            GET，响应体打 stdout，状态行打 stderr
//   node net.js <url> -o <文件>                  响应体存文件
//   node net.js <url> -p <代理地址>               强制走指定代理（http/https CONNECT 隧道）
//   node net.js -X POST <url> -d '<数据>' -H 'Content-Type: application/json' [-H 'K: V' ...]
'use strict';
const http = require('http');
const https = require('https');
const tls = require('tls');
const fs = require('fs');
const { URL } = require('url');

const DEFAULT_PROXY = process.env.GLM_PROXY || 'http://127.0.0.1:10808';
const DIRECT_TIMEOUT_MS = 8000;

function parseArgs(argv) {
  const out = { url: null, output: null, proxy: null, method: 'GET', data: null, headers: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-o') out.output = argv[++i];
    else if (a === '-p' || a === '--proxy') out.proxy = argv[++i];
    else if (a === '-X' || a === '--method') out.method = (argv[++i] || 'GET').toUpperCase();
    else if (a === '-d' || a === '--data') out.data = argv[++i];
    else if (a === '-H' || a === '--header') {
      const h = argv[++i] || '';
      const idx = h.indexOf(':');
      if (idx > 0) out.headers[h.slice(0, idx).trim()] = h.slice(idx + 1).trim();
    }
    else if (!a.startsWith('-')) out.url = a;
  }
  return out;
}

/** 通过 HTTP 代理（CONNECT 隧道）发请求，支持 http/https。 */
function httpViaProxy(target, proxyUrl, method, headers, data) {
  return new Promise((resolve, reject) => {
    const proxy = new URL(proxyUrl);
    const port = target.port || (target.protocol === 'https:' ? 443 : 80);
    const connectReq = http.request({
      host: proxy.hostname,
      port: proxy.port,
      method: 'CONNECT',
      path: `${target.hostname}:${port}`
    });
    connectReq.on('connect', (res, socket) => {
      if (res.statusCode !== 200) { socket.destroy(); reject(new Error(`代理 CONNECT 失败: HTTP ${res.statusCode}`)); return; }
      const setup = (rawSocket) => {
        const lib = target.protocol === 'https:' ? https : http;
        const req = lib.request({
          createConnection: () => rawSocket,
          host: target.hostname,
          port,
          path: target.pathname + target.search,
          method,
          headers
        }, (resp) => resolve(resp));
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
      };
      if (target.protocol === 'https:') {
        const tlsSocket = tls.connect({ socket, servername: target.hostname }, () => setup(tlsSocket));
        tlsSocket.on('error', reject);
      } else setup(socket);
    });
    connectReq.on('error', reject);
    connectReq.end();
  });
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (!o.url) throw new Error('用法: node net.js <url> [-o 文件] [-p 代理] [-X POST -d 数据 -H "K: V"]');
  const target = new URL(o.url);
  let resp;

  if (o.proxy) {
    console.error(`[net] 走代理 ${o.proxy}`);
    resp = await httpViaProxy(target, o.proxy, o.method, o.headers, o.data);
  } else {
    try {
      resp = await fetch(o.url, { method: o.method, headers: o.headers, body: o.data, signal: AbortSignal.timeout(DIRECT_TIMEOUT_MS) });
    } catch {
      console.error(`[net] 直连失败(${o.url})，自动改走代理 ${DEFAULT_PROXY}`);
      resp = await httpViaProxy(target, DEFAULT_PROXY, o.method, o.headers, o.data);
    }
  }

  const body = typeof resp.arrayBuffer === "function"
    ? Buffer.from(await resp.arrayBuffer())
    : await new Promise((resolve, reject) => {
        const chunks = [];
        resp.on("data", (c) => chunks.push(c));
        resp.on("end", () => resolve(Buffer.concat(chunks)));
        resp.on("error", reject);
      });
  const status = resp.status ?? resp.statusCode;
  console.error(`[net] ${status} ${resp.statusText ?? resp.statusMessage ?? ""} ${body.length}B`);
  if (o.output) fs.writeFileSync(o.output, body);
  else process.stdout.write(body);
  const ok = resp.ok ?? (status >= 200 && status < 300);
  if (!ok) process.exitCode = 1;
}

main().catch((e) => { console.error('错误:', e.message); process.exitCode = 1; });
