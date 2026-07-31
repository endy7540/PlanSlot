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
function renderGrid(){
  const wrap = document.getElementById('groupGrid');
  const activeFilter = document.querySelector('.chip.active').dataset.filter;
  const q = document.getElementById('groupSearch').value.trim().toLowerCase();

  wrap.innerHTML = '';
  const filtered = GROUPS
    .filter(g => activeFilter === 'all' ? true : g.filter === activeFilter)
    .filter(g => (g.name || '').toLowerCase().includes(q));

  if(!filtered.length){
    wrap.innerHTML = '<div class="empty-note">조건에 맞는 모임이 없어요.</div>';
    return;
  }

  const createCard = (g) => {
    const isWaiting = g.filter === 'waiting';
    const badge = isWaiting
      ? '<span class="pill waiting">초대 대기중</span>'
      : (isOwner(g) ? '<span class="pill owner">내가 방장</span>' : '');
    const card = document.createElement('a');
    card.className = 'group-card';
    card.href = linkToDetail(g.id);
    let avatarHtml = '';
    if (g.profileImageUrl) {
      avatarHtml = `<div class="group-avatar" style="background:none; border:none; padding:0; overflow:hidden;"><img src="${g.profileImageUrl}" style="width:100%; height:100%; object-fit:cover;"></div>`;
    } else {
      avatarHtml = `<div class="group-avatar" style="background: #e2e8f0; display:flex; justify-content:center; align-items:center;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg></div>`;
    }

    const favoriteIcon = isWaiting ? '' : (g.isFavorite 
      ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="cursor:pointer; margin-left:auto;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>` 
      : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="cursor:pointer; margin-left:auto;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`);

    const unreadBadge = g.unreadChatCount > 0 
      ? `<div style="background-color:#EF4444; color:white; border-radius:9999px; padding:2px 6px; font-size:10px; font-weight:bold; margin-left:8px;">${g.unreadChatCount > 99 ? '99+' : g.unreadChatCount}</div>` 
      : '';

    card.innerHTML = `
      <div class="top-row" style="display:flex; align-items:center;">
        ${avatarHtml}
        <div style="flex:1;">
          <div style="display:flex; align-items:center;">
            <b style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:120px;">${g.name}</b>
            ${unreadBadge}
          </div>
          <div class="count">참여자 ${g.members.length}명</div>
        </div>
        ${isWaiting ? '' : `<div class="favorite-btn" data-group-id="${g.id}" style="padding:4px; z-index:10; display:flex; align-items:center;" onclick="event.preventDefault(); event.stopPropagation(); toggleFavorite('${g.id}')">${favoriteIcon}</div>`}
      </div>
      ${badge}
      <div class="card-actions" style="margin-top:12px; display:flex; justify-content:${isWaiting ? 'space-between' : 'flex-end'}; align-items:center; border-top:1px solid var(--border); padding-top:12px;">
        ${isWaiting 
          ? `<div><button class="btn btn-ghost" style="padding:4px 8px; font-size:12px; color:var(--primary);" onclick="event.preventDefault(); event.stopPropagation(); showWaitingGroupInfo(${g.id})">🔍 모임 인원 확인</button></div>
             <div style="display:flex; gap:8px;">
               <button class="btn btn-ghost" style="padding:6px 12px; font-size:13px;" onclick="event.preventDefault(); event.stopPropagation(); handleInvitation(${g.id}, 'REJECT')">거절</button>
               <button class="btn btn-primary" style="padding:6px 12px; font-size:13px;" onclick="event.preventDefault(); event.stopPropagation(); handleInvitation(${g.id}, 'ACCEPT')">수락</button>
             </div>` 
          : `<button class="btn btn-sky" style="padding:6px 12px; font-size:13px;" onclick="event.preventDefault(); event.stopPropagation(); window.location.href='/groupChat/${g.id}'">채팅방 가기</button>`
        }
      </div>
    `;
    return card;
  };

  if (activeFilter === 'all') {
    const waitingGroups = filtered.filter(g => g.filter === 'waiting');
    const joinedGroups = filtered.filter(g => g.filter !== 'waiting');
    
    if (waitingGroups.length > 0) {
      const waitingTitle = document.createElement('h3');
      waitingTitle.textContent = `초대받은 모임 (${waitingGroups.length})`;
      waitingTitle.style.width = '100%';
      waitingTitle.style.gridColumn = '1 / -1';
      waitingTitle.style.marginTop = '10px';
      waitingTitle.style.marginBottom = '10px';
      waitingTitle.style.color = 'var(--ink-dark)';
      wrap.appendChild(waitingTitle);
      
      waitingGroups.forEach(g => {
        wrap.appendChild(createCard(g));
      });
    }

    if (joinedGroups.length > 0) {
      const joinedTitle = document.createElement('h3');
      joinedTitle.textContent = `참여중인 모임 (${joinedGroups.length})`;
      joinedTitle.style.width = '100%';
      joinedTitle.style.gridColumn = '1 / -1';
      joinedTitle.style.marginTop = waitingGroups.length > 0 ? '30px' : '10px';
      joinedTitle.style.marginBottom = '10px';
      joinedTitle.style.color = 'var(--ink-dark)';
      wrap.appendChild(joinedTitle);
      
      joinedGroups.forEach(g => {
        wrap.appendChild(createCard(g));
      });
    }
  } else {
    filtered.forEach(g => {
      wrap.appendChild(createCard(g));
    });
  }
}

function initializeGroupSearchDropdown(select) {
  if (!select || select.dataset.enhanced === 'true') return;

  select.dataset.enhanced = 'true';
  select.classList.add('is-enhanced');

  const wrapper = document.createElement('div');
  wrapper.className = 'group-search-select-wrap';
  select.parentNode.insertBefore(wrapper, select);
  wrapper.appendChild(select);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'group-search-select-button';
  button.setAttribute('aria-label', '검색 조건');
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');

  const selectedLabel = document.createElement('span');
  selectedLabel.className = 'group-search-selected-label';
  const arrow = document.createElement('span');
  arrow.className = 'group-search-select-arrow';
  arrow.setAttribute('aria-hidden', 'true');
  button.append(selectedLabel, arrow);

  const menu = document.createElement('div');
  menu.id = 'groupSearchTypeMenu';
  menu.className = 'group-search-select-menu';
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-label', '검색 조건 목록');
  menu.hidden = true;
  button.setAttribute('aria-controls', menu.id);

  const optionButtons = [...select.options].map(option => {
    const optionButton = document.createElement('button');
    optionButton.type = 'button';
    optionButton.className = 'group-search-select-option';
    optionButton.dataset.value = option.value;
    optionButton.textContent = option.textContent;
    optionButton.setAttribute('role', 'option');

    optionButton.addEventListener('click', () => {
      select.value = option.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      syncSelectedOption();
      setDropdownOpen(false);
      button.focus();
    });

    menu.appendChild(optionButton);
    return optionButton;
  });

  wrapper.append(button, menu);

  function syncSelectedOption() {
    const selectedOption = select.options[select.selectedIndex];
    selectedLabel.textContent = selectedOption?.textContent || '';
    optionButtons.forEach(optionButton => {
      const selected = optionButton.dataset.value === select.value;
      optionButton.classList.toggle('selected', selected);
      optionButton.setAttribute('aria-selected', String(selected));
    });
  }

  function setDropdownOpen(open) {
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  }

  function focusOption(index) {
    optionButtons[Math.max(0, Math.min(index, optionButtons.length - 1))]?.focus();
  }

  button.addEventListener('click', () => setDropdownOpen(menu.hidden));
  button.addEventListener('keydown', event => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    setDropdownOpen(true);
    const selectedIndex = optionButtons.findIndex(optionButton => optionButton.dataset.value === select.value);
    focusOption(event.key === 'ArrowUp' ? optionButtons.length - 1 : Math.max(0, selectedIndex));
  });

  menu.addEventListener('keydown', event => {
    const currentIndex = optionButtons.indexOf(document.activeElement);

    if (event.key === 'Escape') {
      event.preventDefault();
      setDropdownOpen(false);
      button.focus();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      focusOption((currentIndex + direction + optionButtons.length) % optionButtons.length);
    }
  });

  document.addEventListener('click', event => {
    if (!wrapper.contains(event.target)) setDropdownOpen(false);
  });
  select.addEventListener('change', syncSelectedOption);

  syncSelectedOption();
}

