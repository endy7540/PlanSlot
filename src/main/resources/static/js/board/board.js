const BOARD_TYPE_INFO = {
  NOTICE: { label: '공지사항', path: 'notice', description: '플랜슬롯의 중요한 안내와 업데이트를 확인하세요.' },
  STUDY: { label: '스터디', path: 'study', description: '함께 공부할 팀원을 찾고 스터디 소식을 나눠보세요.' },
  CLUB: { label: '소모임', path: 'club', description: '취미와 관심사가 같은 사람들과 새로운 모임을 시작해보세요.' },
  FREE: { label: '자유게시판', path: 'free', description: '학교생활과 일상의 다양한 이야기를 자유롭게 나눠보세요.' }
};

let boardToastTimer;
let reportTarget = null;
let currentListPage = 0;
let currentListKeyword = '';
let currentListSearchType = 'TITLE_CONTENT';
let currentDetailBoard = null;
let existingWriteImage = null;
let removeExistingWriteImage = false;
let selectedWriteImage = null;
let selectedWriteImagePreviewUrl = null;
let currentBoardMember = null;
let boardGroupCandidates = null;

document.addEventListener('DOMContentLoaded', async () => {
  initializeBoardHeader();
  initializeReportModal();
  initializeBoardGroupModal();

  if (getBoardToken()) {
    await loadCurrentBoardMember();
  }

  updateBoardHeaderState();

  const page = document.body.dataset.boardPage;
  if (page === 'list') await initializeBoardList();
  if (page === 'detail') await initializeBoardDetail();
  if (page === 'write') await initializeBoardWrite();
});

function initializeBoardHeader() {
  const page = document.body.dataset.boardPage;
  const type = page === 'write' ? getWriteBoardType() : document.body.dataset.boardType;

  if (BOARD_TYPE_INFO[type]) document.body.dataset.boardType = type;

  document.querySelectorAll('[data-board-nav]').forEach(link => {
    link.classList.toggle('active', link.dataset.boardNav === type);
  });

  const authButton = document.getElementById('authBtn');
  if (!authButton) return;

  authButton.addEventListener('click', () => {
    if (!getBoardToken()) {
      location.href = '/auth/login';
      return;
    }

    localStorage.removeItem('jwtToken');
    location.href = '/home';
  });
}

async function loadCurrentBoardMember() {
  try {
    currentBoardMember = await fetchBoardJson('/board/me');
  } catch (error) {
    currentBoardMember = null;

    if (error.status === 401 || error.status === 403) {
      localStorage.removeItem('jwtToken');
    }
  }
}

function updateBoardHeaderState() {
  const authButton = document.getElementById('authBtn');
  if (authButton) authButton.textContent = getBoardToken() ? '로그아웃' : '로그인 / 회원가입';
}

function initializeReportModal() {
  const modal = document.getElementById('boardReportModal');
  const cancelButton = document.getElementById('boardReportCancel');
  const submitButton = document.getElementById('boardReportSubmit');

  if (!modal || !cancelButton || !submitButton) return;

  cancelButton.addEventListener('click', closeReportModal);

  modal.addEventListener('click', event => {
    if (event.target === modal) closeReportModal();
  });

  submitButton.addEventListener('click', submitBoardReport);
}

function openReportModal(targetType, targetId) {
  if (!currentBoardMember) {
    showBoardToast('로그인 후 신고할 수 있습니다.', true);
    return;
  }

  reportTarget = { targetType, targetId };
  document.getElementById('boardReportReason').value = '';
  document.getElementById('boardReportDetail').value = '';
  document.getElementById('boardReportTitle').textContent = targetType === 'POST' ? '게시글 신고' : '댓글 신고';
  document.getElementById('boardReportModal').classList.add('open');
}

function closeReportModal() {
  document.getElementById('boardReportModal')?.classList.remove('open');
  reportTarget = null;
}

async function submitBoardReport() {
  if (!reportTarget) return;

  const reasonCode = document.getElementById('boardReportReason').value;
  const reasonDetail = document.getElementById('boardReportDetail').value.trim();

  if (!reasonCode) {
    showBoardToast('신고 사유를 선택해 주세요.', true);
    return;
  }

  if (!reasonDetail) {
    showBoardToast('신고 세부내용을 입력해 주세요.', true);
    return;
  }

  if (reasonDetail.length > 500) {
    showBoardToast('신고 세부내용은 500자 이하로 입력해 주세요.', true);
    return;
  }

  const path = reportTarget.targetType === 'POST'
      ? `/board/${reportTarget.targetId}/report`
      : `/board/comment/${reportTarget.targetId}/report`;

  try {
    await fetchBoardJson(path, {
      method: 'POST',
      body: JSON.stringify({ reasonCode, reasonDetail })
    });

    closeReportModal();
    showBoardToast('신고가 접수되었습니다.', false, 'success');
  } catch (error) {
    showBoardToast(error.message, true);
  }
}

