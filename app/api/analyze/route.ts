import { NextResponse } from 'next/server';
import { fetchCase } from '../../../lib/crawler';
import { analyzeCase } from '../../../lib/analyzer';

export async function POST(req: Request) {
  try {
    const { saYear, saSer, jiwonNm, region } = await req.json();
    
    if (!saSer || !jiwonNm) {
      return NextResponse.json({ error: '사건번호와 법원명을 모두 입력해주세요.' }, { status: 400 });
    }

    // 1. 대법원 사이트 크롤링 실행
    const rawData = await fetchCase(saYear, saSer, jiwonNm);
    if (rawData.status === 'error') {
      return NextResponse.json({ error: rawData.error }, { status: 500 });
    }

    // 2. 긁어온 데이터를 바탕으로 권리분석 실행
    const report = analyzeCase(rawData, region || 'other');
    
    return NextResponse.json({ report });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '분석 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
