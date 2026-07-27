const NOTIFICATION_API = '/notification';
const NOTIFICATION_LOGIN_URL = '/auth/login';
const NOTIFICATION_PAGE_SIZE = 20;

const NOTIFICATION_TARGET_ROUTES = {
    POST: targetId => `/board/read/${encodeURIComponent(targetId)}`,
    BOARD: targetId => `/board/read/${encodeURIComponent(targetId)}`,
    GROUP: targetId => `/group/read?id=${encodeURIComponent(targetId)}`,
    GROUP_KICK: () => '/group',
    CHAT: targetId => `/groupChat/${encodeURIComponent(targetId)}`
};

const notificationPageState = { filter: 'ALL', page: 0, totalPages: 0 };
let notificationAuthRedirecting = false;
let notificationSseAbortController = null;
let notificationSseRetryTimer = null;
let notificationSseRetryCount = 0;
let notificationSseForbidden = false;
let notificationRefreshTimer = null;

window.addEventListener('DOMContentLoaded', () => {
    bindNotificationDropdown();
    bindNotificationListPage();

    if (!getNotificationToken()) {
        updateUnreadCount(0);
        renderNotificationLoginRequired();
        return;
    }

    refreshNotificationUI();
    connectNotificationSse();
});

async function connectNotificationSse() {
    const token = getNotificationToken();
    if (!token || notificationAuthRedirecting || notificationSseForbidden || notificationSseAbortController) return;

    notificationSseAbortController = new AbortController();

    try {
        const response = await fetch(notificationUrl('/subscribe'), {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
            cache: 'no-store',
            signal: notificationSseAbortController.signal
        });

        if (response.status === 401 || response.redirected) {
            handleNotificationUnauthorized();
            return;
        }

        if (response.status === 403) {
            notificationSseForbidden = true;
            console.warn('실시간 알림 구독 권한이 없습니다.');
            return;
        }

        if (!response.ok || !response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
            throw new Error('실시간 알림 연결에 실패했습니다.');
        }

        notificationSseForbidden = false;
        notificationSseRetryCount = 0;
        await readNotificationSseStream(response.body);
    } catch (error) {
        if (error.name !== 'AbortError') console.error(error);
    } finally {
        notificationSseAbortController = null;
        if (!notificationAuthRedirecting && !notificationSseForbidden && getNotificationToken()) scheduleNotificationSseReconnect();
    }
}

async function readNotificationSseStream(stream) {
    const reader = stream.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true }).replaceAll('\r\n', '\n');
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        events.forEach(handleNotificationSseEvent);
    }
}

function handleNotificationSseEvent(rawEvent) {
    let eventName = 'message';
    const dataLines = [];

    rawEvent.split('\n').forEach(line => {
        if (line.startsWith('event:')) eventName = line.slice(6).trim();
        if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    });

    if (eventName !== 'notification' || !dataLines.length) return;

    try {
        const notification = JSON.parse(dataLines.join('\n'));
        showNotificationToast(`${notification.title}: ${notification.content}`);
        scheduleNotificationRefresh();
        
        // 전역으로 알림 수신 이벤트 전파 (모임방 목록 실시간 갱신용)
        window.dispatchEvent(new CustomEvent('notificationReceived', { detail: notification }));
    } catch (error) {
        console.error('실시간 알림 처리에 실패했습니다.', error);
    }
}

function scheduleNotificationRefresh() {
    clearTimeout(notificationRefreshTimer);
    notificationRefreshTimer = setTimeout(refreshNotificationUI, 100);
}

function scheduleNotificationSseReconnect() {
    clearTimeout(notificationSseRetryTimer);
    const retryDelay = Math.min(1000 * (2 ** notificationSseRetryCount), 30000);
    notificationSseRetryCount += 1;
    notificationSseRetryTimer = setTimeout(connectNotificationSse, retryDelay);
}

function getNotificationToken() {
    return localStorage.getItem('jwtToken');
}

