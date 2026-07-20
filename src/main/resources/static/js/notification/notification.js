const NOTIFICATION_API = '/notification';
const NOTIFICATION_LOGIN_URL = '/auth/login';

// 실제 게시글, 모임, 일정 화면 주소가 확정되면 이 부분만 수정
const NOTIFICATION_TARGET_ROUTES = {
    POST: targetId => `/board/read/${encodeURIComponent(targetId)}`,
    BOARD: targetId => `/board/read/${encodeURIComponent(targetId)}`,
    GROUP: targetId => `/group/detail?id=${encodeURIComponent(targetId)}`,
    GROUP_KICK: () => '/group',
    SCHEDULE: targetId => `/schedule/${encodeURIComponent(targetId)}`
};

let notificationAuthRedirecting = false;
let notificationSseAbortController = null;
let notificationSseRetryTimer = null;
let notificationSseRetryCount = 0;
let notificationRefreshTimer = null;

document.addEventListener('DOMContentLoaded', () => {
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

// Authorization 헤더를 사용한 SSE 실시간 알림 연결
async function connectNotificationSse() {
    const token = getNotificationToken();
    if (!token || notificationAuthRedirecting || notificationSseAbortController) return;

    notificationSseAbortController = new AbortController();

    try {
        const response = await fetch(notificationUrl('/subscribe'), {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'text/event-stream'
            },
            cache: 'no-store',
            signal: notificationSseAbortController.signal
        });

        if (response.status === 401 || response.status === 403) {
            handleNotificationUnauthorized();
            return;
        }

        if (response.redirected) {
            handleNotificationUnauthorized();
            return;
        }

        if (!response.ok || !response.body
            || !response.headers.get('content-type')?.includes('text/event-stream')) {
            throw new Error('실시간 알림 연결에 실패했습니다.');
        }

        notificationSseRetryCount = 0;
        await readNotificationSseStream(response.body);
    } catch (error) {
        if (error.name !== 'AbortError') console.error(error);
    } finally {
        notificationSseAbortController = null;
        if (!notificationAuthRedirecting && getNotificationToken()) scheduleNotificationSseReconnect();
    }
}

// SSE 응답을 이벤트 단위로 나누어 처리
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

// 실시간 알림 이벤트를 토스트로 표시하고 목록을 다시 조회
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
    } catch (error) {
        console.error('실시간 알림 처리에 실패했습니다.', error);
    }
}

// 여러 이벤트가 연속으로 도착하면 한 번만 목록을 새로고침
function scheduleNotificationRefresh() {
    clearTimeout(notificationRefreshTimer);
    notificationRefreshTimer = setTimeout(refreshNotificationUI, 100);
}

// 연결 종료 시 최대 30초 간격으로 자동 재연결
function scheduleNotificationSseReconnect() {
    clearTimeout(notificationSseRetryTimer);
    const retryDelay = Math.min(1000 * (2 ** notificationSseRetryCount), 30000);
    notificationSseRetryCount += 1;
    notificationSseRetryTimer = setTimeout(connectNotificationSse, retryDelay);
}

// 브라우저에 저장된 JWT 조회
function getNotificationToken() {
    return localStorage.getItem('jwtToken');
}

