// ===== 見せるモード（お客さんに画面を見せる） =====
(() => {
  'use strict';
  const { $, esc, icon, html, plain, pick, langKey } = App;
  const NUM = '①②③④⑤⑥⑦⑧⑨⑩';
  let resultPick = null;

  // お客さん向けのボタンの文字（言語ごと）
  const UI = {
    choose:  { ja: 'ことばを えらんで ください', en: 'Please choose your language', zh: '请选择语言' },
    listen:  { ja: 'よみあげる', en: 'Listen', zh: '朗读' },
    breaker: { ja: 'ブレーカーの せつめい', en: 'About the breaker box', zh: '配电箱说明' },
    tapNo:   { ja: 'ばんごうを おして ください', en: 'Tap a number', zh: '请点击编号' },
    faqTitle:{ ja: 'よく ある しつもん', en: 'Questions', zh: '常见问题' },
  };
  const ui = (k, lang) => UI[k][lang] || UI[k].en;

  const P = () => App.data.P;
  const flow = () => P().scenes.filter((s) => s.flow).sort((a, b) => a.flow - b.flow);
  const showPhrases = (sceneId) => P().phrases.filter((p) => p.scene === sceneId && (p.modes || []).includes('show'));
  const byId = (id) => P().phrases.find((p) => p.id === id);

  function lineHTML(p, lang) {
    const key = langKey(lang);
    let h = `<div class="line"><p class="cust" lang="${lang}">${html(pick(p, key), key)}</p>`;
    if (lang !== 'ja') h += `<p class="staff" lang="ja">${html(pick(p, 'staff'), 'staff')}</p>`;
    return h + '</div>';
  }
  const speakText = (list, lang) => list.map((p) => App.plain(pick(p, langKey(lang)), langKey(lang))).join(' ');

  App.route('show', (el, args) => {
    const [lang, step] = args;
    if (!lang || !P().langs[lang]) return langSelect(el);
    if (step === 'breaker') return breaker(el, lang);
    const n = Math.max(1, Math.min(flow().length, parseInt(step, 10) || 1));
    card(el, lang, n);
  });

  // ---------- 言語を選ぶ ----------
  function langSelect(el) {
    resultPick = null;
    const L = P().langs;
    el.innerHTML = `
      ${App.topBar('見せるモード')}
      <div class="lang-select">
        <div class="ls-head">
          ${icon('presentation', 'ls-icon')}
          <h2><span lang="ja">${ui('choose', 'ja')}</span><span class="sub" lang="en">${ui('choose', 'en')}</span><span class="sub" lang="zh">${ui('choose', 'zh')}</span></h2>
        </div>
        <div class="lang-buttons">
          ${Object.entries(L).map(([code, info]) => `
            <button type="button" class="lang-btn" data-go="show-${code}-1" data-dir="right">
              <span class="big" lang="${code}">${esc(info.label)}</span><span class="small">${esc(info.sub)}</span>
            </button>`).join('')}
        </div>
      </div>`;
  }

  // ---------- 一本道のカード ----------
  function card(el, lang, n) {
    const scenes = flow();
    const scene = scenes[n - 1];
    const key = langKey(lang);
    let body = `<div class="card-icon">${icon(scene.icon)}</div>`;
    let readList = [];

    if (scene.id === 'notice') body += '<img class="photo" id="notice-photo" alt="お知らせの写真" src="">';

    if (scene.id === 'result') {
      if (!resultPick) {
        body += `<p class="pick-title">結果を選んでください<br><small>（お客さんに見せる前に）</small></p><div class="pick">` +
          P().results.map((r) => `<button type="button" class="pick-btn ${r.tone}" data-result="${r.id}">${icon(r.icon)}${esc(r.button)}</button>`).join('') + '</div>';
      } else {
        const r = P().results.find((x) => x.id === resultPick);
        readList = r.phrases.map(byId).filter(Boolean);
        body += `<div class="result-banner ${r.tone}">${icon(r.icon, 'r-icon')}${readList.map((p) => lineHTML(p, lang)).join('')}</div>
          <button type="button" class="link-btn" data-result="">${icon('rotate-ccw')}選びなおす</button>`;
      }
    } else {
      readList = showPhrases(scene.id);
      body += readList.map((p) => lineHTML(p, lang)).join('');
    }

    if (scene.id === 'question') {
      body += '<div class="choices">' + P().choices.map((c) => `
        <button type="button" class="choice" data-choice="${c.id}">
          ${icon(c.icon)}
          <span class="c-cust" lang="${lang}">${html(c[key], key)}</span>
          ${lang !== 'ja' ? `<span class="c-staff" lang="ja">${html(c.staff, 'staff')}</span>` : ''}
        </button>`).join('') + '</div>';
    }

    if (scene.breakerLink) {
      body += `<button type="button" class="breaker-link" data-go="show-${lang}-breaker" data-dir="right">
        ${icon('panel-top')}<span><span lang="${lang}">${esc(ui('breaker', lang))}</span>${lang !== 'ja' ? '<small>分電盤の説明</small>' : ''}</span>${icon('chevron-right')}</button>`;
    }

    if (readList.length) {
      body += `<button type="button" class="listen-btn" data-say="${esc(speakText(readList, lang))}" data-lang="${lang}">
        ${icon('volume-2')}<span lang="${lang}">${esc(ui('listen', lang))}</span></button>`;
    }

    const last = n === scenes.length;
    el.innerHTML = `
      <section class="show-card">
        <header class="staff-bar">
          <button type="button" class="tb-btn" data-go="home" aria-label="ホーム">${icon('house')}</button>
          <div class="progress"><span class="step">${NUM[n - 1]} ${n}/${scenes.length}</span><span class="name">${esc(scene.title)}</span></div>
          <button type="button" class="tb-btn" id="btn-toc">${icon('list')}<span>目次</span></button>
          <button type="button" class="tb-btn" id="btn-faq">${icon('circle-help')}<span>質問</span></button>
        </header>
        <div class="dots" aria-hidden="true">${scenes.map((_, i) => `<span class="${i < n ? 'done' : ''}"></span>`).join('')}</div>
        <main class="card-body" id="card-body">${body}</main>
        ${replyBar(lang)}
        <nav class="nav-bar">
          <button type="button" class="nav-btn back" data-go="${n === 1 ? 'show' : `show-${lang}-${n - 1}`}" data-dir="left">${icon('chevron-left')}<span>戻る</span></button>
          <button type="button" class="nav-btn next" data-go="${last ? 'show' : `show-${lang}-${n + 1}`}" data-dir="right"><span>${last ? '終わる' : '次へ'}</span>${icon(last ? 'check' : 'chevron-right')}</button>
        </nav>
      </section>`;

    if (scene.id === 'notice') App.noticePhotoURL().then((u) => { const img = $('#notice-photo'); if (img) img.src = u; });

    $('#card-body').addEventListener('click', (e) => {
      const ch = e.target.closest('[data-choice]');
      if (ch) { showAnswer(P().choices.find((c) => c.id === ch.dataset.choice), lang, 'お客さんの答え'); return; }
      const rs = e.target.closest('[data-result]');
      if (rs) { resultPick = rs.dataset.result || null; card(el, lang, n); App.animateIn($('#card-body'), 'fade'); }
    });
    bindCommon(el, lang);
  }

  // ---------- 返事ボタン ----------
  function replyBar(lang) {
    const key = langKey(lang);
    return `<div class="reply-bar">` + P().replies.map((r) => `
      <button type="button" class="reply-btn" data-reply="${r.id}">
        <span class="r-cust" lang="${lang}">${html(r[key], key)}</span>
        ${lang !== 'ja' ? `<span class="r-staff">${esc(r.staff)}</span>` : ''}
      </button>`).join('') + '</div>';
  }

  // お客さんの返事・答えを全画面で（日本語も大きく）
  function showAnswer(item, lang, label) {
    const key = langKey(lang);
    App.overlay(`
      ${item.icon ? icon(item.icon, 'o-icon') : ''}
      <p class="o-cust" lang="${lang}">${html(item[key], key)}</p>
      <p class="o-ja" lang="ja"><small>${esc(label)}</small>${html(item.staff, 'staff')}</p>`);
  }

  function bindCommon(el, lang) {
    el.querySelectorAll('[data-reply]').forEach((b) => b.addEventListener('click', () => {
      showAnswer(P().replies.find((r) => r.id === b.dataset.reply), lang, 'お客さんの返事');
    }));
    const toc = el.querySelector('#btn-toc');
    if (toc) toc.addEventListener('click', () => openToc(lang));
    const faq = el.querySelector('#btn-faq');
    if (faq) faq.addEventListener('click', () => openFaq(lang));
  }

  // ---------- 目次 ----------
  function openToc(lang) {
    const items = flow().map((s, i) => `
      <button type="button" class="toc-item" data-go="show-${lang}-${i + 1}">
        <span class="toc-no">${NUM[i]}</span>${icon(s.icon)}<span>${esc(s.title)}</span></button>`).join('');
    App.sheet('目次', `<div class="toc">${items}
      <button type="button" class="toc-item" data-go="show-${lang}-breaker"><span class="toc-no">＋</span>${icon('panel-top')}<span>分電盤の説明</span></button>
      <button type="button" class="toc-item" id="toc-faq"><span class="toc-no">＋</span>${icon('circle-help')}<span>よくある質問</span></button>
      <button type="button" class="toc-item" data-go="show"><span class="toc-no">＋</span>${icon('rotate-ccw')}<span>言語を選びなおす</span></button>
    </div>`, (b) => { b.querySelector('#toc-faq').addEventListener('click', () => openFaq(lang)); });
  }

  // ---------- よくある質問 ----------
  function openFaq(lang) {
    const key = langKey(lang);
    const items = P().faq.map((f) => `
      <button type="button" class="faq-item" data-faq="${f.id}">
        ${icon(f.icon)}
        <span><span class="f-cust" lang="${lang}">${html(f.q[key], key)}</span>
        ${lang !== 'ja' ? `<small>${html(f.q.staff, 'staff')}</small>` : ''}</span></button>`).join('');
    App.sheet(`よくある質問`, `<div class="faq-list">${items}</div>`, (b) => {
      b.querySelectorAll('[data-faq]').forEach((btn) => btn.addEventListener('click', () => showFaq(P().faq.find((f) => f.id === btn.dataset.faq), lang)));
    });
  }

  function showFaq(f, lang) {
    const key = langKey(lang);
    const s = App.settings();
    let extra = '';
    if (f.id === 'faq.scam') {
      extra = `<div class="contact-box">
        ${s.company ? `<p class="cb-company">${esc(s.company)}</p>` : ''}
        <p class="cb-phone">${s.phone ? esc(s.phone) : '<span class="cb-none">（電話番号は設定で入れてください）</span>'}</p></div>`;
    }
    App.closeSheet();
    App.overlay(`
      ${icon(f.icon, 'o-icon')}
      <p class="o-q" lang="${lang}">${html(f.q[key], key)}</p>
      <p class="o-cust" lang="${lang}">${html(f.a[key], key)}</p>
      ${extra}
      ${lang !== 'ja' ? `<p class="o-staff">${html(f.a.staff, 'staff')}</p>` : ''}
      <button type="button" class="listen-btn" data-say="${esc(App.plain(f.a[key], key))}" data-lang="${lang}">${icon('volume-2')}<span lang="${lang}">${esc(ui('listen', lang))}</span></button>`);
  }

  // ---------- 分電盤の説明 ----------
  function breaker(el, lang) {
    const key = langKey(lang);
    const panelStep = flow().findIndex((s) => s.breakerLink) + 1 || 1;
    const B = P().breaker;
    el.innerHTML = `
      <section class="show-card">
        <header class="staff-bar">
          <button type="button" class="tb-btn" data-go="show-${lang}-${panelStep}" data-dir="left">${icon('arrow-left')}<span>カードに戻る</span></button>
          <div class="progress"><span class="name">分電盤の説明</span></div>
          <button type="button" class="tb-btn" id="btn-faq">${icon('circle-help')}<span>質問</span></button>
        </header>
        <main class="card-body breaker-body">
          <p class="cust small-cust" lang="${lang}">${esc(ui('tapNo', lang))}</p>
          <div class="breaker-img">
            <img src="${esc(P().breakerImage)}" alt="分電盤のイラスト">
            ${B.map((b) => `<button type="button" class="b-marker" data-b="${b.id}" style="left:${b.x}%;top:${b.y}%" aria-label="${esc(b.name.staff)}">${NUM[b.no - 1]}</button>`).join('')}
          </div>
          <div class="b-legend">
            ${B.map((b) => `<button type="button" class="b-leg" data-b="${b.id}"><span class="b-no">${NUM[b.no - 1]}</span><span><span lang="${lang}">${html(b.name[key], key)}</span>${lang !== 'ja' ? `<small>${esc(b.name.staff)}</small>` : ''}</span></button>`).join('')}
          </div>
          <div id="b-desc" class="b-desc" hidden></div>
        </main>
        ${replyBar(lang)}
      </section>`;

    el.querySelectorAll('[data-b]').forEach((btn) => btn.addEventListener('click', () => {
      const b = B.find((x) => x.id === btn.dataset.b);
      el.querySelectorAll('[data-b]').forEach((x) => x.classList.toggle('on', x.dataset.b === b.id));
      const d = $('#b-desc');
      const say = App.plain(b.desc[key], key);
      d.innerHTML = `
        <p class="b-title"><span class="b-no">${NUM[b.no - 1]}</span><span lang="${lang}">${html(b.name[key], key)}</span></p>
        <p class="cust" lang="${lang}">${html(b.desc[key], key)}</p>
        ${lang !== 'ja' ? `<p class="staff">${html(b.desc.staff, 'staff')}</p>` : ''}
        <button type="button" class="listen-btn" id="b-say" data-say="${esc(say)}" data-lang="${lang}">${icon('volume-2')}<span lang="${lang}">${esc(ui('listen', lang))}</span></button>`;
      d.hidden = false;
      App.animateIn(d, 'fade');
      d.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      App.speech.speak(say, lang, { btn: $('#b-say') });
    }));
    bindCommon(el, lang);
  }
})();
