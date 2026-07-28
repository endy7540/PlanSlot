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
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
  }
  const groupId = getQueryParam('id'); // /group/ai-favorites?id={id}

  document.getElementById('backToGroupBtn').href = `/group/read/${groupId}`;
  document.getElementById('backToAiBtn').href = `/group/recommend?id=${groupId}`;

  // 모임 이름 불러와서 제목 업데이트
  (async () => {
    try {
      const res = await fetchApi(`/group/${groupId}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.name) {
          document.getElementById('pageTitle').textContent = `AI 추천 일정 찜 목록 - ${data.name}`;
          document.title = `${data.name} - AI 추천 찜 목록 | PlanSlot`;
        }
      }
    } catch(e) { console.error(e); }
  })();

  async function loadFavorites() {
    const grid = document.getElementById('favoritesGrid');
    try {
      const res = await fetchApi(`/group/${groupId}/ai-recommendations/favorites`);
      if (!res.ok) throw new Error('불러오기 실패');
      const data = await res.json();
      
      if (!data || data.length === 0) {
        grid.innerHTML = `<div class="empty-state">
          <div style="font-size: 32px; margin-bottom: 12px;">❤️</div>
          <h3 style="margin-top:0; margin-bottom: 8px; color: var(--home-text);">찜한 추천 일정이 없습니다.</h3>
          <p style="font-size: 14px;">AI 추천 페이지에서 마음에 드는 시간을 찜해보세요!</p>
        </div>`;
        return;
      }
      
      grid.innerHTML = data.map(item => `
        <article class="fav-card">
          <div class="fav-rank-badge">Top ${item.rank} 추천</div>
          <h3 class="fav-title">${item.title || item.label}</h3>
          <div class="fav-date-mono">${item.date} ${item.time}</div>
          
          <div class="fav-tags">
            <span class="fav-tag fit">${item.tag}</span>
            <span class="fav-tag">${item.sub}</span>
          </div>
          
          <div style="font-size: 12px; color: var(--home-muted); margin-bottom: 16px;">
            찜한 날짜: ${new Date(item.bookmarkedAt).toLocaleDateString()}
          </div>
          
          <button class="btn-register" onclick="alert('모임 일정으로 등록하시려면 AI 추천 페이지에서 진행해주세요. (추후 연동 예정)')">일정으로 등록하기</button>
        </article>
      `).join('');
      
    } catch (e) {
      console.error(e);
      grid.innerHTML = `<div class="empty-state">데이터를 불러오는 중 오류가 발생했습니다.</div>`;
    }
  }

  document.addEventListener('DOMContentLoaded', loadFavorites);