// 알림 API 요청 헤더 생성
function getNotificationHeaders() {
    const token = getNotificationToken();

    const headers = {
        Accept: 'application/json'
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    return headers;
}

// 알림 API 주소 생성
function notificationUrl(path = '') {
    return `${NOTIFICATION_API}${path}`;
}

// 인증이 필요한 알림 API 요청
async function fetchNotificationApi(path = '', options = {}) {
    const token = getNotificationToken();

    if (!token) {
        handleNotificationUnauthorized();
        throw new Error('로그인이 필요합니다.');
    }

    const response = await fetch(notificationUrl(path), {
        ...options,
        headers: {
            ...getNotificationHeaders(),
            ...(options.headers || {})
        }
    });

    if (response.status === 401 || response.status === 403) {
        handleNotificationUnauthorized();
        throw new Error('로그인 정보가 만료되었습니다.');
    }

    return response;
}

// 알림 목록 및 안 읽은 개수 새로고침
async function refreshNotificationUI() {
    const hasDropdown = document.getElementById(
        'notificationDropdownList'
    );

    const hasFullList = document.getElementById(
        'notificationFullList'
    );

    if (!hasDropdown && !hasFullList) {
        return;
    }

    if (!getNotificationToken()) {
        updateUnreadCount(0);
        renderNotificationLoginRequired();
        return;
    }

    try {
        const [
            unreadResponse,
            dropdownResponse,
            fullListResponse
        ] = await Promise.all([
            fetchNotificationApi('/unread-count'),
            hasDropdown
                ? fetchNotificationApi()
                : Promise.resolve(null),
            hasFullList
                ? fetchNotificationApi('?showAll=true')
                : Promise.resolve(null)
        ]);

        if (!unreadResponse.ok) {
            throw new Error('안 읽은 알림 개수 조회에 실패했습니다.');
        }

        if (dropdownResponse && !dropdownResponse.ok) {
            throw new Error('알림 드롭다운 조회에 실패했습니다.');
        }

        if (fullListResponse && !fullListResponse.ok) {
            throw new Error('전체 알림 목록 조회에 실패했습니다.');
        }

        const unreadCount =
            await unreadResponse.json();

        const dropdownNotifications = dropdownResponse
            ? await dropdownResponse.json()
            : [];

        const fullListNotifications = fullListResponse
            ? await fullListResponse.json()
            : [];

        updateUnreadCount(unreadCount);

        if (hasDropdown) {
            renderDropdownNotifications(
                dropdownNotifications
            );
        }

        if (hasFullList) {
            renderFullNotifications(
                fullListNotifications
            );
        }
    } catch (error) {
        console.error(error);

        if (!notificationAuthRedirecting) {
            renderNotificationError();
        }
    }
}

// 알림 종 드롭다운 이벤트 연결
function bindNotificationDropdown() {
    const bell =
        document.getElementById('notificationBell');

    const dropdown =
        document.getElementById('notificationDropdown');

    const readAllButton =
        document.getElementById('dropdownReadAll');

    if (!bell || !dropdown) {
        return;
    }

    bell.addEventListener('click', event => {
        event.stopPropagation();
        
        // 프로필 드롭다운이 열려있다면 닫기
        const profileDropdown = document.getElementById('profileDropdown');
        if (profileDropdown) {
            profileDropdown.style.display = 'none';
        }

        const opened =
            dropdown.classList.toggle('open');

        bell.classList.toggle('active', opened);
    });

    dropdown.addEventListener('click', event => {
        event.stopPropagation();
    });

    document.addEventListener('click', () => {
        dropdown.classList.remove('open');
        bell.classList.remove('active');
    });

    if (readAllButton) {
        readAllButton.addEventListener(
            'click',
            readAllNotifications
        );
    }
}

// 전체 알림 페이지 이벤트 연결
function bindNotificationListPage() {
    const readAllButton =
        document.getElementById('listReadAll');

    if (readAllButton) {
        readAllButton.addEventListener(
            'click',
            readAllNotifications
        );
    }
}

// 최근 알림 드롭다운 출력
function renderDropdownNotifications(notifications) {
    const list =
        document.getElementById('notificationDropdownList');

    if (!list) {
        return;
    }

    if (!notifications.length) {
        list.innerHTML =
            '<div class="notification-empty">' +
            '새로운 알림이 없습니다.' +
            '</div>';

        return;
    }

    list.innerHTML = notifications
        .slice(0, 5)
        .map(notification =>
            createNotificationItem(notification)
        )
        .join('');

    bindNotificationItems(list);
}

// 전체 알림 목록 출력
function renderFullNotifications(notifications) {
    const list =
        document.getElementById('notificationFullList');

    if (!list) {
        return;
    }

    if (!notifications.length) {
        list.innerHTML =
            '<div class="notification-empty">' +
            '아직 받은 알림이 없습니다.' +
            '</div>';

        return;
    }

    list.innerHTML = notifications
        .map(notification =>
            createNotificationItem(notification)
        )
        .join('');

    bindNotificationItems(list);
}

// 알림 한 건 HTML 생성
function createNotificationItem(notification) {
    const unreadClass =
        notification.read ? '' : ' unread';

    const typeClass =
        getNotificationTypeClass(
            notification.notificationType
        );

    const icon =
        getNotificationIcon(
            notification.notificationType
        );

    const unreadDot = notification.read
        ? ''
        : '<span class="notification-unread-dot"></span>';

    const notificationId =
        notification.notificationId ?? '';

    const targetType =
        notification.targetType ?? '';

    const targetId =
        notification.targetId ?? '';

    return `
        <button
            class="notification-item${unreadClass}"
            type="button"
            data-notification-id="${notificationId}"
            data-target-type="${escapeNotificationHtml(targetType)}"
            data-target-id="${targetId}">
            
            <span class="notification-icon ${typeClass}">
                ${icon}
            </span>

            <span class="notification-item-content">
                <span class="notification-item-title-row">
                    <span class="notification-item-title">
                        ${escapeNotificationHtml(notification.title)}
                    </span>
                    ${unreadDot}
                </span>

                <span class="notification-item-text">
                    ${escapeNotificationHtml(notification.content)}
                </span>

                <span class="notification-item-time">
                    ${formatNotificationDate(notification.createdAt)}
                </span>
            </span>
        </button>
    `;
}

// 알림 클릭 이벤트 연결
function bindNotificationItems(container) {
    container
        .querySelectorAll('.notification-item')
        .forEach(item => {
            item.addEventListener('click', async () => {
                const notificationId =
                    item.dataset.notificationId;

                const targetType =
                    item.dataset.targetType;

                const targetId =
                    item.dataset.targetId;

                const readSucceeded =
                    await readSingleNotification(
                        notificationId
                    );

                if (!readSucceeded) {
                    return;
                }

                moveToNotificationTarget(
                    targetType,
                    targetId
                );
            });
        });
}

// 알림 한 개 읽음 처리
async function readSingleNotification(notificationId) {
    if (!notificationId) {
        showNotificationToast(
            '알림 정보를 확인할 수 없습니다.'
        );

        return false;
    }

    try {
        const response = await fetchNotificationApi(
            `/${notificationId}/read`,
            {
                method: 'PATCH'
            }
        );

        if (!response.ok) {
            throw new Error(
                '알림 읽음 처리에 실패했습니다.'
            );
        }

        return true;
    } catch (error) {
        console.error(error);

        if (!notificationAuthRedirecting) {
            showNotificationToast(
                '알림 읽음 처리 중 오류가 발생했습니다.'
            );
        }

        return false;
    }
}

// 전체 알림 읽음 처리
async function readAllNotifications() {
    try {
        const response = await fetchNotificationApi(
            '/read-all',
            {
                method: 'PATCH'
            }
        );

        if (!response.ok) {
            throw new Error(
                '전체 읽음 처리에 실패했습니다.'
            );
        }

        showNotificationToast(
            '모든 알림을 읽음 처리했습니다.'
        );

        await refreshNotificationUI();
    } catch (error) {
        console.error(error);

        if (!notificationAuthRedirecting) {
            showNotificationToast(
                '전체 읽음 처리 중 오류가 발생했습니다.'
            );
        }
    }
}

// 안 읽은 알림 개수 표시
function updateUnreadCount(unreadCount) {
    const normalizedUnreadCount =
        Number(unreadCount) || 0;

    const badge =
        document.getElementById('notificationBadge');

    const homeCount =
        document.getElementById('homeUnreadCount');

    const dropdownText =
        document.getElementById('dropdownUnreadText');

    const listText =
        document.getElementById('listUnreadText');

    const listReadAll =
        document.getElementById('listReadAll');

    const dropdownReadAll =
        document.getElementById('dropdownReadAll');

    if (badge) {
        badge.textContent =
            normalizedUnreadCount > 99
                ? '99+'
                : normalizedUnreadCount;

        badge.classList.toggle(
            'show',
            normalizedUnreadCount > 0
        );
    }

    if (homeCount) {
        homeCount.textContent =
            normalizedUnreadCount;
    }

    if (dropdownText) {
        dropdownText.textContent =
            `읽지 않은 알림 ${normalizedUnreadCount}개`;
    }

    if (listText) {
        listText.textContent =
            `읽지 않은 알림 ${normalizedUnreadCount}개`;
    }

    if (listReadAll) {
        listReadAll.disabled =
            normalizedUnreadCount === 0;
    }

    if (dropdownReadAll) {
        dropdownReadAll.disabled =
            normalizedUnreadCount === 0;
    }
}

// 알림 대상 화면으로 이동
function moveToNotificationTarget(
    targetType,
    targetId
) {
    if (!targetType || !targetId) {
        refreshNotificationUI();
        return;
    }

    const routeBuilder =
        NOTIFICATION_TARGET_ROUTES[
            targetType.toUpperCase()
            ];

    if (!routeBuilder) {
        refreshNotificationUI();
        return;
    }

    window.location.href =
        routeBuilder(targetId);
}

// 알림 종류별 아이콘 반환
function getNotificationIcon(notificationType) {
    switch ((notificationType || '').toUpperCase()) {
        case 'INVITATION':
            return '✉';

        case 'APPLICATION':
            return '✓';

        default:
            return '●';
    }
}

// 알림 종류별 CSS 클래스 반환
function getNotificationTypeClass(notificationType) {
    switch ((notificationType || '').toUpperCase()) {
        case 'INVITATION':
            return 'invitation';

        case 'APPLICATION':
            return 'application';

        default:
            return 'message';
    }
}

// 알림 시간 표시
function formatNotificationDate(createdAt) {
    if (!createdAt) {
        return '';
    }

    const createdDate = new Date(createdAt);

    if (Number.isNaN(createdDate.getTime())) {
        return '';
    }

    const now = new Date();

    const difference =
        now.getTime() - createdDate.getTime();

    const minutes =
        Math.floor(difference / 60000);

    const hours =
        Math.floor(difference / 3600000);

    const days =
        Math.floor(difference / 86400000);

    if (minutes < 1) {
        return '방금 전';
    }

    if (minutes < 60) {
        return `${minutes}분 전`;
    }

    if (hours < 24) {
        return `${hours}시간 전`;
    }

    if (days < 7) {
        return `${days}일 전`;
    }

    return createdDate.toLocaleDateString(
        'ko-KR',
        {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }
    );
}

// 로그인 필요 화면 출력
function renderNotificationLoginRequired() {
    const dropdownList =
        document.getElementById(
            'notificationDropdownList'
        );

    const fullList =
        document.getElementById(
            'notificationFullList'
        );

    if (dropdownList) {
        dropdownList.innerHTML =
            '<div class="notification-empty">' +
            '로그인 후 알림을 확인할 수 있습니다.' +
            '</div>';
    }

    if (fullList) {
        fullList.innerHTML =
            '<div class="notification-empty">' +
            '로그인 후 알림을 확인할 수 있습니다.' +
            '</div>';
    }
}

// 인증 만료 처리
function handleNotificationUnauthorized() {
    if (notificationAuthRedirecting) {
        return;
    }

    notificationAuthRedirecting = true;

    clearTimeout(notificationSseRetryTimer);
    if (notificationSseAbortController) notificationSseAbortController.abort();

    localStorage.removeItem('jwtToken');
    localStorage.removeItem('memberId');

    updateUnreadCount(0);
    renderNotificationLoginRequired();

    showNotificationToast(
        '로그인이 필요합니다. 로그인 화면으로 이동합니다.'
    );

    window.setTimeout(() => {
        window.location.href =
            NOTIFICATION_LOGIN_URL;
    }, 700);
}

// 알림 조회 실패 화면 출력
function renderNotificationError() {
    const dropdownList =
        document.getElementById(
            'notificationDropdownList'
        );

    const fullList =
        document.getElementById(
            'notificationFullList'
        );

    if (dropdownList) {
        dropdownList.innerHTML =
            '<div class="notification-error">' +
            '알림을 불러오지 못했습니다.' +
            '</div>';
    }

    if (fullList) {
        fullList.innerHTML =
            '<div class="notification-error">' +
            '알림을 불러오지 못했습니다.' +
            '</div>';
    }
}

// 알림 토스트 출력
function showNotificationToast(message) {
    const toast =
        document.getElementById('notificationToast');

    if (!toast) {
        return;
    }

    toast.textContent = message;
    toast.classList.add('show');

    clearTimeout(showNotificationToast.timer);

    showNotificationToast.timer =
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2000);
}

// HTML 특수문자 처리
function escapeNotificationHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}
