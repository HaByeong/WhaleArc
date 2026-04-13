# GitHub 팀(Organization) 만들고 WhaleArc 설정하기

친구와 함께 WhaleArc을 만들기 위해 **GitHub Organization(팀)** 을 만드는 방법입니다.

---

## 🚀 지금 바로 하기 (이미 WhaleArc 레포 있음)

아래 **3단계**만 하면 팀 프로젝트 완료입니다.

| 순서 | 할 일 | 링크/위치 |
|------|--------|-----------|
| **1** | Organization(팀) 만들기 | [GitHub → Settings → Organizations](https://github.com/settings/organizations) → **New organization** |
| **2** | 저장소를 팀으로 이전 | [WhaleArc 레포 Settings](https://github.com/HaByeong/WhaleArc/settings) → 맨 아래 **Danger Zone** → **Transfer ownership** → 새로 만든 팀 이름 입력 |
| **3** | 친구 초대 | 팀 페이지 → **People** → **Invite member** → 친구 GitHub 아이디 입력 |

이전 후 로컬에서 한 번만 원격 주소 갱신 (팀 이름이 `WhaleArc` 라면):

```bash
git remote set-url origin git@github.com:WhaleArc/WhaleArc.git
git fetch
```

---

## 1. GitHub Organization(팀) 만들기 (상세)

1. GitHub 로그인 후 우측 상단 프로필 클릭 → **Settings**
2. 왼쪽 맨 아래 **Organizations** → **New organization**
3. **Create a free organization** 선택
4. Organization name 입력 (예: `WhaleArc` 또는 `whalearc-team`)
5. 연락처 이메일 선택 후 **Next** → **Complete setup**

---

## 2. 팀 저장소에 지금 코드 넣기

지금 로컬 구조는 아래처럼 되어 있습니다.

```
whaleArc/
├── backend/      ← Spring Boot 백엔드
├── frontend/     ← React 프론트엔드
├── images/
├── README.md
└── GIT_TEAM_SETUP.md
```

### 방법 A: 새 Organization에 새 저장소 만들고 push

1. Organization 페이지 → **Repositories** → **New repository**
2. Repository name: `WhaleArc` (또는 `whalearc`)
3. **Public** 선택, README나 .gitignore 추가하지 말고 **Create repository**
4. 로컬에서 원격을 팀 저장소로 바꾼 뒤 push:

```bash
cd /Users/hanyang/Desktop/whaleArc

# 원격을 팀 계정의 새 저장소로 변경 (본인 Organization 이름에 맞게 수정)
git remote set-url origin git@github.com:YOUR_ORG_NAME/WhaleArc.git

git add .
git commit -m "chore: 팀 설정 가이드 추가"
git push -u origin main
```

`YOUR_ORG_NAME` 자리에 만든 Organization 이름(예: `WhaleArc`, `whalearc-team`)을 넣으면 됩니다.

### 방법 B: 이미 있는 개인 WhaleArc 저장소를 Organization으로 옮기기

1. 개인 계정의 **WhaleArc** 저장소 → **Settings**
2. 맨 아래 **Danger Zone** → **Transfer ownership**
3. **New owner**에 만든 Organization 이름 입력 후 이전
4. 이전 후에는 원격 URL이 `https://github.com/ORG_NAME/WhaleArc` 형태가 됩니다.
5. 로컬에서 push:

```bash
git add .
git commit -m "chore: 팀 설정 가이드 추가"
git push origin main
```

---

## 3. 친구를 팀(Organization)에 초대하기

1. Organization 페이지 → **People** → **Invite member**
2. 친구 GitHub 아이디 또는 이메일 입력 → **Invite**
3. 친구가 초대 수락하면 같은 저장소를 clone해서 함께 작업할 수 있습니다.

친구가 clone할 주소 예시:

```bash
git clone git@github.com:YOUR_ORG_NAME/WhaleArc.git
```

---

## 4. 작업할 때

- **백엔드**: `backend/` 에서 실행 (`./gradlew bootRun`)
- **프론트엔드**: `frontend/` 에서 실행 (`npm run dev`)

---

## 4-1. 브랜치 전략 (베타 종료 이후)

### 브랜치 구조

| 브랜치 | 역할 | 자동 배포 대상 |
|--------|------|----------------|
| `main` | 운영 (prod) | `https://whale-arc.com` |
| `test` | 통합 스테이징 | `https://test.whale-arc.com` |
| `feat/*`, `fix/*`, `test-kh`, `test-bh` | 개인 작업 브랜치 | 배포 없음 |
| `hotfix/*` | prod 긴급 수정 | main 머지 시 prod 자동 배포 |

### 일반 작업 흐름

```
1. test 브랜치에서 분기
   git checkout test && git pull
   git checkout -b feat/어쩌구

2. 작업 → 커밋 → push
   git push -u origin feat/어쩌구

3. GitHub에서 feat/어쩌구 → test 로 PR 올리고 셀프리뷰 → 머지
   → test.whale-arc.com 에 자동 배포됨

4. test 서버에서 확인 후 문제 없으면
   GitHub에서 test → main 으로 PR 올리고 머지
   → whale-arc.com 에 자동 배포됨

5. 개인 브랜치는 머지 후 삭제 (장기 유지 금지 — 머지 지옥 방지)
```

### Hotfix (prod 긴급 수정)

```
1. main 에서 분기
   git checkout main && git pull
   git checkout -b hotfix/짧은이름

2. 최소 수정 → PR → main 머지 → 자동 prod 배포

3. 반드시 main → test 역머지 (test가 뒤처지지 않게)
   git checkout test && git pull
   git merge main && git push
```

### 브랜치 보호 규칙 (GitHub → Settings → Branches)

- `main`: PR 필수, CI 통과 필수, 직접 push 금지
- `test`: PR 필수, CI 통과 필수

### 피해야 할 것

- `main`에 직접 push (실수 원인 1순위)
- `test-kh`/`test-bh`를 수개월 장기 유지 (머지 충돌 폭탄)
- `test`를 건너뛰고 개인 브랜치 → `main` 직행 (hotfix 제외)

---

## 4-2. 환경 분리

| 구분 | prod | test |
|------|------|------|
| 도메인 | `whale-arc.com`, `api.whale-arc.com` | `test.whale-arc.com` |
| 백엔드 포트 | 8080 | 8081 |
| MongoDB DB명 | `whaleArc` | `whaleArc_test` |
| Supabase 프로젝트 | `tkkbawoknwumqdqxypwd` | `ivcentmbrxqebqtjsnsj` |
| Spring profile | `prod` | `test` |
| Frontend 빌드 | `npm run build:prod` | `npm run build:test` |
| systemd service | `whalearc-prod` | `whalearc-test` |

**중요**: test 환경에서 만든 사용자 계정으로 prod에 로그인할 수 없습니다 (Supabase 프로젝트가 완전 분리됨). prod 사용자 데이터를 건드릴 위험 없이 test에서 자유롭게 실험 가능합니다.

---

## 5. 팀만 보는 문서 (외부에 안 보이게)

다음 경로는 **`.gitignore`에 있어서 GitHub에 올라가지 않습니다.** 팀원만 로컬에서 볼 수 있습니다.

| 경로 | 용도 |
|------|------|
| **INTERNAL_README.md** | 팀 내부용 메모, 회의록, 규칙 등 |
| **docs/** 폴더 | 비공개 문서 모음 |
| **\*.internal.md** | 이름이 `.internal.md`로 끝나는 마크다운 파일 |

이 파일/폴더에 적은 내용은 push 해도 원격에 올라가지 않으므로 외부에 노출되지 않습니다.
