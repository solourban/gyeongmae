const CHOI_U_SEON: Record<string, [number, number]> = {
  seoul: [165_000_000, 55_000_000],
  overcrowded: [145_000_000, 48_000_000],
  metro: [85_000_000, 28_000_000],
  other: [75_000_000, 25_000_000]
};

const MALSO_CANDIDATES = ['근저당', '저당', '가압류', '압류', '담보가등기', '경매개시결정'];
const ALWAYS_INHERIT = ['유치권', '법정지상권', '분묘기지권'];

function parseMoney(s: any): number {
  if (!s) return 0;
  const digits = String(s).replace(/[^0-9]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

function normalizeDate(s: string): string {
  if (!s) return '';
  const m = s.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return s;
}

export function analyzeCase(rawData: any, region: string = 'other') {
  const rights = (rawData.rights || []).map((r: any) => ({
    date: normalizeDate(r['접수일자'] || r['접수일'] || ''),
    type: r['권리종류'] || r['등기목적'] || '',
    holder: r['권리자'] || '',
    amount: parseMoney(r['채권금액'] || r['금액'] || 0),
  })).filter((r: any) => r.date);

  const tenants = (rawData.tenants || []).map((t: any) => ({
    name: t['임차인'] || t['성명'] || '미상',
    moveIn: normalizeDate(t['전입일자'] || t['전입일'] || ''),
    fixed: normalizeDate(t['확정일자'] || ''),
    deposit: parseMoney(t['보증금'] || 0),
  })).filter((t: any) => t.moveIn);

  const basic = rawData.basic || {};
  const minBid = parseMoney(basic['최저매각가격'] || 0);
  const appraisal = parseMoney(basic['감정평가액'] || 0);

  let malso = null;
  const candidates = rights.filter((r: any) => MALSO_CANDIDATES.some(k => r.type.includes(k)));
  if (candidates.length > 0) {
    candidates.sort((a: any, b: any) => a.date.localeCompare(b.date));
    malso = candidates[0];
  }

  const analyzedRights = rights.sort((a: any, b: any) => a.date.localeCompare(b.date)).map((r: any) => {
    let status = '소멸', reason = '말소기준 이후 소멸';
    let isMalso = false;
    if (ALWAYS_INHERIT.some(k => r.type.includes(k))) {
      status = '인수'; reason = '경매로 소멸되지 않는 권리';
    } else if (!malso) {
      status = '?'; reason = '기준권리 없음';
    } else if (r === malso) {
      status = '소멸'; reason = '말소기준권리 (소멸)'; isMalso = true;
    } else if (r.date < malso.date) {
      status = '인수'; reason = '선순위 권리 인수';
    }
    return { ...r, status, reason, isMalso };
  });

  const analyzedTenants = tenants.map((t: any) => {
    let daehang = '없음', reason = '말소기준 이후 전입';
    if (malso && t.moveIn < malso.date) {
      daehang = '있음'; reason = '말소기준보다 빨라 대항력 유지';
    }
    return { ...t, daehang, reason };
  });

  const inheritedTotal = analyzedRights.filter((r: any) => r.status === '인수').reduce((a: number, b: any) => a + b.amount, 0) +
                         analyzedTenants.filter((t: any) => t.daehang === '있음').reduce((a: number, b: any) => a + b.deposit, 0);

  let level = 'ok';
  const flags = [];
  if (inheritedTotal > 0) {
    level = 'danger';
    flags.push({ sev: 'danger', msg: `인수예상금액 ${inheritedTotal.toLocaleString()}원 발생` });
  } else {
    flags.push({ sev: 'ok', msg: '인수되는 권리가 없는 깨끗한 물건입니다.' });
  }

  return {
    case: rawData.caseNo,
    basic,
    malso,
    rights: analyzedRights,
    tenants: analyzedTenants,
    inherited: { total: inheritedTotal },
    risk: { level, flags },
    baedang: { allocations: [{ order: 1, label: '경매집행비용 (추정)', amount: Math.round((minBid || appraisal) * 0.03) }], surplus: 0 },
    bidRec: { lower: minBid, upper: Math.min(appraisal * 0.85, appraisal - inheritedTotal), base: appraisal },
    explanation: "브라우저 추출 방식을 통해 분석된 리포트입니다."
  };
}
