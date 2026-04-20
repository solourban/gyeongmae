"""
법원경매정보 크롤러 + 권리분석기
─────────────────────────────────────────────
사건번호만 입력하면 대법원 경매정보에서 물건정보·등기부·임차인 현황을
긁어와서 말소기준권리·인수소멸·대항력·배당까지 자동 분석합니다.

사용법:
    python crawler.py 2024 10044 "대전지방법원"
    python crawler.py 2024 100447 "부산지방법원 동부지원"

필요 패키지:
    pip install playwright beautifulsoup4 lxml
    playwright install chromium

주의:
    - 법원경매정보 사이트는 iframe 구조입니다.
    - 긁은 HTML 구조는 언제든 바뀔 수 있으니 에러 나면 먼저 HTML을 확인하세요.
    - 개인 학습 목적 외에는 사이트 약관을 확인하세요.
"""

import asyncio
import json
import sys
import re
import urllib.parse
from datetime import datetime
from pathlib import Path

from playwright.async_api import async_playwright
from bs4 import BeautifulSoup


# ═══════════════════════════════════════════════════════════
# 1. 크롤링 파트
# ═══════════════════════════════════════════════════════════

async def fetch_case(sa_year: str, sa_ser: str, jiwon_nm: str, headless: bool = True,
                     save_html_to: str = None) -> dict:
    """
    사건번호로 법원경매정보 상세 페이지를 긁어 dict로 반환합니다.

    :param sa_year:  사건 연도 (예: "2024")
    :param sa_ser:   사건 번호 (예: "10044")
    :param jiwon_nm: 법원명 (예: "대전지방법원", "부산지방법원 동부지원")
    :param headless: True면 브라우저 화면 안 뜸. 디버깅 시 False.
    :param save_html_to: 긁은 HTML을 저장할 디렉토리 (디버깅용)
    """
    # 법원명은 EUC-KR로 URL 인코딩 — 대법원 사이트가 그렇게 먹음
    jiwon_enc = urllib.parse.quote(jiwon_nm.encode('euc-kr'))

    # 사건번호로 직접 진입하는 URL (상세내역 조회 엔트리포인트)
    url = (
        "https://www.courtauction.go.kr/RetrieveRealEstDetailInqSaList.laf"
        f"?jiwonNm={jiwon_enc}"
        f"&saYear={sa_year}"
        f"&saSer={sa_ser}"
        "&_CUR_CMD=InitMulSrch.laf"
        "&_SRCH_SRNID=PNO102014"
        "&_NEXT_CMD=RetrieveRealEstDetailInqSaList.laf"
    )

    result = {
        'case_no': f"{sa_year}타경{sa_ser}",
        'court': jiwon_nm,
        'url': url,
        'fetched_at': datetime.now().isoformat(),
        'status': 'init',
        'basic': {},
        'rights': [],
        'tenants': [],
        'schedule': [],
        'raw_html': {},
    }

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless)
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                       'AppleWebKit/537.36 (KHTML, like Gecko) '
                       'Chrome/120.0.0.0 Safari/537.36',
            locale='ko-KR',
        )
        page = await context.new_page()

        try:
            await page.goto(url, timeout=30000, wait_until='networkidle')
            await asyncio.sleep(2)

            # 첫 화면이 사건 목록(해당 사건만 1건)인 경우가 많음 — 클릭해서 상세로
            # 사건번호 링크를 찾아 클릭
            content = await page.content()
            if save_html_to:
                Path(save_html_to).mkdir(parents=True, exist_ok=True)
                (Path(save_html_to) / 'step1_search.html').write_text(content, encoding='utf-8')

            # 목록 테이블에서 해당 사건 링크 찾기
            try:
                # 링크 텍스트가 "년타경번호" 패턴인 것을 찾음
                case_link = page.locator(f"text={sa_year}타경{sa_ser}").first
                if await case_link.count() > 0:
                    await case_link.click()
                    await asyncio.sleep(2)
                else:
                    # 이미 상세 페이지에 있을 수도 있음
                    pass
            except Exception as e:
                print(f"[경고] 사건 목록에서 링크 클릭 실패: {e}")

            detail_html = await page.content()
            result['raw_html']['detail'] = detail_html
            if save_html_to:
                (Path(save_html_to) / 'step2_detail.html').write_text(detail_html, encoding='utf-8')

            # ── 파싱 ──
            parsed = parse_detail(detail_html)
            result.update(parsed)
            result['status'] = 'ok'

        except Exception as e:
            result['status'] = 'error'
            result['error'] = str(e)
            print(f"[에러] {e}")

        finally:
            await browser.close()

    return result


