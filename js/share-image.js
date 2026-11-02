// 결과를 공유용 이미지 한 장으로 그리기 (피드 1080×1350 / 스토리 1080×1920)
// 화면 캡처 대신 캔버스에 직접 그려서, 어느 기기에서든 같은 모양으로 나옵니다.
// 주의: 파일을 더블클릭해 연 상태(file://)에서는 브라우저 보안 때문에 이미지를 꺼낼 수 없고,
//       사이트 주소(https)로 열었을 때 동작합니다.
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const SIZES = { feed: { w: 1080, h: 1350, label: '카톡·피드용' }, story: { w: 1080, h: 1920, label: '스토리용' } };
  const GOLD = '#e8c878', CREAM = '#f4ecd8', MUTED = '#b9b0cc';
  const F = (wt, px) => `${wt} ${px}px "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;

  const imgCache = new Map();
  const loadImg = (src) => {
    if (!imgCache.has(src)) {
      imgCache.set(src, new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error(src)); i.src = src; }));
    }
    return imgCache.get(src);
  };
  const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

  // 띄어쓰기 단위 줄바꿈 (아주 긴 단어만 글자 단위로 자름)
  function wrap(ctx, text, maxW) {
    const out = []; let line = '';
    for (const word of String(text).split(' ')) {
      const t = line ? `${line} ${word}` : word;
      if (ctx.measureText(t).width <= maxW) { line = t; continue; }
      if (line) out.push(line);
      line = word;
      while (ctx.measureText(line).width > maxW) {
        let k = line.length; while (k > 1 && ctx.measureText(line.slice(0, k)).width > maxW) k--;
        out.push(line.slice(0, k)); line = line.slice(k);
      }
    }
    if (line) out.push(line);
    return out;
  }
  const ellipsis = (ctx, s, maxW) => { let t = s; while (t && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1); return `${t}…`; };

  // 카드 한 장 (그림 + 테두리 + 그림자). 역방향은 거꾸로
  function drawCard(ctx, img, x, y, cw, ch, rev, radius) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 9;
    rr(ctx, x, y, cw, ch, radius); ctx.fillStyle = '#efe6cf'; ctx.fill();
    ctx.restore();
    ctx.save();
    rr(ctx, x, y, cw, ch, radius); ctx.clip();
    if (rev) { ctx.translate(x + cw / 2, y + ch / 2); ctx.rotate(Math.PI); ctx.drawImage(img, -cw / 2, -ch / 2, cw, ch); }
    else ctx.drawImage(img, x, y, cw, ch);
    ctx.restore();
    ctx.strokeStyle = 'rgba(232,200,120,0.7)'; ctx.lineWidth = 2; rr(ctx, x, y, cw, ch, radius); ctx.stroke();
  }
  function badge(ctx, rev, cx, y, px) {
    const tag = rev ? '역방향' : '정방향';
    ctx.font = F(700, px);
    const tw = ctx.measureText(tag).width + px * 1.2, th = px * 1.6;
    rr(ctx, cx - tw / 2, y, tw, th, th / 2);
    ctx.fillStyle = rev ? 'rgba(229,138,138,0.22)' : 'rgba(232,200,120,0.22)'; ctx.fill();
    ctx.fillStyle = rev ? '#f0a3a3' : GOLD; ctx.textAlign = 'center'; ctx.fillText(tag, cx, y + th * 0.72);
    return th;
  }

  // d: { bg, topic, spread, date, url, cards: [{ pos, name, rev, kw, img, line }], summary }
  async function drawShareCard(canvas, d, size = 'feed') {
    const { w, h } = SIZES[size];
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const tall = h / w > 1.5;
    await Promise.all([document.fonts?.load(F(900, 54)), document.fonts?.load(F(400, 28)), document.fonts?.load(F(700, 28))].filter(Boolean)).catch(() => {});
    const imgs = await Promise.all([loadImg(d.bg), ...d.cards.map((c) => loadImg(c.img))]);
    const bg = imgs[0];

    // 배경: 테이블 그림 + 가장자리 어둡게
    const s = Math.max(w / bg.width, h / bg.height);
    ctx.drawImage(bg, (w - bg.width * s) / 2, (h - bg.height * s) / 2, bg.width * s, bg.height * s);
    const vg = ctx.createRadialGradient(w / 2, h * 0.45, h * 0.15, w / 2, h * 0.5, h * 0.75);
    vg.addColorStop(0, 'rgba(12,8,26,0.35)'); vg.addColorStop(1, 'rgba(8,5,18,0.88)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);

    // 머리말
    const hy = tall ? 150 : 115;
    ctx.textAlign = 'center';
    ctx.fillStyle = GOLD; ctx.font = F(900, 54); ctx.fillText('오늘의 타로', w / 2, hy);
    ctx.fillStyle = CREAM; ctx.font = F(500, 30); ctx.fillText(`${d.topic} · ${d.spread}`, w / 2, hy + 52);
    ctx.fillStyle = MUTED; ctx.font = F(400, 24); ctx.fillText(d.date, w / 2, hy + 92);

    // 카드 배치: 1장은 크게, 2~3장은 한 줄, 4장 이상(켈틱 크로스)은 5장씩 두 줄
    const n = d.cards.length;
    const top = hy + 150;
    let bottom;
    if (n <= 3) {
      const gap = 34;
      const cw = n === 1 ? (tall ? 400 : 330) : Math.min(tall ? 300 : 290, (w - 120 - gap * (n - 1)) / n);
      const ch = cw * 1429 / 825;
      const x0 = (w - (cw * n + gap * (n - 1))) / 2;
      d.cards.forEach((c, i) => {
        const x = x0 + i * (cw + gap), cx = x + cw / 2;
        ctx.textAlign = 'center'; ctx.fillStyle = GOLD; ctx.font = F(700, 28); ctx.fillText(c.pos, cx, top);
        drawCard(ctx, imgs[i + 1], x, top + 22, cw, ch, c.rev, 14);
        const ty = top + 22 + ch + 48;
        ctx.textAlign = 'center'; ctx.fillStyle = CREAM; ctx.font = F(900, n === 1 ? 38 : 32);
        ctx.fillText(c.name, cx, ty);
        badge(ctx, c.rev, cx, ty + 14, 20);
        ctx.fillStyle = MUTED; ctx.font = F(500, 22); ctx.textAlign = 'center';
        wrap(ctx, c.kw, n === 1 ? 600 : cw).slice(0, 2).forEach((l, k) => ctx.fillText(l, cx, ty + 80 + k * 30));
      });
      bottom = top + 22 + ch + 180;
    } else {
      const cols = 5, gap = 22;
      // 피드 비율은 세로가 짧아 카드를 조금 작게 (아래 종합 풀이 자리 확보)
      const cw = Math.min(tall ? 174 : 148, (w - 120 - gap * (cols - 1)) / cols), ch = cw * 1429 / 825;
      const left = (w - (cw * cols + gap * (cols - 1))) / 2;
      const rowH = 30 + ch + 76;
      d.cards.forEach((c, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const x = left + col * (cw + gap), y = top - 8 + row * rowH, cx = x + cw / 2;
        ctx.textAlign = 'center'; ctx.fillStyle = GOLD; ctx.font = F(700, 19);
        const lab = `${i + 1}. ${c.pos}`;
        ctx.fillText(ctx.measureText(lab).width > cw + 10 ? ellipsis(ctx, lab, cw + 10) : lab, cx, y);
        drawCard(ctx, imgs[i + 1], x, y + 14, cw, ch, c.rev, 10);
        ctx.fillStyle = CREAM; ctx.font = F(700, 21);
        ctx.fillText(ctx.measureText(c.name).width > cw + 16 ? ellipsis(ctx, c.name, cw + 16) : c.name, cx, y + 14 + ch + 34);
        badge(ctx, c.rev, cx, y + 14 + ch + 46, 15);
      });
      bottom = top - 8 + rowH * Math.ceil(n / cols) + 20;
    }

    // 아래쪽 글 상자: 스토리는 카드별 한 줄 풀이 + 종합 풀이, 피드는 종합 풀이만
    let y = bottom;
    const box = (title, paras, maxBottom, { px = 27, lh = 42, oneLine = false, labels = false } = {}) => {
      const inner = w - 192;
      ctx.font = F(400, px);
      const rows = [];
      for (const p of paras) {
        if (rows.length && !oneLine) rows.push(null);
        const lines = wrap(ctx, p, inner);
        // 한 줄 제한이면 넘치는 부분은 …으로
        rows.push(...(oneLine ? [lines.length > 1 ? ellipsis(ctx, lines[0], inner) : lines[0]] : lines));
      }
      const room = Math.max(1, Math.floor((maxBottom - y - 100) / lh));
      let shown = rows.slice(0, room);
      while (shown.length && shown[shown.length - 1] === null) shown.pop();
      if (rows.length > shown.length && shown.length) shown[shown.length - 1] = ellipsis(ctx, shown[shown.length - 1], inner);
      if (!shown.length) return;
      const bh = 94 + shown.reduce((a, r) => a + (r === null ? 14 : lh), 0);
      ctx.save(); rr(ctx, 60, y, w - 120, bh, 24);
      ctx.fillStyle = 'rgba(16,11,34,0.82)'; ctx.fill();
      ctx.strokeStyle = 'rgba(232,200,120,0.55)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
      ctx.textAlign = 'left'; ctx.fillStyle = GOLD; ctx.font = F(700, 27); ctx.fillText(title, 96, y + 50);
      let ty = y + 98;
      for (const r of shown) {
        if (r === null) { ty += 14; continue; }
        const m = labels && r.match(/^(\d+\. )?[^·]{1,8} · /); // "과거 · " 같은 위치 이름은 금색으로
        if (m) {
          ctx.fillStyle = GOLD; ctx.font = F(700, px); ctx.fillText(m[0], 96, ty);
          const off = ctx.measureText(m[0]).width;
          ctx.fillStyle = CREAM; ctx.font = F(400, px); ctx.fillText(r.slice(m[0].length), 96 + off, ty);
        } else { ctx.fillStyle = CREAM; ctx.font = F(400, px); ctx.fillText(r, 96, ty); }
        ty += lh;
      }
      y += bh + 26;
    };
    if (tall && n === 1) box('✦ 카드 풀이', [d.cards[0].line], h - 380);
    else if (tall && n > 3) box('✦ 카드별 풀이', d.cards.map((c, i) => `${i + 1}. ${c.pos} · ${c.line}`), h - 300, { px: 23, lh: 35, oneLine: true, labels: true });
    else if (tall) box('✦ 카드별 풀이', d.cards.map((c) => `${c.pos} · ${c.line}`), h - 430, { labels: true });
    box('✦ 종합 풀이', [d.summary], h - 100);

    // 바닥: 사이트 주소 (https로 열었을 때만)
    if (d.url) { ctx.textAlign = 'center'; ctx.fillStyle = MUTED; ctx.font = F(500, 24); ctx.fillText(d.url, w / 2, h - 50); }
    return canvas;
  }

  // ── 공유 창 ─────────────────────────────────────────────
  const canShareFiles = () => {
    try { return !!navigator.canShare && navigator.canShare({ files: [new File([''], 'a.png', { type: 'image/png' })] }); } catch { return false; }
  };
  let current = null;

  async function open(reading) {
    const app = window.TarotApp;
    current = { reading, data: app.shareData(reading) };
    const sheet = $('share-sheet');
    sheet.hidden = false; document.body.classList.add('no-scroll');
    const verb = canShareFiles() ? '공유하기' : 'PNG로 저장';
    sheet.querySelectorAll('[data-share]').forEach((b) => { b.textContent = verb; b.disabled = true; });
    $('share-note').textContent = '그리는 중…';
    try {
      await drawShareCard($('share-feed'), current.data, 'feed');
      await drawShareCard($('share-story'), current.data, 'story');
      sheet.querySelectorAll('[data-share]').forEach((b) => { b.disabled = false; });
      $('share-note').textContent = canShareFiles()
        ? '공유 창에서 카카오톡 등 보낼 곳을 고르세요. 메모는 이미지에 들어가지 않아요.'
        : '이 기기에서는 이미지가 PNG 파일로 저장돼요. 메모는 이미지에 들어가지 않아요.';
    } catch (e) {
      console.error(e);
      $('share-note').textContent = '이미지를 그리지 못했어요. 카드 그림을 불러오지 못했을 수 있어요.';
    }
  }
  function close() { $('share-sheet').hidden = true; document.body.classList.remove('no-scroll'); }

  async function send(size) {
    const canvas = $(size === 'feed' ? 'share-feed' : 'share-story');
    const name = `타로_${current.data.stamp}_${size === 'feed' ? '피드' : '스토리'}.png`;
    let blob;
    try { blob = await new Promise((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error('empty'))), 'image/png')); }
    catch (e) {
      // file:// 로 연 경우: 보안 정책 때문에 그림을 꺼낼 수 없음
      $('share-note').textContent = '이미지 공유는 사이트 주소(https)로 열었을 때 사용할 수 있어요. 지금은 글로 공유나 txt 저장을 이용해 주세요.';
      return;
    }
    const file = new File([blob], name, { type: 'image/png' });
    if (canShareFiles()) {
      try { await navigator.share({ files: [file], title: '오늘의 타로' }); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  $('share-sheet').addEventListener('click', (e) => {
    if (e.target === $('share-sheet') || e.target.closest('.close')) return close();
    const b = e.target.closest('[data-share]');
    if (b && !b.disabled) send(b.dataset.share);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('share-sheet').hidden) close(); });

  window.TarotShare = { open, drawShareCard };
})();
