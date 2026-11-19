// ===== 設定画面（母しか触らない） =====
(() => {
  'use strict';
  const { $, esc, icon } = App;

  // 写真を小さくしてから保存（長い辺 1600px・JPEG）
  function shrink(file) {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const max = 1600;
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob((b) => resolve(b || file), 'image/jpeg', 0.85);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  App.route('config', (el) => {
    const s = App.settings();
    const voiceRow = (lang, label) => {
      const v = App.speech.voiceFor(lang);
      return `<li>${label}：${v ? `<span class="ok">${icon('check')}使えます</span>` : '<span class="ng">この端末に声がありません</span>'}</li>`;
    };
    el.innerHTML = `
      ${App.topBar('設定')}
      <main class="config">
        <section class="cfg">
          <h2>英語のレベル</h2>
          ${App.levelSeg()}
          <p class="note">初級＝短くかんたんな文 ／ 中級＝ふつうの文 ／ 上級＝「絶縁抵抗」「地絡」などの専門用語を入れた文と発音記号。話す・練習・単語帳の上でも切り替えられます。</p>
        </section>
        <section class="cfg">
          <h2>お客さんに見せる情報</h2>
          <label class="field"><span>会社名（自分の会社）</span>
            <input id="c-company" type="text" autocomplete="organization" value="${esc(s.company)}" placeholder="例：〇〇電気保安">
            <small>空のときは「東京電力の委託で来ました」とだけ名乗ります。</small></label>
          <div class="field"><span>所要時間</span>
            <div class="stepper">
              <button type="button" class="st-btn" id="c-min-down" aria-label="5分へらす">−</button>
              <output id="c-min"><b>${s.minutes}</b> 分</output>
              <button type="button" class="st-btn" id="c-min-up" aria-label="5分ふやす">＋</button>
            </div></div>
          <label class="field"><span>会社の問い合わせ電話番号</span>
            <input id="c-phone" type="tel" inputmode="tel" autocomplete="off" value="${esc(s.phone)}" placeholder="例：0120-000-000">
            <small>「詐欺じゃない？」と聞かれたときに表示します。</small></label>
        </section>

        <section class="cfg">
          <h2>お知らせの写真</h2>
          <img id="c-photo" class="photo" alt="お知らせの写真" src="">
          <div class="cfg-row">
            <label class="big-btn primary file-btn">${icon('image')}写真を選ぶ<input id="c-photo-in" type="file" accept="image/*"></label>
            <button type="button" class="big-btn" id="c-photo-reset">${icon('rotate-ccw')}見本に戻す</button>
          </div>
        </section>

        <section class="cfg">
          <h2>読み上げの速さ</h2>
          <label class="field"><span>ふつう <output id="o-rate">${s.rate.toFixed(2)}</output></span>
            <input id="c-rate" type="range" min="0.6" max="1.2" step="0.05" value="${s.rate}"></label>
          <label class="field"><span>ゆっくり <output id="o-slow">${s.rateSlow.toFixed(2)}</output></span>
            <input id="c-slow" type="range" min="0.4" max="0.9" step="0.05" value="${s.rateSlow}"></label>
          <div class="cfg-row">
            <button type="button" class="big-btn" id="t-rate">${icon('volume-2')}ふつうを試す</button>
            <button type="button" class="big-btn" id="t-slow">${icon('turtle')}ゆっくりを試す</button>
          </div>
          <ul class="voices">${voiceRow('ja', '日本語')}${voiceRow('en', '英語')}${voiceRow('zh', '中国語')}</ul>
        </section>

        <section class="cfg">
          <h2>自分で足したデータ</h2>
          <p class="note">スマホを替えると消えるので、ときどき書き出して保存してください（CSVファイル）。</p>
          <div class="cfg-grid">
            <button type="button" class="big-btn" id="x-words">${icon('download')}単語を書き出す</button>
            <label class="big-btn file-btn">${icon('upload')}単語を読み込む<input id="i-words" type="file" accept=".csv,text/csv"></label>
            <button type="button" class="big-btn" id="x-qa">${icon('download')}Q&Aを書き出す</button>
            <label class="big-btn file-btn">${icon('upload')}Q&Aを読み込む<input id="i-qa" type="file" accept=".csv,text/csv"></label>
          </div>
          <button type="button" class="big-btn danger" id="reset-prog">${icon('rotate-ccw')}<span>練習の記録を消す</span></button>
        </section>

        <section class="cfg">
          <h2>そのほか</h2>
          <p class="note">下書き（要確認）の文：<b>${App.reviewCount()}</b>件。<a href="review.html" target="_blank" rel="noopener">一覧で確認する</a></p>
          <button type="button" class="big-btn" data-go="help">${icon('circle-help')}使い方を見る</button>
          <p class="note">お客さんの名前・住所などは保存していません。</p>
        </section>
      </main>`;

    const saved = () => App.toast('保存しました');
    App.noticePhotoURL().then((u) => { $('#c-photo').src = u; });

    $('#c-company').addEventListener('change', (e) => { App.saveSettings({ company: e.target.value.trim() }); saved(); });
    $('#c-phone').addEventListener('change', (e) => { App.saveSettings({ phone: e.target.value.trim() }); saved(); });
    const setMin = (d) => {
      const m = Math.max(5, Math.min(90, App.settings().minutes + d));
      App.saveSettings({ minutes: m });
      $('#c-min').innerHTML = `<b>${m}</b> 分`;
    };
    $('#c-min-down').addEventListener('click', () => setMin(-5));
    $('#c-min-up').addEventListener('click', () => setMin(5));

    $('#c-rate').addEventListener('input', (e) => { $('#o-rate').textContent = Number(e.target.value).toFixed(2); App.saveSettings({ rate: Number(e.target.value) }); });
    $('#c-slow').addEventListener('input', (e) => { $('#o-slow').textContent = Number(e.target.value).toFixed(2); App.saveSettings({ rateSlow: Number(e.target.value) }); });
    const sample = "Hello. I'm here to do an electrical safety check.";
    $('#t-rate').addEventListener('click', (e) => App.speech.speak(sample, 'en', { btn: e.currentTarget }));
    $('#t-slow').addEventListener('click', (e) => App.speech.speak(sample, 'en', { slow: true, btn: e.currentTarget }));

    $('#c-photo-in').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const blob = await shrink(f);
      await App.idb.set('notice', blob);
      App.resetPhotoURL();
      $('#c-photo').src = await App.noticePhotoURL();
      App.toast('写真を替えました');
    });
    $('#c-photo-reset').addEventListener('click', async () => {
      await App.idb.del('notice');
      App.resetPhotoURL();
      $('#c-photo').src = await App.noticePhotoURL();
      App.toast('見本の写真に戻しました');
    });

    const readFile = (input, fn) => input.addEventListener('change', async () => {
      const f = input.files[0];
      if (!f) return;
      const n = fn(await f.text());
      App.toast(`${n}件 読み込みました`);
      input.value = '';
    });
    $('#x-words').addEventListener('click', () => App.wordsCSV.export());
    $('#x-qa').addEventListener('click', () => App.qaCSV.export());
    readFile($('#i-words'), (t) => App.wordsCSV.import(t));
    readFile($('#i-qa'), (t) => App.qaCSV.import(t));

    const rp = $('#reset-prog');
    rp.addEventListener('click', () => {
      if (!rp.dataset.sure) { rp.dataset.sure = '1'; rp.querySelector('span').textContent = 'もう一度押すと消えます'; return; }
      App.progress.reset();
      rp.dataset.sure = '';
      rp.querySelector('span').textContent = '練習の記録を消す';
      App.toast('練習の記録を消しました');
    });
  });
})();
