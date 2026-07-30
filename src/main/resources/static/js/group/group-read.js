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
let group = null;

function renderHead(){
  document.getElementById('groupTitle').textContent = group.name;
  const myMemberInfo = group.members.find(m => m.id === group.myMemberId);
  const myColor = myMemberInfo && myMemberInfo.color ? myMemberInfo.color : '#bae6fd';

  document.getElementById('groupMeta').innerHTML = `
    <span style="display:inline-flex; align-items:center;">참여자 ${group.members.length}명</span>
    <span style="display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:700; margin-left:14px; color:#f8fafc;">
      <span style="display:inline-flex; align-items:center; gap:4px;">
        <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${myColor};"></span> 공개
      </span>
      <span style="display:inline-flex; align-items:center; gap:4px; margin-left:4px;">
        <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:color-mix(in srgb, ${myColor} 50%, white);"></span> 비공개
      </span>
    </span>
  `;
  document.getElementById('settingsGroupName').value = group.name;

  const owner = isOwner(group);
  const isWaiting = group.filter === 'waiting';

  const deleteRow = document.getElementById('btnDeleteGroup').closest('.danger-row');
  if(deleteRow) deleteRow.style.display = owner ? 'flex' : 'none';

  const leaveRow = document.getElementById('leaveGroupRow');
  if(leaveRow) {
    if(!owner) {
      leaveRow.style.borderBottom = 'none';
      leaveRow.style.marginBottom = '0';
      leaveRow.style.paddingBottom = '0';
    } else {
      leaveRow.style.borderBottom = '1px solid var(--border)';
      leaveRow.style.marginBottom = '12px';
      leaveRow.style.paddingBottom = '12px';
    }
  }

  const nameSaveBtn = document.getElementById('btnSaveName');
  if(nameSaveBtn) {
    nameSaveBtn.style.display = owner ? 'block' : 'none';
    document.getElementById('settingsGroupName').disabled = !owner;
  }

  const settingsMyColor = document.getElementById('settingsMyColor');
  const paletteContainer = document.getElementById('colorPaletteContainer');
  if(settingsMyColor && myMemberInfo && paletteContainer) {
    const currentColor = myMemberInfo.color || '#E2E8F0';
    settingsMyColor.value = currentColor;
    const colors = ["#EF4444", "#F97316", "#F59E0B", "#10B981", "#6366F1", "#8B5CF6", "#D946EF", "#F43F5E", "#14B8A6", "#84CC16", "#059669", "#7C3AED"];
    const usedColors = group.members.filter(m => m.id !== group.myMemberId).map(m => m.color);
    paletteContainer.innerHTML = '';
    colors.forEach(c => {
      const circle = document.createElement('div');
      circle.style.width = '28px';
      circle.style.height = '28px';
      circle.style.borderRadius = '50%';
      circle.style.backgroundColor = c;
      const isTaken = usedColors.includes(c);

      if (isTaken) {
        circle.style.opacity = '0.2';
        circle.style.cursor = 'not-allowed';
        circle.title = '다른 모임원이 사용 중입니다';
      } else {
        circle.style.cursor = 'pointer';
        circle.style.border = (c === currentColor) ? '3px solid #1E293B' : '2px solid transparent';
        circle.style.transition = 'all 0.2s';
        circle.onclick = () => {
          settingsMyColor.value = c;
          Array.from(paletteContainer.children).forEach(child => child.style.border = child.style.opacity === '0.2' ? 'none' : '2px solid transparent');
          circle.style.border = '3px solid #1E293B';
        };
      }
      paletteContainer.appendChild(circle);
    });
  }

  const blockImageUpdate = document.getElementById('blockImageUpdate');
  if(blockImageUpdate) {
    blockImageUpdate.style.display = owner ? 'block' : 'none';
    if(owner) {
      const previewImg = document.getElementById('groupProfilePreview');
      const placeholder = document.getElementById('groupProfilePlaceholder');
      if (group.profileImageUrl) {
        previewImg.src = group.profileImageUrl + '?t=' + new Date().getTime();
        previewImg.style.display = 'block';
        placeholder.style.display = 'none';
      } else {
        previewImg.style.display = 'none';
        placeholder.style.display = 'block';
      }
    }
  }

  document.getElementById('ownerLeaveHint').style.display = owner ? 'block' : 'none';
  const btnGoAi = document.getElementById('btnGoAi');
  if (btnGoAi) btnGoAi.href = linkToAi(group.id);
  const btnGoChat = document.getElementById('btnGoChat');
  if (btnGoChat) btnGoChat.href = '/groupChat/' + group.id;

  if (isWaiting) {
    document.getElementById('btnLeave').style.display = 'none';
    document.getElementById('waitingActions').style.display = 'flex';
    if (btnGoChat) btnGoChat.style.display = 'none';
    if (btnGoAi) btnGoAi.style.display = 'none';

    // 초대받은 상태(대기 중)일 때는 인원 관리 탭만 보이도록 처리
    document.querySelector('.tab-btn[data-tab="schedule"]').style.display = 'none';
    document.querySelector('.tab-btn[data-tab="shared"]').style.display = 'none';
    document.querySelector('.tab-btn[data-tab="settings"]').style.display = 'none';
    const teaser = document.querySelector('.ai-teaser');
    if(teaser) teaser.style.display = 'none';

    // 기본 활성 탭을 인원 관리로 변경
    setTab('members');
  } else {
    const btnLeave = document.getElementById('btnLeave');
    btnLeave.style.display = 'block';
    btnLeave.textContent = '모임 탈퇴';
    btnLeave.className = 'btn btn-ghost btn-sm';
    btnLeave.style.color = 'var(--danger)';
    btnLeave.disabled = false;
    document.getElementById('waitingActions').style.display = 'none';
    if (btnGoChat) btnGoChat.style.display = 'inline-block';
    if (btnGoAi) btnGoAi.style.display = 'inline-flex';

    // 정상 참여 중일 때는 모든 탭 보이도록
    document.querySelector('.tab-btn[data-tab="schedule"]').style.display = 'inline-block';
    document.querySelector('.tab-btn[data-tab="shared"]').style.display = 'inline-block';
    document.querySelector('.tab-btn[data-tab="settings"]').style.display = 'inline-block';
    // 티저 로직 제거됨

    // 기본 활성 탭 설정 (이미 선택된 탭이 없다면 일정 탭으로)
    if (!document.querySelector('.tab-btn.active')) {
      setTab('schedule');
    }
  }


}

function getMemberColor(member) {
  if (member.id === group.myMemberId) {
    return member.color || '#E2E8F0';
  }
  const overrides = JSON.parse(localStorage.getItem(`planslot_group_colors_${group.id}`) || '{}');
  return overrides[member.id] || '#9CA3AF'; // 기존 #4B5563에서 좀 더 연하고 중간 채도인 회색으로 변경
}

function setMemberColorOverride(memberId, color) {
  const overrides = JSON.parse(localStorage.getItem(`planslot_group_colors_${group.id}`) || '{}');
  overrides[memberId] = color;
  localStorage.setItem(`planslot_group_colors_${group.id}`, JSON.stringify(overrides));
  renderMembers();
  renderDynamicCalendar();
  renderTodaySchedules();
}

function renderTodaySchedules() {
  const list = document.getElementById('myScheduleList');
  list.innerHTML = '';

  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  const todays = groupSchedules.filter(s => s.startDate && s.startDate.startsWith(dateStr));

  if(todays.length === 0){
    list.innerHTML = '<div class="empty-note">오늘은 등록된 일정이 없어요. 아래에서 일정을 등록해보세요.</div>';
    return;
  }

  todays.forEach(s => {
    const isPrivate = s.isPublic === 'N';
    const badge = isPrivate
      ? `<span style="font-size:10px; padding:3px 7px; background:#e2e8f0; color:#1e293b; font-weight:800; border-radius:4px; margin-left:6px;">비공개</span>`
      : `<span style="font-size:10px; padding:3px 7px; background:#bae6fd; color:#0369a1; font-weight:800; border-radius:4px; margin-left:6px;">공개</span>`;

    let isShared = false;
    let dispTitle = s.title;
    const daySchedules = groupSchedules.filter(x => x.startDate === s.startDate && x.time === s.time && x.title === s.title);
    if(daySchedules.length > 1) isShared = true;

    let bgColor = '#E0F2FE';
    let borderColor = '#bae6fd';

    if (isShared) {
      bgColor = '#E0F2FE';
      borderColor = '#bae6fd';
    } else {
      const mObj = group.members.find(m => m.name === s.nickname);
      const memberColor = mObj ? getMemberColor(mObj) : '#E2E8F0';
      bgColor = memberColor;
      borderColor = memberColor;
    }

    if (isPrivate) {
      borderColor = `color-mix(in srgb, ${borderColor} 50%, white)`;
    }

    let displayTime = s.time || '';
    if (s.endDate) {
      const endObj = new Date(s.endDate);
      const eHours = String(endObj.getHours()).padStart(2, '0');
      const eMins = String(endObj.getMinutes()).padStart(2, '0');
      const eTimeStr = `${eHours}:${eMins}`;
      if (eTimeStr !== '00:00' && eTimeStr !== displayTime) {
        displayTime = `${displayTime} ~ ${eTimeStr}`;
      }
    }

    const row = document.createElement('div');
    row.className = 'sched-item';
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.alignItems = 'center';
    row.style.padding = '8px 12px';
    row.style.border = `1px solid ${borderColor}`;
    row.style.borderLeft = `5px solid ${borderColor}`;
    row.style.borderRadius = '6px';
    row.style.marginBottom = '6px';
    row.style.background = '#ffffff';
    row.style.background = '#ffffff';

    row.innerHTML = `
      <div>
        <div style="display:flex; align-items:center;">
          <b style="font-size:13px; color:#1E293B;">${s.title}</b>
          ${badge}
        </div>
        <div style="font-size:11px; color:#64748B; margin-top:2px;">${s.nickname}</div>
      </div>
      <div style="font-size:12px; font-weight:600; color:#000;">${displayTime}</div>
    `;
    list.appendChild(row);
  });
}

