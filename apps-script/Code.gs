/**
 * FAERS 과제 배정 - 공유 기록 백엔드 (Google Apps Script)
 * 시트 "history" 에 배정 기록을 저장한다.
 * 스크립트 속성 ADMIN_PASSWORD 에 관리자 비밀번호를 설정할 것.
 */
var SHEET = 'history';
var HEADER = ['timestamp', 'studentId', 'name', 'atc', 'smq'];

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET) || ss.insertSheet(SHEET);
  if (sh.getLastRow() === 0) sh.appendRow(HEADER);
  return sh;
}

function readAll_() {
  var sh = sheet_();
  var n = sh.getLastRow() - 1;
  if (n <= 0) return [];
  return sh.getRange(2, 1, n, HEADER.length).getValues().map(function (r) {
    return {
      timestamp: r[0] instanceof Date ? r[0].toISOString() : String(r[0]),
      studentId: String(r[1]), name: String(r[2]),
      atc: String(r[3]).split(',').filter(String),
      smq: String(r[4]).split(',').filter(String)
    };
  });
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sample_(arr, k) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a.slice(0, k);
}

function checkPw_(pw) {
  var real = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  return real && pw === real;
}

function doGet() {
  return out_({ ok: true, history: readAll_() });
}

function doPost(e) {
  var req = JSON.parse(e.postData.contents);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (req.action === 'draw') {
      var sid = String(req.studentId || '').trim();
      var name = String(req.name || '').trim();
      if (!sid || !name) return out_({ ok: false, error: '학번과 이름을 입력하세요.' });
      var hist = readAll_();
      var prev = hist.filter(function (h) { return h.studentId === sid; })[0];
      if (prev) return out_({ ok: true, existing: true, record: prev, history: hist });

      var atcPool = req.atcPool;
      if (req.uniqueAtc) {
        var used = {};
        hist.forEach(function (h) { h.atc.forEach(function (a) { used[a] = true; }); });
        var free = atcPool.filter(function (a) { return !used[a]; });
        if (free.length >= req.nAtc) atcPool = free;
      }
      var rec = {
        timestamp: new Date().toISOString(), studentId: sid, name: name,
        atc: sample_(atcPool, req.nAtc), smq: sample_(req.smqPool, req.nSmq)
      };
      sheet_().appendRow([rec.timestamp, "'" + sid, name, rec.atc.join(','), rec.smq.join(',')]);
      hist.push(rec);
      return out_({ ok: true, existing: false, record: rec, history: hist });
    }
    if (req.action === 'reset' || req.action === 'delete') {
      if (!checkPw_(req.password)) return out_({ ok: false, error: '관리자 비밀번호가 틀렸습니다.' });
      var sh = sheet_();
      if (req.action === 'reset') {
        if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
      } else {
        var ids = sh.getRange(1, 2, sh.getLastRow(), 1).getValues();
        for (var i = ids.length - 1; i >= 1; i--) {
          if (String(ids[i][0]).replace(/^'/, '') === String(req.studentId)) sh.deleteRow(i + 1);
        }
      }
      return out_({ ok: true, history: readAll_() });
    }
    return out_({ ok: false, error: 'unknown action' });
  } finally {
    lock.releaseLock();
  }
}
