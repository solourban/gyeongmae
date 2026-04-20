# 경매AI 권리분석 — v2 (Puppeteer 기반)

## 🔧 v1에서 달라진 점

Playwright가 Vercel 서버리스에서 자꾸 터져서 **Puppeteer + @sparticuz/chromium**으로 바꿨습니다. 2024-2025년 기준 Vercel에서 가장 검증된 조합이에요.

`browserType.launch: Target page, context or browser has been closed` 에러가 났던 건 이 조합이 안 맞았기 때문입니다.

---

## 🚀 설치 & 배포 (수정됨)

### 1단계: 로컬 테스트

```bash
cd auction-web

# 기존 node_modules 있으면 먼저 삭제 (v1에서 넘어오는 경우)
rm -rf node_modules package-lock.json

# 새로 설치
npm install

# Puppeteer가 자체 Chrome을 다운로드 (1~2분)
# 이 과정은 자동으로 진행됩니다

# 개발 서버 실행
npm run dev
```

http://localhost:3000 에서 테스트. **로컬에서 되면 배포도 90% 성공**이에요.

### 2단계: GitHub 푸시

```bash
git init
git add .
git commit -m "v2: puppeteer migration"
git branch -M main
git remote add origin https://github.com/YOUR/auction-web.git
git push -u origin main
```

> 이미 v1으로 푸시했다면:
> ```bash
> git add -A
> git commit -m "migrate to puppeteer"
> git push
> ```

### 3단계: Vercel 재배포

1. Vercel 대시보드 → 해당 프로젝트 → **Settings**
2. **General → Node.js Version** → **20.x** 선택 (18.x 아니고 20.x!)
3. **Save**
4. **Deployments** 탭 → 최신 배포 → **⋯ Redeploy** 클릭

> v1에서 실패했던 배포라면 새 커밋이 자동으로 트리거되니까 기다리면 됩니다.

### 4단계: 확인

배포 완료 후:
- `https://your-app.vercel.app/api/analyze` 접속 → `{"ok":true,"message":"..."}` 나오면 정상
- 메인 페이지에서 사건번호 테스트

---

## 🛠 여전히 에러가 뜬다면

### 에러 A: "Function execution timed out"
- Vercel Hobby 플랜은 60초 제한. 크롤링 자체가 40~55초 걸림
- **해결**: `vercel.json`에 이미 `maxDuration: 60` 설정돼있음. 그래도 안 되면:
  - 관심 물건 먼저 한 번 분석해서 결과를 저장해두는 방식으로 재설계 필요
  - 또는 Vercel Pro 플랜 ($20/월) — 300초까지 허용

### 에러 B: "libnss3.so: cannot open shared object file"
- Node 버전 문제. Vercel Settings에서 **Node.js Version을 20.x**로 바꾸세요.

### 에러 C: "Cannot find module '@sparticuz/chromium'"
- Vercel 캐시 문제. Settings → **General → Clear Build Cache** 후 Redeploy

### 에러 D: 여전히 "browser has been closed"
- `@sparticuz/chromium` 버전을 **131.x**로 고정했습니다 (package.json). 혹시 더 최신이 나와 있어도 자동 업그레이드 되지 않도록 `^` 대신 정확한 버전(`131.0.1` 등)을 쓰려면 package.json 수정

### 에러 E: 분석은 끝났는데 결과가 텅 비어있음
- 대법원 사이트 HTML 구조가 바뀐 것일 가능성이 큼
- Vercel → Deployments → Function Logs에서 **실제 HTML**을 확인 (crawler.ts에 `console.log(html)` 임시 추가 후 재배포)
- 저한테 그 HTML 보여주시면 파싱 로직 고쳐드림

---

## 📊 정상 동작 시 흐름

1. 사용자가 사건번호 입력 → 분석 시작 클릭
2. Next.js가 `/api/analyze`로 POST 요청
3. 서버리스 함수가 Puppeteer로 Chromium 실행
4. 대법원 사이트 접속 → 사건 목록 → 상세 페이지로 자동 이동
5. HTML 긁어서 cheerio로 파싱
6. 권리분석 엔진이 말소기준·인수소멸·대항력·배당 계산
7. JSON 응답 → 프론트에서 렌더링

**총 소요시간: 로컬 10~20초 / Vercel 30~50초**

---

## 💡 현실적인 기대치

- **개인 사용**: 완벽하게 됩니다. 본인 포함 5명 이하면 Vercel 무료로 충분
- **카페 수십 명 사용**: Vercel 무료 한계에 근접. 결과 캐싱 기능 추가 필요
- **수백 명 동시 사용**: Vercel Pro + Redis 캐싱 + 큐잉 필요 (이 단계면 돈 받고 서비스 해야 함)

## 📦 파일 구조

```
auction-web/
├── app/
│   ├── api/analyze/route.ts   ← API (크롤링 + 분석 호출)
│   ├── page.tsx               ← UI
│   ├── layout.tsx
│   └── globals.css
├── lib/
│   ├── crawler.ts             ← Puppeteer 크롤러
│   └── analyzer.ts            ← 권리분석 로직
├── package.json
├── next.config.js
├── vercel.json
└── tsconfig.json
```

---

## 추가로 필요한 것

에러 발생 시 **Vercel 대시보드 → Deployments → 해당 배포 → Functions → `/api/analyze`** 클릭하면 상세 로그 볼 수 있어요. 거기서:

1. 어느 단계에서 멈췄는지
2. 구체적인 에러 메시지
3. HTML이 어떻게 생겼는지

스크린샷 찍어서 주시면 바로 고쳐드립니다.
