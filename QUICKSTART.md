# 🚀 빠른 시작 (3줄 요약)

```bash
npm install
npm run dev
# http://localhost:3000 접속
```

자세한 내용은 `README.md` 참고.

## GitHub에 올릴 때 주의
- `node_modules/` 폴더는 `.gitignore`로 제외됨 (자동)
- `.env.local`은 절대 커밋하지 말 것 (`.gitignore`에 포함됨)
- 레포는 **Private**로 만들어야 함

## 파일 12개 전체 목록
```
auction-web/
├── .gitignore
├── .env.local.example
├── README.md
├── QUICKSTART.md              ← 이 파일
├── package.json
├── next.config.js
├── tsconfig.json
├── vercel.json
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   └── api/
│       └── analyze/
│           └── route.ts
└── lib/
    ├── crawler.ts
    └── analyzer.ts
```
