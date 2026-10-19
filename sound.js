/*!
 * dayroom — 声音空间 (SoundSpace)
 * Web Audio API 驱动的程序化微交互音效与环境白噪音混音台
 * 100% 纯数学计算与滤波器实时合成 · 零外部音频文件加载
 */

(function () {
  'use strict';

  // ========== 状态存储与初始化配置 ==========
  const STORAGE_KEY_ENABLED = 'dayroom_sound_enabled';
  const STORAGE_KEY_HAPTICS = 'dayroom_sound_haptics';
  const STORAGE_KEY_VOL_TIDE = 'dayroom_sound_vol_tide';
  const STORAGE_KEY_VOL_CRACKLE = 'dayroom_sound_vol_crackle';
  const STORAGE_KEY_VOL_DRONE = 'dayroom_sound_vol_drone';

  let audioCtx = null;
  let isPoweredOn = false;
  let hapticsEnabled = true;
  let isMuffled = false; // "隔壁房间"失焦状态
  let isManualMuffled = false; // "隔壁房间"手动体验状态
  let targetCutoff = 18000;
  let visualCutoff = 18000;
  let isDrawerOpen = false;

  // 轨道音量 (0 ~ 1)
  let volTide = 0.50;
  let volCrackle = 0.15;
  let volDrone = 0.35;

  // Web Audio 节点引用
  let masterGain = null;
  let masterMuffleFilter = null;
  let masterAnalyser = null;
  let mixerBusGain = null;
  let hapticsGain = null;

  let tideNodes = null;
  let crackleNodes = null;
  let crackleTimer = null;
  let droneNodes = null;
  let visualAnimId = null;
  let scopeAnimId = null;
  let scopeCanvas = null;
  let scopeCtx = null;
  let wavePhase = 0;
  let currentVisualAmp = 0;
  let crackleVisualEnergy = 0;

  // 示波器粒子与波纹池
  const scopeParticles = [];
  const scopeRipples = [];

  // 节流与微随机缓存
  let lastHoverTime = 0;

  // ========== 安全获取/唤醒 AudioContext ==========
  function getContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // ========== 通电与断电仪式音效 ==========
  function playPowerOnClick(ctx, targetGain) {
    try {
      const now = ctx.currentTime;
      // 1. 机械触点脆响 (Switch Snap)
      const snapOsc = ctx.createOscillator();
      const snapFilter = ctx.createBiquadFilter();
      const snapGain = ctx.createGain();

      snapOsc.type = 'triangle';
      snapOsc.frequency.setValueAtTime(1750, now);
      snapOsc.frequency.exponentialRampToValueAtTime(320, now + 0.012);

      snapFilter.type = 'bandpass';
      snapFilter.frequency.setValueAtTime(1500, now);
      snapFilter.Q.setValueAtTime(3.5, now);

      snapGain.gain.setValueAtTime(0.09, now);
      snapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);

      snapOsc.connect(snapFilter);
      snapFilter.connect(snapGain);
      snapGain.connect(targetGain);

      snapOsc.start(now);
      snapOsc.stop(now + 0.02);

      // 2. 胆机通电温暖低频底噪缓慢浮现 (Vintage Tube Warm-up Hum)
      const humOsc1 = ctx.createOscillator();
      const humOsc2 = ctx.createOscillator();
      const humGain = ctx.createGain();

      humOsc1.type = 'sine';
      humOsc1.frequency.setValueAtTime(58, now); // ~60Hz 交流声变奏
      humOsc2.type = 'sine';
      humOsc2.frequency.setValueAtTime(116, now); // 二次谐波

      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.3, now);
      humOsc2.connect(subGain);
      subGain.connect(humGain);
      humOsc1.connect(humGain);

      humGain.gain.setValueAtTime(0.0001, now);
      humGain.gain.linearRampToValueAtTime(0.07, now + 0.35);
      humGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);

      humGain.connect(targetGain);

      humOsc1.start(now);
      humOsc2.start(now);
      humOsc1.stop(now + 1.0);
      humOsc2.stop(now + 1.0);
    } catch (e) {
      console.warn('[SoundSpace] Power-on sound error', e);
    }
  }

  // ========== 第一层声场：微交互音效 ==========

  // 1. 防听觉疲劳的“微随机”悬停 (Anti-fatigue Hover Particle)
  function playHoverParticle() {
    if (!isPoweredOn || !hapticsEnabled || isMuffled) return;
    const nowMs = performance.now();
    if (nowMs - lastHoverTime < 32) return; // 限频防抖，避免刺耳堆叠
    lastHoverTime = nowMs;

    try {
      const ctx = getContext();
      const now = ctx.currentTime;

      // 基础频率 1380Hz，在 ±4% 范围内微随机浮动
      const jitter = 1 + (Math.random() - 0.5) * 0.08;
      const freq = 1380 * jitter;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      // 微小的极速下潜滑音，形成水滴落水清脆质感
      osc.frequency.exponentialRampToValueAtTime(freq * 0.85, now + 0.012);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.038, now + 0.001); // 1ms 极速 Attack
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.013); // 12ms 快速释放

      osc.connect(gain);
      gain.connect(hapticsGain || ctx.destination);

      osc.start(now);
      osc.stop(now + 0.016);
    } catch (e) {}
  }

  // 2. 双阶段按压感 (Dual-stage Click)
  function playClickHaptic() {
    if (!isPoweredOn || !hapticsEnabled || isMuffled) return;
    try {
      const ctx = getContext();
      const now = ctx.currentTime;

      // Stage 1: 触底脆音 (Downstroke: 820Hz, 8ms)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(860, now);
      osc1.frequency.exponentialRampToValueAtTime(380, now + 0.008);

      gain1.gain.setValueAtTime(0.06, now);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.01);

      osc1.connect(gain1);
      gain1.connect(hapticsGain || ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.012);

      // Stage 2: 回弹微弱尾音 (Upstroke: 440Hz, 间隔 28ms 触发，质感微闷)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      const upTime = now + 0.028;

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(440, upTime);
      gain2.gain.setValueAtTime(0.0001, upTime);
      gain2.gain.linearRampToValueAtTime(0.025, upTime + 0.002);
      gain2.gain.exponentialRampToValueAtTime(0.0001, upTime + 0.015);

      osc2.connect(gain2);
      gain2.connect(hapticsGain || ctx.destination);
      osc2.start(upTime);
      osc2.stop(upTime + 0.018);
    } catch (e) {}
  }

  // 3. 昼夜切换“声学窗帘” (Acoustic Curtain Filter Sweep)
  function playAcousticCurtain(isDay) {
    if (!isPoweredOn) return;
    try {
      const ctx = getContext();
      const now = ctx.currentTime;

      if (!isDay) {
        // 切入暗黑模式：高频在 0.4s 内收拢变闷，伴随天鹅绒窗帘闭合气流感
        const sweepFilter = ctx.createBiquadFilter();
        sweepFilter.type = 'lowpass';
        sweepFilter.frequency.setValueAtTime(16000, now);
        sweepFilter.frequency.exponentialRampToValueAtTime(800, now + 0.38);

        // 柔和微气流声
        const bufferSize = ctx.sampleRate * 0.4;
        const buf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buf.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99 * b0 + white * 0.05;
          b1 = 0.96 * b1 + white * 0.11;
          b2 = 0.86 * b2 + white * 0.25;
          data[i] = (b0 + b1 + b2) * 0.35;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buf;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.035, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);

        noise.connect(sweepFilter);
        sweepFilter.connect(gain);
        gain.connect(masterGain || ctx.destination);
        noise.start(now);
      } else {
        // 切回明亮模式：清亮晨曦初现，低通滤波器敞开，伴随 1318Hz (E6) 空灵高泛音
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1318.5, now);
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.35);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.03, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

        osc.connect(gain);
        gain.connect(masterGain || ctx.destination);
        osc.start(now);
        osc.stop(now + 0.45);
      }
    } catch (e) {}
  }

  // ========== 示波器粒子与波纹生成辅助 ==========
  function addScopeParticle(x, y, color) {
    if (scopeParticles.length > 40) scopeParticles.shift();
    const w = (scopeCanvas && scopeCanvas.clientWidth) ? scopeCanvas.clientWidth : 740;
    const h = (scopeCanvas && scopeCanvas.clientHeight) ? scopeCanvas.clientHeight : 240;
    const midY = h * 0.46;
    scopeParticles.push({
      x: x !== undefined ? x : (Math.random() * w),
      y: y !== undefined ? y : (midY * 0.5 + (Math.random() - 0.5) * 50),
      vx: (Math.random() - 0.5) * 1.0,
      vy: -0.2 - Math.random() * 0.6,
      radius: 1.8 + Math.random() * 2.5,
      alpha: 1.0,
      decay: 0.015 + Math.random() * 0.02,
      color: color || '#fbbf24'
    });
  }

  function addScopeRipple(x, y) {
    if (scopeRipples.length > 8) scopeRipples.shift();
    const w = (scopeCanvas && scopeCanvas.clientWidth) ? scopeCanvas.clientWidth : 740;
    const h = (scopeCanvas && scopeCanvas.clientHeight) ? scopeCanvas.clientHeight : 240;
    const midY = h * 0.46;
    scopeRipples.push({
      x: x !== undefined ? x : ((0.2 + Math.random() * 0.6) * w),
      y: y !== undefined ? y : (midY * 0.52),
      r: 3,
      maxR: 55,
      alpha: 1.0
    });
  }

  // ========== 第二层声场：三轨程序化白噪音混音台 ==========

  // 轨道 1：暖色基底 (Warm Tide) — 布朗噪音 + 11s 周期 LFO 低通摇曳
  function createWarmTide(ctx, destination) {
    // 5 秒无缝环形布朗噪音缓冲区
    const length = ctx.sampleRate * 5;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.4;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    // 二阶低通滤波，基准频率 420Hz
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, ctx.currentTime);
    filter.Q.setValueAtTime(1.4, ctx.currentTime);

    // LFO 超低频正弦摇晃 (周期 ~11.5 秒，频率 ~0.087Hz)
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.087, ctx.currentTime);

    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(200, ctx.currentTime); // 截止频率在 220Hz ~ 620Hz 间起伏

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volTide * 0.16, ctx.currentTime);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(destination);

    source.start();
    lfo.start();

    return { source, filter, lfo, gain };
  }

  // 轨道 2：有机颗粒 (Organic Crackle) — 泊松随机脉冲 (木柴噼啪 ↔ 窗外落雨)
  function startOrganicCrackle(ctx, destination) {
    const crackleGain = ctx.createGain();
    crackleGain.gain.setValueAtTime(volCrackle * 0.18, ctx.currentTime);
    crackleGain.connect(destination);

    // 采用高谐振带通滤波器群
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.connect(crackleGain);

    function scheduleCracklePulses() {
      if (!isPoweredOn || volCrackle <= 0.01) return;
      const now = ctx.currentTime;
      const windowDuration = 0.12; // 调度接下来的 120ms

      // 根据滑块值动态调控密度与频段
      // volCrackle: 0~0.5 偏向篝火木柴，0.5~1.0 偏向细密雨声
      const isRainMode = volCrackle > 0.45;
      const density = isRainMode 
        ? Math.floor(12 + (volCrackle - 0.45) * 55) 
        : Math.floor(2 + volCrackle * 14);

      const centerFreq = isRainMode ? 2400 : 1350;
      filter.frequency.setTargetAtTime(centerFreq, now, 0.05);
      filter.Q.setTargetAtTime(isRainMode ? 3.5 : 8.0, now, 0.05);

      if (isDrawerOpen) {
        crackleVisualEnergy = Math.min(1.0, crackleVisualEnergy + 0.6);
        const pCount = Math.min(3, Math.ceil(density / 6));
        for (let k = 0; k < pCount; k++) {
          addScopeParticle(
            undefined,
            undefined,
            isRainMode ? '#38bdf8' : (Math.random() > 0.4 ? '#fbbf24' : '#34d399')
          );
        }
      }

      for (let i = 0; i < density; i++) {
        const offset = Math.random() * windowDuration;
        const pulseTime = now + offset;
        const osc = ctx.createOscillator();
        const pGain = ctx.createGain();

        // 脉冲音色微随机
        const pFreq = centerFreq * (0.7 + Math.random() * 0.6);
        osc.type = Math.random() > 0.4 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(pFreq, pulseTime);

        // 篝火模式偶有大爆破声，雨水模式细密均匀
        const amp = isRainMode 
          ? (0.015 + Math.random() * 0.025)
          : (Math.random() < 0.15 ? 0.08 : 0.02 + Math.random() * 0.03);

        const duration = isRainMode ? 0.003 : (0.004 + Math.random() * 0.004);

        pGain.gain.setValueAtTime(amp, pulseTime);
        pGain.gain.exponentialRampToValueAtTime(0.0001, pulseTime + duration);

        osc.connect(pGain);
        pGain.connect(filter);

        osc.start(pulseTime);
        osc.stop(pulseTime + duration + 0.002);
      }
    }

    crackleTimer = setInterval(scheduleCracklePulses, 100);
    return { gain: crackleGain, filter };
  }

  // 轨道 3：漂移垫音 (Ambient Drone) — 微调偏音五度与大七度悬留和弦 (D2/A2/C#3)
  function createAmbientDrone(ctx, destination) {
    const droneGain = ctx.createGain();
    droneGain.gain.setValueAtTime(volDrone * 0.05, ctx.currentTime);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, ctx.currentTime);
    filter.Q.setValueAtTime(1.0, ctx.currentTime);

    // 三个微调偏音振荡器
    const osc1 = ctx.createOscillator(); // 根音 D2 (73.42Hz)
    const osc2 = ctx.createOscillator(); // 五度 A2 (110.00Hz, +2.2 cents)
    const osc3 = ctx.createOscillator(); // 大七度 C#3 (138.59Hz, -2.8 cents)

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(73.42, ctx.currentTime);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(110.00, ctx.currentTime);
    osc2.detune.setValueAtTime(2.2, ctx.currentTime);

    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(138.59, ctx.currentTime);
    osc3.detune.setValueAtTime(-2.8, ctx.currentTime);

    const g1 = ctx.createGain(); g1.gain.value = 0.5;
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    const g3 = ctx.createGain(); g3.gain.value = 0.25;

    osc1.connect(g1); g1.connect(filter);
    osc2.connect(g2); g2.connect(filter);
    osc3.connect(g3); g3.connect(filter);

    filter.connect(droneGain);
    droneGain.connect(destination);

    osc1.start();
    osc2.start();
    osc3.start();

    return { osc1, osc2, osc3, filter, gain: droneGain };
  }

  // ========== 音频拓扑初始化与启停 ==========
  function startAudioEngine() {
    const ctx = getContext();

    // 1. 母带与总线
    masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(1.0, ctx.currentTime);

    // 2. "隔壁房间"低通滤波器 (Master Muffle Filter)
    const effectiveMuffled = isMuffled || isManualMuffled;
    targetCutoff = effectiveMuffled ? 360 : 18000;
    masterMuffleFilter = ctx.createBiquadFilter();
    masterMuffleFilter.type = 'lowpass';
    masterMuffleFilter.frequency.setValueAtTime(targetCutoff, ctx.currentTime);
    masterMuffleFilter.Q.setValueAtTime(0.8, ctx.currentTime);

    // 3. 实时分析器 (用于微动效与示波器/频谱绘制)
    masterAnalyser = ctx.createAnalyser();
    masterAnalyser.fftSize = 1024; // 512 frequency bins, 1024 time-domain samples
    masterAnalyser.smoothingTimeConstant = 0.82;

    // 4. 混音台母线与微交互母线
    mixerBusGain = ctx.createGain();
    mixerBusGain.gain.setValueAtTime(1.0, ctx.currentTime);

    hapticsGain = ctx.createGain();
    hapticsGain.gain.setValueAtTime(1.0, ctx.currentTime);

    // 拓扑连接:
    // [三轨白噪音] -> mixerBusGain -> masterMuffleFilter -> masterGain -> masterAnalyser -> destination
    // [微动效音效] -> hapticsGain -> masterGain
    mixerBusGain.connect(masterMuffleFilter);
    masterMuffleFilter.connect(masterGain);
    hapticsGain.connect(masterGain);

    masterGain.connect(masterAnalyser);
    masterAnalyser.connect(ctx.destination);

    // 触发通电仪式
    playPowerOnClick(ctx, masterGain);

    // 启动三轨合成器
    tideNodes = createWarmTide(ctx, mixerBusGain);
    crackleNodes = startOrganicCrackle(ctx, mixerBusGain);
    droneNodes = createAmbientDrone(ctx, mixerBusGain);

    // 启动波形微动效循环
    startWaveAnimation();

    // 若当前抽屉正展开，立即启动 Canvas 示波器渲染
    if (isDrawerOpen) {
      startScopeVisualizer();
    }
  }

  function stopAudioEngine() {
    if (crackleTimer) {
      clearInterval(crackleTimer);
      crackleTimer = null;
    }
    crackleNodes = null;
    if (tideNodes) {
      try { tideNodes.source.stop(); tideNodes.lfo.stop(); } catch (e) {}
      tideNodes = null;
    }
    if (droneNodes) {
      try { droneNodes.osc1.stop(); droneNodes.osc2.stop(); droneNodes.osc3.stop(); } catch (e) {}
      droneNodes = null;
    }
    if (visualAnimId) {
      cancelAnimationFrame(visualAnimId);
      visualAnimId = null;
    }
    if (!isDrawerOpen) {
      stopScopeVisualizer();
    }
    if (audioCtx && audioCtx.state !== 'closed') {
      try { audioCtx.suspend(); } catch (e) {}
    }
  }

  // ========== 程序化纯声学水滴 (Acoustic Water Droplet) ==========
  function playWaterDroplet() {
    if (!isPoweredOn) {
      togglePower();
    }
    try {
      const ctx = getContext();
      const now = ctx.currentTime;

      // 下潜扫频正弦粒子
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1750, now);
      osc.frequency.exponentialRampToValueAtTime(740, now + 0.055);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1180, now);
      filter.Q.setValueAtTime(8.5, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(hapticsGain || masterGain || ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);

      // 在示波器 Canvas 激荡水滴波纹与微粒子
      addScopeRipple();
      addScopeParticle(undefined, undefined, '#38bdf8');
    } catch (e) {}
  }

  // ========== "隔壁房间"低通滤波状态控制 ==========
  function handleFocusChange(blurred) {
    if (!isPoweredOn || !masterMuffleFilter || !audioCtx) return;
    isMuffled = blurred;
    updateMuffleState();
  }

  function toggleManualMuffle() {
    if (!isPoweredOn) togglePower();
    isManualMuffled = !isManualMuffled;
    updateMuffleState();
    playClickHaptic();
  }

  function updateMuffleState() {
    if (!masterMuffleFilter || !audioCtx) return;
    const now = audioCtx.currentTime;
    const effectiveMuffled = isMuffled || isManualMuffled;

    const muffleBtn = document.getElementById('sdBtnToggleMuffle');
    const muffleBtnText = document.getElementById('sdMuffleBtnText');
    const badge = document.getElementById('sdStateBadge');

    if (effectiveMuffled) {
      targetCutoff = 360;
      masterMuffleFilter.frequency.cancelScheduledValues(now);
      masterMuffleFilter.frequency.setTargetAtTime(360, now, 0.22);
      if (muffleBtn) muffleBtn.classList.add('active');
      if (muffleBtnText) muffleBtnText.textContent = '推开房门 (恢复通透)';
      if (badge) badge.textContent = '隔壁房间';
    } else {
      targetCutoff = 18000;
      masterMuffleFilter.frequency.cancelScheduledValues(now);
      masterMuffleFilter.frequency.setTargetAtTime(18000, now, 0.22);
      if (muffleBtn) muffleBtn.classList.remove('active');
      if (muffleBtnText) muffleBtnText.textContent = '切换至: 隔壁房间 (切换失焦)';
      if (badge) badge.textContent = isPoweredOn ? '沉浸中' : '静音中';
    }
  }

  // ========== 治愈配方预设切换 (Curated Recipes) ==========
  const PRESETS = {
    rain: { tide: 0.70, crackle: 0.65, drone: 0.20 },
    hearth: { tide: 0.35, crackle: 0.45, drone: 0.40 },
    space: { tide: 0.20, crackle: 0.10, drone: 0.75 },
    ocean: { tide: 0.85, crackle: 0.20, drone: 0.30 },
    focus: { tide: 0.50, crackle: 0.15, drone: 0.35 }
  };

  function applyPreset(name) {
    const p = PRESETS[name];
    if (!p) return;
    if (!isPoweredOn) togglePower();

    volTide = p.tide;
    volCrackle = p.crackle;
    volDrone = p.drone;

    localStorage.setItem(STORAGE_KEY_VOL_TIDE, volTide.toString());
    localStorage.setItem(STORAGE_KEY_VOL_CRACKLE, volCrackle.toString());
    localStorage.setItem(STORAGE_KEY_VOL_DRONE, volDrone.toString());

    const now = audioCtx ? audioCtx.currentTime : 0;
    if (tideNodes && audioCtx) {
      tideNodes.gain.gain.setTargetAtTime(volTide * 0.16, now, 0.22);
    }
    if (crackleNodes && audioCtx) {
      crackleNodes.gain.gain.setTargetAtTime(volCrackle * 0.18, now, 0.22);
    }
    if (droneNodes && audioCtx) {
      droneNodes.gain.gain.setTargetAtTime(volDrone * 0.05, now, 0.22);
    }

    const sliderTide = document.getElementById('sdTrackTide');
    const sliderCrackle = document.getElementById('sdTrackCrackle');
    const sliderDrone = document.getElementById('sdTrackDrone');
    const valTide = document.getElementById('sdValTide');
    const valCrackle = document.getElementById('sdValCrackle');
    const valDrone = document.getElementById('sdValDrone');

    if (sliderTide) sliderTide.value = Math.round(volTide * 100);
    if (sliderCrackle) sliderCrackle.value = Math.round(volCrackle * 100);
    if (sliderDrone) sliderDrone.value = Math.round(volDrone * 100);

    if (valTide) valTide.textContent = Math.round(volTide * 100) + '%';
    if (valCrackle) valCrackle.textContent = Math.round(volCrackle * 100) + '%';
    if (valDrone) valDrone.textContent = Math.round(volDrone * 100) + '%';

    document.querySelectorAll('.sd-preset-pill').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-preset') === name);
    });

    playClickHaptic();
  }

  // ========== 专业级声学示波器与对数频谱 Canvas 引擎 ==========
  function initScopeCanvas() {
    scopeCanvas = document.getElementById('sdScopeCanvas');
    if (!scopeCanvas) return;
    scopeCtx = scopeCanvas.getContext('2d');
    resizeScopeCanvas();
    window.addEventListener('resize', resizeScopeCanvas);
  }

  function resizeScopeCanvas() {
    if (!scopeCanvas || !scopeCtx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = scopeCanvas.clientWidth || 740;
    const h = scopeCanvas.clientHeight || 240;
    scopeCanvas.width = Math.round(w * dpr);
    scopeCanvas.height = Math.round(h * dpr);
    scopeCtx.setTransform(1, 0, 0, 1, 0, 0);
    scopeCtx.scale(dpr, dpr);
  }

  function startScopeVisualizer() {
    if (scopeAnimId) return;
    const timeData = new Uint8Array(1024);
    const freqData = new Uint8Array(512);

    const lfoReadoutEl = document.getElementById('sdLfoReadout');
    const cutoffReadoutEl = document.getElementById('sdCutoffReadout');

    function drawScope() {
      if (!isDrawerOpen || !scopeCanvas || !scopeCtx) {
        scopeAnimId = null;
        return;
      }

      // 动态比对分辨率以防缩放/过渡期间像素失真与拉伸模糊
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = scopeCanvas.clientWidth || 740;
      const h = scopeCanvas.clientHeight || 240;
      const expectedW = Math.round(w * dpr);
      const expectedH = Math.round(h * dpr);

      if (scopeCanvas.width !== expectedW || scopeCanvas.height !== expectedH) {
        scopeCanvas.width = expectedW;
        scopeCanvas.height = expectedH;
        scopeCtx.setTransform(1, 0, 0, 1, 0, 0);
        scopeCtx.scale(dpr, dpr);
      }

      const isDay = document.documentElement.getAttribute('data-theme') === 'day';
      const bgColor = isDay ? '#e2e8f0' : '#07090d';
      const waveColor = isDay ? '#0284c7' : '#38bdf8';
      const dividerColor = isDay ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)';

      const midY = h * 0.46; // 上下动态分界中轴线

      // 0. 全局视觉振幅阻尼插值 (开机 0.3s 平滑抬升，暂停 0.3s 平滑归零休眠)
      currentVisualAmp += ((isPoweredOn ? 1.0 : 0.0) - currentVisualAmp) * 0.12;
      if (!isPoweredOn && currentVisualAmp < 0.003) {
        currentVisualAmp = 0;
      }

      // 有机颗粒视觉涟漪能量衰减 (400ms~600ms 柔和放慢消散，突显视觉效果)
      crackleVisualEnergy *= 0.96;
      if (crackleVisualEnergy < 0.004) crackleVisualEnergy = 0;

      // 1. 清空画布
      scopeCtx.clearRect(0, 0, w, h);
      scopeCtx.fillStyle = bgColor;
      scopeCtx.fillRect(0, 0, w, h);

      // 2. 截止频率平滑插值与文字更新
      visualCutoff += (targetCutoff - visualCutoff) * 0.12;
      if (cutoffReadoutEl) {
        cutoffReadoutEl.textContent = `Filter Cutoff: ${Math.round(visualCutoff).toLocaleString()} Hz`;
      }
      if (lfoReadoutEl) {
        lfoReadoutEl.textContent = isPoweredOn 
          ? `LFO 潮汐调制: 0.087 Hz (呼吸 ${volTide > 0 ? Math.round(volTide * 100) + '%' : '静音'})`
          : 'LFO 潮汐调制: 已静音暂停 (待机)';
      }

      // 获取实时音频数据
      if (masterAnalyser && isPoweredOn) {
        masterAnalyser.getByteTimeDomainData(timeData);
        masterAnalyser.getByteFrequencyData(freqData);
      } else {
        timeData.fill(128);
        freqData.fill(0);
      }

      // ================= 中轴参考分界线 =================
      scopeCtx.save();
      scopeCtx.strokeStyle = dividerColor;
      scopeCtx.lineWidth = 1;
      scopeCtx.beginPath();
      scopeCtx.moveTo(0, midY);
      scopeCtx.lineTo(w, midY);
      scopeCtx.stroke();
      scopeCtx.restore();

      // ================= 1. 上半部：水滴波纹 (Ripples) =================
      scopeCtx.save();
      for (let i = scopeRipples.length - 1; i >= 0; i--) {
        const rip = scopeRipples[i];
        scopeCtx.beginPath();
        scopeCtx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
        scopeCtx.strokeStyle = isDay 
          ? `rgba(2, 132, 199, ${rip.alpha * 0.75})` 
          : `rgba(56, 189, 248, ${rip.alpha * 0.85})`;
        scopeCtx.lineWidth = 1.5;
        scopeCtx.stroke();
        rip.r += 1.8;
        rip.alpha -= 0.024;
        if (rip.alpha <= 0.01 || rip.r >= rip.maxR) {
          scopeRipples.splice(i, 1);
        }
      }

      // ================= 2. 上半部：有机微颗粒 (Crackle Particles) =================
      for (let i = scopeParticles.length - 1; i >= 0; i--) {
        const p = scopeParticles[i];
        scopeCtx.beginPath();
        scopeCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        scopeCtx.fillStyle = p.color;
        scopeCtx.globalAlpha = Math.max(0, p.alpha);
        if (!isDay) {
          scopeCtx.shadowColor = p.color;
          scopeCtx.shadowBlur = 6;
        }
        scopeCtx.fill();
        scopeCtx.globalAlpha = 1.0;
        scopeCtx.shadowBlur = 0;

        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        if (p.alpha <= 0.01) {
          scopeParticles.splice(i, 1);
        }
      }
      scopeCtx.restore();

      // ================= 3. 上半部：时域合成波形 (三轨视觉特征全量融合 + 阻尼平息) =================
      scopeCtx.save();
      scopeCtx.beginPath();
      const numWavePoints = 256;
      const sliceWidth = w / (numWavePoints - 1);
      if (currentVisualAmp > 0.001) {
        wavePhase += isPoweredOn ? 0.024 : 0.008;
      }

      for (let i = 0; i < numWavePoints; i++) {
        let yOffset = 0;
        if (currentVisualAmp > 0.001) {
          const sampleIdx = Math.floor((i / numWavePoints) * (timeData.length - 1));
          const v = (timeData[sampleIdx] - 128) / 128.0;

          // 轨1: 暖色基底 (深海潮汐长波)
          const tideWave = Math.sin(i * 0.045 + wavePhase) * (volTide * 22);

          // 轨2: 有机颗粒 (木柴噼啪与落雨激荡的高频微波涟漪，放慢衰减周期)
          const crackleWave = Math.sin(i * 0.28 + wavePhase * 3.2) * crackleVisualEnergy * (volCrackle * 14);

          // 轨3: 漂移垫音 (大七度五度复音谐波干涉驻波)
          const droneWave = (Math.sin(i * 0.12 + wavePhase * 1.5) * 0.65 + Math.sin(i * 0.24 + wavePhase * 0.8) * 0.35) * (volDrone * 16);

          // 三轨全量融汇与真实采样叠加
          yOffset = (v * 24 + tideWave + crackleWave + droneWave) * currentVisualAmp;
        }

        const y = midY * 0.52 + yOffset;
        const x = i * sliceWidth;
        if (i === 0) scopeCtx.moveTo(x, y);
        else scopeCtx.lineTo(x, y);
      }

      scopeCtx.strokeStyle = isPoweredOn
        ? (isMuffled || isManualMuffled ? (isDay ? '#d97706' : '#f59e0b') : waveColor)
        : (isDay ? 'rgba(71, 85, 105, 0.4)' : 'rgba(100, 116, 139, 0.4)');
      scopeCtx.lineWidth = isPoweredOn ? 2 : 1.5;
      if (!isDay && isPoweredOn && currentVisualAmp > 0.1) {
        scopeCtx.shadowColor = isMuffled || isManualMuffled ? 'rgba(245, 158, 11, 0.45)' : 'rgba(56, 189, 248, 0.45)';
        scopeCtx.shadowBlur = 6;
      }
      scopeCtx.stroke();
      scopeCtx.shadowBlur = 0;
      scopeCtx.restore();

      // ================= 4. 下半部：64 根对数频谱柱 (Log Spectrum) =================
      scopeCtx.save();
      const specTop = midY + 12;
      const specHeight = h - specTop - 18;
      const numBars = 64;
      const barGap = 2;
      const barWidth = Math.max(2, (w - (numBars - 1) * barGap) / numBars);

      // 计算 Cutoff 对数映射 X 坐标: 20Hz ~ 20000Hz
      const minLog = Math.log10(20);
      const maxLog = Math.log10(20000);
      const curLog = Math.log10(Math.max(20, Math.min(20000, visualCutoff)));
      const cutoffRatio = (curLog - minLog) / (maxLog - minLog);
      const cutoffX = cutoffRatio * w;

      for (let b = 0; b < numBars; b++) {
        let mag = 0;
        if (isPoweredOn && masterAnalyser && currentVisualAmp > 0.001) {
          // 对数映射频段取样
          const binIdx = Math.min(
            freqData.length - 1,
            Math.floor(Math.pow(b / numBars, 1.7) * (freqData.length * 0.75))
          );
          mag = (freqData[binIdx] || 0) / 255.0;
        }

        const bx = b * (barWidth + barGap);

        // 超过 Cutoff 的高频柱进行物理滚降压制
        let attenuation = 1.0;
        if (bx > cutoffX) {
          const dist = (bx - cutoffX) / (w * 0.18);
          attenuation = Math.max(0.04, Math.pow(0.5, dist * 2.2));
        }

        const barH = Math.max(0, mag * specHeight * attenuation * currentVisualAmp);
        const by = h - 10 - barH;

        if (barH > 0.5) {
          // 颜色渐变: 0~25 蓝, 26~44 绿, 45~63 黄/金
          let barColor = isDay ? '#0284c7' : '#38bdf8';
          if (isMuffled || isManualMuffled) {
            barColor = isDay ? '#d97706' : '#f59e0b';
          } else if (b >= 45) {
            barColor = isDay ? '#d97706' : '#fbbf24';
          } else if (b >= 26) {
            barColor = isDay ? '#059669' : '#34d399';
          }

          scopeCtx.fillStyle = barColor;
          scopeCtx.beginPath();
          const r = Math.min(barWidth / 2, 2);
          if (scopeCtx.roundRect) {
            scopeCtx.roundRect(bx, by, barWidth, barH, [r, r, 0, 0]);
          } else {
            scopeCtx.rect(bx, by, barWidth, barH);
          }
          scopeCtx.fill();
        }
      }

      // ================= 5. 下半部：低通滤波器滚降包络虚线 (Filter Roll-off Envelope) =================
      scopeCtx.beginPath();
      for (let px = 0; px <= w; px += 4) {
        let atten = 0;
        if (px > cutoffX) {
          const dist = (px - cutoffX) / (w * 0.18);
          atten = Math.min(1, dist * dist);
        }
        const ey = specTop + 14 + atten * (specHeight - 16);
        if (px === 0) scopeCtx.moveTo(px, ey);
        else scopeCtx.lineTo(px, ey);
      }
      scopeCtx.strokeStyle = (isMuffled || isManualMuffled) 
        ? (isDay ? '#d97706' : '#f59e0b') 
        : (isDay ? 'rgba(71, 85, 105, 0.45)' : 'rgba(226, 232, 240, 0.45)');
      scopeCtx.lineWidth = 1.8;
      scopeCtx.setLineDash([5, 4]);
      scopeCtx.stroke();
      scopeCtx.setLineDash([]);

      // Cutoff 垂直指示线 (在 cutoffX 处向下)
      scopeCtx.beginPath();
      scopeCtx.moveTo(cutoffX, specTop);
      scopeCtx.lineTo(cutoffX, h - 8);
      scopeCtx.strokeStyle = (isMuffled || isManualMuffled) ? '#f59e0b' : waveColor;
      scopeCtx.lineWidth = 1.5;
      scopeCtx.stroke();

      scopeCtx.restore();

      scopeAnimId = requestAnimationFrame(drawScope);
    }

    scopeAnimId = requestAnimationFrame(drawScope);
  }

  function stopScopeVisualizer() {
    if (scopeAnimId) {
      cancelAnimationFrame(scopeAnimId);
      scopeAnimId = null;
    }
  }

  // ========== 克制的视觉共生 (Visual-audio Synesthesia) ==========
  function startWaveAnimation() {
    const bars = document.querySelectorAll('.sound-bar');
    const dataArray = new Uint8Array(masterAnalyser ? masterAnalyser.frequencyBinCount : 32);

    function loop() {
      if (!isPoweredOn) {
        bars.forEach(b => b.style.height = '4px');
        return;
      }
      if (masterAnalyser) {
        masterAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < 16; i++) sum += dataArray[i];
        const avg = sum / 16; // 0 ~ 255
        const norm = Math.min(1, avg / 120);

        // 柔和驱动 4 根微波形条
        if (bars.length >= 4) {
          bars[0].style.height = (4 + norm * 8 + Math.sin(Date.now() * 0.005) * 2) + 'px';
          bars[1].style.height = (5 + norm * 14 + Math.cos(Date.now() * 0.006) * 3) + 'px';
          bars[2].style.height = (4 + norm * 11 + Math.sin(Date.now() * 0.007) * 2) + 'px';
          bars[3].style.height = (3 + norm * 7 + Math.cos(Date.now() * 0.004) * 2) + 'px';
        }
      }
      visualAnimId = requestAnimationFrame(loop);
    }
    loop();
  }

  // ========== UI 交互与事件委托 ==========
  function initUI() {
    const anchor = document.getElementById('soundAnchor');
    const drawer = document.getElementById('soundDrawer');
    const masterToggle = document.getElementById('sdMasterToggle');
    const hapticsToggle = document.getElementById('sdHapticsToggle');
    const badge = document.getElementById('sdStateBadge');

    const sliderTide = document.getElementById('sdTrackTide');
    const sliderCrackle = document.getElementById('sdTrackCrackle');
    const sliderDrone = document.getElementById('sdTrackDrone');

    const valTide = document.getElementById('sdValTide');
    const valCrackle = document.getElementById('sdValCrackle');
    const valDrone = document.getElementById('sdValDrone');

    const btnMuffle = document.getElementById('sdBtnToggleMuffle');
    const btnWaterDrop = document.getElementById('sdBtnWaterDrop');

    initScopeCanvas();

    // 抽屉展开与延时自动收起控制器 (支持常驻锁定与安全防抖)
    let isPinned = false;
    let hoverCloseTimer = null;

    function openDrawer(pinned = false) {
      clearTimeout(hoverCloseTimer);
      if (pinned) isPinned = true;
      if (!isDrawerOpen) {
        isDrawerOpen = true;
        drawer.classList.add('open');
        drawer.setAttribute('aria-hidden', 'false');
        resizeScopeCanvas();
        startScopeVisualizer();
      }
    }

    function closeDrawer(force = false) {
      clearTimeout(hoverCloseTimer);
      if (!force && isPinned) return;
      isPinned = false;
      isDrawerOpen = false;
      drawer.classList.remove('open');
      drawer.setAttribute('aria-hidden', 'true');
      stopScopeVisualizer();
    }

    function scheduleHoverClose() {
      if (isPinned) return;
      clearTimeout(hoverCloseTimer);
      hoverCloseTimer = setTimeout(() => {
        closeDrawer(true);
      }, 900);
    }

    if (anchor && drawer) {
      // 鼠标悬停窥视展开 (Hover Peek)
      anchor.addEventListener('mouseenter', () => openDrawer(false));
      anchor.addEventListener('mouseleave', scheduleHoverClose);

      drawer.addEventListener('mouseenter', () => {
        clearTimeout(hoverCloseTimer);
      });
      drawer.addEventListener('mouseleave', scheduleHoverClose);

      // 面板内任意点击或交互即锁定常驻，绝不在选配方或调参数时误收起
      drawer.addEventListener('click', () => {
        isPinned = true;
        clearTimeout(hoverCloseTimer);
      });
      drawer.addEventListener('mousedown', () => {
        isPinned = true;
        clearTimeout(hoverCloseTimer);
      });

      // 入口胶囊点击：标准 Toggle 开关 (已展开时点击收起，未展开时点击展开并常驻锁定)
      anchor.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isDrawerOpen) {
          closeDrawer(true);
        } else {
          openDrawer(true);
          if (!isPoweredOn) {
            togglePower();
          }
        }
      });

      // 显式关闭按钮
      const btnClose = document.getElementById('sdBtnClose');
      if (btnClose) {
        btnClose.addEventListener('click', (e) => {
          e.stopPropagation();
          closeDrawer(true);
        });
      }

      // 点击外部空白区域自动收起 (Click-Outside to Dismiss)
      document.addEventListener('click', (e) => {
        if (!drawer.contains(e.target) && !anchor.contains(e.target)) {
          closeDrawer(true);
        }
      });

      // 键盘快捷键监听
      window.addEventListener('keydown', (e) => {
        const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable)) return;

        // [Esc] 键退出关闭声音控制台
        if (e.key === 'Escape' && isDrawerOpen) {
          closeDrawer(true);
          return;
        }

        // [M] 键一键紧急静音 / 唤醒
        if (e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.altKey && !e.metaKey) {
          togglePower();
          if (isPoweredOn && !isDrawerOpen) {
            openDrawer(true);
          }
        }
      });
    }

    function updateUIState() {
      if (anchor) anchor.classList.toggle('active', isPoweredOn);
      if (masterToggle) masterToggle.classList.toggle('active', isPoweredOn);
      updateMuffleState();
      if (valTide) valTide.textContent = Math.round(volTide * 100) + '%';
      if (valCrackle) valCrackle.textContent = Math.round(volCrackle * 100) + '%';
      if (valDrone) valDrone.textContent = Math.round(volDrone * 100) + '%';
    }

    function togglePower() {
      isPoweredOn = !isPoweredOn;
      localStorage.setItem(STORAGE_KEY_ENABLED, isPoweredOn ? '1' : '0');
      if (isPoweredOn) {
        startAudioEngine();
      } else {
        stopAudioEngine();
      }
      updateUIState();
    }

    if (masterToggle) {
      masterToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        playClickHaptic();
        togglePower();
      });
    }

    if (hapticsToggle) {
      hapticsToggle.checked = hapticsEnabled;
      hapticsToggle.addEventListener('change', () => {
        hapticsEnabled = hapticsToggle.checked;
        localStorage.setItem(STORAGE_KEY_HAPTICS, hapticsEnabled ? '1' : '0');
        if (hapticsEnabled) playClickHaptic();
      });
    }

    // 交互实验按钮
    if (btnMuffle) {
      btnMuffle.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleManualMuffle();
      });
    }

    if (btnWaterDrop) {
      btnWaterDrop.addEventListener('click', (e) => {
        e.stopPropagation();
        playWaterDroplet();
      });
    }

    // 预设配方列表事件
    const presetsList = document.getElementById('sdPresetsList');
    if (presetsList) {
      presetsList.addEventListener('click', (e) => {
        const pill = e.target.closest('.sd-preset-pill');
        if (!pill) return;
        e.stopPropagation();
        const presetName = pill.getAttribute('data-preset');
        if (presetName) {
          applyPreset(presetName);
        }
      });
    }

    // 滑块监听
    if (sliderTide) {
      sliderTide.value = Math.round(volTide * 100);
      sliderTide.addEventListener('input', () => {
        volTide = sliderTide.value / 100;
        localStorage.setItem(STORAGE_KEY_VOL_TIDE, volTide.toString());
        if (valTide) valTide.textContent = sliderTide.value + '%';
        if (tideNodes && audioCtx) {
          tideNodes.gain.gain.setTargetAtTime(volTide * 0.16, audioCtx.currentTime, 0.05);
        }
        document.querySelectorAll('.sd-preset-pill').forEach(b => b.classList.remove('active'));
      });
    }

    if (sliderCrackle) {
      sliderCrackle.value = Math.round(volCrackle * 100);
      sliderCrackle.addEventListener('input', () => {
        volCrackle = sliderCrackle.value / 100;
        localStorage.setItem(STORAGE_KEY_VOL_CRACKLE, volCrackle.toString());
        if (valCrackle) valCrackle.textContent = sliderCrackle.value + '%';
        if (crackleNodes && audioCtx) {
          crackleNodes.gain.gain.setTargetAtTime(volCrackle * 0.18, audioCtx.currentTime, 0.05);
        }
        document.querySelectorAll('.sd-preset-pill').forEach(b => b.classList.remove('active'));
      });
    }

    if (sliderDrone) {
      sliderDrone.value = Math.round(volDrone * 100);
      sliderDrone.addEventListener('input', () => {
        volDrone = sliderDrone.value / 100;
        localStorage.setItem(STORAGE_KEY_VOL_DRONE, volDrone.toString());
        if (valDrone) valDrone.textContent = sliderDrone.value + '%';
        if (droneNodes && audioCtx) {
          droneNodes.gain.gain.setTargetAtTime(volDrone * 0.05, audioCtx.currentTime, 0.05);
        }
        document.querySelectorAll('.sd-preset-pill').forEach(b => b.classList.remove('active'));
      });
    }

    // 从 localStorage 读取偏好
    try {
      const savedHaptics = localStorage.getItem(STORAGE_KEY_HAPTICS);
      if (savedHaptics !== null) hapticsEnabled = savedHaptics === '1';
      const st = localStorage.getItem(STORAGE_KEY_VOL_TIDE);
      if (st) volTide = parseFloat(st);
      const sc = localStorage.getItem(STORAGE_KEY_VOL_CRACKLE);
      if (sc) volCrackle = parseFloat(sc);
      const sd = localStorage.getItem(STORAGE_KEY_VOL_DRONE);
      if (sd) volDrone = parseFloat(sd);
    } catch (e) {}

    updateUIState();
  }

  // ========== 全局事件委托：微动效音效绑定 ==========
  function bindMicroInteractions() {
    // 悬停委托：针对按钮、链接、卡片、输入滑块、tab 等交互性元素
    document.addEventListener('mouseover', (e) => {
      const target = e.target;
      if (!target || !target.closest) return;
      const el = target.closest('button, a, .contact-item, [role="button"], input[type="range"], .music-tab, .quick-btn, .persona-item, .preset-card, .rc-card, .rc-top-btn, span[data-tooltip], .sd-preset-pill, .sd-action-btn');
      if (el) {
        playHoverParticle();
      }
    }, { passive: true });

    // 点击委托：双阶段物理微动感
    document.addEventListener('mousedown', (e) => {
      const target = e.target;
      if (!target || !target.closest) return;
      const el = target.closest('button, a, .contact-item, [role="button"], input[type="range"], .music-tab, .quick-btn, .rc-top-btn, .sd-preset-pill, .sd-action-btn');
      if (el) {
        playClickHaptic();
      }
    }, { passive: true });

    // 昼夜切换声学窗帘挂接
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        setTimeout(() => {
          const isDay = document.documentElement.getAttribute('data-theme') === 'day';
          playAcousticCurtain(isDay);
        }, 10);
      });
    }

    // 隔壁房间效应挂接 (Tab-Blur Muffling)
    document.addEventListener('visibilitychange', () => {
      handleFocusChange(document.hidden);
    });

    window.addEventListener('blur', () => {
      setTimeout(() => {
        if (!document.hasFocus()) handleFocusChange(true);
      }, 120);
    });

    window.addEventListener('focus', () => {
      handleFocusChange(false);
    });
  }

  // ========== 页面加载完成启动 ==========
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initUI();
      bindMicroInteractions();
    });
  } else {
    initUI();
    bindMicroInteractions();
  }

  // 挂载全局 API 方便外部联动
  window.SoundSpace = {
    powerOn: () => { if (!isPoweredOn) { isPoweredOn = true; startAudioEngine(); } },
    powerOff: () => { if (isPoweredOn) { isPoweredOn = false; stopAudioEngine(); } },
    playHover: playHoverParticle,
    playClick: playClickHaptic,
    playCurtain: playAcousticCurtain,
    playWaterDrop: playWaterDroplet,
    applyPreset: applyPreset,
    toggleMuffle: toggleManualMuffle
  };
})();
