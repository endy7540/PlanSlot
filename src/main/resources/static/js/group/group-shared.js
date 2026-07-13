const MY_MEMBER_ID = 'me';

let GROUPS = [
  {
    id:'g1', name:'웹 프로젝트 팀', ownerId:'me', filter:'joined',
    members:[
      {id:'me', name:'김플랜', role:'owner'},
      {id:'m2', name:'김하늘', role:'member'},
      {id:'m3', name:'이도윤', role:'member'},
      {id:'m4', name:'박서연', role:'member'},
      {id:'m5', name:'최민준', role:'member'},
    ],
    waiting:[
      {id:'w1', email:'yujin@planslot.app', inviterName:'김플랜'}
    ],
    mySchedules:[
      {id:'s1', title:'웹 프로젝트 회의', date:'2025-05-13', time:'15:00', visibility:'public'},
      {id:'s2', title:'개인 발표자료 준비', date:'2025-05-15', time:'20:00', visibility:'private'},
    ],
    heat:[
      {name:'김플랜', row:['busy','mid','free','free','free','busy','mid']},
      {name:'김하늘', row:['mid','busy','free','free','mid','free','free']},
      {name:'이도윤', row:['busy','free','mid','free','free','mid','free']},
      {name:'박서연', row:['free','mid','busy','free','free','free','mid']},
      {name:'최민준', row:['mid','free','free','mid','free','busy','free']},
    ],
    recs:[
      {rank:1,label:'5월 16일 (금) 15:00~16:30',sub:'전원 5명 가능',tag:'전원 가능'},
      {rank:2,label:'5월 17일 (토) 10:00~11:30',sub:'4명 가능 · 김하늘 불가',tag:'최대 참여'},
      {rank:3,label:'5월 19일 (월) 14:00~15:30',sub:'4명 가능 · 이도윤 불가',tag:'대체안'},
    ]
  },
  {
    id:'g2', name:'알고리즘 스터디', ownerId:'m3', filter:'joined',
    members:[
      {id:'me', name:'김플랜', role:'member'},
      {id:'m3', name:'이도윤', role:'owner'},
      {id:'m4', name:'박서연', role:'member'},
      {id:'m6', name:'정유진', role:'member'},
    ],
    waiting:[],
    mySchedules:[
      {id:'s3', title:'백준 풀이 공유', date:'2025-05-14', time:'21:00', visibility:'public'},
    ],
    heat:[
      {name:'김플랜', row:['free','free','busy','mid','free','free','free']},
      {name:'이도윤', row:['mid','free','busy','free','free','mid','free']},
      {name:'박서연', row:['free','mid','free','free','busy','free','mid']},
      {name:'정유진', row:['free','free','mid','free','free','free','busy']},
    ],
    recs:[
      {rank:1,label:'5월 18일 (일) 19:00~20:30',sub:'전원 4명 가능',tag:'전원 가능'},
      {rank:2,label:'5월 20일 (화) 21:00~22:00',sub:'3명 가능 · 박서연 불가',tag:'최대 참여'},
    ]
  },
  {
    id:'g3', name:'공모전 팀', ownerId:'m7', filter:'waiting',
    members:[
      {id:'m7', name:'한지우', role:'owner'},
      {id:'m8', name:'오세훈', role:'member'},
    ],
    waiting:[
      {id:'w2', email:'plan_kim@gmail.com', inviterName:'한지우', isMe:true}
    ],
    mySchedules:[],
    heat:[],
    recs:[]
  }
];

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
