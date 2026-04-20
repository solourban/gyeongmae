// 소액임차인 최우선변제 기준 (2023.02.21 개정)
const CHOI_U_SEON: Record<string, [number, number]> = {
  seoul: [165_000_000, 55_000_000],
  overcrowded: [145_000_000, 48_000_000],
  metro: [85_000_000, 28_000_000],
  other: [75_000_000, 25_000_000]
};

const MALSO_CANDIDATES = ['근저당권', '저당권', '가압류', '압류', '담보가등기', '경매개시결정등기'];
const ALWAYS_INHERIT = ['유치권', '법정지상권', '분묘기지권'];

function parseMoney(s: string | number): number {
  if (!s) return 0;
  const digits = String(s).replace(/[^0-9]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

function normalizeDate(s: string): string {
  if (!s) return '';
  const m = String(s).match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return s;
}

export function analyzeCase(rawData: any, region: string) {
  // 1. 데이터 정제
  const rights = (rawData.rights || []).map((r: any) => ({
    date: normalizeDate(r['접수일자'] || r['접수일'] || ''),
    type: (r['권리종류'] || r['등기목적'] || '').replace(/\s+/g, ''),
    holder: r['권리자'] || r['권리자등'] || '',
    amount: parseMoney(r['채권최고액'] || r['청구금액'] || r['금액'] || 0),
  })).filter((r: any) => r.date && r.type);

  const tenants = (rawData.tenants || []).map((t: any) => ({
    name: t['임차인'] || t['성명'] || '임차인',
    moveIn: normalizeDate(t['전입일자'] || t['전입일'] || ''),
    fixed: normalizeDate(t['확정일자'] || ''),
    deposit: parseMoney(t['보증금'] || t['임차보증금'] || 0),
  })).filter((t: any) => t.moveIn);

  const basic = rawData.basic || {};
  const minBid = parseMoney(basic['최저매각가격'] || basic['최저가'] || 0);
  const appraisal = parseMoney(basic['감정평가액'] || basic['감정가'] || 0);

  // 2. 말소기준권리 찾기
  let malso = null;
  const candidates = rights.filter((r: any) => MALSO_CANDIDATES.some(c => r.type.includes(c)));
  if (candidates.length > 0) {
    candidates.sort((a: any, b: any) => a.date.localeCompare(b.date));
    malso = candidates[0];
  }

  // 3. 권리 분석 (인수/소멸)
  const analyzedRights = rights.sort((a: any, b: any) => a.date.localeCompare(b.date)).map((r: any) => {
    let status = '소멸', reason = '말소기준권리 이후 접수되어 소멸됩니다.';
    let isMalso = false;

    if (ALWAYS_INHERIT.some(c => r.type.includes(c))) {
      status = '인수'; reason = '경매로 소멸되지 않는 특수권리입니다.';
    } else if (!malso) {
      status = '?'; reason = '말소기준권리가 없어 판단 불가합니다.';
    } else if (r === malso) {
      status = '소멸'; reason = '말소기준권리 자체로 매각 후 소멸됩니다.'; isMalso = true;
    } else if (r.date < malso.date) {
      status = '인수'; reason = '말소기준권리보다 선순위이므로 낙찰자가 인수합니다.';
    }
    return { ...r, status, reason, isMalso };
  });

  // 4. 대항력 판단
  const analyzedTenants = tenants.map((t: any) => {
    let daehang = '없음', reason = '말소기준권리 이후 전입하여 대항력이 없습니다.';
    if (!malso) {
      daehang = '?'; reason = '말소기준권리를 알 수 없습니다.';
    } else if (t.moveIn < malso.date) {
      daehang = '있음'; reason = `전입일(${t.moveIn})이 말소기준(${malso.date})보다 빨라 대항력이 있습니다.`;
    }
    return { ...t, daehang, reason };
  });

  // 5. 인수금액 및 위험도 계산
  let inheritedTotal = 0;
  analyzedRights.filter((r: any) => r.status === '인수').forEach((r: any) => { inheritedTotal += r.amount; });
  // (실제 배당 시뮬레이션 로직이 들어가면 미배당 보증금을 계산하지만, 여기서는 보수적으로 대항력 보증금 전체를 인수 가능성으로 잡음)
  analyzedTenants.filter((t: any) => t.daehang === '있음').forEach((t: any) => { inheritedTotal += t.deposit; });

  let level = 'ok';
  const flags = [];
  if (analyzedRights.some((r: any) => ALWAYS_INHERIT.some(c => r.type.includes(c)))) {
    level = 'danger'; flags.push({ sev: 'danger', msg: '주의가 필요한 특수권리가 존재합니다.' });
  }
  if (analyzedTenants.some((t: any) => t.daehang === '있음')) {
    level = inheritedTotal > 0 ? 'danger' : 'warn';
    flags.push({ sev: level, msg: '대항력 있는 임차인이 있어 보증금 인수가 발생할 수 있습니다.' });
  }
  if (inheritedTotal > 0 && minBid > 0 && (inheritedTotal / minBid) >= 0.3) {
    level = 'danger'; flags.push({ sev: 'danger', msg: '낙찰자 인수금액 부담이 매우 큽니다.' });
  }
  if (flags.length === 0) flags.push({ sev: 'ok', msg: '인수되는 권리나 임차인이 없어 깨끗한 물건입니다.' });

  return {
    case: rawData.caseNo,
    url: rawData.url,
    basic,
    malso,
    rights: analyzedRights,
    tenants: analyzedTenants,
    inherited: { total: inheritedTotal },
    risk: { level, flags },
    baedang: { allocations: [{ order: 1, label: '경매집행비용 (추정)', amount: Math.round((minBid || appraisal) * 0.03) }], surplus: 0 },
    bidRec: { lower: minBid, upper: Math.min(appraisal * 0.85, appraisal - inheritedTotal), base: appraisal },
    explanation: '권리분석 자동화 리포트가 정상적으로 생성되었습니다. 입찰 전 매각물건명세서를 반드시 확인하세요.'
  };
}
