---
name: createCardNews
description: report.md(outputs/YYMMDD_HHMM/report.md)를 읽어 레퍼런스 스타일(풀블리드 사진 + 핑크 태그박스 + 화이트 볼드 헤드라인, templates/reference_card.png) 1080x1350 인스타그램 카드뉴스 캐러셀 4~10장을 만든다. 사실 기반 대본(spec.json) → 슬라이드별 배경 이미지 → engine/card_renderer.js 렌더링 → cards/slide_NN.png. 대시보드 5번 탭과 같은 파이프라인. "카드뉴스 만들어줘", "report.md로 카드뉴스", "캐러셀 제작", "/createCardNews", 리포트 폴더 경로와 함께 카드뉴스 요청 시 사용.
argument-hint: "[outputs/YYMMDD_HHMM 폴더 (생략 시 최신)] [참고 이미지/요청사항]"
---

# 🎨 createCardNews

`outputs/<폴더>/report.md` → **레퍼런스 스타일 카드뉴스 캐러셀** (`outputs/<폴더>/cards/slide_NN.png`).

같은 파이프라인이 대시보드에도 있다: `npm start` → http://localhost:3000 → **🎨 5. 카드뉴스 제작 & 캐러셀** 탭 (제작, 진행 로그, 캐러셀 확인, 문구 수정 후 재렌더링, 다운로드).

| 구성요소 | 파일 |
| --- | --- |
| 레퍼런스 디자인 이미지 | [templates/reference_card.png](../../../templates/reference_card.png) |
| 레퍼런스 디자인 CSS | [templates/reference_style.css](../../../templates/reference_style.css) |
| 렌더러 (spec → PNG) | [engine/card_renderer.js](../../../engine/card_renderer.js) |
| 대시보드 파이프라인 (대본·이미지·작업) | [engine/cardnews_pipeline.js](../../../engine/cardnews_pipeline.js) |
| API | `server.js` `/api/cardnews/*` |
| 대시보드 UI | `public/index.html` (tab-cardnews), `public/cardnews.js` |

## 0. 대상 폴더

- 인자로 주어지면 그 폴더. 없으면 `outputs/` 중 `report.md`가 있는 가장 최신 `YYMMDD_HHMM` 폴더.
- `cards/`가 이미 있으면 덮어쓰기 전에 확인한다.

## 1. 사실 확보 & 대본 (spec.json)

1. `report.md`를 읽는다. 이 프로젝트의 리포트는 "AI 기획 대본"이 **플레이스홀더**(예: "핵심 수치 데이터 및 동향", 주제와 무관한 자금·투자 조언)이거나 카테고리 라벨이 틀린 경우가 많다 (정치 기사인데 "부동산 팩트 브리핑"). 그런 대본은 버리고 원문 사실로 다시 쓴다.
2. 사실이 부족하면 원문 링크를 가져오거나(네이버 뉴스는 fetch가 막히는 경우가 많으니 WebSearch로 같은 기사를 찾는다), 사용자에게 원문을 요청한다. **자료에 없는 수치·날짜·인용은 쓰지 않는다.**
3. 정치·사회 이슈는 중립: 주장은 주체를 밝혀 인용, 양측 입장을 함께 싣는다. 마지막 장에 출처 매체명.
4. 장수: 기본 4장, 리스트 항목은 생략 없이 장수를 늘려 최대 10장 (장당 3~4개, 최대 6개).
5. `outputs/<폴더>/cards/spec.json` 형식 (렌더러 입력):

```json
{
  "handle": "@zip__kok",
  "notes": "정보 부족/보강 출처 등 메모",
  "slides": [
    { "type": "cover", "tag": "핑크 태그박스 문구", "title": "줄1\n[[강조]] 줄2", "meta": "2026.11.09 (월) · 분류", "swipe": "밀어서 ... →", "image_prompt": "..." },
    { "type": "list", "tag": "...", "title": "...", "points": [{ "title": "...", "desc": "..." }] },
    { "type": "timeline", "tag": "...", "title": "...", "items": [{ "date": "11.9", "sub": "월 · 오늘", "title": "...", "desc": "..." }] },
    { "type": "summary", "tag": "3줄 요약", "title": "...", "items": ["...", "...", "..."], "cta": "🔖 ...", "source": "출처: ..." }
  ]
}
```

- `[[단어]]` = 핑크 하이라이트, `\n` = 줄바꿈. 표지 제목 2줄·줄당 12자 이내, 본문 제목 2줄·줄당 10자 이내, point desc 60자 이내.

## 2. 배경 이미지 → `assets/slide_NN.png`

- 슬라이드마다 영어 프롬프트: 세로 에디토리얼/시네마틱 사진, 하단 텍스트 공간, `no people faces, no text, no letters, no logos`. 실존 인물·정치인·정당 로고·국기 금지.
- 생성 도구 (순서대로):
  1. Higgsfield MCP `generate_image_batch` + `jobs_wait` (`ToolSearch`로 로드). 크레딧 0/무료 플랜이면 실패한다 → 다음으로.
  2. 프로젝트 `.env`의 `OPENAI_API_KEY`로 OpenAI 이미지 API (`gpt-image-2`, `1024x1536`, `quality: medium`, 장당 약 $0.05). `gpt-image-1`은 더 이상 없다. **사용자 요금이 들므로 먼저 확인받는다.**
  3. 사용자 제공 사진, 또는 이미지 없이 단색 배경 (렌더러가 자동 처리).
- 파일명 2자리: `slide_01.png` … (png/jpg/jpeg/webp 자동 인식).

## 3. 렌더링

```bash
node -e "const {renderCards}=require('./engine/card_renderer');const fs=require('fs');const d='outputs/<폴더>';renderCards(d,JSON.parse(fs.readFileSync(d+'/cards/spec.json','utf8')),console.log).then(r=>console.log(JSON.stringify(r)))"
```

- 1080×1350, deviceScaleFactor 2, Pretendard. 이전 `slide_*.png`는 지우고 다시 쓴다.
- 결과의 `warnings`(텍스트가 상단과 겹침)가 있으면 문구를 줄이거나 슬라이드를 나눈다.
- 디자인 변경은 `templates/reference_style.css`만 고친다 (대시보드와 공유).

## 4. 검수 & 보고

1. 모든 PNG를 `Read`로 열어 글자 넘침·겹침·이중 따옴표·오탈자·이미지 속 글자/얼굴을 확인하고, 문제가 있으면 spec 수정 → 재렌더링.
2. 보고: 장수와 슬라이드별 한 줄 요약, 파일 링크 (`outputs/<폴더>/cards/slide_01.png`), 이미지 출처와 비용, 사실 보강 출처, 생략·일반화한 부분. 대시보드 5번 탭에서 같은 결과를 캐러셀로 확인할 수 있다고 안내.