function renderMembers(){
  const memberList = document.getElementById('memberList');
  const waitingList = document.getElementById('waitingList');
  document.getElementById('memberCountLabel').textContent = group.members.length;
  const owner = isOwner(group);
  const amIWaiting = group.waiting && group.waiting.some(w => w.isMe);

  const inviteHeader = document.querySelector('#panel-members .section-row:first-child');
  const inviteForm = document.querySelector('.invite-form');
  if (amIWaiting) {
    if (inviteHeader) inviteHeader.style.display = 'none';
    if (inviteForm) inviteForm.style.display = 'none';
  } else {
    if (inviteHeader) inviteHeader.style.display = 'flex';
    if (inviteForm) inviteForm.style.display = 'flex';
  }

  memberList.innerHTML = '';
  group.members.forEach(m => {
    const row = document.createElement('div');
    row.className = 'member-row';
    const canKick = owner && m.id !== group.myMemberId;
    const isMe = m.id === group.myMemberId;
    const displayColor = getMemberColor(m);
    
    const fallbackSvg = `<div style="width:100%; height:100%; background: #e2e8f0; border-radius:50%; display:flex; justify-content:center; align-items:center;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></div>`;
    
    const avatarHtml = (m.profileImageUrl && m.profileImageUrl !== 'null' && m.profileImageUrl.trim() !== '')
      ? `<img src="${m.profileImageUrl}" alt="${m.name}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" onerror="this.outerHTML=decodeURIComponent('${encodeURIComponent(fallbackSvg)}')">`
      : fallbackSvg;

    let colorPickerHtml = '';
    if (!isMe) {
      colorPickerHtml = `<input type="color" class="member-color-picker" data-id="${m.id}" value="${displayColor}" title="이 모임원의 색상 변경 (내 화면에서만 적용됨)" style="width:24px; height:24px; padding:0; border:none; border-radius:4px; cursor:pointer; background:none; appearance:none;">`;
    } else {
      colorPickerHtml = `<div style="width:24px; height:24px; border-radius:4px; background:${displayColor}; border:1px solid var(--border);" title="내 색상은 설정 탭에서 변경 가능합니다"></div>`;
    }

    row.innerHTML = `
      <div class="avatar">${avatarHtml}</div>
      <div class="member-info">
        <div class="member-name-row">
          <b class="nick-label">${m.name}${isMe ? ' (나)' : ''}</b>
          <button class="edit-nick" title="이 모임에서만 보이는 별명 수정">✎ 별명 수정</button>
        </div>
        <span>${m.role === 'owner' ? '방장' : '모임원'}</span>
      </div>
      <div class="member-actions" style="display:flex; align-items:center; gap:8px;">
        ${colorPickerHtml}
        ${canKick ? '<button class="btn btn-danger btn-sm">추방</button>' : ''}
      </div>`;

    if (!isMe) {
      row.querySelector('.member-color-picker').addEventListener('change', (e) => {
        setMemberColorOverride(m.id, e.target.value);
      });
    }

    row.querySelector('.edit-nick').addEventListener('click', ()=>{
      const label = row.querySelector('.nick-label');
      const current = m.name;
      label.outerHTML = `<input class="nick-input nick-label" value="${current}">`;
      const input = row.querySelector('.nick-input');
      input.focus();
      input.select();
      const commit = ()=>{
        m.name = input.value.trim() || current;
        renderMembers();
        showToast('별명을 수정했어요. 이 모임 안에서만 이 이름으로 보여요.');
      };
      input.addEventListener('keydown', e => { if(e.key === 'Enter') commit(); });
      input.addEventListener('blur', commit);
    });

    const kickBtn = row.querySelector('.btn-danger');
    if(kickBtn){
      kickBtn.addEventListener('click', ()=>{
        openConfirm('모임원을 추방할까요?', `${m.name}님을 '${group.name}' 모임에서 추방합니다. 이 작업은 되돌릴 수 없어요.`, async ()=>{
          try {
            const res = await fetchApi(`/group/${group.id}/member/${m.id}`, { method: 'DELETE' });
            if(res.ok) {
              showToast(`${m.name}님을 추방했어요.`);
              fetchGroupDetail();
            } else {
              showToast('추방 중 오류가 발생했습니다.');
            }
          } catch(e) { console.error(e); }
        });
      });
    }
    memberList.appendChild(row);
  });

  waitingList.innerHTML = '';
  if(!group.waiting.length){
    waitingList.innerHTML = '<div class="empty-note">대기중인 초대가 없어요.</div>';
  }
  group.waiting.forEach(w => {
    const row = document.createElement('div');
    row.className = 'waiting-item';
    let cancelBtnHtml = '';
    if (owner) {
      cancelBtnHtml = `<button class="btn btn-sm btn-danger cancel-invite-btn" data-id="${w.id}">취소</button>`;
    }
    
    row.innerHTML = `
      <div><b>${w.nickname || w.email}</b><span>${w.inviterName}님이 초대함</span></div>
      <div class="member-actions" style="display:flex; align-items:center; gap:8px;">
        <span class="pill waiting">응답 대기중</span>
        ${cancelBtnHtml}
      </div>`;
      
    if (owner) {
      setTimeout(() => {
        const cancelBtn = row.querySelector('.cancel-invite-btn');
        if (cancelBtn) {
          cancelBtn.addEventListener('click', () => {
            openConfirm('초대를 취소할까요?', `'${w.nickname || w.email}'님에 대한 모임 초대를 취소합니다.`, async () => {
              try {
                const res = await fetchApi(`/group/${group.id}/member/${w.id}`, { method: 'DELETE' });
                if (res.ok) {
                  showToast('초대를 취소했어요.');
                  fetchGroupDetail();
                } else {
                  showToast('취소 중 오류가 발생했습니다.');
                }
              } catch(e) { console.error(e); }
            });
          });
        }
      }, 0);
    }
    waitingList.appendChild(row);
  });
}

function setTab(tab){
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + tab).classList.add('active');
}

const inviteNicknameInput = document.getElementById('inviteNickname');
const nicknameSuggestions = document.getElementById('nicknameSuggestions');

inviteNicknameInput.addEventListener('input', async (e) => {
  const val = e.target.value.trim();
  if(val.length === 0) {
    nicknameSuggestions.style.display = 'none';
    return;
  }

  try {
    const res = await fetchApi(`/group/search-nickname?prefix=${encodeURIComponent(val)}`);
    if(res.ok) {
      const nicknames = await res.json();
      if(nicknames.length > 0) {
        nicknameSuggestions.innerHTML = nicknames.map(nickname =>
          `<div class="suggestion-item" style="padding:10px 14px; cursor:pointer; border-bottom:1px solid #f0f0f0; font-size:14px; color:#182B3A;"
            onmouseover="this.style.background='#F3FAFF'"
            onmouseout="this.style.background=''"
            onclick="document.getElementById('inviteNickname').value='${nickname}'; document.getElementById('nicknameSuggestions').style.display='none';">${nickname}</div>`
        ).join('');
        nicknameSuggestions.style.display = 'block';
      } else {
        nicknameSuggestions.style.display = 'none';
      }
    }
  } catch(e) { console.error(e); }
});

inviteNicknameInput.addEventListener('keydown', (e) => {
  if(e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('btnInvite').click();
  }
});

document.addEventListener('click', (e) => {
  if(e.target !== inviteNicknameInput && e.target !== nicknameSuggestions) {
    nicknameSuggestions.style.display = 'none';
  }
});

