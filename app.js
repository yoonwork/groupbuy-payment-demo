/* 공동구매 결제 개선 제안용 데모 — 화면 모형. 서버·결제·저장 없음, 모든 데이터는 가상. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const won = (n) => n.toLocaleString('ko-KR') + '원';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const ICON = {
    ok: '<span class="ic ok" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>',
    fail: '<span class="ic fail" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 6v7M12 17.5v.5"/></svg></span>',
    wait: '<span class="ic wait" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span>',
  };
  let toastT;
  const toast = (m) => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2400); };

  /* ── 라우팅 ── */
  const ROUTES = { product: '상품 리뷰', cart: '장바구니 참여', result: '마감 후 결제', unpaid: '미결제 모아 결제', admin: '관리자 결제 상태', qa: '결제 예외 검수표' };
  const INIT = {};
  let lastSheet = null;
  function route() {
    const r = (location.hash.match(/^#\/(\w+)/) || [])[1];
    const cur = ROUTES[r] ? r : 'product';
    $$('.view').forEach((v) => (v.hidden = v.id !== 'v-' + cur));
    $$('.tabs a').forEach((a) => (a.dataset.r === cur ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    document.title = ROUTES[cur] + ' · 공동구매 결제 개선 데모';
    if (INIT[cur]) INIT[cur]();
    const act = $('.tabs a[aria-current]'); if (act) act.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  window.addEventListener('hashchange', () => { route(); window.scrollTo(0, 0); $('#main').focus({ preventScroll: true }); });

  /* 시트·서랍: 열면 첫 버튼 포커스, Esc로 닫기, 닫으면 원래 버튼으로 */
  function openLayer(el) { lastSheet = document.activeElement; el.hidden = false; const f = el.querySelector('input:checked,button,a,[tabindex]'); if (f) f.focus(); }
  function closeLayer(el) { el.hidden = true; if (lastSheet && lastSheet.focus) lastSheet.focus(); }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = $$('.sheet,.drawer').find((x) => !x.hidden); if (open) closeLayer(open);
  });
  $$('.sheet,.drawer').forEach((s) => s.addEventListener('click', (e) => { if (e.target === s) closeLayer(s); }));

  /* ── 1. 상품 리뷰 ── */
  const REVIEWS = [
    { n: '감*리', s: 5, d: '10.28', o: '5kg 중과', t: '껍질 얇고 새콤달콤해요. 상한 거 하나도 없었어요.', ph: 2, src: '이 상품 주문' },
    { n: '바*람', s: 4, d: '10.27', o: '5kg 중과', t: '크기가 고르진 않은데 맛은 좋아요. 아이들이 잘 먹어요.', ph: 0, src: '이 상품 주문' },
    { n: '정*숙', s: 5, d: '10.25', o: '5kg 중과', t: '두 번째 공동구매 참여예요. 지난번보다 더 달아요.', ph: 1, src: '이 상품 주문' },
    { n: '한*수', s: 3, d: '10.22', o: '5kg 중과', t: '배송이 하루 늦었어요. 맛은 괜찮아요.', ph: 0, src: '지난 회차 같은 상품(연결됨)' },
    { n: '오*진', s: 5, d: '10.19', o: '5kg 중과', t: '새벽에 받았는데 상자 상태도 좋았어요.', ph: 1, src: '지난 회차 같은 상품(연결됨)' },
    { n: '윤*아', s: 4, d: '10.15', o: '5kg 중과', t: '양이 넉넉해서 이웃이랑 나눴어요.', ph: 0, src: '지난 회차 같은 상품(연결됨)' },
  ];
  const rv = { sort: 'new', photo: false, state: 'ok', shown: 4, inited: false };
  async function loadReviews(delay = 700) {
    const L = $('#rvList'); L.setAttribute('aria-busy', 'true');
    L.innerHTML = '<li class="skel" aria-hidden="true"></li>'.repeat(3) + '<li class="sr">리뷰를 불러오는 중</li>';
    $('#rvMore').hidden = true;
    await wait(delay);
    renderReviews(); L.setAttribute('aria-busy', 'false');
  }
  function renderReviews() {
    const L = $('#rvList');
    if (rv.state === 'error') {
      $('#rvCount').textContent = ''; $('#rvScore').textContent = '';
      L.innerHTML = '<li class="state"><h3>리뷰를 불러오지 못했어요</h3><p>잠시 후 다시 시도해 주세요. 상품 정보와 참여는 그대로 이용할 수 있어요.</p><button class="btn line sm" id="rvRetry">다시 불러오기</button></li>';
      $('#rvRetry').onclick = () => { rv.state = 'ok'; loadReviews(); }; return;
    }
    let list = rv.state === 'empty' ? [] : REVIEWS.slice();
    $('#rvCount').textContent = list.length;
    const avg = list.length ? (list.reduce((a, b) => a + b.s, 0) / list.length).toFixed(1) : null;
    $('#rvScore').textContent = avg ? '평균 ' + avg + ' / 5' : '';
    if (rv.photo) list = list.filter((x) => x.ph);
    if (rv.sort === 'best') list.sort((a, b) => b.s - a.s);
    if (!list.length) {
      L.innerHTML = rv.state === 'empty'
        ? '<li class="state"><h3>아직 이 상품 리뷰가 없어요</h3><p>판매자의 다른 상품 리뷰 124개는 판매자 정보에서 볼 수 있어요.</p></li>'
        : '<li class="state"><h3>사진 리뷰가 없어요</h3><p>필터를 끄면 전체 리뷰를 볼 수 있어요.</p></li>';
      $('#rvMore').hidden = true; return;
    }
    L.innerHTML = list.slice(0, rv.shown).map((x) => `<li class="rv"><div class="rv-meta"><span class="stars" aria-label="별점 5점 중 ${x.s}점">${'★'.repeat(x.s)}${'☆'.repeat(5 - x.s)}</span><span>${x.n}</span><span>${x.d}</span></div><div class="rv-opt">옵션: ${x.o}</div><p>${esc(x.t)}</p>${x.ph ? '<div class="rv-ph" role="img" aria-label="리뷰 사진 ' + x.ph + '장">' + '<span></span>'.repeat(x.ph) + '</div>' : ''}<span class="rv-from">${x.src}</span></li>`).join('');
    $('#rvMore').hidden = list.length <= rv.shown;
  }
  INIT.product = () => { if (rv.inited) return; rv.inited = true; loadReviews(900); };
  $$('[data-sort]').forEach((b) => b.addEventListener('click', () => {
    rv.sort = b.dataset.sort; $$('[data-sort]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); renderReviews();
  }));
  $('[data-photo]').addEventListener('click', (e) => { rv.photo = !rv.photo; e.currentTarget.classList.toggle('on', rv.photo); e.currentTarget.setAttribute('aria-pressed', rv.photo); renderReviews(); });
  $('#rvMore').addEventListener('click', () => { rv.shown += 4; renderReviews(); });
  $$('[data-rvstate]').forEach((b) => b.addEventListener('click', () => { rv.state = b.dataset.rvstate; rv.photo = false; $('[data-photo]').classList.remove('on'); $('[data-photo]').setAttribute('aria-pressed', 'false'); loadReviews(500); }));
  $('#pdAdd').addEventListener('click', () => { const n = $('#cartN'); n.textContent = +n.textContent + 1; n.parentElement.setAttribute('aria-label', '장바구니, 담긴 상품 ' + n.textContent + '개'); toast('장바구니에 담았어요. 참여는 장바구니에서 한 번에 할 수 있어요.'); });
  $('#pdLike').addEventListener('click', (e) => { const on = e.currentTarget.getAttribute('aria-pressed') !== 'true'; e.currentTarget.setAttribute('aria-pressed', on); e.currentTarget.textContent = on ? '관심 해제' : '관심'; });

  /* ── 2. 장바구니 일괄참여 ── */
  const CART = [
    { id: 'G-301', t: '제주 노지 감귤 5kg (중과)', opt: '5kg 중과', p: 18900, max: 18900, ppl: '68명 참여', end: '11.3(화) 18:00 마감', q: 1, on: true },
    { id: 'G-288', t: '국산 햅쌀 10kg (2026년산)', opt: '10kg', p: 31500, max: 31500, ppl: '142명 참여', end: '11.2(월) 21:00 마감', q: 1, on: true },
    { id: 'G-276', t: '무항생제 계란 30구', opt: '대란 30구', p: 9800, max: 9800, ppl: '211명 참여', end: '오늘 23:00 마감', q: 2, on: true },
    { id: 'G-250', t: '수제 단호박 식혜 1L × 4', opt: '1L × 4병', p: 16000, max: 16000, ppl: '모집 마감', end: '마감됨', q: 1, on: false, closed: true },
  ];
  let joining = false, joinReq = 0;
  function renderCart() {
    $('#cartList').innerHTML = CART.map((c, i) => `<li class="ci${c.closed ? ' off' : ''}">
      <label class="ck" style="min-height:44px;align-items:flex-start"><input type="checkbox" data-ci="${i}" ${c.on ? 'checked' : ''} ${c.closed ? 'disabled' : ''} aria-label="${esc(c.t)} 선택"></label>
      <div class="thumb" aria-hidden="true"></div>
      <div><h3>${esc(c.t)}</h3><div class="meta">${c.ppl} · ${c.end}</div>
        <div class="opt">옵션 ${c.opt}</div>
        <div class="line2"><span class="pr">${won(c.p * c.q)}<small>${c.closed ? '참여 불가' : '현재가 · 마감 때 확정'}</small></span>
        ${c.closed ? '<span class="tag">모집 마감</span>' : `<span class="step" role="group" aria-label="${esc(c.t)} 수량"><button data-dq="${i}" data-d="-1" aria-label="수량 줄이기" ${c.q <= 1 ? 'disabled' : ''}>−</button><output aria-live="polite">${c.q}</output><button data-dq="${i}" data-d="1" aria-label="수량 늘리기" ${c.q >= 5 ? 'disabled' : ''}>+</button></span>`}</div></div></li>`).join('');
    const sel = CART.filter((c) => c.on && !c.closed), open = CART.filter((c) => !c.closed);
    $('#ckAll').checked = sel.length === open.length && open.length > 0;
    $('#ckAll').indeterminate = sel.length > 0 && sel.length < open.length;
    $('#ckInfo').textContent = `${sel.length} / ${open.length} 선택`;
    const sum = sel.reduce((a, c) => a + c.p * c.q, 0);
    $('#cartSum').innerHTML = `<span>선택 ${sel.length}개 · 지금 결제 0원</span><b>최대 ${won(sum)}</b>`;
    const b = $('#joinBtn');
    if (!joining) { b.disabled = !sel.length; b.textContent = sel.length ? `${sel.length}개 공동구매 한 번에 참여` : '참여할 공동구매를 골라 주세요'; }
  }
  $('#cartList').addEventListener('change', (e) => { const i = e.target.dataset.ci; if (i != null) { CART[i].on = e.target.checked; renderCart(); } });
  $('#cartList').addEventListener('click', (e) => { const b = e.target.closest('[data-dq]'); if (!b) return; const c = CART[b.dataset.dq]; c.q = Math.min(5, Math.max(1, c.q + +b.dataset.d)); renderCart(); $(`[data-dq="${b.dataset.dq}"][data-d="${b.dataset.d}"]`)?.focus(); });
  $('#ckAll').addEventListener('change', (e) => { CART.forEach((c) => { if (!c.closed) c.on = e.target.checked; }); renderCart(); });
  $('#ckAuto').addEventListener('change', (e) => { $('#cardPick').hidden = !e.target.checked; $('#autoOff').hidden = e.target.checked; $('#consentBox').classList.toggle('on', e.target.checked); });
  $('#joinBtn').addEventListener('click', async () => {
    joinReq++; // 연타 횟수 기록(데모 검증용) — 실제로는 같은 요청 번호로 서버가 한 번만 처리
    if (joining) return;
    joining = true; window.__joinSent = (window.__joinSent || 0) + 1;
    const b = $('#joinBtn'); b.disabled = true; b.innerHTML = '<span class="spin" aria-hidden="true"></span> 참여 처리 중';
    const sim = $('input[name=joinSim]:checked').value;
    await wait(900);
    joining = false;
    const sel = CART.filter((c) => c.on && !c.closed);
    if (sim === 'net') {
      renderCart(); toast('연결이 끊겼어요. 참여 여부를 확인했어요: 아직 참여되지 않았어요. 다시 눌러 주세요.'); return;
    }
    const auto = $('#ckAuto').checked;
    const res = sel.map((c, k) => ({ c, ok: !(sim === 'partial' && k === sel.length - 1) }));
    $('#joinRes').innerHTML = res.map(({ c, ok }) => `<li>${ok ? ICON.ok : ICON.fail}<span>${esc(c.t)}<small>${ok ? (auto ? '참여 완료 · 마감 후 자동결제' : '참여 완료 · 마감 후 직접 결제') : '방금 모집이 끝나 참여하지 못했어요. 장바구니에 남겨 둘게요.'}</small></span><span class="sm">${ok ? won(c.p * c.q) : '0원'}</span></li>`).join('');
    const okN = res.filter((x) => x.ok).length;
    $('#joinNote').textContent = (okN < res.length ? `${res.length}개 중 ${okN}개 참여했어요. ` : `${okN}개 모두 참여했어요. `) + '지금은 결제되지 않았어요.';
    res.filter((x) => x.ok).forEach(({ c }) => { CART.splice(CART.indexOf(c), 1); });
    renderCart(); openLayer($('#joinSheet'));
  });
  $('#joinClose').addEventListener('click', () => closeLayer($('#joinSheet')));
  INIT.cart = () => renderCart();

  /* ── 3. 마감 후 결제 결과 ── */
  let PAYS = [];
  const PAYS0 = () => ([
    { id: 'P-10482', t: '국산 햅쌀 10kg (2026년산)', st: 'fail', amt: 29800, was: 31500, card: '함께카드 ****-1234', why: '카드 한도가 부족해 결제되지 않았어요. 11월 6일(금) 18:00까지 다시 결제하면 참여가 유지돼요.', at: '11.2 21:04' },
    { id: 'P-10477', t: '무항생제 계란 30구 × 2', st: 'pending', amt: 17600, was: 19600, card: '함께카드 ****-1234', why: '카드사 응답을 기다리고 있어요. 다시 결제하지 마세요. 중복 결제되지 않게 최대 10분 안에 결과를 확정해 알려 드려요.', at: '11.1 23:02' },
    { id: 'P-10451', t: '제주 노지 감귤 5kg (중과)', st: 'ok', amt: 16800, was: 18900, card: '함께카드 ****-1234', why: '', at: '11.3 18:03' },
  ]);
  let payState = 'ok';
  const ST = { ok: ['ok', '결제 완료'], fail: ['fail', '결제 실패'], pending: ['wait', '결제 확인 중'] };
  function renderPays() {
    if (payState === 'empty') { $('#payList').innerHTML = '<li class="state"><h3>아직 마감된 공동구매가 없어요</h3><p>마감되면 확정 금액과 결제 결과를 여기와 알림으로 알려 드려요.</p><a class="btn line sm" href="#/cart">참여 중인 공동구매 보기</a></li>'; return; }
    $('#payList').innerHTML = PAYS.map((p) => {
      const [ic, lb] = ST[p.st];
      return `<li class="pay ${p.st}" data-pid="${p.id}"><div class="pay-top"><span class="tag ${p.st === 'fail' ? 'acc' : p.st === 'ok' ? 'ink' : ''}">${ICON[ic]}${lb}</span><span class="sm muted">${p.at}</span></div>
      <h3>${esc(p.t)}</h3><div class="amt">확정 ${won(p.amt)} <span class="muted">(참여 때 ${won(p.was)})</span> · ${p.card}</div>
      ${p.why ? `<p class="why">${p.why}</p>` : ''}
      ${p.st === 'fail' ? `<div class="act"><button class="btn pri grow" data-repay="${p.id}">다시 결제하기</button></div>` : ''}
      ${p.st === 'pending' ? `<div class="act"><button class="btn line grow" data-check="${p.id}">결과 다시 확인</button></div>` : ''}
      ${p.st === 'ok' ? `<div class="act"><button class="btn line grow" data-receipt="${p.id}">영수증 보기</button></div>` : ''}</li>`;
    }).join('');
  }
  let repayId = null, repaying = false;
  $('#payList').addEventListener('click', async (e) => {
    const r = e.target.closest('[data-repay]'), c = e.target.closest('[data-check]'), rc = e.target.closest('[data-receipt]');
    if (r) { repayId = r.dataset.repay; const p = PAYS.find((x) => x.id === repayId); $('#repayInfo').textContent = `${p.t} · 확정 ${won(p.amt)}`; $('#repayErr').hidden = true; openLayer($('#repaySheet')); }
    if (c) { c.disabled = true; c.innerHTML = '<span class="spin" aria-hidden="true"></span> 거래 조회 중'; await wait(900); const p = PAYS.find((x) => x.id === c.dataset.check); p.st = 'ok'; p.why = ''; p.at = '방금'; renderPays(); toast('카드사 승인이 확인됐어요. 한 번만 결제됐어요.'); }
    if (rc) toast('영수증 화면 자리예요(데모).');
  });
  $('#repayCancel').addEventListener('click', () => closeLayer($('#repaySheet')));
  $('#repayGo').addEventListener('click', async () => {
    if (repaying) return; repaying = true;
    const b = $('#repayGo'); b.disabled = true; b.innerHTML = '<span class="spin" aria-hidden="true"></span> 결제 중';
    await wait(900); repaying = false; b.disabled = false; b.textContent = '결제하기';
    const card = $('input[name=rcard]:checked').value;
    if (card === '1234') { const er = $('#repayErr'); er.textContent = '이 카드는 한도가 부족해 다시 실패했어요. 다른 카드를 골라 주세요.'; er.hidden = false; return; }
    const p = PAYS.find((x) => x.id === repayId); p.st = 'ok'; p.why = ''; p.card = '바다카드 ****-8870'; p.at = '방금';
    closeLayer($('#repaySheet')); renderPays(); toast('다시 결제했어요. 참여가 유지돼요.');
  });
  $$('[data-paystate]').forEach((b) => b.addEventListener('click', () => { payState = b.dataset.paystate; if (payState === 'ok') PAYS = PAYS0(); renderPays(); }));
  INIT.result = () => { if (!PAYS.length) PAYS = PAYS0(); renderPays(); };

  /* ── 4. 미결제 모아 결제 ── */
  let UP = [];
  const UP0 = () => ([
    { id: 'O-7731', t: '유기농 사과 3kg', p: 21400, due: '11.5(목)까지', on: true },
    { id: 'O-7716', t: '동해 손질 오징어 1kg', p: 18900, due: '11.5(목)까지', on: true },
    { id: 'O-7702', t: '국산 들기름 350ml', p: 12600, due: '11.4(수)까지', on: true },
    { id: 'O-7688', t: '하루견과 30봉', p: 15900, due: '11.6(금)까지', on: false },
  ]);
  let paying = false; window.__pgOpen = 0;
  function renderUp() {
    if (!UP.length) { $('#upList').innerHTML = '<li class="state"><h3>결제할 상품이 없어요</h3><p>마감돼 금액이 확정된 공동구매가 생기면 여기 모여요.</p><a class="btn line sm" href="#/cart">장바구니 보기</a></li>'; $('#upSum').innerHTML = ''; $('#upBtn').disabled = true; $('#upBtn').textContent = '결제할 상품 없음'; $('#upAll').checked = false; $('#upAll').disabled = true; return; }
    $('#upAll').disabled = false;
    $('#upList').innerHTML = UP.map((u, i) => `<li class="ci"><label class="ck" style="min-height:44px;align-items:flex-start"><input type="checkbox" data-ui="${i}" ${u.on ? 'checked' : ''} aria-label="${esc(u.t)} 선택"></label><div class="thumb" aria-hidden="true"></div><div><h3>${esc(u.t)}</h3><div class="meta">금액 확정 · ${u.due} 결제</div><div class="line2"><span class="pr">${won(u.p)}</span>${u.st === 'paying' ? '<span class="tag">다른 기기에서 결제 중</span>' : ''}</div></div></li>`).join('');
    const sel = UP.filter((u) => u.on);
    $('#upAll').checked = sel.length === UP.length; $('#upAll').indeterminate = sel.length > 0 && sel.length < UP.length;
    const sum = sel.reduce((a, u) => a + u.p, 0);
    $('#upSum').innerHTML = `<span>${sel.length}건 선택 · 결제 1번</span><b>${won(sum)}</b>`;
    if (!paying) { $('#upBtn').disabled = !sel.length; $('#upBtn').textContent = sel.length ? `${won(sum)} 한 번에 결제하기` : '결제할 상품을 골라 주세요'; }
  }
  $('#upList').addEventListener('change', (e) => { const i = e.target.dataset.ui; if (i != null) { UP[i].on = e.target.checked; renderUp(); } });
  $('#upAll').addEventListener('change', (e) => { UP.forEach((u) => (u.on = e.target.checked)); renderUp(); });
  $('#upBtn').addEventListener('click', () => {
    if (paying) return; paying = true; window.__pgOpen++;
    const sel = UP.filter((u) => u.on), sum = sel.reduce((a, u) => a + u.p, 0);
    $('#upBtn').disabled = true; $('#upBtn').innerHTML = '<span class="spin" aria-hidden="true"></span> 결제창 여는 중';
    $('#pgKv').innerHTML = `<dt>결제 묶음</dt><dd>B-${2000 + window.__pgOpen}</dd><dt>주문</dt><dd>${sel.length}건</dd><dt>금액</dt><dd><b>${won(sum)}</b></dd><dt>상태</dt><dd>주문 ${sel.length}건 '결제 중'으로 잠금</dd>`;
    setTimeout(() => openLayer($('#pgSheet')), 300);
  });
  function endPay() { paying = false; renderUp(); }
  $('#pgCancel').addEventListener('click', () => { closeLayer($('#pgSheet')); endPay(); toast('결제를 취소했어요. 잠금을 풀었고 결제된 금액은 없어요.'); });
  $('#pgOk').addEventListener('click', async () => {
    const b = $('#pgOk'); if (b.disabled) return; b.disabled = true; b.innerHTML = '<span class="spin" aria-hidden="true"></span> 승인 중';
    await wait(800); b.disabled = false; b.textContent = '결제 승인'; $('#pgSheet').hidden = true;
    const sim = $('input[name=upSim]:checked').value, sel = UP.filter((u) => u.on), sum = sel.reduce((a, u) => a + u.p, 0);
    if (sim === 'fail') {
      $('#upRes').innerHTML = `<li>${ICON.fail}<span>카드 승인 거절<small>카드사가 승인을 거절했어요. 결제된 금액은 없고 주문 ${sel.length}건은 그대로 미결제로 남아요.</small></span><span class="sm">0원</span></li>`;
      $('#upNote').textContent = '다른 카드로 다시 결제할 수 있어요.';
    } else {
      const bad = sim === 'partial' ? sel[sel.length - 1] : null;
      $('#upRes').innerHTML = sel.map((u) => u === bad
        ? `<li>${ICON.fail}<span>${esc(u.t)}<small>판매자 재고가 부족해 주문이 처리되지 않았어요. 이 금액만 바로 취소했어요(카드사에 따라 3~5영업일).</small></span><span class="sm">−${won(u.p)}</span></li>`
        : `<li>${ICON.ok}<span>${esc(u.t)}<small>결제 완료</small></span><span class="sm">${won(u.p)}</span></li>`).join('');
      $('#upNote').textContent = bad ? `결제 ${won(sum)} 중 ${won(bad.p)}을 부분취소했어요. 최종 결제 ${won(sum - bad.p)}.` : `${sel.length}건을 결제 1번으로 끝냈어요. 합계 ${won(sum)}.`;
      UP = UP.filter((u) => !sel.includes(u));
    }
    openLayer($('#upSheet'));
  });
  $('#upClose').addEventListener('click', () => { closeLayer($('#upSheet')); endPay(); });
  $('#upEmpty').addEventListener('click', () => { UP = []; renderUp(); });
  INIT.unpaid = () => { if (!UP.length && !INIT.unpaid.done) UP = UP0(); INIT.unpaid.done = true; renderUp(); };

  /* ── 5. 관리자 ── */
  const ADM = [
    { id: 'P-10482', u: '김*현', gb: '국산 햅쌀 10kg', amt: 29800, way: '자동', st: 'fail', n: 1, why: '한도 초과 (카드사 응답)', log: [['11.2 21:00', '마감 · 확정가 29,800원 계산', ''], ['11.2 21:04', '빌키 승인 요청 · orderId GB288-U5512-1', ''], ['11.2 21:04', '승인 거절 · 한도 초과', 'fail'], ['11.2 21:05', '이용자 알림 발송 · 재결제 기한 11.6', '']] },
    { id: 'P-10477', u: '이*영', gb: '무항생제 계란 30구', amt: 17600, way: '자동', st: 'pending', n: 1, why: '응답 시간 초과 · 거래 조회 대기', log: [['11.1 23:00', '마감 · 확정가 계산', ''], ['11.1 23:02', '빌키 승인 요청 · orderId GB276-U2091-1', ''], ['11.1 23:02', '응답 없음(10초) · 결과 미확정', 'fail'], ['11.1 23:03', '재승인 막음 · 거래 조회 예약', '']] },
    { id: 'B-2002', u: '박*우', gb: '일괄결제 3건', amt: 52900, way: '일괄', st: 'partial', n: 1, why: '주문 1건 재고 부족 → 12,600원 부분취소', log: [['11.3 10:12', '결제 묶음 생성 · 주문 3건 잠금', ''], ['11.3 10:13', '승인 52,900원', 'ok'], ['11.3 10:13', '주문 O-7702 처리 실패(재고)', 'fail'], ['11.3 10:13', '부분취소 12,600원 · 취소번호 C-1', 'ok']] },
    { id: 'P-10451', u: '최*나', gb: '제주 노지 감귤 5kg', amt: 16800, way: '자동', st: 'ok', n: 1, why: '', log: [['11.3 18:00', '마감 · 확정가 16,800원', ''], ['11.3 18:03', '승인 완료', 'ok'], ['11.3 18:03', '웹훅 수신 · 서명 확인 · 이미 처리됨', 'ok']] },
    { id: 'P-10439', u: '정*호', gb: '동해 손질 오징어 1kg', amt: 18900, way: '자동', st: 'fail', n: 3, why: '카드 해지 · 카드 변경 필요', log: [['10.31 20:00', '승인 거절 · 유효하지 않은 카드', 'fail'], ['11.1 09:00', '재결제 거절(같은 카드)', 'fail'], ['11.2 09:00', '재결제 거절(같은 카드)', 'fail'], ['11.2 09:01', '운영자 확인 목록으로 이동', '']] },
    { id: 'B-2001', u: '한*솔', gb: '일괄결제 2건', amt: 40300, way: '일괄', st: 'ok', n: 1, why: '', log: [['11.2 14:20', '결제 묶음 생성 · 주문 2건 잠금', ''], ['11.2 14:21', '승인 40,300원', 'ok']] },
    { id: 'P-10420', u: '오*린', gb: '국산 들기름 350ml', amt: 12600, way: '자동', st: 'ok', n: 2, why: '', log: [['10.30 19:00', '승인 거절 · 한도 초과', 'fail'], ['10.31 08:40', '이용자 재결제(다른 카드) 승인', 'ok']] },
  ];
  const AST = { ok: ['ok', '완료', 'ink'], fail: ['fail', '실패', 'acc'], pending: ['wait', '확인 중', ''], partial: ['ok', '부분취소', ''] };
  const adm = { f: 'all', q: '' };
  function renderAdm() {
    const c = (s) => ADM.filter((a) => a.st === s).length;
    $('#admSum').innerHTML = `<div><span>오늘 결제</span><b>${ADM.length}</b></div><div class="hot"><span>실패</span><b>${c('fail')}</b></div><div><span>확인 중</span><b>${c('pending')}</b></div><div><span>부분취소</span><b>${c('partial')}</b></div>`;
    const q = adm.q.trim();
    const rows = ADM.filter((a) => (adm.f === 'all' || a.st === adm.f) && (!q || (a.id + a.gb).includes(q)));
    $('#admBody').innerHTML = rows.map((a) => {
      const [ic, lb, cls] = AST[a.st];
      const act = a.st === 'fail' ? `<button class="btn line sm" data-retry="${a.id}">재시도</button>` : a.st === 'pending' ? `<button class="btn line sm" data-query="${a.id}">거래 조회</button>` : `<button class="btn line sm" data-detail="${a.id}">상세</button>`;
      return `<tr data-row="${a.id}"><td class="c-id"><code>${a.id}</code></td><td class="c-user">${a.u}</td><td class="c-gb"><button class="linkbtn" data-detail="${a.id}">${esc(a.gb)}</button><span class="meta-m">${a.u} · ${a.way} · 시도 ${a.n}회</span></td><td class="c-amt num">${won(a.amt)}</td><td class="c-way">${a.way}</td><td class="c-st"><span class="tag ${cls}">${ICON[ic]}${lb}</span></td><td class="c-try num">${a.n}</td><td class="c-why why">${a.why || '<span class="muted">-</span>'}</td><td class="c-act">${act}</td></tr>`;
    }).join('');
    $('#admEmpty').hidden = rows.length > 0;
    $('#admTbl').hidden = rows.length === 0;
  }
  $('#admSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; adm.f = b.dataset.f; $$('#admSeg button').forEach((x) => x.setAttribute('aria-selected', x === b)); renderAdm(); });
  $('#admQ').addEventListener('input', (e) => { adm.q = e.target.value; renderAdm(); });
  function openDetail(id) {
    const a = ADM.find((x) => x.id === id);
    $('#drTitle').textContent = '결제 상세 ' + a.id;
    $('#drKv').innerHTML = `<dt>회원</dt><dd>${a.u}</dd><dt>공동구매</dt><dd>${esc(a.gb)}</dd><dt>금액</dt><dd>${won(a.amt)}</dd><dt>방식</dt><dd>${a.way}결제</dd><dt>상태</dt><dd>${AST[a.st][1]}</dd>`;
    $('#drTl').innerHTML = a.log.map(([t, m, s]) => `<li class="${s}"><b>${m}</b>${t}</li>`).join('');
    $('#drAct').innerHTML = a.st === 'fail' ? `<button class="btn pri grow" data-retry="${a.id}">재시도</button><button class="btn line grow" data-memo>상담 메모</button>` : '<button class="btn line grow" data-memo>상담 메모</button>';
    openLayer($('#admDrawer'));
  }
  async function retry(id, btn) {
    const a = ADM.find((x) => x.id === id);
    if (a.why.includes('카드 해지')) { toast('카드가 해지돼 같은 카드로는 재시도할 수 없어요. 이용자에게 카드 변경 알림을 보냈어요.'); return; }
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spin" aria-hidden="true"></span>'; }
    a.st = 'pending'; a.why = '재시도 승인 요청 중'; renderAdm();
    await wait(1000);
    a.n++; a.st = 'ok'; a.why = ''; a.log.push(['방금', `운영자 재시도 · orderId ${a.id}-${a.n} 승인`, 'ok']);
    renderAdm(); const tr = $(`tr[data-row="${id}"]`); if (tr) { tr.classList.add('flash'); setTimeout(() => tr.classList.remove('flash'), 1500); }
    toast(`${a.id} 재시도 승인됐어요. 새 orderId로 한 번만 결제했어요.`);
  }
  document.addEventListener('click', (e) => {
    const d = e.target.closest('[data-detail]'), r = e.target.closest('[data-retry]'), q = e.target.closest('[data-query]'), m = e.target.closest('[data-memo]');
    if (d) openDetail(d.dataset.detail);
    if (r) { if (!$('#admDrawer').hidden) closeLayer($('#admDrawer')); retry(r.dataset.retry, r.closest('#admBody') ? r : null); }
    if (q) { const a = ADM.find((x) => x.id === q.dataset.query); q.disabled = true; setTimeout(() => { a.st = 'ok'; a.why = '거래 조회로 승인 확인(재승인 안 함)'; a.log.push(['방금', '거래 조회 · 승인 확인', 'ok']); renderAdm(); toast('거래 조회 결과 이미 승인돼 있었어요. 다시 결제하지 않았어요.'); }, 800); }
    if (m) toast('상담 메모 입력 자리예요(데모).');
  });
  $('#drClose').addEventListener('click', () => closeLayer($('#admDrawer')));
  INIT.admin = () => renderAdm();

  /* ── 6. 검수표 ── */
  const CATS = { dup: '중복결제', fail: '결제 실패', net: '네트워크·웹훅', part: '일부 실패', ops: '금액·운영' };
  const QA = [
    ['dup', '결제 버튼을 여러 번 빠르게 누름', '버튼을 누르는 즉시 잠그고, 서버는 같은 요청 번호(결제 묶음 ID)로 온 요청에 처음 결과만 돌려줘요.', '0.1초 간격 5번 클릭 → 결제 시도 기록 1건, 나이스페이 승인 1건인지 DB와 가맹점 관리자에서 확인.', 'unpaid'],
    ['dup', '휴대폰과 PC에서 같은 미결제를 동시에 결제', '주문 상태를 "미결제 → 결제 중"으로 바꾸는 조건부 업데이트. 먼저 바꾼 쪽만 결제창을 열고 다른 쪽은 "다른 기기에서 결제 중" 안내.', '두 브라우저에서 동시에 결제 → 결제창 1개만 열림, 승인 1건.', 'unpaid'],
    ['dup', '마감 자동결제 작업이 두 번 실행됨', '공동구매별 마감 처리 잠금 + 결제 시도 유니크 키(공동구매·회원·회차). 나이스페이도 결제된 orderId 재호출을 막아 2중으로 막혀요.', '스테이징에서 마감 작업 2개를 동시에 실행 → 회원별 승인 1건.', 'admin'],
    ['dup', '자동결제 진행 중 이용자가 직접 결제를 누름', '자동결제가 시작되면 주문이 "결제 중"이라 수동 결제 목록에서 빠지고, 결과가 나오면 다시 나타나요(실패 시).', '자동결제 응답을 일부러 늦춘 상태에서 미결제 화면 확인 → 해당 주문 안 보임.', 'unpaid'],
    ['dup', '같은 웹훅이 두 번 도착', 'tid 기준 처리 기록을 남기고, 이미 처리한 건 다시 처리하지 않고 "OK"만 응답해요.', '같은 웹훅을 2번 재전송 → 주문 상태·포인트·알림이 1번만 바뀜.', 'admin'],
    ['dup', '결제 완료 화면에서 새로고침·뒤로가기', '결과 화면은 서버에 저장된 상태만 읽어서 그려요. 화면을 다시 열어도 승인 요청을 다시 보내지 않아요.', '완료 화면에서 새로고침 5번, 뒤로가기 후 앞으로 → 승인 1건 유지.', 'result'],
    ['fail', '카드 한도 초과로 자동결제 실패', '실패 사유를 이용자 말로 바꿔 알림 + 재결제 버튼. 재결제 기한(운영 정책으로 정함)까지 참여 유지.', '나이스페이 시험 환경의 실패 응답으로 확인 → 알림 문구, 재결제 성공까지 흐름 확인.', 'result'],
    ['fail', '카드 해지·만료로 빌키 사용 불가', '실패 코드를 "카드 바꿔야 함"으로 분류해 같은 카드 재시도는 막고 카드 등록 화면으로 안내.', '만료 카드 응답 코드로 시험 → 재시도 버튼 대신 카드 변경 안내 확인.', 'admin'],
    ['fail', '재결제도 계속 실패', '시도 횟수를 기록하고 정한 횟수를 넘으면 운영자 확인 목록으로 올려요. 자동 재시도는 횟수·간격 상한을 둬요.', '실패 응답 3회 반복 → 관리자 실패 목록과 시도 횟수 확인.', 'admin'],
    ['fail', '재결제 기한이 지남', '기한이 지나면 참여 취소 처리(정책 확정 필요)하고 이용자·관리자에 표시. 결제된 돈이 없으니 환불 없음.', '기한을 1분으로 줄인 스테이징에서 상태 변화 확인.', 'admin'],
    ['fail', '마감 전에 자동결제 동의를 끔', '마감 전이면 해당 참여를 수동결제 대상으로 바꾸고, 동의 철회 시각을 저장. 마감 후에는 이미 시작된 결제를 기준으로 처리.', '마감 1분 전·1분 후에 각각 끄기 → 대상 목록이 맞는지 확인.', 'cart'],
    ['net', '승인 요청 후 응답을 못 받음(타임아웃)', '결과를 "확인 중"으로 저장하고 다시 승인하지 않아요. 거래 조회로 확정하고, 결과가 불확실하면 1시간 안에 망취소(나이스페이 규칙).', '응답 지연을 흉내 낸 시험 → 이중 승인 없음, 확인 중 → 완료 또는 망취소로 정리.', 'result'],
    ['net', '앱(웹뷰)에서 결제창 중 네트워크 끊김', '돌아오면 서버에 결제 묶음 상태를 물어서 이어 보여 줘요. 같은 묶음 번호를 다시 쓰므로 새 결제가 생기지 않아요.', 'iOS·Android 앱에서 결제창 중 비행기 모드 → 복귀 후 상태 확인.', 'unpaid'],
    ['net', '웹훅이 늦거나 안 옴', '승인 응답으로 먼저 확정하고, 웹훅은 확인용. 정해진 주기로 "확인 중" 건을 거래 조회로 대조해요.', '웹훅 주소를 잠시 막고 결제 → 대조 작업으로 상태가 맞춰지는지 확인.', 'admin'],
    ['net', '가짜 웹훅(위조) 요청', '나이스페이 서명(sha256)과 금액을 비교한 뒤에만 처리하고, 들어오는 IP를 제한해요.', '서명을 바꾼 요청을 보냄 → 무시되고 기록만 남는지 확인.', 'admin'],
    ['net', 'PG 점검·장애 시간에 마감', '승인 요청이 연속 실패하면 자동결제 작업을 잠시 멈추고 나중에 재개. 이용자에게는 "결제 확인 중"으로 안내.', '스테이징에서 PG 주소를 막고 마감 → 보류 후 재개 확인.', 'admin'],
    ['part', '일괄결제 승인 후 주문 1건 처리 실패', '결제 1건 = 주문 여러 개로 묶고, 실패한 주문 금액만 부분취소(cancelAmt). 나머지 주문은 완료 유지, 화면에 따로 표시.', '재고 0인 주문을 섞어 결제 → 부분취소 금액·나머지 주문 상태·관리자 기록 확인.', 'unpaid'],
    ['part', '장바구니 일괄참여 중 1건이 방금 마감', '공동구매별로 참여를 처리해 성공한 것만 저장하고, 실패한 건 사유와 함께 장바구니에 남겨요.', '마감 시각을 맞춰 일괄참여 → 성공/실패 구분 표시 확인.', 'cart'],
    ['part', '부분취소 요청 자체가 실패', '"취소 대기" 상태로 남기고 관리자에서 재시도. 이용자에게는 취소 진행 중으로 안내해 돈이 묶이지 않게 해요.', '취소 API 실패를 흉내 냄 → 관리자 목록에 취소 대기 표시, 재시도 후 정리.', 'admin'],
    ['ops', '확정 금액이 참여 때 보여 준 금액보다 큼', '금액은 서버에서만 계산하고, 확정가가 참여 때 표시한 상한을 넘으면 자동결제를 멈추고 운영자 확인으로 넘겨요.', '가격표를 잘못 넣은 시험 상품으로 마감 → 결제 안 되고 관리자 알림.', 'admin'],
  ];
  const qa = { f: 'all', done: new Set() };
  function renderQa() {
    $('#qaSeg').innerHTML = [['all', '전체 20'], ...Object.entries(CATS).map(([k, v]) => [k, `${v} ${QA.filter((x) => x[0] === k).length}`])].map(([k, v]) => `<button role="tab" aria-selected="${qa.f === k}" data-qf="${k}">${v}</button>`).join('');
    const rows = QA.map((x, i) => [x, i]).filter(([x]) => qa.f === 'all' || x[0] === qa.f);
    $('#qaList').innerHTML = '<li class="qa-head-row" aria-hidden="true"><span>번호</span><span>상황</span><span>어떻게 막나</span><span class="c4">어떻게 검수하나</span><span class="c5">확인</span></li>' + rows.map(([x, i]) => {
      const id = 'E' + String(i + 1).padStart(2, '0'), on = qa.done.has(i);
      return `<li class="qa${on ? ' done' : ''}"><span class="qa-id">${id}</span><div><h3>${x[1]}</h3><div class="cat">${CATS[x[0]]}</div></div><div><span class="lab">막는 방법</span><p>${x[2]}</p></div><div class="c3"><span class="lab">검수 방법</span><p>${x[3]}</p></div><div class="side"><label class="ck"><input type="checkbox" data-qd="${i}" ${on ? 'checked' : ''}><span class="sm">검수 확인</span></label><a href="#/${x[4]}">관련 화면 보기</a></div></li>`;
    }).join('');
    $('#qaProg').textContent = `검수 확인 ${qa.done.size} / ${QA.length}`;
  }
  $('#qaSeg').addEventListener('click', (e) => { const b = e.target.closest('[data-qf]'); if (!b) return; qa.f = b.dataset.qf; renderQa(); $(`[data-qf="${qa.f}"]`).focus(); });
  $('#qaList').addEventListener('change', (e) => { const i = e.target.dataset.qd; if (i == null) return; e.target.checked ? qa.done.add(+i) : qa.done.delete(+i); e.target.closest('.qa').classList.toggle('done', e.target.checked); $('#qaProg').textContent = `검수 확인 ${qa.done.size} / ${QA.length}`; });
  INIT.qa = () => renderQa();
  window.__QA_COUNT = QA.length;

  route();
})();
