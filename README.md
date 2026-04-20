# 경매AI 권리분석 — Vercel 배포 가이드

사건번호만 입력하면 대법원 경매정보에서 실시간으로 데이터를 가져와
권리분석해주는 웹 서비스입니다. **뉴옥션과 같은 방식**으로 작동합니다.

## 🎯 완성 후 모습

- 주소: `https://yourname.vercel.app` (무료 제공)
- 기능: 사건번호 + 법원 선택 → 분석 결과 즉시 표시
- 비용: **0원** (Vercel 무료 티어 / GitHub 무료)

## 📦 폴더 구조

```
auction-web/
├── app/
│   ├── api/analyze/route.ts   ← 서버리스 함수 (크롤링 API)
│   ├── components/            ← (UI 컴포넌트 폴더)
│   ├── page.tsx               ← 메인 페이지
│   ├── layout.tsx             ← 레이아웃
│   └── globals.css            ← 스타일
├── lib/
│   ├── crawler.ts             ← Playwright 크롤러
│   └── analyzer.ts            ← 권리분석 로직
├── package.json
├── next.config.js
├── vercel.json
├── tsconfig.json
└── .gitignore
```

---

## 🚀 배포 5단계

### 1단계: Node.js 설치 (한 번만)
이미 설치돼 있으면 스킵. 버전 확인:
```bash
node --version   # v18 이상이면 OK
```
없으면 https://nodejs.org 에서 **LTS 버전** 다운로드 후 설치.

### 2단계: 로컬에서 먼저 테스트
```bash
# 1) 이 폴더로 이동
cd auction-web

# 2) 패키지 설치 (2~3분 걸림)
npm install

# 3) Playwright 브라우저 설치
npx playwright install chromium

# 4) 개발 서버 실행
npm run dev
```
브라우저에서 http://localhost:3000 접속 → 사건번호 테스트 해보기.

> **로컬에서 동작 확인되면 이제 배포해도 됩니다!**

### 3단계: GitHub에 올리기

#### 3-1. GitHub 저장소 만들기
1. https://github.com/new 접속
2. Repository name: `auction-web` (원하는 이름)
3. **Private**로 설정 (크롤링 코드가 공개되면 곤란)
4. **Create repository** 클릭

#### 3-2. 코드 푸시
프로젝트 폴더에서 명령어 실행:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/auction-web.git
git push -u origin main
```
> `YOUR-USERNAME`은 본인 깃허브 아이디로 바꾸세요.

### 4단계: Vercel에 배포

1. https://vercel.com 접속 → **GitHub 계정으로 로그인** (처음이면 가입)
2. 대시보드에서 **"Add New... → Project"** 클릭
3. Import Git Repository 섹션에서 방금 만든 **`auction-web`** 저장소 찾아 **Import** 클릭
4. 설정 화면:
   - **Framework Preset**: `Next.js` (자동으로 잡힙니다)
   - **Build Command**: 건드리지 마세요
   - **Environment Variables**: 비워두기
5. **Deploy** 버튼 클릭

3~5분 기다리면 배포 완료. **`https://auction-web-xxx.vercel.app`** 같은 주소가 생깁니다.

### 5단계: 커스텀 도메인 (선택)
Vercel 대시보드 → 프로젝트 → **Settings → Domains**에서 원하는 주소 설정 가능. 
- 무료: `your-name.vercel.app`
- 본인 도메인 연결도 가능 (도메인 따로 구매 필요)

---

## ⚠️ 알고 있어야 할 것

### Vercel 무료 티어 제한
- 서버리스 함수 실행 시간: **60초/요청** (크롤링이 30초 정도 걸려서 아슬아슬함)
- 월 실행시간: **100 GB-Hours** (하루 수백 건 분석해도 충분)
- 대역폭: **100GB/월**

### 크롤링 안정성
- 대법원 사이트 HTML 구조가 가끔 바뀝니다 → 파싱이 깨질 수 있어요
- 파싱 깨지면 `lib/crawler.ts`의 `parseDetail()` 함수를 수정해야 함
- 이런 경우 저한테 다시 스크린샷과 에러 메시지 주시면 바로 고쳐드림

### 크롤링 차단 방지
- 대법원 사이트가 같은 IP에서 너무 많은 요청을 보면 차단할 수 있음
- Vercel은 요청마다 다른 IP로 나가기 때문에 **단일 사용자**로는 거의 안전
- 카페에 공유해서 **수백 명이 동시에 쓰면** 차단될 수도 있음
- 만약 그렇게 되면:
  - 옵션 A: 요청 간 딜레이 추가 (`lib/crawler.ts`에 `setTimeout` 삽입)
  - 옵션 B: 결과 캐싱 (같은 사건번호는 24시간 동안 재사용)

---

## 🔧 문제 해결

### "npm install 실패"
- Node 버전이 너무 낮을 수 있어요. `node --version`으로 확인 → v18 이상 필수
- Windows에서는 관리자 권한 cmd로 실행

### "Playwright 설치 안 돼요"
```bash
npx playwright install chromium --with-deps
```
그래도 안 되면 관리자 권한으로 실행

### "Vercel 배포에서 에러"
- Build logs 확인 (Vercel 대시보드에서 볼 수 있음)
- 가장 흔한 원인: `@sparticuz/chromium` 버전 불일치
- 해결: Vercel에서 Node.js 버전을 **18.x** 또는 **20.x**로 고정
  - Settings → General → Node.js Version

### "크롤링은 되는데 파싱이 이상해요"
1. 브라우저에서 `https://yourname.vercel.app/api/analyze` 호출했을 때 반환된 JSON 확인
2. `rights` 또는 `tenants` 배열이 비어 있다면 HTML 구조가 바뀐 것
3. 대법원 사이트 원본을 보고 `parseDetail()` 함수의 정규식·테이블 매칭 로직을 조정

---

## 🎁 나중에 해볼 만한 확장

1. **Claude API 연동**: 분석 결과에 "이 물건의 특이사항"을 자연어로 추가
   - Vercel Environment Variable에 `ANTHROPIC_API_KEY` 추가
   - `/api/explain` 라우트 추가
2. **결과 캐싱**: Vercel KV (Redis) 써서 같은 사건 재조회 빠르게
3. **즐겨찾기**: 사용자가 관심 사건 저장 → localStorage
4. **알림**: 특정 사건의 매각기일 다가올 때 이메일
5. **PDF 리포트 다운로드**: `/api/report/[case]/pdf`

---

## 📞 문제가 생기면

1. 먼저 `vercel dev` 또는 `npm run dev`로 로컬에서 재현해보기
2. Vercel 대시보드 → Deployments → 해당 배포 → **Function Logs** 확인
3. 에러 메시지와 스크린샷을 저한테 던지시면 바로 고쳐드립니다

---

## 🙏 마지막으로

이 프로젝트는 **학습·개인 사용 목적**으로 만들어졌습니다.
- 대법원 경매정보는 공공데이터이지만 상업적 이용은 약관 검토 필요
- 분석 결과는 참고용이며 실제 입찰 전에는 원본 서류 필수 확인
- 문제 생기면 폴리독님 본인이 책임지세요 😅 (저는 AI라 소송 못 걸려요)

화이팅!
