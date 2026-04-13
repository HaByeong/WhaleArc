# WhaleArc 서버 배포 가이드

WhaleArc(프론트엔드 + 백엔드)를 서버에 올리는 방법입니다.

> **현재 운영 방식**: 단일 VPS에 prod(8080) + test(8081) 백엔드를 동시 기동하고, Nginx가 `whale-arc.com` / `test.whale-arc.com` 서브도메인으로 라우팅합니다. 배포는 GitHub Actions가 `main`/`test` 브랜치 push를 받아 자동 수행합니다. 상세 흐름은 [GIT_TEAM_SETUP.md](GIT_TEAM_SETUP.md) 4-1절 참고.
>
> 아래 "방법 1/2"는 역사적/대안 가이드이며 실제 운영은 "현재 운영 방식 상세" 섹션을 따릅니다.

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

---

## 현재 운영 방식 상세 (prod + test 이중 환경)

### VPS 디렉터리 구조 (가정)

```
/opt/whalearc/
├── prod/app.jar           ← 백엔드 JAR (prod)
└── test/app.jar           ← 백엔드 JAR (test)

/var/www/
├── whalearc-prod/         ← 프론트 dist (prod)
└── whalearc-test/         ← 프론트 dist (test)

/etc/whalearc/
├── prod.env               ← 백엔드 환경 변수 (prod)
└── test.env               ← 백엔드 환경 변수 (test)
```

### systemd unit 예시 — `/etc/systemd/system/whalearc-prod.service`

```ini
[Unit]
Description=WhaleArc Backend (prod)
After=network.target mongod.service

[Service]
Type=simple
User=whalearc
EnvironmentFile=/etc/whalearc/prod.env
Environment=SPRING_PROFILES_ACTIVE=prod
ExecStart=/usr/bin/java -jar /opt/whalearc/prod/app.jar
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### systemd unit 예시 — `/etc/systemd/system/whalearc-test.service`

```ini
[Unit]
Description=WhaleArc Backend (test)
After=network.target mongod.service

[Service]
Type=simple
User=whalearc
EnvironmentFile=/etc/whalearc/test.env
Environment=SPRING_PROFILES_ACTIVE=test
Environment=PORT=8081
ExecStart=/usr/bin/java -jar /opt/whalearc/test/app.jar
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

`/etc/whalearc/prod.env` 와 `test.env` 파일은 권한 `600`, 소유자 `whalearc:whalearc`. 내용 예시:

```
# /etc/whalearc/prod.env
JWT_SECRET_KEY=<랜덤 32자 이상>
VIRT_ENCRYPTION_KEY=<랜덤 32자 이상>
MONGODB_URI=mongodb://localhost:27017/whaleArc
CORS_ALLOWED_ORIGINS=https://whale-arc.com,https://api.whale-arc.com
SUPABASE_JWKS_URI=https://tkkbawoknwumqdqxypwd.supabase.co/auth/v1/.well-known/jwks.json
```

```
# /etc/whalearc/test.env
JWT_SECRET_KEY=<prod와 다른 랜덤 값>
VIRT_ENCRYPTION_KEY=<prod와 다른 랜덤 값>
MONGODB_URI=mongodb://localhost:27017/whaleArc_test
CORS_ALLOWED_ORIGINS=https://test.whale-arc.com
SUPABASE_JWKS_URI=https://ivcentmbrxqebqtjsnsj.supabase.co/auth/v1/.well-known/jwks.json
```

활성화:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now whalearc-prod whalearc-test
```

### Nginx server block — `/etc/nginx/sites-available/whale-arc.com`

```nginx
server {
    listen 443 ssl http2;
    server_name whale-arc.com;

    ssl_certificate     /etc/letsencrypt/live/whale-arc.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/whale-arc.com/privkey.pem;

    root /var/www/whalearc-prod;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
    }
}
```

### Nginx server block — `/etc/nginx/sites-available/test.whale-arc.com`

```nginx
server {
    listen 443 ssl http2;
    server_name test.whale-arc.com;

    ssl_certificate     /etc/letsencrypt/live/test.whale-arc.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/test.whale-arc.com/privkey.pem;

    root /var/www/whalearc-test;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws/ {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
    }
}
```

> **Cloudflare Proxied(주황 구름)** 상태에서는 Let's Encrypt HTTP-01 challenge가 실패할 수 있습니다. 다음 중 하나 선택:
> - Certbot DNS-01 challenge (Cloudflare API 토큰 사용)
> - 인증서 발급 동안 잠시 Proxy 끄기(회색 구름) → 발급 완료 후 다시 켜기
> - Cloudflare Origin Certificate 발급해서 VPS에 설치 (15년 유효, 권장)

### GitHub Secrets (Repo Settings → Secrets and variables → Actions)

| Secret | 설명 |
|--------|------|
| `VPS_SSH_HOST` | VPS 공인 IP 또는 호스트명 |
| `VPS_SSH_USER` | SSH 사용자 (예: `whalearc` 또는 `ubuntu`) |
| `VPS_SSH_KEY` | Ed25519 개인키 전체 내용 (GitHub Actions 전용으로 새로 발급해서 VPS `~/.ssh/authorized_keys`에 공개키 등록) |
| `PROD_SUPABASE_URL` | `https://tkkbawoknwumqdqxypwd.supabase.co` |
| `PROD_SUPABASE_ANON_KEY` | prod Supabase anon/publishable key |
| `TEST_SUPABASE_URL` | `https://ivcentmbrxqebqtjsnsj.supabase.co` |
| `TEST_SUPABASE_ANON_KEY` | test Supabase publishable key |

배포 워크플로우 파일:
- [.github/workflows/ci.yml](.github/workflows/ci.yml) — PR/push 시 빌드+테스트 검증
- [.github/workflows/deploy-test.yml](.github/workflows/deploy-test.yml) — `test` push 시 자동 배포
- [.github/workflows/deploy-prod.yml](.github/workflows/deploy-prod.yml) — `main` push 시 자동 배포

### 필요한 VPS sudoers 설정

GitHub Actions 배포 시 `systemctl restart`와 `nginx reload`를 암호 없이 실행하려면:

```
# /etc/sudoers.d/whalearc-deploy
whalearc ALL=(ALL) NOPASSWD: /bin/systemctl restart whalearc-prod, /bin/systemctl restart whalearc-test, /bin/systemctl reload nginx
```

(`whalearc`는 `VPS_SSH_USER` 값에 맞춰 변경)