# ═══════════════════════════════════════════════════════════
# 2. 파싱 파트
# ═══════════════════════════════════════════════════════════

def parse_detail(html: str) -> dict:
    """
    상세 페이지 HTML에서 기본정보·등기부·임차인·기일을 추출합니다.
    대법원 경매정보는 table 기반 레이아웃이 많아 header 매칭으로 뽑습니다.
    """
    soup = BeautifulSoup(html, 'lxml')
    out = {'basic': {}, 'rights': [], 'tenants': [], 'schedule': []}

    # ── 기본정보 테이블 ──
    # 통상적으로 "사건번호", "물건종별", "감정평가액", "최저매각가격" 등의 th가 있음
    for table in soup.find_all('table'):
        headers = [th.get_text(strip=True) for th in table.find_all('th')]
        if any(h in headers for h in ['사건번호', '물건종별', '감정평가액']):
            out['basic'].update(parse_key_value_table(table))

        # 임차인 현황 테이블
        if '임차인' in ''.join(headers) or '전입' in ''.join(headers):
            out['tenants'].extend(parse_tenant_table(table))

        # 등기부 요약 (권리종류·접수일자·권리자·채권액 열)
        if all(h in ''.join(headers) for h in ['접수일']) and any(
                k in ''.join(headers) for k in ['권리종류', '등기']):
            out['rights'].extend(parse_rights_table(table))

        # 기일 내역
        if '매각기일' in ''.join(headers) or '유찰' in ''.join(headers):
            out['schedule'].extend(parse_schedule_table(table))

    return out


def parse_key_value_table(table) -> dict:
    """th-td가 번갈아 나오는 기본정보 테이블을 dict로 변환"""
    d = {}
    for tr in table.find_all('tr'):
        cells = tr.find_all(['th', 'td'])
        i = 0
        while i < len(cells) - 1:
            if cells[i].name == 'th':
                key = cells[i].get_text(strip=True)
                val = cells[i + 1].get_text(' ', strip=True)
                if key and val:
                    d[key] = val
                i += 2
            else:
                i += 1
    return d


def parse_tenant_table(table) -> list:
    """임차인 현황 테이블 파싱"""
    results = []
    header_row = table.find('tr')
    if not header_row:
        return results
    headers = [th.get_text(strip=True) for th in header_row.find_all(['th', 'td'])]

    for tr in table.find_all('tr')[1:]:
        cells = [td.get_text(' ', strip=True) for td in tr.find_all('td')]
        if len(cells) < 2:
            continue
        if '없음' in ''.join(cells) or '조사된' in ''.join(cells):
            continue
        row = dict(zip(headers, cells))
        results.append(row)
    return results


def parse_rights_table(table) -> list:
    """등기부 권리 테이블 파싱"""
    results = []
    header_row = table.find('tr')
    if not header_row:
        return results
    headers = [th.get_text(strip=True) for th in header_row.find_all(['th', 'td'])]

    for tr in table.find_all('tr')[1:]:
        cells = [td.get_text(' ', strip=True) for td in tr.find_all('td')]
        if len(cells) < 2:
            continue
        row = dict(zip(headers, cells))
        # 말소기준 행 표시
        row_text = ''.join(cells)
        row['_is_malso_hint'] = ('말소기준' in row_text)
        results.append(row)
    return results


