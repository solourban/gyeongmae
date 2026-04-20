/**
 * 법원경매정보 크롤러 (Playwright 기반)
 * ─────────────────────────────────────
 * Vercel 서버리스 환경에서는 @sparticuz/chromium 을 써야 함.
 * 로컬 개발에선 그냥 playwright-core + 설치된 Chrome을 쓰면 됨.
 */

import chromium from '@sparticuz/chromium';
import { chromium as playwrightChromium, Browser } from 'playwright-core';
import * as cheerio from 'cheerio';

// ── Browser 런처 ──
async function launchBrowser(): Promise<Browser> {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    // 로컬 개발: 시스템 Chrome 사용 (가장 빠름)
    return playwrightChromium.launch({
      headless: true,
    });
  }

  // Vercel 서버리스: @sparticuz/chromium 사용
  return playwrightChromium.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
}

// ── EUC-KR 인코딩 (대법원 사이트가 요구함) ──
function encodeEucKr(text: string): string {
  // 주요 법원명만 하드코딩 (EUC-KR 인코딩 테이블이 큼)
  // 더 많이 필요하면 iconv-lite 패키지 쓰기
  const knownCourts: Record<string, string> = {
    '서울중앙지방법원': '%BC%AD%BF%EF%C1%DF%BE%D3%C1%F6%B9%E6%B9%FD%BF%F8',
    '서울동부지방법원': '%BC%AD%BF%EF%B5%BF%BA%CE%C1%F6%B9%E6%B9%FD%BF%F8',
    '서울서부지방법원': '%BC%AD%BF%EF%BC%AD%BA%CE%C1%F6%B9%E6%B9%FD%BF%F8',
    '서울남부지방법원': '%BC%AD%BF%EF%B3%B2%BA%CE%C1%F6%B9%E6%B9%FD%BF%F8',
    '서울북부지방법원': '%BC%AD%BF%EF%BA%CF%BA%CE%C1%F6%B9%E6%B9%FD%BF%F8',
    '대전지방법원': '%B4%EB%C0%FC%C1%F6%B9%E6%B9%FD%BF%F8',
    '천안지원': '%C3%B5%BE%C8%C1%F6%BF%F8',
    '부산지방법원': '%BA%CE%BB%EA%C1%F6%B9%E6%B9%FD%BF%F8',
    '부산지방법원 동부지원': '%BA%CE%BB%EA%C1%F6%B9%E6%B9%FD%BF%F8+%B5%BF%BA%CE%C1%F6%BF%F8',
    '부산지방법원 서부지원': '%BA%CE%BB%EA%C1%F6%B9%E6%B9%FD%BF%F8+%BC%AD%BA%CE%C1%F6%BF%F8',
    '대구지방법원': '%B4%EB%B1%B8%C1%F6%B9%E6%B9%FD%BF%F8',
    '인천지방법원': '%C0%CE%C3%B5%C1%F6%B9%E6%B9%FD%BF%F8',
    '광주지방법원': '%B1%A4%C1%D6%C1%F6%B9%E6%B9%FD%BF%F8',
    '수원지방법원': '%BC%F6%BF%F8%C1%F6%B9%E6%B9%FD%BF%F8',
    '의정부지방법원': '%C0%C7%C1%A4%BA%CE%C1%F6%B9%E6%B9%FD%BF%F8',
    '울산지방법원': '%BF%EF%BB%EA%C1%F6%B9%E6%B9%FD%BF%F8',
    '창원지방법원': '%C3%A2%BF%F8%C1%F6%B9%E6%B9%FD%BF%F8',
    '청주지방법원': '%C3%BB%C1%D6%C1%F6%B9%E6%B9%FD%BF%F8',
    '전주지방법원': '%C0%FC%C1%D6%C1%F6%B9%E6%B9%FD%BF%F8',
    '춘천지방법원': '%C3%E1%C3%B5%C1%F6%B9%E6%B9%FD%BF%F8',
    '제주지방법원': '%C1%A6%C1%D6%C1%F6%B9%E6%B9%FD%BF%F8',
  };

  if (knownCourts[text]) return knownCourts[text];

  // Fallback: UTF-8 인코딩 (작동 안 할 수 있음)
  console.warn(`[encodeEucKr] 알려지지 않은 법원명: ${text}. UTF-8로 fallback.`);
  return encodeURIComponent(text);
}

// ── 메인 fetch 함수 ──
export interface RawCaseData {
  caseNo: string;
  court: string;
  url: string;
  fetchedAt: string;
  status: 'ok' | 'error';
  error?: string;
  basic: Record<string, string>;
  rights: Array<Record<string, string>>;
  tenants: Array<Record<string, string>>;
  schedule: Array<string[]>;
  detailHtml?: string;
}

