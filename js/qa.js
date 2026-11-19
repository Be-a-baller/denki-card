// ===== 困ったときQ&A =====
(() => {
  'use strict';
  const { $, esc, icon, html, plain, norm } = App;
  let cat = 'all';
  let query = '';

  const Q = () => App.data.Q;
  const VARIANTS = [
    { id: 'easy', label: 'やさしい', lang: 'ja' },
    { id: 'polite', label: '丁寧', lang: 'ja' },
    { id: 'en', label: 'English', lang: 'en' },
  ];

  // 自分で足したQ&A（a.* は文の配列）
  const mine = () => App.userQA.all().map((x) => ({ ...x, user: true }));
  const all = () => [...mine(), ...Q().items];
  const find = (id) => all().find((x) => x.id === id);
  const catTitle = (id) => (Q().categories.find((c) => c.id === id) || { title: 'その他' }).title;

  const hay = (it) => [it.q.ja, it.q.en, ...(it.tags || []), ...(it.a.polite || []), ...(it.a.easy || [])];
  App.qaSearch = (text) => {
    const q = norm(text);
    if (!q) return [];
    return all().filter((it) => hay(it).some((t) => norm(t).includes(q)));
  };

  // 1行に1文。1行しかなければ「。」などで区切る
  const toSentences = (s) => {
    s = String(s || '').trim();
    if (!s) return [];
    const lines = s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    if (lines.length > 1) return lines;
    return s.match(/[^。！？!?.]+[。！？!?.]*/g).map((x) => x.trim()).filter(Boolean);
  };

  const footer = () => `<footer class="qa-foot">${icon('triangle-alert')}${esc(Q().disclaimer)}</footer>`;

  App.route('qa', (el, args) => {
    const [m, id] = args;
    if (m === 'item') return item(el, id);
    if (m === 'ai') return ai(el);
    if (m === 'add') return form(el, null);
    if (m === 'edit') return form(el, id);
    list(el);
  });

  // ---------- 一覧・検索 ----------
  function list(el) {
    const cats = [{ id: 'all', title: 'すべて' }, ...Q().categories, { id: 'mine', title: '自分' }];
    el.innerHTML = `
      ${App.topBar('困ったときQ&A', `<button type="button" class="tb-btn primary" data-go="qa-add">${icon('plus')}<span>追加</span></button>`)}
      <div class="search-box">${icon('search')}<input id="qa-q" type="search" placeholder="言葉で探す（例：コンセント、ひび、落ちる）" autocomplete="off" value="${esc(query)}"></div>
      <div class="chips" id="qa-cats">${cats.map((c) => `<button type="button" class="chip-btn ${c.id === cat ? 'on' : ''}" data-cat="${c.id}">${esc(c.title)}</button>`).join('')}</div>
      <button type="button" class="ai-btn" data-go="qa-ai" data-dir="right">${icon('message-square-text')}<span><b>AIに聞く</b><small>Q&Aにない質問のとき</small></span>${icon('chevron-right')}</button>
      <main class="list-body" id="qa-list"></main>
      ${footer()}`;
    const input = $('#qa-q');
    const draw = () => {
      query = input.value;
      let items = query.trim() ? App.qaSearch(query) : all();
      if (cat === 'mine') items = items.filter((x) => x.user);
      else if (cat !== 'all') items = items.filter((x) => x.category === cat);
      $('#qa-list').innerHTML = items.map((it) => `
        <button type="button" class="qa-item" data-go="qa-item-${esc(it.id)}" data-dir="right">
          <span class="qa-cat">${esc(catTitle(it.category))}${it.user ? '<span class="mine-tag">自分</span>' : ''}</span>
          <span class="qa-q">${esc(it.q.ja)}</span>
          ${icon('chevron-right', 'qa-arrow')}
        </button>`).join('') || `<p class="empty">見つかりませんでした。<br>「AIに聞く」で答え方を調べて、「＋追加」でメモできます。</p>`;
    };
    input.addEventListener('input', draw);
    el.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => {
      cat = b.dataset.cat;
      el.querySelectorAll('[data-cat]').forEach((x) => x.classList.toggle('on', x === b));
      draw();
    }));
    draw();
  }

  // ---------- 答え ----------
  function item(el, id) {
    const it = find(id);
    if (!it) { App.go('qa'); return; }
    let v = App.LS.get('qaVariant', 'polite');
    const has = (k) => (it.a[k] || []).length > 0;
    if (!has(v)) v = 'polite';
    el.innerHTML = `
      ${App.topBar('答え方', it.user ? `<button type="button" class="tb-btn" data-go="qa-edit-${esc(it.id)}">${icon('pencil')}<span>直す</span></button>` : '', 'qa')}
      <main class="qa-body">
        <section class="qa-question">
          <p class="qa-cat">${esc(catTitle(it.category))}</p>
          <p class="qa-qja">${esc(it.q.ja)}</p>
          ${it.q.en ? `<p class="qa-qen" lang="en">${esc(it.q.en)}</p>` : ''}
        </section>
        <div class="seg" role="tablist">${VARIANTS.map((x) => `<button type="button" role="tab" class="seg-btn ${x.id === v ? 'on' : ''}" data-v="${x.id}" ${has(x.id) ? '' : 'disabled'}>${x.label}</button>`).join('')}</div>
        <section class="qa-answer" id="qa-answer"></section>
        ${(it.review || []).length ? '<p class="rv-note">この答えは下書き（要確認）です。</p>' : ''}
      </main>
      ${footer()}`;

    const draw = () => {
      const V = VARIANTS.find((x) => x.id === v);
      const sents = it.a[v] || [];
      const key = v === 'en' ? 'en' : 'easy';
      const all = sents.map((s) => plain(s, key)).join(' ');
      let h = `<div class="qa-say">${App.sayBtns(all, V.lang)}</div><ol class="qa-sents ${v}">`;
      h += sents.map((s, i) => {
        const kana = v === 'en' && it.a.kana ? it.a.kana[i] : '';
        return `<li><p class="s-main" lang="${V.lang}">${html(s, key)}</p>${kana ? `<p class="s-kana">${html(kana, 'kana')}</p>` : ''}
          ${v === 'en' ? `<div class="s-say">${App.sayBtns(plain(s, 'en'), 'en', { label: false })}</div>` : ''}</li>`;
      }).join('');
      h += '</ol>';
      if (it.showPhone) {
        const s = App.settings();
        h += `<div class="contact-box">${s.company ? `<p class="cb-company">${esc(s.company)}</p>` : ''}<p class="cb-phone">${s.phone ? esc(s.phone) : '<span class="cb-none">（電話番号は設定で入れてください）</span>'}</p></div>`;
      }
      $('#qa-answer').innerHTML = h;
    };
    el.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => {
      v = b.dataset.v;
      App.LS.set('qaVariant', v);
      App.speech.stop();
      el.querySelectorAll('[data-v]').forEach((x) => x.classList.toggle('on', x === b));
      draw();
      App.animateIn($('#qa-answer'), 'fade');
    }));
    draw();
  }

  // ---------- AIに聞く ----------
  function buildPrompt(question) {
    return Q().aiPrompt.replace('{client}', App.data.P.defaults.client.staff).replace('{question}', question.trim());
  }

  function ai(el) {
    const draft = App.LS.get('aiDraft', '');
    el.innerHTML = `
      ${App.topBar('AIに聞く', '', 'qa')}
      <main class="qa-body">
        <p class="lead">お客さんの質問を入れると、「回答の型」つきの質問文を作ってコピーし、AIのアプリを開きます。</p>
        <p class="warn-box">${icon('triangle-alert')}お客さんの名前・住所・電話番号は書かないでください。</p>
        <label class="field"><span>お客さんの質問</span>
          <textarea id="ai-q" rows="4" placeholder="例：コンセントの差し込み口にひびがあるけど、使わないから交換しなくていい？">${esc(draft)}</textarea>
          <small>キーボードのマイクで話して入力することもできます。</small></label>
        ${App.speech.canListen ? `<button type="button" class="mic-btn" id="ai-mic">${icon('mic')}<span>話して入力</span></button>` : ''}
        <p class="form-error" id="ai-err" hidden></p>
        <div class="ai-actions">
          <button type="button" class="big-btn primary" data-ai="chatgpt">${icon('copy')}コピーして ChatGPT を開く</button>
          <button type="button" class="big-btn primary" data-ai="claude">${icon('copy')}コピーして Claude を開く</button>
          <button type="button" class="big-btn" data-ai="copy">${icon('copy')}コピーだけする</button>
        </div>
        <details class="prompt-preview"><summary>作られる質問文を見る</summary><pre id="ai-preview"></pre></details>
        <p class="note">答えが良かったら、Q&A一覧の「＋追加」で保存しておけます。</p>
        <button type="button" class="big-btn" id="ai-save">${icon('plus')}この質問でQ&Aを追加する</button>
      </main>
      ${footer()}`;

    const ta = $('#ai-q');
    const preview = () => { $('#ai-preview').textContent = buildPrompt(ta.value || '（ここに質問が入ります）'); App.LS.set('aiDraft', ta.value); };
    ta.addEventListener('input', preview);
    preview();

    const mic = $('#ai-mic');
    if (mic) mic.addEventListener('click', async () => {
      if (!navigator.onLine) { App.toast('電波のある場所で使ってください'); return; }
      mic.classList.add('listening'); mic.querySelector('span').textContent = '聞いています…';
      try { const r = await App.speech.listen('ja'); ta.value = (ta.value ? ta.value + ' ' : '') + r[0]; preview(); }
      catch (e) { App.toast('うまく聞き取れませんでした'); }
      mic.classList.remove('listening'); mic.querySelector('span').textContent = '話して入力';
    });

    el.querySelectorAll('[data-ai]').forEach((b) => b.addEventListener('click', () => {
      const err = $('#ai-err');
      if (!ta.value.trim()) { err.textContent = 'お客さんの質問を入れてください。'; err.hidden = false; return; }
      err.hidden = true;
      const text = buildPrompt(ta.value);
      const copied = navigator.clipboard ? navigator.clipboard.writeText(text).then(() => true, () => false) : Promise.resolve(false);
      if (b.dataset.ai === 'copy') { copied.then((ok) => App.toast(ok ? 'コピーしました' : 'コピーできませんでした。下の質問文を長押ししてコピーしてください')); if (!navigator.clipboard) $('.prompt-preview').open = true; return; }
      if (!navigator.onLine) { App.toast('電波のある場所で使ってください'); return; }
      const url = b.dataset.ai === 'chatgpt'
        ? 'https://chatgpt.com/?q=' + encodeURIComponent(text)
        : 'https://claude.ai/new?q=' + encodeURIComponent(text);
      const a = document.createElement('a');
      a.href = url; a.target = '_blank'; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      copied.then((ok) => App.toast(ok ? 'コピーしました。入っていなければ貼り付けてください' : 'AIを開きました'));
    }));
    $('#ai-save').addEventListener('click', () => { App.LS.set('qaNewQ', ta.value.trim()); App.go('qa-add', 'right'); });
  }

  // ---------- 自分のQ&Aを追加・直す ----------
  function form(el, id) {
    const it = id ? mine().find((x) => x.id === id) : null;
    if (id && !it) { App.go('qa'); return; }
    const presetQ = it ? it.q.ja : App.LS.get('qaNewQ', '');
    App.LS.set('qaNewQ', '');
    const join = (arr) => esc((arr || []).join('\n'));
    el.innerHTML = `
      ${App.topBar(it ? 'Q&Aを直す' : 'Q&Aを追加', '', it ? `qa-item-${it.id}` : 'qa')}
      <form class="form" id="qa-form" novalidate>
        <label class="field"><span>場面</span>
          <select id="f-cat">${Q().categories.map((c) => `<option value="${c.id}" ${(it ? it.category : 'other') === c.id ? 'selected' : ''}>${esc(c.title)}</option>`).join('')}</select></label>
        <label class="field"><span>お客さんの質問 <em>必須</em></span><textarea id="f-q" rows="2">${esc(presetQ)}</textarea></label>
        <label class="field"><span>答え（丁寧な日本語） <em>必須</em></span><textarea id="f-polite" rows="5" placeholder="1行に1文で書くと、1文ずつ表示されます">${join(it?.a.polite)}</textarea></label>
        <label class="field"><span>答え（やさしい日本語）</span><textarea id="f-easy" rows="4">${join(it?.a.easy)}</textarea></label>
        <label class="field"><span>答え（英語）</span><textarea id="f-en" rows="4" autocapitalize="off">${join(it?.a.en)}</textarea></label>
        <label class="field"><span>英語のカタカナ読み</span><textarea id="f-kana" rows="4">${join(it?.a.kana)}</textarea><small>英語と同じ行数で。強く言うところは * で囲みます。</small></label>
        <label class="field"><span>検索のキーワード</span><input id="f-tags" type="text" value="${esc((it?.tags || []).join('、'))}" placeholder="例：コンセント、ひび"><small>「、」で区切ります。</small></label>
        <p class="form-error" id="f-err" hidden></p>
        <div class="form-actions">
          <button type="submit" class="big-btn primary">${icon('check')}保存する</button>
          ${it ? `<button type="button" class="big-btn danger" id="f-del">${icon('trash-2')}<span>消す</span></button>` : ''}
        </div>
      </form>`;

    $('#qa-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const q = $('#f-q').value.trim();
      const polite = toSentences($('#f-polite').value);
      if (!q || !polite.length) { const er = $('#f-err'); er.textContent = '質問と、丁寧な日本語の答えを入れてください。'; er.hidden = false; return; }
      const en = toSentences($('#f-en').value);
      const v = {
        category: $('#f-cat').value,
        q: { ja: q, en: it?.q.en || '' },
        tags: $('#f-tags').value.split(/[、,，\s]+/).map((x) => x.trim()).filter(Boolean),
        a: { polite, easy: toSentences($('#f-easy').value), en, kana: $('#f-kana').value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean) },
      };
      const list = App.userQA.all();
      let saveId;
      if (it) { Object.assign(list.find((x) => x.id === it.id), v); saveId = it.id; }
      else { saveId = App.newId(); list.unshift({ id: saveId, ...v }); }
      if (!App.userQA.save(list)) { App.toast('保存できませんでした'); return; }
      App.toast('保存しました');
      App.go(`qa-item-${saveId}`, 'left');
    });
    const del = $('#f-del');
    if (del) del.addEventListener('click', () => {
      if (!del.dataset.sure) { del.dataset.sure = '1'; del.querySelector('span').textContent = 'もう一度押すと消えます'; return; }
      App.userQA.save(App.userQA.all().filter((x) => x.id !== it.id));
      App.toast('消しました');
      App.go('qa', 'left');
    });
  }

  // ---------- CSV（設定画面から使う） ----------
  const J = (a) => (a || []).join('\n');
  App.qaCSV = {
    export() {
      const rows = [['category', 'question', 'polite', 'easy', 'english', 'kana', 'tags'],
        ...App.userQA.all().map((x) => [x.category, x.q.ja, J(x.a.polite), J(x.a.easy), J(x.a.en), J(x.a.kana), (x.tags || []).join('、')])];
      App.download('my-qa.csv', App.toCSV(rows));
    },
    import(text) {
      const rows = App.parseCSV(text);
      if (rows.length && /category|場面/i.test(rows[0][0])) rows.shift();
      const list = App.userQA.all();
      const cats = Q().categories.map((c) => c.id);
      let n = 0;
      for (const r of rows) {
        const [category, q, polite, easy, en, kana, tags] = r.map((x) => (x || '').trim());
        if (!q || !polite || list.some((x) => x.q.ja === q)) continue;
        const split = (s) => s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
        list.push({
          id: App.newId(), category: cats.includes(category) ? category : 'other', q: { ja: q, en: '' },
          tags: (tags || '').split(/[、,，\s]+/).filter(Boolean),
          a: { polite: split(polite), easy: split(easy || ''), en: split(en || ''), kana: split(kana || '') },
        });
        n++;
      }
      App.userQA.save(list);
      return n;
    },
  };
})();