def parse_schedule_table(table) -> list:
    """기일내역 (매각기일, 최저가, 결과) 테이블 파싱"""
    results = []
    for tr in table.find_all('tr')[1:]:
        cells = [td.get_text(' ', strip=True) for td in tr.find_all('td')]
        if len(cells) >= 3:
            results.append(cells)
    return results


# ═══════════════════════════════════════════════════════════
# 3. 권리분석 엔진 (JS 버전과 동일 로직)
# ═══════════════════════════════════════════════════════════

MALSO_CANDIDATES = ['근저당', '저당', '가압류', '압류', '담보가등기', '경매개시결정']
ALWAYS_INHERIT = ['유치권', '법정지상권', '분묘기지권']

CHOI_U_SEON = {
    'seoul':       (165_000_000, 55_000_000),
    'overcrowded': (145_000_000, 48_000_000),
    'metro':        (85_000_000, 28_000_000),
    'other':        (75_000_000, 25_000_000),
}


def parse_money(s: str) -> int:
    """'109,200,000원' → 109200000"""
    if not s:
        return 0
    digits = re.sub(r'[^0-9]', '', str(s))
    return int(digits) if digits else 0


def normalize_date(s: str) -> str:
    """'2015-12-07' / '2015.12.07' → '2015-12-07'"""
    if not s:
        return ''
    m = re.search(r'(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})', str(s))
    if m:
        y, mo, d = m.groups()
        return f"{y}-{int(mo):02d}-{int(d):02d}"
    return s


def normalize_rights(raw_rights: list) -> list:
    """크롤링된 등기부 행을 분석 가능한 형태로 정규화"""
    normalized = []
    for r in raw_rights:
        # 헤더 키가 사이트에 따라 조금씩 다름 — 여러 후보를 시도
        date = r.get('접수일자') or r.get('접수일') or r.get('접수') or ''
        kind = r.get('권리종류') or r.get('등기명의인') or r.get('등기') or ''
        holder = r.get('권리자') or r.get('등기명의인') or ''
        amount = r.get('채권금액') or r.get('채권최고액') or r.get('금액') or ''

        if not date and not kind:
            continue

        normalized.append({
            'date': normalize_date(date),
            'type': kind.strip(),
            'holder': holder.strip(),
            'amount': parse_money(amount),
            'raw': r,
        })
    return normalized


def find_malso(rights: list) -> dict:
    """말소기준권리 자동 판정"""
    candidates = [r for r in rights
                  if any(k in r['type'] for k in MALSO_CANDIDATES)]
    if not candidates:
        return None
    candidates.sort(key=lambda r: r['date'])
    return candidates[0]


def analyze_rights(rights: list, malso: dict) -> list:
    """각 권리의 인수/소멸 판정"""
    sorted_rights = sorted(rights, key=lambda r: r['date'])
    results = []
    for r in sorted_rights:
        out = dict(r)
        if any(k in r['type'] for k in ALWAYS_INHERIT):
            out['status'] = '인수'
            out['reason'] = f"{r['type']}은(는) 경매로 소멸되지 않는 특수권리"
        elif not malso:
            out['status'] = '?'
            out['reason'] = '말소기준권리 없음 — 수동 검토 필요'
        elif r is malso:
            out['status'] = '소멸'
            out['reason'] = '말소기준권리 본인 — 매각으로 소멸'
            out['is_malso'] = True
        elif r['date'] < malso['date']:
            out['status'] = '인수'
            out['reason'] = '말소기준보다 선순위 → 낙찰자 인수'
        else:
            out['status'] = '소멸'
            out['reason'] = '말소기준 이후 → 매각으로 소멸'
        results.append(out)
    return results


