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
  let isMuffled = false; // "隔壁房间"状态

  // 轨道音量 (0 ~ 1)
  let volTide = 0.45;
  let volCrackle = 0.30;
  let volDrone = 0.25;

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
    masterMuffleFilter = ctx.createBiquadFilter();
    masterMuffleFilter.type = 'lowpass';
    masterMuffleFilter.frequency.setValueAtTime(isMuffled ? 360 : 18000, ctx.currentTime);
    masterMuffleFilter.Q.setValueAtTime(0.8, ctx.currentTime);

    // 3. 实时分析器 (用于微动效与视觉共生)
    masterAnalyser = ctx.createAnalyser();
    masterAnalyser.fftSize = 64;
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
    if (audioCtx && audioCtx.state !== 'closed') {
      try { audioCtx.suspend(); } catch (e) {}
    }
  }

  // ========== 第三层声场：空间联觉与“隔壁房间”效应 ==========
  function handleFocusChange(blurred) {
    if (!isPoweredOn || !masterMuffleFilter || !audioCtx) return;
    isMuffled = blurred;
    const now = audioCtx.currentTime;

    const roomIndicator = document.getElementById('sdRoomIndicator');
    const badge = document.getElementById('sdStateBadge');

    if (blurred) {
      // 走出房间，虚掩房门：1.5s 平滑阻尼变闷，削减中高频，保留温暖低频
      masterMuffleFilter.frequency.cancelScheduledValues(now);
      masterMuffleFilter.frequency.exponentialRampToValueAtTime(360, now + 1.5);
      if (roomIndicator) roomIndicator.textContent = '🚪 已进入隔壁房间模式（低频静谧虚掩）';
      if (badge) badge.textContent = '隔壁房间';
    } else {
      // 回到房间，推开房门：1.0s 平滑恢复通透全频
      masterMuffleFilter.frequency.cancelScheduledValues(now);
      masterMuffleFilter.frequency.exponentialRampToValueAtTime(18000, now + 1.0);
      if (roomIndicator) roomIndicator.textContent = '🚪 离开标签页将自动虚掩房门（隔壁房间效应）';
      if (badge) badge.textContent = isPoweredOn ? '沉浸中' : '静音中';
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

    // 抽屉展开与延时自动收起计时器
    let closeTimer = null;

    function openDrawer() {
      clearTimeout(closeTimer);
      drawer.classList.add('open');
      drawer.setAttribute('aria-hidden', 'false');
    }

    function closeDrawerDelayed() {
      clearTimeout(closeTimer);
      closeTimer = setTimeout(() => {
        drawer.classList.remove('open');
        drawer.setAttribute('aria-hidden', 'true');
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
          drawer.classList.remove('open');
          drawer.setAttribute('aria-hidden', 'true');
        }
      });
    }

    function updateUIState() {
      if (anchor) anchor.classList.toggle('active', isPoweredOn);
      if (masterToggle) masterToggle.classList.toggle('active', isPoweredOn);
      if (badge) badge.textContent = isPoweredOn ? (isMuffled ? '隔壁房间' : '沉浸中') : '静音中';
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
      const el = target.closest('button, a, .contact-item, [role="button"], input[type="range"], .music-tab, .quick-btn, .persona-item, .preset-card, .rc-card, .rc-top-btn, span[data-tooltip]');
      if (el) {
        playHoverParticle();
      }
    }, { passive: true });

    // 点击委托：双阶段物理微动感
    document.addEventListener('mousedown', (e) => {
      const target = e.target;
      if (!target || !target.closest) return;
      const el = target.closest('button, a, .contact-item, [role="button"], input[type="range"], .music-tab, .quick-btn, .rc-top-btn');
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
      // 延时校验，避免页面内部 focus 切换引发误判
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
    playCurtain: playAcousticCurtain
  };
})();
