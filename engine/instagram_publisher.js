/**
 * 인스타그램 캐러셀 자동 업로드 (Instagram Graph API · Content Publishing)
 *
 * .env 필요 값:
 *   IG_USER_ID       인스타 비즈니스/크리에이터 계정 ID (숫자)
 *   IG_ACCESS_TOKEN  instagram_content_publish 권한이 있는 액세스 토큰
 *                    (EAA... = 페이스북 로그인 → graph.facebook.com / IGAA... = 인스타 로그인 → graph.instagram.com, 자동 판별)
 *   PUBLIC_BASE_URL  인스타 서버가 이미지를 가져갈 수 있는 이 서버의 공개 주소 (예: https://xxxx.ngrok-free.app)
 *                    localhost 는 인스타가 접근할 수 없어 업로드가 실패한다.
 *   IG_GRAPH_VERSION (선택) 기본 v21.0
 *
 * 흐름: cards/slide_NN.png → 1080x1350 JPEG 변환(cards/ig/) → 장별 컨테이너 → 캐러셀 컨테이너 → 게시
 */
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const pad2 = (n) => String(n).padStart(2, '0');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function config() {
  const userId = (process.env.IG_USER_ID || '').trim();
  const token = (process.env.IG_ACCESS_TOKEN || '').trim();
  const publicBase = (process.env.PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
  const version = (process.env.IG_GRAPH_VERSION || 'v21.0').trim();
  const host = token.startsWith('IG') ? 'https://graph.instagram.com' : 'https://graph.facebook.com';
  const missing = [];
  if (!userId) missing.push('IG_USER_ID');
  if (!token) missing.push('IG_ACCESS_TOKEN');
  if (!publicBase) missing.push('PUBLIC_BASE_URL');
  else if (/localhost|127\.0\.0\.1/.test(publicBase)) missing.push('PUBLIC_BASE_URL(localhost 불가)');
  return { userId, token, publicBase, base: `${host}/${version}`, missing };
}

async function graph(method, url, params) {
  const { token } = config();
  try {
    const res = await axios({ method, url, params: { ...params, access_token: token }, timeout: 60000 });
    return res.data;
  } catch (e) {
    const err = e.response?.data?.error;
    throw new Error(err ? `Instagram API 오류: ${err.error_user_msg || err.message} (code ${err.code}${err.error_subcode ? `/${err.error_subcode}` : ''})` : e.message);
  }
}

/** 설정 상태 + 연결된 계정 이름 확인 (토큰 값은 노출하지 않음) */
async function status() {
  const cfg = config();
  const out = { configured: !cfg.missing.length, missing: cfg.missing, publicBase: cfg.publicBase || null, username: null };
  if (cfg.userId && cfg.token) {
    try {
      const me = await graph('get', `${cfg.base}/${cfg.userId}`, { fields: 'username' });
      out.username = me.username || null;
    } catch (e) {
      out.configured = false;
      out.error = e.message;
    }
  }
  return out;
}

/** PNG(2160x2700) → 인스타 규격 JPEG(1080x1350). 인스타 API는 JPEG만 받는다. */
async function toJpegs(cardsDir) {
  const pngs = fs.readdirSync(cardsDir).filter(f => /^slide_\d+\.png$/.test(f)).sort();
  const igDir = path.join(cardsDir, 'ig');
  fs.rmSync(igDir, { recursive: true, force: true });
  fs.mkdirSync(igDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const out = [];
  try {
    const page = await (await browser.newContext({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 })).newPage();
    for (const f of pngs) {
      const b64 = fs.readFileSync(path.join(cardsDir, f)).toString('base64');
      await page.setContent(`<html><body style="margin:0"><img src="data:image/png;base64,${b64}" style="width:1080px;height:1350px;display:block"></body></html>`);
      await page.waitForFunction(() => document.images[0]?.complete);
      const name = f.replace(/\.png$/, '.jpg');
      await page.screenshot({ path: path.join(igDir, name), type: 'jpeg', quality: 92 });
      out.push(name);
    }
  } finally {
    await browser.close();
  }
  return out;
}

async function waitFinished(base, id, label, log) {
  for (let i = 0; i < 40; i++) {
    const { status_code: s } = await graph('get', `${base}/${id}`, { fields: 'status_code' });
    if (s === 'FINISHED' || s === 'PUBLISHED') return;
    if (s === 'ERROR' || s === 'EXPIRED') throw new Error(`${label} 처리 실패 (${s}) — 이미지 URL 접근 가능 여부/JPEG 규격을 확인하세요.`);
    if (i % 5 === 4) log(`  ${label} 처리 대기 중... (${s})`);
    await sleep(3000);
  }
  throw new Error(`${label} 처리 시간 초과`);
}

// ── 작업 ───────────────────────────────────────────────
const jobs = new Map();
let running = false;

function startPublishJob({ reportDir, folder, caption }) {
  if (running) throw new Error('이미 업로드가 진행 중입니다.');
  const cfg = config();
  if (cfg.missing.length) throw new Error(`.env 설정이 필요합니다: ${cfg.missing.join(', ')}`);
  const cardsDir = path.join(reportDir, 'cards');
  const count = fs.existsSync(cardsDir) ? fs.readdirSync(cardsDir).filter(f => /^slide_\d+\.png$/.test(f)).length : 0;
  if (!count) throw new Error('업로드할 카드가 없습니다. 먼저 카드뉴스를 제작하세요.');
  if (count > 10) throw new Error(`인스타 캐러셀은 최대 10장입니다 (현재 ${count}장).`);
  if ((caption || '').length > 2200) throw new Error('캡션은 2,200자 이하여야 합니다.');
  if (((caption || '').match(/#[^\s#]+/g) || []).length > 30) throw new Error('해시태그는 30개 이하여야 합니다.');

  const job = { id: `ig_${Date.now()}`, folder, status: 'running', step: '준비 중...', logs: [], permalink: null, error: null };
  jobs.set(job.id, job);
  const log = (m) => { job.step = m.trim(); job.logs.push(m); };
  running = true;

  (async () => {
    try {
      log('🖼 JPEG 변환 중 (1080x1350)...');
      const jpgs = await toJpegs(cardsDir);
      const v = Date.now();
      const urls = jpgs.map(f => `${cfg.publicBase}/outputs/${folder}/cards/ig/${f}?v=${v}`);

      log('🌐 공개 URL 접근 확인 중...');
      try {
        const r = await axios.get(urls[0], { timeout: 15000, responseType: 'arraybuffer', headers: { 'ngrok-skip-browser-warning': '1' } });
        if (!/image\/jpeg/.test(r.headers['content-type'] || '')) throw new Error(`이미지가 아닌 응답 (${r.headers['content-type']})`);
      } catch (e) {
        throw new Error(`PUBLIC_BASE_URL 로 이미지에 접근할 수 없습니다: ${urls[0]} — ${e.message}`);
      }

      let creationId;
      if (urls.length === 1) {
        log('📤 단일 이미지 컨테이너 생성...');
        creationId = (await graph('post', `${cfg.base}/${cfg.userId}/media`, { image_url: urls[0], caption })).id;
        await waitFinished(cfg.base, creationId, '이미지', log);
      } else {
        const children = [];
        for (let i = 0; i < urls.length; i++) {
          log(`📤 슬라이드 ${i + 1}/${urls.length} 컨테이너 생성...`);
          const { id } = await graph('post', `${cfg.base}/${cfg.userId}/media`, { image_url: urls[i], is_carousel_item: true });
          await waitFinished(cfg.base, id, `슬라이드 ${i + 1}`, log);
          children.push(id);
        }
        log('🧩 캐러셀 컨테이너 생성...');
        creationId = (await graph('post', `${cfg.base}/${cfg.userId}/media`, { media_type: 'CAROUSEL', children: children.join(','), caption })).id;
        await waitFinished(cfg.base, creationId, '캐러셀', log);
      }

      log('🚀 게시 중...');
      const { id: mediaId } = await graph('post', `${cfg.base}/${cfg.userId}/media_publish`, { creation_id: creationId });
      try {
        job.permalink = (await graph('get', `${cfg.base}/${mediaId}`, { fields: 'permalink' })).permalink || null;
      } catch { /* 게시는 성공 — 링크 조회만 실패 */ }

      fs.writeFileSync(path.join(cardsDir, 'ig', 'published.json'),
        JSON.stringify({ mediaId, permalink: job.permalink, publishedAt: new Date().toISOString(), slides: urls.length }, null, 2));
      job.status = 'done';
      log(`✅ 게시 완료 (${urls.length}장)${job.permalink ? ` ${job.permalink}` : ''}`);
    } catch (e) {
      job.status = 'error';
      job.error = e.message;
      log(`❌ 실패: ${e.message}`);
    } finally {
      running = false;
    }
  })();
  return job;
}

module.exports = { status, startPublishJob, getJob: (id) => jobs.get(id) };
