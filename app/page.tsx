'use client';

import { useState, useEffect } from 'react';
// ⚠️ 주의: 반드시 이전에 만든 lib/analyzer.ts가 있어야 합니다.
import { analyzeCase } from '../lib/analyzer'; 

const COURTS = [
  '서울중앙지방법원', '서울동부지방법원', '서울서부지방법원',
  '서울남부지방법원', '서울북부지방법원',
  '수원지방법원', '인천지방법원', '의정부지방법원',
  '대전지방법원', '천안지원', '청주지방법원',
  '부산지방법원', '부산지방법원 동부지원', '부산지방법원 서부지원',
  '대구지방법원', '울산지방법원', '창원지방법원',
  '광주지방법원', '전주지방법원',
  '춘천지방법원', '제주지방법원',
];

function formatMoney(n: number): string {
  if (!n) return '-';
  const 억 = Math.floor(n / 100_000_000);
  const 만 = Math.floor((n % 100_000_000) / 10_000);
  const parts: string[] = [];
  if (억) parts.push(`${억}억`);
  if (만) parts.push(`${만.toLocaleString('ko-KR')}만`);
  return (parts.join(' ') || '0') + '원';
}

export default function Home() {
  const [saYear, setSaYear] = useState('2024');
  const [saSer, setSaSer] = useState('');
  const [jiwonNm, setJiwonNm] = useState('천안지원');
  const [region, setRegion] = useState('other');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);

  // 🛰️ [추가된 기능] 대법원 사이트에서 쏜 데이터를 받아내는 안테나
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const auto = params.get('auto');
    const rawDataStr = params.get('data');

    if (auto === 'true' && rawDataStr) {
      setLoading(true);
      try {
        const rawData = JSON.parse(decodeURIComponent(rawDataStr));
        // 서버 에러 나는 API 대신, 내 브라우저에서 직접 분석 엔진(analyzer) 가동!
        const analyzedReport = analyzeCase(rawData, region);
        setReport(analyzedReport);
        
        // 주소창에 지저분한 데이터 파라미터 삭제 (깔끔하게 주소 정리)
        window.history.replaceState({}, '', window.location.pathname);
      } catch (e) {
        setError('데이터를 읽어오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }
  }, [region]);

  async function handleAnalyze() {
    if (!saSer.trim()) {
      setError('사건번호를 입력하세요');
      return;
    }
    setLoading(true);
    setError(null);
    setReport(null);

    try {
      // 기존 API 방식도 일단 남겨둡니다 (나중에 서버 에러 고쳐지면 쓰기 위해)
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saYear, saSer: saSer.trim(), jiwonNm, region }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `서버 오류 (${res.status})`);
      } else {
        setReport(data.report);
      }
    } catch (e: any) {
      setError(e.message || '요청 실패');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <header className="site-header">
        <div className="container nav-row">
          <div className="brand">
            <div className="brand-mark">⚖</div>
            <div className="brand-text">
              <h1>경매<span>AI</span></h1>
              <p>권리분석</p>
            </div>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="container">
          <h2 className="hero-title">
            사건번호만 입력하면<br />
            <em>경매 물건 권리분석</em> 끝
          </h2>
          <p className="hero-sub">
            대법원 법원경매정보에서 [데이터 추출] 버튼을 누르면<br />
            이곳에서 즉시 말소기준권리·인수소멸·대항력을 분석합니다.
          </p>

          <div className="search-box">
            <div className="search-row">
              <select value={jiwonNm} onChange={(e) => setJiwonNm(e.target.value)}>
                {COURTS.map((c) => <option key={c}>{c}</option>)}
              </select>
              <input
                type="text"
                placeholder="연도"
                value={saYear}
                onChange={(e) => setSaYear(e.target.value)}
                style={{ maxWidth: 90 }}
              />
              <span className="sep">타경</span>
              <input
                type="text"
                placeholder="사건번호 (예: 10044)"
                value={saSer}
                onChange={(e) => setSaSer(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
              />
              <button className="btn-primary" onClick={handleAnalyze} disabled={loading}>
                {loading ? '분석 중...' : '⚡ 분석 시작'}
              </button>
            </div>
            <div className="search-region">
              <span>소액임차인 기준 지역:</span>
              <select value={region} onChange={(e) => setRegion(e.target.value)}>
                <option value="seoul">서울특별시</option>
                <option value="overcrowded">과밀억제권역·세종·용인·화성·김포</option>
                <option value="metro">광역시·안산·광주·파주·이천·평택</option>
                <option value="other">그 외 지역</option>
              </select>
            </div>
            <p className="search-hint">
              대법원에서 즐겨찾기 버튼을 누르면 1초 만에 분석 결과가 뜹니다.
            </p>
          </div>
        </div>
      </section>

      <section className="results-section container">
        {loading && (
          <div className="loading-card">
            <div className="spinner"></div>
            <p>권리분석 엔진 가동 중...</p>
          </div>
        )}

        {error && (
          <div className="error-card">
            <h3>❌ 분석 실패</h3>
            <p>{error}</p>
          </div>
        )}

        {report && <ReportView report={report} />}
      </section>

      <footer className="site-footer">
        <p>본 도구는 학습·참고용이며 법률 자문을 대체하지 않습니다.</p>
        <p className="muted">실제 입찰 전 등기부등본·매각물건명세서 원본을 확인하세요.</p>
      </footer>
    </main>
  );
}

// ── 결과 화면 컴포넌트 (디자인 유지) ──
function ReportView({ report }: { report: any }) {
  const verdictLabel = { ok: '양호', warn: '주의', danger: '위험' }[report.risk.level as 'ok' | 'warn' | 'danger'];
  const verdictDesc = {
    ok: '권리관계가 깨끗한 물건입니다.',
    warn: '주의해야 할 요소가 있습니다. 실질 투자비를 재계산하세요.',
    danger: '입찰 전 반드시 전문가 검토가 필요합니다.',
  }[report.risk.level as 'ok' | 'warn' | 'danger'];

  const daehang = report.tenants.filter((t: any) => t.daehang === '있음').length;
  const inheritCount = report.rights.filter((r: any) => r.status === '인수').length;

  return (
    <div className="report">
      <div className={`verdict ${report.risk.level}`}>
        <span className="verdict-badge">
          {report.risk.level === 'ok' ? '✓' : '⚠'} 종합 · {verdictLabel}
        </span>
        <h3>{report.basic['소재지'] || report.case}</h3>
        <p>{verdictDesc}</p>
        <div className="verdict-stats">
          <div className="stat"><div className="k">인수 권리</div><div className={`v ${inheritCount > 0 ? 'danger' : ''}`}>{inheritCount}건</div></div>
          <div className="stat"><div className="k">소멸 권리</div><div className="v">{report.rights.filter((r: any) => r.status === '소멸').length}건</div></div>
          <div className="stat"><div className="k">대항력 임차인</div><div className={`v ${daehang > 0 ? 'danger' : ''}`}>{daehang}명</div></div>
          <div className="stat"><div className="k">낙찰자 인수금액</div><div className={`v ${report.inherited.total > 0 ? 'danger' : 'ok'}`}>{formatMoney(report.inherited.total)}</div></div>
        </div>
      </div>

      {/* 기본정보 */}
      <div className="subcard">
        <h4>📋 물건 기본정보</h4>
        <table className="basic-table">
          <tbody>
            {Object.entries(report.basic).map(([k, v]) => (
              <tr key={k}><th>{k}</th><td>{v as string}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 권리 분석 테이블 */}
      <div className="subcard">
        <h4>📜 권리 분석 ({report.rights.length}건)</h4>
        <table className="rights-table">
          <thead>
            <tr><th>접수일</th><th>종류</th><th>권리자</th><th style={{ textAlign: 'right' }}>금액</th><th style={{ textAlign: 'center' }}>판정</th></tr>
          </thead>
          <tbody>
            {report.rights.map((r: any, i: number) => (
              <tr key={i} className={r.isMalso ? 'malso-row' : ''}>
                <td>{r.date}</td>
                <td>{r.type}{r.isMalso && <span className="tag malso"> 말소기준</span>}</td>
                <td>{r.holder}</td>
                <td style={{ textAlign: 'right' }}>{formatMoney(r.amount)}</td>
                <td style={{ textAlign: 'center' }}>
                  <span className={`tag ${r.status === '인수' ? 'inherit' : 'extinct'}`}>{r.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 임차인 */}
      {report.tenants.length > 0 && (
        <div className="subcard">
          <h4>🏠 임차인 대항력 ({report.tenants.length}명)</h4>
          <table className="rights-table">
            <thead>
              <tr><th>이름</th><th>전입일</th><th>확정일자</th><th style={{ textAlign: 'right' }}>보증금</th><th style={{ textAlign: 'center' }}>대항력</th></tr>
            </thead>
            <tbody>
              {report.tenants.map((t: any, i: number) => (
                <tr key={i}>
                  <td>{t.name}</td>
                  <td>{t.moveIn}</td>
                  <td>{t.fixed || '-'}</td>
                  <td style={{ textAlign: 'right' }}>{formatMoney(t.deposit)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`tag ${t.daehang === '있음' ? 'inherit' : 'extinct'}`}>{t.daehang}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="subcard">
        <h4>💡 쉬운 말 해설</h4>
        <div>{report.explanation}</div>
      </div>
    </div>
  );
}
