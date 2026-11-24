/* ===========================================================
   CET-6 高频词汇通关手册 — 交互逻辑
   功能：词表检索/筛选/排序、英美双音标与双发音、词根、派生词、
        闪卡、四选一测验、错词本、进度持久化
   =========================================================== */
(function () {
  'use strict';

  /* ---------- 数据整理 ---------- */
  const BATCHES = window.CET6_BATCHES || [];
  const FORMS = window.CET6_FORMS || {};
  const ROOTS = window.CET6_ROOTS || {};
  const PHON = window.CET6_PHON || {};
  const DERIVS = window.CET6_DERIVS || {};

  const WORDS = BATCHES.flat().map((row, i) => {
    const ph = PHON[row[0]] || ['', ''];
    return {
      id: i,
      w: row[0],        // 单词
      phon: row[1],     // 原始音标（兼容旧数据）
      us: ph[0] || row[1],   // 美音
      uk: ph[1] || row[1],   // 英音
      pos: row[2],      // 词性
      mean: row[3],     // 释义
      ex: row[4],       // 例句
      exCn: row[5],     // 例句译文
      letter: row[0][0].toUpperCase(),
      forms: FORMS[row[0]] || null,   // [过去式, 过去分词, 现在分词]
      root: ROOTS[row[0]] || null,    // [构词拆分, 词根义, 语义联想]
      derivs: DERIVS[row[0]] || null  // [[派生词, 词性, 释义, 美音, 英音], ...]
    };
  });
  const PHRASES = window.CET6_PHRASES || [];

  /* ---------- 本地存储 ---------- */
  const KEY = 'cet6.vocab.v1';
  const store = {
    mastered: new Set(),
    starred: new Set(),
    wrong: new Set(),
    quizTotal: 0,
    quizRight: 0,
    theme: 'light',
    accent: 'us'      // 默认发音口音：us / uk
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (Array.isArray(d.mastered)) store.mastered = new Set(d.mastered);
      if (Array.isArray(d.starred)) store.starred = new Set(d.starred);
      if (Array.isArray(d.wrong)) store.wrong = new Set(d.wrong);
      store.quizTotal = d.quizTotal | 0;
      store.quizRight = d.quizRight | 0;
      store.theme = d.theme === 'dark' ? 'dark' : 'light';
      store.accent = d.accent === 'uk' ? 'uk' : 'us';
    } catch (e) { /* 首次访问或数据损坏时静默重置 */ }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        mastered: [...store.mastered],
        starred: [...store.starred],
        wrong: [...store.wrong],
        quizTotal: store.quizTotal,
        quizRight: store.quizRight,
        theme: store.theme,
        accent: store.accent
      }));
    } catch (e) { /* 隐私模式下忽略写入失败 */ }
  }

  /* ---------- 小工具 ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const byId = (id) => WORDS[id];
  const slash = (s) => s ? '/' + s + '/' : '';

  /* ---------- 状态 ---------- */
  const state = {
    view: 'vocab',
    query: '',
    filter: 'all',
    letter: 'all',
    sort: 'az',
    page: 1,
    perPage: 36,
    flashList: [],
    flashIndex: 0,
    quiz: null
  };

  /* ---------- 主题 ---------- */
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    $('#themeIcon').textContent = t === 'dark' ? '☾' : '◐';
    store.theme = t;
    save();
  }

  /* ---------- 统计面板 ---------- */
  function updateStats() {
    const total = WORDS.length;
    const done = store.mastered.size;
    const pct = total ? Math.round((done / total) * 100) : 0;

    $('#statTotal').textContent = total;
    $('#statMastered').textContent = done;
    $('#statQuiz').textContent = store.quizTotal;
    $('#statAcc').textContent = store.quizTotal
      ? Math.round((store.quizRight / store.quizTotal) * 100) + '%'
      : '—';

    const ring = $('#ring');
    ring.style.setProperty('--p', pct);
    $('#ringNum').textContent = pct + '%';

    $('#wrongBadge').textContent = store.wrong.size;
    $('#wrongBadge').hidden = store.wrong.size === 0;
    const mb = $('#mnavBadge');
    if (mb) {
      mb.textContent = store.wrong.size;
      mb.hidden = store.wrong.size === 0;
    }
  }

  /* ---------- 每日一词 ---------- */
  function dailyWord() {
    const day = Math.floor(Date.now() / 86400000);
    const pick = WORDS[(day * 37) % WORDS.length];
    if (!pick) return;
    $('#dailyWord').innerHTML =
      '今日一词 · <b>' + esc(pick.w) + '</b> ' +
      '<span class="muted">' + esc(slash(pick.us)) + ' 美 · ' + esc(slash(pick.uk)) + ' 英</span> — ' +
      esc(pick.mean);
  }

  /* ---------- 视图切换 ---------- */
  function switchView(name) {
    state.view = name;
    $$('.tab').forEach((t) => t.classList.toggle('is-active', t.dataset.view === name));
    $$('.mnav').forEach((t) => t.classList.toggle('is-active', t.dataset.view === name));
    $$('.view').forEach((v) => v.classList.toggle('is-active', v.id === 'view-' + name));
    if (name !== 'vocab') $('#hero').style.display = 'none';
    else $('#hero').style.display = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (name === 'flash') initFlash();
    if (name === 'quiz' && !state.quiz) startQuiz();
    if (name === 'wrong') renderWrong();
  }

  /* ---------- 词表筛选 ---------- */
  function filteredWords() {
    const q = state.query.trim().toLowerCase();
    let list = WORDS.filter((x) => {
      if (state.letter !== 'all' && x.letter !== state.letter) return false;
      if (state.filter === 'todo' && store.mastered.has(x.id)) return false;
      if (state.filter === 'done' && !store.mastered.has(x.id)) return false;
      if (state.filter === 'star' && !store.starred.has(x.id)) return false;
      if (state.filter === 'deriv' && !x.derivs) return false;
      if (!q) return true;
      const hay = [
        x.w, x.mean, x.ex, x.exCn, x.pos, x.us, x.uk,
        x.root ? x.root.join(' ') : '',
        x.forms ? x.forms.join(' ') : '',
        x.derivs ? x.derivs.map((d) => d[0] + ' ' + d[2]).join(' ') : ''
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });

    if (state.sort === 'az') list.sort((a, b) => a.w.localeCompare(b.w));
    else if (state.sort === 'za') list.sort((a, b) => b.w.localeCompare(a.w));
    else if (state.sort === 'len') list.sort((a, b) => a.w.length - b.w.length || a.w.localeCompare(b.w));

    return list;
  }

  /* ---------- 卡片渲染 ---------- */
  function phonRow(x, compact) {
    return '<div class="phons' + (compact ? ' is-compact' : '') + '">' +
      '<span class="ph-item" title="美式音标"><i class="ph-tag">美</i>' +
        '<span class="ph-ipa">' + esc(slash(x.us)) + '</span>' +
        '<button class="ph-play" data-act="say" data-accent="us" data-w="' + esc(x.w) + '" title="播放美式发音" aria-label="播放美式发音">🔊</button>' +
      '</span>' +
      '<span class="ph-item" title="英式音标"><i class="ph-tag">英</i>' +
        '<span class="ph-ipa">' + esc(slash(x.uk)) + '</span>' +
        '<button class="ph-play" data-act="say" data-accent="uk" data-w="' + esc(x.w) + '" title="播放英式发音" aria-label="播放英式发音">🔊</button>' +
      '</span>' +
    '</div>';
  }

  function formsHTML(x) {
    if (!x.forms) return '';
    const [p, pp, ing] = x.forms;
    const same = p === pp;
    return '<div class="wforms">' +
      '<span class="wforms-k">过去式</span><b>' + esc(p) + '</b>' +
      (same ? '' : '<span class="wforms-k">过去分词</span><b>' + esc(pp) + '</b>') +
      '<span class="wforms-k">现在分词</span><b>' + esc(ing) + '</b>' +
      (same ? '<span class="wforms-note">过去式 = 过去分词</span>' : '') +
    '</div>';
  }

  function rootHTML(x) {
    if (!x.root) return '';
    const [split, core, sense] = x.root;
    return '<div class="wroot">' +
      '<div class="wroot-row"><span class="wroot-k">构词</span><span class="wroot-split">' + esc(split) + '</span></div>' +
      '<div class="wroot-row"><span class="wroot-k">词根</span><span>' + esc(core) + '</span></div>' +
      '<div class="wroot-row"><span class="wroot-k">逻辑</span><span>' + esc(sense) + '</span></div>' +
    '</div>';
  }

  function derivHTML(x) {
    if (!x.derivs || !x.derivs.length) return '';
    const rows = x.derivs.map((d) =>
      '<li>' +
        '<button class="dv-w" data-act="say" data-accent="us" data-w="' + esc(d[0]) + '" title="播放美式发音">' + esc(d[0]) + '</button>' +
        '<span class="dv-pos">' + esc(d[1]) + '</span>' +
        '<span class="dv-cn">' + esc(d[2]) + '</span>' +
      '</li>'
    ).join('');
    return '<div class="wderiv">' +
      '<div class="wderiv-head"><span class="wderiv-k">派生</span>' +
      '<span class="wderiv-hint">同词族 · 点词发音</span></div>' +
      '<ul class="wderiv-list">' + rows + '</ul>' +
    '</div>';
  }

  function cardHTML(x) {
    const cls = [
      'wcard',
      store.mastered.has(x.id) ? 'is-mastered' : '',
      store.wrong.has(x.id) ? 'is-wrong' : ''
    ].filter(Boolean).join(' ');

    const starOn = store.starred.has(x.id) ? ' on' : '';
    const doneOn = store.mastered.has(x.id) ? ' done' : '';

    return '<article class="' + cls + '" data-id="' + x.id + '">' +
      '<div class="wcard-tools">' +
        '<button class="mini' + starOn + '" data-act="star" title="收藏">★</button>' +
        '<button class="mini' + doneOn + '" data-act="master" title="标记已掌握">✓</button>' +
      '</div>' +
      '<div class="wcard-top">' +
        '<h3>' + esc(x.w) + '</h3>' +
        '<span class="pos">' + esc(x.pos) + '</span>' +
      '</div>' +
      phonRow(x) +
      '<p class="mean">' + esc(x.mean) + '</p>' +
      formsHTML(x) +
      '<p class="ex"><em>' + esc(x.ex) + '</em>' + esc(x.exCn) + '</p>' +
      rootHTML(x) +
      derivHTML(x) +
    '</article>';
  }

  function renderVocab(reset) {
    if (reset) state.page = 1;
    const list = filteredWords();
    const shown = list.slice(0, state.page * state.perPage);

    $('#wordGrid').innerHTML = shown.map(cardHTML).join('');
    $('#resultCount').textContent = list.length;
    $('#resultHint').textContent = list.length > shown.length
      ? '（已显示 ' + shown.length + '）'
      : '';

    const more = $('#loadMore');
    more.hidden = shown.length >= list.length;
    more.textContent = '加载更多（剩余 ' + Math.max(0, list.length - shown.length) + '）';

    if (!list.length) {
      $('#wordGrid').innerHTML =
        '<p class="empty" style="grid-column:1/-1">没有匹配的词，换个关键词试试。</p>';
    }
  }

  /* ---------- 字母索引 ---------- */
  function buildAlpha() {
    const letters = [...new Set(WORDS.map((x) => x.letter))].sort();
    const has = new Set(letters);
    const all = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    $('#alpha').innerHTML =
      '<button data-letter="all" class="is-active">ALL</button>' +
      all.map((L) =>
        '<button data-letter="' + L + '"' + (has.has(L) ? '' : ' disabled') + '>' + L + '</button>'
      ).join('');
  }

  /* ---------- 发音（美 / 英） ---------- */
  const audioCache = new Map();
  let liveAudio = null;

  function tts(text, accent) {
    if (!('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = accent === 'uk' ? 'en-GB' : 'en-US';
      u.rate = 0.92;
      const want = accent === 'uk' ? /en[-_]GB/i : /en[-_]US/i;
      const v = (speechSynthesis.getVoices() || []).find((x) => want.test(x.lang));
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) { /* 不支持时静默 */ }
  }

  /* 发音：优先播放在线真人语音（有道），失败才回退到系统语音合成。
     判定逻辑：
       - loadedmetadata / canplay / playing 任一发生 → 文件是好的，取消回退
       - error 事件 / play() 被 reject → 立刻回退
       - 5 秒内连元数据都没拿到（断网、被墙、接口挂了）→ 回退 */
  function say(word, accent) {
    if (!word) return;
    accent = accent === 'uk' ? 'uk' : 'us';
    if (store.accent !== accent) { store.accent = accent; save(); }

    const url = 'https://dict.youdao.com/dictvoice?audio=' +
      encodeURIComponent(word) + '&type=' + (accent === 'uk' ? 1 : 2);

    try {
      if (liveAudio) { liveAudio.pause(); liveAudio = null; }

      let audio = audioCache.get(url);
      if (!audio) {
        audio = new Audio();
        audio.preload = 'auto';
        audio.src = url;
        audioCache.set(url, audio);
      }
      liveAudio = audio;
      try { audio.currentTime = 0; } catch (e) { /* 尚未加载时忽略 */ }

      let healthy = false;   // 文件确认可用
      let fellBack = false;
      let timer = null;

      const cleanup = () => { if (timer) { clearTimeout(timer); timer = null; } };
      const markHealthy = () => { healthy = true; cleanup(); };
      const fallback = () => {
        if (healthy || fellBack) return;
        fellBack = true;
        cleanup();
        tts(word, accent);
      };

      audio.addEventListener('loadedmetadata', markHealthy, { once: true });
      audio.addEventListener('canplay', markHealthy, { once: true });
      audio.addEventListener('playing', markHealthy, { once: true });
      audio.addEventListener('error', fallback, { once: true });
      timer = setTimeout(fallback, 5000);

      const p = audio.play();
      if (p && typeof p.catch === 'function') p.catch(fallback);
    } catch (e) {
      tts(word, accent);
    }
  }

  /* ---------- 闪卡 ---------- */
  function initFlash() {
    if (state.flashList.length) return;
    state.flashList = shuffle(WORDS.map((x) => x.id));
    state.flashIndex = 0;
    renderFlash();
  }

  function renderFlash() {
    if (!state.flashList.length) return;
    const id = state.flashList[state.flashIndex % state.flashList.length];
    const x = byId(id);
    if (!x) return;

    $('#flashcard').classList.remove('flipped');
    $('#flashWord').textContent = x.w;
    $('#flashPhonRow').innerHTML = phonRow(x);
    $('#flashPhonBack').innerHTML = phonRow(x, true);
    $('#flashPos').textContent = x.pos;
    $('#flashMeaning').textContent = x.mean;
    $('#flashExample').textContent = x.ex;
    $('#flashExampleCn').textContent = x.exCn;
    $('#flashTag').textContent = store.mastered.has(id) ? '已掌握' : '核心词';

    // 动词变化
    const fBox = $('#flashForms');
    if (x.forms) {
      const [p, pp, ing] = x.forms;
      fBox.innerHTML =
        '<span class="ff-k">过去式</span><b>' + esc(p) + '</b>' +
        '<span class="ff-k">过去分词</span><b>' + esc(pp) + '</b>' +
        '<span class="ff-k">现在分词</span><b>' + esc(ing) + '</b>';
      fBox.hidden = false;
    } else {
      fBox.innerHTML = '';
      fBox.hidden = true;
    }

    // 词根
    const rBox = $('#flashRoot');
    if (x.root) {
      rBox.innerHTML =
        '<div class="fr-row"><span class="fr-k">构词</span><span class="fr-split">' + esc(x.root[0]) + '</span></div>' +
        '<div class="fr-row"><span class="fr-k">词根</span><span>' + esc(x.root[1]) + '</span></div>' +
        '<div class="fr-row"><span class="fr-k">逻辑</span><span>' + esc(x.root[2]) + '</span></div>';
      rBox.hidden = false;
    } else {
      rBox.innerHTML = '';
      rBox.hidden = true;
    }

    // 派生词
    const dBox = $('#flashDerivs');
    if (x.derivs && x.derivs.length) {
      dBox.innerHTML =
        '<div class="fd-head"><span class="fd-k">派生</span><span class="fd-hint">点词发音</span></div>' +
        '<ul class="fd-list">' + x.derivs.map((d) =>
          '<li><button class="dv-w" data-act="say" data-accent="us" data-w="' + esc(d[0]) + '">' + esc(d[0]) + '</button>' +
          '<span class="dv-pos">' + esc(d[1]) + '</span>' +
          '<span class="dv-cn">' + esc(d[2]) + '</span></li>'
        ).join('') + '</ul>';
      dBox.hidden = false;
    } else {
      dBox.innerHTML = '';
      dBox.hidden = true;
    }

    const n = state.flashList.length;
    const i = (state.flashIndex % n) + 1;
    $('#flashProgress').textContent =
      i + ' / ' + n + ' · 本轮已掌握 ' + store.mastered.size + ' 词';
  }

  function flashStep(delta) {
    if (!state.flashList.length) return;
    const n = state.flashList.length;
    state.flashIndex = (state.flashIndex + delta + n) % n;
    renderFlash();
  }

  function flashCurrent() {
    const id = state.flashList[state.flashIndex % state.flashList.length];
    return id === undefined ? null : byId(id);
  }

  /* ---------- 测验 ---------- */
  function startQuiz(pool) {
    const len = parseInt($('#quizLen').value, 10) || 20;
    let source = pool && pool.length ? pool.slice() : WORDS.slice();

    // 有错词时，优先混入 40% 错词，强化复习
    if (!pool && store.wrong.size) {
      const wrongIds = [...store.wrong].filter((id) => byId(id));
      const take = Math.min(Math.ceil(len * 0.4), wrongIds.length);
      const picked = shuffle(wrongIds).slice(0, take);
      const rest = source.filter((x) => !picked.includes(x.id));
      source = shuffle(picked.map(byId)).concat(shuffle(rest));
    } else {
      source = shuffle(source);
    }

    const items = source.slice(0, Math.min(len, source.length)).map((x) => {
      const askEn2Cn = Math.random() < 0.72;
      // 干扰项优先取同词性、且释义首字不重合的词，避免出现近义陷阱
      const head = x.mean.slice(0, 2);
      const pickable = WORDS.filter((o) =>
        o.id !== x.id &&
        o.mean.slice(0, 2) !== head &&
        o.w !== x.w
      );
      const samePos = pickable.filter((o) => o.pos === x.pos);
      const others = shuffle(samePos.length >= 3 ? samePos : pickable);
      const options = shuffle([x].concat(others.slice(0, 3)));
      return {
        word: x,
        options: options.map((o) => ({ id: o.id, text: askEn2Cn ? o.mean : o.w })),
        answer: x.id,
        askEn2Cn
      };
    });

    state.quiz = { items, i: 0, right: 0, answered: false, pool: !!pool };
    $('#quizSummary').hidden = true;
    $('#quizSummary').innerHTML = '';
    renderQuiz();
  }

  function renderQuiz() {
    const q = state.quiz;
    if (!q) return;
    if (q.i >= q.items.length) return finishQuiz();

    const item = q.items[q.i];
    const x = item.word;

    $('#quizIndex').textContent = '第 ' + (q.i + 1) + ' / ' + q.items.length + ' 题';
    $('#quizScore').textContent = '得分 ' + q.right;
    $('#quizBar').style.width = ((q.i / q.items.length) * 100) + '%';

    $('#quizKind').textContent = item.askEn2Cn ? '英 → 中 · 选出正确释义' : '中 → 英 · 选出对应单词';
    $('#quizPrompt').textContent = item.askEn2Cn ? x.w : x.mean;
    $('#quizSub').textContent = item.askEn2Cn
      ? slash(x.us) + ' 美 · ' + slash(x.uk) + ' 英 · ' + x.pos
      : x.pos;

    $('#quizOptions').innerHTML = item.options.map((o, k) =>
      '<button class="opt" data-oid="' + o.id + '">' +
        '<span class="key">' + 'ABCD'[k] + '</span>' +
        '<span>' + esc(o.text) + '</span>' +
      '</button>'
    ).join('');

    $('#quizFeedback').textContent = '';
    $('#quizFeedback').className = 'quiz-feedback';
    $('#quizNext').disabled = true;
    $('#quizNext').textContent = '下一题';
    q.answered = false;

    if (item.askEn2Cn) say(x.w, store.accent);
  }

  function answerQuiz(oid) {
    const q = state.quiz;
    if (!q || q.answered) return;
    const item = q.items[q.i];
    const ok = oid === item.answer;
    q.answered = true;

    $$('#quizOptions .opt').forEach((btn) => {
      btn.disabled = true;
      const id = Number(btn.dataset.oid);
      if (id === item.answer) btn.classList.add('correct');
      else if (id === oid) btn.classList.add('wrong');
    });

    store.quizTotal++;
    if (ok) {
      q.right++;
      store.quizRight++;
      $('#quizFeedback').textContent = '✓ 正确 — ' + item.word.w + ' ' + item.word.pos + ' ' + item.word.mean;
      $('#quizFeedback').className = 'quiz-feedback ok';
    } else {
      store.wrong.add(item.word.id);
      const right = item.options.find((o) => o.id === item.answer);
      $('#quizFeedback').textContent = '✗ 正确答案：' + (right ? right.text : '') +
        ' ｜ ' + item.word.ex;
      $('#quizFeedback').className = 'quiz-feedback no';
    }

    $('#quizScore').textContent = '得分 ' + q.right;
    $('#quizBar').style.width = (((q.i + 1) / q.items.length) * 100) + '%';
    $('#quizNext').disabled = false;
    $('#quizNext').textContent = (q.i + 1 >= q.items.length) ? '看结果' : '下一题';

    updateStats();
    save();
  }

  function finishQuiz() {
    const q = state.quiz;
    const total = q.items.length;
    const acc = total ? Math.round((q.right / total) * 100) : 0;
    $('#quizBar').style.width = '100%';
    $('#quizNext').disabled = true;
    $('#quizNext').textContent = '下一题';

    const tip = acc >= 90 ? '状态极佳，这批词可以进长周期复习了。'
      : acc >= 70 ? '基本稳了，把错词再过一遍就扎实。'
      : acc >= 50 ? '还差点火候，建议回到闪卡再过一轮。'
      : '别急，先把错词本里的词读三遍。';

    $('#quizSummary').hidden = false;
    $('#quizSummary').innerHTML =
      '<h4>本轮结束 · 正确率 <b>' + acc + '%</b></h4>' +
      '<p>答对 ' + q.right + ' / ' + total + ' 题。' + tip + '</p>' +
      '<p style="margin-top:8px">累计答题 ' + store.quizTotal + ' 题，' +
      '总正确率 ' + (store.quizTotal ? Math.round((store.quizRight / store.quizTotal) * 100) : 0) + '%。</p>';

    updateStats();
    save();
  }

  /* ---------- 错词本 ---------- */
  function renderWrong() {
    const list = [...store.wrong].map(byId).filter(Boolean)
      .sort((a, b) => a.w.localeCompare(b.w));

    $('#wrongGrid').innerHTML = list.map(cardHTML).join('');
    $('#wrongEmpty').hidden = list.length > 0;
    $('#wrongQuiz').disabled = list.length === 0;
    $('#wrongQuiz').style.opacity = list.length === 0 ? '.5' : '';
    updateStats();
  }

  /* ---------- 短语 ---------- */
  function renderPhrases() {
    const q = ($('#phraseSearch').value || '').trim().toLowerCase();
    const groups = PHRASES.map((g) => {
      const items = g.items.filter((it) =>
        !q || (it[0] + ' ' + it[1] + ' ' + it[2]).toLowerCase().includes(q)
      );
      return { group: g.group, items };
    }).filter((g) => g.items.length);

    if (!groups.length) {
      $('#phraseList').innerHTML = '<p class="empty">没有匹配的短语。</p>';
      return;
    }

    $('#phraseList').innerHTML = groups.map((g) =>
      '<section class="phrase-group">' +
        '<h3>' + esc(g.group) + ' · ' + g.items.length + '</h3>' +
        '<ul>' + g.items.map((it) =>
          '<li>' +
            '<span class="ph">' + esc(it[0]) + '</span>' +
            '<span class="ph-cn">' + esc(it[1]) + '</span>' +
            '<span class="ph-ex">' + esc(it[2]) + '</span>' +
          '</li>'
        ).join('') + '</ul>' +
      '</section>'
    ).join('');
  }

  /* ---------- 卡片 / 派生词的发音委托 ---------- */
  function onCardClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;

    if (act === 'say') {
      e.preventDefault();
      say(btn.dataset.w, btn.dataset.accent);
      return;
    }

    const card = btn.closest('.wcard');
    if (!card) return;
    const id = Number(card.dataset.id);
    const x = byId(id);
    if (!x) return;

    if (act === 'star') {
      store.starred.has(id) ? store.starred.delete(id) : store.starred.add(id);
      btn.classList.toggle('on', store.starred.has(id));
    } else if (act === 'master') {
      if (store.mastered.has(id)) {
        store.mastered.delete(id);
        card.classList.remove('is-mastered');
        btn.classList.remove('done');
      } else {
        store.mastered.add(id);
        card.classList.add('is-mastered');
        btn.classList.add('done');
      }
      updateStats();
    }
    save();
  }

  /* ---------- 事件绑定 ---------- */
  function bind() {
    // 主题
    $('#themeBtn').addEventListener('click', () => {
      applyTheme(store.theme === 'dark' ? 'light' : 'dark');
    });

    // 顶部标签
    $('#tabs').addEventListener('click', (e) => {
      const t = e.target.closest('.tab');
      if (t) switchView(t.dataset.view);
    });

    // 手机底部导航
    const mnav = $('#mobileNav');
    if (mnav) {
      mnav.addEventListener('click', (e) => {
        const b = e.target.closest('.mnav');
        if (b) switchView(b.dataset.view);
      });
    }

    // 手机端首次访问提示"添加到主屏幕"
    try {
      const standalone = window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true;
      const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
      const hint = $('#installHint');
      if (hint && isMobile && !standalone && !localStorage.getItem('cet6.hint.seen')) {
        hint.hidden = false;
        localStorage.setItem('cet6.hint.seen', '1');
      }
    } catch (e) { /* 忽略 */ }

    // Hero 按钮
    $('#heroStart').addEventListener('click', () => switchView('flash'));
    $('#heroQuiz').addEventListener('click', () => { state.quiz = null; switchView('quiz'); });

    // 搜索
    const search = $('#search');
    search.addEventListener('input', () => {
      state.query = search.value;
      $('#searchClear').hidden = !search.value;
      renderVocab(true);
    });
    $('#searchClear').addEventListener('click', () => {
      search.value = ''; state.query = '';
      $('#searchClear').hidden = true;
      renderVocab(true); search.focus();
    });

    // 筛选
    $('#filters').addEventListener('click', (e) => {
      const c = e.target.closest('.chip');
      if (!c) return;
      $$('#filters .chip').forEach((x) => x.classList.toggle('is-active', x === c));
      state.filter = c.dataset.filter;
      renderVocab(true);
    });

    // 排序
    $('#sortSel').addEventListener('change', (e) => {
      state.sort = e.target.value;
      renderVocab(true);
    });

    // 字母
    $('#alpha').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      $$('#alpha button').forEach((x) => x.classList.toggle('is-active', x === b));
      state.letter = b.dataset.letter;
      renderVocab(true);
    });

    // 加载更多
    $('#loadMore').addEventListener('click', () => {
      state.page++;
      renderVocab(false);
    });

    // 卡片内操作（词表 + 错词本共用）
    $('#wordGrid').addEventListener('click', onCardClick);
    $('#wrongGrid').addEventListener('click', onCardClick);
    $('#flashDerivs').addEventListener('click', onCardClick);

    // 闪卡
    const flashcard = $('#flashcard');
    flashcard.addEventListener('click', (e) => {
      if (e.target.closest('[data-act]')) return;   // 点发音按钮不翻面
      flashcard.classList.toggle('flipped');
    });
    flashcard.addEventListener('keydown', (e) => {
      if (e.target.closest('[data-act]')) return;   // 焦点在发音按钮上时交给按钮自己处理
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        flashcard.classList.toggle('flipped');
      }
    });

    $('#flashPrev').addEventListener('click', () => flashStep(-1));
    $('#flashNext').addEventListener('click', () => flashStep(1));

    $('#flashSayUs').addEventListener('click', () => {
      const x = flashCurrent(); if (x) say(x.w, 'us');
    });
    $('#flashSayUk').addEventListener('click', () => {
      const x = flashCurrent(); if (x) say(x.w, 'uk');
    });

    $('#flashMaster').addEventListener('click', () => {
      const x = flashCurrent(); if (!x) return;
      store.mastered.add(x.id);
      store.wrong.delete(x.id);
      updateStats(); save();
      flashStep(1);
    });

    $('#flashKnow').addEventListener('click', () => {
      const x = flashCurrent(); if (!x) return;
      store.wrong.add(x.id);
      store.mastered.delete(x.id);
      updateStats(); save();
      flashStep(1);
    });

    $('#flashShuffle').addEventListener('click', () => {
      state.flashList = shuffle(WORDS.map((x) => x.id));
      state.flashIndex = 0;
      renderFlash();
    });

    // 测验
    $('#quizOptions').addEventListener('click', (e) => {
      const b = e.target.closest('.opt');
      if (b && !b.disabled) answerQuiz(Number(b.dataset.oid));
    });

    $('#quizNext').addEventListener('click', () => {
      const q = state.quiz;
      if (!q) return;
      q.i++;
      renderQuiz();
    });

    $('#quizRestart').addEventListener('click', () => {
      state.quiz = null;
      startQuiz();
    });

    $('#quizLen').addEventListener('change', () => {
      state.quiz = null;
      startQuiz();
    });

    // 错词本
    $('#wrongQuiz').addEventListener('click', () => {
      const pool = [...store.wrong].map(byId).filter(Boolean);
      if (!pool.length) return;
      state.quiz = null;
      switchView('quiz');
      startQuiz(pool);
    });

    $('#wrongClear').addEventListener('click', () => {
      store.wrong.clear();
      renderWrong();
      save();
    });

    // 短语搜索
    $('#phraseSearch').addEventListener('input', renderPhrases);

    // 全局快捷键（闪卡视图）
    document.addEventListener('keydown', (e) => {
      if (state.view !== 'flash') return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;

      if (e.key === ' ') {
        e.preventDefault();
        flashcard.classList.toggle('flipped');
      } else if (e.key === 'ArrowLeft') {
        flashStep(-1);
      } else if (e.key === 'ArrowRight') {
        flashStep(1);
      } else if (e.key.toLowerCase() === 'm') {
        $('#flashMaster').click();
      } else if (e.key.toLowerCase() === 'x') {
        $('#flashKnow').click();
      } else if (e.key === '1') {
        const x = flashCurrent(); if (x) say(x.w, 'us');
      } else if (e.key === '2') {
        const x = flashCurrent(); if (x) say(x.w, 'uk');
      }
    });

    // 预热语音列表（部分浏览器异步加载）
    if ('speechSynthesis' in window) {
      speechSynthesis.getVoices();
      speechSynthesis.addEventListener &&
        speechSynthesis.addEventListener('voiceschanged', () => speechSynthesis.getVoices());
    }
  }

  /* ---------- 启动 ---------- */
  function init() {
    load();
    applyTheme(store.theme);
    buildAlpha();
    bind();
    renderVocab(true);
    renderPhrases();
    renderWrong();
    updateStats();
    dailyWord();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
