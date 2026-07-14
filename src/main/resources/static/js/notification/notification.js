const NOTIFICATION_API = '/notification';

// 로그인 연동이 끝나면 localStorage의 memberId를 사용하고,
// 아직 저장된 값이 없을 때만 테스트 회원 1번을 사용합니다.
const CURRENT_MEMBER_ID = localStorage.getItem('memberId') || '1';

// 실제 화면 주소가 확정되면 이 부분만 수정하면 됩니다.
const NOTIFICATION_TARGET_ROUTES = {
    POST: targetId => `/board/${encodeURIComponent(targetId)}`,
    GROUP: targetId => `/group/detail?id=${encodeURIComponent(targetId)}`,
    SCHEDULE: targetId => `/schedule/${encodeURIComponent(targetId)}`
};

document.addEventListener('DOMContentLoaded', () => {
    bindNotificationDropdown();
    bindNotificationListPage();
    refreshNotificationUI();
});

// 알림 API 요청 헤더 생성
function getNotificationHeaders() {
    const token = localStorage.getItem('jwtToken');
    const headers = {};

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    return headers;
}

// 회원 ID가 포함된 알림 API 주소 생성
function notificationUrl(path = '') {
    const separator = path.includes('?') ? '&' : '?';
    return `${NOTIFICATION_API}${path}${separator}memberId=${encodeURIComponent(CURRENT_MEMBER_ID)}`;
}

// 알림 목록 및 안 읽은 개수 새로고침
async function refreshNotificationUI() {
    const hasDropdown = document.getElementById('notificationDropdownList');
    const hasFullList = document.getElementById('notificationFullList');

    if (!hasDropdown && !hasFullList) {
        return;
    }

    try {
        const [notificationsResponse, unreadResponse] = await Promise.all([
            fetch(notificationUrl(), { headers: getNotificationHeaders() }),
            fetch(notificationUrl('/unread-count'), { headers: getNotificationHeaders() })
        ]);

        if (!notificationsResponse.ok || !unreadResponse.ok) {
            throw new Error('알림 조회에 실패했습니다.');
        }

        const notifications = await notificationsResponse.json();
        const unreadCount = await unreadResponse.json();

        updateUnreadCount(unreadCount);

        if (hasDropdown) {
            renderDropdownNotifications(notifications);
        }

        if (hasFullList) {
            renderFullNotifications(notifications);
        }
    } catch (error) {
        console.error(error);
        renderNotificationError();
    }
}

