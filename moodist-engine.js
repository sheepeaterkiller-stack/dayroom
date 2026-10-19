/**
 * Moodist Audio Engine for dayroom
 * Handles multi-track ambient audio playback using Howler.js
 * Supports volume sliders, swell LFO wave oscillation, sleep timer, presets, and state persistence.
 */

class MoodistEngine {
  constructor(data) {
    this.data = data || (typeof MOODIST_DATA !== 'undefined' ? MOODIST_DATA : { categories: [], presets: [] });
    this.soundDefs = new Map();
    this.tracks = new Map(); // id -> { howl, baseVolume, swell, active, phase }
    this.masterVolume = 0.8;
    this.isMuted = false;
    this.isGloballyPaused = false;
    this.listeners = new Set();

    // Sleep Timer
    this.sleepTimerTotal = 0; // seconds
    this.sleepTimerRemaining = 0;
    this.sleepTimerInterval = null;

    // Swell LFO
    this.swellAnimId = null;
    this.lastLfoTime = performance.now();

    // Index all sound definitions
    this.data.categories.forEach(cat => {
      cat.sounds.forEach(snd => {
        this.soundDefs.set(snd.id, snd);
      });
    });

    this._startLfoLoop();
    this._loadSavedState();
  }

  // Subscribe to state changes (UI updates)
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    const state = this.getState();
    this.listeners.forEach(fn => {
      try { fn(state); } catch (e) { console.error('Moodist listener error:', e); }
    });
    this._saveState();
  }

  getState() {
    const activeSounds = [];
    this.tracks.forEach((track, id) => {
      if (track.active) {
        activeSounds.push({
          id,
          volume: track.baseVolume,
          swell: track.swell
        });
      }
    });

    return {
      activeSounds,
      activeCount: activeSounds.length,
      isPlaying: activeSounds.length > 0 && !this.isGloballyPaused,
      masterVolume: this.masterVolume,
      isMuted: this.isMuted,
      isGloballyPaused: this.isGloballyPaused,
      sleepTimerRemaining: this.sleepTimerRemaining,
      sleepTimerTotal: this.sleepTimerTotal
    };
  }

  // Get or initialize track
  _getTrack(id) {
    let track = this.tracks.get(id);
    if (!track) {
      const def = this.soundDefs.get(id);
      if (!def) return null;

      const howl = new Howl({
        src: [def.src],
        loop: true,
        html5: true, // Use HTML5 Audio for streaming CDN audio without full preload
        volume: 0,
        preload: false
      });

      track = {
        id,
        def,
        howl,
        baseVolume: 0.5,
        swell: false,
        active: false,
        phase: Math.random() * Math.PI * 2
      };
      this.tracks.set(id, track);
    }
    return track;
  }

  // Toggle sound play/pause
  toggleSound(id) {
    const track = this._getTrack(id);
    if (!track) return false;

    if (track.active) {
      // Deactivate
      track.active = false;
      track.howl.fade(track.howl.volume(), 0, 400);
      setTimeout(() => {
        if (!track.active) {
          track.howl.pause();
        }
      }, 420);
    } else {
      // Activate
      track.active = true;
      if (this.isGloballyPaused) {
        this.isGloballyPaused = false;
      }
      const targetVol = this.isMuted ? 0 : track.baseVolume * this.masterVolume;
      track.howl.volume(0);
      track.howl.play();
      track.howl.fade(0, targetVol, 400);
    }

    this.notify();
    return track.active;
  }

  // Set sound volume (0.0 - 1.0)
  setSoundVolume(id, volume) {
    const track = this._getTrack(id);
    if (!track) return;
    track.baseVolume = Math.max(0, Math.min(1, volume));

    if (track.active && !this.isGloballyPaused && !track.swell) {
      const currentMaster = this.isMuted ? 0 : this.masterVolume;
      track.howl.volume(track.baseVolume * currentMaster);
    }
    this.notify();
  }

  // Toggle swell (volume wave oscillation)
  toggleSwell(id) {
    const track = this._getTrack(id);
    if (!track) return;
    track.swell = !track.swell;

    if (!track.swell && track.active && !this.isGloballyPaused) {
      const currentMaster = this.isMuted ? 0 : this.masterVolume;
      track.howl.volume(track.baseVolume * currentMaster);
    }
    this.notify();
  }

  // Master Volume (0.0 - 1.0)
  setMasterVolume(vol) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    this._applyVolumes();
    this.notify();
  }

  // Toggle Mute
  toggleMute() {
    this.isMuted = !this.isMuted;
    this._applyVolumes();
    this.notify();
  }

  // Toggle Master Play/Pause
  toggleMasterPlay() {
    const state = this.getState();
    if (state.activeCount === 0) {
      // If nothing is active, load a default pleasant preset (深夜雨屋)
      this.loadPreset('rainy_cabin');
      return;
    }

    this.isGloballyPaused = !this.isGloballyPaused;
    if (this.isGloballyPaused) {
      this.tracks.forEach(track => {
        if (track.active) {
          track.howl.fade(track.howl.volume(), 0, 400);
          setTimeout(() => {
            if (this.isGloballyPaused && track.active) {
              track.howl.pause();
            }
          }, 420);
        }
      });
    } else {
      this.tracks.forEach(track => {
        if (track.active) {
          track.howl.volume(0);
          track.howl.play();
          const targetVol = this.isMuted ? 0 : track.baseVolume * this.masterVolume;
          track.howl.fade(0, targetVol, 400);
        }
      });
    }
    this.notify();
  }

  // Stop & clear all active sounds
  stopAll() {
    this.tracks.forEach(track => {
      if (track.active) {
        track.active = false;
        track.howl.fade(track.howl.volume(), 0, 400);
        setTimeout(() => {
          track.howl.stop();
        }, 420);
      }
    });
    this.isGloballyPaused = false;
    this.clearSleepTimer();
    this.notify();
  }

  // Random Shuffle (2 - 4 complementary sounds)
  shuffle() {
    this.stopAll();

    // Pick 3 random categories
    const allCats = [...this.data.categories];
    for (let i = allCats.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allCats[i], allCats[j]] = [allCats[j], allCats[i]];
    }

    const selectedCats = allCats.slice(0, 3);
    const chosenSounds = [];

    selectedCats.forEach(cat => {
      if (cat.sounds.length > 0) {
        const randSound = cat.sounds[Math.floor(Math.random() * cat.sounds.length)];
        chosenSounds.push(randSound.id);
      }
    });

    chosenSounds.forEach((id, idx) => {
      const track = this._getTrack(id);
      if (track) {
        track.active = true;
        track.baseVolume = 0.35 + Math.random() * 0.35; // 0.35 - 0.70
        track.swell = idx === 0; // First one swells
        const targetVol = this.isMuted ? 0 : track.baseVolume * this.masterVolume;
        track.howl.volume(0);
        track.howl.play();
        track.howl.fade(0, targetVol, 500);
      }
    });

    this.isGloballyPaused = false;
    this.notify();
  }

  // Load Preset
  loadPreset(presetId) {
    let preset = (this.data.presets || []).find(p => p.id === presetId);
    if (!preset) {
      const custom = this.getCustomPresets();
      preset = custom.find(p => p.id === presetId);
    }
    if (!preset || !preset.sounds) return;

    // Deactivate currently active tracks that are not in the preset
    const targetIds = new Set(preset.sounds.map(s => s.id));
    this.tracks.forEach(track => {
      if (track.active && !targetIds.has(track.id)) {
        track.active = false;
        track.howl.fade(track.howl.volume(), 0, 400);
        setTimeout(() => {
          if (!track.active) track.howl.pause();
        }, 420);
      }
    });

    // Activate preset tracks
    preset.sounds.forEach(item => {
      const track = this._getTrack(item.id);
      if (track) {
        track.active = true;
        track.baseVolume = typeof item.volume === 'number' ? item.volume : 0.5;
        track.swell = !!item.swell;
        const targetVol = this.isMuted ? 0 : track.baseVolume * this.masterVolume;
        track.howl.volume(0);
        track.howl.play();
        track.howl.fade(0, targetVol, 500);
      }
    });

    this.isGloballyPaused = false;
    this.notify();
  }

  // Custom Presets Management
  getCustomPresets() {
    try {
      const str = localStorage.getItem('moodist_custom_presets');
      return str ? JSON.parse(str) : [];
    } catch (e) {
      return [];
    }
  }

  saveCustomPreset(name) {
    const trimmed = (name || '').trim();
    if (!trimmed) return null;

    const currentActive = [];
    this.tracks.forEach(track => {
      if (track.active) {
        currentActive.push({
          id: track.id,
          volume: track.baseVolume,
          swell: track.swell
        });
      }
    });

    if (currentActive.length === 0) return null;

    const custom = this.getCustomPresets();
    const newPreset = {
      id: 'custom_' + Date.now(),
      name: trimmed,
      desc: '自定义混音方案 · ' + currentActive.length + ' 种声音',
      icon: '✨',
      sounds: currentActive
    };

    custom.unshift(newPreset);
    try {
      localStorage.setItem('moodist_custom_presets', JSON.stringify(custom.slice(0, 20)));
    } catch (e) {}

    this.notify();
    return newPreset;
  }

  deleteCustomPreset(presetId) {
    const custom = this.getCustomPresets().filter(p => p.id !== presetId);
    try {
      localStorage.setItem('moodist_custom_presets', JSON.stringify(custom));
    } catch (e) {}
    this.notify();
  }

  // Sleep Timer (minutes)
  setSleepTimer(minutes) {
    this.clearSleepTimer();
    if (minutes <= 0) return;

    this.sleepTimerTotal = minutes * 60;
    this.sleepTimerRemaining = this.sleepTimerTotal;

    this.sleepTimerInterval = setInterval(() => {
      this.sleepTimerRemaining--;
      if (this.sleepTimerRemaining <= 3 && this.sleepTimerRemaining > 0) {
        // 3-second gentle fade out before complete stop
        this.tracks.forEach(track => {
          if (track.active) {
            track.howl.fade(track.howl.volume(), 0, 3000);
          }
        });
      } else if (this.sleepTimerRemaining <= 0) {
        this.stopAll();
      }
      this.notify();
    }, 1000);

    this.notify();
  }

  clearSleepTimer() {
    if (this.sleepTimerInterval) {
      clearInterval(this.sleepTimerInterval);
      this.sleepTimerInterval = null;
    }
    this.sleepTimerTotal = 0;
    this.sleepTimerRemaining = 0;
  }

  // Swell LFO volume animation loop (~10s period)
  _startLfoLoop() {
    const updateLfo = (now) => {
      const dt = (now - this.lastLfoTime) / 1000;
      this.lastLfoTime = now;

      if (!this.isGloballyPaused && !this.isMuted) {
        let hasSwell = false;
        this.tracks.forEach(track => {
          if (track.active && track.swell) {
            hasSwell = true;
            // 10s wave period: angular frequency = 2*PI / 10 ≈ 0.628 rad/s
            track.phase += 0.628 * dt;
            if (track.phase > Math.PI * 2) track.phase -= Math.PI * 2;

            // Oscillate volume between 35% and 100% of baseVolume
            const mod = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(track.phase));
            const vol = track.baseVolume * mod * this.masterVolume;
            track.howl.volume(Math.max(0, Math.min(1, vol)));
          }
        });
      }

      this.swellAnimId = requestAnimationFrame(updateLfo);
    };

    this.swellAnimId = requestAnimationFrame(updateLfo);
  }

  _applyVolumes() {
    const currentMaster = this.isMuted ? 0 : this.masterVolume;
    this.tracks.forEach(track => {
      if (track.active && !this.isGloballyPaused) {
        if (!track.swell) {
          track.howl.volume(track.baseVolume * currentMaster);
        }
      }
    });
  }

  _saveState() {
    try {
      const saved = [];
      this.tracks.forEach(track => {
        if (track.active) {
          saved.push({
            id: track.id,
            volume: track.baseVolume,
            swell: track.swell
          });
        }
      });
      localStorage.setItem('moodist_state', JSON.stringify({
        sounds: saved,
        masterVolume: this.masterVolume,
        isMuted: this.isMuted
      }));
    } catch (e) {}
  }

  _loadSavedState() {
    try {
      const str = localStorage.getItem('moodist_state');
      if (!str) return;
      const data = JSON.parse(str);
      if (typeof data.masterVolume === 'number') {
        this.masterVolume = data.masterVolume;
      }
      if (typeof data.isMuted === 'boolean') {
        this.isMuted = data.isMuted;
      }
      if (Array.isArray(data.sounds)) {
        data.sounds.forEach(item => {
          const track = this._getTrack(item.id);
          if (track) {
            track.baseVolume = item.volume;
            track.swell = !!item.swell;
            // We don't autoplay on initial page load to avoid browser audio block policy,
            // but we register the state so user can resume with 1 click
            track.active = false;
          }
        });
      }
    } catch (e) {}
  }
}

if (typeof window !== 'undefined') {
  window.MoodistEngine = MoodistEngine;
}
