/**
 * 법원경매정보 크롤러 (Puppeteer 기반)
 * ─────────────────────────────────────────────────
 * 로컬: 시스템에 설치된 Chrome 사용 (puppeteer 패키지가 자동 감지)
 * Vercel: @sparticuz/chromium 바이너리 사용
 *
 * 2024년 기준 Vercel 서버리스에서 가장 안정적인 조합입니다.
 */

import chromium from '@sparticuz/chromium';
import * as cheerio from 'cheerio';

// Puppeteer는 로컬/프로덕션 양쪽에서 쓸 수 있게 동적 import
async function getBrowser() {
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    // 로컬 개발: 전체 puppeteer 패키지 사용 (자체 Chrome 번들)
    const puppeteer = await import('puppeteer');
    return puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }

  // Vercel 프로덕션: puppeteer-core + @sparticuz/chromium
  const puppeteer = await import('puppeteer-core');
  return puppeteer.default.launch({
    args: [
      ...chromium.args,
      '--hide-scrollbars',
      '--disable-web-security',
    ],
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
}

// EUC-KR 인코딩 (대법원 사이트용)
function encodeEucKr(text: string): string {
  const known: Record<string, string> = {
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
  if (known[text]) return known[text];
  console.warn(`[encodeEucKr] Unknown court: ${text}, falling back to UTF-8`);
  return encodeURIComponent(text);
}

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
  schedule: string[][];
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

  let browser: any = null;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();

    // User agent 위장 (기본 HeadlessChrome은 차단될 수 있음)
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'ko-KR,ko;q=0.9' });

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1500));

    // 목록 페이지에서 해당 사건 링크 클릭 시도
    try {
      const linkText = `${saYear}타경${saSer}`;
      const found = await page.evaluate((text: string) => {
        const links = Array.from(document.querySelectorAll('a'));
        const target = links.find((a) => a.textContent?.includes(text));
        if (target) {
          (target as HTMLElement).click();
          return true;
        }
        return false;
      }, linkText);

      if (found) {
        await new Promise((r) => setTimeout(r, 2000));
        await page.waitForNetworkIdle({ idleTime: 500, timeout: 10000 }).catch(() => {});
      }
    } catch (e) {
      console.warn('[fetchCase] case link click failed:', e);
    }

    const html = await page.content();
    result.detailHtml = html;

    const parsed = parseDetail(html);
    Object.assign(result, parsed);

    // 만약 아무것도 못 찾았으면 에러
    if (
      Object.keys(result.basic).length === 0 &&
      result.rights.length === 0 &&
      result.tenants.length === 0
    ) {
      result.status = 'error';
      result.error = '페이지에서 사건 정보를 찾을 수 없습니다. 사건번호·법원명을 확인하세요.';
    }
  } catch (e: any) {
    result.status = 'error';
    result.error = e.message || String(e);
    console.error('[fetchCase] error:', e);
  } finally {
    if (browser) {
      try { await browser.close(); } catch {}
    }
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
    schedule: [] as string[][],
  };

  $('table').each((_, tableEl) => {
    const $table = $(tableEl);
    const headerText = $table.find('th').map((_, th) => $(th).text().trim()).get().join('|');
    const allText = $table.text();

    if (/사건번호|물건종별|감정평가|최저매각/.test(headerText)) {
      Object.assign(out.basic, parseKeyValueTable($table, $));
    }
    if (/임차인|전입|확정/.test(headerText)) {
      out.tenants.push(...parseGenericTable($table, $));
    }
    if (/접수일|등기|권리종류/.test(headerText) && /채권|금액|권리자/.test(headerText)) {
      out.rights.push(...parseGenericTable($table, $));
    }
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
      const cell: any = cells[i];
      if (cell.name === 'th') {
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