function getNotificationHeaders() {
    const token = getNotificationToken();
    const headers = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

function notificationUrl(path = '') {
    return `${NOTIFICATION_API}${path}`;
}

async function fetchNotificationApi(path = '', options = {}) {
    const token = getNotificationToken();

    if (!token) {
        handleNotificationUnauthorized();
        throw new Error('로그인이 필요합니다.');
    }

    const response = await fetch(notificationUrl(path), {
        ...options,
        headers: { ...getNotificationHeaders(), ...(options.headers || {}) }
    });
    const redirectedPath = response.redirected ? new URL(response.url, location.origin).pathname : '';
    const contentType = response.headers.get('content-type') || '';

    if (response.status === 401 || redirectedPath === NOTIFICATION_LOGIN_URL) {
        handleNotificationUnauthorized();
        throw new Error('로그인 정보가 만료되었습니다.');
    }

    if (response.status === 403) {
        throw new Error('요청 권한이 없습니다.');
    }

    if (response.ok && response.status !== 204 && !contentType.includes('application/json') && !contentType.includes('+json')) {
        throw new Error('서버 응답 형식을 확인할 수 없습니다.');
    }

    return response;
}

async function refreshNotificationUI() {
    const hasDropdown = document.getElementById('notificationDropdownList');
    const hasFullList = document.getElementById('notificationFullList');
    if (!hasDropdown && !hasFullList) return;

    if (!getNotificationToken()) {
        updateUnreadCount(0);
        renderNotificationLoginRequired();
        return;
    }

    try {
        const pageQuery = new URLSearchParams({
            filter: notificationPageState.filter,
            page: String(notificationPageState.page),
            size: String(NOTIFICATION_PAGE_SIZE)
        });

        const [unreadResponse, dropdownResponse, fullListResponse] = await Promise.all([
            fetchNotificationApi('/unread-count'),
            hasDropdown ? fetchNotificationApi() : Promise.resolve(null),
            hasFullList ? fetchNotificationApi(`/page?${pageQuery}`) : Promise.resolve(null)
        ]);

        if (!unreadResponse.ok) throw new Error('안 읽은 알림 개수 조회에 실패했습니다.');
        if (dropdownResponse && !dropdownResponse.ok) throw new Error('알림 드롭다운 조회에 실패했습니다.');
        if (fullListResponse && !fullListResponse.ok) throw new Error('전체 알림 목록 조회에 실패했습니다.');

        const unreadCount = await unreadResponse.json();
        const dropdownNotifications = dropdownResponse ? await dropdownResponse.json() : [];
        const notificationPage = fullListResponse ? await fullListResponse.json() : null;

        updateUnreadCount(unreadCount);
        if (hasDropdown) renderDropdownNotifications(dropdownNotifications);

        if (hasFullList && notificationPage) {
            const totalPages = Number(notificationPage.totalPages) || 0;
            if (totalPages > 0 && notificationPageState.page >= totalPages) {
                notificationPageState.page = totalPages - 1;
                await refreshNotificationUI();
                return;
            }

            if (totalPages === 0) notificationPageState.page = 0;
            notificationPageState.totalPages = totalPages;
            renderFullNotificationPage(notificationPage);
        }
    } catch (error) {
        console.error(error);
        if (!notificationAuthRedirecting) renderNotificationError();
    }
}

function bindNotificationDropdown() {
    const bell = document.getElementById('notificationBell');
    const dropdown = document.getElementById('notificationDropdown');
    const readAllButton = document.getElementById('dropdownReadAll');
    if (!bell || !dropdown) return;

    bell.addEventListener('click', event => {
        event.stopPropagation();
        const profileDropdown = document.getElementById('profileDropdown');
        if (profileDropdown) profileDropdown.style.display = 'none';
        const opened = dropdown.classList.toggle('open');
        bell.classList.toggle('active', opened);
    });

    dropdown.addEventListener('click', event => event.stopPropagation());
    document.addEventListener('click', () => {
        dropdown.classList.remove('open');
        bell.classList.remove('active');
    });

    if (readAllButton) readAllButton.addEventListener('click', readAllNotifications);
}

function bindNotificationListPage() {
    const readAllButton = document.getElementById('listReadAll');
    if (readAllButton) readAllButton.addEventListener('click', readAllNotifications);

    document.querySelectorAll('.notification-filter-button').forEach(button => {
        button.addEventListener('click', () => {
            if (button.dataset.filter === notificationPageState.filter) return;
            notificationPageState.filter = button.dataset.filter || 'ALL';
            notificationPageState.page = 0;
            updateNotificationFilterButtons();
            renderNotificationPageLoading();
            refreshNotificationUI();
        });
    });
}

function updateNotificationFilterButtons() {
    document.querySelectorAll('.notification-filter-button').forEach(button => {
        const active = button.dataset.filter === notificationPageState.filter;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
    });
}

function renderDropdownNotifications(notifications) {
    const list = document.getElementById('notificationDropdownList');
    if (!list) return;

    if (!notifications.length) {
        list.innerHTML = '<div class="notification-empty">새로운 알림이 없습니다.</div>';
        return;
    }

    list.innerHTML = notifications.slice(0, 5).map(createNotificationItem).join('');
    bindNotificationItems(list);
}

function renderFullNotificationPage(pageData) {
    const notifications = Array.isArray(pageData.content) ? pageData.content : [];
    const totalElements = Number(pageData.totalElements) || 0;
    renderFullNotifications(notifications);
    renderNotificationPagination(Number(pageData.totalPages) || 0, Number(pageData.number) || 0);

    const resultText = document.getElementById('notificationFilterResult');
    if (resultText) resultText.textContent = `${getNotificationFilterLabel(notificationPageState.filter)} ${totalElements}개`;
}

function renderFullNotifications(notifications) {
    const list = document.getElementById('notificationFullList');
    if (!list) return;

    if (!notifications.length) {
        const emptyMessages = {
            ALL: '아직 받은 알림이 없습니다.',
            UNREAD: '읽지 않은 알림이 없습니다.',
            READ: '읽은 알림이 없습니다.'
        };
        list.innerHTML = `<div class="notification-empty">${emptyMessages[notificationPageState.filter] || emptyMessages.ALL}</div>`;
        return;
    }

    list.innerHTML = notifications.map(createNotificationItem).join('');
    bindNotificationItems(list);
}

function renderNotificationPageLoading() {
    const list = document.getElementById('notificationFullList');
    const pagination = document.getElementById('notificationPagination');
    if (list) list.innerHTML = '<div class="notification-loading">알림을 불러오는 중...</div>';
    if (pagination) {
        pagination.innerHTML = '';
        pagination.classList.remove('show');
    }
}

function createNotificationItem(notification) {
    const unreadClass = notification.read ? '' : ' unread';
    const visualType = getNotificationVisualType(notification);
    const unreadDot = notification.read ? '' : '<span class="notification-unread-dot" title="읽지 않은 알림"></span>';
    const notificationId = notification.notificationId ?? '';
    const targetType = notification.targetType ?? '';
    const targetId = notification.targetId ?? '';

    return `
        <button class="notification-item${unreadClass}" type="button"
                data-notification-id="${escapeNotificationHtml(notificationId)}"
                data-target-type="${escapeNotificationHtml(targetType)}"
                data-target-id="${escapeNotificationHtml(targetId)}"
                data-read="${Boolean(notification.read)}">
            <span class="notification-icon ${visualType}">${getNotificationIcon(visualType)}</span>
            <span class="notification-item-content">
                <span class="notification-item-title-row">
                    <span class="notification-item-title">${escapeNotificationHtml(notification.title)}</span>
                    ${unreadDot}
                </span>
                <span class="notification-item-text">${escapeNotificationHtml(notification.content)}</span>
                <span class="notification-item-time">${formatNotificationDate(notification.createdAt)}</span>
            </span>
        </button>`;
}

function bindNotificationItems(container) {
    container.querySelectorAll('.notification-item').forEach(item => {
        item.addEventListener('click', async () => {
            const notificationId = item.dataset.notificationId;
            const targetType = item.dataset.targetType;
            const targetId = item.dataset.targetId;
            const alreadyRead = item.dataset.read === 'true';

            if (!alreadyRead) {
                const readSucceeded = await readSingleNotification(notificationId);
                if (!readSucceeded) return;
            }

            if (hasNotificationTarget(targetType, targetId)) {
                moveToNotificationTarget(targetType, targetId);
                return;
            }

            await refreshNotificationUI();
        });
    });
}

async function readSingleNotification(notificationId) {
    if (!notificationId) {
        showNotificationToast('알림 정보를 확인할 수 없습니다.');
        return false;
    }

    try {
        const response = await fetchNotificationApi(`/${notificationId}/read`, { method: 'PATCH' });
        if (!response.ok) throw new Error('알림 읽음 처리에 실패했습니다.');
        return true;
    } catch (error) {
        console.error(error);
        if (!notificationAuthRedirecting) showNotificationToast('알림 읽음 처리 중 오류가 발생했습니다.');
        return false;
    }
}

async function readAllNotifications() {
    try {
        const response = await fetchNotificationApi('/read-all', { method: 'PATCH' });
        if (!response.ok) throw new Error('전체 읽음 처리에 실패했습니다.');
        showNotificationToast('모든 알림을 읽음 처리했습니다.');
        await refreshNotificationUI();
    } catch (error) {
        console.error(error);
        if (!notificationAuthRedirecting) showNotificationToast('전체 읽음 처리 중 오류가 발생했습니다.');
    }
}

function updateUnreadCount(unreadCount) {
    const count = Number(unreadCount) || 0;
    const badge = document.getElementById('notificationBadge');
    const homeCount = document.getElementById('homeUnreadCount');
    const dropdownText = document.getElementById('dropdownUnreadText');
    const listText = document.getElementById('listUnreadText');
    const listReadAll = document.getElementById('listReadAll');
    const dropdownReadAll = document.getElementById('dropdownReadAll');

    if (badge) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.classList.toggle('show', count > 0);
    }
    if (homeCount) homeCount.textContent = count;
    if (dropdownText) dropdownText.textContent = `읽지 않은 알림 ${count}개`;
    if (listText) listText.textContent = `읽지 않은 알림 ${count}개`;
    if (listReadAll) listReadAll.disabled = count === 0;
    if (dropdownReadAll) dropdownReadAll.disabled = count === 0;
}

