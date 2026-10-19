/**
 * Moodist UI Controller (Authentic 1:1 Reproduction from remvze/moodist)
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

    // DOM Elements
    const toggleBtn = document.getElementById('moodistToggle');
    const badgeEl = document.getElementById('moodistBadge');
    const stageEl = document.getElementById('moodistStage');
    const backBtn = document.getElementById('moodistBackBtn');
    const countTag = document.getElementById('moodistCountTag');
    const catBar = document.getElementById('moodistCatBar');
    const catalogEl = document.getElementById('moodistCatalog');
    const catalogWrapper = document.getElementById('moodistCatalogWrapper');

    // Bottom Dock Controls
    const masterPlayBtn = document.getElementById('moodistMasterPlayBtn');
    const dockPlayIcon = document.getElementById('dockPlayIcon');
    const dockPlayText = document.getElementById('dockPlayText');
    const clearBtn = document.getElementById('moodistClearBtn');
    const shuffleBtn = document.getElementById('moodistShuffleBtn');
    const menuBtn = document.getElementById('moodistMenuBtn');
    const menuPopover = document.getElementById('moodistMenuPopover');
    const timerChips = document.getElementById('moodistTimerChips');
    const muteBtn = document.getElementById('moodistMuteBtn');
    const masterVolSlider = document.getElementById('moodistMasterVolSlider');

    // Show More state per category
    const expandedCats = new Set();

    // 1. Open / Close Stage
    function openStage() {
      document.body.classList.add('moodist-open');
    }

    function closeStage() {
      document.body.classList.remove('moodist-open');
      if (menuPopover) menuPopover.classList.remove('open');
    }

    if (toggleBtn) toggleBtn.addEventListener('click', openStage);
    if (backBtn) backBtn.addEventListener('click', closeStage);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (menuPopover && menuPopover.classList.contains('open')) {
          menuPopover.classList.remove('open');
        } else if (document.body.classList.contains('moodist-open')) {
          closeStage();
        }
      }
    });

    // 2. Render Top Text Navigation (Clean text links, no emojis)
    function renderCategoryNav() {
      if (!catBar) return;
      catBar.innerHTML = '';

      const allBtn = document.createElement('button');
      allBtn.className = 'moodist-cat-link active';
      allBtn.textContent = '全部';
      allBtn.addEventListener('click', () => {
        catBar.querySelectorAll('.moodist-cat-link').forEach(b => b.classList.remove('active'));
        allBtn.classList.add('active');
        if (catalogWrapper) catalogWrapper.scrollTo({ top: 0, behavior: 'smooth' });
      });
      catBar.appendChild(allBtn);

      (MOODIST_DATA.categories || []).forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'moodist-cat-link';
        btn.dataset.cat = cat.id;
        btn.textContent = cat.title;
        btn.addEventListener('click', () => {
          catBar.querySelectorAll('.moodist-cat-link').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          const section = document.getElementById('category-' + cat.id);
          if (section) {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
        catBar.appendChild(btn);
      });
    }

    // 3. Render Catalog (Tail Line + Round Badge + Serif Title + 3-Col Grid)
    function renderCatalog() {
      if (!catalogEl) return;
      catalogEl.innerHTML = '';

      (MOODIST_DATA.categories || []).forEach(cat => {
        const section = document.createElement('section');
        section.className = 'moodist-category-section';
        section.id = 'category-' + cat.id;

        // Tail Line + Icon Badge
        const tail = document.createElement('div');
        tail.className = 'moodist-cat-tail';
        section.appendChild(tail);

        const badge = document.createElement('div');
        badge.className = 'moodist-cat-badge';
        badge.innerHTML = cat.icon;
        section.appendChild(badge);

        // Serif Title
        const title = document.createElement('div');
        title.className = 'moodist-cat-title';
        title.innerHTML = cat.title + '<span class="moodist-cat-subtitle">' + cat.enTitle + '</span>';
        section.appendChild(title);

        // 3-Col Grid
        const grid = document.createElement('div');
        grid.className = 'moodist-sounds-grid';

        const isExpanded = expandedCats.has(cat.id);
        const DEFAULT_VISIBLE = 9;

        cat.sounds.forEach((snd, idx) => {
          const card = document.createElement('div');
          card.className = 'moodist-sound-card';
          card.dataset.id = snd.id;
          if (idx >= DEFAULT_VISIBLE && !isExpanded) {
            card.classList.add('hidden-item');
          }

          card.innerHTML = `
            <div class="moodist-card-icon-box">${snd.icon}</div>
            <div class="moodist-card-body">
              <div class="moodist-card-title-row">
                <div class="moodist-card-name">
                  ${snd.cn}
                  <span class="moodist-card-subname">${snd.label}</span>
                </div>
              </div>
              <div class="moodist-card-controls">
                <input type="range" class="moodist-sound-slider" min="0" max="100" value="50" title="音量">
                <button class="moodist-swell-toggle" title="潮汐呼吸律动">~ 波动</button>
              </div>
            </div>
          `;

          // Card Click
          card.addEventListener('click', (e) => {
            if (e.target.closest('.moodist-card-controls')) return;
            engine.toggleSound(snd.id);
          });

          // Volume Slider
          const slider = card.querySelector('.moodist-sound-slider');
          slider.addEventListener('input', (e) => {
            e.stopPropagation();
            engine.setSoundVolume(snd.id, slider.value / 100);
          });

          // Swell Toggle
          const swellBtn = card.querySelector('.moodist-swell-toggle');
          swellBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            engine.toggleSwell(snd.id);
          });

          grid.appendChild(card);
        });

        section.appendChild(grid);

        // Show More Button (if category has > 9 sounds)
        if (cat.sounds.length > DEFAULT_VISIBLE) {
          const moreBtn = document.createElement('button');
          moreBtn.className = 'moodist-show-more-btn';
          moreBtn.textContent = isExpanded ? '收起' : '展开更多 (' + cat.sounds.length + ')';
          moreBtn.addEventListener('click', () => {
            if (expandedCats.has(cat.id)) {
              expandedCats.delete(cat.id);
            } else {
              expandedCats.add(cat.id);
            }
            renderCatalog();
          });
          section.appendChild(moreBtn);
        }

        catalogEl.appendChild(section);
      });
    }

    // 4. Wire Bottom Floating Dock
    if (masterPlayBtn) {
      masterPlayBtn.addEventListener('click', () => {
        engine.toggleMasterPlay();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        engine.stopAll();
      });
    }

    if (shuffleBtn) {
      shuffleBtn.addEventListener('click', () => {
        engine.shuffle();
      });
    }

    if (menuBtn && menuPopover) {
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menuPopover.classList.toggle('open');
      });

      document.addEventListener('click', (e) => {
        if (!e.target.closest('.moodist-dock-menu-wrapper')) {
          menuPopover.classList.remove('open');
        }
      });
    }

    if (timerChips) {
      timerChips.querySelectorAll('.moodist-timer-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          timerChips.querySelectorAll('.moodist-timer-chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          const mins = parseInt(chip.dataset.mins, 10);
          engine.setSleepTimer(mins);
        });
      });
    }

    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        engine.toggleMute();
      });
    }

    if (masterVolSlider) {
      masterVolSlider.addEventListener('input', () => {
        engine.setMasterVolume(masterVolSlider.value / 100);
      });
    }

    // 5. Engine State Listener
    engine.subscribe((state) => {
      // Toggle Badge
      if (badgeEl) badgeEl.textContent = state.activeCount;
      if (toggleBtn) toggleBtn.classList.toggle('active', state.activeCount > 0);

      // Top Status Pill
      if (countTag) {
        countTag.textContent = state.activeCount > 0
          ? state.activeCount + ' 种声音播放中'
          : '0 种声音';
      }

      // Master Play Button
      if (dockPlayIcon && dockPlayText) {
        if (state.isPlaying) {
          dockPlayIcon.textContent = '⏸';
          dockPlayText.textContent = '暂停';
        } else {
          dockPlayIcon.textContent = '▶';
          dockPlayText.textContent = '播放';
        }
      }

      // Mute Icon
      if (muteBtn) {
        muteBtn.textContent = state.isMuted ? '🔇' : '🔊';
      }

      // Master Vol Slider
      if (masterVolSlider && document.activeElement !== masterVolSlider) {
        masterVolSlider.value = Math.round(state.masterVolume * 100);
      }

      // Cards Active State
      const activeMap = new Map();
      state.activeSounds.forEach(s => activeMap.set(s.id, s));

      if (catalogEl) {
        const cards = catalogEl.querySelectorAll('.moodist-sound-card');
        cards.forEach(card => {
          const id = card.dataset.id;
          const activeItem = activeMap.get(id);
          const isActive = !!activeItem;

          card.classList.toggle('active', isActive);

          const slider = card.querySelector('.moodist-sound-slider');
          const swellBtn = card.querySelector('.moodist-swell-toggle');

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

    // Initial Renders
    renderCategoryNav();
    renderCatalog();
    engine.notify();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMoodistUI);
  } else {
    initMoodistUI();
  }
})();
