/* ===== 전역 상태 ===== */
(function checkGroupAuth() {
  const token = localStorage.getItem('jwtToken');
  if (!token) {
    alert('로그인이 필요한 서비스입니다.');
    window.location.href = '/auth/login';
  }
})();
let GROUPS = [];

function initials(name){ return name.slice(0,1); }
function isOwner(group){ return group.ownerId === group.myMemberId; }
function getGroupById(id){ return GROUPS.find(g => g.id === id); }

function getQueryParam(name){
  return new URLSearchParams(window.location.search).get(name);
}

// 현재 페이지 URL의 ?id= 를 기준으로 그룹을 가져옴 (없으면 첫 번째 모임)
function currentGroup(){
  const id = getQueryParam('id');
  return (id && getGroupById(id)) || GROUPS[0];
}

function linkToDetail(groupId){ return '/group/read?id=' + encodeURIComponent(groupId); }
function linkToAi(groupId){ return '/group/recommend?id=' + encodeURIComponent(groupId); }
function linkToList(){ return '/group/list'; }

/* ===== 공통 UI: 토스트 ===== */
function showToast(msg){
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(()=>t.classList.remove('show'), 2000);
}

/* ===== 공통 UI: 확인 모달 ===== */
let confirmCallback = null;
function openConfirm(title, desc, onConfirm){
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalDesc').textContent = desc;
  confirmCallback = onConfirm;
  document.getElementById('confirmModal').classList.add('open');
}
function closeConfirm(){
  document.getElementById('confirmModal').classList.remove('open');
  confirmCallback = null;
}
function bindModal(){
  const cancelBtn = document.getElementById('modalCancel');
  const confirmBtn = document.getElementById('modalConfirm');
  if(cancelBtn) cancelBtn.addEventListener('click', closeConfirm);
  if(confirmBtn) confirmBtn.addEventListener('click', ()=>{
    if(confirmCallback) confirmCallback();
    closeConfirm();
  });
}

/* ===== 공통: 히트맵 집계 ===== */
function heatClass(v){ return v === 'busy' ? 'busy' : v === 'mid' ? 'mid' : 'free'; }

function buildHeatmapHTML(group){
  if(!group.heat.length){
    return '<div class="empty-note">아직 공유된 일정이 없어서 분석할 수 없어요.</div>';
  }
  let html = '';
  group.heat.forEach(r => {
    html += `<div class="heat-row"><b>${r.name}</b>${r.row.map(v => `<div class="heat-cell ${heatClass(v)}"></div>`).join('')}</div>`;
  });
  const cols = group.heat[0].row.length;
  const totalRow = [];
  for(let c=0;c<cols;c++){
    const freeCount = group.heat.filter(r => r.row[c] === 'free').length;
    if(freeCount === group.heat.length) totalRow.push('free');
    else if(freeCount >= Math.ceil(group.heat.length/2)) totalRow.push('mid');
    else totalRow.push('busy');
  }
  html += `<div class="heat-row total"><b>전체</b>${totalRow.map(v => `<div class="heat-cell ${heatClass(v)}"></div>`).join('')}</div>`;
  return html;
}

function fetchApi(url, options = {}) {
  const token = localStorage.getItem('jwtToken');
  if (!options.headers) {
    options.headers = {};
  }
  options.headers['Accept'] = 'application/json';
  if (token) {
    options.headers['Authorization'] = 'Bearer ' + token;
  }
  return fetch(url, options);
}



