// ===== 練習モード（聞いてまねする・クイズ・発音チェック）と今日の1フレーズ =====
(() => {
  'use strict';
  const { $, esc, icon, html, plain, pick } = App;
  let lastId = null;

  const pool = () => App.data.P.phrases.filter((p) => (p.modes || []).includes('practice') && p.en);
  const byId = (id) => App.data.P.phrases.find((p) => p.id === id);
  // 記録はレベルごと（中級はいままでどおり id だけ）
  const pk = (p) => (App.level() === 2 ? p.id : `${p.id}@${App.level()}`);
  const en = (p) => App.lvText(p, 'en');
  const kana = (p) => App.lvText(p, 'kana');
  const WK = (w) => `w:${w.id}@${App.level()}`;
  // 単語クイズに出す単語：初級＝基本とよく使う、中級＝全部、上級＝よく使うと専門用語
  const wordPool = () => {
    const lv = App.level();
    return App.data.P.words.filter((w) => (lv === 1 ? w.lv <= 2 : lv === 3 ? w.lv >= 2 : true));
  };

  // 「まだ」のものを多めに出す
  function pickNext() {
    const prog = App.progress.all();
    const list = pool().filter((p) => p.id !== lastId);
    const weight = (p) => { const r = prog[pk(p)]; if (!r) return 2; return r.lastOk ? 0.5 : 4; };
    const total = list.reduce((s, p) => s + weight(p), 0);
    let x = Math.random() * total;
    for (const p of list) { x -= weight(p); if (x <= 0) { lastId = p.id; return p; } }
    lastId = list[0].id;
    return list[0];
  }

  // 今日の1フレーズ（1日同じもの。まだ言えていないものから選ぶ）
  App.todayPhrase = () => {
    const ps = pool();
    if (!ps.length) return null;
    const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
    const saved = App.LS.get('today', null);
    if (saved && saved.day === day && byId(saved.id)) return byId(saved.id);
    const prog = App.progress.all();
    const notYet = ps.filter((p) => !(prog[p.id] && prog[p.id].lastOk));
    const list = notYet.length ? notYet : ps;
    const p = list[day % list.length];
    App.LS.set('today', { day, id: p.id });
    return p;
  };

  App.route('practice', (el, args) => {
    const m = args[0];
    if (m === 'listen') return listen(el);
    if (m === 'quiz') return quiz(el);
    if (m === 'check' && App.speech.canListen) return check(el);
    if (m === 'words') return wordQuiz(el);
    menu(el);
  });

  // ---------- メニュー ----------
  function menu(el) {
    const total = pool().length;
    const prog = App.progress.all();
    const done = pool().filter((p) => prog[pk(p)] && prog[pk(p)].lastOk).length;
    const wp = wordPool();
    const wdone = wp.filter((w) => prog[WK(w)] && prog[WK(w)].lastOk).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    el.innerHTML = `
      ${App.topBar('練習')}
      <div class="practice-menu">
        <div class="lv-wrap flat"><p class="lv-label">練習のレベル</p>${App.levelSeg()}</div>
        <section class="stat">
          <p class="stat-label">言えたフレーズ（${App.LEVELS[App.level() - 1].label}）</p>
          <p class="stat-num"><b>${done}</b> / ${total}　<small>単語 ${wdone} / ${wp.length}</small></p>
          <div class="meter" role="img" aria-label="${pct}%"><span style="width:${pct}%"></span></div>
        </section>
        <button type="button" class="menu-btn m-practice" data-go="practice-listen" data-dir="right">
          <span class="m-icon">${icon('volume-2')}</span><span class="m-text"><span class="m-title">聞いてまねする</span><span class="m-sub">英語を聞いて、声に出す</span></span>${icon('chevron-right', 'm-arrow')}</button>
        <button type="button" class="menu-btn m-practice" data-go="practice-quiz" data-dir="right">
          <span class="m-icon">${icon('shuffle')}</span><span class="m-text"><span class="m-title">日本語→英語クイズ</span><span class="m-sub">思い出して言えたら「言えた」</span></span>${icon('chevron-right', 'm-arrow')}</button>
        <button type="button" class="menu-btn m-practice" data-go="practice-words" data-dir="right">
          <span class="m-icon">${icon('book-open')}</span><span class="m-text"><span class="m-title">単語・専門用語クイズ</span><span class="m-sub">漏電・絶縁抵抗など、言いにくい単語</span></span>${icon('chevron-right', 'm-arrow')}</button>
        ${App.speech.canListen ? `
        <button type="button" class="menu-btn m-practice" data-go="practice-check" data-dir="right">
          <span class="m-icon">${icon('mic')}</span><span class="m-text"><span class="m-title">発音チェック</span><span class="m-sub">話した英語を文字にして確かめる</span></span>${icon('chevron-right', 'm-arrow')}</button>` : ''}
        ${App.speech.canListen ? '<p class="note">発音チェックは電波のある場所で使ってください（声は文字にするため Google や Apple に送られます）。</p>' : ''}
      </div>`;
  }

  const phraseView = (p) => `
    <p class="pr-en" lang="en">${html(en(p), 'en')}</p>
    ${kana(p) ? `<p class="pr-kana">${html(kana(p), 'kana')}</p>` : ''}
    <p class="pr-ja">${html(pick(p, 'staff'), 'staff')}</p>`;

  // ---------- 聞いてまねする ----------
  function listen(el) {
    const p = pickNext();
    const t = plain(en(p), 'en');
    el.innerHTML = `
      ${App.topBar('聞いてまねする', '', 'practice')}
      <main class="practice-body">
        <p class="pr-lead">${icon('volume-2')}聞いて、声に出して言ってみましょう</p>
        <div class="pr-card">${phraseView(p)}</div>
        <div class="pr-say">${App.sayBtns(t)}</div>
      </main>
      <nav class="nav-bar single"><button type="button" class="nav-btn next" data-go="practice-listen" data-dir="right"><span>次へ</span>${icon('chevron-right')}</button></nav>`;
    // 初級は最初をゆっくり読む
    const slow = App.level() === 1;
    setTimeout(() => { const b = el.querySelector(`.pr-say .say-btn${slow ? '.slow' : ''}`); if (b) App.speech.speak(t, 'en', { btn: b, slow }); }, 350);
  }

  // ---------- 日本語→英語クイズ ----------
  function quiz(el) {
    const p = pickNext();
    const t = plain(en(p), 'en');
    el.innerHTML = `
      ${App.topBar('日本語→英語クイズ', '', 'practice')}
      <main class="practice-body">
        <p class="pr-lead">英語で言ってみましょう</p>
        <div class="pr-card quiz-q"><p class="q-ja">${html(pick(p, 'staff'), 'staff')}</p></div>
        <div id="quiz-a" class="pr-card" hidden>
          <p class="pr-en" lang="en">${html(en(p), 'en')}</p>
          ${kana(p) ? `<p class="pr-kana">${html(kana(p), 'kana')}</p>` : ''}
          <div class="pr-say">${App.sayBtns(t)}</div>
          ${App.speech.canListen ? `<div class="pron" id="pron"></div>` : ''}
        </div>
      </main>
      <nav class="nav-bar single" id="quiz-nav"><button type="button" class="nav-btn next" id="quiz-show"><span>答えを見る</span>${icon('eye')}</button></nav>`;
    $('#quiz-show').addEventListener('click', () => {
      $('#quiz-a').hidden = false;
      App.animateIn($('#quiz-a'), 'fade');
      App.speech.speak(t, 'en', { btn: el.querySelector('#quiz-a .say-btn') });
      if (App.speech.canListen) pronWidget($('#pron'), p);
      $('#quiz-nav').className = 'nav-bar';
      $('#quiz-nav').innerHTML = `
        <button type="button" class="nav-btn back" id="q-ng"><span>まだ</span></button>
        <button type="button" class="nav-btn next" id="q-ok">${icon('check')}<span>言えた</span></button>`;
      $('#q-ng').addEventListener('click', () => { App.progress.mark(pk(p), false); App.go('practice-quiz', 'right'); });
      $('#q-ok').addEventListener('click', () => { App.progress.mark(pk(p), true); App.toast('よくできました！'); App.go('practice-quiz', 'right'); });
    });
  }

  // ---------- 発音チェック ----------
  function check(el) {
    const p = pickNext();
    const t = plain(en(p), 'en');
    el.innerHTML = `
      ${App.topBar('発音チェック', '', 'practice')}
      <main class="practice-body">
        <p class="pr-lead">${icon('mic')}マイクを押して、英語で言ってみましょう</p>
        <div class="pr-card">${phraseView(p)}<div class="pr-say">${App.sayBtns(t)}</div></div>
        <div class="pron" id="pron"></div>
      </main>
      <nav class="nav-bar single"><button type="button" class="nav-btn next" data-go="practice-check" data-dir="right"><span>次へ</span>${icon('chevron-right')}</button></nav>`;
    pronWidget($('#pron'), p, true);
  }

  // ---------- 単語・専門用語クイズ ----------
  let lastWord = null;
  function wordQuiz(el) {
    const prog = App.progress.all();
    const list = wordPool().filter((w) => w.id !== lastWord);
    const weight = (w) => { const r = prog[WK(w)]; return (!r ? 2 : r.lastOk ? 0.5 : 4) * (w.lv === 3 ? 1.5 : 1); };
    let x = Math.random() * list.reduce((s, w) => s + weight(w), 0);
    let w = list[0];
    for (const c of list) { x -= weight(c); if (x <= 0) { w = c; break; } }
    lastWord = w.id;
    const lv = App.level();
    const word = w.en.replace(/\s*\([^)]*\)/g, '');
    const ex = (w.ex || []).find((e) => e.lv === lv);
    el.innerHTML = `
      ${App.topBar('単語・専門用語クイズ', '', 'practice')}
      <main class="practice-body">
        <p class="pr-lead">英語で言ってみましょう</p>
        <div class="pr-card quiz-q"><p class="q-ja">${esc(w.ja)}</p>${w.lv === 3 ? '<span class="wlv wlv3">専門用語</span>' : ''}</div>
        <div id="quiz-a" class="pr-card" hidden>
          <p class="pr-en" lang="en">${esc(word)}</p>
          <p class="pr-kana">${html(w.kana, 'kana')}</p>
          ${w.ipa ? `<p class="w-ipa">${esc(w.ipa)}</p>` : ''}
          ${w.tip ? `<p class="w-tip">${icon('lightbulb')}<span>${html(w.tip, 'kana')}</span></p>` : ''}
          <div class="pr-say">${App.sayBtns(word)}</div>
          ${ex ? `<div class="w-ex in-quiz">
            <span class="chip lv${ex.lv}">例文・${App.LEVELS[ex.lv - 1].label}</span>
            <div class="w-ex-text"><p class="ex-en" lang="en">${esc(ex.en)}</p><p class="ex-kana">${html(ex.kana, 'kana')}</p><p class="ex-ja">${esc(ex.ja)}</p></div>
            ${App.sayBtns(ex.en, 'en', { label: false })}
          </div>` : ''}
          ${App.speech.canListen ? `<div class="pron" id="pron"></div>` : ''}
        </div>
      </main>
      <nav class="nav-bar single" id="quiz-nav"><button type="button" class="nav-btn next" id="quiz-show"><span>答えを見る</span>${icon('eye')}</button></nav>`;
    $('#quiz-show').addEventListener('click', () => {
      $('#quiz-a').hidden = false;
      App.animateIn($('#quiz-a'), 'fade');
      App.speech.speak(word, 'en', { btn: el.querySelector('#quiz-a .pr-say .say-btn.slow'), slow: true });
      if (App.speech.canListen) pronWidget($('#pron'), null, false, word);
      $('#quiz-nav').className = 'nav-bar';
      $('#quiz-nav').innerHTML = `
        <button type="button" class="nav-btn back" id="q-ng"><span>まだ</span></button>
        <button type="button" class="nav-btn next" id="q-ok">${icon('check')}<span>言えた</span></button>`;
      $('#q-ng').addEventListener('click', () => { App.progress.mark(WK(w), false); App.go('practice-words', 'right'); });
      $('#q-ok').addEventListener('click', () => { App.progress.mark(WK(w), true); App.toast('よくできました！'); App.go('practice-words', 'right'); });
    });
  }

  // マイクのボタンと結果
  const words = (s) => s.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
  function pronWidget(box, p, markProgress = false, text = null) {
    const target = text || plain(en(p), 'en');
    box.innerHTML = `<button type="button" class="mic-btn" id="mic">${icon('mic')}<span>話して確かめる</span></button><div id="pron-out"></div>`;
    const btn = box.querySelector('#mic');
    btn.addEventListener('click', async () => {
      if (!navigator.onLine) { App.toast('電波のある場所で使ってください'); return; }
      btn.classList.add('listening');
      btn.querySelector('span').textContent = '聞いています…';
      try {
        const alts = await App.speech.listen('en');
        const heard = new Set(alts.flatMap(words));
        const tw = target.split(/\s+/).filter(Boolean);
        let ok = 0;
        const marked = tw.map((w) => {
          const n = words(w)[0];
          const hit = !n || heard.has(n);
          if (hit) ok++;
          return `<span class="${hit ? 'w-ok' : 'w-ng'}">${esc(w)}</span>`;
        }).join(' ');
        const score = Math.round((ok / tw.length) * 100);
        const msg = score >= 80 ? 'よく言えました！' : score >= 50 ? 'おしい！赤いところをもう一度' : 'もう一度ゆっくり言ってみましょう';
        box.querySelector('#pron-out').innerHTML = `
          <p class="pron-score ${score >= 80 ? 'good' : ''}"><b>${score}</b>点　${msg}</p>
          <p class="pron-target" lang="en">${marked}</p>
          <p class="pron-heard">聞き取った文：<span lang="en">${esc(alts[0])}</span></p>`;
        if (markProgress && p && score >= 80) App.progress.mark(pk(p), true);
      } catch (err) {
        const m = String(err.message);
        box.querySelector('#pron-out').innerHTML = `<p class="pron-heard">${m === 'not-allowed' ? 'マイクが使えません。ブラウザの設定でマイクを許可してください。' : m === 'network' ? '電波のある場所で使ってください。' : 'うまく聞き取れませんでした。もう一度どうぞ。'}</p>`;
      }
      btn.classList.remove('listening');
      btn.querySelector('span').textContent = 'もう一度話す';
    });
  }
})();
