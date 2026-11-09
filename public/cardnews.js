// 🎨 TAB 5: createCardNews — 카드뉴스 제작 & 캐러셀 확인
(() => {
  const $ = (id) => document.getElementById(id);
  const els = {
    select: $('cn-report-select'), refresh: $('cn-refresh-btn'), preview: $('cn-report-preview'),
    slideCount: $('cn-slide-count'), imageMode: $('cn-image-mode'), handle: $('cn-handle'),
    extra: $('cn-extra'), request: $('cn-request'), create: $('cn-create-btn'),
    progress: $('cn-progress'), step: $('cn-progress-step'), log: $('cn-progress-log'),
    title: $('cn-viewer-title'), count: $('cn-viewer-count'), notes: $('cn-notes'),
    track: $('cn-track'), empty: $('cn-empty'), prev: $('cn-prev'), next: $('cn-next'),
    dots: $('cn-dots'), thumbs: $('cn-thumbs'), download: $('cn-download'), downloadAll: $('cn-download-all'),
    editToggle: $('cn-edit-toggle'), editor: $('cn-editor'), specText: $('cn-spec-text'), rerender: $('cn-rerender-btn'),
    igStatus: $('cn-ig-status'), igCaption: $('cn-ig-caption'), igCounter: $('cn-ig-counter'), igBtn: $('cn-ig-btn'),
    igProgress: $('cn-ig-progress'), igStep: $('cn-ig-step'), igLog: $('cn-ig-log'),
  };

  // 핸들은 사용자가 새 값을 입력하기 전까지 고정 (localStorage 유지, 리포트 전환 시 덮어쓰지 않음)
  const HANDLE_KEY = 'cardnews.handle';
  const savedHandle = localStorage.getItem(HANDLE_KEY);
  if (savedHandle) els.handle.value = savedHandle;
  const saveHandle = () => {
    const v = els.handle.value.trim();
    if (v) localStorage.setItem(HANDLE_KEY, v);
  };
  els.handle.addEventListener('input', saveHandle);
  els.handle.addEventListener('change', saveHandle);

  let cards = [];
  let current = 0;
  let currentFolder = null;
  let busy = false;

  async function api(url, opts) {
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }
  const post = (url, body) => api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  // ── 리포트 목록 ──
  async function loadReports(selectFolder) {
    const { reports } = await api('/api/cardnews/reports');
    els.select.innerHTML = reports.length
      ? reports.map(r => `<option value="${r.folder}">${r.folder} · ${r.title.slice(0, 40)}${r.cardCount ? ` (🖼 ${r.cardCount}장)` : ''}</option>`).join('')
      : '<option value="">report.md 가 있는 폴더가 없습니다</option>';
    const target = selectFolder || currentFolder || (reports[0] && reports[0].folder);
    if (target) { els.select.value = target; await loadReport(target); }
  }

  async function loadReport(folder) {
    if (!folder) return;
    currentFolder = folder;
    const data = await api(`/api/cardnews/report/${encodeURIComponent(folder)}`);
    els.preview.textContent = data.report || '(report.md 없음)';
    els.title.textContent = `캐러셀 미리보기 · ${folder}`;
    els.specText.value = data.spec ? JSON.stringify(data.spec, null, 2) : '';
    showNotes(data.spec?.notes ? [`📝 ${data.spec.notes}`] : []);
    setCards(data.cards);
    loadCaption(folder, data.spec);
  }

  function showNotes(lines) {
    els.notes.style.display = lines.length ? 'block' : 'none';
    els.notes.innerHTML = lines.map(l => `<div>${l.replace(/</g, '&lt;')}</div>`).join('');
  }

  // ── 캐러셀 ──
  function setCards(list) {
    cards = list || [];
    current = Math.min(current, Math.max(cards.length - 1, 0));
    els.track.innerHTML = cards.map((src, i) => `<img src="${src}" alt="slide ${i + 1}" draggable="false">`).join('');
    els.thumbs.innerHTML = cards.map((src, i) => `<img src="${src}" data-i="${i}" alt="">`).join('');
    els.dots.innerHTML = cards.map((_, i) => `<span data-i="${i}"></span>`).join('');
    els.empty.style.display = cards.length ? 'none' : 'flex';
    els.count.textContent = cards.length ? `${cards.length}장` : '';
    go(current);
  }

  function go(i) {
    if (!cards.length) { els.prev.disabled = els.next.disabled = true; return; }
    current = Math.max(0, Math.min(i, cards.length - 1));
    els.track.style.transform = `translateX(-${current * 100}%)`;
    els.prev.disabled = current === 0;
    els.next.disabled = current === cards.length - 1;
    [...els.dots.children].forEach((d, k) => d.classList.toggle('active', k === current));
    [...els.thumbs.children].forEach((t, k) => t.classList.toggle('active', k === current));
    els.download.href = cards[current].split('?')[0];
    els.download.setAttribute('download', `${currentFolder}_slide_${String(current + 1).padStart(2, '0')}.png`);
  }

  els.prev.addEventListener('click', () => go(current - 1));
  els.next.addEventListener('click', () => go(current + 1));
  els.dots.addEventListener('click', (e) => e.target.dataset.i && go(+e.target.dataset.i));
  els.thumbs.addEventListener('click', (e) => e.target.dataset.i && go(+e.target.dataset.i));
  document.addEventListener('keydown', (e) => {
    if ($('tab-cardnews').style.display === 'none' || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if (e.key === 'ArrowLeft') go(current - 1);
    if (e.key === 'ArrowRight') go(current + 1);
  });
  // 스와이프
  let startX = null;
  $('cn-stage').addEventListener('pointerdown', (e) => { startX = e.clientX; });
  $('cn-stage').addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX; startX = null;
    if (Math.abs(dx) > 40) go(current + (dx < 0 ? 1 : -1));
  });

  els.downloadAll.addEventListener('click', async () => {
    for (let i = 0; i < cards.length; i++) {
      const a = document.createElement('a');
      a.href = cards[i].split('?')[0];
      a.download = `${currentFolder}_slide_${String(i + 1).padStart(2, '0')}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      await new Promise(r => setTimeout(r, 300));
    }
  });

  // ── 제작 ──
  function setBusy(on, label) {
    busy = on;
    els.create.disabled = on;
    els.rerender.disabled = on;
    els.create.style.opacity = on ? '0.6' : '1';
    els.create.innerHTML = on ? `<span>⏳</span> ${label || '제작 중...'}` : '<span>🎨</span> 카드뉴스 캐러셀 제작';
  }

  const optionText = (sel) => sel.options[sel.selectedIndex]?.text || sel.value;

  function confirmCreate(folder) {
    const lines = [
      `📂 리포트: ${folder}`,
      `📑 슬라이드 장수: ${optionText(els.slideCount)}`,
      `🖼 배경 이미지: ${optionText(els.imageMode)}`,
      `🏷 카드에 표시할 핸들: ${els.handle.value.trim() || '(없음)'}`,
      `📎 추가 자료: ${els.extra.value.trim() ? `${els.extra.value.trim().length}자` : '없음'}`,
      `💬 요청사항: ${els.request.value.trim() || '없음'}`,
    ];
    if (els.imageMode.value !== 'none') lines.push('', '⚠️ 배경 이미지를 OpenAI로 생성하므로 요금이 발생합니다 (장당 약 $0.05).');
    return confirm(`이 설정으로 카드뉴스를 제작할까요?\n\n${lines.join('\n')}\n\n설정을 바꾸려면 [취소] 후 왼쪽 옵션을 고치고 제작 버튼을 누르세요.`);
  }

  els.create.addEventListener('click', () => startCreate());

  async function startCreate() {
    const folder = els.select.value;
    if (!folder || busy) return;
    if (!confirmCreate(folder)) return;
    setBusy(true);
    els.progress.style.display = 'block';
    els.log.textContent = '';
    els.step.textContent = '작업 시작...';
    showNotes([]);
    try {
      const { jobId } = await post('/api/cardnews/create', {
        folder,
        slideCount: els.slideCount.value,
        imageMode: els.imageMode.value,
        handle: els.handle.value.trim(),
        extraContext: els.extra.value.trim(),
        userRequest: els.request.value.trim(),
      });
      await pollJob(jobId);
    } catch (err) {
      els.step.textContent = `❌ ${err.message}`;
    } finally {
      setBusy(false);
    }
  }

  async function pollJob(jobId) {
    for (;;) {
      const { job } = await api(`/api/cardnews/jobs/${jobId}`);
      els.step.textContent = job.step;
      els.log.textContent = job.logs.join('\n');
      els.log.scrollTop = els.log.scrollHeight;
      if (job.status !== 'running') {
        if (job.status === 'done') {
          current = 0;
          await loadReports(job.folder);
          showNotes([
            ...(job.notes ? [`📝 ${job.notes}`] : []),
            ...job.warnings.map(w => `⚠️ ${w}`),
          ]);
        }
        return;
      }
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  // ── 문구 수정 → 다시 렌더링 ──
  els.editToggle.addEventListener('click', () => {
    els.editor.style.display = els.editor.style.display === 'none' ? 'block' : 'none';
  });

  els.rerender.addEventListener('click', async () => {
    if (busy || !currentFolder) return;
    let spec;
    try { spec = JSON.parse(els.specText.value); } catch (e) { alert(`JSON 형식 오류: ${e.message}`); return; }
    spec.handle = els.handle.value.trim() || spec.handle;
    setBusy(true, '다시 렌더링 중...');
    els.rerender.innerHTML = '<span>⏳</span> 렌더링 중...';
    try {
      const { warnings } = await post('/api/cardnews/rerender', { folder: currentFolder, spec });
      await loadReport(currentFolder);
      showNotes((warnings || []).map(w => `⚠️ ${w}`));
    } catch (err) {
      alert(`렌더링 실패: ${err.message}`);
    } finally {
      setBusy(false);
      els.rerender.innerHTML = '<span>🔁</span> 수정 내용으로 다시 렌더링';
    }
  });

  els.select.addEventListener('change', () => { current = 0; loadReport(els.select.value).catch(e => alert(e.message)); });
  els.refresh.addEventListener('click', () => loadReports().catch(e => alert(e.message)));

  // 사이드바 4단계(리포트 저장) → 바로 카드뉴스 탭으로 이동
  //   리포트 자동 전송 + 사이드바 3단계 옵션(장수·요청사항) 이어받기 → 확인 후 바로 제작 시작
  $('cn-from-report-btn').addEventListener('click', async () => {
    const folder = $('saved-folder-badge').innerText.trim();
    if (!folder) { alert('먼저 리포트를 저장해주세요.'); return; }
    if (busy) { alert('이미 제작이 진행 중입니다.'); return; }

    const sideCount = $('slide-count-select')?.value;
    if (sideCount && [...els.slideCount.options].some(o => o.value === sideCount)) els.slideCount.value = sideCount;
    const sideFeedback = $('user-feedback-input')?.value.trim();
    if (sideFeedback && !els.request.value.trim()) els.request.value = sideFeedback;

    $('tab-btn-cardnews').click();
    current = 0;
    try {
      await loadReports(folder);
      if (els.select.value !== folder) throw new Error(`리포트 폴더(${folder})를 목록에서 찾지 못했습니다.`);
    } catch (e) {
      showNotes([`⚠️ ${/404/.test(e.message) ? '서버를 재시작하세요 (npm start) — 카드뉴스 API가 없는 이전 서버입니다.' : e.message}`]);
      return;
    }
    document.querySelector('.cn-controls').scrollIntoView({ behavior: 'smooth', block: 'start' });
    await startCreate();
  });

  // ── 인스타그램 업로드 ──
  let igInfo = null;
  let igBusy = false;
  const captionKey = (folder) => `cardnews.caption.${folder}`;
  const plain = (s = '') => String(s).replace(/\[\[(.+?)\]\]/g, '$1').replace(/\s*\n\s*/g, ' ').trim();

  // 기본 캡션: 표지 제목 + 요약 항목 + CTA + 출처 (사용자가 수정하면 폴더별로 저장)
  function defaultCaption(spec) {
    if (!spec?.slides?.length) return '';
    const cover = spec.slides.find(s => s.type === 'cover') || spec.slides[0];
    const summary = spec.slides.find(s => s.type === 'summary');
    const parts = [plain(cover.title)];
    if (cover.meta) parts.push(plain(cover.meta));
    if (summary?.items?.length) parts.push(summary.items.map(i => `✔ ${plain(i)}`).join('\n'));
    if (summary?.cta) parts.push(plain(summary.cta));
    if (summary?.source) parts.push(`출처: ${plain(summary.source)}`);
    return parts.filter(Boolean).join('\n\n');
  }

  function loadCaption(folder, spec) {
    els.igCaption.value = localStorage.getItem(captionKey(folder)) ?? defaultCaption(spec);
    updateCounter();
  }

  function updateCounter() {
    const v = els.igCaption.value;
    const tags = (v.match(/#[^\s#]+/g) || []).length;
    const over = v.length > 2200 || tags > 30;
    els.igCounter.innerHTML = `<span class="${over ? 'over' : ''}">${v.length.toLocaleString()}자 · #${tags}</span>`;
  }

  els.igCaption.addEventListener('input', () => {
    if (currentFolder) localStorage.setItem(captionKey(currentFolder), els.igCaption.value);
    updateCounter();
  });

  async function checkIg() {
    try {
      igInfo = await api('/api/instagram/status');
      if (igInfo.configured) {
        els.igStatus.className = 'cn-ig-status ok';
        els.igStatus.textContent = `✅ @${igInfo.username || '연결됨'}`;
      } else {
        els.igStatus.className = 'cn-ig-status warn';
        els.igStatus.textContent = igInfo.error ? '⚠️ 토큰/계정 오류' : `⚠️ .env 설정 필요`;
        els.igStatus.title = igInfo.error || `필요: ${igInfo.missing.join(', ')}`;
      }
    } catch (e) {
      igInfo = null;
      els.igStatus.className = 'cn-ig-status warn';
      els.igStatus.textContent = /404/.test(e.message) ? '⚠️ 서버 재시작 필요' : '⚠️ 확인 실패';
    }
  }

  els.igBtn.addEventListener('click', async () => {
    if (igBusy || !currentFolder) return;
    if (!cards.length) { alert('업로드할 카드가 없습니다. 먼저 카드뉴스를 제작하세요.'); return; }
    await checkIg();
    if (!igInfo?.configured) {
      alert(`인스타그램 업로드 설정이 필요합니다.\n\n${igInfo?.error || `.env 에 추가: ${(igInfo?.missing || ['IG_USER_ID', 'IG_ACCESS_TOKEN', 'PUBLIC_BASE_URL']).join(', ')}`}\n\n설정 후 서버를 재시작하세요.`);
      return;
    }
    const caption = els.igCaption.value.trim();
    const ok = confirm([
      '인스타그램에 바로 게시합니다. 게시 후에는 인스타 앱에서만 삭제할 수 있습니다.',
      '',
      `👤 게시 계정: @${igInfo.username || '(확인 불가)'}`,
      `📂 리포트: ${currentFolder}`,
      `🖼 카드: ${cards.length}장`,
      `💬 캡션: ${caption ? `${caption.length}자 — "${caption.slice(0, 60)}${caption.length > 60 ? '…' : ''}"` : '(없음)'}`,
      '',
      '게시할까요?',
    ].join('\n'));
    if (!ok) return;

    igBusy = true;
    els.igBtn.disabled = true;
    els.igBtn.innerHTML = '<span>⏳</span> 게시 중...';
    els.igProgress.style.display = 'block';
    els.igLog.textContent = '';
    els.igStep.textContent = '작업 시작...';
    try {
      const { jobId } = await post('/api/instagram/publish', { folder: currentFolder, caption });
      for (;;) {
        const { job } = await api(`/api/instagram/jobs/${jobId}`);
        els.igStep.textContent = job.step;
        els.igLog.textContent = job.logs.join('\n');
        els.igLog.scrollTop = els.igLog.scrollHeight;
        if (job.status === 'done') {
          els.igStep.innerHTML = `✅ 게시 완료${job.permalink ? ` · <a href="${job.permalink}" target="_blank" rel="noopener">게시물 열기 ↗</a>` : ''}`;
          els.igStep.classList.add('cn-ig-done');
          break;
        }
        if (job.status === 'error') break;
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (err) {
      els.igStep.textContent = `❌ ${err.message}`;
    } finally {
      igBusy = false;
      els.igBtn.disabled = false;
      els.igBtn.innerHTML = '<span>📤</span> 인스타그램 캐러셀 게시';
    }
  });

  $('tab-btn-cardnews').addEventListener('click', () => {
    checkIg();
    if (currentFolder) return;
    loadReports().catch(e => {
      const hint = /404/.test(e.message) ? '서버를 재시작하세요 (npm start) — 카드뉴스 API가 없는 이전 서버입니다.' : e.message;
      els.select.innerHTML = `<option value="">⚠️ 리포트 목록을 불러오지 못했습니다</option>`;
      showNotes([`⚠️ 리포트 목록 오류: ${hint}`]);
    });
  });
})();
