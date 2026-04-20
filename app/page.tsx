'use client';
import { useState, useEffect } from 'react';
import { analyzeCase } from '../lib/analyzer';

export default function Home() {
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auto') === 'true') {
      try {
        const rawData = JSON.parse(decodeURIComponent(params.get('data') || ''));
        setReport(analyzeCase(rawData));
        window.history.replaceState({}, '', window.location.pathname);
      } catch (e) { console.error("데이터 로드 실패"); }
    }
  }, []);

  return (
    <main style={{ background: '#f5f5f5', minHeight: '100vh' }}>
      <header style={{ background: '#0B3D2E', color: 'white', padding: '20px' }}>
        <div className="container"><h1>⚖️ 경매AI 권리분석</h1></div>
      </header>
      <section className="container" style={{ padding: '20px' }}>
        {report ? (
          <div style={{ background: 'white', padding: '30px', borderRadius: '15px', borderLeft: `10px solid ${report.risk.level === 'danger' ? 'red' : 'green'}` }}>
            <h2>{report.basic['소재지']}</h2>
            <h3 style={{ color: report.risk.level === 'danger' ? 'red' : 'green' }}>
              판정: {report.risk.level === 'danger' ? '⚠️ 위험' : '✅ 양호'}
            </h3>
            {report.risk.flags.map((f:any, i:number) => <p key={i}>📌 {f.msg}</p>)}
            <hr />
            <p>감정가: {report.basic['감정평가액']}</p>
            <p>최저가: {report.basic['최저매각가격']}</p>
          </div>
        ) : (
          <p>대법원 사이트에서 [경매 추출] 버튼을 눌러주세요.</p>
        )}
      </section>
    </main>
  );
}
