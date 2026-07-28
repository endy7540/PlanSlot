const BOARD_TYPE_INFO = {
  NOTICE: { label: '공지사항', path: 'notice', description: '플랜슬롯의 중요한 안내와 업데이트를 확인하세요.' },
  STUDY: { label: '스터디', path: 'study', description: '함께 공부할 팀원을 찾고 스터디 소식을 나눠보세요.' },
  GROUP: { label: '소모임', path: 'group', description: '취미와 관심사가 같은 사람들과 새로운 모임을 시작해보세요.' },
  FREE: { label: '자유게시판', path: 'free', description: '학교생활과 일상의 다양한 이야기를 자유롭게 나눠보세요.' }
};

let boardToastTimer;
let reportTarget = null;
let currentListPage = 0;
let currentCommentPage = 0;
let currentListKeyword = '';
let currentListSearchType = 'titleContent';
let currentListSort = 'latest';
let currentListMine = false;
let currentListRecruitingOnly = false;
let currentReadBoard = null;
let existingRegisterImage = null;
let removeExistingRegisterImage = false;
let selectedRegisterImage = null;
let selectedRegisterImagePreviewUrl = null;
let currentBoardMember = null;
let boardGroupCandidates = null;
const boardRequestLocks = new Set();

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
  if (page === 'read') await initializeBoardRead();
  if (page === 'register') await initializeBoardRegister();

  showStoredBoardToast();
});

function getBoardListStateFromUrl() {
  const params = new URLSearchParams(location.search);
  const page = Number(params.get('page'));
  const searchType = params.get('searchType');
  const sort = params.get('sort');
  const keyword = (params.get('keyword') || '').trim().slice(0, 100);
  const allowedSearchTypes = ['titleContent', 'title', 'content', 'writer'];
  const allowedSortTypes = ['latest', 'oldest', 'views', 'comments'];

  const type = document.body.dataset.boardType;
  const recruitmentBoard = type === 'STUDY' || type === 'GROUP';

  return {
    page: Number.isInteger(page) && page >= 0 ? page : 0,
    searchType: allowedSearchTypes.includes(searchType) ? searchType : 'titleContent',
    sort: allowedSortTypes.includes(sort) ? sort : 'latest',
    mine: params.get('mine') === 'true',
    recruitingOnly: recruitmentBoard && params.get('recruitingOnly') === 'true',
    keyword
  };
}

function applyBoardListState(searchTypeSelect, searchInput, sortSelect, mineButton, recruitingButton) {
  const state = getBoardListStateFromUrl();
  currentListPage = state.page;
  currentListSearchType = state.searchType;
  currentListSort = state.sort;
  currentListMine = state.mine;
  currentListRecruitingOnly = state.recruitingOnly;
  if (searchTypeSelect) {
    searchTypeSelect.value = currentListSearchType;
    searchTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }
  if (searchInput) searchInput.value = currentListKeyword = state.keyword;
  if (sortSelect) {
    sortSelect.value = currentListSort;
    sortSelect.boardDropdownSync?.();
  }
  updateBoardMineButton(mineButton);
  updateBoardRecruitingButton(recruitingButton);
}

function updateBoardMineButton(button) {
  if (!button) return;

  button.classList.toggle('active', currentListMine);
  button.setAttribute('aria-pressed', String(currentListMine));
  button.textContent = currentListMine ? '전체 글 보기' : '내 글 보기';
}

function updateBoardRecruitingButton(button) {
  if (!button) return;

  button.classList.toggle('active', currentListRecruitingOnly);
  button.setAttribute('aria-pressed', String(currentListRecruitingOnly));
  button.textContent = currentListRecruitingOnly ? '전체 상태 보기' : '모집 중만 보기';
}

function resetBoardListFilters(searchTypeSelect, searchInput, sortSelect) {
  currentListPage = 0;
  currentListSearchType = 'titleContent';
  currentListKeyword = '';
  currentListSort = 'latest';

  if (searchInput) searchInput.value = '';
  if (searchTypeSelect) {
    searchTypeSelect.value = currentListSearchType;
    searchTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    searchTypeSelect.boardDropdownSync?.();
  }
  if (sortSelect) {
    sortSelect.value = currentListSort;
    sortSelect.boardDropdownSync?.();
  }
}

function getCurrentBoardListUrl() {
  const type = document.body.dataset.boardType;
  const path = `/board/${BOARD_TYPE_INFO[type]?.path || 'free'}`;
  const params = new URLSearchParams();

  if (currentListPage > 0) params.set('page', String(currentListPage));
  if (currentListSort !== 'latest') params.set('sort', currentListSort);
  if (currentListMine) params.set('mine', 'true');
  if (currentListRecruitingOnly) params.set('recruitingOnly', 'true');
  if (currentListKeyword) {
    params.set('searchType', currentListSearchType);
    params.set('keyword', currentListKeyword);
  }

  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function updateBoardListUrl(mode = 'replace') {
  const url = getCurrentBoardListUrl();
  history[mode === 'push' ? 'pushState' : 'replaceState']({ boardList: true }, '', url);
}

function getBoardReturnUrl(boardType = document.body.dataset.boardType) {
  const fallback = `/board/${BOARD_TYPE_INFO[boardType]?.path || 'free'}`;
  const returnTo = new URLSearchParams(location.search).get('returnTo');
  if (!returnTo) return fallback;

  try {
    const url = new URL(returnTo, location.origin);
    const allowedPath = /^\/board\/(notice|study|group|free)$/.test(url.pathname);
    return url.origin === location.origin && allowedPath ? `${url.pathname}${url.search}` : fallback;
  } catch (error) {
    return fallback;
  }
}

function buildBoardUrlWithReturnTo(path, returnTo) {
  const url = new URL(path, location.origin);
  url.searchParams.set('returnTo', returnTo);
  return `${url.pathname}${url.search}`;
}

function buildBoardReadUrl(boardId, returnTo) {
  return buildBoardUrlWithReturnTo(`/board/read/${encodeURIComponent(boardId)}`, returnTo);
}

async function runBoardRequest(key, button, pendingText, request) {
  if (boardRequestLocks.has(key)) return false;

  boardRequestLocks.add(key);
  const originalText = button?.textContent;
  if (button) {
    button.disabled = true;
    if (pendingText) button.textContent = pendingText;
  }

  try {
    await request();
    return true;
  } finally {
    boardRequestLocks.delete(key);
    if (button) {
      button.disabled = false;
      if (originalText !== undefined) button.textContent = originalText;
    }
  }
}

function initializeBoardHeader() {
  const page = document.body.dataset.boardPage;
  const type = page === 'register' ? getRegisterBoardType() : document.body.dataset.boardType;

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

    clearBoardAuthentication();
    location.href = '/home';
  });
}

