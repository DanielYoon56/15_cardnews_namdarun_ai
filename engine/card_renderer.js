/**
 * 레퍼런스 스타일 카드뉴스 렌더러 (templates/reference_style.css 기반)
 *
 * spec 형식 (outputs/<folder>/cards/spec.json 에 저장됨):
 * {
 *   handle: '@zip__kok',
 *   slides: [
 *     { type: 'cover',    tag, title, meta, swipe },
 *     { type: 'list',     tag, title, points: [{ title, desc }] },
 *     { type: 'timeline', tag, title, items:  [{ date, sub, title, desc }] },
 *     { type: 'summary',  tag, title, items: ['...'], cta, source }
 *   ]
 * }
 * 제목/텍스트 안의 [[단어]] 는 핑크 하이라이트, 줄바꿈(\n)은 그대로 줄바꿈된다.
 * 배경 이미지는 outputs/<folder>/assets/slide_NN.(png|jpg|jpeg|webp) 를 자동으로 사용한다.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const CSS_PATH = path.join(__dirname, '..', 'templates', 'reference_style.css');
const PRETENDARD = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css';
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

const pad2 = (n) => String(n).padStart(2, '0');

function esc(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
// [[강조]] → 하이라이트, \n → <br>
function rich(s = '') {
  return esc(s).replace(/\[\[(.+?)\]\]/g, '<span class="hl">$1</span>').replace(/\n/g, '<br>');
}

function findSlideImage(assetsDir, page) {
  for (const ext of Object.keys(MIME)) {
    const p = path.join(assetsDir, `slide_${pad2(page)}${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function slideBody(s) {
  const tag = s.tag ? `<div class="tag">${rich(s.tag)}</div>` : '';
  switch (s.type) {
    case 'cover':
      return `${tag}
        <h1 class="hero">${rich(s.title)}</h1>
        <div class="meta-row"><span>${rich(s.meta || '')}</span><span class="swipe">${rich(s.swipe || '밀어서 확인 →')}</span></div>`;
    case 'timeline':
      return `${tag}
        <h2 class="title">${rich(s.title)}</h2>
        <div class="timeline">${(s.items || []).map(it => `
          <div class="tl-item">
            <div class="tl-date">${rich(it.date)}${it.sub ? `<small>${rich(it.sub)}</small>` : ''}</div>
            <div><div class="p-title">${rich(it.title)}</div><div class="p-desc">${rich(it.desc || '')}</div></div>
          </div>`).join('')}
        </div>`;
    case 'summary':
      return `${tag}
        <h2 class="title">${rich(s.title)}</h2>
        <div class="summary">${(s.items || []).map(t => `<div>✔ ${rich(t)}</div>`).join('')}</div>
        ${s.cta ? `<div class="bookmark">${rich(s.cta)}</div>` : ''}
        ${s.source ? `<div class="source">${rich(s.source)}</div>` : ''}`;
    case 'list':
    default: {
      const pts = s.points || [];
      return `${tag}
        <h2 class="title">${rich(s.title)}</h2>
        <div class="points${pts.length >= 5 ? ' compact' : ''}">${pts.map((p, i) => `
          <div class="point">
            <div class="num">${pad2(i + 1)}</div>
            <div><div class="p-title">${rich(p.title)}</div><div class="p-desc">${rich(p.desc || '')}</div></div>
          </div>`).join('')}
        </div>`;
    }
  }
}

function slideHtml(spec, s, index, total, assetsDir) {
  const css = fs.readFileSync(CSS_PATH, 'utf-8');
  const imgPath = findSlideImage(assetsDir, index + 1);
  const bg = imgPath
    ? `<div class="bg" style="background-image:url('data:${MIME[path.extname(imgPath).toLowerCase()]};base64,${fs.readFileSync(imgPath).toString('base64')}')"></div>`
    : '';
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
    <link rel="stylesheet" href="${PRETENDARD}" /><style>${css}</style></head><body>
    <div class="slide ${s.type === 'cover' ? 'cover' : 'body'}">
      ${bg}<div class="shade"></div>
      <div class="top"><span class="brand">${esc(spec.handle || '')}</span><span class="pager">${index + 1}/${total}</span></div>
      <div class="content">${slideBody(s)}</div>
    </div></body></html>`;
}

/**
 * spec → outputs/<folder>/cards/slide_NN.png
 * 렌더링 후 콘텐츠가 캔버스 위로 넘치면 warnings 에 기록한다.
 */
async function renderCards(reportDir, spec, onProgress = () => {}) {
  const cardsDir = path.join(reportDir, 'cards');
  const assetsDir = path.join(reportDir, 'assets');
  fs.mkdirSync(cardsDir, { recursive: true });

  // 이전 렌더 결과 정리 (장수가 줄어든 경우 대비)
  for (const f of fs.readdirSync(cardsDir)) {
    if (/^slide_\d+\.png$/.test(f)) fs.unlinkSync(path.join(cardsDir, f));
  }

  const total = spec.slides.length;
  const browser = await chromium.launch({ headless: true });
  const files = [];
  const warnings = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    for (let i = 0; i < total; i++) {
      await page.setContent(slideHtml(spec, spec.slides[i], i, total, assetsDir), { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const overflowTop = await page.evaluate(() => document.querySelector('.content').getBoundingClientRect().top);
      if (overflowTop < 120) warnings.push(`슬라이드 ${i + 1}: 텍스트가 너무 많아 상단 영역과 겹칩니다 (항목을 줄이거나 슬라이드를 나누세요).`);
      const name = `slide_${pad2(i + 1)}.png`;
      await page.screenshot({ path: path.join(cardsDir, name), type: 'png' });
      files.push(name);
      onProgress(`슬라이드 ${i + 1}/${total} 렌더링 완료`);
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(cardsDir, 'spec.json'), JSON.stringify(spec, null, 2), 'utf-8');
  return { files, warnings };
}

module.exports = { renderCards, findSlideImage };
