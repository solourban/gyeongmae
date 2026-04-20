'use client';
import { useState, useEffect } from 'react';
import { analyzeCase } from '../lib/analyzer'; 

const COURTS = ['서울중앙지방법원', '서울동부지방법원', '대전지방법원', '천안지원', '부산지방법원']; // 예시로 줄임

function formatMoney(n: number): string {
  if (!n) return '-';
  const 억 = Math.floor(n / 100_000_000);
  const 만 = Math.floor((n % 100_000_000) / 10_000);
  return `${억 ? 억 + '억 ' : ''}${만.toLocaleString('ko-KR')}만 원`;
}

export default function Home() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auto') === 'true') {
      setLoading(true);
      try {
        const rawData = JSON.parse(decodeURIComponent(params.get('data') || ''));
        setReport(analyzeCase(rawData, 'other'));
        window.history.replaceState({}, '', window.location.pathname);
      } catch (e) { console.error("데이터 로드 실패"); }
      setLoading(false);
    }
  }, []);

  return (
    <main>
      <header className="site-header"><div className="container nav-row"><h1>경매<span>AI</span></h1></div></header>
      <section className="hero">
        <div className="container">
          <h2 className="hero-title">사건번호만 입력하면 <em>권리분석</em> 끝</h2>
          <p>대법원 사이트에서 [추출] 버튼을 누르면 1초 만에 분석됩니다.</p>
        </div>
      </section>
      <section className="results-section container">
        {loading && <div className="loading-card"><div className="spinner"></div><p>분석 중...</p></div>}
        {report && <ReportView report={report} />}
      </section>
    </main>
  );
}

function ReportView({ report }: { report: any }) {
  return (
    <div className="report">
      <div className={`verdict ${report.risk.level}`}>
        <h3>{report.basic['소재지'] || "물건 정보"}</h3>
        <p>인수금액: {formatMoney(report.inherited.total)}</p>
      </div>
      <div className="subcard">
        <h4>📜 권리 분석</h4>
        <pre style={{ fontSize: '12px' }}>{JSON.stringify(report.rights, null, 2)}</pre>
      </div>
    </div>
  );
}