async function loadCurrentBoardMember() {
  try {
    const member = await fetchBoardJson('/board/me');

    if (!member || typeof member !== 'object' || !member.memberId) {
      const error = new Error('로그인 정보를 확인할 수 없습니다.');
      error.status = 401;
      throw error;
    }

    currentBoardMember = member;
  } catch (error) {
    currentBoardMember = null;
    if (error.status === 401) clearBoardAuthentication();
  }
}

function clearBoardAuthentication() {
  localStorage.removeItem('jwtToken');
  currentBoardMember = null;
  updateBoardHeaderState();
}

function updateBoardHeaderState() {
  const authButton = document.getElementById('authBtn');
  if (authButton) authButton.textContent = currentBoardMember ? '로그아웃' : '로그인 / 회원가입';
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

async function openReportModal(targetType, targetId) {
  if (!requireBoardLogin()) return;

  const path = targetType === 'POST'
      ? `/board/${targetId}/report/check`
      : `/board/comment/${targetId}/report/check`;

  await runBoardRequest(`report-check-${targetType}-${targetId}`, null, '', async () => {
    try {
      const duplicated = await fetchBoardJson(path);
      if (duplicated) {
        showBoardToast(targetType === 'POST' ? '이미 신고한 게시글입니다.' : '이미 신고한 댓글입니다.', true);
        return;
      }

      reportTarget = { targetType, targetId };
      document.getElementById('boardReportReason').value = '';
      document.getElementById('boardReportDetail').value = '';
      document.getElementById('boardReportTitle').textContent = targetType === 'POST' ? '게시글 신고' : '댓글 신고';
      document.getElementById('boardReportModal').classList.add('open');
    } catch (error) {
      showBoardToast(error.message, true);
    }
  });
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
  if (reasonCode === 'OTHER' && !reasonDetail) {
    showBoardToast('기타 신고 사유의 세부내용을 입력해 주세요.', true);
    return;
  }
  if (reasonDetail.length > 200) {
    showBoardToast('신고 세부내용은 200자 이하로 입력해 주세요.', true);
    return;
  }

  const target = { ...reportTarget };
  const path = target.targetType === 'POST'
      ? `/board/${target.targetId}/report`
      : `/board/comment/${target.targetId}/report`;
  const submitButton = document.getElementById('boardReportSubmit');

  await runBoardRequest(`report-${target.targetType}-${target.targetId}`, submitButton, '접수 중...', async () => {
    try {
      await fetchBoardJson(path, {
        method: 'POST',
        body: JSON.stringify({ reasonCode, reasonDetail })
      });

      closeReportModal();
      showBoardToast('신고가 접수되었습니다.', false, 'success');
    } catch (error) {
      if (error.status === 409) {
        showBoardToast(target.targetType === 'POST' ? '이미 신고한 게시글입니다.' : '이미 신고한 댓글입니다.', true);
        return;
      }
      showBoardToast(error.message, true);
    }
  });
}

async function initializeBoardList() {
  const type = document.body.dataset.boardType;
  const writeButton = document.getElementById('boardRegisterButton');
  const searchTypeSelect = document.getElementById('boardSearchType');
  const searchInput = document.getElementById('boardSearchInput');
  const searchButton = document.getElementById('boardSearchButton');
  const sortSelect = document.getElementById('boardSortSelect');
  const mineButton = document.getElementById('boardMineButton');
  const recruitingButton = document.getElementById('boardRecruitingButton');

  applyBoardListState(searchTypeSelect, searchInput, sortSelect, mineButton, recruitingButton);

  if (currentListMine && !currentBoardMember) {
    requireBoardLogin();
    return;
  }

  if (writeButton) {
    const canShowWrite = type !== 'NOTICE' || currentBoardMember?.role === 'ADMIN';
    writeButton.hidden = !canShowWrite;

    writeButton.addEventListener('click', () => {
      if (!requireBoardLogin()) return;
      location.href = buildBoardUrlWithReturnTo(`/board/register/${BOARD_TYPE_INFO[type].path}`, getCurrentBoardListUrl());
    });
  }

  updateBoardSearchPlaceholder(searchTypeSelect, searchInput);
  searchTypeSelect?.addEventListener('change', () => updateBoardSearchPlaceholder(searchTypeSelect, searchInput));
  initializeBoardSearchDropdown(searchTypeSelect);
  initializeBoardSortDropdown(sortSelect);

  searchButton?.addEventListener('click', async () => {
    const keyword = searchInput?.value.trim().slice(0, 100) || '';

    if (!keyword) {
      showBoardToast('검색어를 입력해 주세요.', true);
      searchInput?.focus();
      return;
    }

    currentListPage = 0;
    currentListSearchType = searchTypeSelect?.value || 'titleContent';
    currentListKeyword = keyword;
    updateBoardListUrl('push');
    await loadBoardList();
  });

  searchInput?.addEventListener('keydown', event => {
    if (event.key === 'Enter') searchButton?.click();
  });

  sortSelect?.addEventListener('change', async () => {
    currentListPage = 0;
    currentListSort = sortSelect.value || 'latest';
    updateBoardListUrl('push');
    await loadBoardList();
  });

  mineButton?.addEventListener('click', async () => {
    if (!currentListMine && !requireBoardLogin()) return;

    currentListMine = !currentListMine;
    resetBoardListFilters(searchTypeSelect, searchInput, sortSelect);
    updateBoardSearchPlaceholder(searchTypeSelect, searchInput);
    updateBoardMineButton(mineButton);
    updateBoardListUrl('push');
    await loadBoardList();
  });

  recruitingButton?.addEventListener('click', async () => {
    currentListRecruitingOnly = !currentListRecruitingOnly;
    currentListPage = 0;
    updateBoardRecruitingButton(recruitingButton);
    updateBoardListUrl('push');
    await loadBoardList();
  });

  window.addEventListener('popstate', async () => {
    applyBoardListState(searchTypeSelect, searchInput, sortSelect, mineButton, recruitingButton);
    updateBoardSearchPlaceholder(searchTypeSelect, searchInput);
    if (currentListMine && !currentBoardMember) {
      requireBoardLogin();
      return;
    }
    await loadBoardList();
  });

  updateBoardListUrl('replace');
  await loadBoardList();
}

function updateBoardSearchPlaceholder(searchTypeSelect, searchInput) {
  if (!searchInput) return;

  const placeholders = {
    titleContent: '제목 또는 내용 검색',
    title: '제목 검색',
    content: '내용 검색',
    writer: '작성자 검색'
  };

  const searchType = searchTypeSelect?.value || 'titleContent';
  searchInput.placeholder = placeholders[searchType] || placeholders.titleContent;
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
  select.addEventListener('change', syncSelectedOption);
  select.boardDropdownSync = syncSelectedOption;

  syncSelectedOption();
}

function initializeBoardSortDropdown(select) {
  if (!select || select.dataset.enhanced === 'true') return;

  select.dataset.enhanced = 'true';
  select.classList.add('is-enhanced');

  const wrapper = document.createElement('div');
  wrapper.className = 'board-sort-select-wrap';
  select.parentNode.insertBefore(wrapper, select);
  wrapper.appendChild(select);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'board-sort-select-button';
  button.setAttribute('aria-label', '게시글 정렬');
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');

  const selectedLabel = document.createElement('span');
  selectedLabel.className = 'board-sort-selected-label';
  const arrow = document.createElement('span');
  arrow.className = 'board-sort-select-arrow';
  arrow.setAttribute('aria-hidden', 'true');
  button.append(selectedLabel, arrow);

  const menu = document.createElement('div');
  menu.id = 'boardSortTypeMenu';
  menu.className = 'board-sort-select-menu';
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-label', '게시글 정렬 목록');
  menu.hidden = true;
  button.setAttribute('aria-controls', menu.id);

  const optionButtons = [...select.options].map(option => {
    const optionButton = document.createElement('button');
    optionButton.type = 'button';
    optionButton.className = 'board-sort-select-option';
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
  select.boardDropdownSync = syncSelectedOption;

  syncSelectedOption();
}

async function loadBoardList() {
  const type = document.body.dataset.boardType;
  const list = document.getElementById('boardList');
  const pagination = document.getElementById('boardPagination');

  list.innerHTML = '<div class="board-loading">게시글을 불러오는 중...</div>';
  pagination.innerHTML = '';

  const params = new URLSearchParams({
    page: currentListPage,
    size: 10,
    sort: currentListSort,
    mine: currentListMine,
    recruitingOnly: currentListRecruitingOnly
  });
  if (currentListKeyword) {
    params.set('searchType', currentListSearchType);
    params.set('keyword', currentListKeyword);
  }

  try {
    const page = await fetchBoardJson(`/board/type/${type.toLowerCase()}?${params}`);
    const boards = page.content || [];

    if (!boards.length && currentListPage > 0) {
      currentListPage = Math.max(0, (page.totalPages || 1) - 1);
      updateBoardListUrl('replace');
      await loadBoardList();
      return;
    }

    renderBoardRows(boards);
    renderBoardPagination(page);
  } catch (error) {
    if (error.status === 401 && currentListMine) {
      requireBoardLogin();
      return;
    }
    const errorMessage = error?.message === 'Failed to fetch'
      ? '게시글을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
      : error.message;
    list.innerHTML = `<div class="board-error">${escapeBoardHtml(errorMessage)}</div>`;
  }
}

function renderBoardRows(boards) {
  const type = document.body.dataset.boardType;
  const list = document.getElementById('boardList');
  const returnTo = getCurrentBoardListUrl();

  if (!boards.length) {
    let emptyMessage = '아직 등록된 게시글이 없습니다.';
    if (currentListKeyword) emptyMessage = '검색된 게시글이 없습니다.';
    else if (currentListMine && currentListRecruitingOnly) emptyMessage = '모집 중인 작성글이 없습니다.';
    else if (currentListMine) emptyMessage = '작성한 게시글이 없습니다.';
    else if (currentListRecruitingOnly) emptyMessage = '현재 모집 중인 게시글이 없습니다.';
    list.innerHTML = `<div class="board-empty">${emptyMessage}</div>`;
    return;
  }

  list.innerHTML = boards.map(board => `
    <a class="board-list-row ${type === 'NOTICE' ? 'board-notice-row' : ''}" href="${escapeBoardAttribute(buildBoardReadUrl(board.boardId, returnTo))}">
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
    button.addEventListener('click', async () => {
      if (button.disabled) return;
      currentListPage = Number(button.dataset.page);
      updateBoardListUrl('push');
      await loadBoardList();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

async function initializeBoardRead() {
  const boardId = getPathNumberAfter('read');

  if (!boardId) {
    showBoardToast('게시글 주소가 올바르지 않습니다.', true);
    return;
  }

  document.getElementById('boardCommentSubmit')?.addEventListener('click', event => createBoardComment(boardId, null, null, event.currentTarget));
  document.getElementById('boardBackButton')?.addEventListener('click', () => location.href = getBoardReturnUrl());
  document.getElementById('boardCommentList')?.addEventListener('click', event => handleCommentAction(event, boardId));
  updateBoardCommentFormState();

  const readLoaded = await loadBoardRead(boardId);
  if (!readLoaded) {
    document.querySelector('.board-comments')?.setAttribute('hidden', '');
    return;
  }

  await loadBoardComments(boardId);
}

async function loadBoardRead(boardId) {
  const article = document.getElementById('boardArticle');

  try {
    const board = await fetchBoardJson(`/board/${boardId}`);
    const boardTypeInfo = BOARD_TYPE_INFO[board?.boardType];
    if (!boardTypeInfo) throw new Error('게시글 정보를 불러올 수 없습니다.');

    currentReadBoard = board;
    document.body.dataset.boardType = board.boardType;
    document.querySelectorAll('[data-board-nav]').forEach(link => link.classList.toggle('active', link.dataset.boardNav === board.boardType));

    document.title = `PlanSlot - ${board.title}`;
    document.getElementById('boardReadCategory').textContent = boardTypeInfo.label;
    document.getElementById('boardReadTitle').textContent = board.title;
    renderBoardReadWriter(board);
    document.getElementById('boardReadDate').textContent = formatBoardDateTimeWithModified(board.createdAt, board.updatedAt);
    document.getElementById('boardReadViews').textContent = `조회 ${board.viewCount ?? 0}`;
    document.getElementById('boardReadContent').textContent = board.content || '';
    document.getElementById('boardReadCommentCount').textContent = board.commentCount ?? 0;
    document.getElementById('boardListLink').href = getBoardReturnUrl(board.boardType);
    document.getElementById('boardListLink').textContent = boardTypeInfo.label;
    renderReadRecruitmentBadges(board);

    const image = document.getElementById('boardReadImage');
    if (board.boardImage?.fileUrl) {
      image.src = board.boardImage.fileUrl;
      image.alt = `${board.title} 첨부 이미지`;
      image.hidden = false;
    } else {
      image.hidden = true;
    }

    renderBoardReadActions(board);
    article.hidden = false;
    document.getElementById('boardReadLoading').hidden = true;
    return true;
  } catch (error) {
    const message = error.status ? error.message : '게시글 정보를 불러오는 중 오류가 발생했습니다.';
    document.getElementById('boardReadLoading').innerHTML = `<div class="board-error">${escapeBoardHtml(message)}</div>`;
    return false;
  }
}

function renderBoardReadWriter(board) {
  const writer = document.getElementById('boardReadWriter');
  const nickname = board.writerNickname || '알 수 없음';

  writer.className = 'board-read-author';
  writer.innerHTML = `
    ${renderBoardProfileAvatar(board.writerProfileImageUrl, nickname, 'board-read-avatar')}
    <span class="board-read-author-name">${escapeBoardHtml(nickname)}</span>
  `;

  initializeBoardProfileImages(writer);
}

function renderBoardProfileAvatar(profileImageUrl, nickname, avatarClass) {
  const safeNickname = nickname || '알 수 없음';
  const imageUrl = profileImageUrl || '/images/default-avatar.png';

  return `
    <span class="board-profile-avatar ${avatarClass}">
      <img src="${escapeBoardAttribute(imageUrl)}" alt="${escapeBoardAttribute(safeNickname)} 프로필 이미지" loading="lazy" data-board-profile-image>
    </span>
  `;
}

function initializeBoardProfileImages(container) {
  container.querySelectorAll('[data-board-profile-image]').forEach(image => {
    const avatar = image.closest('.board-profile-avatar');
    const localDefaultImage = '/images/default-avatar.png';
    const externalDefaultImage = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';

    const showImage = () => {
      image.hidden = false;
      avatar?.classList.add('has-profile-image');
    };

    const showFallback = () => {
      if (!image.dataset.boardLocalFallback && image.getAttribute('src') !== localDefaultImage) {
        image.dataset.boardLocalFallback = 'true';
        image.src = localDefaultImage;
        return;
      }
      if (!image.dataset.boardExternalFallback) {
        image.dataset.boardExternalFallback = 'true';
        image.src = externalDefaultImage;
        return;
      }
      image.hidden = true;
      avatar?.classList.remove('has-profile-image');
    };

    image.addEventListener('load', showImage);
    image.addEventListener('error', showFallback);

    if (image.complete) {
      if (image.naturalWidth > 0) showImage();
      else showFallback();
    }
  });
}

function renderBoardReadActions(board) {
  const actions = document.getElementById('boardReadActions');
  const isLoggedIn = Boolean(currentBoardMember);
  const isWriter = isLoggedIn && Number(currentBoardMember.memberId) === Number(board.writerId);
  const recruitmentBoard = isRecruitmentBoard(board.boardType);
  const recruitmentOpen = board.recruitmentStatus === 'OPEN';
  const groupCreated = Boolean(board.groupId);
  const canOpenGroup = isLoggedIn && groupCreated && (isWriter || board.myGroupMemberStatus === 'ACTIVE' || board.myGroupMemberStatus === 'WAITING');
  const returnTo = getBoardReturnUrl(board.boardType);
  let recruitmentActions = '';
  let managementActions = '';

  if (isLoggedIn && recruitmentBoard && isWriter && !groupCreated) {
    recruitmentActions += '<button class="board-btn board-btn-sky" type="button" id="boardGroupOpenButton">모임 만들기</button>';
    recruitmentActions += `<button class="board-btn board-btn-ghost" type="button" id="boardRecruitmentStatusButton">${recruitmentOpen ? '모집 마감' : '모집 재개'}</button>`;
  }
  if (recruitmentBoard && !isWriter && recruitmentOpen && !groupCreated && !board.myApplicationStatus) {
    recruitmentActions += '<button class="board-btn board-btn-sky" type="button" id="boardApplyButton">신청하기</button>';
  }
  if (isLoggedIn && recruitmentBoard && !isWriter && !groupCreated && board.myApplicationStatus === 'PENDING') {
    recruitmentActions += '<button class="board-btn board-btn-ghost" type="button" id="boardApplicationCancelButton">신청 취소</button>';
  }
  if (canOpenGroup) {
    recruitmentActions += '<button class="board-btn board-btn-primary" type="button" id="boardGroupViewButton">모임 보기</button>';
  }

  const canEditBoard = isWriter || (board.boardType === 'NOTICE' && currentBoardMember?.role === 'ADMIN');
  const canDeleteBoard = isWriter || currentBoardMember?.role === 'ADMIN';

  let editAction = '';
  let deleteAction = '';
  let reportAction = '';

  if (canEditBoard) {
    const editUrl = buildBoardUrlWithReturnTo(`/board/register/${BOARD_TYPE_INFO[board.boardType].path}?boardId=${board.boardId}`, returnTo);
    editAction = `<a class="board-btn board-btn-ghost" href="${escapeBoardAttribute(editUrl)}">수정</a>`;
  }
  if (canDeleteBoard) {
    deleteAction = '<button class="board-btn board-btn-danger" type="button" id="boardDeleteButton">삭제</button>';
  }
  if (board.boardType !== 'NOTICE' && !isWriter && !canDeleteBoard) {
    reportAction = '<button class="board-btn board-btn-danger" type="button" id="boardReportButton">신고</button>';
  }

  managementActions = `${editAction}${deleteAction}${reportAction}`;

  actions.innerHTML = `
    <div class="board-action-group">
      <button class="board-btn board-btn-ghost" type="button" id="boardReadListButton">목록으로</button>
      ${recruitmentActions}
    </div>
    <div class="board-action-group">${managementActions}</div>
  `;

  document.getElementById('boardReadListButton').addEventListener('click', () => location.href = returnTo);
  document.getElementById('boardReportButton')?.addEventListener('click', () => openReportModal('POST', board.boardId));
  document.getElementById('boardDeleteButton')?.addEventListener('click', event => deleteBoardPost(board, event.currentTarget));
  document.getElementById('boardApplyButton')?.addEventListener('click', event => applyToBoardGroup(board.boardId, event.currentTarget));
  document.getElementById('boardApplicationCancelButton')?.addEventListener('click', event => cancelBoardApplication(board.boardId, event.currentTarget));
  document.getElementById('boardGroupOpenButton')?.addEventListener('click', event => openBoardGroupModal(board, event.currentTarget));
  document.getElementById('boardRecruitmentStatusButton')?.addEventListener('click', event => updateBoardRecruitmentStatus(board, event.currentTarget));
  document.getElementById('boardGroupViewButton')?.addEventListener('click', () => location.href = `/group/read?id=${board.groupId}`);
}

function updateBoardCommentFormState() {
  const form = document.getElementById('boardCommentForm');
  if (form) form.hidden = false;
}

function isRecruitmentBoard(boardType) {
  return boardType === 'STUDY' || boardType === 'GROUP';
}

function renderRecruitmentBadges(board) {
  if (!isRecruitmentBoard(board.boardType)) return '';

  const statusBadge = board.recruitmentStatus === 'CLOSED'
      ? '<span class="board-recruitment-badge closed">모집 마감</span>'
      : '<span class="board-recruitment-badge open">모집 중</span>';

  return `<span class="board-recruitment-badges">${statusBadge}</span>`;
}

function renderReadRecruitmentBadges(board) {
  const container = document.getElementById('boardReadRecruitmentBadges');
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

async function applyToBoardGroup(boardId, button) {
  if (!requireBoardLogin()) return;

  await runBoardRequest(`apply-${boardId}`, button, '신청 중...', async () => {
    try {
      await fetchBoardJson(`/board/${boardId}/group/applications`, { method: 'POST' });
      currentReadBoard.myApplicationStatus = 'PENDING';
      renderBoardReadActions(currentReadBoard);
      showBoardToast('모임 참가를 신청했습니다.', false, 'success');
    } catch (error) {
      showBoardToast(error.message, true);
    }
  });
}

async function cancelBoardApplication(boardId, button) {
  if (!requireBoardLogin() || !confirm('참가 신청을 취소하시겠습니까?')) return;

  await runBoardRequest(`cancel-application-${boardId}`, button, '취소 중...', async () => {
    try {
      await fetchBoardJson(`/board/${boardId}/group/applications/me`, { method: 'DELETE' });
      currentReadBoard.myApplicationStatus = null;
      renderBoardReadActions(currentReadBoard);
      showBoardToast('참가 신청을 취소했습니다.', false, 'success');
    } catch (error) {
      showBoardToast(error.message, true);
    }
  });
}

async function updateBoardRecruitmentStatus(board, button) {
  if (!requireBoardLogin()) return;

  const nextStatus = board.recruitmentStatus === 'OPEN' ? 'CLOSED' : 'OPEN';
  const actionLabel = nextStatus === 'CLOSED' ? '마감' : '재개';
  const confirmMessage = nextStatus === 'CLOSED'
      ? '모집을 마감하시겠습니까? 기존 신청 내역은 유지되며 모임은 계속 만들 수 있습니다.'
      : '모집을 다시 시작하시겠습니까?';
  if (!confirm(confirmMessage)) return;

  await runBoardRequest(`recruitment-${board.boardId}`, button, `${actionLabel} 중...`, async () => {
    try {
      const updatedBoard = await fetchBoardJson(`/board/${board.boardId}/recruitment-status?status=${nextStatus}`, { method: 'PATCH' });
      currentReadBoard = updatedBoard;
      renderReadRecruitmentBadges(updatedBoard);
      renderBoardReadActions(updatedBoard);
      showBoardToast(`모집을 ${actionLabel}했습니다.`, false, 'success');
    } catch (error) {
      showBoardToast(error.message, true);
    }
  });
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

async function openBoardGroupModal(board, button) {
  await runBoardRequest(`group-candidates-${board.boardId}`, button, '불러오는 중...', async () => {
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
  });
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
  if (!boardGroupCandidates || !currentReadBoard) return;

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
  await runBoardRequest(`create-group-${currentReadBoard.boardId}`, createButton, '생성 중...', async () => {
    try {
      const response = await fetchBoardJson(`/board/${currentReadBoard.boardId}/group/create`, {
        method: 'POST',
        body: JSON.stringify({
          groupName,
          selectedApplicantIds,
          selectedInviteeIds
        })
      });

      closeBoardGroupModal();
      showBoardToast('모임 캘린더를 생성했습니다.', false, 'success');
      if (response?.groupId) {
        await new Promise(resolve => setTimeout(resolve, 500));
        location.href = `/group/read?id=${response.groupId}`;
      }
    } catch (error) {
      showBoardToast(error.message, true);
    }
  });
}

async function deleteBoardPost(board, button) {
  if (!requireBoardLogin() || !confirm('게시글을 삭제하시겠습니까?')) return;

  await runBoardRequest(`delete-board-${board.boardId}`, button, '삭제 중...', async () => {
    try {
      await fetchBoardJson(`/board/${board.boardId}`, { method: 'DELETE' });
      showBoardToast('게시글을 삭제했습니다.', false, 'success');
      await new Promise(resolve => setTimeout(resolve, 450));
      location.href = getBoardReturnUrl(board.boardType);
    } catch (error) {
      showBoardToast(error.message, true);
    }
  });
}

async function loadBoardComments(boardId, moveToLastPage = false) {
  const list = document.getElementById('boardCommentList');
  const pagination = document.getElementById('boardCommentPagination');
  list.innerHTML = '<div class="board-loading">댓글을 불러오는 중...</div>';
  if (pagination) pagination.innerHTML = '';

  const params = new URLSearchParams({ page: currentCommentPage, size: 10 });

  try {
    const page = await fetchBoardJson(`/board/${boardId}/comments?${params}`);
    const totalPages = page.totalPages || 0;

    if (moveToLastPage && totalPages > 0 && currentCommentPage !== totalPages - 1) {
      currentCommentPage = totalPages - 1;
      await loadBoardComments(boardId);
      return;
    }

    if (!(page.content || []).length && currentCommentPage > 0) {
      currentCommentPage = Math.max(0, totalPages - 1);
      await loadBoardComments(boardId);
      return;
    }

    renderBoardComments(page.content || []);
    renderBoardCommentPagination(page, boardId);
  } catch (error) {
    list.innerHTML = `<div class="board-error">${escapeBoardHtml(error.message)}</div>`;
  }
}

function renderBoardComments(comments) {
  const list = document.getElementById('boardCommentList');

  if (!comments.length) {
    list.innerHTML = `<div class="board-empty">${currentBoardMember ? '첫 댓글을 남겨보세요.' : '등록된 댓글이 없습니다.'}</div>`;
    return;
  }

  list.innerHTML = comments.map(comment => {
    const root = renderSingleComment(comment, false);
    const replies = (comment.replies || []).map(reply => renderSingleComment(reply, true)).join('');
    return root + replies;
  }).join('');

  initializeBoardProfileImages(list);
}

function renderBoardCommentPagination(page, boardId) {
  const pagination = document.getElementById('boardCommentPagination');
  const totalPages = page.totalPages || 0;

  if (!pagination || totalPages <= 1) return;

  const current = page.number || 0;
  const start = Math.max(0, current - 2);
  const end = Math.min(totalPages - 1, start + 4);
  let html = `<button class="board-page-button" data-comment-page="${current - 1}" ${current === 0 ? 'disabled' : ''}>‹</button>`;

  for (let index = start; index <= end; index++) {
    html += `<button class="board-page-button ${index === current ? 'active' : ''}" data-comment-page="${index}">${index + 1}</button>`;
  }

  html += `<button class="board-page-button" data-comment-page="${current + 1}" ${current >= totalPages - 1 ? 'disabled' : ''}>›</button>`;
  pagination.innerHTML = html;

  pagination.querySelectorAll('[data-comment-page]').forEach(button => {
    button.addEventListener('click', async () => {
      if (button.disabled) return;

      currentCommentPage = Number(button.dataset.commentPage);
      await loadBoardComments(boardId);
      document.querySelector('.board-comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function renderSingleComment(comment, reply) {
  if (comment.commentStatus === 'DELETED') {
    return `<div class="board-comment deleted" data-comment-id="${comment.commentId}">${escapeBoardHtml(comment.content)}</div>`;
  }

  const isLoggedIn = Boolean(currentBoardMember);
  const isWriter = isLoggedIn && Number(currentBoardMember.memberId) === Number(comment.writerId);
  const nickname = comment.writerNickname || '알 수 없음';
  let actionButtons = '';

  if (!reply) actionButtons += '<button class="board-text-button" data-comment-action="reply">답글</button>';

  if (isWriter) {
    actionButtons += `
      <button class="board-text-button" data-comment-action="edit">수정</button>
      <button class="board-text-button danger" data-comment-action="delete">삭제</button>
    `;
  } else {
    actionButtons += '<button class="board-text-button danger" data-comment-action="report">신고</button>';
  }

  return `
    <article class="board-comment ${reply ? 'reply' : ''}" data-comment-id="${comment.commentId}" data-comment-content="${escapeBoardAttribute(comment.content)}">
      <div class="board-comment-head">
        <div class="board-comment-author">
          ${renderBoardProfileAvatar(comment.writerProfileImageUrl, nickname, 'board-comment-avatar')}
          <span>${escapeBoardHtml(nickname)}<small class="board-comment-time">${formatBoardDateTimeWithModified(comment.createdAt, comment.updatedAt)}</small></span>
        </div>
        ${actionButtons ? `<div class="board-comment-actions">${actionButtons}</div>` : ''}
      </div>
      <div class="board-comment-content">${escapeBoardHtml(comment.content)}</div>
      <div class="board-inline-slot"></div>
    </article>
  `;
}

async function createBoardComment(boardId, parentCommentId = null, content = null, button = null) {
  if (!requireBoardLogin()) return;

  const textarea = parentCommentId ? null : document.getElementById('boardCommentContent');
  const commentContent = (content ?? textarea?.value ?? '').trim();

  if (!commentContent) {
    showBoardToast('댓글 내용을 입력해 주세요.', true);
    return;
  }
  if (commentContent.length > 500) {
    showBoardToast('댓글은 500자 이하로 입력해 주세요.', true);
    return;
  }

  const key = `create-comment-${boardId}-${parentCommentId || 'root'}`;
  await runBoardRequest(key, button, parentCommentId ? '등록 중...' : '등록 중...', async () => {
    try {
      await fetchBoardJson(`/board/${boardId}/comment`, {
        method: 'POST',
        body: JSON.stringify({ content: commentContent, parentCommentId })
      });

      if (textarea) textarea.value = '';
      updateBoardCommentCount(1);
      showBoardToast(parentCommentId ? '답글을 등록했습니다.' : '댓글을 등록했습니다.', false, 'success');
      await loadBoardComments(boardId, !parentCommentId);
    } catch (error) {
      showBoardToast(error.message, true);
    }
  });
}

function handleCommentAction(event, boardId) {
  const button = event.target.closest('[data-comment-action]');
  if (!button) return;

  const comment = button.closest('.board-comment');
  const commentId = Number(comment.dataset.commentId);
  const action = button.dataset.commentAction;

  if (action === 'report') openReportModal('COMMENT', commentId);
  if (action === 'delete') deleteBoardComment(commentId, boardId, button);
  if (action === 'reply') {
    if (!requireBoardLogin()) return;
    showCommentInlineForm(comment, 'reply', boardId);
  }
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
      <textarea maxlength="500" placeholder="${mode === 'edit' ? '수정할 내용을 입력하세요.' : '답글을 입력하세요.'}">${escapeBoardHtml(initialContent)}</textarea>
      <button class="board-btn board-btn-primary board-btn-small" type="button">${mode === 'edit' ? '수정' : '등록'}</button>
      <button class="board-btn board-btn-ghost board-btn-small" type="button">취소</button>
    </div>
  `;

  const textarea = slot.querySelector('textarea');
  const buttons = slot.querySelectorAll('button');
  buttons[0].addEventListener('click', () => {
    if (mode === 'edit') updateBoardComment(commentId, textarea.value, boardId, buttons[0]);
    else createBoardComment(boardId, commentId, textarea.value, buttons[0]);
  });
  buttons[1].addEventListener('click', () => slot.innerHTML = '');
  textarea.focus();
}

async function updateBoardComment(commentId, content, boardId, button) {
  if (!requireBoardLogin()) return;

  const trimmed = content.trim();
  if (!trimmed) {
    showBoardToast('댓글 내용을 입력해 주세요.', true);
    return;
  }
  if (trimmed.length > 500) {
    showBoardToast('댓글은 500자 이하로 입력해 주세요.', true);
    return;
  }

  await runBoardRequest(`update-comment-${commentId}`, button, '수정 중...', async () => {
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
  });
}

async function deleteBoardComment(commentId, boardId, button) {
  if (!requireBoardLogin() || !confirm('댓글을 삭제하시겠습니까?')) return;

  await runBoardRequest(`delete-comment-${commentId}`, button, '삭제 중...', async () => {
    try {
      await fetchBoardJson(`/board/comment/${commentId}`, { method: 'DELETE' });
      updateBoardCommentCount(-1);
      showBoardToast('댓글을 삭제했습니다.', false, 'success');
      await loadBoardComments(boardId);
    } catch (error) {
      showBoardToast(error.message, true);
    }
  });
}

function updateBoardCommentCount(change) {
  if (!currentReadBoard) return;

  currentReadBoard.commentCount = Math.max(0, Number(currentReadBoard.commentCount || 0) + change);
  const count = document.getElementById('boardReadCommentCount');
  if (count) count.textContent = currentReadBoard.commentCount;
}

async function initializeBoardRegister() {
  const type = getRegisterBoardType();
  if (!type || !BOARD_TYPE_INFO[type]) {
    showRegisterAccessDenied('게시판 유형을 확인할 수 없습니다. 목록에서 다시 글쓰기를 눌러 주세요.');
    return;
  }

  document.body.dataset.boardType = type;
  document.querySelectorAll('[data-board-nav]').forEach(link => link.classList.toggle('active', link.dataset.boardNav === type));

  if (!currentBoardMember) {
    showBoardLoginPanel();
    return;
  }
  if (type === 'NOTICE' && currentBoardMember.role !== 'ADMIN') {
    showRegisterAccessDenied('공지사항은 관리자만 작성할 수 있습니다.');
    return;
  }

  const boardId = Number(new URLSearchParams(location.search).get('boardId')) || null;
  const returnTo = getBoardReturnUrl(type);
  const form = document.getElementById('boardRegisterForm');
  const titleInput = document.getElementById('boardRegisterTitle');
  const contentInput = document.getElementById('boardRegisterContent');
  const imageInput = document.getElementById('boardRegisterImage');
  const imageSelectButton = document.getElementById('boardRegisterImageSelect');

  document.getElementById('boardRegisterCategory').textContent = BOARD_TYPE_INFO[type].label;
  document.getElementById('boardRegisterPageTitle').textContent = boardId ? '게시글 수정' : '새 게시글 작성';
  document.getElementById('boardRegisterSubmit').textContent = boardId ? '수정 완료' : '등록하기';
  document.getElementById('boardRegisterListLink').href = returnTo;
  document.getElementById('boardRegisterCancel').addEventListener('click', () => {
    location.href = boardId ? buildBoardReadUrl(boardId, returnTo) : returnTo;
  });

  titleInput.addEventListener('input', () => updateRegisterCount('boardRegisterTitleCount', titleInput.value.length, 100));
  contentInput.addEventListener('input', () => updateRegisterCount('boardRegisterContentCount', contentInput.value.length, 1000));
  imageInput.addEventListener('change', handleRegisterImageSelection);
  imageSelectButton?.addEventListener('click', () => imageInput.click());
  initializeRegisterImageDropzone(imageSelectButton);
  document.getElementById('boardRegisterImageRemove').addEventListener('click', clearRegisterImage);
  form.addEventListener('submit', event => saveBoardPost(event, type, boardId));

  if (boardId && !(await loadBoardForEdit(boardId, type))) return;
  document.getElementById('boardRegisterPanel').hidden = false;
  document.getElementById('boardRegisterLoading').hidden = true;
}

async function loadBoardForEdit(boardId, expectedType) {
  try {
    const board = await fetchBoardJson(`/board/${boardId}?increaseView=false`);

    if (board.boardType !== expectedType) {
      showRegisterAccessDenied('게시판 유형이 올바르지 않습니다.');
      return false;
    }

    const canEditBoard = currentBoardMember && (
      Number(currentBoardMember.memberId) === Number(board.writerId) ||
      (board.boardType === 'NOTICE' && currentBoardMember.role === 'ADMIN')
    );

    if (!canEditBoard) {
      showRegisterAccessDenied(expectedType === 'NOTICE' ? '공지사항은 작성자 또는 관리자만 수정할 수 있습니다.' : '게시글 작성자만 수정할 수 있습니다.');
      return false;
    }

    document.getElementById('boardRegisterTitle').value = board.title || '';
    document.getElementById('boardRegisterContent').value = board.content || '';
    updateRegisterCount('boardRegisterTitleCount', (board.title || '').length, 100);
    updateRegisterCount('boardRegisterContentCount', (board.content || '').length, 1000);

    if (board.boardImage?.fileUrl) {
      existingRegisterImage = board.boardImage;
      updateRegisterImageFileName('현재 등록된 이미지');
      showRegisterImagePreview(board.boardImage.fileUrl);
    }
  } catch (error) {
    showRegisterAccessDenied(error.message);
    return false;
  }

  return true;
}

async function saveBoardPost(event, type, boardId) {
  event.preventDefault();
  if (!requireBoardLogin()) return;

  const title = document.getElementById('boardRegisterTitle').value.trim();
  const content = document.getElementById('boardRegisterContent').value.trim();
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

  const submit = document.getElementById('boardRegisterSubmit');
  await runBoardRequest(`save-board-${boardId || 'new'}`, submit, '저장 중...', async () => {
    let savedBoardId = boardId;

    try {
      if (boardId) {
        await fetchBoardJson(`/board/${boardId}`, {
          method: 'PUT',
          body: JSON.stringify({ title, content })
        });
      } else {
        const boardTypePath = BOARD_TYPE_INFO[type]?.path;
        if (!boardTypePath) throw new Error('게시판 유형을 확인할 수 없습니다.');

        savedBoardId = await fetchBoardJson(`/board/type/${encodeURIComponent(boardTypePath)}`, {
          method: 'POST',
          body: JSON.stringify({ title, content })
        });
        savedBoardId = Number(savedBoardId);
        if (!Number.isInteger(savedBoardId) || savedBoardId <= 0) throw new Error('등록된 게시글 번호를 확인할 수 없습니다.');
      }
    } catch (error) {
      showBoardToast(error.message, true);
      return;
    }

    let imageErrorOccurred = false;
    if (selectedRegisterImage) {
      try {
        const formData = new FormData();
        formData.append('image', selectedRegisterImage);
        await fetchBoardJson(`/board/${savedBoardId}/image`, { method: 'POST', body: formData });
      } catch (imageError) {
        imageErrorOccurred = true;
        console.error('이미지 업로드 실패:', imageError);
      }
    } else if (boardId && removeExistingRegisterImage && existingRegisterImage) {
      try {
        await fetchBoardJson(`/board/${boardId}/image/${existingRegisterImage.fileId}`, { method: 'DELETE' });
      } catch (imageError) {
        imageErrorOccurred = true;
        console.error('이미지 삭제 실패:', imageError);
      }
    }

    if (imageErrorOccurred) {
      storeBoardToast(boardId ? '게시글 수정은 완료되었으나 이미지 처리 중 오류가 발생했습니다.' : '게시글은 등록되었으나 이미지 업로드에 실패했습니다.', true);
    } else {
      showBoardToast(boardId ? '게시글을 수정했습니다.' : '게시글을 등록했습니다.', false, 'success');
    }

    await new Promise(resolve => setTimeout(resolve, imageErrorOccurred ? 100 : 600));
    location.href = buildBoardReadUrl(savedBoardId, getBoardReturnUrl(type));
  });
}

function handleRegisterImageSelection(event) {
  const file = event.target.files?.[0];

  if (!file) return;

  applyRegisterImageFile(file);
}

function initializeRegisterImageDropzone(dropzone) {
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
    if (file) applyRegisterImageFile(file);
  });
}

function applyRegisterImageFile(file) {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

  if (!allowedTypes.includes(file.type)) {
    document.getElementById('boardRegisterImage').value = '';
    showBoardToast('JPG, PNG, WEBP 이미지 파일만 첨부할 수 있습니다.', true);
    return;
  }

  if (selectedRegisterImagePreviewUrl) URL.revokeObjectURL(selectedRegisterImagePreviewUrl);

  selectedRegisterImage = file;
  removeExistingRegisterImage = false;
  selectedRegisterImagePreviewUrl = URL.createObjectURL(file);
  updateRegisterImageFileName(file.name);
  showRegisterImagePreview(selectedRegisterImagePreviewUrl);
}

function clearRegisterImage() {
  document.getElementById('boardRegisterImage').value = '';
  if (selectedRegisterImagePreviewUrl) URL.revokeObjectURL(selectedRegisterImagePreviewUrl);
  selectedRegisterImagePreviewUrl = null;
  selectedRegisterImage = null;
  removeExistingRegisterImage = Boolean(existingRegisterImage);
  updateRegisterImageFileName('선택된 파일 없음');
  document.getElementById('boardRegisterImagePreviewWrap').classList.remove('show');
  document.getElementById('boardRegisterImagePreview').removeAttribute('src');
}

function updateRegisterImageFileName(fileName) {
  const fileNameElement = document.getElementById('boardRegisterImageFileName');
  const dropzone = document.getElementById('boardRegisterImageSelect');

  if (fileNameElement) fileNameElement.textContent = fileName;
  if (dropzone) dropzone.classList.toggle('has-file', fileName !== '선택된 파일 없음');
}

function showRegisterImagePreview(url) {
  const wrap = document.getElementById('boardRegisterImagePreviewWrap');
  const image = document.getElementById('boardRegisterImagePreview');

  image.src = url;
  wrap.classList.add('show');
}

function showRegisterAccessDenied(message) {
  document.getElementById('boardRegisterLoading').innerHTML = `
    <div class="board-auth-panel">
      <h2>작성할 수 없습니다</h2>
      <p>${escapeBoardHtml(message)}</p>
      <a class="board-btn board-btn-primary" href="/board/notice">게시판으로 돌아가기</a>
    </div>
  `;

  document.getElementById('boardRegisterPanel').hidden = true;
}

function showBoardLoginPanel() {
  document.querySelectorAll('[data-board-auth-content]').forEach(element => {
    element.hidden = true;
  });

  const panel = document.getElementById('boardLoginPanel');

  if (panel) panel.hidden = false;
}

function getRegisterBoardType() {
  const dataType = (document.body.dataset.boardType || '').toUpperCase();
  if (BOARD_TYPE_INFO[dataType]) return dataType;

  const path = location.pathname.split('/').filter(Boolean);
  const value = (path[path.length - 1] || '').toUpperCase();
  return Object.keys(BOARD_TYPE_INFO).find(key => BOARD_TYPE_INFO[key].path.toUpperCase() === value) || null;
}

function getPathNumberAfter(segment) {
  const parts = location.pathname.split('/').filter(Boolean);
  const index = parts.indexOf(segment);

  if (index < 0) return null;

  const value = Number(parts[index + 1]);

  return Number.isFinite(value) && value > 0 ? value : null;
}

function updateRegisterCount(elementId, current, max) {
  const element = document.getElementById(elementId);

  if (element) element.textContent = `${current} / ${max}`;
}

function requireBoardLogin() {
  if (currentBoardMember) return true;

  showBoardToast('로그인이 필요합니다.', true);
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
  const redirectedPath = response.redirected ? new URL(response.url, location.origin).pathname : '';

  if (redirectedPath === '/auth/login') {
    clearBoardAuthentication();
    const error = new Error('로그인이 필요합니다.');
    error.status = 401;
    throw error;
  }

  if (!response.ok) {
    const message = await readBoardError(response);
    const error = new Error(message || '요청 처리에 실패했습니다.');

    error.status = response.status;
    if (response.status === 401) clearBoardAuthentication();
    throw error;
  }

  if (response.status === 204) return null;

  const text = await response.text();
  if (!text) return null;

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json') && !contentType.includes('+json')) {
    const error = new Error('서버 응답 형식을 확인할 수 없습니다.');
    error.status = response.status;
    throw error;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error('서버 응답을 처리할 수 없습니다.');
  }
}

async function readBoardError(response) {
  const text = await response.text();

  if (!text) return `요청 처리에 실패했습니다. (${response.status})`;

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json') && !contentType.includes('+json')) {
    if (response.status === 401) return '로그인이 필요합니다.';
    if (response.status === 403) return '요청 권한이 없습니다.';
    return `요청 처리에 실패했습니다. (${response.status})`;
  }

  try {
    const data = JSON.parse(text);
    return data.detail || data.message || data.error || `요청 처리에 실패했습니다. (${response.status})`;
  } catch (error) {
    return `요청 처리에 실패했습니다. (${response.status})`;
  }
}

function storeBoardToast(message, isError = false, type = '') {
  try {
    sessionStorage.setItem('boardToastMessage', JSON.stringify({ message, isError, type }));
  } catch (error) {
    console.warn('게시판 안내 메시지를 저장하지 못했습니다.', error);
  }
}

function showStoredBoardToast() {
  let storedMessage = null;

  try {
    storedMessage = sessionStorage.getItem('boardToastMessage');
    sessionStorage.removeItem('boardToastMessage');
  } catch (error) {
    console.warn('게시판 안내 메시지를 불러오지 못했습니다.', error);
    return;
  }

  if (!storedMessage) return;

  try {
    const data = JSON.parse(storedMessage);
    if (data?.message) showBoardToast(data.message, Boolean(data.isError), data.type || '');
  } catch (error) {
    console.warn('게시판 안내 메시지를 처리하지 못했습니다.', error);
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
