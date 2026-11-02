// 첫 화면: 점술가의 방. 그림 위의 물건(카드, 수정 구슬, 책, 책장)을 누르면 각 화면으로 이동하고,
// 아래 대사창에서는 점술가의 말이 한 글자씩 나옵니다.
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const app = window.TarotApp;

  // 그림 속 물건 위치 (원본 그림의 픽셀 좌표: x, y, 너비, 높이)
  const SCENES = {
    pc: {
      src: 'img/scene/main-pc.webp', w: 1376, h: 768,
      spots: [
        { go: 'read', label: '카드를 펼친다', x: 585, y: 435, w: 250, h: 170 },
        { go: 'one', label: '오늘의 한 장', x: 452, y: 362, w: 124, h: 146, round: true },
        { go: 'history', label: '지난 점괘', x: 812, y: 398, w: 258, h: 112 },
        { go: 'deck', label: '카드 사전', x: 1030, y: 40, w: 220, h: 250 },
      ],
    },
    mobile: {
      src: 'img/scene/main-mobile.webp', w: 768, h: 1376,
      spots: [
        { go: 'read', label: '카드를 펼친다', x: 300, y: 860, w: 200, h: 140 },
        { go: 'one', label: '오늘의 한 장', x: 560, y: 735, w: 145, h: 235, round: true },
        { go: 'history', label: '지난 점괘', x: 80, y: 628, w: 150, h: 86 },
        { go: 'deck', label: '카드 사전', x: 85, y: 250, w: 245, h: 315 },
      ],
    },
  };

  let current = null;

  // 화면 크기에 맞춰 그림 배치 계산
  // 1) 클릭할 물건 네 개(+이름표 자리)가 대사창 위쪽 보이는 영역 안에 모두 들어오게 하고
  // 2) 그 조건 안에서 화면을 최대한 꽉 채움. 다 못 채우면 남는 곳은 흐린 같은 그림이 채움
  // 폴더블(접음·펼침), 가로로 눕힌 폰, 태블릿처럼 비율이 제각각인 화면을 위한 것
  function layoutFor(sc, vw, vh, dlgH) {
    const xs = sc.spots.map((p) => p.x), ys = sc.spots.map((p) => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...sc.spots.map((p) => p.x + p.w));
    const y0 = Math.min(...ys), y1 = Math.max(...sc.spots.map((p) => p.y + p.h));
    const availH = Math.max(120, vh - dlgH - 10);
    const sCover = Math.max(vw / sc.w, vh / sc.h);
    // 이름표가 물건 위에 뜨므로 위쪽 여유를 조금 더
    const sFit = Math.min((vw - 16) / (x1 - x0), (availH - 34) / (y1 - y0));
    const s = Math.min(sCover, sFit);
    const W = sc.w * s, H = sc.h * s;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    let left = vw / 2 - cx * s, top = 34 / 2 + availH / 2 - cy * s;
    left = W >= vw ? Math.min(0, Math.max(vw - W, left)) : (vw - W) / 2;
    top = H >= vh ? Math.min(0, Math.max(vh - H, top)) : Math.min(vh - H, Math.max(0, top));
    return { s, W, H, left, top, fill: s / sCover };
  }

  function build() {
    const vw = innerWidth, vh = innerHeight;
    const dlgH = $('dialog').getBoundingClientRect().height + 14;
    // 두 그림 중 화면을 더 많이 채우는 쪽 (비슷하면 세로 화면은 모바일 그림)
    const pc = layoutFor(SCENES.pc, vw, vh, dlgH), mo = layoutFor(SCENES.mobile, vw, vh, dlgH);
    const portrait = vw / vh < 1;
    const key = mo.fill + (portrait ? 0.08 : -0.08) >= pc.fill ? 'mobile' : 'pc';
    const sc = SCENES[key], L = key === 'pc' ? pc : mo;
    const img = $('scene-img');
    if (current !== key) {
      current = key;
      img.src = sc.src;
      $('scene-bg').style.backgroundImage = `url("${sc.src}")`;
      $('hotspots').innerHTML = sc.spots.map((p) =>
        `<button class="hs${p.round ? ' round' : ''}" data-go="${p.go}" style="left:${(p.x / sc.w) * 100}%;top:${(p.y / sc.h) * 100}%;width:${(p.w / sc.w) * 100}%;height:${(p.h / sc.h) * 100}%">
          <span class="tag">${p.label}</span><span class="spark" aria-hidden="true"></span>
        </button>`).join('');
    }
    const el = $('scene');
    el.style.width = `${L.W}px`;
    el.style.height = `${L.H}px`;
    el.style.left = `${L.left}px`;
    el.style.top = `${L.top}px`;
    document.body.classList.toggle('scene-letterbox', L.fill < 0.999);
  }

  // ── 대사 ────────────────────────────────────────────────
  const GREET = [
    '어서 오게. 촛불이 꺼지기 전에, 무엇이 궁금한지 말해 보게.',
    '카드는 거짓말을 하지 않지. 다만 읽는 법을 알아야 할 뿐이네.',
    '오늘은 바람이 수상하군. 한 장 펼쳐 보겠나?',
    '마음을 가라앉히고 테이블 위의 카드에 손을 얹어 보게.',
  ];
  function lines() {
    const last = app.lastReading();
    const list = [GREET[Math.floor(Math.random() * GREET.length)]];
    if (last) {
      const d = new Date(last.date);
      const when = `${d.getMonth() + 1}월 ${d.getDate()}일`;
      list.push(`${when}에 「${last.topicLabel}」을 보러 왔었지. 그때는 「${last.names[last.names.length - 1]}」 카드가 마지막에 나왔었네.`);
    } else {
      list.push('처음 보는 얼굴이군. 테이블 위의 카드를 누르면 점을 볼 수 있다네.');
    }
    return list;
  }

  let typing = null, queue = [], full = '';
  function say(text) {
    clearInterval(typing);
    const el = $('dialog-line');
    full = text; el.textContent = ''; el.classList.remove('done');
    let i = 0;
    typing = setInterval(() => {
      el.textContent = full.slice(0, ++i);
      if (i >= full.length) { clearInterval(typing); typing = null; el.classList.add('done'); }
    }, 38);
  }
  // 대사창을 누르면: 글자가 나오는 중이면 한 번에 다 보이고, 다 나왔으면 다음 대사
  $('dialog-line').addEventListener('click', () => {
    if (typing) { clearInterval(typing); typing = null; $('dialog-line').textContent = full; $('dialog-line').classList.add('done'); return; }
    if (queue.length) say(queue.shift());
  });
  function talk() {
    queue = lines();
    say(queue.shift());
  }

  // ── 이동 ────────────────────────────────────────────────
  function go(where) {
    if (where === 'one') app.quickOne();
    else if (where === 'read') app.newReading();
    else app.showTab(where);
  }
  $('hotspots').addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); });
  $('choices').addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); });
  // 물건 위에 마우스를 올리면 대사창에 설명
  const HINT = {
    read: '카드를 펼쳐 보겠나? 궁금한 주제와 배열을 고르면 된다네.',
    one: '수정 구슬이 오늘의 한 장을 비춰 줄 걸세.',
    history: '자네가 지금까지 본 점괘가 이 안에 적혀 있지. 다른 누구도 볼 수 없다네.',
    deck: '78장의 카드가 무엇을 뜻하는지 궁금하면 이 책을 펼쳐 보게.',
  };
  $('hotspots').addEventListener('mouseover', (e) => {
    const b = e.target.closest('[data-go]');
    if (b && !typing) { $('dialog-line').textContent = HINT[b.dataset.go]; full = HINT[b.dataset.go]; }
  });

  addEventListener('resize', build);
  // 폴더블을 접거나 펼칠 때, 화면을 돌릴 때
  screen.orientation?.addEventListener?.('change', () => setTimeout(build, 50));
  addEventListener('tarot:home', () => { build(); talk(); });
  if (document.body.classList.contains('at-home')) { build(); talk(); }
})();