def analyze_tenants(raw_tenants: list, malso: dict) -> list:
    """임차인 대항력 판정"""
    results = []
    for t in raw_tenants:
        move_in = normalize_date(t.get('전입신고일자') or t.get('전입일') or t.get('전입') or '')
        fixed = normalize_date(t.get('확정일자') or '')
        deposit = parse_money(t.get('보증금') or t.get('임차보증금') or '')

        if not move_in:
            continue

        entry = {
            'name': t.get('임차인') or t.get('성명') or '',
            'move_in': move_in,
            'fixed': fixed,
            'deposit': deposit,
            'raw': t,
        }
        if not malso:
            entry['daehang'] = '?'
            entry['reason'] = '말소기준 없음'
        elif move_in < malso['date']:
            entry['daehang'] = '있음'
            entry['reason'] = f"전입({move_in}) < 말소기준({malso['date']}) → 대항력 있음"
        else:
            entry['daehang'] = '없음'
            entry['reason'] = f"전입({move_in}) ≥ 말소기준({malso['date']}) → 대항력 없음"
        results.append(entry)
    return results


def simulate_baedang(bid_price: int, rights: list, tenants: list, region: str = 'other') -> dict:
    """배당 시뮬레이션"""
    remain = bid_price
    allocations = []

    # ① 집행비용 (매각대금 3%)
    cost = round(bid_price * 0.03)
    allocations.append({'order': 1, 'label': '경매집행비용(추정 3%)', 'amount': cost})
    remain -= cost
    if remain < 0:
        remain = 0

    # ② 소액임차인 최우선변제
    limit, max_amt = CHOI_U_SEON.get(region, CHOI_U_SEON['other'])
    half = bid_price // 2
    choi_total = 0
    for t in tenants:
        if t['deposit'] <= limit:
            allow = min(t['deposit'], max_amt, half - choi_total)
            allow = max(0, allow)
            if allow > 0:
                allocations.append({
                    'order': 2,
                    'label': f"소액임차인 최우선변제 ({t['name'] or '임차인'})",
                    'amount': allow,
                })
                t['_choi'] = allow
                choi_total += allow
            else:
                t['_choi'] = 0
        else:
            t['_choi'] = 0
    remain -= choi_total
    if remain < 0:
        remain = 0

    # ③ 담보물권 + 확정일자 임차인 날짜순
    priority = []
    for r in rights:
        if any(k in r['type'] for k in ['근저당', '저당', '전세권', '담보가등기']) and r.get('status') == '소멸':
            priority.append({
                'kind': 'right', 'date': r['date'],
                'label': f"{r['type']} ({r['holder']})",
                'amount': r['amount'], 'ref': r,
            })
    for t in tenants:
        if t.get('fixed'):
            remain_dep = max(0, t['deposit'] - t.get('_choi', 0))
            if remain_dep > 0:
                wuseon = max(t['fixed'], t['move_in'])
                priority.append({
                    'kind': 'tenant', 'date': wuseon,
                    'label': f"임차인 우선변제 ({t['name'] or '-'})",
                    'amount': remain_dep, 'ref': t,
                })
    priority.sort(key=lambda p: p['date'])

    for p in priority:
        if remain <= 0:
            break
        pay = min(p['amount'], remain)
        allocations.append({
            'order': 3,
            'label': f"{p['label']} — {p['date']}",
            'amount': pay,
        })
        if p['kind'] == 'tenant':
            p['ref']['_baedang'] = p['ref'].get('_baedang', 0) + pay
        else:
            p['ref']['_baedang'] = p['ref'].get('_baedang', 0) + pay
        remain -= pay

    return {'bid_price': bid_price, 'allocations': allocations, 'surplus': remain}


def calculate_inherited(rights: list, tenants: list) -> dict:
    """낙찰자 인수금액"""
    items = []
    total = 0
    for r in rights:
        if r.get('status') == '인수':
            items.append({
                'label': f"{r['type']} ({r['holder']})",
                'amount': r['amount'],
                'note': '선순위 권리 인수' if not any(k in r['type'] for k in ALWAYS_INHERIT) else '특수권리'
            })
            total += r['amount']
    for t in tenants:
        if t.get('daehang') == '있음':
            received = t.get('_choi', 0) + t.get('_baedang', 0)
            unpaid = max(0, t['deposit'] - received)
            if unpaid > 0:
                items.append({
                    'label': f"대항력 임차인 미배당 ({t['name']})",
                    'amount': unpaid,
                    'note': '낙찰자 인수'
                })
                total += unpaid
    return {'total': total, 'items': items}


