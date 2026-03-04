# WhaleArc 서버 배포 가이드

WhaleArc(프론트엔드 + 백엔드)를 서버에 올리는 방법입니다.

---

## 배포 전 준비사항

| 항목 | 설명 |
|------|------|
| **백엔드** | Java 17, Spring Boot, **MongoDB** 필요 |
| **프론트엔드** | 빌드된 정적 파일만 있으면 됨 (Nginx, Vercel 등으로 서빙) |
| **환경 변수** | `JWT_SECRET_KEY`(백엔드), `VITE_API_BASE_URL`(프론트 빌드 시) |

---

## 방법 1: PaaS로 빠르게 배포 (추천)

서버를 직접 관리하지 않고, 프론트/백엔드를 각각 호스팅하는 방식입니다.

### 1-1. 백엔드 배포 (Railway / Render / Fly.io 등)

1. **MongoDB Atlas** (무료 티어)
   - [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) 가입 후 클러스터 생성
   - Connect → "Drivers" → Connection String 복사 (예: `mongodb+srv://user:pass@cluster.mongodb.net/whaleArc`)

2. **Railway** 예시 (Spring Boot 배포)
   - [Railway](https://railway.app) 가입
   - New Project → Deploy from GitHub → 이 레포 선택 후 **backend** 루트를 선택 (또는 backend 폴더만 배포 가능한 경우 해당 설정)
   - Variables에 추가:
     - `JWT_SECRET_KEY`: 32자 이상 랜덤 문자열 (예: `openssl rand -base64 32`)
     - `SPRING_PROFILES_ACTIVE`: `prod`
     - `MONGODB_URI` 또는 `spring.data.mongodb.uri`: Atlas 연결 문자열
   - 배포 후 나오는 URL 확인 (예: `https://whalearc-backend.up.railway.app`)

3. **Render** 사용 시
   - Build Command: `cd backend && ./gradlew bootJar`
   - Start Command: `java -jar backend/build/libs/whalearc-0.0.1-SNAPSHOT.jar`
   - Environment에 `JWT_SECRET_KEY`, `SPRING_PROFILES_ACTIVE=prod`, MongoDB URI 설정

### 1-2. 프론트엔드 배포 (Vercel / Netlify)

1. **빌드 시 API 주소 지정**
   - 배포 사이트에서 빌드 설정 시 **Environment Variable** 추가:
     - `VITE_API_BASE_URL` = 백엔드 URL (예: `https://whalearc-backend.up.railway.app`)
   - Vite는 빌드 시점에 이 값을 프론트 코드에 박기 때문에, 반드시 설정 후 빌드해야 합니다.

2. **Vercel**
   - GitHub 연동 후 프로젝트 선택, **Root Directory**를 `frontend`로 설정
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Environment Variables에 `VITE_API_BASE_URL` 추가 후 Deploy

3. **Netlify**
   - Root: `frontend`, Build command: `npm run build`, Publish directory: `frontend/dist`
   - Site settings → Environment variables에 `VITE_API_BASE_URL` 추가

배포 후 프론트 URL(예: `https://whalearc.vercel.app`)에서 로그인/회원가입이 백엔드와 통신하는지 확인하세요.

---

## 방법 2: VPS(우분투 등)에 직접 배포

서버 한 대에 Nginx + Spring Boot + MongoDB를 모두 두는 방식입니다.

### 2-1. 서버 준비

```bash
# Java 17 설치
sudo apt update && sudo apt install -y openjdk-17-jdk

# MongoDB 설치 (또는 MongoDB Atlas 사용 시 생략)
# https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-ubuntu/
```

### 2-2. 백엔드 실행

```bash
cd /path/to/whaleArc/backend
./gradlew bootJar
# JAR 위치: build/libs/whalearc-0.0.1-SNAPSHOT.jar

# 환경 변수 설정 후 실행
export JWT_SECRET_KEY="여기에_32자_이상_시크릿"
export SPRING_PROFILES_ACTIVE=prod
# MongoDB가 로컬이 아니면:
export MONGODB_URI="mongodb+srv://..."

java -jar build/libs/whalearc-0.0.1-SNAPSHOT.jar
```

systemd로 서비스 등록하면 재부팅 후에도 자동 실행됩니다.

### 2-3. 프론트엔드 빌드 및 Nginx로 서빙

```bash
cd /path/to/whaleArc/frontend
export VITE_API_BASE_URL=https://api.내도메인.com   # 또는 같은 서버면 http://localhost:8080
npm ci && npm run build
# 빌드 결과: frontend/dist/
```

Nginx 설정 예시 (프론트는 정적 파일, /api 요청만 백엔드로 프록시):

```nginx
server {
    listen 80;
    server_name 내도메인.com;
    root /path/to/whaleArc/frontend/dist;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
    location /auth/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /users/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

이 경우 프론트 빌드 시 `VITE_API_BASE_URL`을 `https://내도메인.com` 또는 `https://api.내도메인.com` 같이 실제 접속 주소로 맞추면 됩니다.

---

## 프로덕션 환경 변수 정리

### 백엔드 (Spring Boot)

| 변수 | 설명 | 예시 |
|------|------|------|
| `SPRING_PROFILES_ACTIVE` | 프로파일 | `prod` |
| `JWT_SECRET_KEY` | JWT 서명용 시크릿 (32자 이상) | 랜덤 문자열 |
| `CORS_ALLOWED_ORIGINS` | 프론트엔드 접속 URL (쉼표 구분 복수 가능) | `https://whalearc.vercel.app` |
| `MONGODB_URI` 또는 `spring.data.mongodb.uri` | MongoDB 연결 문자열 | `mongodb+srv://...` (Atlas) 또는 `mongodb://localhost:27017/whaleArc` |

### 프론트엔드 (빌드 시 한 번만)

| 변수 | 설명 | 예시 |
|------|------|------|
| `VITE_API_BASE_URL` | 백엔드 API 주소 | `https://whalearc-api.example.com` |

---

## 체크리스트

- [ ] MongoDB 준비 (Atlas 또는 서버에 설치)
- [ ] 백엔드 `application-prod.yml` / 환경 변수 설정 (JWT 시크릿, MongoDB URI)
- [ ] 백엔드 CORS에 프론트 도메인 포함 (이미 프로젝트에 설정됨)
- [ ] 프론트 빌드 시 `VITE_API_BASE_URL` 설정
- [ ] 배포 후 로그인/회원가입/토큰 재발급 동작 확인

이 가이드대로 하시면 WhaleArc을 서버에 올려서 외부에서 접속할 수 있습니다. 특정 플랫폼(Railway, Vercel 등)으로 할 때 단계가 더 필요하면 그 플랫폼 이름을 알려주시면 그에 맞춰 정리해 드리겠습니다.
