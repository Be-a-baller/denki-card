// ===== ホーム・使い方 =====
(() => {
  'use strict';
  const { esc, icon, html, pick } = App;

  const MENU = [
    { go: 'show', icon: 'presentation', title: '見せる', sub: 'お客さんに画面を見せる', cls: 'm-show' },
    { go: 'speak', icon: 'message-square-text', title: '話す', sub: '自分で話すカンペ', cls: 'm-speak' },
    { go: 'practice', icon: 'graduation-cap', title: '練習', sub: '家で英語の練習', cls: 'm-practice' },
    { go: 'words', icon: 'book-open', title: '単語帳', sub: 'よく使う単語・自分のメモ', cls: 'm-words' },
    { go: 'qa', icon: 'life-buoy', title: '困ったときQ&A', sub: '想定外の質問への答え方', cls: 'm-qa' },
  ];

  App.route('home', (el) => {
    const t = App.todayPhrase ? App.todayPhrase() : null;
    let today = '';
    if (t) {
      const en = App.plain(pick(t, 'en'), 'en');
      today = `
        <section class="today">
          <div class="today-head">${icon('star')}<span>今日の1フレーズ</span></div>
          <p class="today-en" lang="en">${html(pick(t, 'en'), 'en')}</p>
          ${t.kana ? `<p class="today-kana">${html(pick(t, 'kana'), 'kana')}</p>` : ''}
          <p class="today-ja">${html(pick(t, 'staff'), 'staff')}</p>
          <div class="today-act">${App.sayBtns(en)}<button type="button" class="link-btn" data-go="practice">練習する ${icon('chevron-right')}</button></div>
        </section>`;
    }
    el.innerHTML = `
      <div class="home">
        <header class="home-head">
          <span class="logo">${icon('zap')}</span>
          <div><h1>点検カード</h1><p>電気の安全点検の説明と英会話</p></div>
        </header>
        ${today}
        <nav class="home-menu">
          ${MENU.map((m) => `
            <button type="button" class="menu-btn ${m.cls}" data-go="${m.go}" data-dir="right">
              <span class="m-icon">${icon(m.icon)}</span>
              <span class="m-text"><span class="m-title">${esc(m.title)}</span><span class="m-sub">${esc(m.sub)}</span></span>
              ${icon('chevron-right', 'm-arrow')}
            </button>`).join('')}
        </nav>
        <footer class="home-foot">
          <button type="button" class="small-btn" data-go="help">${icon('circle-help')}使い方</button>
          <button type="button" class="small-btn" data-go="config">${icon('settings')}設定</button>
        </footer>
      </div>`;
  });

  // ---------- 使い方（スマホ1画面分） ----------
  App.route('help', (el) => {
    el.innerHTML = `
      ${App.topBar('使い方')}
      <div class="help">
        <ol class="help-list">
          <li><b class="h-show">見せる</b>お客さんに言葉を選んでもらい、<b>「次へ」</b>を押すだけ。返事は下のボタンで。</li>
          <li><b class="h-speak">話す</b>英語とカタカナを見ながら自分で話す。<b>「こう言われたら」</b>で返し方。</li>
          <li><b class="h-practice">練習</b>家で。聞いてまねする・クイズ・発音チェック。</li>
          <li><b class="h-words">単語帳</b>ChatGPTで調べた言い方は<b>「＋追加」</b>でメモ。</li>
          <li><b class="h-qa">Q&A</b>答えに困ったら検索。なければ<b>「AIに聞く」</b>。</li>
        </ol>
        <p class="help-tip">${icon('volume-2')} スピーカーの印で読み上げ。${icon('turtle')}はゆっくり。<br>${icon('house')} 迷ったら左上の<b>ホーム</b>へ。</p>
        <p class="help-tip">${icon('settings')} 会社名・電話番号・所要時間・お知らせ写真は<b>設定</b>で。</p>
        <p class="help-note">お客さんの名前や住所は入れないでください。</p>
      </div>`;
  });
})();