def assess_risk(rights: list, tenants: list, inherited: dict, min_bid: int) -> dict:
    """위험도 종합 평가"""
    flags = []
    level = 'ok'

    special = [r for r in rights if any(k in r['type'] for k in ALWAYS_INHERIT)]
    if special:
        flags.append({'sev': 'danger',
                      'msg': f"특수권리 {len(special)}건 — {', '.join(r['type'] for r in special)}"})
        level = 'danger'

    daehang = [t for t in tenants if t.get('daehang') == '있음']
    if daehang:
        sev = 'danger' if inherited['total'] > 0 else 'warn'
        flags.append({'sev': sev, 'msg': f"대항력 임차인 {len(daehang)}명"})
        if level == 'ok':
            level = 'warn'

    if inherited['total'] > 0 and min_bid:
        ratio = inherited['total'] / min_bid
        if ratio >= 0.3:
            flags.append({'sev': 'danger',
                          'msg': f"인수금액이 최저가의 {ratio*100:.0f}% — 매우 부담"})
            level = 'danger'
        elif ratio >= 0.05:
            flags.append({'sev': 'warn',
                          'msg': f"인수금액이 최저가의 {ratio*100:.0f}% — 투자비 재계산"})
            if level == 'ok':
                level = 'warn'

    if not flags:
        flags.append({'sev': 'ok', 'msg': '권리관계 깨끗함'})

    return {'level': level, 'flags': flags}


# ═══════════════════════════════════════════════════════════
# 4. 메인 분석 래퍼
# ═══════════════════════════════════════════════════════════

def analyze_case(raw_data: dict, region: str = 'other') -> dict:
    """크롤링 결과 dict를 받아 권리분석 리포트를 생성"""
    rights = normalize_rights(raw_data.get('rights', []))
    malso = find_malso(rights)
    analyzed_rights = analyze_rights(rights, malso)
    tenants = analyze_tenants(raw_data.get('tenants', []), malso)

    # 최저가 추출
    basic = raw_data.get('basic', {})
    min_bid = parse_money(basic.get('최저매각가격') or basic.get('최저가') or '')
    appraisal = parse_money(basic.get('감정평가액') or basic.get('감정가') or '')

    baedang = simulate_baedang(min_bid or appraisal or 100_000_000, analyzed_rights, tenants, region)
    inherited = calculate_inherited(analyzed_rights, tenants)
    risk = assess_risk(analyzed_rights, tenants, inherited, min_bid)

    return {
        'case': raw_data.get('case_no'),
        'court': raw_data.get('court'),
        'basic': basic,
        'malso': malso,
        'rights': analyzed_rights,
        'tenants': tenants,
        'baedang_at_min_bid': baedang,
        'inherited': inherited,
        'risk': risk,
        'url': raw_data.get('url'),
    }


# ═══════════════════════════════════════════════════════════
# 5. 리포트 출력
# ═══════════════════════════════════════════════════════════

