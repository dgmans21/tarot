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
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 7;
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
    const inner = w - 192;
    const layoutRows = (paras, px, oneLine) => {
      ctx.font = F(400, px);
      const rows = [];
      for (const p of paras) {
        if (rows.length && !oneLine) rows.push(null);
        const lines = wrap(ctx, p, inner);
        // 한 줄 제한이면 넘치는 부분은 …으로
        rows.push(...(oneLine ? [lines.length > 1 ? ellipsis(ctx, lines[0], inner) : lines[0]] : lines));
      }
      return rows;
    };
    const boxHeight = (rows, lh) => 94 + rows.reduce((a, r) => a + (r === null ? 14 : lh), 0);
    // 종합 풀이가 다 들어가려면 필요한 높이 (글씨를 줄여 가며 계산)
    const FIT_PX = [27, 25, 23, 21];
    const summaryNeed = (() => {
      for (const px of FIT_PX) { const lh = Math.round(px * 1.55), rows = layoutRows([d.summary], px, false); if (rows.length <= 4 || px === 21) return boxHeight(rows, lh) + 26; }
      return 300;
    })();
    const box = (title, paras, maxBottom, { px = 27, lh = 42, oneLine = false, labels = false, fit = false } = {}) => {
      let rows = layoutRows(paras, px, oneLine);
      if (fit) {
        for (const p of FIT_PX) {
          px = p; lh = Math.round(p * 1.55);
          rows = layoutRows(paras, px, oneLine);
          if (boxHeight(rows, lh) <= maxBottom - y) break;
        }
      }
      ctx.font = F(400, px);
      const room = Math.max(1, Math.floor((maxBottom - y - 94) / lh));
      let shown = rows.slice(0, room);
      while (shown.length && shown[shown.length - 1] === null) shown.pop();
      if (rows.length > shown.length && shown.length) shown[shown.length - 1] = ellipsis(ctx, shown[shown.length - 1], inner);
      if (!shown.length) return;
      const bh = boxHeight(shown, lh);
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
    const upperMax = h - 100 - summaryNeed;
    if (tall && n === 1) box('✦ 카드 풀이', [d.cards[0].line], Math.min(h - 380, upperMax), { fit: true });
    else if (tall && n > 3) box('✦ 카드별 키워드', d.cards.map((c, i) => `${i + 1}. ${c.pos} · ${c.name}${c.rev ? '(역)' : ''} — ${c.kw}`), upperMax, { px: 21, lh: 31, oneLine: true, labels: true });
    else if (tall) box('✦ 카드별 풀이', d.cards.map((c) => `${c.pos} · ${c.line}`), Math.min(h - 430, upperMax), { labels: true, fit: true });
    box('✦ 종합 풀이', [d.summary], h - 100, { fit: true });

    // 바닥: 사이트 주소 (https로 열었을 때만)
    if (d.url) { ctx.textAlign = 'center'; ctx.fillStyle = MUTED; ctx.font = F(500, 24); ctx.fillText(d.url, w / 2, h - 50); }
    return canvas;
  }

  // ── 공유 창 ─────────────────────────────────────────────
  // 폰: 공유 창(카카오톡 등에서 대화방을 직접 고름)
  // PC: 공유 창 대신 [이미지 복사] [PNG 저장]. PC 카카오톡은 공유 창으로 받으면 맨 위 대화방에 바로 붙어서,
  //     원하는 대화방에 직접 붙여 넣는(Ctrl+V) 방식이 안전함
  // 공유 창도 다운로드도 안 되는 곳(카카오톡 안의 브라우저 등): 이미지를 크게 띄우고 "길게 눌러 저장"
  // 휴대폰 브라우저는 버튼을 누른 그 순간에만 공유 창을 허락하므로, 이미지 파일은 미리 만들어 둠
  const ua = navigator.userAgent;
  const isKakao = /KAKAOTALK/i.test(ua);
  const inApp = isKakao || /Instagram|FBAN|FBAV|Line\/|NAVER\(inapp|DaumApps|everytimeApp/i.test(ua);
  const isPC = () => matchMedia('(hover: hover) and (pointer: fine)').matches;
  const canShareFiles = () => {
    try { return !!navigator.canShare && navigator.canShare({ files: [new File([''], 'a.png', { type: 'image/png' })] }); } catch { return false; }
  };
  const canCopyImage = () => !!(navigator.clipboard?.write && window.ClipboardItem);
  const mode = () => (isPC() ? 'pc' : (!inApp && canShareFiles() ? 'share' : 'hold'));
  const note = (t) => { $('share-note').textContent = t; };
  const NOTES = {
    pc: () => (canCopyImage() ? '이미지 복사 후 카카오톡 대화창에서 Ctrl+V로 붙여 넣으세요.' : '이미지로 저장한 뒤 보내고 싶은 곳에 올려 주세요.'),
    share: () => '공유 창에서 카카오톡 등 보낼 곳을 고르세요.',
    hold: () => (isKakao ? '카카오톡 안에서는 저장·공유가 막혀 있어요. 「브라우저로 열어 저장」을 누르면 같은 점괘가 크롬·사파리에서 열리고, 거기서 저장·공유할 수 있어요.'
      : '이미지를 크게 띄운 뒤 길게 눌러 저장하거나 공유하세요.'),
  };
  const BTN_SETS = () => ({
    pc: [canCopyImage() && ['copy', '이미지 복사', 'primary'], ['save', '이미지 저장', '']].filter(Boolean),
    share: [['share', '공유하기', 'primary'], ['view', '크게 보기', '']],
    hold: isKakao ? [['external', '브라우저로 열어 저장', 'primary'], ['view', '크게 보기', '']] : [['view', '크게 보고 저장', 'primary']],
  });

  const canvasOf = (size) => $(size === 'feed' ? 'share-feed' : 'share-story');
  const toBlob = (canvas, type = 'image/jpeg', q = 0.92) => new Promise((ok, no) => {
    try { canvas.toBlob((bl) => (bl ? ok(bl) : no(new Error('empty'))), type, q); } catch (e) { no(e); }
  });
  const FILE_PROTOCOL_MSG = '이미지 공유는 사이트 주소(https)로 열었을 때 사용할 수 있어요. 지금은 글로 공유나 txt 저장을 이용해 주세요.';

  // ── 미리 그려 두기 ──────────────────────────────────────
  // 결과 화면이 뜨면 한가할 때 미리 그려 두고(prepare), 공유 창을 열면 준비된 것을 바로 보여 줌.
  // 피드용을 먼저 끝내고 그 버튼부터 쓸 수 있게 한 뒤 스토리용을 그림.
  // 파일은 JPG(빠르고 가벼움). PC의 이미지 복사만 누를 때 PNG로 만듦(클립보드가 PNG만 받음)
  let job = null; // { id, reading, data, files: { feed, story }, error, promise }
  const sheetOpen = () => !$('share-sheet').hidden;

  function release(j) { if (j) for (const f of Object.values(j.files)) URL.revokeObjectURL(f.url); }

  function prepare(reading) {
    if (job && job.id === reading.id && !job.error) return job.promise;
    release(job);
    const j = { id: reading.id, reading, data: window.TarotApp.shareData(reading), files: {}, error: null };
    job = j;
    j.promise = (async () => {
      for (const size of ['feed', 'story']) {
        if (job !== j) return; // 다른 점괘로 바뀜
        try {
          await drawShareCard(canvasOf(size), j.data, size);
          if (job !== j) return;
          const blob = await toBlob(canvasOf(size));
          const name = `타로_${j.data.stamp}_${size === 'feed' ? '피드' : '스토리'}.jpg`;
          j.files[size] = { blob, file: new File([blob], name, { type: 'image/jpeg' }), url: URL.createObjectURL(blob) };
        } catch (e) {
          console.error(e);
          j.error = location.protocol === 'file:' || e.name === 'SecurityError' ? FILE_PROTOCOL_MSG : '이미지를 그리지 못했어요. 카드 그림을 불러오지 못했을 수 있어요.';
        }
        if (job === j && sheetOpen()) refresh();
        if (j.error) return;
      }
    })();
    return j.promise;
  }

  // 버튼·안내를 지금 준비 상태에 맞게
  function refresh() {
    const m = mode(), sets = BTN_SETS()[m];
    document.querySelectorAll('.share-btns').forEach((box) => {
      const size = box.dataset.size, ready = !!(job && job.files[size]);
      box.innerHTML = sets.map(([act, label, cls]) =>
        `<button class="btn ${cls}" data-act="${act}" data-size="${size}" ${ready ? '' : 'disabled'}>${ready ? label : '그리는 중…'}</button>`).join('');
    });
    if (!job) return;
    if (job.error) note(job.error);
    else if (job.files.feed) note(`${NOTES[m]()} 메모는 이미지에 들어가지 않아요.`);
    else note('그리는 중…');
  }

  function open(reading) {
    $('share-sheet').hidden = false; document.body.classList.add('no-scroll');
    $('hold-view').hidden = true;
    prepare(reading);
    refresh();
  }
  function close() {
    $('share-sheet').hidden = true; $('hold-view').hidden = true;
    document.body.classList.remove('no-scroll');
  }
  // 결과 화면에서 미리 그리기 시작 (화면이 다 뜬 뒤 한가할 때)
  function warm(reading) {
    const go = () => { if (window.TarotApp) prepare(reading); };
    if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 2500 }); else setTimeout(go, 1200);
  }

  // 이미지를 크게 띄움: 길게 눌러 저장·공유 (거의 모든 휴대폰 브라우저에서 동작)
  function showHold(size) {
    const f = job.files[size];
    if (!f.dataUrl) { try { f.dataUrl = canvasOf(size).toDataURL('image/jpeg', 0.92); } catch { f.dataUrl = f.url; } }
    $('hold-img').src = f.dataUrl;
    $('hold-external').hidden = !isKakao;
    $('hold-view').hidden = false;
  }

  // 카카오톡 안의 브라우저 → 기본 브라우저(크롬·사파리)로 열기.
  // 기록은 브라우저마다 따로라서, 점괘 내용을 담은 결과 링크로 넘김 (열리면 같은 점괘가 바로 보임)
  function openExternal() {
    const url = window.TarotApp.readingLink(job.reading);
    location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
  }

  // 클릭 순간에 바로 실행되도록, 공유·복사 전에 기다리는 작업을 하지 않음
  function act(kind, size) {
    const f = job && job.files[size];
    if (!f) return;
    if (kind === 'copy') {
      // 클립보드는 PNG만 받음. 누른 순간에 ClipboardItem을 만들고, PNG 변환은 약속(Promise)으로 넘김
      navigator.clipboard.write([new ClipboardItem({ 'image/png': toBlob(canvasOf(size), 'image/png') })])
        .then(() => { note('이미지를 복사했어요. 카카오톡 대화창을 열고 Ctrl+V로 붙여 넣으세요.'); if (window.TarotApp.toast) window.TarotApp.toast('이미지를 복사했어요. 카톡 대화창에서 Ctrl+V'); })
        .catch((e) => { console.error(e); note('이 브라우저에서는 이미지 복사가 막혀 있어요. PNG 저장을 이용해 주세요.'); });
      return;
    }
    if (kind === 'share') {
      navigator.share({ files: [f.file], title: '오늘의 타로' })
        .catch((e) => { if (e.name !== 'AbortError') { console.error(e); showHold(size); } });
      return;
    }
    if (kind === 'view') { showHold(size); return; }
    if (kind === 'external') { openExternal(); return; }
    // 저장
    const a = document.createElement('a');
    a.href = f.url; a.download = f.file.name;
    document.body.appendChild(a); a.click(); a.remove();
    note('이미지 파일로 저장했어요. (다운로드 폴더)');
  }

  $('share-sheet').addEventListener('click', (e) => {
    if (e.target.closest('#hold-close')) { $('hold-view').hidden = true; return; }
    if (e.target.closest('#hold-external')) { openExternal(); return; }
    if (e.target === $('share-sheet') || e.target.closest('.close')) return close();
    const btn = e.target.closest('[data-act]');
    if (btn && !btn.disabled) act(btn.dataset.act, btn.dataset.size);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('share-sheet').hidden) close(); });

  window.TarotShare = { open, warm, drawShareCard, isPC };

})();
