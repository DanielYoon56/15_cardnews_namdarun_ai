/**
 * createCardNews 파이프라인 (대시보드용)
 * .claude/skills/createCardNews/SKILL.md 의 규칙을 서버에서 그대로 수행한다.
 *   1) report.md (+ 사용자가 붙여넣은 추가 자료) → 슬라이드 대본 spec (OpenAI, JSON)
 *   2) 슬라이드별 배경 이미지 생성 (OpenAI 이미지 모델) → assets/slide_NN.png
 *   3) 레퍼런스 스타일 렌더링 → cards/slide_NN.png + cards/spec.json
 */
require('dotenv').config({ quiet: true });
const OpenAI = require('openai');
const path = require('path');
const fs = require('fs');
const { renderCards, findSlideImage } = require('./card_renderer');

const OUTPUTS_DIR = path.join(__dirname, '..', 'outputs');
const TEXT_MODEL = process.env.CARDNEWS_TEXT_MODEL || 'gpt-5.4-mini';
const IMAGE_MODEL = process.env.CARDNEWS_IMAGE_MODEL || 'gpt-image-2';
const DEFAULT_HANDLE = process.env.CARDNEWS_HANDLE || '@zip__kok';

const FOLDER_RE = /^[A-Za-z0-9_-]+$/;
const pad2 = (n) => String(n).padStart(2, '0');

function client() {
  const key = process.env.OPENAI_API_KEY;
  if (!key || !key.trim()) throw new Error('.env 에 OPENAI_API_KEY 가 없습니다.');
  return new (OpenAI.default || OpenAI)({ apiKey: key.trim() });
}

function resolveFolder(folder) {
  if (!folder || !FOLDER_RE.test(folder)) throw new Error('잘못된 폴더 이름입니다.');
  const dir = path.join(OUTPUTS_DIR, folder);
  if (!fs.existsSync(dir)) throw new Error(`폴더가 없습니다: outputs/${folder}`);
  return dir;
}

// ── 1. 대본 ─────────────────────────────────────────────
const SCRIPT_RULES = `너는 인스타그램 카드뉴스 에디터다. 아래 리포트와 추가 자료만을 근거로 캐러셀 대본을 JSON으로 만든다.

[절대 규칙]
- 사실을 지어내지 않는다. 리포트/추가 자료에 없는 수치·날짜·인용·사건은 쓰지 않는다.
- 리포트의 "AI 기획 대본"이 일반론/플레이스홀더(예: "핵심 수치 데이터 및 동향", 주제와 무관한 투자·자금 조언)면 무시하고 원문 사실로 다시 쓴다.
- 리포트의 카테고리 라벨(예: "부동산")이 실제 주제와 다르면 실제 주제를 따른다.
- 정치·사회 이슈는 중립을 지킨다. 주장은 반드시 주체를 밝혀 인용하고("○○당은 ~라고 주장"), 상대측 입장이 자료에 있으면 함께 싣는다. 특정 진영을 응원하는 카피 금지.
- 리스트 항목은 임의로 줄이거나 생략하지 않는다. 장수를 늘려 전부 싣는다 (슬라이드당 3~4개, 최대 6개).
- 장수: 기본 4장(표지→본문→본문→요약). 정보가 많으면 최대 10장. 정보가 빈약하면 4장으로 두고 notes에 "정보 부족"을 적는다.

[카피 스타일 - 레퍼런스: 풀블리드 사진 위 큰 흰 글씨 + 핑크 강조]
- 표지 title: 2줄, 줄당 12자 이내, 핵심 단어 하나를 [[ ]]로 감싸 강조. 스크롤을 멈추는 후킹이되 과장·허위 금지.
- 본문 title: 2줄, 줄당 10자 이내, [[ ]] 강조 1개. 줄바꿈은 \\n.
- tag: 짧은 분류 라벨 (예: "WHAT HAPPENED · 무슨 일이?", "더불어민주당 입장").
- points: title 18자 이내, desc 60자 이내.
- 마지막 장은 summary 타입: 3줄 요약 + cta(저장/공유 유도, 🔖 이모지 가능) + source("출처: ..." 자료에 나온 매체명).

[출력 JSON 스키마]
{
  "slides": [
    {"type":"cover","tag":"...","title":"줄1\\n[[강조]] 줄2","meta":"YYYY.MM.DD (요일) · 분류","swipe":"밀어서 ... →","image_prompt":"..."},
    {"type":"list","tag":"...","title":"...","points":[{"title":"...","desc":"..."}],"image_prompt":"..."},
    {"type":"timeline","tag":"...","title":"...","items":[{"date":"11.9","sub":"월 · 오늘","title":"...","desc":"..."}],"image_prompt":"..."},
    {"type":"summary","tag":"3줄 요약","title":"...","items":["...","...","..."],"cta":"...","source":"출처: ...","image_prompt":"..."}
  ],
  "notes": "정보 부족/생략/주의사항 (사용자에게 보여줌)"
}
- timeline 은 날짜별 일정이 2개 이상 있을 때만 쓴다.
- image_prompt: 영어. 세로 사진, 에디토리얼/시네마틱, 하단에 텍스트 공간. 실존 인물·정치인 얼굴·정당 로고·국기·글자 금지. 반드시 "no people faces, no text, no letters, no logos" 포함.`;

