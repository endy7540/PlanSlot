const MY_MEMBER_ID = '1';

// GROUPS 배열은 이제 백엔드 API에서 동적으로 가져옵니다.
let GROUPS = [];

function initials(name){ return name.slice(0,1); }
function isOwner(group){ return group.ownerId === MY_MEMBER_ID; }
function getGroupById(id){ return GROUPS.find(g => g.id === id); }

function getQueryParam(name){
  return new URLSearchParams(window.location.search).get(name);
}

// 현재 페이지 URL의 ?id= 를 기준으로 그룹을 가져옴 (없으면 첫 번째 모임)
function currentGroup(){
  const id = getQueryParam('id');
  return (id && getGroupById(id)) || GROUPS[0];
}

function linkToDetail(groupId){ return '/group/detail?id=' + encodeURIComponent(groupId); }
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
  if (token) {
    options.headers['Authorization'] = 'Bearer ' + token;
  }
  return fetch(url, options);
}
