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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auto') === 'true') {
      try {
        const rawData = JSON.parse(decodeURIComponent(params.get('data') || ''));
        const result = analyzeCase(rawData);
        setReport(result);
        window.history.replaceState({}, '', window.location.pathname);
      } catch (e) { alert("데이터 로드 중 오류가 발생했습니다."); }
    }
  }, []);

  return (
    <main style={{ background: '#f5f7f9', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <header style={{ background: '#0B3D2E', color: 'white', padding: '20px' }}>
        <div className="container"><h1>⚖️ 경매AI 권리분석</h1></div>
      </header>

      <div className="container" style={{ marginTop: '20px', paddingBottom: '50px' }}>
        {!report ? (
          <div style={{ background: 'white', padding: '40px', borderRadius: '15px', textAlign: 'center', border: '2px dashed #ccc' }}>
             <p style={{ fontSize: '18px', color: '#666' }}>대법원 사이트에서 <strong>[경매AI 추출]</strong> 즐겨찾기를 눌러주세요.</p>
             <p style={{ color: '#999', marginTop: '10px' }}>※ 화면에 있는 [분석 시작] 버튼은 서버 성능 문제로 작동하지 않습니다.</p>
          </div>
        ) : (
          <div className="report-content">
            {/* 결과 요약 카드 */}
            <div style={{ background: 'white', padding: '30px', borderRadius: '15px', borderLeft: `10px solid ${report.risk.level === 'danger' ? '#e74c3c' : (report.risk.level === 'warn' ? '#f39c12' : '#2ecc71')}`, marginBottom: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '20px', background: '#f1f1f1', fontSize: '13px', fontWeight: 'bold' }}>
                {report.risk.level === 'ok' ? '✅ 양호' : (report.risk.level === 'warn' ? '⚠️ 주의' : '🚨 위험')}
              </div>
              <h2 style={{ marginTop: '15px', fontSize: '24px' }}>{report.basic['소재지']}</h2>
              
              <div style={{ display: 'flex', gap: '40px', marginTop: '20px' }}>
                <div><p style={{ color: '#888', fontSize: '13px' }}>인수 권리</p><strong>{report.rights.filter((r:any)=>r.status==='인수').length}건</strong></div>
                <div><p style={{ color: '#888', fontSize: '13px' }}>대항력 임차인</p><strong>{report.tenants.filter((t:any)=>t.daehang==='있음').length}명</strong></div>
                <div><p style={{ color: '#888', fontSize: '13px' }}>낙찰자 인수금액</p><strong style={{ color: '#e74c3c' }}>{formatMoney(report.inherited.total)}</strong></div>
              </div>
            </div>

            {/* 상세 메시지 */}
            <div style={{ background: 'white', padding: '25px', borderRadius: '15px' }}>
              <h4>📜 분석 리포트</h4>
              {report.risk.flags.map((f:any, i:number) => (
                <div key={i} style={{ padding: '15px', borderRadius: '8px', marginTop: '10px', background: f.sev === 'danger' ? '#fff5f5' : (f.sev === 'warn' ? '#fff9eb' : '#f8f9fa'), border: `1px solid ${f.sev === 'danger' ? '#feb2b2' : '#ddd'}` }}>
                  {f.sev === 'danger' ? '🚨' : (f.sev === 'warn' ? '⚠️' : '✅')} {f.msg}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