initializeGroupSearchDropdown(document.getElementById('groupSearchType'));

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', ()=>{
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    renderGrid();
  });
});
document.getElementById('groupSearch').addEventListener('input', renderGrid);
if (document.getElementById('btnGroupSearch')) {
  document.getElementById('btnGroupSearch').addEventListener('click', renderGrid);
}

document.getElementById('btnNewGroup').addEventListener('click', ()=>{
  document.getElementById('newGroupName').value = '';
  document.getElementById('newGroupImage').value = '';
  if (typeof croppedImageBlob !== 'undefined') {
    croppedImageBlob = null;
  }
  document.getElementById('createGroupModal').style.display = 'flex';
});

document.getElementById('createCancel').addEventListener('click', ()=>{
  document.getElementById('createGroupModal').style.display = 'none';
});

document.getElementById('createConfirm').addEventListener('click', ()=>{
  const input = document.getElementById('newGroupName');
  const fileInput = document.getElementById('newGroupImage');
  const name = input.value.trim();
  if(!name){ showToast('모임 이름을 입력해주세요.'); return; }
  if(name.length > 30){ showToast('모임 이름은 30자 이하로 입력해주세요.'); return; }

  const formData = new FormData();
  formData.append('groupName', name);
  if (typeof croppedImageBlob !== 'undefined' && croppedImageBlob) {
    formData.append('file', croppedImageBlob, 'profile.png');
  } else if (fileInput.files.length > 0) {
    formData.append('file', fileInput.files[0]);
  }

  fetchApi('/group/register', {
    method: 'POST',
    body: formData
  })
    .then(res => {
      if(!res.ok) throw new Error('서버 에러가 발생했습니다.');
      return res.json();
    })
    .then(data => {
      document.getElementById('createGroupModal').style.display = 'none';
      showToast('새 모임을 만들었어요. 잠시 후 상세 페이지로 이동합니다.');
      setTimeout(()=>{
        window.location.href = linkToDetail(data.groupId);
      }, 1000);
    })
    .catch(err => {
      showToast('모임 생성에 실패했습니다. (콘솔 확인)');
      console.error(err);
    });
});