document.getElementById('btnInvite').addEventListener('click', async ()=>{
  const input = document.getElementById('inviteNickname');
  const nickname = input.value.trim();
  if(!nickname || !nickname.includes('#')){ showToast('정확한 닉네임과 태그(예: 홍길동#1234)를 입력해주세요.'); return; }

  try {
    const res = await fetchApi(`/group/${group.id}/invitation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname })
    });
    if(res.ok) {
      input.value = '';
      showToast(`${nickname}님에게 초대를 보냈어요.`);
      fetchGroupDetail();
    } else {
      let errMsg = '초대 중 오류가 발생했습니다.';
      try {
        const errorData = await res.json();
        if (errorData && errorData.message) errMsg = errorData.message;
      } catch (e) {}
      showToast(errMsg);
    }
  } catch(e) { console.error(e); }
});

document.getElementById('btnAddSchedule').addEventListener('click', async ()=>{
  const title = document.getElementById('scheduleTitle').value.trim();
  const date = document.getElementById('scheduleDate').value;
  const time = document.getElementById('scheduleTime').value;
  const endTime = document.getElementById('scheduleEndTime').value || null;
  const visibility = document.getElementById('scheduleVisibility').value;
  const editId = document.getElementById('editScheduleId')?.value;

  if(!title || !date || !time){ showToast('제목, 날짜, 시작 시간을 모두 입력해주세요.'); return; }

  try {
    if (editId) {
      const res = await fetchApi(`/schedule/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, date, time, endTime, visibility })
      });
      if (res.ok) {
        document.getElementById('scheduleModal').classList.remove('open');
        showToast('일정이 수정되었습니다.');
        fetchGroupDetail();
      } else {
        showToast('일정 수정 중 오류가 발생했습니다.');
      }
    } else {
      const res = await fetchApi(`/group/${group.id}/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, date, time, endTime, visibility })
      });
      if(res.ok) {
        document.getElementById('scheduleModal').classList.remove('open');
        showToast('일정을 등록하고 공유했어요.');
        fetchGroupDetail();
      } else {
        showToast('일정 등록 중 오류가 발생했습니다.');
      }
    }
  } catch(e) { console.error(e); }
});

document.getElementById('btnSaveName').addEventListener('click', async ()=>{
  const val = document.getElementById('settingsGroupName').value.trim();
  if(!val){ showToast('모임 이름을 입력해주세요.'); return; }
  if(val.length > 30){ showToast('모임 이름은 30자 이하로 입력해주세요.'); return; }

  try {
    const res = await fetchApi(`/group/${group.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: val })
    });
    if(res.ok) {
      showToast('모임 이름을 수정했어요.');
      fetchGroupDetail();
    } else {
      showToast('수정 중 오류가 발생했습니다.');
    }
  } catch(e) { console.error(e); }
});

// === 모임 이미지 크롭 & 업로드 (Cropper.js) ===
(function() {
  const groupImageInput = document.getElementById('groupImageInput');
  const cropModal = document.getElementById('groupCropModal');
  const cropImageTarget = document.getElementById('groupCropImageTarget');
  const btnCancelCrop = document.getElementById('btnGroupCancelCrop');
  const btnConfirmCrop = document.getElementById('btnGroupConfirmCrop');
  let groupCropper = null;

  if (groupImageInput) {
    groupImageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (file.size > 5 * 1024 * 1024) {
        showToast('파일 크기는 5MB 이하여야 합니다.');
        groupImageInput.value = '';
        return;
      }

      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        showToast('이미지 파일(jpg, png, gif, webp)만 업로드 가능합니다.');
        groupImageInput.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = function(event) {
        cropImageTarget.src = event.target.result;
        cropModal.classList.add('open');

        setTimeout(() => { if (btnConfirmCrop) btnConfirmCrop.focus(); }, 100);

        if (groupCropper) {
          groupCropper.destroy();
        }

        groupCropper = new Cropper(cropImageTarget, {
          aspectRatio: 1,
          viewMode: 1,
          autoCropArea: 1,
          dragMode: 'move',
          background: false
        });
      };
      reader.readAsDataURL(file);
    });
  }

  if (btnCancelCrop) {
    btnCancelCrop.addEventListener('click', () => {
      cropModal.classList.remove('open');
      groupImageInput.value = '';
      if (groupCropper) {
        groupCropper.destroy();
        groupCropper = null;
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && cropModal.classList.contains('open') && !btnConfirmCrop.disabled) {
      e.preventDefault();
      btnConfirmCrop.click();
    }
  });

  if (btnConfirmCrop) {
    btnConfirmCrop.addEventListener('click', () => {
      if (!groupCropper || !group) return;

      btnConfirmCrop.innerText = '업로드 중...';
      btnConfirmCrop.disabled = true;

      groupCropper.getCroppedCanvas({
        width: 300,
        height: 300
      }).toBlob(async (blob) => {
        if (!blob) {
          showToast('이미지 크롭에 실패했습니다.');
          btnConfirmCrop.innerText = '적용 및 업로드';
          btnConfirmCrop.disabled = false;
          return;
        }

        const formData = new FormData();
        formData.append('file', blob, 'group-profile.png');

        try {
          const res = await fetch(`/group/${group.id}/image`, {
            method: 'POST',
            body: formData
          });
          if (res.ok) {
            const data = await res.json();
            showToast('사진이 변경되었습니다.');
            cropModal.classList.remove('open');
            groupImageInput.value = '';
            groupCropper.destroy();
            groupCropper = null;

            // Update preview immediately with cache buster
            const previewImg = document.getElementById('groupProfilePreview');
            const placeholder = document.getElementById('groupProfilePlaceholder');
            if (data && data.imageUrl) {
              group.profileImageUrl = data.imageUrl; // update local state
              previewImg.src = data.imageUrl + '?t=' + new Date().getTime();
              previewImg.style.display = 'block';
              placeholder.style.display = 'none';
            }
          } else {
            showToast('사진 변경 중 오류가 발생했습니다.');
          }
        } catch (err) {
          console.error(err);
          showToast('오류가 발생했습니다.');
        } finally {
          btnConfirmCrop.innerText = '적용 및 업로드';
          btnConfirmCrop.disabled = false;
        }
      }, 'image/png');
    });
  }
})();

document.getElementById('btnSaveColor').addEventListener('click', async ()=>{
  const color = document.getElementById('settingsMyColor').value;
  try {
    const res = await fetchApi(`/group/${group.id}/color`, {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ color })
    });
    if(res.ok) {
      showToast('색상을 변경했어요.');
      fetchGroupDetail();
    } else {
      showToast('색상 변경 중 오류가 발생했습니다.');
    }
  } catch(e) { console.error(e); }
});

document.getElementById('btnDeleteGroup').addEventListener('click', ()=>{
  openConfirm('모임을 삭제할까요?', `'${group.name}' 모임과 모든 일정, 채팅, 게시글이 삭제되고 되돌릴 수 없어요.`, async ()=>{
    try {
      const res = await fetchApi(`/group/${group.id}`, { method: 'DELETE' });
      if(res.ok) {
        showToast('모임을 삭제했어요.');
        setTimeout(()=>{ window.location.href = linkToList(); }, 600);
      } else {
        showToast('삭제 중 오류가 발생했습니다.');
      }
    } catch(e) { console.error(e); }
  });
});

document.getElementById('btnLeave').addEventListener('click', ()=>{
  if(isOwner(group)) {
    const otherMembers = group.members.filter(m => m.id !== group.myMemberId && m.role !== 'owner');
    if (otherMembers.length === 0) {
      showToast('방장을 위임할 다른 모임원이 없습니다. 설정에서 모임을 삭제해주세요.');
      return;
    }
    const select = document.getElementById('transferSelect');
    select.innerHTML = otherMembers.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    document.getElementById('transferModal').classList.add('open');

    document.getElementById('btnTransferConfirm').onclick = () => {
      const newOwnerId = select.value;
      const newOwnerName = otherMembers.find(m => m.id === newOwnerId).name;
      document.getElementById('transferModal').classList.remove('open');

      openConfirm('정말 탈퇴할까요?', `'${newOwnerName}'님에게 방장을 위임하고 모임에서 탈퇴합니다.`, async ()=>{
        try {
          const res = await fetchApi(`/group/${group.id}/leave?newOwnerId=${newOwnerId}`, { method: 'DELETE' });
          if(res.ok) {
            showToast('모임을 탈퇴했어요.');
            setTimeout(()=>{ window.location.href = linkToList(); }, 600);
          } else {
            showToast('탈퇴 실패');
          }
        } catch(e){ showToast('오류 발생'); }
      });
    };
  } else {
    openConfirm('모임을 탈퇴할까요?', `'${group.name}' 모임에서 탈퇴하면 공유했던 일정도 더 이상 모임원에게 보이지 않아요.`, async ()=>{
      try {
        const res = await fetchApi(`/group/${group.id}/leave`, { method: 'DELETE' });
        if(res.ok) {
          showToast('모임을 탈퇴했어요.');
          setTimeout(()=>{ window.location.href = linkToList(); }, 600);
        } else {
          showToast('탈퇴 실패');
        }
      } catch(e){ showToast('오류 발생'); }
    });
  }
});

