// ===== 共通部分：データ・文の表示・読み上げ・保存・画面の切り替え =====
// 保存するのは「設定・練習の記録・自分で足した単語とQ&A・お知らせ写真」だけ。お客さんの情報は保存しない。
const App = (() => {
  'use strict';

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const data = { P: null, Q: null };

  // ---------- 文字の処理 ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<span class="icon i-${name} ${cls}" aria-hidden="true"></span>`;

  // ひらがな・カタカナ・大文字小文字・空白の違いを無視して検索するための正規化
  const norm = (s) => String(s ?? '').toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/\{([^{}|]+)\|([^{}]+)\}/g, '$1$2')
    .replace(/[\s　、。・,.!?！？「」（）()*]/g, '');

  // ---------- 保存（端末の中だけ） ----------
  const LS = {
    get(k, d) { try { const v = localStorage.getItem('dc:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('dc:' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  };

  const idb = {
    _db: null,
    open() {
      if (!this._db) this._db = new Promise((res, rej) => {
        const r = indexedDB.open('denki-card', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('files');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      return this._db;
    },
    async req(mode, fn) {
      try {
        const db = await this.open();
        return await new Promise((res) => {
          const st = db.transaction('files', mode).objectStore('files');
          const r = fn(st);
          r.onsuccess = () => res(r.result ?? null);
          r.onerror = () => res(null);
        });
      } catch (e) { return null; }
    },
    get(k) { return this.req('readonly', (s) => s.get(k)); },
    set(k, v) { return this.req('readwrite', (s) => s.put(v, k)); },
    del(k) { return this.req('readwrite', (s) => s.delete(k)); },
  };

  // ---------- 設定 ----------
  function settings() {
    const d = data.P.defaults;
    const s = LS.get('settings', {});
    return {
      minutes: s.minutes ?? d.minutes,
      company: (s.company ?? d.company ?? '').trim(),
      phone: (s.phone ?? d.phone ?? '').trim(),
      rate: s.rate ?? 0.9,
      rateSlow: s.rateSlow ?? 0.6,
    };
  }
  function saveSettings(patch) { LS.set('settings', Object.assign(LS.get('settings', {}), patch)); }

  let photoURL = null;
  async function noticePhotoURL() {
    if (photoURL) return photoURL;
    const blob = await idb.get('notice');
    photoURL = blob ? URL.createObjectURL(blob) : 'img/notice-sample.svg';
    return photoURL;
  }
  function resetPhotoURL() { if (photoURL && photoURL.startsWith('blob:')) URL.revokeObjectURL(photoURL); photoURL = null; }

  // ---------- フレーズの文を取り出す ----------
  // key: staff=ふつうの日本語 easy=やさしい日本語 en=英語 kana=カタカナ zh=中国語
  function pick(obj, key) {
    if (!obj) return '';
    if (obj.ifNoCompany && !settings().company && obj.ifNoCompany[key] != null) return obj.ifNoCompany[key];
    return obj[key] ?? '';
  }

  // {minutes}{company}{client}{phone} を設定の値に置き換える（HTMLエスケープ済みで返す）
  function fillEsc(text, key, { forStaff = false } = {}) {
    const s = settings();
    const client = data.P.defaults.client;
    const vals = {
      minutes: String(s.minutes),
      company: s.company || (forStaff ? '（会社名）' : ''),
      client: client[key] ?? client.en,
      phone: s.phone || (forStaff || key === 'staff' ? '（番号未設定）' : ''),
    };
    return esc(text).replace(/\{(minutes|company|client|phone)\}/g, (_, k) => esc(vals[k]));
  }

  // 画面に出すHTML（ふりがな・強く言うところの太字）
  function html(text, key) {
    let h = fillEsc(text, key);
    h = h.replace(/\{([^{}|]+)\|([^{}]+)\}/g, '<ruby>$1<rt>$2</rt></ruby>');
    if (key === 'kana') h = h.replace(/\*([^*]+)\*/g, '<b>$1</b>');
    return h;
  }

  // 読み上げ用のふつうの文字（ふりがなは読みに、記号は取る）
  function plain(text, key) {
    const tmp = document.createElement('div');
    tmp.innerHTML = fillEsc(text, key).replace(/\{([^{}|]+)\|([^{}]+)\}/g, '$2');
    return tmp.textContent.replace(/\*/g, '').replace(/（[^）]*）/g, (m) => (key === 'en' ? m : m));
  }

  const langKey = (lang) => (lang === 'ja' ? 'easy' : lang);       // 見せるモードの言語 → 文のキー
  const reviewed = (o, k) => (o && o.review || []).includes(k);

  // ---------- 読み上げ（Web Speech API） ----------
  const speech = (() => {
    const synth = window.speechSynthesis;
    const TAG = { ja: 'ja-JP', en: 'en-US', zh: 'zh-CN' };
    let voices = [];
    let activeBtn = null;
    const load = () => { voices = synth ? synth.getVoices() : []; };
    if (synth) { load(); synth.addEventListener?.('voiceschanged', load); }

    function voiceFor(lang) {
      const t = TAG[lang].toLowerCase();
      const vs = voices.map((v) => ({ v, l: v.lang.replace('_', '-').toLowerCase() }));
      const exact = vs.filter((x) => x.l === t);
      const pool = exact.length ? exact : vs.filter((x) => x.l.startsWith(t.slice(0, 2)) && !(lang === 'zh' && /tw|hk/.test(x.l)));
      const best = pool.find((x) => x.v.localService) || pool[0];
      return best ? best.v : null;
    }

    function clearActive() { if (activeBtn) activeBtn.classList.remove('speaking'); activeBtn = null; }

    function stop() { if (synth) synth.cancel(); clearActive(); }

    function speak(text, lang, { slow = false, btn = null } = {}) {
      if (!synth) { toast('この端末は読み上げに対応していません'); return; }
      if (btn && btn === activeBtn) { stop(); return; }   // 読み上げ中にもう一度押すと止まる
      stop();
      const s = settings();
      const parts = String(text).match(/[^.!?。！？]+[.!?。！？]*/g) || [text];
      let i = 0;
      if (btn) { activeBtn = btn; btn.classList.add('speaking'); }
      const next = () => {
        if (i >= parts.length) { clearActive(); return; }
        const u = new SpeechSynthesisUtterance(parts[i++].trim());
        u.lang = TAG[lang];
        const v = voiceFor(lang);
        if (v) u.voice = v;
        u.rate = slow ? s.rateSlow : s.rate;
        u.onend = next;
        u.onerror = clearActive;
        synth.speak(u);
      };
      next();
    }

    // 音声認識（発音チェック・音声入力）
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    function listen(lang) {
      return new Promise((resolve, reject) => {
        if (!SR) { reject(new Error('unsupported')); return; }
        stop();
        const r = new SR();
        r.lang = TAG[lang];
        r.interimResults = false;
        r.maxAlternatives = 3;
        let done = false;
        r.onresult = (e) => { done = true; resolve([...e.results[0]].map((a) => a.transcript)); };
        r.onerror = (e) => { if (!done) { done = true; reject(new Error(e.error)); } };
        r.onend = () => { if (!done) { done = true; reject(new Error('no-speech')); } };
        r.start();
      });
    }

    return { speak, stop, listen, canSpeak: !!synth, canListen: !!SR, voiceFor, TAG };
  })();

  // ---------- 小さなお知らせ・全画面表示・下から出るシート ----------
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  function animateIn(el, kind = 'fade') {
    if (reduceMotion.matches || !window.Motion || !el) return;
    const k = {
      fade: { opacity: [0, 1], transform: ['translateY(8px)', 'translateY(0)'] },
      right: { opacity: [0, 1], transform: ['translateX(20px)', 'translateX(0)'] },
      left: { opacity: [0, 1], transform: ['translateX(-20px)', 'translateX(0)'] },
      pop: { opacity: [0, 1], transform: ['scale(.96)', 'scale(1)'] },
      up: { transform: ['translateY(100%)', 'translateY(0)'] },
    }[kind];
    Motion.animate(el, k, { duration: kind === 'up' ? 0.3 : 0.25, easing: 'ease-out' });
  }

  // 全画面（タップで閉じる）: お客さんの返事など
  function overlay(inner, { closeOnTap = true, onMount } = {}) {
    const ov = $('#overlay');
    $('#overlay-content').innerHTML = inner;
    ov.hidden = false;
    ov.dataset.tapclose = closeOnTap ? '1' : '';
    $('#overlay-hint').hidden = !closeOnTap;
    animateIn(ov.firstElementChild, 'pop');
    if (onMount) onMount($('#overlay-content'));
  }
  function closeOverlay() { $('#overlay').hidden = true; speech.stop(); }

  // 下から出るシート（一覧など）
  function sheet(title, inner, onMount) {
    const sh = $('#sheet');
    $('#sheet-title').textContent = title;
    $('#sheet-body').innerHTML = inner;
    sh.hidden = false;
    $('#sheet-body').scrollTop = 0;
    animateIn($('#sheet-panel'), 'up');
    if (onMount) onMount($('#sheet-body'));
  }
  function closeSheet() { $('#sheet').hidden = true; speech.stop(); }

  // ---------- 画面の切り替え（#show-en-3 のような形） ----------
  const views = {};
  let lastDir = 'fade';
  function route(name, fn) { views[name] = fn; }
  function go(hash, dir = 'fade') { lastDir = dir; if (location.hash === '#' + hash) render(); else location.hash = hash; }

  function render() {
    closeOverlay(); closeSheet(); speech.stop();
    const parts = (location.hash.slice(1) || 'home').split('-');
    const name = views[parts[0]] ? parts[0] : 'home';
    const el = $('#view');
    el.className = 'view view-' + name;
    views[name](el, parts.slice(1));
    window.scrollTo(0, 0);
    animateIn(el, lastDir);
    lastDir = 'fade';
  }

  // ---------- 共通のクリック（読み上げボタンなど） ----------
  function bindGlobal() {
    document.addEventListener('click', (e) => {
      const say = e.target.closest('[data-say]');
      if (say) { e.stopPropagation(); speech.speak(say.dataset.say, say.dataset.lang || 'en', { slow: say.dataset.slow === '1', btn: say }); return; }
      const goBtn = e.target.closest('[data-go]');
      if (goBtn) { go(goBtn.dataset.go, goBtn.dataset.dir || 'fade'); }
    });
    $('#overlay').addEventListener('click', (e) => {
      if ($('#overlay').dataset.tapclose && !e.target.closest('[data-say],button,a,input')) closeOverlay();
    });
    $('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet' || e.target.closest('#sheet-close')) closeSheet(); });
    window.addEventListener('hashchange', render);
  }

  // 読み上げボタン（ふつう・ゆっくり）
  function sayBtns(text, lang = 'en', { slow = true, label = true } = {}) {
    if (!text) return '';
    const t = esc(text);
    return `<button type="button" class="say-btn" data-say="${t}" data-lang="${lang}" aria-label="読み上げ">${icon('volume-2')}${label ? '<span>ふつう</span>' : ''}</button>` +
      (slow ? `<button type="button" class="say-btn slow" data-say="${t}" data-lang="${lang}" data-slow="1" aria-label="ゆっくり読み上げ">${icon('turtle')}${label ? '<span>ゆっくり</span>' : ''}</button>` : '');
  }

  // 上のバー（ホームへ・タイトル・右側のボタン）
  function topBar(title, right = '', back = 'home') {
    return `<header class="topbar">
      <button type="button" class="tb-btn" data-go="${back}" data-dir="left" aria-label="戻る">${icon(back === 'home' ? 'house' : 'arrow-left')}<span>${back === 'home' ? 'ホーム' : '戻る'}</span></button>
      <h1 class="tb-title">${title}</h1>
      <div class="tb-right">${right}</div>
    </header>`;
  }

  // ---------- 練習の記録・自分の単語・自分のQ&A ----------
  const progress = {
    all() { return LS.get('progress', {}); },
    mark(id, ok) {
      const p = this.all();
      const r = p[id] || { ok: 0, ng: 0 };
      if (ok) r.ok++; else r.ng++;
      r.lastOk = ok;
      p[id] = r;
      LS.set('progress', p);
    },
    mastered() { return Object.values(this.all()).filter((r) => r.lastOk).length; },
    reset() { LS.set('progress', {}); LS.set('today', null); },
  };

  const userWords = {
    all() { return LS.get('words', []); },
    save(list) { return LS.set('words', list); },
  };
  const userQA = {
    all() { return LS.get('qa', []); },
    save(list) { return LS.set('qa', list); },
  };
  const newId = () => 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  // ---------- CSV ----------
  function toCSV(rows) {
    return '﻿' + rows.map((r) => r.map((v) => {
      v = String(v ?? '');
      return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }).join(',')).join('\r\n');
  }
  function parseCSV(text) {
    text = text.replace(/^﻿/, '');
    const rows = []; let row = []; let f = ''; let q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
        else f += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(f); rows.push(row); row = []; f = '';
      } else f += c;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    return rows.filter((r) => r.some((x) => x.trim() !== ''));
  }
  function download(name, text) {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // ---------- 要確認の数 ----------
  function reviewCount() {
    const P = data.P, Q = data.Q;
    const list = [...P.phrases, ...P.choices, ...P.replies, ...P.faq, ...P.breaker, ...P.words, ...(Q ? Q.items : [])];
    return list.filter((x) => (x.review || []).length).length;
  }

  // ---------- 起動 ----------
  async function init() {
    try {
      const [p, q] = await Promise.all([
        fetch('phrases.json', { cache: 'no-cache' }).then((r) => r.json()),
        fetch('qa.json', { cache: 'no-cache' }).then((r) => r.json()),
      ]);
      data.P = p; data.Q = q;
    } catch (e) {
      $('#view').innerHTML = '<p class="fatal">文のファイル（phrases.json / qa.json）を読み込めませんでした。<br>電波のある場所で、もう一度開いてください。</p>';
      return;
    }
    bindGlobal();
    render();
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  return {
    $, $$, esc, icon, norm, data, LS, idb, settings, saveSettings, noticePhotoURL, resetPhotoURL,
    pick, html, plain, langKey, reviewed, speech, toast, overlay, closeOverlay, sheet, closeSheet,
    animateIn, route, go, render, sayBtns, topBar, progress, userWords, userQA, newId,
    toCSV, parseCSV, download, reviewCount, init,
  };
})();
