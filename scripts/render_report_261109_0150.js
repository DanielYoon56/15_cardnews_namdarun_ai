const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// 레퍼런스 스타일: 풀블리드 사진 + 하단 그라데이션 + 핑크 태그박스 + 화이트 볼드 헤드라인(핑크 하이라이트)
async function renderCardNews(reportDir) {
  const cardsDir = path.join(reportDir, 'cards');
  const assetsDir = path.join(reportDir, 'assets');
  fs.mkdirSync(cardsDir, { recursive: true });

  const img = (n) => {
    const base = path.join(assetsDir, `slide_${String(n).padStart(2, '0')}`);
    for (const [ext, mime] of [['.png', 'image/png'], ['.jpg', 'image/jpeg']]) {
      if (fs.existsSync(base + ext)) return `data:${mime};base64,${fs.readFileSync(base + ext).toString('base64')}`;
    }
    return null;
  };

  const TOTAL = 6;
  const HANDLE = '@zip__kok';

  const points = (items) => `
    <div class="points">
      ${items.map((p, i) => `
        <div class="point">
          <div class="num">${String(i + 1).padStart(2, '0')}</div>
          <div>
            <div class="p-title">${p.t}</div>
            <div class="p-desc">${p.d}</div>
          </div>
        </div>`).join('')}
    </div>`;

  const slides = [
    {
      page: 1, cover: true,
      body: `
        <div class="tag">조작기소 특검법 정국, 이번 주 일정 한눈에</div>
        <h1 class="hero">국민의힘, 오늘<br><span class="hl">청와대 앞</span> 현장 최고위</h1>
        <div class="meta-row">
          <span>2026.11.09 (월) · 정치 브리핑</span>
          <span class="swipe">밀어서 쟁점 정리 →</span>
        </div>`
    },
    {
      page: 2,
      body: `
        <div class="tag">WHAT HAPPENED · 무슨 일이?</div>
        <h2 class="title"><span class="hl">특검법</span>,<br>국회 문턱 넘었다</h2>
        ${points([
          { t: '민주당, 필리버스터 강제 종결', d: '국민의힘의 무제한 토론을 종결하고 \'조작기소 특검법\'을 국회 본회의에서 통과시켰습니다.' },
          { t: '국민의힘, 7일 장외 규탄대회', d: '서울 경복궁역 앞 \'이재명 재판 취소 악법 강행 처리 국민 규탄 대회\' 개최. 소속 의원 70여 명 참석 (당 추산 15만 명).' },
        ])}`
    },
    {
      page: 3,
      body: `
        <div class="tag">SCHEDULE · 이번 주 일정</div>
        <h2 class="title">청와대 앞<br><span class="hl">이틀 연속</span> 현장 행보</h2>
        <div class="timeline">
          <div class="tl-item">
            <div class="tl-date">11.9<small>월 · 오늘</small></div>
            <div class="tl-body">
              <div class="p-title">현장 최고위원회의 → 1인 시위</div>
              <div class="p-desc">장동혁 대표, 정점식 원내대표, 최고위원 등 당 지도부 참석</div>
            </div>
          </div>
          <div class="tl-item">
            <div class="tl-date">11.10<small>화</small></div>
            <div class="tl-body">
              <div class="p-title">현장 의원총회</div>
              <div class="p-desc">특검법의 국무회의 통과가 예상되는 날, 청와대 앞에서 의원총회 개최 예정</div>
            </div>
          </div>
        </div>`
    },
    {
      page: 4,
      body: `
        <div class="tag">국민의힘 입장</div>
        <h2 class="title">"이재명<br><span class="hl">탈옥법</span>"</h2>
        ${points([
          { t: '장동혁 대표', d: '"국민을 배신한 대통령은 이제 탄핵만이 답"' },
          { t: '공소취소 조항 삭제에도 반대', d: '특검 추진 자체가 재판 취소로 이어질 수 있다고 주장' },
          { t: '"프레임을 바꿔야"', d: '8일 유튜브 인터뷰에서 “이재명 죄를 지우기 위한 특검”으로 프레임을 바꿔야 한다고 발언' },
        ])}`
    },
    {
      page: 5,
      body: `
        <div class="tag">더불어민주당 입장</div>
        <h2 class="title">"정치검찰<br><span class="hl">방탄 시위</span>"</h2>
        ${points([
          { t: '국회 복귀 촉구', d: '국민의힘 장외 집회를 \'정치검찰 방탄 시위\'로 규정하며 국회 복귀를 요구' },
          { t: '"반대 명분 없다"', d: '공소취소 조항이 삭제된 만큼 국민의힘이 반대할 명분이 없다고 반박' },
          { t: '"내란 잔당의 적반하장"', d: '국민의힘의 탄핵 주장에 강하게 맞서며 여야 대치 격화' },
        ])}`
    },
    {
      page: 6, cta: true,
      body: `
        <div class="tag">3줄 요약</div>
        <h2 class="title">오늘의 정국<br><span class="hl">3줄 요약</span></h2>
        <div class="summary">
          <div>✔ 특검법 국회 통과 → 국민의힘 장외 규탄 지속</div>
          <div>✔ 9일 청와대 앞 현장 최고위·1인 시위, 10일 현장 의총</div>
          <div>✔ 여야 공방 격화… <b>10일 국무회의</b> 결과 주목</div>
        </div>
        <div class="bookmark">🔖 저장해두고 다음 소식 이어서 받아보세요</div>
        <div class="source">출처: KBS · 한국일보 · 뉴스토마토 · 신아일보 보도 종합</div>`
    },
  ];

  const css = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 1080px; height: 1350px; font-family: 'Pretendard', -apple-system, system-ui, sans-serif;
      word-break: keep-all; letter-spacing: -0.03em; color: #fff; background: #0F1115; }
    .slide { position: relative; width: 1080px; height: 1350px; overflow: hidden; }
    .bg { position: absolute; inset: 0; background-size: cover; background-position: center; }
    .shade { position: absolute; inset: 0; }
    .cover .shade { background: linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.88) 100%); }
    .body .shade { background: linear-gradient(180deg, rgba(10,10,14,0.55) 0%, rgba(10,10,14,0.45) 30%, rgba(10,10,14,0.85) 62%, rgba(10,10,14,0.95) 100%); }
    .top { position: absolute; top: 56px; left: 64px; right: 64px; display: flex; justify-content: space-between; align-items: center; z-index: 2; }
    .brand { font-size: 30px; font-weight: 900; color: #F7A8CB; letter-spacing: -0.02em; text-shadow: 0 2px 10px rgba(0,0,0,.4); }
    .pager { background: rgba(40,40,46,0.6); backdrop-filter: blur(8px); padding: 10px 22px; border-radius: 999px; font-size: 24px; font-weight: 700; }
    .content { position: absolute; left: 72px; right: 72px; bottom: 110px; z-index: 2; }
    .tag { display: inline-block; background: rgba(214, 96, 150, 0.92); color: #fff; font-size: 30px; font-weight: 800;
      padding: 10px 20px; border-radius: 6px; margin-bottom: 30px; }
    .hero { font-size: 92px; font-weight: 900; line-height: 1.2; letter-spacing: -0.04em; text-shadow: 0 4px 24px rgba(0,0,0,.45); }
    .title { font-size: 82px; font-weight: 900; line-height: 1.18; letter-spacing: -0.04em; text-shadow: 0 4px 24px rgba(0,0,0,.45); margin-bottom: 44px; }
    .hl { color: #F7A8CB; }
    .meta-row { margin-top: 40px; display: flex; justify-content: space-between; font-size: 26px; font-weight: 600; color: rgba(255,255,255,.8); }
    .swipe { color: #F7A8CB; font-weight: 800; }
    .points { display: flex; flex-direction: column; gap: 20px; }
    .point { display: flex; gap: 26px; align-items: flex-start; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.14);
      backdrop-filter: blur(10px); border-radius: 22px; padding: 28px 32px; }
    .num { flex: none; width: 58px; height: 58px; border-radius: 50%; background: #F7A8CB; color: #1a1014; font-size: 24px; font-weight: 900;
      display: flex; align-items: center; justify-content: center; }
    .p-title { font-size: 34px; font-weight: 800; line-height: 1.3; margin-bottom: 8px; }
    .p-desc { font-size: 26px; font-weight: 500; line-height: 1.5; color: rgba(255,255,255,.82); }
    .timeline { display: flex; flex-direction: column; gap: 22px; }
    .tl-item { display: flex; gap: 30px; align-items: stretch; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.14);
      border-radius: 22px; padding: 30px 32px; }
    .tl-date { flex: none; width: 170px; font-size: 54px; font-weight: 900; color: #F7A8CB; line-height: 1.05; border-right: 2px solid rgba(255,255,255,.18); }
    .tl-date small { display: block; font-size: 24px; font-weight: 700; color: rgba(255,255,255,.75); margin-top: 8px; }
    .summary { background: rgba(255,255,255,0.09); border: 1px solid rgba(255,255,255,0.16); border-radius: 22px; padding: 34px 36px;
      display: flex; flex-direction: column; gap: 20px; font-size: 31px; font-weight: 700; line-height: 1.4; }
    .summary b { color: #F7A8CB; }
    .bookmark { margin-top: 26px; border: 3px dashed #F7A8CB; border-radius: 20px; padding: 26px; text-align: center; font-size: 32px; font-weight: 800; }
    .source { margin-top: 22px; font-size: 20px; font-weight: 500; color: rgba(255,255,255,.55); text-align: center; }
  `;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const files = [];

  for (const s of slides) {
    const bg = img(s.page);
    const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css" />
      <style>${css}</style></head><body>
      <div class="slide ${s.cover ? 'cover' : 'body'}">
        ${bg ? `<div class="bg" style="background-image:url('${bg}')"></div>` : ''}
        <div class="shade"></div>
        <div class="top"><span class="brand">${HANDLE}</span><span class="pager">${s.page}/${TOTAL}</span></div>
        <div class="content">${s.body}</div>
      </div></body></html>`;
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const out = path.join(cardsDir, `slide_${String(s.page).padStart(2, '0')}.png`);
    await page.screenshot({ path: out, type: 'png' });
    console.log(`[Renderer] ${out}`);
    files.push(out);
  }
  await browser.close();
  return files;
}

const targetReportDir = process.argv[2] || path.join(__dirname, '../outputs/261109_0150');
renderCardNews(targetReportDir)
  .then(files => { console.log(`🎉 ${files.length}장 완료`); process.exit(0); })
  .catch(err => { console.error('렌더링 에러:', err); process.exit(1); });
