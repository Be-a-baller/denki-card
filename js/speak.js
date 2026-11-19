// ===== 話すモード（母本人用のカンペ）＋ フレーズの表示部品 =====
(() => {
  'use strict';
  const { $, esc, icon, html, plain, pick, norm } = App;
  const NUM = '①②③④⑤⑥⑦⑧⑨⑩';
  let lastCard = 1;
  let problemGroup = 0;

  const P = () => App.data.P;
  const flow = () => P().scenes.filter((s) => s.flow).sort((a, b) => a.flow - b.flow);
  const speakPhrases = (sceneId) => P().phrases.filter((p) => p.scene === sceneId && (p.modes || []).includes('speak'));
  const needsReview = (p) => (p.review || []).some((k) => ['en', 'kana', 'enAlt', 'responses'].includes(k));

  // ---------- フレーズ1つの表示（話す・検索・練習で共通） ----------
  function phraseBlock(p, { title = '' } = {}) {
    const en = pick(p, 'en');
    const enPlain = plain(en, 'en');
    const resp = p.responses || [];
    const alts = p.enAlt || [];
    return `
      <article class="pb" data-pid="${esc(p.id)}">
        ${title ? `<p class="pb-title">${title}</p>` : ''}
        <p class="pb-en" lang="en">${html(en, 'en')}</p>
        ${p.kana ? `<p class="pb-kana">${html(pick(p, 'kana'), 'kana')}</p>` : ''}
        <p class="pb-ja">${html(pick(p, 'staff'), 'staff')}</p>
        <div class="pb-actions">
          ${App.sayBtns(enPlain)}
          ${resp.length ? `<button type="button" class="resp-btn" data-resp="${esc(p.id)}">${icon('message-square-text')}<span>こう言われたら</span><b>${resp.length}</b></button>` : ''}
        </div>
        ${alts.length ? `<div class="pb-alts"><p class="alts-head">ほかの言い方</p>` + alts.map((a) => `
          <div class="alt">
            <span class="chip">${esc(a.label)}</span>
            <div class="alt-text"><p class="alt-en" lang="en">${html(a.en, 'en')}</p>${a.kana ? `<p class="alt-kana">${html(a.kana, 'kana')}</p>` : ''}</div>
            ${App.sayBtns(plain(a.en, 'en'), 'en', { slow: false, label: false })}
          </div>`).join('') + '</div>' : ''}
        ${needsReview(p) ? '<span class="rv-tag">要確認</span>' : ''}
      </article>`;
  }
  App.phraseBlock = phraseBlock;

  // 分電盤の説明（話すモードの⑤で、自分の口で説明する用）
  const breakerPhrases = () => P().breaker.map((b) => ({
    id: 'breaker.' + b.id, en: b.desc.en, kana: b.desc.kana, staff: b.desc.staff, review: b.review,
    _title: `${NUM[b.no - 1]} ${esc(b.name.staff)} ＝ <span lang="en">${esc(b.name.en)}</span>`,
  }));

  // 「こう言われたら」シート
  function openResponses(p) {
    const list = (p.responses || []).map((r) => `
      <div class="resp">
        <div class="resp-they">
          <span class="who">お客さん</span>
          <div><p class="they-en" lang="en">${html(r.they, 'en')}</p><p class="they-ja">${esc(r.theyJa)}</p></div>
          ${App.sayBtns(plain(r.they, 'en'), 'en', { slow: false, label: false })}
        </div>
        <div class="resp-say">
          <span class="who me">返し方</span>
          <div><p class="say-en" lang="en">${html(r.say, 'en')}</p>${r.sayKana ? `<p class="say-kana">${html(r.sayKana, 'kana')}</p>` : ''}<p class="say-ja">${html(r.sayJa, 'staff')}</p></div>
        </div>
        <div class="resp-act">${App.sayBtns(plain(r.say, 'en'))}</div>
      </div>`).join('');
    App.sheet('お客さんにこう言われたら', `<p class="sheet-lead">${html(pick(p, 'staff'), 'staff')}</p>${list}`);
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-resp]');
    if (!b) return;
    const p = P().phrases.find((x) => x.id === b.dataset.resp);
    if (p) openResponses(p);
  });

  // ---------- 画面 ----------
  App.route('speak', (el, args) => {
    const a = args[0];
    if (a === 'problem') return problem(el, parseInt(args[1], 10));
    if (a === 'handy') return handy(el);
    if (a === 'search') return search(el);
    card(el, Math.max(1, Math.min(flow().length, parseInt(a, 10) || lastCard)));
  });

  const toolRow = (active = '') => `
    <div class="tool-row">
      <button type="button" class="tool ${active === 'problem' ? 'on' : ''}" data-go="speak-problem">${icon('triangle-alert')}<span>問題があったとき</span></button>
      <button type="button" class="tool ${active === 'handy' ? 'on' : ''}" data-go="speak-handy">${icon('message-circle')}<span>困ったときの一言</span></button>
      <button type="button" class="tool ${active === 'search' ? 'on' : ''}" data-go="speak-search">${icon('search')}<span>検索</span></button>
    </div>`;

  function card(el, n) {
    lastCard = n;
    const scenes = flow();
    const scene = scenes[n - 1];
    let blocks = speakPhrases(scene.id).map((p) => phraseBlock(p)).join('');
    if (scene.breakerLink) {
      blocks += `<h3 class="sec-head">${icon('panel-top')}分電盤の説明（自分で言う用）</h3>` +
        breakerPhrases().map((p) => phraseBlock(p, { title: p._title })).join('');
    }
    const last = n === scenes.length;
    el.innerHTML = `
      <section class="speak-card">
        ${App.topBar(`<span class="step">${NUM[n - 1]}</span> ${esc(scene.title)}`, `<button type="button" class="tb-btn" id="btn-toc">${icon('list')}<span>目次</span></button>`)}
        ${toolRow()}
        <main class="speak-body">${blocks}</main>
        <nav class="nav-bar">
          <button type="button" class="nav-btn back" ${n === 1 ? 'disabled' : `data-go="speak-${n - 1}"`} data-dir="left">${icon('chevron-left')}<span>戻る</span></button>
          <button type="button" class="nav-btn next" ${last ? 'disabled' : `data-go="speak-${n + 1}"`} data-dir="right"><span>次へ</span>${icon('chevron-right')}</button>
        </nav>
      </section>`;
    $('#btn-toc').addEventListener('click', () => {
      App.sheet('目次（話すモード）', `<div class="toc">` + scenes.map((s, i) => `
        <button type="button" class="toc-item" data-go="speak-${i + 1}"><span class="toc-no">${NUM[i]}</span>${icon(s.icon)}<span>${esc(s.title)}</span></button>`).join('') + `
        <button type="button" class="toc-item" data-go="speak-problem"><span class="toc-no">＋</span>${icon('triangle-alert')}<span>問題があったとき</span></button>
        <button type="button" class="toc-item" data-go="speak-handy"><span class="toc-no">＋</span>${icon('message-circle')}<span>困ったときの一言</span></button>
      </div>`);
    });
  }

  function problem(el, g) {
    const scene = P().scenes.find((s) => s.id === 'problem');
    if (!isNaN(g)) problemGroup = Math.max(0, Math.min(scene.groups.length - 1, g));
    const group = scene.groups[problemGroup];
    const list = P().phrases.filter((p) => p.scene === 'problem' && p.group === group);
    el.innerHTML = `
      ${App.topBar('問題があったとき', '', `speak-${lastCard}`)}
      ${toolRow('problem')}
      <div class="chips">${scene.groups.map((name, i) => `<button type="button" class="chip-btn ${i === problemGroup ? 'on' : ''}" data-go="speak-problem-${i}">${esc(name)}</button>`).join('')}</div>
      <main class="speak-body">${list.map((p) => phraseBlock(p)).join('')}</main>`;
  }

  function handy(el) {
    const list = P().phrases.filter((p) => p.scene === 'handy');
    el.innerHTML = `
      ${App.topBar('困ったときの一言', '', `speak-${lastCard}`)}
      ${toolRow('handy')}
      <main class="speak-body">${list.map((p) => phraseBlock(p)).join('')}</main>`;
  }

  // ---------- 検索 ----------
  function search(el) {
    el.innerHTML = `
      ${App.topBar('フレーズ検索', '', `speak-${lastCard}`)}
      ${toolRow('search')}
      <div class="search-box">${icon('search')}<input id="speak-q" type="search" inputmode="search" placeholder="日本語で入力（例：漏電）" autocomplete="off"></div>
      <div class="chips quick">${['漏電', 'コンセント', 'ブレーカー', '無料', '時間', '電気工事店', '会社'].map((w) => `<button type="button" class="chip-btn" data-q="${w}">${w}</button>`).join('')}</div>
      <main class="speak-body" id="speak-results"><p class="empty">言葉を入れると、関係するフレーズが出ます。</p></main>`;
    const input = $('#speak-q');
    const run = () => {
      const q = norm(input.value);
      const out = $('#speak-results');
      if (!q) { out.innerHTML = '<p class="empty">言葉を入れると、関係するフレーズが出ます。</p>'; return; }
      const ph = P().phrases.filter((p) => p.en && [p.staff, p.easy, p.en, ...(p.tags || [])].some((t) => norm(t).includes(q)));
      const words = [...P().words, ...App.userWords.all()].filter((w) => [w.en, w.ja, w.note].some((t) => norm(t).includes(q)));
      const qa = App.qaSearch ? App.qaSearch(input.value) : [];
      let h = '';
      if (ph.length) h += `<h3 class="sec-head">フレーズ（${ph.length}）</h3>` + ph.map((p) => phraseBlock(p)).join('');
      if (words.length) h += `<h3 class="sec-head">単語帳（${words.length}）</h3>` + words.map((w) => App.wordRow ? App.wordRow(w) : '').join('');
      if (qa.length) h += `<h3 class="sec-head">困ったときQ&A（${qa.length}）</h3>` + qa.map((it) => `<button type="button" class="qa-link" data-go="qa-item-${it.id}">${icon('life-buoy')}<span>${esc(it.q.ja)}</span>${icon('chevron-right')}</button>`).join('');
      out.innerHTML = h || '<p class="empty">見つかりませんでした。別の言葉で探してみてください。</p>';
    };
    input.addEventListener('input', run);
    el.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => { input.value = b.dataset.q; run(); }));
    setTimeout(() => input.focus(), 50);
  }
})();
