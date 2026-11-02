// 오늘의 타로 — 화면, 섞기·뽑기, 풀이 만들기, 기록 저장, txt 내보내기
// 서버 없이 동작하며, 기록은 이 브라우저의 localStorage에만 저장됩니다.
(() => {
  'use strict';
  const CARDS = window.TAROT_CARDS;
  const BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));
  const $ = (id) => document.getElementById(id);
  const STORE_KEY = 'tarot.history.v1';
  const MAX_HISTORY = 300;

  // ── 주제와 배열 ──────────────────────────────────────────
  const TOPICS = [
    { key: 'general', label: '전체 운' },
    { key: 'love', label: '연애운' },
    { key: 'money', label: '재물운' },
    { key: 'work', label: '취업·학업운' },
    { key: 'people', label: '인간관계운' },
    { key: 'health', label: '건강운' },
  ];
  const SPREADS = [
    { key: 'one', label: '원카드', desc: '오늘의 메시지 한 장',
      pos: [{ name: '오늘의 카드', about: '지금 나에게 필요한 메시지' }] },
    { key: 'three', label: '과거 · 현재 · 미래', desc: '흐름을 읽는 세 장',
      pos: [
        { name: '과거', about: '지금 상황에 영향을 준 지난 흐름' },
        { name: '현재', about: '지금 내가 서 있는 자리' },
        { name: '미래', about: '이대로 흘러갈 때 다가올 모습' },
      ] },
    { key: 'advice', label: '상황 · 조언 · 결과', desc: '해결책을 찾는 세 장',
      pos: [
        { name: '상황', about: '지금 문제의 핵심' },
        { name: '조언', about: '내가 취하면 좋은 태도와 행동' },
        { name: '결과', about: '조언을 따랐을 때 기대할 수 있는 결과' },
      ] },
    { key: 'celtic', label: '켈틱 크로스', desc: '깊이 들여다보는 열 장',
      pos: [
        { name: '현재 상황', about: '지금 일어나고 있는 일의 중심' },
        { name: '장애물', about: '앞을 가로막거나 엇갈리게 하는 힘' },
        { name: '목표', about: '내가 의식적으로 바라는 것' },
        { name: '근본 원인', about: '보이지 않는 곳에 깔린 이유' },
        { name: '과거', about: '지나가고 있는 흐름' },
        { name: '가까운 미래', about: '곧 다가올 일' },
        { name: '나 자신', about: '이 상황을 대하는 나의 태도' },
        { name: '주변 환경', about: '주변 사람과 환경의 영향' },
        { name: '희망과 두려움', about: '마음속 기대와 걱정' },
        { name: '최종 결과', about: '지금 흐름이 이어질 때의 결말' },
      ] },
  ];
  const SUIT = {
    major: { ko: '메이저', theme: '인생의 큰 흐름' },
    wands: { ko: '완드', theme: '열정과 행동' },
    cups: { ko: '컵', theme: '감정과 관계' },
    swords: { ko: '검', theme: '생각과 갈등' },
    pentacles: { ko: '펜타클', theme: '돈과 현실' },
  };
  const suitOf = (id) => id.split('-')[0];
  const numOf = (id) => Number(id.split('-')[1]);

  const state = { topic: 'general', spread: 'three', question: '', reversals: true, deck: [], picked: [], reading: null };

  // ── 도우미 ──────────────────────────────────────────────
  // 암호용 난수로 공정하게 섞기 (Fisher–Yates)
  function randInt(n) {
    const a = new Uint32Array(1);
    const lim = Math.floor(0x100000000 / n) * n;
    do crypto.getRandomValues(a); while (a[0] >= lim);
    return a[0] % n;
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = randInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const imgOf = (id) => `img/cards/${id}.webp`;
  const fmtDate = (t) => {
    const d = new Date(t), p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg; el.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 2200);
  }
  // 저장소: 사생활 보호 모드 등에서 막혀도 화면은 동작하게
  const store = {
    load() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch { return []; } },
    save(list) { try { localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(0, MAX_HISTORY))); return true; } catch { return false; } },
  };

  // ── 탭 ──────────────────────────────────────────────────
  // 화면 이동은 주소의 # 뒤에 기록 (폰의 뒤로 가기 버튼으로 방에 돌아올 수 있게)
  function showTab(name, { push = true } = {}) {
    document.body.classList.remove('at-home');
    $('home').hidden = true;
    if (push && location.hash !== `#${name}`) history.pushState(null, '', `#${name}`);
    document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    for (const t of ['read', 'history', 'deck']) $(`tab-${t}`).hidden = t !== name;
    if (name === 'history') renderHistory();
    if (name === 'deck') renderGallery();
    window.scrollTo({ top: 0 });
  }
  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
  function goHome({ push = true } = {}) {
    closeModal();
    document.body.classList.add('at-home');
    $('home').hidden = false;
    if (push && location.hash) history.pushState(null, '', location.pathname + location.search);
    window.dispatchEvent(new Event('tarot:home'));
  }
  $('back-home').addEventListener('click', () => goHome());
  function route() {
    const h = location.hash.slice(1);
    if (['read', 'history', 'deck'].includes(h)) showTab(h, { push: false });
    else goHome({ push: false });
  }
  window.addEventListener('popstate', route);

  // ── 1단계: 설정 ─────────────────────────────────────────
  function renderSetup() {
    $('topics').innerHTML = TOPICS.map((t) =>
      `<button class="chip" data-topic="${t.key}" aria-pressed="${t.key === state.topic}">${t.label}</button>`).join('');
    $('spreads').innerHTML = SPREADS.map((s) =>
      `<button class="spread" data-spread="${s.key}" aria-pressed="${s.key === state.spread}"><b>${s.label}</b><span>${s.desc} · ${s.pos.length}장</span></button>`).join('');
  }
  $('topics').addEventListener('click', (e) => {
    const b = e.target.closest('[data-topic]'); if (!b) return;
    state.topic = b.dataset.topic; state.topicManual = true; renderSetup(); suggestTopic();
  });

  // 메모 속 단어로 주제 추천 (뜻을 이해하는 것이 아니라 단어만 봄)
  const TOPIC_WORDS = {
    love: ['연애', '사랑', '썸', '남친', '여친', '남자친구', '여자친구', '애인', '짝사랑', '고백', '재회', '결혼', '소개팅', '이별', '헤어', '연인', '데이트', '그 사람', '그사람', '배우자', '궁합', '전남친', '전여친'],
    work: ['취업', '이직', '면접', '시험', '합격', '회사', '직장', '승진', '공부', '학업', '성적', '자격증', '진로', '퇴사', '사업', '창업', '프로젝트', '입사', '수능', '대학', '알바', '취준', '업무'],
    money: ['돈', '재물', '금전', '투자', '주식', '코인', '부동산', '월급', '연봉', '수입', '대출', '빚', '저축', '로또', '매출', '용돈', '재테크', '적금'],
    people: ['친구', '동료', '상사', '가족', '부모', '엄마', '아빠', '형제', '언니', '오빠', '누나', '동생', '인간관계', '사람들', '모임', '갈등', '화해', '팀원', '선배', '후배'],
    health: ['건강', '병원', '아파', '아프', '다이어트', '운동', '수면', '불면', '컨디션', '피곤', '스트레스', '체중', '치료', '수술'],
  };
  function topicFromText(text) {
    let best = null, bestN = 0, word = '';
    for (const [k, words] of Object.entries(TOPIC_WORDS)) {
      const hit = words.filter((w) => text.includes(w));
      if (hit.length > bestN) { best = k; bestN = hit.length; word = hit[0]; }
    }
    return best ? { key: best, word } : null;
  }
  function suggestTopic() {
    const hint = $('memo-hint');
    const s = topicFromText($('question').value);
    if (!s) { hint.textContent = '적은 메모는 점괘 기록에 함께 남아요. 메모 속 단어를 보고 어울리는 주제를 골라 드려요.'; return; }
    const label = topicDef(s.key).label;
    if (s.key === state.topic) { hint.innerHTML = `‘${esc(s.word)}’ 단어를 보고 <b>${label}</b>을 골랐어요. 다른 주제를 눌러 바꿀 수 있어요.`; return; }
    if (!state.topicManual) { state.topic = s.key; renderSetup(); hint.innerHTML = `‘${esc(s.word)}’ 단어를 보고 <b>${label}</b>을 골랐어요. 다른 주제를 눌러 바꿀 수 있어요.`; return; }
    hint.innerHTML = `‘${esc(s.word)}’ 단어를 보면 <b>${label}</b>이 어울려 보여요. <button class="link-btn" data-suggest="${s.key}">${label}으로 바꾸기</button>`;
  }
  let suggestTimer = 0;
  $('question').addEventListener('input', () => { clearTimeout(suggestTimer); suggestTimer = setTimeout(suggestTopic, 250); });
  $('memo-hint').addEventListener('click', (e) => {
    const b = e.target.closest('[data-suggest]'); if (!b) return;
    state.topic = b.dataset.suggest; renderSetup(); suggestTopic();
  });
  $('spreads').addEventListener('click', (e) => {
    const b = e.target.closest('[data-spread]'); if (!b) return;
    state.spread = b.dataset.spread; renderSetup();
  });

  const spreadDef = () => SPREADS.find((s) => s.key === state.spread);
  const topicDef = (k = state.topic) => TOPICS.find((t) => t.key === k);

  function showStep(name) {
    for (const s of ['setup', 'pick', 'result']) $(`step-${s}`).hidden = s !== name;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── 2단계: 섞고 고르기 ──────────────────────────────────
  function startPick() {
    state.question = $('question').value.trim();
    state.reversals = $('reversals').checked;
    state.deck = shuffle(CARDS.map((c) => c.id)).map((id) => ({ id, rev: state.reversals && randInt(2) === 1 }));
    state.picked = [];
    renderDeck();
    showStep('pick');
  }
  function renderDeck() {
    const need = spreadDef().pos.length;
    $('pick-msg').textContent = `카드 ${need}장을 골라 주세요. (${state.picked.length} / ${need})`;
    $('deck').innerHTML = state.deck.map((c, i) =>
      `<button class="back${state.picked.includes(i) ? ' taken' : ''}" data-i="${i}" style="--d:${(i % 13) * 18}ms" aria-label="${i + 1}번째 카드"></button>`).join('');
    $('deck').classList.remove('shuffling'); void $('deck').offsetWidth; $('deck').classList.add('shuffling');
  }
  $('deck').addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]'); if (!b) return;
    const i = Number(b.dataset.i);
    if (state.picked.includes(i)) return;
    state.picked.push(i);
    b.classList.add('taken');
    const need = spreadDef().pos.length;
    $('pick-msg').textContent = `카드 ${need}장을 골라 주세요. (${state.picked.length} / ${need})`;
    if (state.picked.length >= need) setTimeout(finishPick, 350);
  });
  $('reshuffle').addEventListener('click', startPick);
  $('auto-pick').addEventListener('click', () => {
    const need = spreadDef().pos.length;
    const left = shuffle([...state.deck.keys()].filter((i) => !state.picked.includes(i)));
    state.picked.push(...left.slice(0, need - state.picked.length));
    finishPick();
  });
  $('start').addEventListener('click', startPick);

  function finishPick() {
    const sp = spreadDef();
    const cards = state.picked.slice(0, sp.pos.length).map((i) => state.deck[i]);
    state.reading = { id: Date.now().toString(36) + randInt(1e6).toString(36), date: Date.now(), topic: state.topic, spread: sp.key, question: state.question, cards };
    saveReading(state.reading);
    renderResult(state.reading, false);
    showStep('result');
  }

  // ── 3단계: 결과와 풀이 ──────────────────────────────────
  function renderResult(r, revealed) {
    const sp = SPREADS.find((s) => s.key === r.spread);
    $('result-meta').textContent = `${topicDef(r.topic).label} · ${sp.label} · ${fmtDate(r.date)}`;
    $('result-question').textContent = r.question ? `메모 · ${r.question}` : '';
    $('result-question').hidden = !r.question;
    $('spread-view').className = `spread-view sv-${sp.key}`;
    $('spread-view').innerHTML = r.cards.map((c, i) => {
      const card = BY_ID[c.id];
      return `<div class="slot slot-${i}">
        <button class="flip${revealed ? ' open' : ''}${c.rev ? ' rev' : ''}" data-i="${i}" aria-label="${sp.pos[i].name} 카드 뒤집기">
          <span class="face back-face"></span>
          <span class="face front-face"><img src="${imgOf(c.id)}" alt="${esc(card.ko)}" loading="lazy"></span>
        </button>
        <span class="pos">${i + 1}. ${sp.pos[i].name}</span>
      </div>`;
    }).join('');
    $('reading').hidden = true;
    $('result-actions').hidden = true;
    $('flip-all').hidden = revealed;
    $('flip-hint').hidden = revealed;
    if (revealed) showReading(r);
  }
  $('spread-view').addEventListener('click', (e) => {
    const b = e.target.closest('.flip'); if (!b) return;
    if (b.classList.contains('open')) {
      // 뒤집힌 카드를 누르면 해당 풀이로 이동
      document.getElementById(`card-reading-${b.dataset.i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    b.classList.add('open');
    if (!$('spread-view').querySelector('.flip:not(.open)')) showReading(state.reading);
  });
  $('flip-all').addEventListener('click', () => {
    $('spread-view').querySelectorAll('.flip').forEach((b, i) => setTimeout(() => b.classList.add('open'), i * 120));
    setTimeout(() => showReading(state.reading), state.reading.cards.length * 120 + 400);
  });

  // 풀이 데이터 만들기 (화면과 txt가 같이 씀)
  function buildReading(r) {
    const sp = SPREADS.find((s) => s.key === r.spread);
    const topic = r.topic;
    const items = r.cards.map((c, i) => {
      const card = BY_ID[c.id];
      const k = c.rev ? 1 : 0;
      return {
        pos: sp.pos[i], card, rev: c.rev,
        kw: card.kw[k],
        topicText: topic === 'general' ? null : card.t[topic][k],
        base: c.rev ? card.rev : card.up,
      };
    });
    return { sp, items, summary: summarize(r, items) };
  }

  // 종합 풀이: 메이저 비율, 많이 나온 슈트, 역방향 수, 반복되는 숫자, 마지막 카드
  function summarize(r, items) {
    const n = items.length, lines = [];
    const topicLabel = topicDef(r.topic).label;
    if (n === 1) {
      const it = items[0];
      lines.push(`오늘은 「${it.card.ko}」${it.rev ? '(역방향)' : ''} 카드가 나왔어요. 키워드는 ${it.kw}입니다.`);
      lines.push(it.rev ? '막힌 부분이 무엇인지 먼저 살펴보고, 작게라도 풀어 가는 하루가 되면 좋겠어요.' : '이 카드의 에너지를 의식하며 하루를 보내 보세요.');
      return lines;
    }
    const majors = items.filter((it) => suitOf(it.card.id) === 'major').length;
    if (majors / n >= 0.5) lines.push(`메이저 카드가 ${majors}장으로 많아요. 지금 ${topicLabel}은 우연이 아닌, 삶의 큰 흐름이 움직이는 중요한 시기와 맞닿아 있어요.`);
    else if (majors === 0) lines.push(`메이저 카드가 한 장도 없어요. 운명처럼 정해진 일이라기보다, 일상의 선택과 노력으로 충분히 바꿀 수 있는 흐름이에요.`);

    const cnt = {};
    for (const it of items) { const s = suitOf(it.card.id); if (s !== 'major') cnt[s] = (cnt[s] || 0) + 1; }
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= Math.max(2, Math.ceil(n * 0.4))) {
      const s = SUIT[top[0]];
      const hint = {
        wands: '생각만 하기보다 직접 움직이는 것이 열쇠예요.',
        cups: '머리보다 마음이 원하는 쪽에 귀를 기울여 보세요.',
        swords: '감정보다 사실을 차분히 정리하는 것이 필요해요.',
        pentacles: '현실적인 계획과 꾸준함이 결과를 만들어요.',
      }[top[0]];
      lines.push(`${s.ko} 카드가 ${top[1]}장으로 가장 많아요. 이번 흐름의 중심은 「${s.theme}」이에요. ${hint}`);
    }

    const revs = items.filter((it) => it.rev).length;
    if (revs / n >= 0.6) lines.push(`역방향 카드가 ${revs}장이에요. 에너지가 막히거나 늦어지는 부분이 있으니, 서두르기보다 걸림돌을 하나씩 치우는 것이 먼저예요.`);
    else if (revs === 0) lines.push('역방향 카드가 없어요. 흐름이 비교적 순조롭게 흘러가고 있어요.');

    const aces = items.filter((it) => suitOf(it.card.id) !== 'major' && numOf(it.card.id) === 1).length;
    const courts = items.filter((it) => suitOf(it.card.id) !== 'major' && numOf(it.card.id) >= 11).length;
    if (aces >= 2) lines.push(`에이스가 ${aces}장 나왔어요. 새로운 시작의 기운이 강하니 망설이던 일을 시작해 볼 만해요.`);
    if (courts >= 2) lines.push(`인물 카드가 ${courts}장이에요. 주변 사람들의 영향이 큰 시기이니, 누구와 함께하는지가 중요해요.`);

    // 마지막 자리(결과·미래·조언) 카드로 마무리
    const advice = items.find((it) => it.pos.name === '조언');
    const last = items[items.length - 1];
    if (advice) lines.push(`조언 카드인 「${advice.card.ko}」${advice.rev ? '(역방향)' : ''}는 「${advice.kw.split(' · ')[0]}」을 말해요. ${advice.topicText || advice.base}`);
    lines.push(`마지막 「${last.pos.name}」 자리의 「${last.card.ko}」${last.rev ? '(역방향)' : ''} 카드는 ${last.rev ? '아직 정리되지 않은 부분이 남아 있음을 알려 줘요. 지금부터의 선택으로 충분히 바꿀 수 있어요.' : '흐름이 좋은 방향으로 이어질 수 있음을 보여 줘요. 지금의 마음가짐을 이어 가세요.'}`);
    return lines;
  }

  function showReading(r) {
    const { sp, items, summary } = buildReading(r);
    const topicLabel = topicDef(r.topic).label;
    $('reading').innerHTML = `
      ${items.map((it, i) => `
        <article class="card-reading" id="card-reading-${i}">
          <img class="thumb${it.rev ? ' rev' : ''}" src="${imgOf(it.card.id)}" alt="" loading="lazy">
          <div>
            <p class="pos-name">${i + 1}. ${esc(it.pos.name)} <small>${esc(it.pos.about)}</small></p>
            <h3>${esc(it.card.ko)} <span class="en">${esc(it.card.en)}</span> ${it.rev ? '<span class="badge rev">역방향</span>' : '<span class="badge">정방향</span>'}</h3>
            <p class="kw">${esc(it.kw)}</p>
            ${it.topicText ? `<p class="topic-text"><b>${topicLabel}</b> ${esc(it.topicText)}</p>` : ''}
            <p class="base">${esc(it.base)}</p>
          </div>
        </article>`).join('')}
      <section class="summary">
        <h3>종합 풀이</h3>
        ${summary.map((l) => `<p>${esc(l)}</p>`).join('')}
      </section>`;
    $('reading').hidden = false;
    $('result-actions').hidden = false;
    $('flip-all').hidden = true;
    $('flip-hint').hidden = true;
    void sp;
  }

  // ── txt 만들기 · 저장 · 공유 ────────────────────────────
  function readingText(r) {
    const { sp, items, summary } = buildReading(r);
    const topicLabel = topicDef(r.topic).label;
    const out = [];
    out.push('[오늘의 타로]');
    out.push(`날짜: ${fmtDate(r.date)}`);
    out.push(`주제: ${topicLabel} / 배열: ${sp.label}`);
    if (r.question) out.push(`메모: ${r.question}`);
    out.push('');
    items.forEach((it, i) => {
      out.push(`${i + 1}. ${it.pos.name} (${it.pos.about})`);
      out.push(`   ${it.card.ko} (${it.card.en}) - ${it.rev ? '역방향' : '정방향'}`);
      out.push(`   키워드: ${it.kw}`);
      if (it.topicText) out.push(`   ${topicLabel}: ${it.topicText}`);
      out.push(`   ${it.base}`);
      out.push('');
    });
    out.push('[종합 풀이]');
    summary.forEach((l) => out.push(`- ${l}`));
    return out.join('\n');
  }
  function download(name, text) {
    // 윈도 메모장에서도 한글이 깨지지 않도록 BOM을 붙인 UTF-8
    const blob = new Blob(['﻿' + text.replace(/\n/g, '\r\n')], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const fileStamp = (t) => fmtDate(t).replace(/[.: ]/g, (c) => (c === ' ' ? '_' : c === ':' ? '' : '-'));
  async function share(text) {
    if (navigator.share) {
      const url = location.protocol.startsWith('http') ? `\n\n${location.origin}${location.pathname}` : '';
      try { await navigator.share({ title: '오늘의 타로', text: text + url }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(text); toast('풀이를 복사했어요. 원하는 곳에 붙여 넣으세요.'); }
    catch { toast('이 브라우저에서는 공유를 지원하지 않아요. txt로 저장해 주세요.'); }
  }
  $('save-txt').addEventListener('click', () => download(`타로_${fileStamp(state.reading.date)}.txt`, readingText(state.reading)));
  $('share').addEventListener('click', () => share(readingText(state.reading)));
  $('again').addEventListener('click', () => { $('question').value = ''; state.topicManual = false; suggestTopic(); showStep('setup'); });

  // ── 기록 ────────────────────────────────────────────────
  function saveReading(r) {
    const list = store.load();
    list.unshift(r);
    if (!store.save(list)) toast('이 브라우저에서는 기록을 저장할 수 없어요. (사생활 보호 모드 등)');
  }
  function renderHistory() {
    const list = store.load();
    $('clear-all').disabled = !list.length;
    $('select-all').disabled = !list.length;
    for (const id of [...selected]) if (!list.some((r) => r.id === id)) selected.delete(id);
    updateSel(list.length);
    if (!list.length) { $('history').innerHTML = '<li class="empty">아직 기록이 없어요.</li>'; return; }
    $('history').innerHTML = list.map((r) => {
      const sp = SPREADS.find((s) => s.key === r.spread);
      const names = r.cards.map((c) => BY_ID[c.id].ko + (c.rev ? '(역)' : '')).join(', ');
      return `<li class="h-item${selected.has(r.id) ? ' sel' : ''}" data-id="${r.id}">
        <label class="h-check" aria-label="이 점괘 선택"><input type="checkbox" ${selected.has(r.id) ? 'checked' : ''}></label>
        <button class="h-open">
          <span class="h-thumbs">${r.cards.slice(0, 3).map((c) => `<img src="${imgOf(c.id)}" class="${c.rev ? 'rev' : ''}" alt="" loading="lazy">`).join('')}</span>
          <span class="h-text"><b>${topicDef(r.topic).label} · ${sp.label}</b><small>${fmtDate(r.date)}</small>
          ${r.question ? `<em>메모 · ${esc(r.question)}</em>` : ''}<span class="h-cards">${esc(names)}</span></span>
        </button>
        <span class="h-side">
          <button class="h-txt" aria-label="이 점괘 txt로 저장">txt</button>
          <button class="h-share" aria-label="이 점괘 공유">공유</button>
          <button class="h-del" aria-label="이 기록 삭제">삭제</button>
        </span>
      </li>`;
    }).join('');
  }
  $('history').addEventListener('click', (e) => {
    const li = e.target.closest('.h-item'); if (!li) return;
    const list = store.load();
    const r = list.find((x) => x.id === li.dataset.id); if (!r) return;
    if (e.target.closest('.h-check')) {
      const cb = li.querySelector('.h-check input');
      if (e.target !== cb) return; // 라벨을 누르면 체크박스 클릭으로 한 번 더 들어옴
      if (cb.checked) selected.add(r.id); else selected.delete(r.id);
      li.classList.toggle('sel', cb.checked);
      updateSel(list.length);
      return;
    }
    if (e.target.closest('.h-txt')) { download(`타로_${fileStamp(r.date)}.txt`, readingText(r)); return; }
    if (e.target.closest('.h-share')) { share(readingText(r)); return; }
    if (e.target.closest('.h-del')) {
      // 실수 방지: 한 번 더 누르면 삭제
      const btn = e.target.closest('.h-del');
      if (!btn.classList.contains('confirm')) { btn.classList.add('confirm'); btn.textContent = '정말 삭제'; setTimeout(() => { btn.classList.remove('confirm'); btn.textContent = '삭제'; }, 2500); return; }
      store.save(list.filter((x) => x.id !== r.id));
      renderHistory();
      return;
    }
    state.reading = r;
    showTab('read');
    renderResult(r, true);
    showStep('result');
  });
  // 골라서 저장·공유
  const selected = new Set();
  function updateSel(total) {
    const n = selected.size;
    $('sel-count').textContent = `선택 ${n}개`;
    $('export-sel').disabled = $('share-sel').disabled = !n;
    $('select-all').checked = total > 0 && n === total;
    $('select-all').indeterminate = n > 0 && n < total;
  }
  const selectedText = () => store.load().filter((r) => selected.has(r.id)).map(readingText).join('\n\n====================\n\n');
  $('select-all').addEventListener('change', (e) => {
    selected.clear();
    if (e.target.checked) store.load().forEach((r) => selected.add(r.id));
    renderHistory();
  });
  $('export-sel').addEventListener('click', () => {
    if (!selected.size) return;
    const one = selected.size === 1 ? store.load().find((r) => selected.has(r.id)) : null;
    download(one ? `타로_${fileStamp(one.date)}.txt` : `타로_점괘${selected.size}개_${fileStamp(Date.now())}.txt`, selectedText());
  });
  $('share-sel').addEventListener('click', () => { if (selected.size) share(selectedText()); });
  $('clear-all').addEventListener('click', (e) => {
    const b = e.currentTarget;
    if (!b.classList.contains('confirm')) { b.classList.add('confirm'); b.textContent = '한 번 더 누르면 모두 삭제'; setTimeout(() => { b.classList.remove('confirm'); b.textContent = '전체 삭제'; }, 3000); return; }
    store.save([]); selected.clear(); b.classList.remove('confirm'); b.textContent = '전체 삭제';
    renderHistory(); toast('기록을 모두 지웠어요.');
  });

  // ── 카드 사전 ───────────────────────────────────────────
  let deckFilter = 'all';
  function renderGallery() {
    const filters = [['all', '전체'], ['major', '메이저'], ['wands', '완드'], ['cups', '컵'], ['swords', '검'], ['pentacles', '펜타클']];
    $('deck-filter').innerHTML = filters.map(([k, l]) => `<button class="chip" data-f="${k}" aria-pressed="${k === deckFilter}">${l}</button>`).join('');
    $('gallery').innerHTML = CARDS.filter((c) => deckFilter === 'all' || suitOf(c.id) === deckFilter).map((c) =>
      `<button class="g-card" data-id="${c.id}"><img src="${imgOf(c.id)}" alt="" loading="lazy"><span>${esc(c.ko)}</span></button>`).join('');
  }
  $('deck-filter').addEventListener('click', (e) => {
    const b = e.target.closest('[data-f]'); if (!b) return;
    deckFilter = b.dataset.f; renderGallery();
  });
  $('gallery').addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]'); if (!b) return;
    openCard(BY_ID[b.dataset.id]);
  });
  function openCard(c) {
    const rows = TOPICS.filter((t) => t.key !== 'general').map((t) =>
      `<tr><th>${t.label}</th><td>${esc(c.t[t.key][0])}</td><td>${esc(c.t[t.key][1])}</td></tr>`).join('');
    $('modal-body').innerHTML = `
      <div class="m-head">
        <img src="${imgOf(c.id)}" alt="${esc(c.ko)}">
        <div>
          <h3>${esc(c.ko)} <span class="en">${esc(c.en)}</span></h3>
          <p><span class="badge">정방향</span> ${esc(c.kw[0])}</p>
          <p class="base">${esc(c.up)}</p>
          <p><span class="badge rev">역방향</span> ${esc(c.kw[1])}</p>
          <p class="base">${esc(c.rev)}</p>
        </div>
      </div>
      <div class="table-wrap"><table class="m-table"><thead><tr><th></th><th>정방향</th><th>역방향</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    $('modal').hidden = false;
    document.body.classList.add('no-scroll');
  }
  function closeModal() { $('modal').hidden = true; document.body.classList.remove('no-scroll'); }
  $('modal-close').addEventListener('click', closeModal);
  $('modal').addEventListener('click', (e) => { if (e.target === $('modal')) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('modal').hidden) closeModal(); });

  // ── 시작 ────────────────────────────────────────────────
  if (CARDS.length !== 78) console.warn(`카드 데이터가 ${CARDS.length}장입니다 (78장이어야 함)`);
  renderSetup();
  route();
  // 첫 화면(home.js)에서 쓰는 기능
  window.TarotApp = {
    showTab, goHome,
    // 수정 구슬: 오늘의 한 장을 바로 뽑기
    quickOne() {
      state.topic = 'general'; state.spread = 'one'; $('question').value = '';
      renderSetup(); showTab('read'); startPick();
    },
    newReading() { state.topicManual = false; renderSetup(); suggestTopic(); showTab('read'); showStep('setup'); },
    lastReading() { const r = store.load()[0]; return r ? { ...r, names: r.cards.map((c) => BY_ID[c.id].ko + (c.rev ? '(역방향)' : '')), topicLabel: topicDef(r.topic).label } : null; },
  };
  window.__tarot = { state, buildReading, readingText, CARDS };
})();
