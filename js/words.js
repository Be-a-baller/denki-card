// ===== 単語帳（自分で追加・編集できる） =====
(() => {
  'use strict';
  const { $, esc, icon, html, plain, norm } = App;
  let query = '';

  const all = () => [...App.userWords.all().map((w) => ({ ...w, user: true })), ...App.data.P.words];

  const WLV = { 1: '基本', 2: 'よく使う', 3: '専門用語' };
  let filter = 0;

  function wordRow(w) {
    const lv = App.level();
    const en = plain(w.en, 'en');
    const ex = (w.ex || []).find((x) => x.lv === lv) || (w.ex || [])[0];
    return `
      <div class="word ${w.user ? 'mine' : ''}">
        <div class="w-main">
          <p class="w-en" lang="en">${esc(w.en)}${w.user ? '<span class="mine-tag">自分</span>' : w.lv ? `<span class="wlv wlv${w.lv}">${WLV[w.lv]}</span>` : ''}</p>
          ${w.kana ? `<p class="w-kana">${html(w.kana, 'kana')}</p>` : ''}
          ${lv === 3 && w.ipa ? `<p class="w-ipa">${esc(w.ipa)}</p>` : ''}
          <p class="w-ja">${esc(w.ja)}</p>
          ${w.tip ? `<p class="w-tip">${icon('lightbulb')}<span>${html(w.tip, 'kana')}</span></p>` : ''}
          ${w.note ? `<p class="w-note">${esc(w.note)}</p>` : ''}
        </div>
        <div class="w-act">
          ${App.sayBtns(en, 'en', { label: false })}
          ${w.user ? `<button type="button" class="say-btn" data-go="words-edit-${esc(w.id)}" aria-label="編集">${icon('pencil')}</button>` : ''}
        </div>
        ${ex ? `
        <div class="w-ex">
          <span class="chip lv${ex.lv}">例文・${App.LEVELS[ex.lv - 1].label}</span>
          <div class="w-ex-text">
            <p class="ex-en" lang="en">${esc(ex.en)}</p>
            ${ex.kana ? `<p class="ex-kana">${html(ex.kana, 'kana')}</p>` : ''}
            <p class="ex-ja">${esc(ex.ja)}</p>
          </div>
          ${App.sayBtns(ex.en, 'en', { label: false })}
        </div>` : ''}
      </div>`;
  }
  App.wordRow = wordRow;

  App.route('words', (el, args) => {
    if (args[0] === 'add') return form(el, null);
    if (args[0] === 'edit') return form(el, args[1]);
    list(el);
  });

  function list(el) {
    el.innerHTML = `
      ${App.topBar('単語帳', `<button type="button" class="tb-btn primary" data-go="words-add">${icon('plus')}<span>追加</span></button>`)}
      <div class="lv-wrap"><p class="lv-label">例文のレベル</p>${App.levelSeg()}</div>
      <div class="search-box">${icon('search')}<input id="words-q" type="search" placeholder="英語・日本語で探す" autocomplete="off" value="${esc(query)}"></div>
      <div class="chips">${['すべて', '基本', 'よく使う', '専門用語', '自分'].map((t, i) => `<button type="button" class="chip-btn ${i === filter ? 'on' : ''}" data-f="${i}">${t}</button>`).join('')}</div>
      <main class="list-body" id="words-list"></main>`;
    const input = $('#words-q');
    const draw = () => {
      query = input.value;
      const q = norm(query);
      const ws = all()
        .filter((w) => !filter || (filter === 4 ? w.user : !w.user && (w.lv || 1) === filter))
        .filter((w) => !q || [w.en, w.ja, w.kana, w.note, ...(w.ex || []).map((x) => x.en + x.ja)].some((t) => norm(t).includes(q)));
      $('#words-list').innerHTML = `<p class="count">${ws.length}語${App.userWords.all().length ? `（自分で追加 ${App.userWords.all().length}語）` : ''}</p>` +
        (ws.map(wordRow).join('') || '<p class="empty">見つかりませんでした。「＋追加」で自分の単語を足せます。</p>');
    };
    input.addEventListener('input', draw);
    el.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => {
      filter = Number(b.dataset.f);
      el.querySelectorAll('[data-f]').forEach((x) => x.classList.toggle('on', x === b));
      draw();
    }));
    draw();
  }

  function form(el, id) {
    const mine = App.userWords.all();
    const w = id ? mine.find((x) => x.id === id) : null;
    if (id && !w) { App.go('words'); return; }
    el.innerHTML = `
      ${App.topBar(w ? '単語を直す' : '単語・フレーズを追加', '', 'words')}
      <form class="form" id="word-form" novalidate>
        <label class="field"><span>英語 <em>必須</em></span><input id="w-en" type="text" autocomplete="off" autocapitalize="off" value="${esc(w?.en)}" placeholder="例：circuit breaker"></label>
        <button type="button" class="say-test" id="w-test">${icon('volume-2')}英語を読み上げて確かめる</button>
        <label class="field"><span>日本語の意味 <em>必須</em></span><input id="w-ja" type="text" autocomplete="off" value="${esc(w?.ja)}" placeholder="例：分岐ブレーカー"></label>
        <label class="field"><span>カタカナ読み</span><input id="w-kana" type="text" autocomplete="off" value="${esc(w?.kana)}" placeholder="例：*サ*ーキット ブ*レ*イカー"><small>強く言うところを * で囲むと太字になります</small></label>
        <label class="field"><span>メモ</span><textarea id="w-note" rows="3" placeholder="例：ChatGPTで調べた使い方">${esc(w?.note)}</textarea></label>
        <p class="form-error" id="w-err" hidden></p>
        <div class="form-actions">
          <button type="submit" class="big-btn primary">${icon('check')}保存する</button>
          ${w ? `<button type="button" class="big-btn danger" id="w-del">${icon('trash-2')}<span>消す</span></button>` : ''}
        </div>
      </form>`;

    $('#w-test').addEventListener('click', (e) => { const t = $('#w-en').value.trim(); if (t) App.speech.speak(t, 'en', { btn: e.currentTarget }); });
    $('#word-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = { en: $('#w-en').value.trim(), ja: $('#w-ja').value.trim(), kana: $('#w-kana').value.trim(), note: $('#w-note').value.trim() };
      if (!v.en || !v.ja) { const er = $('#w-err'); er.textContent = '英語と日本語の意味を入れてください。'; er.hidden = false; return; }
      const list = App.userWords.all();
      if (w) Object.assign(list.find((x) => x.id === w.id), v);
      else list.unshift({ id: App.newId(), ...v });
      if (!App.userWords.save(list)) { App.toast('保存できませんでした'); return; }
      App.toast('保存しました');
      App.go('words', 'left');
    });
    const del = $('#w-del');
    if (del) del.addEventListener('click', () => {
      if (!del.dataset.sure) { del.dataset.sure = '1'; del.querySelector('span').textContent = 'もう一度押すと消えます'; return; }
      App.userWords.save(App.userWords.all().filter((x) => x.id !== w.id));
      App.toast('消しました');
      App.go('words', 'left');
    });
  }

  // ---------- CSV（設定画面から使う） ----------
  App.wordsCSV = {
    export() {
      const rows = [['english', 'kana', 'japanese', 'note'], ...App.userWords.all().map((w) => [w.en, w.kana, w.ja, w.note])];
      App.download('my-words.csv', App.toCSV(rows));
    },
    import(text) {
      const rows = App.parseCSV(text);
      if (rows.length && /english|英語/i.test(rows[0][0])) rows.shift();
      const list = App.userWords.all();
      let n = 0;
      for (const r of rows) {
        const [en, kana, ja, note] = r.map((x) => (x || '').trim());
        if (!en || !ja || list.some((w) => w.en === en && w.ja === ja)) continue;
        list.push({ id: App.newId(), en, kana, ja, note }); n++;
      }
      App.userWords.save(list);
      return n;
    },
  };
})();
