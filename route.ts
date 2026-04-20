import { NextRequest, NextResponse } from 'next/server';
import { fetchCase } from '@/lib/crawler';
import { analyzeCase, Region } from '@/lib/analyzer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const { saYear, saSer, jiwonNm, region = 'other' } = await req.json();

    if (!saYear || !saSer || !jiwonNm) {
      return NextResponse.json(
        { error: '필수 파라미터 누락: saYear, saSer, jiwonNm' },
        { status: 400 }
      );
    }

    console.log(`[api/analyze] Start: ${jiwonNm} ${saYear}타경${saSer}`);

    const raw = await fetchCase(String(saYear), String(saSer), String(jiwonNm));

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[api/analyze] Fetch done in ${elapsed}s, status: ${raw.status}`);

    if (raw.status !== 'ok') {
      // detailHtml은 너무 커서 응답에서 제외
      const { detailHtml, ...rawSafe } = raw;
      return NextResponse.json(
        {
          error: raw.error || '크롤링 실패',
          detail: {
            case: rawSafe.caseNo,
            url: rawSafe.url,
            elapsed: `${elapsed}s`,
          },
        },
        { status: 500 }
      );
    }

    const report = analyzeCase(raw, region as Region);

    return NextResponse.json({
      ok: true,
      report,
      elapsed: `${elapsed}s`,
    });
  } catch (e: any) {
    console.error('[api/analyze] Exception:', e);
    return NextResponse.json(
      {
        error: e.message || String(e),
        stack: process.env.NODE_ENV === 'development' ? e.stack : undefined,
      },
      { status: 500 }
    );
  }
}

// GET 요청은 헬스체크용
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Auction analyzer API is running',
    env: process.env.NODE_ENV,
  });
}
