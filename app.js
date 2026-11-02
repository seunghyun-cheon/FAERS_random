(function () {
  const C = window.APP_CONFIG, P = window.POOL;
  const ATC = Object.fromEntries(P.atc.map(a => [a.id, a]));
  const SMQ = Object.fromEntries(P.smq.map(s => [s.id, s]));
  const LS_KEY = 'faers_assign_history_v1';
  const $ = id => document.getElementById(id);
  let history = [], adminPw = null;

  $('nA').textContent = C.N_ATC; $('nS').textContent = C.N_SMQ;
  $('mode').textContent = C.BACKEND_URL
    ? '저장 방식: 공유 기록(Google 스프레드시트) — 모든 기기에서 같은 기록이 보입니다.'
    : '저장 방식: 이 브라우저에만 저장(localStorage) — 다른 기기에서는 기록이 보이지 않습니다.';

  // ---- 무작위 추출 (crypto 기반 Fisher–Yates) ----
  function rint(n) {
    const lim = Math.floor(0x100000000 / n) * n, b = new Uint32Array(1);
    do crypto.getRandomValues(b); while (b[0] >= lim);
    return b[0] % n;
  }
  function sample(arr, k) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = rint(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a.slice(0, k);
  }

  // ---- 저장소 ----
  const local = {
    load() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; } },
    save(h) { localStorage.setItem(LS_KEY, JSON.stringify(h)); },
    async list() { return this.load(); },
    async draw(studentId, name) {
      const h = this.load();
      const prev = h.find(r => r.studentId === studentId);
      if (prev) return { existing: true, record: prev, history: h };
      let atcPool = P.atc.map(a => a.id);
      if (C.UNIQUE_ATC) {
        const used = new Set(h.flatMap(r => r.atc));
        const free = atcPool.filter(a => !used.has(a));
        if (free.length >= C.N_ATC) atcPool = free;
      }
      const rec = { timestamp: new Date().toISOString(), studentId, name,
        atc: sample(atcPool, C.N_ATC), smq: sample(P.smq.map(s => s.id), C.N_SMQ) };
      h.push(rec); this.save(h);
      return { existing: false, record: rec, history: h };
    },
    check(pw) { if (pw !== C.LOCAL_ADMIN_PASSWORD) throw new Error('관리자 비밀번호가 틀렸습니다.'); },
    async reset(pw) { this.check(pw); this.save([]); return []; },
    async remove(pw, sid) { this.check(pw); const h = this.load().filter(r => r.studentId !== sid); this.save(h); return h; },
  };
  // 공유 모드: 모든 요청에 비밀번호 필요. 컴퓨터마다 한 번 입력하면 그 브라우저에 기억.
  const PW_KEY = 'faers_assign_pw';
  const remote = {
    pw() {
      let pw = null; try { pw = localStorage.getItem(PW_KEY); } catch {}
      if (!pw) {
        pw = prompt('비밀번호 (이 컴퓨터에서 처음 한 번만 입력)');
        if (pw === null) throw new Error('비밀번호가 필요합니다.');
        try { localStorage.setItem(PW_KEY, pw); } catch {}
      }
      return pw;
    },
    async call(body, retry = true) {
      const r = await fetch(C.BACKEND_URL, { method: 'POST', body: JSON.stringify({ ...body, password: this.pw() }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
      const j = await r.json();
      if (!j.ok && j.auth && retry) { try { localStorage.removeItem(PW_KEY); } catch {} alert(j.error); return this.call(body, false); }
      if (!j.ok) throw new Error(j.error || '서버 오류');
      return j;
    },
    async list() { return (await this.call({ action: 'list' })).history; },
    async draw(studentId, name) {
      return this.call({ action: 'draw', studentId, name, nAtc: C.N_ATC, nSmq: C.N_SMQ, uniqueAtc: C.UNIQUE_ATC,
        atcPool: P.atc.map(a => a.id), smqPool: P.smq.map(s => s.id) });
    },
    async reset() { return (await this.call({ action: 'reset' })).history; },
    async remove(_, sid) { return (await this.call({ action: 'delete', studentId: sid })).history; },
  };
  const store = C.BACKEND_URL ? remote : local;

  // ---- 화면 ----
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = t => { const d = new Date(t); return isNaN(d) ? esc(t) : d.toLocaleString('ko-KR', { hour12: false }); };
  const atcTxt = id => ATC[id] ? `${ATC[id].code} ${ATC[id].name}` : id;
  const smqTxt = id => SMQ[id] ? `${SMQ[id].name} (${SMQ[id].ko})` : id;

  function msg(t, cls) { $('msg').textContent = t; $('msg').className = 'msg ' + (cls || ''); }

  function resultHtml(rec, existing, a, s) {
    return `<div class="who">${esc(rec.studentId)} ${esc(rec.name)} — ${existing ? '이미 배정된 결과' : '추첨 결과'} <span class="meta mode">(${fmt(rec.timestamp)})</span></div>` +
      `<h2>ATC 4단계 약물계열</h2>` +
      a.map(x => `<div class="item"><span class="tag">${esc(x.area)}</span><b>${esc(x.code)}</b> <b>${esc(x.name)}</b>
         <div class="meta"><a href="${esc(x.url)}" target="_blank" rel="noopener">WHO ATC/DDD Index에서 성분 확인</a></div></div>`).join('') +
      `<h2 style="margin-top:14px">SMQ</h2>` +
      s.map(x => `<div class="item"><span class="tag">${esc(x.area)}</span><b>${esc(x.name)}</b>
         <div class="meta">${esc(x.ko)}</div></div>`).join('');
  }

  // 새 추첨이면 후보를 빠르게 돌리다가 결과에서 멈춤(화면 연출용; 결과는 이미 확정·저장된 상태)
  function showResult(rec, existing) {
    const a = rec.atc.map(id => ATC[id]).filter(Boolean), s = rec.smq.map(id => SMQ[id]).filter(Boolean);
    const box = $('result'); box.hidden = false;
    if (existing) { box.className = 'card'; box.innerHTML = resultHtml(rec, existing, a, s); return Promise.resolve(); }
    const pick = arr => arr[rint(arr.length)];
    const total = 1800, start = performance.now();
    box.className = 'card rolling';
    return new Promise(done => {
      (function tick() {
        const t = performance.now() - start;
        if (t >= total) { box.className = 'card'; box.innerHTML = resultHtml(rec, existing, a, s); return done(); }
        box.innerHTML = resultHtml(rec, existing, a.map(() => pick(P.atc)), s.map(() => pick(P.smq)));
        setTimeout(tick, 40 + 160 * (t / total));
      })();
    });
  }

  function render() {
    $('cnt').textContent = history.length;
    const adm = adminPw !== null;
    document.querySelectorAll('.adm').forEach(e => e.hidden = !adm);
    $('reset').hidden = !adm;
    $('admin').textContent = adm ? '관리자 모드 종료' : '관리자 모드';
    $('tb').innerHTML = history.slice().reverse().map((r, i) => `<tr>
      <td>${history.length - i}</td><td>${fmt(r.timestamp)}</td><td>${esc(r.studentId)}</td><td>${esc(r.name)}</td>
      <td>${r.atc.map(x => esc(atcTxt(x))).join('<br>')}</td>
      <td>${r.smq.map(x => esc(smqTxt(x))).join('<br>')}</td>
      <td class="adm"${adm ? '' : ' hidden'}><button class="x danger" data-sid="${esc(r.studentId)}">삭제</button></td></tr>`).join('')
      || `<tr><td colspan="7" class="mode">아직 배정 기록이 없습니다.</td></tr>`;
  }

  async function refresh() {
    try { history = await store.list(); render(); }
    catch (e) { msg('기록을 불러오지 못했습니다: ' + e.message, 'err'); }
  }

  $('f').addEventListener('submit', async ev => {
    ev.preventDefault();
    const sid = $('sid').value.trim(), name = $('name').value.trim();
    if (!sid || !name) return msg('학번과 이름을 모두 입력하세요.', 'err');
    $('go').disabled = true; msg('추첨 중…');
    try {
      const r = await store.draw(sid, name);
      history = r.history; msg(''); await showResult(r.record, r.existing); render();
      if (r.existing && r.record.name !== name)
        msg(`학번 ${sid}은 이미 "${r.record.name}" 이름으로 배정되어 있습니다. 다시 추첨하려면 관리자 모드에서 해당 기록을 삭제하세요.`, 'err');
      else msg(r.existing ? '이미 배정된 학번입니다. 기존 결과를 보여줍니다.' : '추첨 완료 — 기록에 저장되었습니다.', r.existing ? 'err' : 'ok');
    } catch (e) { msg('배정 실패: ' + e.message, 'err'); }
    $('go').disabled = false;
  });

  $('refresh').onclick = refresh;
  $('admin').onclick = () => {
    if (adminPw !== null) { adminPw = null; return render(); }
    if (C.BACKEND_URL) { adminPw = ''; return render(); }  // 공유 모드는 이미 비밀번호로 접속한 상태
    const pw = prompt('관리자 비밀번호');
    if (pw === null) return;
    if (pw !== C.LOCAL_ADMIN_PASSWORD) return alert('비밀번호가 틀렸습니다.');
    adminPw = pw; render();
  };
  $('reset').onclick = async () => {
    if (!confirm(`배정 기록 ${history.length}건을 모두 삭제합니다. 되돌릴 수 없습니다. 계속할까요?\n(먼저 CSV 저장을 권장합니다)`)) return;
    try { history = await store.reset(adminPw); render(); $('result').hidden = true; msg('기록을 초기화했습니다.', 'ok'); }
    catch (e) { alert(e.message); }
  };
  $('tb').addEventListener('click', async e => {
    const sid = e.target.dataset && e.target.dataset.sid;
    if (!sid || !confirm(`학번 ${sid}의 배정 기록을 삭제할까요? 삭제하면 다시 뽑을 수 있습니다.`)) return;
    try { history = await store.remove(adminPw, sid); render(); }
    catch (err) { alert(err.message); }
  });
  $('csv').onclick = () => {
    const q = v => `"${String(v).replace(/"/g, '""')}"`;
    const head = ['timestamp', 'studentId', 'name', 'ATC_ID', 'ATC_code', 'ATC_name',
      ...Array.from({ length: C.N_SMQ }, (_, i) => [`SMQ${i + 1}_ID`, `SMQ${i + 1}`, `SMQ${i + 1}_ko`]).flat()];
    const rows = history.map(r => [r.timestamp, r.studentId, r.name,
      r.atc.join(';'), r.atc.map(x => ATC[x]?.code ?? '').join(';'), r.atc.map(x => ATC[x]?.name ?? '').join(';'),
      ...r.smq.flatMap(x => [x, SMQ[x]?.name ?? '', SMQ[x]?.ko ?? ''])]);
    const csv = '﻿' + [head, ...rows].map(r => r.map(q).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `FAERS_배정기록_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  refresh();
})();
