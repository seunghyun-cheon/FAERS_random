# FAERS 실습 과제 무작위 배정

학생마다 ATC 4단계 약물계열 1개 + SMQ 3개를 무작위 배정하고, 학번·이름·배정 결과·시각을 기록합니다.

- 후보군: `data/FAERS_ATC_SMQ_pool.xlsx` (ATC 40개, SMQ 30개) → `data.js` (`python3 scripts/build_data.py`로 재생성)
- 같은 학번은 한 번만 배정됩니다(재접속 시 기존 결과 표시). 다시 뽑게 하려면 관리자 모드에서 해당 행을 삭제.
- `UNIQUE_ATC: true`(기본값)이면 ATC 40개가 모두 배정될 때까지 학생 간 ATC 계열이 겹치지 않습니다. SMQ는 학생 내에서만 중복 없음(학생 간 중복 허용).
- 관리자 모드(비밀번호): 기록 전체 초기화, 개별 삭제. CSV 저장은 누구나 가능.
- 설정은 `config.js`.

## 저장 방식

| 모드 | 설정 | 기록 위치 |
|---|---|---|
| 로컬(기본) | `BACKEND_URL: ""` | 접속한 브라우저의 localStorage. 교수자 PC 한 대에서 학생이 돌아가며 뽑는 방식에 적합. 다른 기기와 공유 안 됨. |
| 공유 | `BACKEND_URL`에 Apps Script URL | Google 스프레드시트. 학생이 각자 휴대폰으로 접속해도 기록이 한곳에 모임. |

### 공유 기록 설정 (Google Apps Script)

1. Google 스프레드시트 새로 만들기 → 확장 프로그램 → Apps Script
2. `apps-script/Code.gs` 내용을 붙여넣고 저장
3. 프로젝트 설정 → 스크립트 속성 → `ADMIN_PASSWORD` 추가(관리자 비밀번호)
4. 배포 → 새 배포 → 유형 "웹 앱", 실행 계정 "나", 액세스 권한 "모든 사용자" → 배포 후 URL 복사
5. `config.js`의 `BACKEND_URL`에 URL 입력 후 커밋

공유 모드에서는 무작위 추출과 중복 확인을 서버(Apps Script)에서 잠금(LockService)을 걸고 수행하므로, 여러 학생이 동시에 눌러도 같은 학번이 두 번 기록되거나 ATC가 겹치지 않습니다.

## 배포 (GitHub Pages)

Settings → Pages → Source: "Deploy from a branch" → 이 파일들이 있는 브랜치 / root 선택.