async function initializeBoardList() {
  const type = document.body.dataset.boardType;
  const writeButton = document.getElementById('boardWriteButton');
  const searchTypeSelect = document.getElementById('boardSearchType');
  const searchInput = document.getElementById('boardSearchInput');
  const searchButton = document.getElementById('boardSearchButton');

  if (writeButton) {
    const canWrite = currentBoardMember && (type !== 'NOTICE' || currentBoardMember.role === 'ADMIN');
    writeButton.hidden = !canWrite;

    writeButton.addEventListener('click', () => {
      if (!requireBoardLogin()) return;
      location.href = `/board/write/${BOARD_TYPE_INFO[type].path}`;
    });
  }

  updateBoardSearchPlaceholder(searchTypeSelect, searchInput);

  searchTypeSelect?.addEventListener('change', () => {
    updateBoardSearchPlaceholder(searchTypeSelect, searchInput);
  });
  initializeBoardSearchDropdown(searchTypeSelect);

  searchButton?.addEventListener('click', () => {
    currentListPage = 0;
    currentListSearchType = searchTypeSelect?.value || 'TITLE_CONTENT';
    currentListKeyword = searchInput?.value.trim() || '';
    loadBoardList();
  });

  searchInput?.addEventListener('keydown', event => {
    if (event.key === 'Enter') searchButton?.click();
  });

  if (!currentBoardMember) {
    showBoardLoginPanel();
    return;
  }

  await loadBoardList();
}

function updateBoardSearchPlaceholder(searchTypeSelect, searchInput) {
  if (!searchInput) return;

  const placeholders = {
    TITLE_CONTENT: '제목 또는 내용 검색',
    TITLE: '제목 검색',
    CONTENT: '내용 검색',
    WRITER: '작성자 검색'
  };

  const searchType = searchTypeSelect?.value || 'TITLE_CONTENT';
  searchInput.placeholder = placeholders[searchType] || placeholders.TITLE_CONTENT;
}

