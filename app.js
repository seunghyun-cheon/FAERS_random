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
  const remote = {
    async call(body) {
      const r = await fetch(C.BACKEND_URL, { method: 'POST', body: JSON.stringify(body),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || '서버 오류');
      return j;
    },
    async list() { const j = await (await fetch(C.BACKEND_URL)).json(); return j.history; },
    async draw(studentId, name) {
      return this.call({ action: 'draw', studentId, name, nAtc: C.N_ATC, nSmq: C.N_SMQ, uniqueAtc: C.UNIQUE_ATC,
        atcPool: P.atc.map(a => a.id), smqPool: P.smq.map(s => s.id) });
    },
    async reset(pw) { return (await this.call({ action: 'reset', password: pw })).history; },
    async remove(pw, sid) { return (await this.call({ action: 'delete', password: pw, studentId: sid })).history; },
  };
  const store = C.BACKEND_URL ? remote : local;

  // ---- 화면 ----
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = t => { const d = new Date(t); return isNaN(d) ? esc(t) : d.toLocaleString('ko-KR', { hour12: false }); };
  const atcTxt = id => ATC[id] ? `${ATC[id].code} ${ATC[id].name}` : id;
  const smqTxt = id => SMQ[id] ? `${SMQ[id].name} (${SMQ[id].ko})` : id;

  function msg(t, cls) { $('msg').textContent = t; $('msg').className = 'msg ' + (cls || ''); }

  function showResult(rec, existing) {
    const a = rec.atc.map(id => ATC[id]).filter(Boolean), s = rec.smq.map(id => SMQ[id]).filter(Boolean);
    $('result').innerHTML =
      `<div class="who">${esc(rec.studentId)} ${esc(rec.name)} — ${existing ? '이미 배정된 결과' : '배정 결과'} <span class="meta mode">(${fmt(rec.timestamp)})</span></div>` +
      `<h2>ATC 4단계 약물계열</h2>` +
      a.map(x => `<div class="item"><span class="tag">${esc(x.area)}</span><b>${esc(x.code)}</b> ${esc(x.name)}
         <div class="meta"><a href="${esc(x.url)}" target="_blank" rel="noopener">WHO ATC/DDD Index에서 성분 확인</a></div></div>`).join('') +
      `<h2 style="margin-top:14px">SMQ</h2>` +
      s.map(x => `<div class="item"><span class="tag">${esc(x.area)}</span><b>${esc(x.name)}</b>
         <div class="meta">${esc(x.ko)}</div></div>`).join('');
    $('result').hidden = false;
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
    $('go').disabled = true; msg('배정 중…');
    try {
      const r = await store.draw(sid, name);
      history = r.history; render(); showResult(r.record, r.existing);
      if (r.existing && r.record.name !== name)
        msg(`학번 ${sid}은 이미 "${r.record.name}" 이름으로 배정되어 있습니다. 잘못 입력했다면 교수자에게 알려주세요.`, 'err');
      else msg(r.existing ? '이미 배정된 학번입니다. 기존 결과를 보여줍니다.' : '배정되었습니다. 결과를 기록해 두세요.', r.existing ? 'err' : 'ok');
    } catch (e) { msg('배정 실패: ' + e.message, 'err'); }
    $('go').disabled = false;
  });

  $('refresh').onclick = refresh;
  $('admin').onclick = () => {
    if (adminPw !== null) { adminPw = null; return render(); }
    const pw = prompt('관리자 비밀번호');
    if (pw === null) return;
    if (!C.BACKEND_URL && pw !== C.LOCAL_ADMIN_PASSWORD) return alert('비밀번호가 틀렸습니다.');
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