function renderNotificationPagination(totalPages, currentPage) {
    const pagination = document.getElementById('notificationPagination');
    if (!pagination) return;

    if (totalPages <= 1) {
        pagination.innerHTML = '';
        pagination.classList.remove('show');
        return;
    }

    const visibleCount = 5;
    const start = Math.max(0, Math.min(currentPage - 2, totalPages - visibleCount));
    const end = Math.min(totalPages, start + visibleCount);
    const buttons = [createPageButton('이전', currentPage - 1, currentPage === 0, false)];

    for (let page = start; page < end; page += 1) {
        buttons.push(createPageButton(String(page + 1), page, false, page === currentPage));
    }

    buttons.push(createPageButton('다음', currentPage + 1, currentPage >= totalPages - 1, false));
    pagination.innerHTML = buttons.join('');
    pagination.classList.add('show');

    pagination.querySelectorAll('.notification-page-button:not(:disabled)').forEach(button => {
        button.addEventListener('click', () => {
            const page = Number(button.dataset.page);
            if (!Number.isInteger(page) || page === notificationPageState.page) return;
            notificationPageState.page = page;
            renderNotificationPageLoading();
            refreshNotificationUI();
            document.querySelector('.notification-list-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
}

function createPageButton(label, page, disabled, active) {
    return `<button class="notification-page-button${active ? ' active' : ''}" type="button" data-page="${page}"
            ${disabled ? 'disabled' : ''} ${active ? 'aria-current="page"' : ''}>${label}</button>`;
}

function getNotificationFilterLabel(filter) {
    if (filter === 'UNREAD') return '안 읽은 알림';
    if (filter === 'READ') return '읽은 알림';
    return '전체 알림';
}

function hasNotificationTarget(targetType, targetId) {
    if (!targetType) return false;
    const normalizedType = targetType.toUpperCase();
    if (!NOTIFICATION_TARGET_ROUTES[normalizedType]) return false;
    return normalizedType === 'GROUP_KICK' || Boolean(targetId);
}

function moveToNotificationTarget(targetType, targetId) {
    const routeBuilder = NOTIFICATION_TARGET_ROUTES[(targetType || '').toUpperCase()];
    if (!routeBuilder) {
        refreshNotificationUI();
        return;
    }
    window.location.href = routeBuilder(targetId);
}

function getNotificationVisualType(notification) {
    const notificationType = (notification.notificationType || '').toUpperCase();
    if (notificationType === 'INVITATION') return 'invitation';
    if (notificationType === 'APPLICATION') return 'application';
    return 'message';
}

function getNotificationIcon(visualType) {
    const icons = {
        invitation: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v12H5.5L4 17.5V4Z"></path><path d="m5 6 7 5 7-5"></path></svg>',
        application: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>',
        message: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"></path><path d="M8 9h8M8 13h5"></path></svg>'
    };
    return icons[visualType] || icons.message;
}

function formatNotificationDate(createdAt) {
    if (!createdAt) return '';
    const createdDate = new Date(createdAt);
    if (Number.isNaN(createdDate.getTime())) return '';

    const difference = Math.max(0, Date.now() - createdDate.getTime());
    const minutes = Math.floor(difference / 60000);
    const hours = Math.floor(difference / 3600000);
    const days = Math.floor(difference / 86400000);

    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 10) return `${days}일 전`;

    const year = createdDate.getFullYear();
    const month = String(createdDate.getMonth() + 1).padStart(2, '0');
    const day = String(createdDate.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
}

function renderNotificationLoginRequired() {
    const dropdownList = document.getElementById('notificationDropdownList');
    const fullList = document.getElementById('notificationFullList');
    const pagination = document.getElementById('notificationPagination');
    if (dropdownList) dropdownList.innerHTML = '<div class="notification-empty">로그인 후 알림을 확인할 수 있습니다.</div>';
    if (fullList) fullList.innerHTML = '<div class="notification-empty">로그인 후 알림을 확인할 수 있습니다.</div>';
    if (pagination) pagination.classList.remove('show');
}

function handleNotificationUnauthorized() {
    if (notificationAuthRedirecting) return;
    notificationAuthRedirecting = true;
    clearTimeout(notificationSseRetryTimer);
    if (notificationSseAbortController) notificationSseAbortController.abort();
    localStorage.removeItem('jwtToken');
    localStorage.removeItem('memberId');
    updateUnreadCount(0);
    renderNotificationLoginRequired();
    showNotificationToast('로그인이 필요합니다. 로그인 화면으로 이동합니다.');
    window.setTimeout(() => { window.location.href = NOTIFICATION_LOGIN_URL; }, 700);
}

function renderNotificationError() {
    const dropdownList = document.getElementById('notificationDropdownList');
    const fullList = document.getElementById('notificationFullList');
    const pagination = document.getElementById('notificationPagination');
    if (dropdownList) dropdownList.innerHTML = '<div class="notification-error">알림을 불러오지 못했습니다.</div>';
    if (fullList) fullList.innerHTML = '<div class="notification-error">알림을 불러오지 못했습니다.</div>';
    if (pagination) pagination.classList.remove('show');
}

function showNotificationToast(message) {
    const toast = document.getElementById('notificationToast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showNotificationToast.timer);
    showNotificationToast.timer = setTimeout(() => toast.classList.remove('show'), 2000);
}

function escapeNotificationHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}
