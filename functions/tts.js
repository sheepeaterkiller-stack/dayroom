// Edge TTS proxy — Microsoft free "Read Aloud" API, no API key needed
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WS_URL = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;

function buildSSML(text, voice) {
  const safe = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="zh-CN"><voice name="${voice}"><prosody rate="1.0" pitch="+0Hz">${safe}</prosody></voice></speak>`;
}

async function synthesize(text, voice) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const audioChunks = [];
    let timer = setTimeout(() => {
      try { ws.close(); } catch (e) { /* ignore */ }
      reject(new Error('TTS timeout'));
    }, 20000);

    ws.onopen = () => {
      // 1) Send config
      const configMsg = [
        `X-Timestamp:${new Date().toISOString()}`,
        'Content-Type:application/json; charset=utf-8',
        'Path:speech.config',
        '',
        JSON.stringify({ context: { synthesis: { audio: { metadataoptions: { sentenceBoundaryEnabled: false, wordBoundaryEnabled: false }, outputFormat: 'audio-24khz-48kbitrate-mono-mp3' } } } }),
      ].join('\r\n');
      ws.send(configMsg);

      // 2) Send SSML
      const ssml = buildSSML(text, voice);
      const reqId = crypto.randomUUID();
      const ssmlMsg = [
        `X-RequestId:${reqId}`,
        'Content-Type:application/ssml+xml',
        'Path:ssml',
        '',
        ssml,
      ].join('\r\n');
      ws.send(ssmlMsg);
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') return; // skip text frames
      if (!(event.data instanceof ArrayBuffer)) return;

      const data = new Uint8Array(event.data);
      // Find header boundary: \r\n\r\n
      let headerEnd = -1;
      for (let i = 0; i < data.length - 3; i++) {
        if (data[i] === 13 && data[i + 1] === 10 && data[i + 2] === 13 && data[i + 3] === 10) {
          headerEnd = i + 4;
          break;
        }
      }
      if (headerEnd === -1 || headerEnd >= data.length) return;

      const headerStr = new TextDecoder().decode(data.slice(0, headerEnd));

      if (headerStr.includes('Path:audio') && data.length > headerEnd) {
        audioChunks.push(data.slice(headerEnd));
      }

      if (headerStr.includes('Path:turn.end')) {
        clearTimeout(timer);
        // Concatenate all MP3 frames
        const total = audioChunks.reduce((s, c) => s + c.length, 0);
        const combined = new Uint8Array(total);
        let off = 0;
        for (const c of audioChunks) { combined.set(c, off); off += c.length; }
        ws.close();
        resolve(combined.buffer);
      }
    };

    ws.onerror = () => { clearTimeout(timer); reject(new Error('WebSocket error')); };
    ws.onclose = () => {
      clearTimeout(timer);
      if (audioChunks.length > 0) {
        const total = audioChunks.reduce((s, c) => s + c.length, 0);
        const combined = new Uint8Array(total);
        let off = 0;
        for (const c of audioChunks) { combined.set(c, off); off += c.length; }
        resolve(combined.buffer);
      } else {
        reject(new Error('Connection closed with no audio'));
      }
    };
  });
}

export async function onRequest(context) {
  const { request } = context;

  // CORS preflight for cross-origin requests from Pages
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await request.json();
    const text = (body.text || '').trim();
    const voice = body.voice || 'zh-CN-YunxiNeural';

    if (!text) {
      return new Response(JSON.stringify({ error: 'Empty text' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const audioBuffer = await synthesize(text, voice);

    return new Response(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (e) {
    console.error('TTS error:', e.message);
    return new Response(JSON.stringify({ error: e.message || 'TTS failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
