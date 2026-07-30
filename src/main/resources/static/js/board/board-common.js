const BOARD_TYPE_INFO = {
  NOTICE: { label: '공지사항', path: 'notice', description: '플랜슬롯의 중요한 안내와 업데이트를 확인하세요.' },
  STUDY: { label: '스터디', path: 'study', description: '함께 공부할 팀원을 찾고 스터디 소식을 나눠보세요.' },
  GROUP: { label: '소모임', path: 'group', description: '취미와 관심사가 같은 사람들과 새로운 모임을 시작해보세요.' },
  FREE: { label: '자유게시판', path: 'free', description: '학교생활과 일상의 다양한 이야기를 자유롭게 나눠보세요.' }
};

let boardToastTimer;
let currentBoardMember = null;
const boardRequestLocks = new Set();

document.addEventListener('DOMContentLoaded', async () => {
  initializeBoardHeader();

  if (getBoardToken()) {
    await loadCurrentBoardMember();
  }

  updateBoardHeaderState();

  const page = document.body.dataset.boardPage;
  if (page === 'list' && typeof initializeBoardList === 'function') {
    await initializeBoardList();
  }
  if (page === 'read' && typeof initializeBoardRead === 'function') {
    if (typeof initializeReportModal === 'function') initializeReportModal();
    if (typeof initializeBoardGroupModal === 'function') initializeBoardGroupModal();
    await initializeBoardRead();
  }
  if (page === 'register' && typeof initializeBoardRegister === 'function') {
    await initializeBoardRegister();
  }

  showStoredBoardToast();
});

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
function isRecruitmentBoard(boardType) {
  return boardType === 'STUDY' || boardType === 'GROUP';
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

  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (error) {
    const networkError = new Error(getBoardErrorMessage(error));
    networkError.status = 0;
    throw networkError;
  }

  const redirectedPath = response.redirected ? new URL(response.url, location.origin).pathname : '';

  if (redirectedPath === '/auth/login') {
    clearBoardAuthentication();
    const error = new Error('로그인이 필요합니다.');
    error.status = 401;
    throw error;
  }

  if (!response.ok) {
    const message = await readBoardError(response);
    const error = new Error(message);

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
function getBoardErrorMessage(error, status = error?.status || 0) {
  const message = typeof error === 'string' ? error.trim() : String(error?.message || '').trim();

  if (message && /[가-힣]/.test(message)) return message;
  if (error?.name === 'AbortError' || /aborted|timeout|timed out/i.test(message)) {
    return '요청 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.';
  }
  if (!status && (!message || /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(message))) {
    return '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.';
  }

  const statusMessages = {
    400: '요청 내용을 확인해 주세요.',
    401: '로그인이 필요합니다.',
    403: '요청 권한이 없습니다.',
    404: '요청한 정보를 찾을 수 없습니다.',
    405: '지원하지 않는 요청 방식입니다.',
    409: '이미 처리되었거나 현재 상태에서는 요청할 수 없습니다.',
    413: '첨부 파일 용량이 너무 큽니다.',
    415: '지원하지 않는 파일 형식입니다.',
    429: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    500: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    502: '서버가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해 주세요.',
    503: '서버가 일시적으로 이용 불가능합니다. 잠시 후 다시 시도해 주세요.',
    504: '서버 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.'
  };

  return statusMessages[status] || '요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
}
async function readBoardError(response) {
  const text = await response.text();

  if (!text) return getBoardErrorMessage('', response.status);

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json') && !contentType.includes('+json')) {
    return getBoardErrorMessage('', response.status);
  }

  try {
    const data = JSON.parse(text);
    return getBoardErrorMessage(data.detail || data.message || data.error || '', response.status);
  } catch (error) {
    return getBoardErrorMessage('', response.status);
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