async function buildSpec({ reportMd, extraContext, slideCount, userRequest, handle }) {
  const user = [
    `## 리포트 (report.md)\n${reportMd}`,
    extraContext ? `## 추가 자료 (사용자 제공, 사실 근거로 사용 가능)\n${extraContext}` : '',
    slideCount && slideCount !== 'auto' ? `## 장수 지정: 정확히 ${slideCount}장` : '## 장수: 자동 (4~10장)',
    userRequest ? `## 사용자 요청사항\n${userRequest}` : '',
    `## 오늘 날짜: ${new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })}`,
  ].filter(Boolean).join('\n\n');

  const res = await client().chat.completions.create({
    model: TEXT_MODEL,
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: SCRIPT_RULES }, { role: 'user', content: user }],
  });
  const json = JSON.parse(res.choices[0].message.content);
  if (!Array.isArray(json.slides) || json.slides.length < 2) throw new Error('대본 생성 결과가 올바르지 않습니다.');
  json.slides = json.slides.slice(0, 10);
  return { handle: handle || DEFAULT_HANDLE, slides: json.slides, notes: json.notes || '' };
}

// ── 2. 이미지 ───────────────────────────────────────────
const IMAGE_SUFFIX = ', vertical editorial photograph, cinematic muted color grade, empty space in lower half for text overlay, no people faces, no text, no letters, no signs, no logos, no flags';

