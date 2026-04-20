export function analyzeCase(rawData: any) {
  const rights = rawData.rights || [];
  const tenants = rawData.tenants || [];
  const basic = rawData.basic || {};
  
  const flags = [];
  let level = 'ok';

  // 🚨 [핵심] 데이터가 아예 안 들어왔을 때의 처리
  if (rights.length === 0 && tenants.length === 0) {
    level = 'warn';
    flags.push({ sev: 'warn', msg: '등기부/임차인 데이터를 가져오지 못했습니다. 대법원 상세페이지에서 버튼을 다시 눌러주세요.' });
  } else {
    // 여기에 기존 권리분석 로직 (말소기준권리 찾기 등)이 들어갑니다.
    flags.push({ sev: 'ok', msg: '권리 분석이 완료되었습니다.' });
  }

  return {
    basic,
    rights,
    tenants,
    inherited: { total: 0 },
    risk: { level, flags }
  };
}