// 알림 종 드롭다운 이벤트 연결
function bindNotificationDropdown() {
    const bell = document.getElementById('notificationBell');
    const dropdown = document.getElementById('notificationDropdown');
    const readAllButton = document.getElementById('dropdownReadAll');

    if (!bell || !dropdown) {
        return;
    }

    bell.addEventListener('click', event => {
        event.stopPropagation();
        const opened = dropdown.classList.toggle('open');
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
        readAllButton.addEventListener('click', readAllNotifications);
    }
}

// 전체 알림 페이지 이벤트 연결
function bindNotificationListPage() {
    const readAllButton = document.getElementById('listReadAll');

    if (readAllButton) {
        readAllButton.addEventListener('click', readAllNotifications);
    }
}

// 최근 알림 드롭다운 출력
function renderDropdownNotifications(notifications) {
    const list = document.getElementById('notificationDropdownList');

    if (!list) {
        return;
    }

    if (!notifications.length) {
        list.innerHTML = '<div class="notification-empty">새로운 알림이 없습니다.</div>';
        return;
    }

    list.innerHTML = notifications.slice(0, 5)
        .map(notification => createNotificationItem(notification))
        .join('');

    bindNotificationItems(list);
}

// 전체 알림 목록 출력
function renderFullNotifications(notifications) {
    const list = document.getElementById('notificationFullList');

    if (!list) {
        return;
    }

    if (!notifications.length) {
        list.innerHTML = '<div class="notification-empty">아직 받은 알림이 없습니다.</div>';
        return;
    }

    list.innerHTML = notifications
        .map(notification => createNotificationItem(notification))
        .join('');

    bindNotificationItems(list);
}

// 알림 한 건 HTML 생성
function createNotificationItem(notification) {
    const unreadClass = notification.read ? '' : ' unread';
    const typeClass = getNotificationTypeClass(notification.notificationType);
    const icon = getNotificationIcon(notification.notificationType);
    const unreadDot = notification.read ? '' : '<span class="notification-unread-dot"></span>';

    return `
    <button class="notification-item${unreadClass}" type="button"
            data-notification-id="${notification.notificationId}"
            data-target-type="${escapeNotificationHtml(notification.targetType || '')}"
            data-target-id="${notification.targetId || ''}">
      <span class="notification-icon ${typeClass}">${icon}</span>
      <span class="notification-item-content">
        <span class="notification-item-title-row">
          <span class="notification-item-title">${escapeNotificationHtml(notification.title)}</span>
          ${unreadDot}
        </span>
        <span class="notification-item-text">${escapeNotificationHtml(notification.content)}</span>
        <span class="notification-item-time">${formatNotificationDate(notification.createdAt)}</span>
      </span>
    </button>
  `;
}

// 알림 클릭 이벤트 연결
function bindNotificationItems(container) {
    container.querySelectorAll('.notification-item').forEach(item => {
        item.addEventListener('click', async () => {
            const notificationId = item.dataset.notificationId;
            const targetType = item.dataset.targetType;
            const targetId = item.dataset.targetId;

            await readSingleNotification(notificationId);
            moveToNotificationTarget(targetType, targetId);
        });
    });
}

// 알림 한 개 읽음 처리
async function readSingleNotification(notificationId) {
    try {
        const response = await fetch(notificationUrl(`/${notificationId}/read`), {
            method: 'PATCH',
            headers: getNotificationHeaders()
        });

        if (!response.ok) {
            throw new Error('알림 읽음 처리에 실패했습니다.');
        }
    } catch (error) {
        console.error(error);
        showNotificationToast('알림 읽음 처리 중 오류가 발생했습니다.');
    }
}

// 전체 알림 읽음 처리
async function readAllNotifications() {
    try {
        const response = await fetch(notificationUrl('/read-all'), {
            method: 'PATCH',
            headers: getNotificationHeaders()
        });

        if (!response.ok) {
            throw new Error('전체 읽음 처리에 실패했습니다.');
        }

        showNotificationToast('모든 알림을 읽음 처리했습니다.');
        await refreshNotificationUI();
    } catch (error) {
        console.error(error);
        showNotificationToast('전체 읽음 처리 중 오류가 발생했습니다.');
    }
}

// 안 읽은 알림 개수 표시
function updateUnreadCount(unreadCount) {
    const badge = document.getElementById('notificationBadge');
    const homeCount = document.getElementById('homeUnreadCount');
    const dropdownText = document.getElementById('dropdownUnreadText');
    const listText = document.getElementById('listUnreadText');
    const listReadAll = document.getElementById('listReadAll');
    const dropdownReadAll = document.getElementById('dropdownReadAll');

    if (badge) {
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        badge.classList.toggle('show', unreadCount > 0);
    }

    if (homeCount) {
        homeCount.textContent = unreadCount;
    }

    if (dropdownText) {
        dropdownText.textContent = `읽지 않은 알림 ${unreadCount}개`;
    }

    if (listText) {
        listText.textContent = `읽지 않은 알림 ${unreadCount}개`;
    }

    if (listReadAll) {
        listReadAll.disabled = unreadCount === 0;
    }

    if (dropdownReadAll) {
        dropdownReadAll.disabled = unreadCount === 0;
    }
}

// 알림 대상 화면으로 이동
function moveToNotificationTarget(targetType, targetId) {
    if (!targetType || !targetId) {
        refreshNotificationUI();
        return;
    }

    const routeBuilder = NOTIFICATION_TARGET_ROUTES[targetType.toUpperCase()];

    if (!routeBuilder) {
        refreshNotificationUI();
        return;
    }

    window.location.href = routeBuilder(targetId);
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
    const difference = now.getTime() - createdDate.getTime();
    const minutes = Math.floor(difference / 60000);
    const hours = Math.floor(difference / 3600000);
    const days = Math.floor(difference / 86400000);

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

    return createdDate.toLocaleDateString('ko-KR', {
        year:'numeric',
        month:'2-digit',
        day:'2-digit'
    });
}

// 알림 조회 실패 화면 출력
function renderNotificationError() {
    const dropdownList = document.getElementById('notificationDropdownList');
    const fullList = document.getElementById('notificationFullList');

    if (dropdownList) {
        dropdownList.innerHTML = '<div class="notification-error">알림을 불러오지 못했습니다.</div>';
    }

    if (fullList) {
        fullList.innerHTML = '<div class="notification-error">알림을 불러오지 못했습니다.</div>';
    }
}

// 알림 토스트 출력
function showNotificationToast(message) {
    const toast = document.getElementById('notificationToast');

    if (!toast) {
        return;
    }

    toast.textContent = message;
    toast.classList.add('show');

    clearTimeout(showNotificationToast.timer);
    showNotificationToast.timer = setTimeout(() => {
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