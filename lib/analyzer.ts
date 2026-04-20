const MALSO_CANDIDATES = ['근저당', '저당', '가압류', '압류', '담보가등기', '경매개시결정'];
const ALWAYS_INHERIT = ['유치권', '법정지상권', '분묘기지권'];

function parseMoney(s: any): number {
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

export function analyzeCase(rawData: any, region: string = 'other') {
  const rights = (rawData.rights || []).map((r: any) => ({
    date: normalizeDate(r['접수일자'] || ''),
    type: (r['권리종류'] || '').replace(/\s/g, ''),
    amount: parseMoney(r['채권금액'] || 0),
  })).filter((r: any) => r.date);

  const tenants = (rawData.tenants || []).map((t: any) => ({
    name: t['임차인'] || '미상',
    moveIn: normalizeDate(t['전입일자'] || ''),
    deposit: parseMoney(t['보증금'] || 0),
  })).filter((t: any) => t.moveIn);

  const minBid = parseMoney(rawData.basic?.['최저매각가격'] || 0);
  const appraisal = parseMoney(rawData.basic?.['감정평가액'] || 0);

  let malso = null;
  const candidates = rights.filter((r: any) => MALSO_CANDIDATES.some(k => r.type.includes(k)));
  if (candidates.length > 0) {
    candidates.sort((a: any, b: any) => a.date.localeCompare(b.date));
    malso = candidates[0];
  }

  const inheritedTotal = rights.filter(r => malso && r.date < malso.date).reduce((a, b) => a + b.amount, 0) +
                         tenants.filter(t => malso && t.moveIn < malso.date).reduce((a, b) => a + b.deposit, 0);

  let level = 'ok';
  const flags = [];
  if (inheritedTotal > 0) {
    level = 'danger';
    flags.push({ sev: 'danger', msg: `인수 금액 ${inheritedTotal.toLocaleString()}원 발생! 입찰가에서 빼세요.` });
  } else if (minBid > 0 && appraisal > 0 && (minBid / appraisal) < 0.2) {
    level = 'danger';
    flags.push({ sev: 'danger', msg: '최저가가 너무 낮습니다. 등기부 외 인수금이 있을 확률이 높습니다.' });
  }

  return { basic: rawData.basic, rights, tenants, inherited: { total: inheritedTotal }, risk: { level, flags } };
}