function initializeBoardSearchDropdown(select) {
  if (!select || select.dataset.enhanced === 'true') return;

  select.dataset.enhanced = 'true';
  select.classList.add('is-enhanced');

  const wrapper = document.createElement('div');
  wrapper.className = 'board-search-select-wrap';
  select.parentNode.insertBefore(wrapper, select);
  wrapper.appendChild(select);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'board-search-select-button';
  button.setAttribute('aria-label', '검색 조건');
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');

  const selectedLabel = document.createElement('span');
  selectedLabel.className = 'board-search-selected-label';
  const arrow = document.createElement('span');
  arrow.className = 'board-search-select-arrow';
  arrow.setAttribute('aria-hidden', 'true');
  button.append(selectedLabel, arrow);

  const menu = document.createElement('div');
  menu.id = 'boardSearchTypeMenu';
  menu.className = 'board-search-select-menu';
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-label', '검색 조건 목록');
  menu.hidden = true;
  button.setAttribute('aria-controls', menu.id);

  const optionButtons = [...select.options].map(option => {
    const optionButton = document.createElement('button');
    optionButton.type = 'button';
    optionButton.className = 'board-search-select-option';
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

  syncSelectedOption();
}

async function loadBoardList() {
  const type = document.body.dataset.boardType;
  const list = document.getElementById('boardList');
  const pagination = document.getElementById('boardPagination');
  const count = document.getElementById('boardResultCount');

  list.innerHTML = '<div class="board-loading">게시글을 불러오는 중...</div>';
  pagination.innerHTML = '';

  const params = new URLSearchParams({ page: currentListPage, size: 10 });

  if (currentListKeyword) {
    params.set('searchType', currentListSearchType);
    params.set('keyword', currentListKeyword);
  }

  try {
    const page = await fetchBoardJson(`/board/type/${type.toLowerCase()}?${params}`);
    count.textContent = `총 ${page.totalElements ?? 0}개`;
    renderBoardRows(page.content || []);
    renderBoardPagination(page);
  } catch (error) {
    list.innerHTML = `<div class="board-error">${escapeBoardHtml(error.message)}</div>`;
  }
}

function renderBoardRows(boards) {
  const type = document.body.dataset.boardType;
  const list = document.getElementById('boardList');

  if (!boards.length) {
    list.innerHTML = `<div class="board-empty">${currentListKeyword ? '검색 결과가 없습니다.' : '아직 등록된 게시글이 없습니다.'}</div>`;
    return;
  }

  list.innerHTML = boards.map(board => `
    <a class="board-list-row ${type === 'NOTICE' ? 'board-notice-row' : ''}" href="/board/detail/${encodeURIComponent(board.boardId)}">
      <div class="board-list-number"><span class="board-type-badge">${BOARD_TYPE_INFO[type].label}</span></div>
      <div class="board-list-title">
        <span class="board-list-title-text">${escapeBoardHtml(board.title)}</span>
        ${board.commentCount > 0 ? `<span class="board-comment-count">[${board.commentCount}]</span>` : ''}
        ${renderRecruitmentBadges(board)}
      </div>
      <div class="board-list-writer">${escapeBoardHtml(board.writerNickname || '알 수 없음')}</div>
      <div class="board-list-views">${board.viewCount ?? 0}</div>
      <div class="board-list-date">${formatBoardDate(board.createdAt)}</div>
    </a>
  `).join('');
}

function renderBoardPagination(page) {
  const pagination = document.getElementById('boardPagination');
  const totalPages = page.totalPages || 0;

  if (totalPages <= 1) return;

  const current = page.number || 0;
  const start = Math.max(0, current - 2);
  const end = Math.min(totalPages - 1, start + 4);

  let html = `<button class="board-page-button" data-page="${current - 1}" ${current === 0 ? 'disabled' : ''}>‹</button>`;

  for (let index = start; index <= end; index++) {
    html += `<button class="board-page-button ${index === current ? 'active' : ''}" data-page="${index}">${index + 1}</button>`;
  }

  html += `<button class="board-page-button" data-page="${current + 1}" ${current >= totalPages - 1 ? 'disabled' : ''}>›</button>`;
  pagination.innerHTML = html;

  pagination.querySelectorAll('[data-page]').forEach(button => {
    button.addEventListener('click', () => {
      if (button.disabled) return;

      currentListPage = Number(button.dataset.page);
      loadBoardList();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

async function initializeBoardDetail() {
  if (!currentBoardMember) {
    showBoardLoginPanel();
    return;
  }

  const boardId = getPathNumberAfter('detail');

  if (!boardId) {
    showBoardToast('게시글 주소가 올바르지 않습니다.', true);
    return;
  }

  document.getElementById('boardCommentSubmit')?.addEventListener('click', () => createBoardComment(boardId));
  document.getElementById('boardBackButton')?.addEventListener('click', () => history.back());
  document.getElementById('boardCommentList')?.addEventListener('click', event => handleCommentAction(event, boardId));

  const detailLoaded = await loadBoardDetail(boardId);

  if (!detailLoaded) {
    document.querySelector('.board-comments')?.setAttribute('hidden', '');
    return;
  }

  await loadBoardComments(boardId);
}

async function loadBoardDetail(boardId) {
  const article = document.getElementById('boardArticle');

  try {
    const board = await fetchBoardJson(`/board/${boardId}`);
    const boardTypeInfo = BOARD_TYPE_INFO[board?.boardType];

    if (!boardTypeInfo) throw new Error('게시글 정보를 불러올 수 없습니다.');

    currentDetailBoard = board;
    document.body.dataset.boardType = board.boardType;

    document.querySelectorAll('[data-board-nav]').forEach(link => {
      link.classList.toggle('active', link.dataset.boardNav === board.boardType);
    });

    document.title = `PlanSlot - ${board.title}`;
    document.getElementById('boardDetailCategory').textContent = boardTypeInfo.label;
    document.getElementById('boardDetailTitle').textContent = board.title;
    document.getElementById('boardDetailWriter').textContent = board.writerNickname || '알 수 없음';
    document.getElementById('boardDetailDate').textContent = formatBoardDateTimeWithModified(board.createdAt, board.updatedAt);
    document.getElementById('boardDetailViews').textContent = `조회 ${board.viewCount ?? 0}`;
    document.getElementById('boardDetailContent').textContent = board.content || '';
    document.getElementById('boardDetailCommentCount').textContent = board.commentCount ?? 0;
    document.getElementById('boardListLink').href = `/board/${boardTypeInfo.path}`;
    document.getElementById('boardListLink').textContent = boardTypeInfo.label;
    renderDetailRecruitmentBadges(board);

    const image = document.getElementById('boardDetailImage');

    if (board.boardImage?.fileUrl) {
      image.src = board.boardImage.fileUrl;
      image.alt = `${board.title} 첨부 이미지`;
      image.hidden = false;
    } else {
      image.hidden = true;
    }

    renderBoardDetailActions(board);
    article.hidden = false;
    document.getElementById('boardDetailLoading').hidden = true;
    return true;
  } catch (error) {
    const message = error.status ? error.message : '게시글 정보를 불러오는 중 오류가 발생했습니다.';
    document.getElementById('boardDetailLoading').innerHTML = `<div class="board-error">${escapeBoardHtml(message)}</div>`;
    return false;
  }
}

function renderBoardDetailActions(board) {
  const actions = document.getElementById('boardDetailActions');
  const isWriter = currentBoardMember && Number(currentBoardMember.memberId) === Number(board.writerId);
  const recruitmentBoard = isRecruitmentBoard(board.boardType);
  const recruitmentOpen = board.recruitmentStatus === 'OPEN';
  const canOpenGroup = board.groupId && (isWriter || board.myGroupMemberStatus === 'ACTIVE' || board.myGroupMemberStatus === 'WAITING');
  let recruitmentActions = '';

  if (recruitmentBoard && isWriter && recruitmentOpen) {
    recruitmentActions += '<button class="board-btn board-btn-sky" type="button" id="boardGroupOpenButton">모임 만들기</button>';
  }
  if (recruitmentBoard && !isWriter && recruitmentOpen && !board.myApplicationStatus) {
    recruitmentActions += '<button class="board-btn board-btn-sky" type="button" id="boardApplyButton">신청하기</button>';
  }
  if (recruitmentBoard && !isWriter && recruitmentOpen && board.myApplicationStatus === 'PENDING') {
    recruitmentActions += '<button class="board-btn board-btn-ghost" type="button" id="boardApplicationCancelButton">신청 취소</button>';
  }
  if (canOpenGroup) {
    recruitmentActions += '<button class="board-btn board-btn-primary" type="button" id="boardGroupViewButton">모임 보기</button>';
  }

  actions.innerHTML = `
    <div class="board-action-group">
      <button class="board-btn board-btn-ghost" type="button" id="boardDetailListButton">목록으로</button>
      ${recruitmentActions}
    </div>
    <div class="board-action-group">
      ${isWriter ? `
        <a class="board-btn board-btn-ghost" href="/board/write/${BOARD_TYPE_INFO[board.boardType].path}?boardId=${board.boardId}">수정</a>
        <button class="board-btn board-btn-danger" type="button" id="boardDeleteButton">삭제</button>
      ` : '<button class="board-btn board-btn-danger" type="button" id="boardReportButton">신고</button>'}
    </div>
  `;

  document.getElementById('boardDetailListButton').addEventListener('click', () => {
    location.href = `/board/${BOARD_TYPE_INFO[board.boardType].path}`;
  });
  document.getElementById('boardReportButton')?.addEventListener('click', () => openReportModal('POST', board.boardId));
  document.getElementById('boardDeleteButton')?.addEventListener('click', () => deleteBoardPost(board));
  document.getElementById('boardApplyButton')?.addEventListener('click', () => applyToBoardGroup(board.boardId));
  document.getElementById('boardApplicationCancelButton')?.addEventListener('click', () => cancelBoardApplication(board.boardId));
  document.getElementById('boardGroupOpenButton')?.addEventListener('click', () => openBoardGroupModal(board));
  document.getElementById('boardGroupViewButton')?.addEventListener('click', () => location.href = `/group/detail?id=${board.groupId}`);
}

function isRecruitmentBoard(boardType) {
  return boardType === 'STUDY' || boardType === 'CLUB';
}

function renderRecruitmentBadges(board) {
  if (!isRecruitmentBoard(board.boardType)) return '';

  const statusBadge = board.recruitmentStatus === 'CLOSED'
      ? '<span class="board-recruitment-badge closed">모집 마감</span>'
      : '<span class="board-recruitment-badge open">모집 중</span>';

  return `<span class="board-recruitment-badges">${statusBadge}</span>`;
}

function renderDetailRecruitmentBadges(board) {
  const container = document.getElementById('boardDetailRecruitmentBadges');
  if (!container) return;

  if (!isRecruitmentBoard(board.boardType)) {
    container.hidden = true;
    container.innerHTML = '';
    return;
  }

  const statusBadge = board.recruitmentStatus === 'CLOSED'
      ? '<span class="board-recruitment-badge closed">모집 마감</span>'
      : '<span class="board-recruitment-badge open">모집 중</span>';
  container.innerHTML = statusBadge;
  container.hidden = false;
}

async function applyToBoardGroup(boardId) {
  if (!requireBoardLogin()) return;

  try {
    await fetchBoardJson(`/board/${boardId}/group/applications`, { method: 'POST' });
    currentDetailBoard.myApplicationStatus = 'PENDING';
    renderBoardDetailActions(currentDetailBoard);
    showBoardToast('모임 참가를 신청했습니다.', false, 'success');
  } catch (error) {
    showBoardToast(error.message, true);
  }
}

async function cancelBoardApplication(boardId) {
  if (!requireBoardLogin() || !confirm('참가 신청을 취소하시겠습니까?')) return;

  try {
    await fetchBoardJson(`/board/${boardId}/group/applications/me`, { method: 'DELETE' });
    currentDetailBoard.myApplicationStatus = null;
    renderBoardDetailActions(currentDetailBoard);
    showBoardToast('참가 신청을 취소했습니다.', false, 'success');
  } catch (error) {
    showBoardToast(error.message, true);
  }
}

function initializeBoardGroupModal() {
  const modal = document.getElementById('boardGroupModal');
  if (!modal) return;

  document.getElementById('boardGroupCancelStep1')?.addEventListener('click', closeBoardGroupModal);
  document.getElementById('boardGroupCancelStep2')?.addEventListener('click', closeBoardGroupModal);
  document.getElementById('boardGroupNext')?.addEventListener('click', showBoardGroupStep2);
  document.getElementById('boardGroupPrevious')?.addEventListener('click', showBoardGroupStep1);
  document.getElementById('boardGroupCreate')?.addEventListener('click', createBoardGroup);
  document.getElementById('boardGroupName')?.addEventListener('input', updateBoardGroupNameCount);
  modal.addEventListener('click', event => {
    if (event.target === modal) closeBoardGroupModal();
  });
}

async function openBoardGroupModal(board) {
  try {
    boardGroupCandidates = await fetchBoardJson(`/board/${board.boardId}/group/candidates`);
    document.getElementById('boardGroupName').value = boardGroupCandidates.groupName || board.title || '';
    updateBoardGroupNameCount();
    renderBoardGroupCandidates('boardApplicantCandidates', boardGroupCandidates.applicants || [], 'applicant');
    renderBoardGroupCandidates('boardInviteCandidates', boardGroupCandidates.inviteCandidates || [], 'invitee');
    showBoardGroupStep1();
    document.getElementById('boardGroupModal').classList.add('open');
  } catch (error) {
    showBoardToast(error.message, true);
  }
}

function closeBoardGroupModal() {
  document.getElementById('boardGroupModal')?.classList.remove('open');
  boardGroupCandidates = null;
}

function showBoardGroupStep1() {
  document.getElementById('boardGroupStep1').hidden = false;
  document.getElementById('boardGroupStep2').hidden = true;
}

function showBoardGroupStep2() {
  const groupName = document.getElementById('boardGroupName').value.trim();

  if (!groupName) {
    showBoardToast('모임 이름을 입력해 주세요.', true);
    return;
  }
  if (groupName.length > 30) {
    showBoardToast('모임 이름은 30자 이하로 입력해 주세요.', true);
    return;
  }

  document.getElementById('boardGroupStep1').hidden = true;
  document.getElementById('boardGroupStep2').hidden = false;
}

function renderBoardGroupCandidates(elementId, candidates, type) {
  const container = document.getElementById(elementId);

  if (!candidates.length) {
    container.innerHTML = `<div class="board-group-candidate-empty">${type === 'applicant' ? '현재 대기 중인 신청자가 없습니다.' : '신청자와 게시글 작성자를 제외한 추가 댓글 작성자가 없습니다.'}</div>`;
    return;
  }

  container.innerHTML = candidates.map(candidate => `
    <label class="board-group-candidate">
      <input type="checkbox" data-group-candidate="${type}" value="${candidate.memberId}">
      <span>${escapeBoardHtml(candidate.nickname)}</span>
    </label>
  `).join('');
}

function getSelectedBoardGroupIds(type) {
  return Array.from(document.querySelectorAll(`[data-group-candidate="${type}"]:checked`)).map(input => Number(input.value));
}

function updateBoardGroupNameCount() {
  const input = document.getElementById('boardGroupName');
  const count = document.getElementById('boardGroupNameCount');
  if (input && count) count.textContent = `${input.value.length} / 30`;
}

async function createBoardGroup() {
  if (!boardGroupCandidates || !currentDetailBoard) return;

  const groupName = document.getElementById('boardGroupName').value.trim();
  const selectedApplicantIds = getSelectedBoardGroupIds('applicant');
  const selectedInviteeIds = getSelectedBoardGroupIds('invitee');

  if (!groupName) {
    showBoardToast('모임 이름을 입력해 주세요.', true);
    showBoardGroupStep1();
    return;
  }
  if (!selectedApplicantIds.length && !selectedInviteeIds.length) {
    showBoardToast('신청자 또는 초대 대상자를 한 명 이상 선택해 주세요.', true);
    return;
  }

  const createButton = document.getElementById('boardGroupCreate');
  createButton.disabled = true;
  createButton.textContent = '생성 중...';

  try {
    const response = await fetchBoardJson(`/board/${currentDetailBoard.boardId}/group`, {
      method: 'POST',
      body: JSON.stringify({
        groupName,
        applicantCandidateIds: (boardGroupCandidates.applicants || []).map(candidate => candidate.memberId),
        inviteCandidateIds: (boardGroupCandidates.inviteCandidates || []).map(candidate => candidate.memberId),
        selectedApplicantIds,
        selectedInviteeIds
      })
    });

    closeBoardGroupModal();
    showBoardToast('모임 캘린더를 생성했습니다.', false, 'success');

    if (response?.groupId) {
      setTimeout(() => location.href = `/group/detail?id=${response.groupId}`, 500);
    }
  } catch (error) {
    showBoardToast(error.message, true);
  } finally {
    createButton.disabled = false;
    createButton.textContent = '모임 만들기';
  }
}

async function deleteBoardPost(board) {
  if (!requireBoardLogin() || !confirm('게시글을 삭제하시겠습니까?')) return;

  try {
    await fetchBoardJson(`/board/${board.boardId}`, { method: 'DELETE' });
    showBoardToast('게시글을 삭제했습니다.', false, 'success');
    setTimeout(() => location.href = `/board/${BOARD_TYPE_INFO[board.boardType].path}`, 450);
  } catch (error) {
    showBoardToast(error.message, true);
  }
}

async function loadBoardComments(boardId) {
  const list = document.getElementById('boardCommentList');
  list.innerHTML = '<div class="board-loading">댓글을 불러오는 중...</div>';

  try {
    const comments = await fetchBoardJson(`/board/${boardId}/comments`);
    renderBoardComments(comments || []);
  } catch (error) {
    list.innerHTML = `<div class="board-error">${escapeBoardHtml(error.message)}</div>`;
  }
}

function renderBoardComments(comments) {
  const list = document.getElementById('boardCommentList');
  document.getElementById('boardDetailCommentCount').textContent = comments.reduce((total, comment) => total + (comment.commentStatus === 'DELETED' ? 0 : 1) + (comment.replies?.length || 0), 0);

  if (!comments.length) {
    list.innerHTML = '<div class="board-empty">첫 댓글을 남겨보세요.</div>';
    return;
  }

  list.innerHTML = comments.map(comment => {
    const root = renderSingleComment(comment, false);
    const replies = (comment.replies || []).map(reply => renderSingleComment(reply, true)).join('');
    return root + replies;
  }).join('');
}

function renderSingleComment(comment, reply) {
  if (comment.commentStatus === 'DELETED') {
    return `<div class="board-comment deleted" data-comment-id="${comment.commentId}">${escapeBoardHtml(comment.content)}</div>`;
  }

  const isWriter = currentBoardMember && Number(currentBoardMember.memberId) === Number(comment.writerId);
  const initial = escapeBoardHtml((comment.writerNickname || '?').slice(0, 1));

  return `
    <article class="board-comment ${reply ? 'reply' : ''}" data-comment-id="${comment.commentId}" data-comment-content="${escapeBoardAttribute(comment.content)}">
      <div class="board-comment-head">
        <div class="board-comment-author">
          <span class="board-comment-avatar">${initial}</span>
          <span>${escapeBoardHtml(comment.writerNickname || '알 수 없음')}<small class="board-comment-time">${formatBoardDateTimeWithModified(comment.createdAt, comment.updatedAt)}</small></span>
        </div>
        <div class="board-comment-actions">
          ${!reply ? '<button class="board-text-button" data-comment-action="reply">답글</button>' : ''}
          ${isWriter ? `
            <button class="board-text-button" data-comment-action="edit">수정</button>
            <button class="board-text-button danger" data-comment-action="delete">삭제</button>
          ` : `
            <button class="board-text-button danger" data-comment-action="report">신고</button>
          `}
        </div>
      </div>
      <div class="board-comment-content">${escapeBoardHtml(comment.content)}</div>
      <div class="board-inline-slot"></div>
    </article>
  `;
}

async function createBoardComment(boardId, parentCommentId = null, content = null) {
  if (!requireBoardLogin()) return;

  const textarea = parentCommentId ? null : document.getElementById('boardCommentContent');
  const commentContent = (content ?? textarea?.value ?? '').trim();

  if (!commentContent) {
    showBoardToast('댓글 내용을 입력해 주세요.', true);
    return;
  }

  if (commentContent.length > 1000) {
    showBoardToast('댓글은 1000자 이하로 입력해 주세요.', true);
    return;
  }

  try {
    await fetchBoardJson(`/board/${boardId}/comment`, {
      method: 'POST',
      body: JSON.stringify({ content: commentContent, parentCommentId })
    });

    if (textarea) textarea.value = '';

    showBoardToast(parentCommentId ? '답글을 등록했습니다.' : '댓글을 등록했습니다.', false, 'success');
    await loadBoardComments(boardId);
  } catch (error) {
    showBoardToast(error.message, true);
  }
}

function handleCommentAction(event, boardId) {
  const button = event.target.closest('[data-comment-action]');
  if (!button) return;

  const comment = button.closest('.board-comment');
  const commentId = Number(comment.dataset.commentId);
  const action = button.dataset.commentAction;

  if (action === 'report') openReportModal('COMMENT', commentId);
  if (action === 'delete') deleteBoardComment(commentId, boardId);
  if (action === 'reply') showCommentInlineForm(comment, 'reply', boardId);
  if (action === 'edit') showCommentInlineForm(comment, 'edit', boardId);
}

function showCommentInlineForm(commentElement, mode, boardId) {
  const slot = commentElement.querySelector('.board-inline-slot');
  const commentId = Number(commentElement.dataset.commentId);
  const initialContent = mode === 'edit' ? commentElement.dataset.commentContent : '';

  document.querySelectorAll('.board-inline-slot').forEach(other => {
    if (other !== slot) other.innerHTML = '';
  });

  slot.innerHTML = `
    <div class="board-inline-form">
      <textarea maxlength="1000" placeholder="${mode === 'edit' ? '수정할 내용을 입력하세요.' : '답글을 입력하세요.'}">${escapeBoardHtml(initialContent)}</textarea>
      <button class="board-btn board-btn-primary board-btn-small" type="button">${mode === 'edit' ? '수정' : '등록'}</button>
      <button class="board-btn board-btn-ghost board-btn-small" type="button">취소</button>
    </div>
  `;

  const textarea = slot.querySelector('textarea');
  const buttons = slot.querySelectorAll('button');

  buttons[0].addEventListener('click', () => {
    if (mode === 'edit') updateBoardComment(commentId, textarea.value, boardId);
    else createBoardComment(boardId, commentId, textarea.value);
  });

  buttons[1].addEventListener('click', () => {
    slot.innerHTML = '';
  });

  textarea.focus();
}

async function updateBoardComment(commentId, content, boardId) {
  if (!requireBoardLogin()) return;

  const trimmed = content.trim();

  if (!trimmed) {
    showBoardToast('댓글 내용을 입력해 주세요.', true);
    return;
  }

  if (trimmed.length > 1000) {
    showBoardToast('댓글은 1000자 이하로 입력해 주세요.', true);
    return;
  }

  try {
    await fetchBoardJson(`/board/comment/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify({ content: trimmed })
    });

    showBoardToast('댓글을 수정했습니다.', false, 'success');
    await loadBoardComments(boardId);
  } catch (error) {
    showBoardToast(error.message, true);
  }
}

async function deleteBoardComment(commentId, boardId) {
  if (!requireBoardLogin() || !confirm('댓글을 삭제하시겠습니까?')) return;

  try {
    await fetchBoardJson(`/board/comment/${commentId}`, { method: 'DELETE' });
    showBoardToast('댓글을 삭제했습니다.', false, 'success');
    await loadBoardComments(boardId);
  } catch (error) {
    showBoardToast(error.message, true);
  }
}

async function initializeBoardWrite() {
  const type = getWriteBoardType();
  document.body.dataset.boardType = type;

  document.querySelectorAll('[data-board-nav]').forEach(link => {
    link.classList.toggle('active', link.dataset.boardNav === type);
  });

  if (!currentBoardMember) {
    showBoardLoginPanel();
    return;
  }

  if (type === 'NOTICE' && currentBoardMember.role !== 'ADMIN') {
    showWriteAccessDenied('공지사항은 관리자만 작성할 수 있습니다.');
    return;
  }

  const boardId = Number(new URLSearchParams(location.search).get('boardId')) || null;
  const form = document.getElementById('boardWriteForm');
  const titleInput = document.getElementById('boardWriteTitle');
  const contentInput = document.getElementById('boardWriteContent');
  const imageInput = document.getElementById('boardWriteImage');
  const imageSelectButton = document.getElementById('boardWriteImageSelect');

  document.getElementById('boardWriteCategory').textContent = BOARD_TYPE_INFO[type].label;
  document.getElementById('boardWritePageTitle').textContent = boardId ? '게시글 수정' : '새 게시글 작성';
  document.getElementById('boardWriteSubmit').textContent = boardId ? '수정 완료' : '등록하기';
  document.getElementById('boardWriteListLink').href = `/board/${BOARD_TYPE_INFO[type].path}`;

  document.getElementById('boardWriteCancel').addEventListener('click', () => {
    location.href = boardId ? `/board/detail/${boardId}` : `/board/${BOARD_TYPE_INFO[type].path}`;
  });

  titleInput.addEventListener('input', () => updateWriteCount('boardWriteTitleCount', titleInput.value.length, 100));
  contentInput.addEventListener('input', () => updateWriteCount('boardWriteContentCount', contentInput.value.length, 1000));
  imageInput.addEventListener('change', handleWriteImageSelection);
  imageSelectButton?.addEventListener('click', () => imageInput.click());
  initializeWriteImageDropzone(imageSelectButton);
  document.getElementById('boardWriteImageRemove').addEventListener('click', clearWriteImage);
  form.addEventListener('submit', event => saveBoardPost(event, type, boardId));

  if (boardId && !(await loadBoardForEdit(boardId, type))) return;

  document.getElementById('boardWritePanel').hidden = false;
  document.getElementById('boardWriteLoading').hidden = true;
}

async function loadBoardForEdit(boardId, expectedType) {
  try {
    const board = await fetchBoardJson(`/board/${boardId}`);

    if (board.boardType !== expectedType) {
      showWriteAccessDenied('게시판 유형이 올바르지 않습니다.');
      return false;
    }

    if (!currentBoardMember || Number(currentBoardMember.memberId) !== Number(board.writerId)) {
      showWriteAccessDenied('게시글 작성자만 수정할 수 있습니다.');
      return false;
    }

    document.getElementById('boardWriteTitle').value = board.title || '';
    document.getElementById('boardWriteContent').value = board.content || '';
    updateWriteCount('boardWriteTitleCount', (board.title || '').length, 100);
    updateWriteCount('boardWriteContentCount', (board.content || '').length, 1000);

    if (board.boardImage?.fileUrl) {
      existingWriteImage = board.boardImage;
      updateWriteImageFileName('현재 등록된 이미지');
      showWriteImagePreview(board.boardImage.fileUrl);
    }
  } catch (error) {
    showWriteAccessDenied(error.message);
    return false;
  }

  return true;
}

async function saveBoardPost(event, type, boardId) {
  event.preventDefault();

  if (!requireBoardLogin()) return;

  const title = document.getElementById('boardWriteTitle').value.trim();
  const content = document.getElementById('boardWriteContent').value.trim();

  if (!title) {
    showBoardToast('제목을 입력해 주세요.', true);
    return;
  }

  if (!content) {
    showBoardToast('내용을 입력해 주세요.', true);
    return;
  }

  if (title.length > 100 || content.length > 1000) {
    showBoardToast('제목 또는 내용의 글자 수를 확인해 주세요.', true);
    return;
  }

  const submit = document.getElementById('boardWriteSubmit');
  submit.disabled = true;
  submit.textContent = '저장 중...';

  try {
    let savedBoardId = boardId;

    if (boardId) {
      await fetchBoardJson(`/board/${boardId}`, {
        method: 'PUT',
        body: JSON.stringify({ title, content })
      });
    } else {
      savedBoardId = await fetchBoardJson(`/board/type/${type.toLowerCase()}`, {
        method: 'POST',
        body: JSON.stringify({ title, content })
      });
    }

    if (selectedWriteImage) {
      const formData = new FormData();
      formData.append('image', selectedWriteImage);

      await fetchBoardJson(`/board/${savedBoardId}/image`, {
        method: 'POST',
        body: formData
      });
    } else if (boardId && removeExistingWriteImage && existingWriteImage) {
      await fetchBoardJson(`/board/${boardId}/image/${existingWriteImage.fileId}`, {
        method: 'DELETE'
      });
    }

    showBoardToast(boardId ? '게시글을 수정했습니다.' : '게시글을 등록했습니다.', false, 'success');
    setTimeout(() => location.href = `/board/detail/${savedBoardId}`, 450);
  } catch (error) {
    showBoardToast(error.message, true);
    submit.disabled = false;
    submit.textContent = boardId ? '수정 완료' : '등록하기';
  }
}

function handleWriteImageSelection(event) {
  const file = event.target.files?.[0];

  if (!file) return;

  applyWriteImageFile(file);
}

function initializeWriteImageDropzone(dropzone) {
  if (!dropzone) return;

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, event => {
      event.preventDefault();
      dropzone.classList.add('dragging');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, event => {
      event.preventDefault();
      dropzone.classList.remove('dragging');
    });
  });

  dropzone.addEventListener('drop', event => {
    const file = event.dataTransfer?.files?.[0];
    if (file) applyWriteImageFile(file);
  });
}

function applyWriteImageFile(file) {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

  if (!allowedTypes.includes(file.type)) {
    document.getElementById('boardWriteImage').value = '';
    showBoardToast('JPG, PNG, WEBP 이미지 파일만 첨부할 수 있습니다.', true);
    return;
  }

  if (selectedWriteImagePreviewUrl) URL.revokeObjectURL(selectedWriteImagePreviewUrl);

  selectedWriteImage = file;
  removeExistingWriteImage = false;
  selectedWriteImagePreviewUrl = URL.createObjectURL(file);
  updateWriteImageFileName(file.name);
  showWriteImagePreview(selectedWriteImagePreviewUrl);
}

function clearWriteImage() {
  document.getElementById('boardWriteImage').value = '';
  if (selectedWriteImagePreviewUrl) URL.revokeObjectURL(selectedWriteImagePreviewUrl);
  selectedWriteImagePreviewUrl = null;
  selectedWriteImage = null;
  removeExistingWriteImage = Boolean(existingWriteImage);
  updateWriteImageFileName('선택된 파일 없음');
  document.getElementById('boardWriteImagePreviewWrap').classList.remove('show');
  document.getElementById('boardWriteImagePreview').removeAttribute('src');
}

function updateWriteImageFileName(fileName) {
  const fileNameElement = document.getElementById('boardWriteImageFileName');
  const dropzone = document.getElementById('boardWriteImageSelect');

  if (fileNameElement) fileNameElement.textContent = fileName;
  if (dropzone) dropzone.classList.toggle('has-file', fileName !== '선택된 파일 없음');
}

function showWriteImagePreview(url) {
  const wrap = document.getElementById('boardWriteImagePreviewWrap');
  const image = document.getElementById('boardWriteImagePreview');

  image.src = url;
  wrap.classList.add('show');
}

function showWriteAccessDenied(message) {
  document.getElementById('boardWriteLoading').innerHTML = `
    <div class="board-auth-panel">
      <h2>작성할 수 없습니다</h2>
      <p>${escapeBoardHtml(message)}</p>
      <a class="board-btn board-btn-primary" href="/board/notice">게시판으로 돌아가기</a>
    </div>
  `;

  document.getElementById('boardWritePanel').hidden = true;
}

function showBoardLoginPanel() {
  document.querySelectorAll('[data-board-auth-content]').forEach(element => {
    element.hidden = true;
  });

  const panel = document.getElementById('boardLoginPanel');

  if (panel) panel.hidden = false;
}

function getWriteBoardType() {
  const path = location.pathname.split('/').filter(Boolean);
  const value = (path[path.length - 1] || '').toUpperCase();

  return Object.values(BOARD_TYPE_INFO).some(info => info.path.toUpperCase() === value)
      ? Object.keys(BOARD_TYPE_INFO).find(key => BOARD_TYPE_INFO[key].path.toUpperCase() === value)
      : 'FREE';
}

function getPathNumberAfter(segment) {
  const parts = location.pathname.split('/').filter(Boolean);
  const index = parts.indexOf(segment);

  if (index < 0) return null;

  const value = Number(parts[index + 1]);

  return Number.isFinite(value) && value > 0 ? value : null;
}

function updateWriteCount(elementId, current, max) {
  const element = document.getElementById(elementId);

  if (element) element.textContent = `${current} / ${max}`;
}

function requireBoardLogin() {
  if (currentBoardMember) return true;

  showBoardToast('로그인 후 이용할 수 있습니다.', true);
  setTimeout(() => location.href = '/auth/login', 500);

  return false;
}

function getBoardToken() {
  return localStorage.getItem('jwtToken') || '';
}

async function fetchBoardJson(url, options = {}) {
  const token = getBoardToken();
  const headers = { Accept: 'application/json', ...(options.headers || {}) };

  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const message = await readBoardError(response);
    const error = new Error(message || '요청 처리에 실패했습니다.');

    error.status = response.status;
    throw error;
  }

  if (response.status === 204) return null;

  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (error) {
    return text;
  }
}

async function readBoardError(response) {
  const text = await response.text();

  if (!text) return `요청 처리에 실패했습니다. (${response.status})`;

  try {
    const data = JSON.parse(text);
    return data.detail || data.message || data.error || `요청 처리에 실패했습니다. (${response.status})`;
  } catch (error) {
    return text;
  }
}

function showBoardToast(message, isError = false, type = '') {
  const toast = document.getElementById('boardToast');

  if (!toast) return;

  toast.textContent = message;
  toast.className = `board-toast show${isError ? ' error' : type ? ` ${type}` : ''}`;

  clearTimeout(boardToastTimer);
  boardToastTimer = setTimeout(() => toast.className = 'board-toast', 2400);
}

function formatBoardDate(value) {
  if (!value) return '-';

  const date = new Date(value);
  const now = new Date();

  if (date.getFullYear() === now.getFullYear()) {
    return `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  }

  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

function formatBoardDateTime(value) {
  if (!value) return '-';

  const date = new Date(value);

  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function isBoardModified(createdAt, updatedAt) {
  if (!createdAt || !updatedAt) return false;

  const createdTime = new Date(createdAt).getTime();
  const updatedTime = new Date(updatedAt).getTime();

  if (!Number.isFinite(createdTime) || !Number.isFinite(updatedTime)) return false;

  return updatedTime > createdTime;
}

function formatBoardDateTimeWithModified(createdAt, updatedAt) {
  const formattedDate = formatBoardDateTime(createdAt);

  return isBoardModified(createdAt, updatedAt)
      ? `${formattedDate} (수정됨)`
      : formattedDate;
}

function escapeBoardHtml(value) {
  return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
}

function escapeBoardAttribute(value) {
  return escapeBoardHtml(value)
      .replaceAll('\n', '&#10;')
      .replaceAll('\r', '');
}
