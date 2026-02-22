# GitHub 팀(Organization) 만들고 WhaleArc 설정하기

친구와 함께 WhaleArc을 만들기 위해 **GitHub Organization(팀)** 을 만들고, **웹 / 앱** 구조로 저장소를 쓰는 방법입니다.

---

## 1. GitHub Organization(팀) 만들기

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
├── web/          ← 지금 만든 웹 (frontend + backend + images)
├── app/          ← 모바일 앱용 (나중에 추가)
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
git commit -m "chore: web/app 구조로 정리, 팀 설정 가이드 추가"
git push -u origin main
```

`YOUR_ORG_NAME` 자리에 만든 Organization 이름(예: `WhaleArc`, `whalearc-team`)을 넣으면 됩니다.

### 방법 B: 이미 있는 개인 WhaleArc 저장소를 Organization으로 옮기기

1. 개인 계정의 **WhaleArc** 저장소 → **Settings**
2. 맨 아래 **Danger Zone** → **Transfer ownership**
3. **New owner**에 만든 Organization 이름 입력 후 이전
4. 이전 후에는 원격 URL이 `https://github.com/ORG_NAME/WhaleArc` 형태가 됩니다.
5. 로컬에서 web/app 구조로 정리한 뒤 push:

```bash
git add .
git commit -m "chore: web/app 구조로 정리, 팀 설정 가이드 추가"
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

## 4. 웹 / 앱 폴더에서 작업할 때

- **웹(지금 만든 것)**: `web/` 안에서 작업  
  - 백엔드: `web/backend/`  
  - 프론트: `web/frontend/`
- **앱**: 나중에 `app/` 안에 모바일 프로젝트 추가

필요하면 `web/README.md`, `app/README.md`에 각각 실행 방법·개발 규칙을 적어 두면 됩니다.