document.getElementById('btnAcceptInvite').addEventListener('click', ()=>{
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open';
  modal.innerHTML = `
    <div class="modal-box" style="width:320px;">
      <h3 style="margin-top:0;">캘린더 색상 선택</h3>
      <p style="font-size:13px; color:var(--muted); margin-bottom:16px;">참여할 모임에서 사용할 색상을 선택해주세요.</p>
      <div id="acceptColorContainer" style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:16px; justify-content:center;"></div>
      <input type="hidden" id="acceptColorValue">
      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button class="btn btn-ghost" id="acceptCancel">취소</button>
        <button class="btn btn-primary" id="acceptConfirm">수락 및 입장</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const acceptColorContainer = modal.querySelector('#acceptColorContainer');
  const acceptColorValue = modal.querySelector('#acceptColorValue');
  const colors = ["#EF4444", "#F97316", "#F59E0B", "#10B981", "#6366F1", "#8B5CF6", "#D946EF", "#F43F5E", "#14B8A6", "#84CC16", "#059669", "#7C3AED"];
  const usedColors = group.members.map(m => m.color);

  let firstAvailable = null;
  colors.forEach(c => {
    const circle = document.createElement('div');
    circle.style.width = '30px';
    circle.style.height = '30px';
    circle.style.borderRadius = '50%';
    circle.style.backgroundColor = c;

    if(usedColors.includes(c)) {
      circle.style.opacity = '0.2';
      circle.style.cursor = 'not-allowed';
      circle.title = '다른 모임원이 사용 중입니다';
    } else {
      circle.style.cursor = 'pointer';
      circle.style.border = '2px solid transparent';
      if(!firstAvailable) {
        firstAvailable = c;
        acceptColorValue.value = c;
        circle.style.border = '3px solid #1E293B';
      }
      circle.onclick = () => {
        acceptColorValue.value = c;
        Array.from(acceptColorContainer.children).forEach(child => child.style.border = child.style.opacity === '0.2' ? 'none' : '2px solid transparent');
        circle.style.border = '3px solid #1E293B';
      };
    }
    acceptColorContainer.appendChild(circle);
  });

  modal.querySelector('#acceptCancel').onclick = () => modal.remove();
  modal.querySelector('#acceptConfirm').onclick = async () => {
    if(!acceptColorValue.value) { showToast('색상을 선택해주세요.'); return; }
    try {
      const res = await fetchApi(`/group/${group.id}/invitation/1`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'ACCEPT', color: acceptColorValue.value })
      });
      if(res.ok) {
        modal.remove();
        showToast('초대를 수락했습니다. 모임에 참여했습니다.');
        if (typeof refreshNotificationUI === 'function') refreshNotificationUI();
        fetchGroupDetail();
      } else {
        const err = await res.json().catch(()=>({}));
        showToast(err.message || '수락 중 오류가 발생했습니다.');
      }
    } catch(e) { console.error(e); }
  };
});

document.getElementById('btnRejectInvite').addEventListener('click', ()=>{
  openConfirm('초대를 거절할까요?', `'${group.name}' 모임의 초대를 거절합니다.`, async ()=>{
    try {
      const res = await fetchApi(`/group/${group.id}/invitation/1`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'REJECT' })
      });
      if(res.ok) {
        showToast('초대를 거절했습니다.');
        if (typeof refreshNotificationUI === 'function') refreshNotificationUI();
        setTimeout(()=>{ window.location.href = linkToList(); }, 600);
      } else {
        showToast('거절 중 오류가 발생했습니다.');
      }
    } catch(e) { console.error(e); }
  });
});

bindModal();

async function fetchGroupDetail() {
  const id = getQueryParam('id');
  if(!id) {
    showToast('잘못된 접근입니다.');
    setTimeout(() => { window.location.href = linkToList(); }, 600);
    return;
  }
  try {
    const res = await fetchApi('/group/read/' + id);
    if(res.ok) {
      group = await res.json();
      document.querySelector('.app').style.display = 'block';
      renderHead();
      renderMembers();
      fetchGroupSchedules();
      fetchSharedPeerSchedules();
      fetchSchedulesSharedByMe();
    } else {
      showToast('모임 정보를 불러오지 못했습니다.');
      setTimeout(() => { window.location.href = linkToList(); }, 600);
    }
  } catch(e) {
    console.error(e);
  }
}
fetchGroupDetail();

// === 동적 캘린더 로직 ===
const HOLIDAYS = {
  // 2025년
  "2025-01-01": "신정", "2025-01-28": "설날", "2025-01-29": "설날", "2025-01-30": "설날",
  "2025-03-01": "삼일절", "2025-03-03": "대체공휴일", "2025-05-05": "어린이날", "2025-05-06": "부처님오신날",
  "2025-06-06": "현충일", "2025-08-15": "광복절", "2025-10-03": "개천절", "2025-10-05": "추석",
  "2025-10-06": "추석", "2025-10-07": "추석", "2025-10-08": "대체공휴일", "2025-10-09": "한글날",
  "2025-12-25": "크리스마스",
  // 2026년
  "2026-01-01": "신정", "2026-02-16": "설날 연휴", "2026-02-17": "설날", "2026-02-18": "설날 연휴",
  "2026-03-01": "삼일절", "2026-03-02": "대체공휴일", "2026-05-05": "어린이날", "2026-05-24": "부처님오신날",
  "2026-05-25": "대체공휴일", "2026-06-06": "현충일", "2026-07-17": "제헌절", "2026-08-15": "광복절",
  "2026-08-17": "대체공휴일", "2026-09-24": "추석 연휴", "2026-09-25": "추석", "2026-09-26": "추석 연휴",
  "2026-09-28": "대체공휴일", "2026-10-03": "개천절", "2026-10-05": "대체공휴일", "2026-10-09": "한글날",
  "2026-12-25": "크리스마스",
  // 2027년
  "2027-01-01": "신정", "2027-02-06": "설날 연휴", "2027-02-07": "설날", "2027-02-08": "설날 연휴",
  "2027-02-09": "대체공휴일", "2027-03-01": "삼일절", "2027-05-05": "어린이날", "2027-05-13": "부처님오신날",
  "2027-06-06": "현충일", "2027-06-07": "대체공휴일", "2027-08-15": "광복절", "2027-08-16": "대체공휴일",
  "2027-09-14": "추석 연휴", "2027-09-15": "추석", "2027-09-16": "추석 연휴", "2027-10-03": "개천절",
  "2027-10-04": "대체공휴일", "2027-10-09": "한글날", "2027-10-11": "대체공휴일", "2027-12-25": "크리스마스",
"2027-12-27": "대체공휴일"
};

let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let currentDetailDate = null;
let currentSearchQuery = '';
let searchMatches = [];
let searchMatchIndex = 0;

function goToday() {
  const d = new Date();
  calYear = d.getFullYear();
  calMonth = d.getMonth();
  const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  currentDetailDate = dateStr;
  fetchGroupSchedules();
}

function handleSearchKeyup(e) {
  if (e.key === 'Enter') performSearch();
}

function clearSearch() {
  document.getElementById('scheduleSearchInput').value = '';
  currentSearchQuery = '';
  searchMatches = [];
  searchMatchIndex = 0;
  document.getElementById('searchNextBtn').style.display = 'none';
  document.getElementById('searchClearBtn').style.display = 'none';
  renderDynamicCalendar();
  if (currentDetailDate) showDayDetail(currentDetailDate);
}

function performSearch() {
  const input = document.getElementById('scheduleSearchInput');
  if (!input) return;
  const q = input.value.trim();
  if (!q) {
    clearSearch();
    return;
  }
  
  currentSearchQuery = q;
  document.getElementById('searchClearBtn').style.display = 'inline-block';
  
  searchMatches = groupSchedules.filter(s => s.title && s.title.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  
  if (searchMatches.length === 0) {
    showToast('검색 결과와 일치하는 일정이 없습니다.');
    document.getElementById('searchNextBtn').style.display = 'none';
    renderDynamicCalendar();
    if (currentDetailDate) showDayDetail(currentDetailDate);
    return;
  }
  
  document.getElementById('searchNextBtn').style.display = 'inline-block';
  
  const today = new Date();
  let closestIdx = 0;
  let minDiff = Infinity;
  searchMatches.forEach((s, idx) => {
    if(!s.startDate) return;
    const d = new Date(s.startDate);
    const diff = Math.abs(d.getTime() - today.getTime());
    if (diff < minDiff) {
      minDiff = diff;
      closestIdx = idx;
    }
  });
  
  searchMatchIndex = closestIdx;
  jumpToMatch();
}

function goToNextMatch() {
  if (searchMatches.length === 0) return;
  searchMatchIndex = (searchMatchIndex + 1) % searchMatches.length;
  jumpToMatch();
}

function jumpToMatch() {
  const target = searchMatches[searchMatchIndex];
  if (!target || !target.startDate) return;
  
  const d = new Date(target.startDate);
  calYear = d.getFullYear();
  calMonth = d.getMonth();
  
  const dateStr = target.startDate.slice(0, 10);
  renderDynamicCalendar();
  showDayDetail(dateStr);
}

let groupSchedules = [];

async function fetchGroupSchedules() {
  try {
    const startObj = new Date(calYear, calMonth - 1, 15);
    const endObj = new Date(calYear, calMonth + 2, 15);
    const startStr = startObj.getFullYear() + '-' + String(startObj.getMonth() + 1).padStart(2, '0') + '-' + String(startObj.getDate()).padStart(2, '0') + 'T00:00:00';
    const endStr = endObj.getFullYear() + '-' + String(endObj.getMonth() + 1).padStart(2, '0') + '-' + String(endObj.getDate()).padStart(2, '0') + 'T23:59:59';
    
    const res = await fetchApi(`/group/${group.id}/schedules?start=${startStr}&end=${endStr}`);
    if(res.ok) {
      groupSchedules = await res.json();
      renderDynamicCalendar();
      renderTodaySchedules();
      if (currentDetailDate) showDayDetail(currentDetailDate, true);
    }
  } catch(e) { console.error("일정 불러오기 실패", e); }
}

function changeCalMonth(delta) {
  calMonth += delta;
  if(calMonth < 0) { calMonth = 11; calYear--; }
  if(calMonth > 11) { calMonth = 0; calYear++; }
  currentDetailDate = null;
  document.getElementById('dayDetailContainer').style.display = 'none';
  fetchGroupSchedules();
}

function renderDynamicCalendar() {
  document.getElementById('calendarMonthLabel').textContent = `${calYear}년 ${calMonth + 1}월`;

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const prevMonthDays = new Date(calYear, calMonth, 0).getDate();
  const today = new Date();

  const cells = [];
  // 이전달 꼬리
  for(let i = 0; i < firstDay; i++) {
    const d = prevMonthDays - firstDay + i + 1;
    cells.push({ day: d, otherMonth: true, y: calMonth === 0 ? calYear - 1 : calYear, m: calMonth === 0 ? 11 : calMonth - 1 });
  }
  // 이번달
  for(let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, otherMonth: false, y: calYear, m: calMonth });
  }
  // 다음달 머리
  const remainder = cells.length % 7;
  if(remainder > 0) {
    const targetM = calMonth === 11 ? 0 : calMonth + 1;
    const targetY = calMonth === 11 ? calYear + 1 : calYear;
    for(let i = 0; i < 7 - remainder; i++) {
      cells.push({ day: i + 1, otherMonth: true, y: targetY, m: targetM });
    }
  }

  const dateKeys = cells.map(c => `${c.y}-${String(c.m+1).padStart(2,'0')}-${String(c.day).padStart(2,'0')}`);
  const scheduledSlots = {};
  dateKeys.forEach(dk => {
    scheduledSlots[dk] = [null, null, null]; // 3개 슬롯
  });

  // 고유 일정 수집 및 병합 (동일 내용 중복 방지)
  const uniqueEventsMap = new Map();
  const myName = group.members.find(m => String(m.id) === String(group.myMemberId))?.name || '나';

  groupSchedules.forEach(s => {
    if (!s.startDate) return;
    const startStr = s.startDate.slice(0, 10);
    const key = `${s.id || s.scheduleId}_${startStr}`;

    let displayNick = s.nickname;
    if (s.nickname === myName && s.isPublic === 'N') {
      displayNick = `${s.nickname} (나-비공개)`;
    }

    if (!uniqueEventsMap.has(key)) {
      uniqueEventsMap.set(key, { ...s, nicknames: [displayNick] });
    } else {
      const existing = uniqueEventsMap.get(key);
      if (displayNick && !existing.nicknames.includes(displayNick)) {
        existing.nicknames.push(displayNick);
      }
      if (s.isPublic === 'Y') {
        existing.isPublic = 'Y';
      }
    }
  });

  const allEvents = Array.from(uniqueEventsMap.values());

  // 우선순위 정렬 (기간이 긴 일정, 시작일이 빠른 일정 우선, 그 다음 시간 순)
  allEvents.sort((a, b) => {
    const aStart = a.startDate.slice(0, 10);
    const aEnd = a.endDate ? a.endDate.slice(0, 10) : aStart;
    const bStart = b.startDate.slice(0, 10);
    const bEnd = b.endDate ? b.endDate.slice(0, 10) : bStart;

    const aDuration = (new Date(aEnd) - new Date(aStart));
    const bDuration = (new Date(bEnd) - new Date(bStart));

    if (aDuration !== bDuration) {
      return bDuration - aDuration;
    }
    if (aStart !== bStart) {
      return aStart.localeCompare(bStart);
    }
    if (a.time !== b.time) {
      return (a.time || '').localeCompare(b.time || '');
    }
    return (a.title || '').localeCompare(b.title || '');
  });

  // 슬롯 배정 알고리즘 구동
  allEvents.forEach(e => {
    const startStr = e.startDate.slice(0, 10);
    const endStr = e.endDate ? e.endDate.slice(0, 10) : startStr;

    const activeDates = dateKeys.filter(dk => dk >= startStr && dk <= endStr);
    if (activeDates.length === 0) return;

    let targetSlot = -1;
    for (let slotIdx = 0; slotIdx < 3; slotIdx++) {
      let isAvailable = true;
      for (let dk of activeDates) {
        if (scheduledSlots[dk][slotIdx] !== null) {
          isAvailable = false;
          break;
        }
      }
      if (isAvailable) {
        targetSlot = slotIdx;
        break;
      }
    }

    if (targetSlot !== -1) {
      activeDates.forEach(dk => {
        scheduledSlots[dk][targetSlot] = e;
      });
    }
  });

  // HTML 조립
  let html = `<div class="weekday" style="color:var(--danger)">일</div><div class="weekday">월</div><div class="weekday">화</div><div class="weekday">수</div><div class="weekday">목</div><div class="weekday">금</div><div class="weekday" style="color:var(--sky)">토</div>`;

  cells.forEach((c, cellIdx) => {
    const dateStr = dateKeys[cellIdx];
    const isToday = (calYear === today.getFullYear() && calMonth === today.getMonth() && c.day === today.getDate() && !c.otherMonth);

    const isSunday = cellIdx % 7 === 0;
    const isSaturday = cellIdx % 7 === 6;
    const mmdd = dateStr.slice(5);
    const isSolarHoliday = ["01-01", "03-01", "05-05", "06-06", "07-17", "08-15", "10-03", "10-09", "12-25"].includes(mmdd);
    const isHoliday = !!HOLIDAYS[dateStr] || isSolarHoliday;
    const isRedDay = isSunday || isHoliday;

    let otherMonthStyle = '';
    if (c.otherMonth) {
      otherMonthStyle = 'background:#FAFCFE; opacity:0.5;';
    }

    const slots = scheduledSlots[dateStr];

    // 그날 배치된 일정 중 가장 높은 슬롯 층수 계산
    let dayMaxSlot = -1;
    for (let i = 0; i < 3; i++) {
      if (slots[i] !== null) {
        dayMaxSlot = i;
      }
    }

    let eventsHtml = '';

    if (dayMaxSlot !== -1) {
      for (let i = 0; i <= dayMaxSlot; i++) {
        const s = slots[i];
        if (s === null) {
          eventsHtml += `<div class="cal-event placeholder" style="visibility: hidden; pointer-events: none; margin-bottom: 2px; padding: 2px 4px;">&nbsp;</div>`;
          continue;
        }

        // 연속 일정 판정
        let durationClass = '';
        if (s.startDate && s.endDate) {
          const startStr = s.startDate.slice(0, 10);
          const endStr = s.endDate ? s.endDate.slice(0, 10) : startStr;
          if (startStr !== endStr) {
            if (dateStr === startStr) {
              durationClass = ' event-start';
            } else if (dateStr === endStr) {
              durationClass = ' event-end';
            } else if (dateStr > startStr && dateStr < endStr) {
              durationClass = ' event-middle';
            }
          }
        }

        const displayTitle = (durationClass === ' event-middle' || durationClass === ' event-end')
            ? '&nbsp;'
            : s.title;

        let cls = s.isPublic === 'N' ? 'cal-event private' : 'cal-event public';
        cls += durationClass;
        if (s.isTemp) cls += ' blink-slow';

        if (currentSearchQuery) {
          const matched = s.title && s.title.toLowerCase().includes(currentSearchQuery.toLowerCase());
          cls += matched ? ' search-match' : ' search-mismatch';
        }

        const tooltip = `${s.title} (${s.nicknames ? s.nicknames.join(', ') : (s.nickname || '공통')})`;
        const displayTime = s.title.startsWith('모임 일정') ? '' : ` ${s.time || ''}`;

        let bgColor = '';
        let colorStyle = '';
        if (s.nicknames && s.nicknames.length > 1) {
            bgColor = '#E0F2FE';
            colorStyle = 'color: #0284C7;';
        } else {
            const mObj = group.members.find(m => m.name === s.nickname);
            const memberColor = mObj ? getMemberColor(mObj) : '#E2E8F0';
            bgColor = memberColor;
            colorStyle = 'color: white; text-shadow: 0px 1px 2px rgba(0,0,0,0.3);';
            if (s.isPublic === 'N') colorStyle += ' opacity: 0.5;';
        }

        eventsHtml += `<em class="${cls}" title="${tooltip}" style="background-color: ${bgColor}; ${colorStyle}" onclick="event.stopPropagation(); showDayDetail('${dateStr}')">${displayTitle}${displayTitle !== '&nbsp;' ? displayTime : ''}</em>`;
      }
    }

    // 3개 슬롯 외에 더보기 처리
    const daySchedules = groupSchedules.filter(s => {
      if (!s.startDate) return false;
      const startStr = s.startDate.slice(0, 10);
      const endStr = s.endDate ? s.endDate.slice(0, 10) : startStr;
      return dateStr >= startStr && dateStr <= endStr;
    });
    const totalSchedules = daySchedules.length;
    const displayedCount = slots.filter(s => s !== null).length;
    const moreCount = totalSchedules - displayedCount;
    if (moreCount > 0) {
      eventsHtml += `<span style="display:block;font-size:10px;color:var(--muted);text-align:center;margin-top:2px" onclick="event.stopPropagation(); showDayDetail('${dateStr}')">+${moreCount}개 더보기</span>`;
    }

    let dayColor = '';
    if (c.otherMonth) {
      dayColor = 'color: #A0AEC0;';
      if (isRedDay) dayColor = 'color: #FC8181;';
      else if (isSaturday) dayColor = 'color: #93C5FD;';
    } else if (!isToday) {
      if (isRedDay) dayColor = 'color: var(--danger);';
      else if (isSaturday) dayColor = 'color: var(--sky);';
    }
    
    html += `<div class="date ${isToday ? 'today' : ''}" data-date="${dateStr}" style="cursor:pointer; ${otherMonthStyle}" onclick="showDayDetail('${dateStr}')"><b style="${dayColor}">${c.day}</b>${eventsHtml}</div>`;
  });

  document.getElementById('groupCalendarContainer').innerHTML = html;
}


function showDayDetail(dateStr, forceOpen = false) {
  const container = document.getElementById('dayDetailContainer');
  const title = document.getElementById('dayDetailTitle');
  const list = document.getElementById('dayDetailList');

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  if (!forceOpen && currentDetailDate === dateStr) {
    container.style.display = 'none';
    currentDetailDate = null;
    document.querySelectorAll('#groupCalendarContainer .date').forEach(el => el.classList.remove('selected-day'));
    return;
  }

  document.querySelectorAll('#groupCalendarContainer .date').forEach(el => el.classList.remove('selected-day'));
  const currentEl = document.querySelector(`#groupCalendarContainer .date[data-date="${dateStr}"]`);
  if (currentEl) {
    currentEl.classList.add('selected-day');
  }

  currentDetailDate = dateStr;
  title.textContent = `${dateStr} 일정 상세`;

  const daySchedules = groupSchedules.filter(s => {
    if (!s.startDate) return false;
    const startStr = s.startDate.slice(0, 10);
    const endStr = s.endDate ? s.endDate.slice(0, 10) : startStr;
    return dateStr >= startStr && dateStr <= endStr;
  });

  // 일정 제목과 시간 기준으로 병합 (동일한 공유 일정은 하나로)
  const myName = group.members.find(m => String(m.id) === String(group.myMemberId))?.name || '나';
  const mergedMap = new Map();
  daySchedules.forEach(s => {
    const key = `${s.title}|${s.time}`;
    let displayNick = s.nickname;
    if (s.nickname === myName && s.isPublic === 'N') {
      displayNick = `${s.nickname} (나-비공개)`;
    }

    if (!mergedMap.has(key)) {
      mergedMap.set(key, { ...s, nicknames: [displayNick], myScheduleId: (s.nickname === myName) ? s.id : null });
    } else {
      const existing = mergedMap.get(key);
      if (displayNick && !existing.nicknames.includes(displayNick)) {
        existing.nicknames.push(displayNick);
      }
      if (s.nickname === myName) {
        existing.myScheduleId = s.id;
      }
      if (s.isPublic === 'Y') {
        existing.isPublic = 'Y';
      }
    }
  });
  let toRender = Array.from(mergedMap.values());

  // 시간 순서대로 정렬 (시간이 없을 경우 빈 문자열로 처리)
  toRender.sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  // 일정이 없을 때
  if(toRender.length === 0) {
    list.innerHTML = '<div style="font-size:12.5px; color:#64748B; text-align:center; padding:12px 0;">등록된 일정이 없습니다.</div>';
    container.style.display = 'block';
    return;
  }

  // 일정이 있을 때
  list.innerHTML = toRender.map(s => {
    const isPrivate = s.isPublic === 'N';
    const badge = isPrivate
      ? `<span style="font-size:10px; padding:3px 7px; background:#e2e8f0; color:#1e293b; font-weight:800; border-radius:4px; margin-left:6px;">비공개</span>`
      : `<span style="font-size:10px; padding:3px 7px; background:#bae6fd; color:#0369a1; font-weight:800; border-radius:4px; margin-left:6px;">공개</span>`;

    // 여러 명이 공유한 일정일 경우 이름 목록 표시
    const namesDisplay = s.nicknames && s.nicknames.length > 0 ? s.nicknames.join(', ') : '알 수 없음';
    
    const isShared = s.nicknames && s.nicknames.length > 1;
    let borderColor = '#bae6fd';
    
    if (isShared) {
      borderColor = '#bae6fd';
    } else {
      // s.nicknames[0]의 이름에서 "(나-비공개)" 같은 접미사를 제거한 원래 닉네임 추출
      let firstNick = s.nicknames && s.nicknames.length > 0 ? s.nicknames[0] : s.nickname;
      if (firstNick && firstNick.includes(' (나-비공개)')) {
        firstNick = firstNick.replace(' (나-비공개)', '');
      }
      const mObj = group.members.find(m => m.name === firstNick);
      const memberColor = mObj ? getMemberColor(mObj) : '#E2E8F0';
      borderColor = memberColor;
    }

    if (isPrivate) {
      borderColor = `color-mix(in srgb, ${borderColor} 50%, white)`;
    }

    let actionsHtml = '';
    if (s.myScheduleId) {
      actionsHtml = `
        <div style="display:flex; gap:4px; margin-left:8px;">
          <button class="btn btn-ghost btn-sm" style="font-size:12px; padding:4px 8px; color:#0284C7;" onclick="event.stopPropagation(); editMySchedule('${s.myScheduleId}')">수정</button>
          <button class="btn btn-ghost btn-sm" style="font-size:12px; padding:4px 8px; color:#EF4444;" onclick="event.stopPropagation(); deleteMySchedule('${s.myScheduleId}')">삭제</button>
        </div>
      `;
    }

    let displayTime = s.time || '';
    if (s.endDate) {
      const endObj = new Date(s.endDate);
      const eHours = String(endObj.getHours()).padStart(2, '0');
      const eMins = String(endObj.getMinutes()).padStart(2, '0');
      const eTimeStr = `${eHours}:${eMins}`;
      if (eTimeStr !== '00:00' && eTimeStr !== displayTime) {
        displayTime = `${displayTime} ~ ${eTimeStr}`;
      }
    }

    return `
      <div class="sched-item" style="border:1px solid ${borderColor}; border-left:5px solid ${borderColor}; background:#ffffff; border-radius:6px; padding:8px 12px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; flex-direction:column;">
          <div style="display:flex; align-items:center;">
            <b style="font-size:13px; color:#1E293B;">${s.title}</b>
            ${badge}
          </div>
          <div style="font-size:11px; color:#64748B; margin-top:2px;">${namesDisplay}</div>
        </div>
        <div style="display:flex; align-items:center;">
          <div style="font-size:12px; font-weight:600; color:#000;">${displayTime}</div>
          ${actionsHtml}
        </div>
      </div>
    `;
  }).join('');
  container.style.display = 'block';
}

window.openScheduleModal = function() {
  const t = document.getElementById('scheduleModalTitle');
  if(t) t.textContent = '새 모임 일정';
  document.getElementById('editScheduleId').value = '';
  document.getElementById('scheduleTitle').value = '';
  document.getElementById('scheduleDate').value = currentDetailDate || '';
  document.getElementById('scheduleTime').value = '';
  document.getElementById('scheduleEndTime').value = '';
  document.getElementById('scheduleVisibility').value = 'public';
  document.getElementById('scheduleModal').classList.add('open');
};

window.editMySchedule = function(id) {
  const s = groupSchedules.find(x => String(x.id) === String(id));
  if (!s) return;
  const t = document.getElementById('scheduleModalTitle');
  if(t) t.textContent = '모임 일정 수정';
  document.getElementById('editScheduleId').value = s.id;
  document.getElementById('scheduleTitle').value = s.title;
  document.getElementById('scheduleDate').value = s.startDate ? s.startDate.slice(0, 10) : '';
  document.getElementById('scheduleTime').value = s.time || '';
  
  let endTimeVal = '';
  if (s.endDate) {
    const endObj = new Date(s.endDate);
    const eHours = String(endObj.getHours()).padStart(2, '0');
    const eMins = String(endObj.getMinutes()).padStart(2, '0');
    endTimeVal = `${eHours}:${eMins}`;
  }
  document.getElementById('scheduleEndTime').value = endTimeVal;
  
  document.getElementById('scheduleVisibility').value = s.isPublic === 'Y' ? 'public' : 'private';
  document.getElementById('scheduleModal').classList.add('open');
};

window.deleteMySchedule = async function(id) {
  if(!confirm('정말 이 일정을 삭제하시겠습니까?')) return;
  try {
    const res = await fetchApi(`/schedule/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('일정이 삭제되었습니다.');
      fetchGroupDetail(); // 새로고침
    } else {
      showToast('일정 삭제에 실패했습니다.');
    }
  } catch(e) { console.error(e); }
};

// === 공유 일정(Peer) 로직 ===
let peerSchedules = [];

async function fetchSharedPeerSchedules() {
  try {
    const res = await fetchApi(`/group/${group.id}/peer-schedules`);
    if (res.ok) {
      peerSchedules = await res.json();
      renderSharedPeerSchedules();
    }
  } catch (e) { console.error("공유받은 일정 불러오기 실패", e); }
}

function renderSharedPeerSchedules() {
  const list = document.getElementById('sharedPeerSchedulesList');
  list.innerHTML = '';

  if (peerSchedules.length === 0) {
    list.innerHTML = '<div class="empty-note">아직 공유받은 일정이 없어요.</div>';
    return;
  }

  peerSchedules.forEach(s => {
    const isPublic = s.isPublic === 'Y';
    const badge = isPublic
      ? `<span style="font-size:10px; padding:2px 6px; background:#bae6fd; color:#0369a1; border-radius:4px; margin-left:6px; vertical-align:middle;">공개</span>`
      : `<span style="font-size:10px; padding:2px 6px; background:#e2e8f0; color:#475569; border-radius:4px; margin-left:6px; vertical-align:middle;">비공개</span>`;

    let recurBadge = '';
    if (s.scheduleType === 'WEEKLY') recurBadge = `<span style="font-size:10px; padding:2px 6px; background:#fef08a; color:#854d0e; border-radius:4px; margin-left:6px; vertical-align:middle;">매주 반복</span>`;
    else if (s.scheduleType === 'MONTHLY') recurBadge = `<span style="font-size:10px; padding:2px 6px; background:#fef08a; color:#854d0e; border-radius:4px; margin-left:6px; vertical-align:middle;">매월 반복</span>`;
    else if (s.scheduleType === 'YEARLY') recurBadge = `<span style="font-size:10px; padding:2px 6px; background:#fef08a; color:#854d0e; border-radius:4px; margin-left:6px; vertical-align:middle;">매년 반복</span>`;

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.alignItems = 'center';
    row.style.padding = '10px 14px';
    row.style.border = '1px solid #E2E8F0';
    row.style.borderRadius = '8px';
    row.style.background = '#fff';

    row.innerHTML = `
      <div>
        <div style="font-size:11px; color:#64748B; margin-bottom:2px;"><b>${s.sharerName}</b>님이 공유함</div>
        <div style="font-size:14px; font-weight:600; color:#1E293B;">${s.title}${badge}${recurBadge}</div>
        <div style="font-size:12px; color:#64748B; margin-top:4px;">${s.date} ${s.time}</div>
      </div>
      <button class="btn btn-outline btn-sm" onclick="previewImportSharedPeerSchedule('${s.shareId}')">가져오기</button>
    `;
    list.appendChild(row);
  });
}

let tempImportSchedule = null;

function hasOverlap(targetDateStr, targetTimeStr, myName) {
  if (!targetTimeStr || !targetDateStr) return false;
  // 간단한 포맷의 경우 Date.parse로 비교
  const targetTime = new Date(`${targetDateStr}T${targetTimeStr}`).getTime();
  return groupSchedules.some(s => {
    if (s.nickname !== myName) return false;
    if (!s.startDate || !s.time) return false;
    const sTime = new Date(`${s.startDate.split('T')[0]}T${s.time}`).getTime();
    if (isNaN(sTime) || isNaN(targetTime)) return false;
    const diffMin = Math.abs(sTime - targetTime) / 60000;
    return diffMin < 60;
  });
}

function previewImportSharedPeerSchedule(shareId) {
  const s = peerSchedules.find(x => String(x.shareId) === String(shareId));
  if(!s) return;

  // 달력 해당 월로 이동
  const parts = s.date.split('-');
  if(parts.length === 3) {
    calYear = parseInt(parts[0], 10);
    calMonth = parseInt(parts[1], 10) - 1;
  }

  const myName = group.members.find(m => String(m.id) === String(group.myMemberId))?.name || '내 닉네임';

  // 임시 일정 세팅
  tempImportSchedule = {
    id: 'temp-' + shareId,
    title: s.title,
    startDate: s.date,
    time: s.time,
    nickname: myName,
    isPublic: 'N', // 가상으로 보여줄 때는 비공개 스타일
    isTemp: true,
    scheduleType: s.scheduleType
  };

  // 달력 렌더링
  setTab('schedule');
  renderDynamicCalendar();

  // 겹침 확인
  const overlapped = hasOverlap(s.date, s.time, myName);
  const msgSpan = document.getElementById('importConfirmMessage');
  if (overlapped) {
    msgSpan.textContent = "같은 시간대에 일정이 있습니다. 덮어씌우시겠습니까?";
  } else {
    msgSpan.textContent = "선택한 일정을 캘린더에 비공개로 추가하시겠습니까?";
  }

  // 하단 바 띄우기
  const bar = document.getElementById('importConfirmBar');
  bar.style.display = 'flex';

  const btnPrivate = document.getElementById('btnImportPrivate');
  const btnPublic = document.getElementById('btnImportPublic');
  const btnCancel = document.getElementById('btnCancelImport');

  btnPrivate.onclick = function() {
    importSharedPeerSchedule(shareId, true, 'N');
    cleanupPreviewImport();
  };

  btnPublic.onclick = function() {
    importSharedPeerSchedule(shareId, true, 'Y');
    cleanupPreviewImport();
  };

  btnCancel.onclick = function() {
    cleanupPreviewImport();
  };
}

function cleanupPreviewImport() {
  tempImportSchedule = null;
  document.getElementById('importConfirmBar').style.display = 'none';
  renderDynamicCalendar();

  setTimeout(() => {
    if (confirm('공유 일정 탭으로 다시 돌아가시겠습니까?')) {
      setTab('shared');
    }
  }, 100);
}

async function importSharedPeerSchedule(shareId, overwrite = false, isPublic = 'N') {
  try {
    const res = await fetchApi(`/group/${group.id}/peer-schedules/${shareId}/import?overwrite=${overwrite}&isPublic=${isPublic}`, {
      method: 'POST'
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        showToast('내 개인 일정으로 가져왔습니다.');
        await fetchGroupSchedules(); // 업데이트된 일정 다시 불러오기
      } else {
        // 백엔드에서 에러 발생 시 처리
        showToast('일정 덮어쓰기에 실패했습니다.');
      }
    } else {
      showToast('일정 가져오기에 실패했습니다.');
    }
  } catch(e) {
    console.error(e);
  }
}

function showPreviewScheduleModal(dateStr) {
  const modal = document.getElementById('previewScheduleModal');
  const title = document.getElementById('previewScheduleDateTitle');
  const list = document.getElementById('previewScheduleList');

  title.textContent = dateStr;

  const myName = group.members.find(m => String(m.id) === String(group.myMemberId))?.name;
  const myDaySchedules = groupSchedules.filter(s => s.nickname === myName && s.startDate && s.startDate.startsWith(dateStr));

  if (myDaySchedules.length === 0) {
    list.innerHTML = '<div style="font-size:12px; color:#64748B; text-align:center;">일정이 없습니다.</div>';
  } else {
    list.innerHTML = myDaySchedules.map(s => {
      const isPrivate = s.isPublic === 'N';
      const badge = isPrivate
        ? `<span style="font-size:10px; padding:2px 6px; background:#e2e8f0; color:#475569; border-radius:4px; margin-left:6px;">비공개</span>`
        : `<span style="font-size:10px; padding:2px 6px; background:#bae6fd; color:#0369a1; border-radius:4px; margin-left:6px;">공개</span>`;

      return `
        <div style="background:#fff; padding:8px 10px; border-radius:6px; border:1px solid #E2E8F0; margin-bottom:6px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <b style="font-size:13px; color:#1E293B;">${s.title}</b>
              ${badge}
            </div>
            <div style="font-size:12px; font-weight:600; color:#0284C7;">${s.time}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  modal.classList.add('open');
}

let schedulesSharedByMe = [];

async function fetchSchedulesSharedByMe() {
  try {
    const res = await fetchApi(`/group/${group.id}/my-shared-schedules`);
    if (res.ok) {
      schedulesSharedByMe = await res.json();
      renderSchedulesSharedByMe();
    }
  } catch (e) { console.error("내가 공유한 일정 불러오기 실패", e); }
}

function renderSchedulesSharedByMe() {
  const list = document.getElementById('schedulesSharedByMeList');
  if (!list) return;
  list.innerHTML = '';

  if (schedulesSharedByMe.length === 0) {
    list.innerHTML = '<div class="empty-note">내가 공유한 일정이 없어요.</div>';
    return;
  }

  const grouped = {};
  schedulesSharedByMe.forEach(s => {
    const key = s.title + '|' + s.date + '|' + s.time + '|' + s.isPublic;
    if(!grouped[key]) {
      grouped[key] = {
        title: s.title,
        date: s.date,
        time: s.time,
        isPublic: s.isPublic,
        scheduleType: s.scheduleType,
        shares: []
      };
    }
    grouped[key].shares.push(s);
  });

  Object.values(grouped).forEach(group => {
    const isPublic = group.isPublic === 'Y';
    const badge = isPublic
      ? `<span style="font-size:10px; padding:3px 7px; background:#bae6fd; color:#0369a1; font-weight:800; border-radius:4px; margin-left:6px; vertical-align:middle;">공개</span>`
      : `<span style="font-size:10px; padding:3px 7px; background:#e2e8f0; color:#1e293b; font-weight:800; border-radius:4px; margin-left:6px; vertical-align:middle;">비공개</span>`;

    let recurBadge = '';
    if (group.scheduleType === 'WEEKLY') recurBadge = `<span style="font-size:10px; padding:2px 6px; background:#fef08a; color:#854d0e; border-radius:4px; margin-left:6px; vertical-align:middle;">매주 반복</span>`;
    else if (group.scheduleType === 'MONTHLY') recurBadge = `<span style="font-size:10px; padding:2px 6px; background:#fef08a; color:#854d0e; border-radius:4px; margin-left:6px; vertical-align:middle;">매월 반복</span>`;
    else if (group.scheduleType === 'YEARLY') recurBadge = `<span style="font-size:10px; padding:2px 6px; background:#fef08a; color:#854d0e; border-radius:4px; margin-left:6px; vertical-align:middle;">매년 반복</span>`;

    const names = group.shares.map(s => s.sharerName).join(', ');
    const shareIds = group.shares.map(s => s.shareId).join(',');

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.alignItems = 'center';
    row.style.padding = '10px 14px';
    row.style.border = '1px solid #E2E8F0';
    row.style.borderRadius = '8px';
    row.style.background = '#fff';
    row.style.marginBottom = '8px';

    row.innerHTML = `
      <div>
        <div style="font-size:11px; color:#64748B; margin-bottom:2px;"><b>${names}</b>님에게 공유됨</div>
        <div style="font-size:14px; font-weight:600; color:#1E293B;">${group.title}${badge}${recurBadge}</div>
        <div style="font-size:12px; color:#64748B; margin-top:4px;">${group.date} ${group.time}</div>
      </div>
      <button class="btn btn-danger btn-sm" onclick="stopSharingMultipleSchedules('${shareIds}')">공유 중지</button>
    `;
    list.appendChild(row);
  });
}

async function stopSharingMultipleSchedules(shareIdsStr) {
  if(!confirm('정말 공유를 중지하시겠습니까? (공유받은 사람이 이미 일정으로 가져간 경우 그 사람의 캘린더에는 남습니다)')) return;

  const ids = shareIdsStr.split(',');
  try {
    for(let id of ids) {
      await fetchApi(`/group/${group.id}/peer-schedules/${id}`, { method: 'DELETE' });
    }
    showToast('공유가 중지되었습니다.');
    fetchSchedulesSharedByMe();
  } catch(e) {
    console.error(e);
    showToast('오류가 발생했습니다.');
  }
}

let myPersonalSchedulesCache = [];

async function toggleShareMyScheduleContainer() {
  const container = document.getElementById('shareMyScheduleContainer');
  if (container.style.display === 'block') {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';

  const listDiv = document.getElementById('shareMyScheduleList');
  const targetDiv = document.getElementById('shareTargetMemberList');
  listDiv.innerHTML = '<div style="text-align:center; padding:10px; font-size:12px;">로딩 중...</div>';

  // 모임원 목록 렌더링 (나 제외)
  const otherMembers = group.members.filter(m => m.id !== group.myMemberId);
  if (otherMembers.length === 0) {
    targetDiv.innerHTML = '<div style="font-size:12px; color:var(--danger); padding:8px;">공유할 수 있는 다른 모임원이 없습니다.</div>';
  } else {
    targetDiv.innerHTML = otherMembers.map(m => `
      <label style="display:flex; align-items:center; gap:8px; padding:6px; cursor:pointer;">
        <input type="checkbox" name="peerTarget" value="${m.id}">
        <span style="font-size:12px;">${m.name}</span>
      </label>
    `).join('');
  }

  // 내 개인 일정 불러오기
  try {
    const res = await fetchApi('/schedule');
    if (res.ok) {
      myPersonalSchedulesCache = await res.json();
      // 최신 일정(혹은 가장 가까운 일정)이 위로 오도록 내림차순 정렬
      myPersonalSchedulesCache.sort((a, b) => {
        const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
        const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
        return dateB - dateA;
      });

      if (myPersonalSchedulesCache.length === 0) {
        listDiv.innerHTML = '<div style="font-size:12px; color:var(--muted); padding:8px;">공유할 개인 일정이 없습니다.</div>';
      } else {
        listDiv.innerHTML = myPersonalSchedulesCache.map(s => {
          const dateStr = s.startDate ? s.startDate.split('T')[0] : '';
          const timeStr = s.startDate ? s.startDate.split('T')[1].substring(0,5) : '';
          const isPublic = s.isPublic === true || s.isPublic === 'true' || s.isPublic === 'Y';
          const badge = isPublic
            ? `<span style="font-size:10px; padding:3px 7px; background:#bae6fd; color:#0369a1; font-weight:800; border-radius:4px; margin-left:6px;">공개</span>`
            : `<span style="font-size:10px; padding:3px 7px; background:#e2e8f0; color:#1e293b; font-weight:800; border-radius:4px; margin-left:6px;">비공개</span>`;

          let recurBadge = '';
          if (s.scheduleType === 'WEEKLY') recurBadge = `<span style="font-size:10px; padding:2px 6px; background:#fef08a; color:#854d0e; border-radius:4px; margin-left:6px;">매주 반복</span>`;
          else if (s.scheduleType === 'MONTHLY') recurBadge = `<span style="font-size:10px; padding:2px 6px; background:#fef08a; color:#854d0e; border-radius:4px; margin-left:6px;">매월 반복</span>`;
          else if (s.scheduleType === 'YEARLY') recurBadge = `<span style="font-size:10px; padding:2px 6px; background:#fef08a; color:#854d0e; border-radius:4px; margin-left:6px;">매년 반복</span>`;

          return `
            <label style="display:flex; align-items:flex-start; gap:8px; padding:6px; border-bottom:1px solid #F1F5F9; cursor:pointer;">
              <input type="checkbox" name="peerSchedule" value="${s.scheduleId}" style="margin-top:2px;">
              <div>
                <div style="font-size:12px; font-weight:500; display:flex; align-items:center;">${s.title} ${badge} ${recurBadge}</div>
                <div style="font-size:11px; color:#64748B; margin-top:2px;">${dateStr} ${timeStr}</div>
              </div>
            </label>
          `;
        }).join('');
      }
    } else {
      listDiv.innerHTML = '<div style="font-size:12px; color:var(--danger); padding:8px;">일정을 불러오지 못했습니다.</div>';
    }
  } catch (e) {
    console.error(e);
    listDiv.innerHTML = '<div style="font-size:12px; color:var(--danger); padding:8px;">오류가 발생했습니다.</div>';
  }
}

document.getElementById('btnSubmitShareMySchedule').addEventListener('click', async () => {
  const selectedSchedules = Array.from(document.querySelectorAll('input[name="peerSchedule"]:checked')).map(el => parseInt(el.value));
  const selectedTargets = Array.from(document.querySelectorAll('input[name="peerTarget"]:checked')).map(el => parseInt(el.value));

  if (selectedSchedules.length === 0) {
    showToast('공유할 일정을 최소 1개 이상 선택해주세요.');
    return;
  }
  if (selectedTargets.length === 0) {
    showToast('일정을 공유받을 모임원을 선택해주세요.');
    return;
  }

  try {
    const res = await fetchApi(`/group/${group.id}/peer-schedules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduleIds: selectedSchedules, targetMemberIds: selectedTargets })
    });

    if (res.ok) {
      showToast('일정을 성공적으로 공유했습니다.');
      document.getElementById('shareMyScheduleContainer').style.display = 'none';
      fetchSchedulesSharedByMe();
    } else {
      showToast('공유 처리 중 오류가 발생했습니다.');
    }
  } catch (e) { console.error(e); }
});


if (!localStorage.getItem('jwtToken')) {
            alert('로그인이 필요한 서비스입니다.');
            window.location.href = '/auth/login';
        }