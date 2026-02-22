# WhaleArc Frontend

WhaleArc 프론트엔드 애플리케이션입니다.

## 기술 스택

- **React 19** - UI 라이브러리
- **TypeScript** - 타입 안정성
- **Vite** - 빌드 도구
- **Tailwind CSS** - 스타일링
- **React Router** - 라우팅
- **Recharts** - 차트 라이브러리
- **Axios** - HTTP 클라이언트

## 시작하기

### 설치

```bash
npm install
```

### 환경 변수 설정

`.env.example` 파일을 참고하여 `.env` 파일을 생성하세요:

```bash
cp .env.example .env
```

### 개발 서버 실행

```bash
npm run dev
```

개발 서버는 기본적으로 `http://localhost:5173`에서 실행됩니다.

### 빌드

```bash
npm run build
```

빌드된 파일은 `dist` 폴더에 생성됩니다.

## 프로젝트 구조

```
src/
├── components/       # 재사용 가능한 컴포넌트
│   └── Header.tsx   # 헤더 컴포넌트
├── pages/           # 페이지 컴포넌트
│   ├── LandingPage.tsx
│   ├── LoginPage.tsx
│   └── DashboardPage.tsx
├── services/        # API 서비스
│   └── authService.ts
├── utils/           # 유틸리티 함수
│   └── api.ts       # Axios 설정
├── App.tsx          # 메인 앱 컴포넌트
└── main.tsx         # 진입점
```

## 주요 기능

- ✅ 랜딩 페이지 (고래 일러스트, 기능 소개)
- ✅ 로그인 페이지 (로그인 폼 + 실시간 시장 데이터)
- ✅ 대시보드 페이지 (주식 리스트 + 차트)
- ✅ JWT 인증 연동 준비
- ✅ 반응형 디자인

## 백엔드 연동

백엔드 API는 기본적으로 `http://localhost:8080`에서 실행됩니다.
환경 변수 `VITE_API_BASE_URL`로 변경할 수 있습니다.

## 디자인 시스템

### 색상

- **Whale Dark**: `#1a2b4d` - 다크 블루 (헤더, 메인 섹션)
- **Whale Light**: `#4a90e2` - 라이트 블루 (강조 색상)
- **Whale Accent**: `#5ba3f5` - 강조 블루 (호버 효과)

### 컴포넌트

- `btn-primary`: 주요 버튼 스타일
- `btn-secondary`: 보조 버튼 스타일
- `card`: 카드 컨테이너 스타일