export async function fetchCase(
  saYear: string,
  saSer: string,
  jiwonNm: string
): Promise<RawCaseData> {
  const jiwonEnc = encodeEucKr(jiwonNm);
  const url =
    'https://www.courtauction.go.kr/RetrieveRealEstDetailInqSaList.laf' +
    `?jiwonNm=${jiwonEnc}` +
    `&saYear=${saYear}` +
    `&saSer=${saSer}` +
    '&_CUR_CMD=InitMulSrch.laf' +
    '&_SRCH_SRNID=PNO102014' +
    '&_NEXT_CMD=RetrieveRealEstDetailInqSaList.laf';

  const result: RawCaseData = {
    caseNo: `${saYear}타경${saSer}`,
    court: jiwonNm,
    url,
    fetchedAt: new Date().toISOString(),
    status: 'ok',
    basic: {},
    rights: [],
    tenants: [],
    schedule: [],
  };

  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'ko-KR',
    });
    const page = await context.newPage();

    await page.goto(url, { timeout: 30000, waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // 사건 목록에서 해당 사건 링크 클릭
    try {
      const caseLink = page.locator(`text=${saYear}타경${saSer}`).first();
      if ((await caseLink.count()) > 0) {
        await caseLink.click();
        await page.waitForTimeout(1500);
      }
    } catch {
      // 이미 상세에 있을 수도 있음
    }

    const html = await page.content();
    result.detailHtml = html;

    // 파싱
    Object.assign(result, parseDetail(html));
  } catch (e: any) {
    result.status = 'error';
    result.error = e.message || String(e);
    console.error('[fetchCase] error:', e);
  } finally {
    if (browser) await browser.close();
  }

  return result;
}

// ── 파싱 ──
function parseDetail(html: string) {
  const $ = cheerio.load(html);
  const out = {
    basic: {} as Record<string, string>,
    rights: [] as Array<Record<string, string>>,
    tenants: [] as Array<Record<string, string>>,
    schedule: [] as Array<string[]>,
  };

  $('table').each((_, tableEl) => {
    const $table = $(tableEl);
    const headerText = $table.find('th').map((_, th) => $(th).text().trim()).get().join('|');
    const allText = $table.text();

    // 기본정보 테이블 (th-td 쌍)
    if (/사건번호|물건종별|감정평가|최저매각/.test(headerText)) {
      Object.assign(out.basic, parseKeyValueTable($table, $));
    }

    // 임차인 테이블
    if (/임차인|전입|확정/.test(headerText)) {
      out.tenants.push(...parseGenericTable($table, $));
    }

    // 등기부 권리 테이블
    if (/접수일|등기|권리종류/.test(headerText) && /채권|금액|권리자/.test(headerText)) {
      out.rights.push(...parseGenericTable($table, $));
    }

    // 기일 테이블
    if (/매각기일|유찰/.test(allText) && /최저매각가격|최저가/.test(allText)) {
      $table.find('tr').slice(1).each((_, tr) => {
        const cells = $(tr).find('td').map((_, td) => $(td).text().trim()).get();
        if (cells.length >= 3) out.schedule.push(cells);
      });
    }
  });

  return out;
}

function parseKeyValueTable($table: cheerio.Cheerio<any>, $: cheerio.CheerioAPI) {
  const d: Record<string, string> = {};
  $table.find('tr').each((_, tr) => {
    const cells = $(tr).find('th, td').toArray();
    for (let i = 0; i < cells.length - 1; i++) {
      const cell = cells[i];
      if ((cell as any).tagName === 'th' || cell.name === 'th') {
        const key = $(cell).text().trim();
        const val = $(cells[i + 1]).text().replace(/\s+/g, ' ').trim();
        if (key && val) d[key] = val;
        i++;
      }
    }
  });
  return d;
}

function parseGenericTable($table: cheerio.Cheerio<any>, $: cheerio.CheerioAPI) {
  const rows: Array<Record<string, string>> = [];
  const headers = $table.find('tr').first().find('th, td').map((_, el) => $(el).text().trim()).get();

  $table.find('tr').slice(1).each((_, tr) => {
    const cells = $(tr).find('td').map((_, td) => $(td).text().replace(/\s+/g, ' ').trim()).get();
    if (cells.length < 2) return;
    if (/없음|조사된 임차인 내역 없음/.test(cells.join(''))) return;

    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (h && cells[i]) row[h] = cells[i];
    });
    if (Object.keys(row).length > 0) rows.push(row);
  });

  return rows;
}