def print_report(report: dict):
    """콘솔에 사람이 읽기 좋은 리포트 출력"""
    def won(n):
        if not n:
            return '-'
        억 = n // 100_000_000
        만 = (n % 100_000_000) // 10_000
        parts = []
        if 억:
            parts.append(f"{억}억")
        if 만:
            parts.append(f"{만:,}만")
        return (' '.join(parts) or '0') + '원'

    print("═" * 70)
    print(f"  경매 권리분석 리포트 — {report['case']}  [{report['court']}]")
    print("═" * 70)

    basic = report['basic']
    if basic:
        print("\n【 기본정보 】")
        for k in ['소재지', '물건종별', '감정평가액', '최저매각가격', '유찰횟수']:
            if basic.get(k):
                print(f"  {k:<12}: {basic[k]}")

    print(f"\n【 위험도: {report['risk']['level'].upper()} 】")
    for f in report['risk']['flags']:
        icon = {'ok': '✓', 'warn': '⚠', 'danger': '🚨'}[f['sev']]
        print(f"  {icon} {f['msg']}")

    if report['malso']:
        m = report['malso']
        print(f"\n【 말소기준권리 】")
        print(f"  {m['date']} · {m['type']} · {m['holder']} · {won(m['amount'])}")

    print(f"\n【 등기부 권리 분석 ({len(report['rights'])}건) 】")
    for r in report['rights']:
        flag = ' ★말소기준' if r.get('is_malso') else ''
        print(f"  [{r['status']}]{flag} {r['date']} · {r['type']} · {r['holder']} · {won(r['amount'])}")
        print(f"         └ {r['reason']}")

    if report['tenants']:
        print(f"\n【 임차인 대항력 ({len(report['tenants'])}명) 】")
        for t in report['tenants']:
            print(f"  [{t['daehang']}] {t['name']} · 전입 {t['move_in']} · 확정 {t['fixed'] or '-'} · 보증금 {won(t['deposit'])}")
            print(f"         └ {t['reason']}")
    else:
        print(f"\n【 임차인 】 없음 또는 조사되지 않음")

    print(f"\n【 낙찰자 인수금액 】 {won(report['inherited']['total'])}")
    for i in report['inherited']['items']:
        print(f"  · {i['label']} — {won(i['amount'])} ({i['note']})")

    print(f"\n【 배당 시뮬레이션 (최저가 기준) 】")
    for a in report['baedang_at_min_bid']['allocations']:
        print(f"  {a['order']}순위 · {a['label']} — {won(a['amount'])}")
    surplus = report['baedang_at_min_bid']['surplus']
    if surplus > 0:
        print(f"  잉여: {won(surplus)}")

    print("\n" + "═" * 70)


# ═══════════════════════════════════════════════════════════
# 6. CLI 엔트리
# ═══════════════════════════════════════════════════════════

async def main_async():
    if len(sys.argv) < 4:
        print("사용법: python crawler.py <연도> <사건번호> <법원명> [--show] [--region seoul|overcrowded|metro|other]")
        print("예시:   python crawler.py 2024 10044 대전지방법원")
        print("       python crawler.py 2024 100447 '부산지방법원 동부지원' --show")
        sys.exit(1)

    sa_year = sys.argv[1]
    sa_ser = sys.argv[2]
    jiwon_nm = sys.argv[3]
    headless = '--show' not in sys.argv
    region = 'other'
    if '--region' in sys.argv:
        idx = sys.argv.index('--region')
        if idx + 1 < len(sys.argv):
            region = sys.argv[idx + 1]

    out_dir = Path(f"./out/{sa_year}-{sa_ser}")
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"[1/3] {jiwon_nm} {sa_year}타경{sa_ser} 크롤링 시작 ...")
    raw = await fetch_case(sa_year, sa_ser, jiwon_nm, headless=headless,
                           save_html_to=str(out_dir))

    if raw['status'] != 'ok':
        print(f"[실패] {raw.get('error', '알 수 없는 에러')}")
        sys.exit(2)

    # 원본 JSON 저장 (raw_html 제외)
    raw_saveable = {k: v for k, v in raw.items() if k != 'raw_html'}
    (out_dir / 'raw.json').write_text(
        json.dumps(raw_saveable, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"      → {out_dir}/raw.json 저장됨")

    print(f"[2/3] 권리분석 중 ...")
    report = analyze_case(raw, region=region)
    (out_dir / 'report.json').write_text(
        json.dumps(report, ensure_ascii=False, indent=2, default=str), encoding='utf-8')

    print(f"[3/3] 리포트 출력:\n")
    print_report(report)

    print(f"\n파일: {out_dir}/report.json")


def main():
    asyncio.run(main_async())


if __name__ == '__main__':
    main()
