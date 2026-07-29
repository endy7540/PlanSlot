let currentListPage = 0;
let currentListKeyword = '';
let currentListSearchType = 'titleContent';
let currentListSort = 'latest';
let currentListMine = false;
let currentListRecruitingOnly = false;

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
    currentListPage = 0;
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
function renderRecruitmentBadges(board) {
  if (!isRecruitmentBoard(board.boardType)) return '';

  const statusBadge = board.recruitmentStatus === 'CLOSED'
      ? '<span class="board-recruitment-badge closed">모집 마감</span>'
      : '<span class="board-recruitment-badge open">모집 중</span>';

  return `<span class="board-recruitment-badges">${statusBadge}</span>`;
}
