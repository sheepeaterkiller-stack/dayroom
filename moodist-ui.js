/**
 * Moodist Ambient Workshop UI Controller for dayroom
 * Connects the pure Bauhaus UI with MoodistEngine
 */

(function () {
  'use strict';

  function initMoodistUI() {
    if (typeof MOODIST_DATA === 'undefined' || typeof MoodistEngine === 'undefined') {
      console.warn('Moodist data or engine not ready yet.');
      return;
    }

    const engine = new MoodistEngine(MOODIST_DATA);
    window.moodistEngine = engine;

    // DOM References
    const toggleBtn = document.getElementById('moodistToggle');
    const badgeEl = document.getElementById('moodistBadge');
    const stageEl = document.getElementById('moodistStage');
    const backBtn = document.getElementById('moodistBackBtn');
    const countTag = document.getElementById('moodistCountTag');
    const presetsBar = document.getElementById('moodistPresetsBar');
    const shuffleBtn = document.getElementById('moodistShuffleBtn');
    const masterPlayBtn = document.getElementById('moodistMasterPlayBtn');
    const timerSelect = document.getElementById('moodistTimerSelect');
    const breathBtn = document.getElementById('moodistBreathBtn');
    const clearBtn = document.getElementById('moodistClearBtn');
    const muteBtn = document.getElementById('moodistMuteBtn');
    const masterVolSlider = document.getElementById('moodistMasterVolSlider');
    const catBar = document.getElementById('moodistCatBar');
    const catalogEl = document.getElementById('moodistCatalog');

    // Breathing modal
    const breathModal = document.getElementById('moodistBreathModal');
    const breathClose = document.getElementById('moodistBreathClose');
    const breathCircle = document.getElementById('breathCircle');
    const breathAction = document.getElementById('breathAction');
    const breathTime = document.getElementById('breathTime');
    const breathToggleBtn = document.getElementById('breathToggleBtn');
    let breathInterval = null;
    let isBreathing = false;

    // 1. Open / Close Stage (Smooth Left Slide)
    function openStage() {
      document.body.classList.add('moodist-open');
    }

    function closeStage() {
      document.body.classList.remove('moodist-open');
    }

    if (toggleBtn) toggleBtn.addEventListener('click', openStage);
    if (backBtn) backBtn.addEventListener('click', closeStage);

    // ESC key closes stage
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (breathModal && breathModal.classList.contains('open')) {
          closeBreathModal();
        } else if (document.body.classList.contains('moodist-open')) {
          closeStage();
        }
      }
    });

    // 2. Render Presets in Top Bar
    function renderPresets() {
      if (!presetsBar) return;
      presetsBar.innerHTML = '';

      const presets = MOODIST_DATA.presets || [];
      presets.forEach(p => {
        const btn = document.createElement('button');
        btn.className = 'moodist-preset-chip';
        btn.dataset.id = p.id;
        btn.title = p.desc;
        btn.innerHTML = `${p.icon} ${p.name}`;
        btn.addEventListener('click', () => {
          engine.loadPreset(p.id);
        });
        presetsBar.appendChild(btn);
      });
    }

    // 3. Render Category Bar
    function renderCatBar() {
      if (!catBar) return;
      catBar.innerHTML = '<button class="moodist-cat-chip active" data-cat="all">全部</button>';

      (MOODIST_DATA.categories || []).forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'moodist-cat-chip';
        btn.dataset.cat = cat.id;
        btn.innerHTML = `${cat.icon} ${cat.title}`;
        btn.addEventListener('click', () => {
          catBar.querySelectorAll('.moodist-cat-chip').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          const targetSec = document.getElementById('moodist_cat_' + cat.id);
          if (targetSec) {
            targetSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
        catBar.appendChild(btn);
      });

      // "All" button scrolls to top
      const allBtn = catBar.querySelector('[data-cat="all"]');
      if (allBtn) {
        allBtn.addEventListener('click', () => {
          catBar.querySelectorAll('.moodist-cat-chip').forEach(b => b.classList.remove('active'));
          allBtn.classList.add('active');
          if (catalogEl) catalogEl.scrollTo({ top: 0, behavior: 'smooth' });
        });
      }
    }

    // 4. Render Catalog & Bauhaus Cards
    function renderCatalog() {
      if (!catalogEl) return;
      catalogEl.innerHTML = '';

      (MOODIST_DATA.categories || []).forEach(cat => {
        const section = document.createElement('section');
        section.className = 'moodist-cat-section';
        section.id = 'moodist_cat_' + cat.id;

        const header = document.createElement('div');
        header.className = 'moodist-cat-header';
        header.innerHTML = `
          <span class="moodist-cat-header-title">${cat.icon} ${cat.title}</span>
          <span class="moodist-cat-header-sub">${cat.enTitle} · ${cat.sounds.length}</span>
        `;
        section.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'moodist-grid';

        cat.sounds.forEach(snd => {
          const card = document.createElement('div');
          card.className = 'moodist-card';
          card.dataset.id = snd.id;
          card.title = `${snd.cn} (${snd.label})`;

          card.innerHTML = `
            <div class="moodist-card-icon" aria-hidden="true">${snd.icon}</div>
            <div class="moodist-card-content">
              <div class="moodist-card-heading">
                <div class="moodist-card-label">
                  ${snd.cn}
                  <span class="moodist-card-sublabel">${snd.label}</span>
                </div>
              </div>
              <div class="moodist-card-controls">
                <input type="range" class="moodist-card-slider" min="0" max="100" value="50" title="音量">
                <button class="moodist-swell-btn" title="潮汐起伏微振动">~ 波动</button>
              </div>
            </div>
          `;

          // Card Click -> Toggle Sound
          card.addEventListener('click', (e) => {
            if (e.target.closest('.moodist-card-controls')) return;
            engine.toggleSound(snd.id);
          });

          // Slider Input -> Volume
          const slider = card.querySelector('.moodist-card-slider');
          slider.addEventListener('input', (e) => {
            e.stopPropagation();
            engine.setSoundVolume(snd.id, slider.value / 100);
          });

          // Swell Button Click -> Wave Toggle
          const swellBtn = card.querySelector('.moodist-swell-btn');
          swellBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            engine.toggleSwell(snd.id);
          });

          grid.appendChild(card);
        });

        section.appendChild(grid);
        catalogEl.appendChild(section);
      });
    }

    // 5. Wire Master Controls
    if (shuffleBtn) {
      shuffleBtn.addEventListener('click', () => engine.shuffle());
    }

    if (masterPlayBtn) {
      masterPlayBtn.addEventListener('click', () => engine.toggleMasterPlay());
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => engine.stopAll());
    }

    if (muteBtn) {
      muteBtn.addEventListener('click', () => engine.toggleMute());
    }

    if (masterVolSlider) {
      masterVolSlider.addEventListener('input', () => {
        engine.setMasterVolume(masterVolSlider.value / 100);
      });
    }

    if (timerSelect) {
      timerSelect.addEventListener('change', () => {
        const mins = parseInt(timerSelect.value, 10);
        engine.setSleepTimer(mins);
      });
    }

    // 6. 4-7-8 Breathing Modal Logic
    function openBreathModal() {
      if (breathModal) breathModal.classList.add('open');
    }

    function closeBreathModal() {
      if (breathModal) breathModal.classList.remove('open');
      stopBreathing();
    }

    function stopBreathing() {
      isBreathing = false;
      if (breathInterval) clearInterval(breathInterval);
      breathInterval = null;
      if (breathCircle) {
        breathCircle.className = 'moodist-breath-circle';
      }
      if (breathAction) breathAction.textContent = '准备';
      if (breathTime) breathTime.textContent = '3';
      if (breathToggleBtn) breathToggleBtn.textContent = '开始练习';
    }

    function startBreathing() {
      isBreathing = true;
      if (breathToggleBtn) breathToggleBtn.textContent = '结束练习';

      let phase = 'inhale'; // inhale 4s -> hold 7s -> exhale 8s
      let count = 4;

      const runStep = () => {
        if (!isBreathing) return;

        if (count > 0) {
          breathTime.textContent = count;
          count--;
        } else {
          // Switch phase
          if (phase === 'inhale') {
            phase = 'hold';
            count = 7;
            breathAction.textContent = '屏息';
            breathCircle.className = 'moodist-breath-circle hold';
          } else if (phase === 'hold') {
            phase = 'exhale';
            count = 8;
            breathAction.textContent = '呼气';
            breathCircle.className = 'moodist-breath-circle exhale';
          } else {
            phase = 'inhale';
            count = 4;
            breathAction.textContent = '吸气';
            breathCircle.className = 'moodist-breath-circle inhale';
          }
          breathTime.textContent = count;
          count--;
        }
      };

      breathAction.textContent = '吸气';
      breathCircle.className = 'moodist-breath-circle inhale';
      breathTime.textContent = '4';
      count = 3;

      breathInterval = setInterval(runStep, 1000);
    }

    if (breathBtn) breathBtn.addEventListener('click', openBreathModal);
    if (breathClose) breathClose.addEventListener('click', closeBreathModal);
    if (breathModal) {
      breathModal.addEventListener('click', (e) => {
        if (e.target === breathModal) closeBreathModal();
      });
    }

    if (breathToggleBtn) {
      breathToggleBtn.addEventListener('click', () => {
        if (isBreathing) {
          stopBreathing();
        } else {
          startBreathing();
        }
      });
    }

    // 7. Subscribe to Engine State Updates
    engine.subscribe((state) => {
      // Toggle button badge
      if (badgeEl) {
        badgeEl.textContent = state.activeCount;
      }
      if (toggleBtn) {
        toggleBtn.classList.toggle('active', state.activeCount > 0);
      }

      // Count Tag
      if (countTag) {
        countTag.textContent = state.activeCount > 0
          ? `${state.activeCount} 种声音运行中`
          : '就绪';
      }

      // Master play/pause button
      if (masterPlayBtn) {
        if (state.isPlaying) {
          masterPlayBtn.innerHTML = '⏸ 暂停';
          masterPlayBtn.classList.add('active');
        } else {
          masterPlayBtn.innerHTML = '▶ 播放';
          masterPlayBtn.classList.remove('active');
        }
      }

      // Master Mute Icon
      if (muteBtn) {
        muteBtn.textContent = state.isMuted ? '🔇' : '🔊';
      }

      // Master Volume Slider
      if (masterVolSlider) {
        masterVolSlider.value = Math.round(state.masterVolume * 100);
      }

      // Sleep Timer Select display
      if (timerSelect) {
        if (state.sleepTimerRemaining > 0) {
          const m = Math.floor(state.sleepTimerRemaining / 60);
          const s = state.sleepTimerRemaining % 60;
          timerSelect.options[0].textContent = `⏱ ${m}:${s < 10 ? '0' : ''}${s}`;
        } else {
          timerSelect.options[0].textContent = '⏱ 倒计时';
        }
      }

      // Update Cards
      const activeMap = new Map();
      state.activeSounds.forEach(s => activeMap.set(s.id, s));

      if (catalogEl) {
        const cards = catalogEl.querySelectorAll('.moodist-card');
        cards.forEach(card => {
          const id = card.dataset.id;
          const activeItem = activeMap.get(id);
          const isActive = !!activeItem;

          card.classList.toggle('active', isActive);

          const slider = card.querySelector('.moodist-card-slider');
          const swellBtn = card.querySelector('.moodist-swell-btn');

          if (activeItem) {
            if (slider && document.activeElement !== slider) {
              slider.value = Math.round(activeItem.volume * 100);
            }
            if (swellBtn) {
              swellBtn.classList.toggle('active', !!activeItem.swell);
            }
          }
        });
      }
    });

    // Initial renders
    renderPresets();
    renderCatBar();
    renderCatalog();
    engine.notify();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMoodistUI);
  } else {
    initMoodistUI();
  }
})();