/* Inline JS from HTML */
const groupId = getQueryParam('id');
  let heatmapEl, recList, registerBtn, heatLegend, btnRecommend, dayLabels, registerNote;
  let actionBtnGroup;
  let selectedRec = null;

  let heatData = [];
  let currentHeatPage = 0;
  let heatStartDateStr = '';
  let selectedStartDate = null;
  let selectedEndDate = null;
  let lastAiStartDateStr = '';

  // header.html이 폴링하다가 완료/실패를 감지하면 이 이벤트를 쏴준다.
  // (다른 페이지로 이동했다가 이 페이지로 돌아온 경우에도, 같은 그룹의 알림이면 그대로 반영)
  window.addEventListener('planslot:groupAiCompleted', (e) => {
    const { groupId: eventGroupId, data } = e.detail || {};
    if (String(eventGroupId) !== String(groupId)) return; // 다른 모임의 결과면 무시

    renderAiResult(data, lastAiStartDateStr);
    btnRecommend.disabled = false;
    btnRecommend.textContent = '추천받기';

    const widget = document.getElementById('groupAiFloatingWidget');
    if (widget) widget.style.display = 'none';
    if (typeof window.clearGroupAiStorage === 'function') window.clearGroupAiStorage();
  });

  window.addEventListener('planslot:groupAiFailed', (e) => {
    const { groupId: eventGroupId, reason } = e.detail || {};
    if (String(eventGroupId) !== String(groupId)) return;

    heatmapEl.innerHTML = `<div style="text-align:center; padding:20px; color:var(--ink-soft); font-size:14px;">${reason || '분석 중 오류가 발생했습니다.'}</div>`;
    btnRecommend.disabled = false;
    btnRecommend.textContent = '추천받기';

    if (typeof window.clearGroupAiStorage === 'function') window.clearGroupAiStorage();
  });

  async function initAiPage() {
    heatmapEl = document.getElementById('heatmap');
    recList = document.getElementById('recList');
    registerBtn = document.getElementById('btnRegisterRec');
    actionBtnGroup = document.getElementById('actionBtnGroup');
    heatLegend = document.getElementById('heatLegend');
    btnRecommend = document.getElementById('btnRecommend');
    dayLabels = document.getElementById('dayLabels');
    registerNote = document.getElementById('registerNote');

    let exactFlatpickr = flatpickr("#exactRegDate", {
      mode: "range",
      dateFormat: "Y-m-d",
      locale: "ko",
      showMonths: 2
    });

    restoreGroupAiJobIfAny();

    registerBtn.addEventListener('click', () => {
      if (!selectedRec) {
        alert('등록할 추천 일정을 먼저 선택해주세요.');
        return;
      }
      
      let minD = selectedRec.date;
      let maxD = selectedRec.date;
      if (selectedRec.date.includes('~')) {
        const parts = selectedRec.date.split('~').map(s => s.trim());
        minD = parts[0];
        maxD = parts[1] || parts[0];
      }
      
      exactFlatpickr.set("minDate", minD);
      exactFlatpickr.set("maxDate", maxD);
      exactFlatpickr.clear();
      
      document.getElementById('exactRegStartTime').value = '';
      document.getElementById('exactRegEndTime').value = '';
      if (selectedRec.time) {
        const timeParts = selectedRec.time.split('-').map(s => s.trim());
        if (timeParts.length === 2) {
          document.getElementById('exactRegStartTime').value = timeParts[0];
          document.getElementById('exactRegEndTime').value = timeParts[1];
        }
      }

      document.getElementById('exactRegTitle').value = selectedRec.title || `[추천] ${selectedRec.label}`;
      document.getElementById('regModal').style.display = 'flex';
    });

    document.getElementById('btnCancelReg').addEventListener('click', () => {
      document.getElementById('regModal').style.display = 'none';
    });

    document.getElementById('exactRegAllDay').addEventListener('change', (e) => {
      const timeInputs = document.getElementById('exactTimeInputs');
      if(e.target.checked) {
        timeInputs.style.opacity = '0.4';
        timeInputs.style.pointerEvents = 'none';
      } else {
        timeInputs.style.opacity = '1';
        timeInputs.style.pointerEvents = 'auto';
      }
    });

    document.getElementById('exactRegScheduleType').addEventListener('change', (e) => {
      const recurRow = document.getElementById('exactRecurRow');
      if(e.target.value !== 'DAILY') {
        recurRow.style.display = 'block';
      } else {
        recurRow.style.display = 'none';
        document.getElementById('exactRegRecurEndDate').value = '';
      }
    });

    document.getElementById('btnConfirmReg').addEventListener('click', async () => {
      const dates = exactFlatpickr.selectedDates;
      if (dates.length === 0) {
        alert("일정을 선택해주세요.");
        return;
      }

      const isAllDay = document.getElementById('exactRegAllDay').checked;
      let startTimeVal = document.getElementById('exactRegStartTime').value;
      let endTimeVal = document.getElementById('exactRegEndTime').value;

      if (!isAllDay && (!startTimeVal || !endTimeVal)) {
        alert("시간을 모두 입력해주세요.");
        return;
      }

      if (isAllDay) {
        startTimeVal = "00:00";
        endTimeVal = "23:59";
      }

      const finalStartDate = flatpickr.formatDate(dates[0], "Y-m-d");
      const finalStartTime = startTimeVal;
      const finalEndDate = dates[1] ? flatpickr.formatDate(dates[1], "Y-m-d") : finalStartDate;
      const finalEndTime = endTimeVal;

      try {
        const confirmBtn = document.getElementById('btnConfirmReg');
        confirmBtn.disabled = true;
        confirmBtn.textContent = '등록 중...';
        const res = await fetchApi(`/group/${groupId}/schedules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: document.getElementById('exactRegTitle').value.trim(),
            date: finalStartDate,
            time: finalStartTime,
            endDate: finalEndDate,
            endTime: finalEndTime,
            scheduleType: document.getElementById('exactRegScheduleType').value,
            recurrenceEndDate: document.getElementById('exactRegRecurEndDate').value || null,
            visibility: 'public'
          })
        });
        if (!res.ok) throw new Error('Failed to register');
        document.getElementById('regModal').style.display = 'none';
        showToast('추천 일정을 모임 일정에 등록했어요.');
        setTimeout(() => location.href = linkToDetail(groupId), 1000);
      } catch(e) {
        console.error(e);
        alert('일정 등록에 실패했습니다.');
        const confirmBtn = document.getElementById('btnConfirmReg');
        confirmBtn.disabled = false;
        confirmBtn.textContent = '확인 및 등록';
      }
    });

    btnRecommend.addEventListener('click', loadAiRecommendations);

    flatpickr("#recDateRange", {
      mode: "range",
      locale: "ko",
      dateFormat: "Y-m-d",
      minDate: "today",
      showMonths: 2, // 두 달치를 한 번에 보여줌
      onReady: function(selectedDates, dateStr, instance) {
        // 달력 위에서 마우스 휠을 굴리면 달이 넘어가도록 설정
        instance.calendarContainer.addEventListener('wheel', (e) => {
          e.preventDefault();
          if (e.deltaY > 0) {
            instance.changeMonth(1);
          } else if (e.deltaY < 0) {
            instance.changeMonth(-1);
          }
        }, { passive: false });
      },
      onChange: function(selectedDates) {
        if (selectedDates.length === 2) {
          selectedStartDate = selectedDates[0];
          selectedEndDate = selectedDates[1];
        } else {
          selectedStartDate = null;
          selectedEndDate = null;
        }
      }
    });

    document.getElementById('btnHeatPrev').addEventListener('click', () => renderHeatmapPage(currentHeatPage - 1));
    document.getElementById('btnHeatNext').addEventListener('click', () => renderHeatmapPage(currentHeatPage + 1));

    // 하루종일, N박 M일 선택 시 시간대 비활성화 및 교차 선택 해제
    const durCbs = document.querySelectorAll('input[name="recDuration"]');
    const timeCbs = document.querySelectorAll('input[name="recTime"]');
    durCbs.forEach(cb => {
      cb.addEventListener('change', (e) => {
        const isMultiDay = e.target.value.includes('일');

        // 방금 누른 것이 체크되었다면, 성격이 다른(시간 vs 일) 체크박스들을 해제
        if (e.target.checked) {
          durCbs.forEach(otherCb => {
            if (otherCb !== e.target) {
              const otherIsMultiDay = otherCb.value.includes('일');
              if (isMultiDay && !otherIsMultiDay) {
                otherCb.checked = false;
              } else if (!isMultiDay && otherIsMultiDay) {
                otherCb.checked = false;
              }
            }
          });
        }

        const hasMultiDay = Array.from(durCbs).some(c => c.checked && c.value.includes('일'));
        timeCbs.forEach(tcb => {
          tcb.disabled = hasMultiDay;
          if (hasMultiDay) tcb.checked = false;
          tcb.parentElement.style.opacity = hasMultiDay ? '0.4' : '1';
          tcb.parentElement.style.pointerEvents = hasMultiDay ? 'none' : 'auto';
        });
      });
    });

    if (!groupId) {
      alert('잘못된 접근입니다.');
      location.href = '/group/list';
      return;
    }

    try {
      const detailRes = await fetchApi(`/group/${groupId}`);
      if (detailRes.ok) {
        const groupData = await detailRes.json();
        document.getElementById('groupTitle').textContent = `${groupData.name} - AI 시간 추천`;
      }
    } catch(e) { console.error(e); }

    document.getElementById('btnBack').href = linkToDetail(groupId);
  }

  // 새로고침하거나 다른 페이지 갔다가 다시 이 페이지로 들어왔을 때,
  // 이 모임에 대한 AI 추천 작업이 진행 중/완료/실패 상태였다면 화면에 반영한다.
  function restoreGroupAiJobIfAny() {
    const cachedGroupId = localStorage.getItem('ps_group_ai_group_id');
    if (cachedGroupId !== String(groupId)) return; // 다른 모임 작업이면 이 페이지와 무관

    const status = localStorage.getItem('ps_group_ai_status');

    if (status === 'PROCESSING') {
      heatmapEl.innerHTML = '<div style="text-align:center; padding:20px; color:var(--ink-soft); font-size:14px;">AI가 분석 중입니다... 잠시만 기다려주세요.</div>';
      btnRecommend.disabled = true;
      btnRecommend.textContent = '분석 중...';
    } else if (status === 'COMPLETED') {
      const cachedResultStr = localStorage.getItem('ps_group_ai_cached_result');
      if (cachedResultStr) {
        lastAiStartDateStr = localStorage.getItem('ps_group_ai_start_date') || '';
        renderAiResult(JSON.parse(cachedResultStr), lastAiStartDateStr);
        const widget = document.getElementById('groupAiFloatingWidget');
        if (widget) widget.style.display = 'none';
        if (typeof window.clearGroupAiStorage === 'function') window.clearGroupAiStorage();
      }
    } else if (status === 'FAILED') {
      const reason = localStorage.getItem('ps_group_ai_fail_reason') || '분석 중 오류가 발생했습니다.';
      heatmapEl.innerHTML = `<div style="text-align:center; padding:20px; color:var(--ink-soft); font-size:14px;">${reason}</div>`;
      if (typeof window.clearGroupAiStorage === 'function') window.clearGroupAiStorage();
    }
  }

  async function loadAiRecommendations() {
    // 이미 다른 모임의 AI 추천이 진행 중이면(=localStorage에 다른 groupId로 PROCESSING 상태가 남아있으면)
    // 여기서 새로 시작하지 않는다. 그대로 진행하면 이전 모임의 job 추적 정보(jobId)가
    // 덮어써져서, 먼저 시작한 모임의 결과를 다시는 받을 방법이 없어지기 때문.
    const activeJobGroupId = localStorage.getItem('ps_group_ai_group_id');
    const activeJobStatus = localStorage.getItem('ps_group_ai_status');
    if (activeJobStatus === 'PROCESSING' && activeJobGroupId && activeJobGroupId !== String(groupId)) {
      alert('다른 모임의 AI 추천 분석이 아직 진행 중이에요. 완료된 후에 다시 시도해주세요.');
      return;
    }

    const durationCheckboxes = document.querySelectorAll('input[name="recDuration"]:checked');
    if (durationCheckboxes.length === 0) {
      alert('최소 하나의 소요 시간을 선택해주세요.');
      return;
    }
    const duration = Array.from(durationCheckboxes).map(cb => cb.value).join(', ');

    const hasMultiDay = Array.from(durationCheckboxes).some(c => c.value.includes('일'));

    const timeCheckboxes = document.querySelectorAll('input[name="recTime"]:checked');
    if (!hasMultiDay && timeCheckboxes.length === 0) {
      alert('최소 하나의 시간대를 선택해주세요.');
      return;
    }
    const times = hasMultiDay ? '해당없음(종일/숙박)' : Array.from(timeCheckboxes).map(cb => cb.value).join(', ');
    const type = encodeURIComponent(`가능한 소요시간: ${duration}, 가능한 시간대: ${times}`);

    if (!selectedStartDate || !selectedEndDate) {
      alert('추천을 받을 시작 날짜와 끝 날짜를 모두 지정해주세요.');
      return;
    }

    const startDateStr = flatpickr.formatDate(selectedStartDate, "Y-m-d");
    const endDateStr = flatpickr.formatDate(selectedEndDate, "Y-m-d");

    let queryParams = `type=${type}&startDate=${startDateStr}&endDate=${endDateStr}`;

    heatmapEl.innerHTML = '<div style="text-align:center; padding:20px; color:var(--ink-soft); font-size:14px;">AI가 분석 중입니다... 잠시만 기다려주세요.</div>';
    recList.innerHTML = '';
    dayLabels.style.display = 'none';
    actionBtnGroup.style.display = 'none';
    registerNote.style.display = 'none';
    dayLabels.style.display = 'none';
    btnRecommend.disabled = true;
    btnRecommend.textContent = '분석 중...';
    selectedRec = null;

    lastAiStartDateStr = startDateStr;

    try {
      // 1. 분석 시작 API 호출 (Job 등록) - 결과는 바로 안 오고 jobId만 온다.
      const startRes = await fetchApi(`/group/${groupId}/ai-recommendations/start?${queryParams}`, {
        method: 'POST'
      });
      if (!startRes.ok) throw new Error('Failed to start AI recommendation job');

      const startData = await startRes.json();
      if (!startData.jobId) throw new Error('No jobId returned from server');

      // 2. 폴링은 header.html이 전담한다. 이렇게 하면 이 페이지를 벗어나 다른 화면으로
      //    이동해도 계속 분석이 진행되고, 완료되면 우측 하단 플로팅 위젯으로 알려준다.
      //    (버튼/로딩 상태 복구는 아래 planslot:groupAiCompleted / groupAiFailed 이벤트에서 처리)
      if (typeof window.registerGroupAiJob === 'function') {
        window.registerGroupAiJob(startData.jobId, groupId, startDateStr);
      } else {
        console.warn('registerGroupAiJob을 찾을 수 없습니다. header.html이 정상적으로 로드되었는지 확인하세요.');
        btnRecommend.disabled = false;
        btnRecommend.textContent = '추천받기';
      }
    } catch (e) {
      console.error('Error starting AI recommendation:', e);
      heatmapEl.innerHTML = '<div style="text-align:center; padding:20px; color:var(--ink-soft); font-size:14px;">분석 중 오류가 발생했습니다.</div>';
      btnRecommend.disabled = false;
      btnRecommend.textContent = '추천받기';
    }
  }

  // header.html의 폴링(진행 중/완료 이벤트)과 페이지 재진입 복구 로직에서 공통으로 사용하는 렌더링 함수
  function renderAiResult(data, startDateStrForHeat) {
    if (!data.heat || data.heat.length === 0) {
      heatmapEl.innerHTML = '<div style="text-align:center; padding:20px; color:var(--ink-soft); font-size:14px;">아직 공유된 일정이 없어서 분석할 수 없어요.</div>';
      document.getElementById('heatPagination').style.display = 'none';
    } else {
      let processedHeat = JSON.parse(JSON.stringify(data.heat));
      let startD = new Date(startDateStrForHeat);
      let dayOfWeek = startD.getDay(); // 0(Sun) ~ 6(Sat)
      
      if (dayOfWeek > 0) {
        processedHeat.forEach(r => {
          for(let i=0; i<dayOfWeek; i++) r.row.unshift('empty');
        });
        startD.setDate(startD.getDate() - dayOfWeek);
      }
      
      let totalLen = processedHeat[0].row.length;
      let remainder = totalLen % 7;
      if (remainder > 0) {
        let padEnd = 7 - remainder;
        processedHeat.forEach(r => {
          for(let i=0; i<padEnd; i++) r.row.push('empty');
        });
      }
      
      heatData = processedHeat;
      heatStartDateStr = startD.getFullYear() + "-" + String(startD.getMonth()+1).padStart(2, '0') + "-" + String(startD.getDate()).padStart(2, '0');
      renderHeatmapPage(0);
    }

    recList.innerHTML = '';
    if (!data.recs || data.recs.length === 0) {
      recList.innerHTML = '<div style="text-align:center; padding:20px; color:var(--ink-soft); font-size:14px;">추천할 시간이 아직 없어요. 모임원이 일정을 공유하면 여기에 추천이 나타나요.</div>';
    } else {
      data.recs.forEach(r => {
        const el = document.createElement('div');
        el.className = 'rank-card';
        el.innerHTML = `
        <div class="ghost-num">${r.rank}</div>
        <div class="rank-date">${r.label}</div>
        <span class="fit-badge ${!r.tag.includes('전원') ? 'partial' : ''}">${r.tag}</span>
        <div class="tag-row" style="margin-top:10px;">
          <span class="tag">${r.sub}</span>
        </div>`;
        el.addEventListener('click', () => {
          document.querySelectorAll('.rank-card').forEach(n => {
            n.classList.remove('active');
          });
          el.classList.add('active');
          selectedRec = r;
        });
        recList.appendChild(el);
      });
      actionBtnGroup.style.display = 'flex';
      registerNote.style.display = 'block';
      registerBtn.disabled = false;
    }
  }

  initAiPage();

  function renderHeatmapPage(page) {
    if (!heatData || heatData.length === 0) return;
    const itemsPerPage = 7;
    const totalCols = heatData[0].row.length;
    const totalPages = Math.ceil(totalCols / itemsPerPage);
    if (page < 0) page = 0;
    if (page >= totalPages) page = totalPages - 1;
    currentHeatPage = page;

    const startCol = page * itemsPerPage;
    const endCol = Math.min(startCol + itemsPerPage, totalCols);
    const colsToShow = endCol - startCol;

    const totalRow = [];
    for(let c = startCol; c < endCol; c++){
      const isEmpty = heatData.every(r => r.row[c] === 'empty');
      const freeCount = heatData.filter(r => r.row[c] === 'free').length;
      if(isEmpty) totalRow.push('empty');
      else if(freeCount === heatData.length) totalRow.push('free');
      else if(freeCount >= Math.ceil(heatData.length/2)) totalRow.push('mid');
      else totalRow.push('busy');
    }

    let html = `<div class="ribbon-row total">
    <span class="name">전체</span>
    ${totalRow.map(v => {
      if (v === 'empty') return '<div class="day-cell" style="background:transparent; border:1px dashed var(--line);"></div>';
      if (v === 'free') return '<div class="day-cell free"></div>';
      if (v === 'mid') return '<div class="day-cell partial"></div>';
      return '<div class="day-cell"></div>';
    }).join('')}
  </div>`;

    heatData.forEach(r => {
      html += `<div class="ribbon-row">
      <span class="name">${r.name}</span>
      ${r.row.slice(startCol, endCol).map(v => {
        if (v === 'empty') return '<div class="day-cell" style="background:transparent; border:1px dashed var(--line);"></div>';
        if (v === 'free') return '<div class="day-cell free"></div>';
        if (v === 'mid') return '<div class="day-cell partial"></div>';
        return '<div class="day-cell"></div>';
      }).join('')}
    </div>`;
    });

    heatmapEl.innerHTML = html;

    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
    let labelHtml = '<span></span>';
    let startD = heatStartDateStr ? new Date(heatStartDateStr) : new Date();
    startD.setDate(startD.getDate() + startCol);
    for(let i=0; i<colsToShow; i++) {
      let d = new Date(startD); d.setDate(d.getDate() + i);
      const isSunday = d.getDay() === 0;
      const colorStyle = isSunday ? 'color: var(--danger);' : '';
      labelHtml += `<span style="${colorStyle}">${d.getMonth()+1}/${d.getDate()} <span style="font-size:11px; font-weight:normal;">(${weekDays[d.getDay()]})</span></span>`;
    }
    dayLabels.innerHTML = labelHtml;

    heatLegend.style.display = 'flex';
    dayLabels.style.display = 'grid';

    const heatPagination = document.getElementById('heatPagination');
    if (totalPages > 1) {
      heatPagination.style.display = 'flex';
      document.getElementById('heatPageText').textContent = `${page + 1} / ${totalPages}`;
      document.getElementById('btnHeatPrev').disabled = page === 0;
      document.getElementById('btnHeatNext').disabled = page === totalPages - 1;
    } else {
      heatPagination.style.display = 'none';
    }
  }