document.getElementById('newGroupName').addEventListener('keydown', (e)=>{
  if(e.key === 'Enter') {
    document.getElementById('createConfirm').click();
  }
});

let croppedImageBlob = null;
let cropper = null;

document.getElementById('newGroupImage').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) {
    croppedImageBlob = null;
    return;
  }
  
  if (file.size > 5 * 1024 * 1024) {
      showToast('파일 크기는 5MB 이하여야 합니다.');
      e.target.value = '';
      return;
  }
  
  const reader = new FileReader();
  reader.onload = function(event) {
      document.getElementById('cropImageTarget').src = event.target.result;
      document.getElementById('cropModal').style.display = 'flex';
      
      if (cropper) {
          cropper.destroy();
      }
      
      cropper = new Cropper(document.getElementById('cropImageTarget'), {
          aspectRatio: 1, // 1:1 ratio
          viewMode: 1,
          autoCropArea: 1,
          dragMode: 'move',
          background: false
      });
  };
  reader.readAsDataURL(file);
});

document.getElementById('btnCancelCrop').addEventListener('click', () => {
    document.getElementById('cropModal').style.display = 'none';
    document.getElementById('newGroupImage').value = '';
    croppedImageBlob = null;
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
});

document.getElementById('btnConfirmCrop').addEventListener('click', () => {
    if (!cropper) return;
    
    document.getElementById('btnConfirmCrop').innerText = '적용 중...';
    document.getElementById('btnConfirmCrop').disabled = true;

    cropper.getCroppedCanvas({
        width: 300,
        height: 300
    }).toBlob((blob) => {
        if (!blob) {
            showToast('이미지 크롭에 실패했습니다.');
            document.getElementById('btnConfirmCrop').innerText = '적용';
            document.getElementById('btnConfirmCrop').disabled = false;
            return;
        }
        
        croppedImageBlob = blob;
        document.getElementById('cropModal').style.display = 'none';
        showToast('사진이 적용되었습니다.');
        
        document.getElementById('btnConfirmCrop').innerText = '적용';
        document.getElementById('btnConfirmCrop').disabled = false;
    }, 'image/png');
});

async function fetchAndRenderGrid() {
  try {
    const res = await fetchApi('/group/mygroup');
    if (res.ok) {
      const data = await res.json();
      GROUPS = data.map(d => ({
        id: d.id,
        name: d.name,
        ownerId: d.ownerId,
        filter: d.filter,
        profileImageUrl: d.profileImageUrl,
        unreadChatCount: d.unreadChatCount,
        isFavorite: d.isFavorite,
        members: new Array(d.memberCount).fill({}),
        waiting: [],
        mySchedules: [],
        heat: [],
        recs: []
      }));
      renderGrid();
    } else {
      showToast('모임 목록을 불러오지 못했습니다.');
    }
  } catch (e) {
    console.error(e);
  }
}
fetchAndRenderGrid();

window.addEventListener('notificationReceived', (e) => {
  // 알림을 받으면 모임 목록(정렬 및 안 읽은 메시지 수)을 갱신합니다.
  fetchAndRenderGrid();
});

window.toggleFavorite = function(groupId) {
  fetchApi(`/group/${groupId}/favorite`, { method: 'POST' })
    .then(res => {
      if (res.ok) {
        fetchAndRenderGrid();
      } else {
        showToast('즐겨찾기 변경에 실패했습니다.');
      }
    })
    .catch(console.error);
};

