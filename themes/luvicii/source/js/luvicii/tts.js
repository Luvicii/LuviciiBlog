/**
 * 文章朗读（Web Speech API）
 * 自包含模块：监听 DOMContentLoaded / pjax:complete 幂等初始化，
 * pjax:send / beforeunload 时停止朗读。
 */
(function () {
  'use strict';

  if (!('speechSynthesis' in window)) return;

  const synth = window.speechSynthesis;
  const RATES = [0.75, 1, 1.25, 1.5, 2];
  const MAX_LEN = 120;
  const BLOCK_SEL = 'p, h1, h2, h3, h4, h5, h6, li';
  const SKIP_SEL = 'pre, figure, table, script, style, iframe, .aplayer, .tabs, .gallery, .fj-gallery, .katex-display';
  const IS_CHROME = /Chrome/.test(navigator.userAgent) && !/Edg|OPR/.test(navigator.userAgent);

  const t = (key, fallback) => {
    const cfg = typeof GLOBAL_CONFIG !== 'undefined' && GLOBAL_CONFIG.readAloud;
    return (cfg && cfg[key]) || fallback;
  };

  const state = {
    chunks: [],
    idx: 0,
    status: 'idle', // idle | playing | paused
    rateIndex: 1,
    voice: null,
    bar: null,
    playBtn: null,
    rateBtn: null,
    activeEl: null,
    speakToken: 0,
    keepAlive: null
  };

  const pickVoice = () => {
    const voices = synth.getVoices();
    if (!voices.length) return;
    const lang = (document.documentElement.lang || 'zh-CN').toLowerCase();
    state.voice =
      voices.find(v => v.lang && v.lang.toLowerCase() === lang) ||
      voices.find(v => v.lang && v.lang.toLowerCase().startsWith(lang.split('-')[0])) ||
      voices.find(v => v.lang && v.lang.toLowerCase().startsWith('zh')) ||
      voices[0];
  };
  pickVoice();
  if (typeof synth.addEventListener === 'function') {
    synth.addEventListener('voiceschanged', pickVoice);
  } else {
    synth.onvoiceschanged = pickVoice;
  }

  const splitText = text => {
    const sentences = text.match(/[^。！？!?；;.]+[。！？!?；;.]*["'”’）)]*|[^。！？!?；;.]+$/g) || [text];
    const parts = [];
    let buf = '';
    for (const s of sentences) {
      if (buf && (buf + s).length > MAX_LEN) {
        parts.push(buf);
        buf = '';
      }
      buf += s;
    }
    if (buf.trim()) parts.push(buf);
    return parts.filter(p => p.trim());
  };

  const collectChunks = () => {
    const container = document.getElementById('article-container');
    if (!container) return [];
    const chunks = [];
    const titleEl = document.getElementById('CrawlerTitle');
    if (titleEl && titleEl.textContent.trim()) {
      chunks.push({ el: titleEl, text: titleEl.textContent.trim() });
    }
    container.querySelectorAll(BLOCK_SEL).forEach(el => {
      if (el.closest(SKIP_SEL)) return;
      if (el.parentElement && el.parentElement.closest(BLOCK_SEL)) return;
      const text = el.textContent.replace(/\s+/g, ' ').trim();
      if (!text) return;
      splitText(text).forEach(part => chunks.push({ el, text: part }));
    });
    return chunks;
  };

  const highlight = el => {
    if (state.activeEl) state.activeEl.classList.remove('read-aloud-active');
    state.activeEl = el;
    if (el) {
      el.classList.add('read-aloud-active');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const startKeepAlive = () => {
    stopKeepAlive();
    if (!IS_CHROME) return;
    state.keepAlive = setInterval(() => {
      if (state.status === 'playing' && synth.speaking && !synth.paused) {
        synth.pause();
        synth.resume();
      }
    }, 10000);
  };

  const stopKeepAlive = () => {
    if (state.keepAlive) {
      clearInterval(state.keepAlive);
      state.keepAlive = null;
    }
  };

  const speak = idx => {
    const token = ++state.speakToken;
    synth.cancel();
    if (idx >= state.chunks.length) {
      stop();
      return;
    }
    state.idx = Math.max(0, idx);
    const chunk = state.chunks[state.idx];
    const u = new SpeechSynthesisUtterance(chunk.text);
    if (state.voice) u.voice = state.voice;
    u.lang = (state.voice && state.voice.lang) || document.documentElement.lang || 'zh-CN';
    u.rate = RATES[state.rateIndex];
    u.onend = () => {
      if (token !== state.speakToken || state.status !== 'playing') return;
      speak(state.idx + 1);
    };
    u.onerror = e => {
      if (e.error === 'canceled' || e.error === 'interrupted') return;
      if (token === state.speakToken && state.status === 'playing') speak(state.idx + 1);
    };
    highlight(chunk.el);
    synth.speak(u);
  };

  const updateUI = () => {
    const { playBtn, rateBtn } = state;
    if (playBtn) {
      const icon = playBtn.querySelector('i');
      if (state.status === 'playing') {
        icon.className = 'luviciifont luvicii-icon-pause';
        playBtn.title = t('pause', '暂停');
      } else {
        icon.className = 'luviciifont luvicii-icon-play';
        playBtn.title = t('play', '播放');
      }
    }
    if (rateBtn) rateBtn.textContent = RATES[state.rateIndex] + 'x';
  };

  const play = () => {
    if (!state.chunks.length) return;
    if (state.status === 'paused') {
      state.status = 'playing';
      synth.resume();
    } else {
      state.status = 'playing';
      speak(state.idx);
    }
    startKeepAlive();
    updateUI();
  };

  const pause = () => {
    if (state.status !== 'playing') return;
    state.status = 'paused';
    synth.pause();
    updateUI();
  };

  const stop = () => {
    state.status = 'idle';
    state.speakToken++;
    stopKeepAlive();
    synth.cancel();
    highlight(null);
    state.idx = 0;
    updateUI();
  };

  const openBar = () => {
    state.chunks = collectChunks();
    if (!state.chunks.length) return;
    state.bar.style.display = '';
    state.idx = 0;
    play();
  };

  const closeBar = () => {
    stop();
    if (state.bar) state.bar.style.display = 'none';
  };

  const createBar = () => {
    if (state.bar) return;
    const bar = document.createElement('div');
    bar.id = 'read-aloud-bar';
    bar.style.display = 'none';
    bar.innerHTML =
      '<button type="button" class="ra-prev" title="' + t('prev', '上一段') + '"><i class="luviciifont luvicii-icon-backward"></i></button>' +
      '<button type="button" class="ra-play" title="' + t('play', '播放') + '"><i class="luviciifont luvicii-icon-play"></i></button>' +
      '<button type="button" class="ra-next" title="' + t('next', '下一段') + '"><i class="luviciifont luvicii-icon-forward"></i></button>' +
      '<button type="button" class="ra-rate" title="' + t('speed', '语速') + '">1x</button>' +
      '<button type="button" class="ra-close" title="' + t('close', '关闭') + '"><i class="luviciifont luvicii-icon-xmark"></i></button>';
    document.body.appendChild(bar);

    state.bar = bar;
    state.playBtn = bar.querySelector('.ra-play');
    state.rateBtn = bar.querySelector('.ra-rate');

    bar.querySelector('.ra-prev').addEventListener('click', () => {
      if (state.status === 'idle') return;
      state.status = 'playing';
      speak(state.idx - 1);
      startKeepAlive();
      updateUI();
    });
    state.playBtn.addEventListener('click', () => {
      state.status === 'playing' ? pause() : play();
    });
    bar.querySelector('.ra-next').addEventListener('click', () => {
      if (state.status === 'idle') return;
      state.status = 'playing';
      speak(state.idx + 1);
      startKeepAlive();
      updateUI();
    });
    state.rateBtn.addEventListener('click', () => {
      state.rateIndex = (state.rateIndex + 1) % RATES.length;
      if (state.status !== 'idle') {
        state.status = 'playing';
        speak(state.idx);
        startKeepAlive();
      }
      updateUI();
    });
    bar.querySelector('.ra-close').addEventListener('click', closeBar);
  };

  const init = () => {
    const btn = document.getElementById('read-aloud-btn');
    if (!btn || !document.getElementById('article-container')) {
      closeBar();
      return;
    }
    createBar();
    if (!btn.dataset.raBound) {
      btn.dataset.raBound = '1';
      btn.addEventListener('click', () => {
        if (!state.bar) return;
        if (state.bar.style.display === 'none') openBar();
        else if (state.status === 'playing') pause();
        else play();
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  document.addEventListener('pjax:complete', init);
  document.addEventListener('pjax:send', closeBar);
  window.addEventListener('beforeunload', stop);
})();
