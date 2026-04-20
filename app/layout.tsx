import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '경매AI 권리분석 — 사건번호만으로 자동 분석',
  description: '대법원 법원경매정보에서 자동으로 데이터를 가져와 말소기준·인수소멸·대항력·배당을 분석합니다.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