window.handleInvitation = async function(groupId, action) {
  if (action === 'ACCEPT') {
    try {
      const res = await fetchApi(`/group/${groupId}/invitation/1`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ACCEPT' })
      });
      if(res.ok) {
        showToast('초대를 수락했습니다.');
        if (typeof refreshNotificationUI === 'function') refreshNotificationUI();
        fetchAndRenderGrid();
      } else {
        const err = await res.json().catch(()=>({}));
        showToast(err.message || '초대 처리에 실패했습니다.');
      }
    } catch(e) { console.error(e); }
  } else {
    fetchApi(`/group/${groupId}/invitation/0`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: action })
    })
    .then(res => {
      if (res.ok) {
        showToast('초대를 거절했습니다.');
        if (typeof refreshNotificationUI === 'function') refreshNotificationUI();
        fetchAndRenderGrid();
      } else {
        showToast('초대 처리에 실패했습니다.');
      }
    })
    .catch(console.error);
  }
};

window.showWaitingGroupInfo = async function(groupId) {
  try {
    const res = await fetchApi(`/group/read/${groupId}`);
    if(!res.ok) throw new Error();
    const data = await res.json();
    
    const myWaiting = (data.waiting || []).find(w => w.isMe);
    const inviterName = myWaiting ? myWaiting.inviterName : '방장';
    
    let membersHtml = '';
    if(data.members && data.members.length > 0) {
      membersHtml = data.members.map(m => `
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:10px; padding:12px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
          ${m.profileImageUrl 
            ? `<img src="${m.profileImageUrl}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">`
            : `<div style="width:36px; height:36px; border-radius:50%; background:#cbd5e1; display:flex; align-items:center; justify-content:center;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></div>`
          }
          <div style="flex:1;">
            <div style="font-size:14px; font-weight:700; color:#1e293b;">${m.name}</div>
            <div style="font-size:12px; color:#64748B;">${m.role === 'owner' ? '👑 방장' : '👤 모임원'}</div>
          </div>
        </div>
      `).join('');
    } else {
      membersHtml = '<div style="font-size:14px; color:#64748B; text-align:center; padding:20px 0;">현재 참여 중인 인원이 없습니다.</div>';
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.style = "display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(8px); z-index: 9999; align-items: center; justify-content: center;";
    modal.innerHTML = `
      <div class="panel" style="width: 100%; max-width: 550px; min-height: 600px; max-height: 85vh; border-radius: 16px; background: rgba(255, 255, 255, 0.95); box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); border: 1px solid rgba(255, 255, 255, 0.5); padding: 24px; position: relative; display: flex; flex-direction: column;">
        <button style="position: absolute; top: 16px; right: 16px; background: none; border: 0; font-size: 24px; color: #64748B; cursor: pointer; font-weight: bold;" onclick="this.closest('.modal-backdrop').remove()">×</button>
        
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
            <span style="font-size: 24px;">👥</span>
            <h3 style="margin: 0; font-size: 20px; font-weight: 800; color: #1E293B;">모임 참여 인원</h3>
        </div>
        
        <p style="color: #64748B; font-size: 13px; margin: 0 0 20px; line-height: 1.5;">
            <b>${data.name}</b> 모임의 현재 참여 인원입니다. 아래에서 모임원 목록을 확인해 보세요.
        </p>

        <!-- 나를 초대한 사람을 상단에 고정 표시 -->
        <div style="margin-bottom: 20px; padding: 16px; background: #E0F2FE; border: 1px solid #BAE6FD; border-radius: 12px;">
            <div style="font-size: 12px; font-weight: 700; color: #0284C7; margin-bottom: 4px;">💌 나를 초대한 사람</div>
            <div style="font-size: 16px; font-weight: 800; color: #0369A1;">${inviterName}</div>
        </div>

        <div style="font-size: 14px; font-weight: 700; color: #1E293B; margin-bottom: 12px;">전체 모임원 (${data.members ? data.members.length : 0}명)</div>
        
        <!-- 인원 목록 (스크롤 가능) -->
        <div style="overflow-y:auto; flex:1; margin-bottom:16px; padding-right:8px;">
          ${membersHtml}
        </div>
        
        <!-- 하단 확인 버튼 -->
        <div style="display:flex; justify-content:center;">
          <button class="primary" onclick="this.closest('.modal-backdrop').remove()" style="padding: 12px 24px; font-size: 14px; border-radius: 8px; border: 0; background: linear-gradient(135deg, #6366F1, #3B82F6); color: white; cursor: pointer; font-weight: bold; width: 100%;">닫기</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  } catch(e) {
    console.error(e);
    showToast('모임 정보를 불러오지 못했습니다.');
  }
};

if (!localStorage.getItem('jwtToken')) {
            alert('로그인이 필요한 서비스입니다.');
            window.location.href = '/auth/login';
        }