async function generateImages(reportDir, spec, mode, log) {
  if (mode === 'none') return [];
  const assetsDir = path.join(reportDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  const ai = client();
  const targets = spec.slides
    .map((s, i) => ({ s, page: i + 1 }))
    .filter(({ page }) => mode === 'all' || !findSlideImage(assetsDir, page));
  if (!targets.length) { log('기존 배경 이미지를 그대로 사용합니다.'); return []; }

  log(`배경 이미지 ${targets.length}장 생성 중 (${IMAGE_MODEL})...`);
  const errors = [];
  await Promise.all(targets.map(async ({ s, page }) => {
    try {
      const prompt = (s.image_prompt || 'Minimal moody editorial still life on a desk') + IMAGE_SUFFIX;
      const r = await ai.images.generate({ model: IMAGE_MODEL, prompt, size: '1024x1536', quality: 'medium', n: 1 });
      // 다른 확장자로 남은 이전 이미지는 제거 (렌더러가 png를 먼저 고르도록)
      for (const ext of ['.jpg', '.jpeg', '.webp']) {
        const old = path.join(assetsDir, `slide_${pad2(page)}${ext}`);
        if (fs.existsSync(old)) fs.unlinkSync(old);
      }
      fs.writeFileSync(path.join(assetsDir, `slide_${pad2(page)}.png`), Buffer.from(r.data[0].b64_json, 'base64'));
      log(`이미지 ${page}번 완료`);
    } catch (e) {
      errors.push(`이미지 ${page}번 실패: ${e.message}`);
      log(`⚠️ 이미지 ${page}번 실패: ${e.message}`);
    }
  }));
  return errors;
}

// ── 작업(Job) 관리 ─────────────────────────────────────
const jobs = new Map();
let running = false;

function newJob(folder) {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const job = { id, folder, status: 'running', step: '대기', logs: [], warnings: [], notes: '', files: [], startedAt: Date.now() };
  jobs.set(id, job);
  return job;
}

function startCreateJob(opts) {
  if (running) throw new Error('이미 카드뉴스 제작 작업이 진행 중입니다. 끝난 뒤 다시 시도해주세요.');
  const reportDir = resolveFolder(opts.folder);
  const reportPath = path.join(reportDir, 'report.md');
  if (!fs.existsSync(reportPath)) throw new Error('이 폴더에 report.md 가 없습니다.');

  const job = newJob(opts.folder);
  const log = (m) => { job.logs.push(`[${new Date().toLocaleTimeString('ko-KR')}] ${m}`); job.step = m; };
  running = true;

  (async () => {
    try {
      log(`1/3 대본 작성 중 (${TEXT_MODEL})...`);
      const spec = await buildSpec({
        reportMd: fs.readFileSync(reportPath, 'utf-8'),
        extraContext: opts.extraContext,
        slideCount: opts.slideCount,
        userRequest: opts.userRequest,
        handle: opts.handle,
      });
      job.notes = spec.notes;
      log(`대본 완료: 총 ${spec.slides.length}장`);

      log('2/3 배경 이미지 준비 중...');
      job.warnings.push(...await generateImages(reportDir, spec, opts.imageMode || 'all', log));

      log('3/3 레퍼런스 스타일 렌더링 중...');
      const { files, warnings } = await renderCards(reportDir, spec, log);
      job.files = files;
      job.warnings.push(...warnings);
      job.status = 'done';
      log(`✅ 완료: ${files.length}장`);
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

async function rerender(folder, spec) {
  if (running) throw new Error('다른 작업이 진행 중입니다.');
  if (!spec || !Array.isArray(spec.slides) || !spec.slides.length) throw new Error('spec.slides 가 필요합니다.');
  const reportDir = resolveFolder(folder);
  running = true;
  try {
    return await renderCards(reportDir, spec);
  } finally {
    running = false;
  }
}

// ── 조회 ───────────────────────────────────────────────
function listReports() {
  if (!fs.existsSync(OUTPUTS_DIR)) return [];
  return fs.readdirSync(OUTPUTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && FOLDER_RE.test(d.name) && fs.existsSync(path.join(OUTPUTS_DIR, d.name, 'report.md')))
    .map(d => {
      const dir = path.join(OUTPUTS_DIR, d.name);
      const md = fs.readFileSync(path.join(dir, 'report.md'), 'utf-8');
      const title = (md.match(/\*\*주제 \/ 제목:\*\*\s*(.+)/) || [])[1] || d.name;
      const cardsDir = path.join(dir, 'cards');
      const cardCount = fs.existsSync(cardsDir) ? fs.readdirSync(cardsDir).filter(f => /^slide_\d+\.png$/.test(f)).length : 0;
      return { folder: d.name, title: title.trim(), cardCount };
    })
    .sort((a, b) => b.folder.localeCompare(a.folder));
}

function getReport(folder) {
  const dir = resolveFolder(folder);
  const cardsDir = path.join(dir, 'cards');
  const specPath = path.join(cardsDir, 'spec.json');
  const cards = fs.existsSync(cardsDir)
    ? fs.readdirSync(cardsDir).filter(f => /^slide_\d+\.png$/.test(f)).sort()
      .map(f => `/outputs/${folder}/cards/${f}?v=${fs.statSync(path.join(cardsDir, f)).mtimeMs | 0}`)
    : [];
  return {
    folder,
    report: fs.existsSync(path.join(dir, 'report.md')) ? fs.readFileSync(path.join(dir, 'report.md'), 'utf-8') : '',
    spec: fs.existsSync(specPath) ? JSON.parse(fs.readFileSync(specPath, 'utf-8')) : null,
    cards,
  };
}

module.exports = { startCreateJob, rerender, listReports, getReport, getJob: (id) => jobs.get(id) };
