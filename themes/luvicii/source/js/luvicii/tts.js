/**
 * 文章朗读（微软 Edge 神经语音）
 * 音频由 Vercel 代理函数（edge-tts-api/）实时合成，前端按段落分块
 * fetch MP3 后用 <audio> 播放，支持暂停/继续/跳段/调速与预取下一段。
 * 自包含模块：监听 DOMContentLoaded / pjax:complete 幂等初始化，
 * pjax:send / beforeunload 时停止朗读。
 */
(function () {
  'use strict';

  const cfg = typeof GLOBAL_CONFIG !== 'undefined' ? GLOBAL_CONFIG.readAloud : undefined;
  if (!cfg || !cfg.api) return;

  const RATES = [
    { label: '0.75x', prosody: '-25%' },
    { label: '1x', prosody: '+0%' },
    { label: '1.25x', prosody: '+25%' },
    { label: '1.5x', prosody: '+50%' },
    { label: '2x', prosody: '+100%' }
  ];
  const MAX_LEN = 120;
  const BLOCK_SEL = 'p, h1, h2, h3, h4, h5, h6, li';
  const SKIP_SEL = 'pre, figure, table, script, style, iframe, .aplayer, .tabs, .gallery, .fj-gallery, .katex-display';

  const t = (key, fallback) => cfg[key] || fallback;

  const docLang = (document.documentElement.lang || 'zh-CN').toLowerCase();
  const voice =
    cfg.voice ||
    (docLang.startsWith('zh-tw') || docLang.startsWith('zh-hk')
      ? 'zh-TW-HsiaoChenNeural'
      : docLang.startsWith('zh')
        ? 'zh-CN-XiaoxiaoNeural'
        : 'en-US-JennyNeural');

  const state = {
    chunks: [],
    idx: 0,
    status: 'idle', // idle | playing | paused
    rateIndex: 1,
    bar: null,
    playBtn: null,
    rateBtn: null,
    activeEl: null,
    speakToken: 0,
    cache: new Map(), // idx -> Promise<Blob>
    audio: new Audio(),
    blobUrl: null
  };
  state.audio.preload = 'auto';

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
      if (el === titleEl) return; // 标题已单独收集，避免重复朗读
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

  const synthesize = (text, prosody) => {
    const url =
      cfg.api +
      '?text=' + encodeURIComponent(text) +
      '&voice=' + encodeURIComponent(voice) +
      '&rate=' + encodeURIComponent(prosody);
    return fetch(url).then(r => {
      if (!r.ok) throw new Error('tts http ' + r.status);
      return r.blob();
    });
  };

  const prefetch = idx => {
    if (idx >= state.chunks.length || state.cache.has(idx)) return;
    const p = synthesize(state.chunks[idx].text, RATES[state.rateIndex].prosody).catch(e => {
      state.cache.delete(idx);
      throw e;
    });
    state.cache.set(idx, p);
  };

  const clearCache = () => {
    state.cache.clear();
  };

  const errorNotify = () => {
    const msg = t('error', '语音合成失败，请稍后再试');
    if (typeof luvicii !== 'undefined' && luvicii.snackbarShow) luvicii.snackbarShow(msg);
    else console.warn('[read-aloud]', msg);
  };

  const setLoading = on => {
    if (!state.playBtn) return;
    const icon = state.playBtn.querySelector('i');
    if (on) {
      state.playBtn.dataset.loading = '1';
      icon.className = 'luviciifont luvicii-icon-spinner ra-spin';
    } else {
      delete state.playBtn.dataset.loading;
    }
  };

  const updateUI = () => {
    const { playBtn, rateBtn } = state;
    if (playBtn) {
      if (!playBtn.dataset.loading) {
        const icon = playBtn.querySelector('i');
        if (state.status === 'playing') {
          icon.className = 'luviciifont luvicii-icon-pause';
          playBtn.title = t('pause', '暂停');
        } else {
          icon.className = 'luviciifont luvicii-icon-play';
          playBtn.title = t('play', '播放');
        }
      }
    }
    if (rateBtn) rateBtn.textContent = RATES[state.rateIndex].label;
  };

  const releaseAudio = () => {
    state.audio.pause();
    state.audio.removeAttribute('src');
    state.audio.load();
    if (state.blobUrl) {
      URL.revokeObjectURL(state.blobUrl);
      state.blobUrl = null;
    }
  };

  const speak = async idx => {
    const token = ++state.speakToken;
    if (idx >= state.chunks.length) {
      stop();
      return;
    }
    state.idx = Math.max(0, idx);
    const chunk = state.chunks[state.idx];
    highlight(chunk.el);
    setLoading(true);
    try {
      prefetch(state.idx);
      const blob = await state.cache.get(state.idx);
      if (token !== state.speakToken) return;
      releaseAudio();
      state.blobUrl = URL.createObjectURL(blob);
      state.audio.src = state.blobUrl;
      setLoading(false);
      updateUI();
      await state.audio.play();
      if (token !== state.speakToken) return;
      prefetch(state.idx + 1);
    } catch (e) {
      if (token !== state.speakToken) return;
      setLoading(false);
      errorNotify();
      stop();
    }
  };

  state.audio.addEventListener('ended', () => {
    if (state.status === 'playing') speak(state.idx + 1);
  });
  state.audio.addEventListener('error', () => {
    if (state.status === 'playing') {
      errorNotify();
      stop();
    }
  });

  const play = () => {
    if (!state.chunks.length) return;
    if (state.status === 'paused') {
      state.status = 'playing';
      state.audio.play().catch(() => {});
      updateUI();
      return;
    }
    state.status = 'playing';
    speak(state.idx);
    updateUI();
  };

  const pause = () => {
    if (state.status !== 'playing') return;
    state.status = 'paused';
    state.audio.pause();
    updateUI();
  };

  const stop = () => {
    state.status = 'idle';
    state.speakToken++;
    releaseAudio();
    highlight(null);
    state.idx = 0;
    setLoading(false);
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
    clearCache();
    if (state.bar) state.bar.style.display = 'none';
  };

  const jumpTo = idx => {
    if (state.status === 'idle') return;
    state.status = 'playing';
    speak(idx);
    updateUI();
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

    bar.querySelector('.ra-prev').addEventListener('click', () => jumpTo(state.idx - 1));
    state.playBtn.addEventListener('click', () => {
      state.status === 'playing' ? pause() : play();
    });
    bar.querySelector('.ra-next').addEventListener('click', () => jumpTo(state.idx + 1));
    state.rateBtn.addEventListener('click', () => {
      state.rateIndex = (state.rateIndex + 1) % RATES.length;
      clearCache();
      if (state.status !== 'idle') {
        state.status = 'playing';
        speak(state.idx);
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
