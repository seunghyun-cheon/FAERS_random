// ===== 설정 =====
window.APP_CONFIG = {
  // Google Apps Script 웹앱 URL (README의 "공유 기록 설정" 참고).
  // 비워두면 이 브라우저(localStorage)에만 기록이 저장됩니다.
  BACKEND_URL: "",

  // 로컬 모드에서 기록 초기화·삭제 시 사용하는 관리자 비밀번호.
  // 정적 파일이라 소스 보기로 누구나 볼 수 있으므로 강한 보안이 아닙니다.
  // 공유 모드(BACKEND_URL 사용)에서는 Apps Script의 스크립트 속성 ADMIN_PASSWORD가 쓰입니다.
  LOCAL_ADMIN_PASSWORD: "admin",

  // 배정 개수
  N_ATC: 1,
  N_SMQ: 3,

  // true면 ATC 계열이 모두 소진될 때까지 학생 간 중복 배정하지 않음
  UNIQUE_ATC: true,
};
