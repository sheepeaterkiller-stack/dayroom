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
    if (scopeParticles.length > 30) scopeParticles.shift();
    scopeParticles.push({
      x: x !== undefined ? x : (80 + Math.random() * 240),
      y: y !== undefined ? y : (25 + Math.random() * 25),
      vx: (Math.random() - 0.5) * 0.9,
      vy: -0.3 - Math.random() * 0.7,
      radius: 2 + Math.random() * 2.5,
      alpha: 1.0,
      decay: 0.015 + Math.random() * 0.02,
      color: color || '#fbbf24'
    });
  }

  function addScopeRipple(x, y) {
    if (scopeRipples.length > 8) scopeRipples.shift();
    scopeRipples.push({
      x: x || 200,
      y: y || 42,
      r: 3,
      maxR: 45,
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
        const pCount = Math.min(3, Math.ceil(density / 6));
        for (let k = 0; k < pCount; k++) {
          addScopeParticle(
            40 + Math.random() * 320,
            24 + Math.random() * 26,
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
    masterAnalyser.fftSize = 128; // 64 frequency bins, 128 time-domain samples
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
    stopScopeVisualizer();
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
      addScopeRipple(200, 42);
      addScopeParticle(200, 42, '#38bdf8');
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
    const rect = scopeCanvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = rect.width || 390;
    const h = rect.height || 145;
    scopeCanvas.width = Math.round(w * dpr);
    scopeCanvas.height = Math.round(h * dpr);
    scopeCtx.setTransform(1, 0, 0, 1, 0, 0);
    scopeCtx.scale(dpr, dpr);
  }

  function startScopeVisualizer() {
    if (scopeAnimId) return;
    const timeData = new Uint8Array(128);
    const freqData = new Uint8Array(64);

    function drawScope() {
      if (!isDrawerOpen || !scopeCanvas || !scopeCtx) {
        scopeAnimId = null;
        return;
      }

      const rect = scopeCanvas.getBoundingClientRect();
      const w = rect.width || 390;
      const h = rect.height || 145;

      const isDay = document.documentElement.getAttribute('data-theme') === 'day';
      const bgColor = isDay ? '#e2e8f0' : '#07090d';
      const textDim = isDay ? '#475569' : '#64748b';
      const waveColor = isDay ? '#0284c7' : '#38bdf8';
      const dividerColor = isDay ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)';

      const colLow = isDay ? '#0284c7' : '#38bdf8';
      const colMid = isDay ? '#059669' : '#34d399';
      const colHigh = isDay ? '#d97706' : '#fbbf24';

      // 1. 清空背景
      scopeCtx.clearRect(0, 0, w, h);
      scopeCtx.fillStyle = bgColor;
      scopeCtx.fillRect(0, 0, w, h);

      // 获取音频数据
      if (masterAnalyser && isPoweredOn) {
        masterAnalyser.getByteTimeDomainData(timeData);
        masterAnalyser.getByteFrequencyData(freqData);
      } else {
        timeData.fill(128);
        freqData.fill(0);
      }

      // ================= 上半部：时域合成波形 & 有机颗粒 =================
      scopeCtx.save();
      scopeCtx.font = '9px Inter, monospace';
      scopeCtx.fillStyle = textDim;
      scopeCtx.fillText('时域合成波形 & 有机颗粒 (TIME-DOMAIN WAVEFORM)', 12, 16);

      // 绘制水滴波纹 (Ripples)
      for (let i = scopeRipples.length - 1; i >= 0; i--) {
        const rip = scopeRipples[i];
        scopeCtx.beginPath();
        scopeCtx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
        scopeCtx.strokeStyle = isDay 
          ? `rgba(2, 132, 199, ${rip.alpha * 0.7})` 
          : `rgba(56, 189, 248, ${rip.alpha * 0.7})`;
        scopeCtx.lineWidth = 1.4;
        scopeCtx.stroke();
        rip.r += 1.3;
        rip.alpha -= 0.024;
        if (rip.alpha <= 0.01 || rip.r >= rip.maxR) {
          scopeRipples.splice(i, 1);
        }
      }

      // 绘制有机微颗粒 (Particles)
      for (let i = scopeParticles.length - 1; i >= 0; i--) {
        const p = scopeParticles[i];
        scopeCtx.beginPath();
        scopeCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        scopeCtx.fillStyle = p.color;
        scopeCtx.globalAlpha = Math.max(0, p.alpha);
        if (!isDay) {
          scopeCtx.shadowColor = p.color;
          scopeCtx.shadowBlur = 5;
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

      // 绘制时域波形折线
      scopeCtx.beginPath();
      const waveCenterY = 44;
      const waveAmp = isPoweredOn ? 28 : 2;
      const count = timeData.length;
      for (let i = 0; i < count; i++) {
        const x = 12 + (i / (count - 1)) * (w - 24);
        let norm = (timeData[i] - 128) / 128; // -1 ~ 1
        if (!isPoweredOn) {
          norm = Math.sin(i * 0.12 + Date.now() * 0.002) * 0.06;
        }
        const y = waveCenterY + norm * waveAmp;
        if (i === 0) scopeCtx.moveTo(x, y);
        else scopeCtx.lineTo(x, y);
      }
      scopeCtx.strokeStyle = waveColor;
      scopeCtx.lineWidth = 1.8;
      if (!isDay && isPoweredOn) {
        scopeCtx.shadowColor = 'rgba(56, 189, 248, 0.45)';
        scopeCtx.shadowBlur = 5;
      }
      scopeCtx.stroke();
      scopeCtx.shadowBlur = 0;
      scopeCtx.restore();

      // ================= 中部虚线分割线 =================
      scopeCtx.save();
      scopeCtx.beginPath();
      scopeCtx.setLineDash([4, 4]);
      scopeCtx.moveTo(12, 73);
      scopeCtx.lineTo(w - 12, 73);
      scopeCtx.strokeStyle = dividerColor;
      scopeCtx.lineWidth = 1;
      scopeCtx.stroke();
      scopeCtx.restore();

      // ================= 下半部：对数频谱能量 & 低通截止包络 =================
      scopeCtx.save();
      scopeCtx.font = '9px Inter, monospace';
      scopeCtx.fillStyle = textDim;
      scopeCtx.fillText('-- 对数频谱能量 & 低通截止包络 (LOG SPECTRUM) --', 12, 87);

      // 低通截止频率平滑插值追踪
      visualCutoff += (targetCutoff - visualCutoff) * 0.14;

      // 对数坐标映射 Cutoff 位置: 40Hz ~ 20000Hz
      const minLog = Math.log10(40);
      const maxLog = Math.log10(20000);
      const curLog = Math.log10(Math.max(40, Math.min(20000, visualCutoff)));
      const normCutoff = (curLog - minLog) / (maxLog - minLog);
      const cutoffX = Math.round(14 + normCutoff * (w - 28));

      // Cutoff 标注文字
      scopeCtx.fillStyle = waveColor;
      const cutoffText = `Cutoff: ${Math.round(visualCutoff).toLocaleString()} Hz`;
      const textWidth = scopeCtx.measureText(cutoffText).width;
      const textX = Math.max(12, Math.min(w - textWidth - 12, cutoffX - textWidth - 6));
      scopeCtx.fillText(cutoffText, textX, 87);

      // Cutoff 垂直指示线 (实线)
      scopeCtx.beginPath();
      scopeCtx.moveTo(cutoffX, 90);
      scopeCtx.lineTo(cutoffX, h - 8);
      scopeCtx.strokeStyle = waveColor;
      scopeCtx.lineWidth = 1.5;
      scopeCtx.stroke();

      // Cutoff 衰减斜率曲线 (虚线)
      scopeCtx.beginPath();
      scopeCtx.setLineDash([3, 3]);
      scopeCtx.moveTo(cutoffX, 92);
      const endSlopeX = Math.min(w - 12, cutoffX + (w - cutoffX) * 0.85);
      scopeCtx.quadraticCurveTo(cutoffX + 16, 96, endSlopeX, h - 10);
      scopeCtx.strokeStyle = waveColor;
      scopeCtx.lineWidth = 1.2;
      scopeCtx.stroke();
      scopeCtx.setLineDash([]);

      // 32 根对数柱状频谱 (三色分区)
      const numBars = 32;
      const barGap = 2;
      const barWidth = Math.max(2, (w - 24 - (numBars - 1) * barGap) / numBars);

      for (let b = 0; b < numBars; b++) {
        const bx = 12 + b * (barWidth + barGap);
        // 对数取样频率 bin
        const binIndex = Math.min(63, Math.floor(Math.pow(b / (numBars - 1), 1.5) * 63));
        const rawVal = freqData[binIndex] || 0; // 0 ~ 255

        // 超过 Cutoff 的高频柱进行物理衰减压制
        let attenuation = 1.0;
        if (bx > cutoffX) {
          const dist = bx - cutoffX;
          attenuation = Math.max(0.04, Math.pow(0.5, dist / 20));
        }

        const barH = isPoweredOn 
          ? Math.max(2, (rawVal / 255) * 44 * attenuation)
          : (2 + Math.sin(b * 0.4 + Date.now() * 0.003) * 1.5);

        const by = h - 8 - barH;

        // 颜色分区: 0~17 蓝, 18~24 绿, 25~31 黄/橙
        let barColor = colLow;
        if (b >= 25) barColor = colHigh;
        else if (b >= 18) barColor = colMid;

        scopeCtx.fillStyle = barColor;
        scopeCtx.beginPath();
        const r = Math.min(barWidth / 2, 1.5);
        if (scopeCtx.roundRect) {
          scopeCtx.roundRect(bx, by, barWidth, barH, [r, r, 0, 0]);
        } else {
          scopeCtx.rect(bx, by, barWidth, barH);
        }
        scopeCtx.fill();
      }

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

    // 抽屉展开与延时自动收起计时器
    let closeTimer = null;

    function openDrawer() {
      clearTimeout(closeTimer);
      if (!isDrawerOpen) {
        isDrawerOpen = true;
        drawer.classList.add('open');
        drawer.setAttribute('aria-hidden', 'false');
        resizeScopeCanvas();
        startScopeVisualizer();
      }
    }

    function closeDrawerDelayed() {
      clearTimeout(closeTimer);
      closeTimer = setTimeout(() => {
        isDrawerOpen = false;
        drawer.classList.remove('open');
        drawer.setAttribute('aria-hidden', 'true');
        stopScopeVisualizer();
      }, 360);
    }

    if (anchor && drawer) {
      anchor.addEventListener('mouseenter', openDrawer);
      anchor.addEventListener('mouseleave', closeDrawerDelayed);
      drawer.addEventListener('mouseenter', openDrawer);
      drawer.addEventListener('mouseleave', closeDrawerDelayed);

      anchor.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!drawer.classList.contains('open')) {
          openDrawer();
        } else if (!isPoweredOn) {
          togglePower();
        }
      });

      document.addEventListener('click', (e) => {
        if (!drawer.contains(e.target) && !anchor.contains(e.target)) {
          isDrawerOpen = false;
          drawer.classList.remove('open');
          drawer.setAttribute('aria-hidden', 'true');
          stopScopeVisualizer();
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
