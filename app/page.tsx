'use client';
import { useState, useEffect } from 'react';
import { analyzeCase } from '../lib/analyzer';

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
        setReport(analyzeCase(rawData));
        window.history.replaceState({}, '', window.location.pathname);
      } catch (e) { alert("데이터 분석 중 오류 발생"); }
      setLoading(false);
    }
  }, []);

  return (
    <main style={{ background: '#f8f9fa', minHeight: '100vh' }}>
      <header style={{ background: '#0B3D2E', color: 'white', padding: '20px 0' }}>
        <div className="container"><h1>⚖️ 경매AI <span>권리분석</span></h1></div>
      </header>

      <section className="container" style={{ marginTop: '-40px', paddingBottom: '50px' }}>
        {!report ? (
          <div className="loading-card" style={{ background: 'white', padding: '50px', textAlign: 'center', borderRadius: '15px' }}>
            <p>대법원 사이트에서 <strong>[경매 추출]</strong> 버튼을 눌러주세요.</p>
          </div>
        ) : (
          <div className="report-wrapper">
            {/* 상단 판정 섹션 */}
            <div className={`verdict-card ${report.risk.level}`} style={{ background: 'white', padding: '30px', borderRadius: '15px', borderLeft: `10px solid ${report.risk.level === 'danger' ? '#e74c3c' : '#2ecc71'}`, marginBottom: '20px' }}>
               <span style={{ background: report.risk.level === 'danger' ? '#fdecea' : '#eafaf1', color: report.risk.level === 'danger' ? '#e74c3c' : '#2ecc71', padding: '5px 12px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold' }}>
                ● {report.risk.level === 'danger' ? '위험' : '양호'}
               </span>
               <h2 style={{ marginTop: '15px' }}>{report.basic['소재지']}</h2>
               <div className="stats-row" style={{ display: 'flex', gap: '30px', marginTop: '20px' }}>
                 <div><p style={{ color: '#666', fontSize: '13px' }}>인수 권리</p><strong>{report.rights.filter((r:any)=>r.status==='인수').length}건</strong></div>
                 <div><p style={{ color: '#666', fontSize: '13px' }}>대항력 임차인</p><strong>{report.tenants.filter((t:any)=>t.daehang==='있음').length}명</strong></div>
                 <div><p style={{ color: '#666', fontSize: '13px' }}>낙찰자 인수금액</p><strong style={{ color: '#e74c3c' }}>{formatMoney(report.inherited.total)}</strong></div>
               </div>
            </div>

            {/* 상세 분석 내용 */}
            <div style={{ background: 'white', padding: '30px', borderRadius: '15px' }}>
              <h4>📜 권리 분석 결과</h4>
              {report.risk.flags.map((f:any, i:number) => (
                <div key={i} style={{ background: f.sev === 'danger' ? '#fff5f5' : '#f8f9fa', padding: '15px', borderRadius: '8px', marginTop: '10px', border: `1px solid ${f.sev === 'danger' ? '#feb2b2' : '#ddd'}` }}>
                  {f.sev === 'danger' ? '🚨' : '✅'} {f.msg}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
