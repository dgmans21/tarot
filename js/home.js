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

  // 세로로 긴 화면이면 모바일 그림
  const pick = () => (innerWidth / innerHeight < 0.85 ? 'mobile' : 'pc');
  let current = null;

  function build() {
    const key = pick();
    const sc = SCENES[key];
    const img = $('scene-img');
    if (current !== key) {
      current = key;
      img.src = sc.src;
      $('hotspots').innerHTML = sc.spots.map((s) =>
        `<button class="hs${s.round ? ' round' : ''}" data-go="${s.go}" style="left:${(s.x / sc.w) * 100}%;top:${(s.y / sc.h) * 100}%;width:${(s.w / sc.w) * 100}%;height:${(s.h / sc.h) * 100}%">
          <span class="tag">${s.label}</span><span class="spark" aria-hidden="true"></span>
        </button>`).join('');
    }
    // 그림이 화면을 꽉 채우도록(넘치는 부분은 잘림) 크기와 위치를 계산. 물건 위치(%)도 같이 따라감
    const vw = innerWidth, vh = innerHeight;
    const s = Math.max(vw / sc.w, vh / sc.h);
    const el = $('scene');
    el.style.width = `${sc.w * s}px`;
    el.style.height = `${sc.h * s}px`;
    // 폰에서는 그림의 아래쪽(대사창 자리)보다 가운데를 우선해서 보이게
    el.style.left = `${(vw - sc.w * s) / 2}px`;
    el.style.top = `${(vh - sc.h * s) / 2}px`;
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
  addEventListener('tarot:home', () => { build(); talk(); });
  if (document.body.classList.contains('at-home')) { build(); talk(); }
})();
