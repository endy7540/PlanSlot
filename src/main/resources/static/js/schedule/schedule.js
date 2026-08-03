const HOLIDAYS = {
        // 2025년
        "2025-01-01": "신정", "2025-01-28": "설날", "2025-01-29": "설날", "2025-01-30": "설날",
        "2025-03-01": "삼일절", "2025-03-03": "대체공휴일", "2025-05-05": "어린이날", "2025-05-06": "부처님오신날",
        "2025-06-06": "현충일", "2025-08-15": "광복절", "2025-10-03": "개천절", "2025-10-05": "추석",
        "2025-10-06": "추석", "2025-10-07": "추석", "2025-10-08": "대체공휴일", "2025-10-09": "한글날",
        "2025-12-25": "크리스마스",
        // 2026년
        "2026-01-01": "신정", "2026-02-16": "설날 연휴", "2026-02-17": "설날", "2026-02-18": "설날 연휴",
        "2026-03-01": "삼일절", "2026-03-02": "대체공휴일", "2026-05-05": "어린이날", "2026-05-24": "부처님오신날",
        "2026-05-25": "대체공휴일", "2026-06-06": "현충일", "2026-07-17": "제헌절", "2026-08-15": "광복절",
        "2026-08-17": "대체공휴일", "2026-09-24": "추석 연휴", "2026-09-25": "추석", "2026-09-26": "추석 연휴",
        "2026-09-28": "대체공휴일", "2026-10-03": "개천절", "2026-10-05": "대체공휴일", "2026-10-09": "한글날",
        "2026-12-25": "크리스마스",
        // 2027년
        "2027-01-01": "신정", "2027-02-06": "설날 연휴", "2027-02-07": "설날", "2027-02-08": "설날 연휴",
        "2027-02-09": "대체공휴일", "2027-03-01": "삼일절", "2027-05-05": "어린이날", "2027-05-13": "부처님오신날",
        "2027-06-06": "현충일", "2027-06-07": "대체공휴일", "2027-08-15": "광복절", "2027-08-16": "대체공휴일",
        "2027-09-14": "추석 연휴", "2027-09-15": "추석", "2027-09-16": "추석 연휴", "2027-10-03": "개천절",
        "2027-10-04": "대체공휴일", "2027-10-09": "한글날", "2027-10-11": "대체공휴일", "2027-12-25": "크리스마스",
        "2027-12-27": "대체공휴일"
    };

    const API_BASE = window.location.origin;
    let token = '';
    let viewYear, viewMonth; // viewMonth: 0-11
    let schedulesByDate = {}; // { 'YYYY-MM-DD': [schedule, ...] }
    let selectedDateKey = null;
    let currentSearchQuery = '';
    let searchMatches = [];
    let searchMatchIndex = -1;

    // 화면에 표시되던 "요청 로그" 패널은 제거했고, 디버깅용으로 콘솔에만 남겨둡니다.
    function log(label, data) {
        const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        console.log(`[${label}]`, text);
    }

    function showToast(msg, isError) {
        const t = document.getElementById('toast');
        t.textContent = msg;
        t.className = 'toast show' + (isError ? ' error' : '');
        setTimeout(() => t.classList.remove('show'), 2200);
    }

    // 실제 로그인 페이지(auth.html)가 저장하는 key: 'jwtToken' (Bearer 접두어 제외)
    function checkAuth() {
        token = localStorage.getItem('jwtToken') || '';
        const badge = document.getElementById('tokenBadge');
        const calPanel = document.getElementById('calendarPanel');

        if (token) {
            if (badge) {
                badge.textContent = '로그인됨 (토큰 보유)';
                badge.classList.remove('off');
            }
            calPanel.style.display = '';
        } else {
            alert('로그인이 필요한 서비스입니다.');
            window.location.href = '/auth/login';
        }
        return !!token;
    }

    function authHeaders() {
        return {
            'Content-Type': 'application/json',
            'Accept': 'application/json', // 화면(GET /schedule, text/html)과 API(GET /schedule, JSON)가 같은 주소를 쓰므로 명시 필수
            'Authorization': 'Bearer ' + token
        };
    }

    function pad(n) { return String(n).padStart(2, '0'); }

    function fmtLocalDateTime(date) {
        return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }

    /* 구글 동기화 상태 로드 및 제어 */
    async function loadGoogleSyncStatus() {
        try {
            const res = await fetch('/members/me/google-sync', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (res.ok) {
                const data = await res.json();
                const isLinked = data.isLinked;
                const isEnabled = data.isEnabled;
                
                const toggle = document.getElementById('googleSyncToggle');
                
                if (isLinked) {
                    if (toggle) toggle.checked = isEnabled;
                    if (isEnabled) {
                        // 페이지 로드 시에도 연동되어 있다면 한 번 긁어온다.
                        syncGoogleCalendarNow(true);
                    }
                } else {
                    if (toggle) {
                        toggle.disabled = true;
                        toggle.parentElement.parentElement.style.opacity = '0.5';
                        toggle.parentElement.parentElement.title = "마이페이지에서 구글 로그인을 먼저 진행해주세요.";
                    }
                }
            }
        } catch (e) {
            console.error("구글 연동 상태 로드 실패", e);
        }
    }
    
    window.toggleGoogleSync = async function(enabled) {
        try {
            const res = await fetch('/members/me/google-sync', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ enabled: enabled })
            });
            if (res.ok) {
                showToast(`구글 캘린더 연동이 ${enabled ? '활성화' : '비활성화'} 되었습니다.`);
                if (enabled) {
                    syncGoogleCalendarNow();
                }
            } else {
                document.getElementById('googleSyncToggle').checked = !enabled;
                showToast('상태 변경에 실패했습니다.', true);
            }
        } catch (e) {
            document.getElementById('googleSyncToggle').checked = !enabled;
            showToast('상태 변경 중 오류가 발생했습니다.', true);
        }
    };
    
    window.syncGoogleCalendarNow = async function(silent = false) {
        if (!silent) showToast('구글 캘린더 일정을 가져옵니다...');
        
        try {
            const res = await fetch('/schedule/google-sync', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (res.ok) {
                if (!silent) showToast('구글 캘린더 일정을 성공적으로 가져왔습니다.');
                loadMonthSchedules();
            } else {
                if (!silent) showToast('일정 가져오기에 실패했습니다.', true);
            }
        } catch (e) {
            if (!silent) showToast('서버 통신 오류가 발생했습니다.', true);
        }
    };

    // 오늘과 이번 주의 고유 일정을 요약 갱신하는 헬퍼 함수
    function updateScheduleSummaryCounts(schedules) {
        if (!Array.isArray(schedules)) return;

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;

        // 이번 주 범위 계산 (오늘을 기준으로 월요일 ~ 일요일)
        const currentDay = today.getDay(); // 0: 일, 1: 월 ... 6: 토
        const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;

        const monday = new Date(today);
        monday.setDate(today.getDate() + distanceToMonday);
        monday.setHours(0, 0, 0, 0);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        const weeklyScheduleIds = new Set();
        const todayScheduleIds = new Set();

        schedules.forEach(s => {
            if (!s.startDate) return;
            const startStr = getDateOnly(s.startDate);
            const endStr = s.endDate ? getDateOnly(s.endDate) : startStr;

            const startDateObj = new Date(startStr);
            const endDateObj = new Date(endStr);
            startDateObj.setHours(0, 0, 0, 0);
            endDateObj.setHours(23, 59, 59, 999);

            // 오늘 일정 매핑 판별
            if (todayStr >= startStr && todayStr <= endStr) {
                todayScheduleIds.add(s.scheduleId);
            }

            // 주간 일정 매핑 판별
            if (startDateObj <= sunday && endDateObj >= monday) {
                weeklyScheduleIds.add(s.scheduleId);
            }
        });

        document.getElementById('todayEventCount').textContent = todayScheduleIds.size;
        document.getElementById('weeklyEventCount').textContent = weeklyScheduleIds.size;
    }

    async function loadMonthSchedules() {
        const firstOfMonth = new Date(viewYear, viewMonth, 1);
        const startDow = firstOfMonth.getDay(); // 0=일

        // 달력 첫 칸에 들어갈 이전 달 꼬리의 시작일 계산
        const startCalendarDate = new Date(viewYear, viewMonth, 1 - startDow, 0, 0, 0);

        // 달력 마지막 칸에 들어갈 다음 달 머리의 종료일 계산 (6주 = 42일분량 확보)
        const endCalendarDate = new Date(startCalendarDate.getTime());
        endCalendarDate.setDate(endCalendarDate.getDate() + 41);
        endCalendarDate.setHours(23, 59, 59, 999);

        // [오늘 및 이번 주 쿼리 확장] 달력 범위 외에 오늘/이번 주 범위가 쿼리에서 누락되지 않도록 최소/최대 시작종료일 연장
        const todayObj = new Date();
        const currentDay = todayObj.getDay();
        const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
        const thisWeekMonday = new Date(todayObj);
        thisWeekMonday.setDate(todayObj.getDate() + distanceToMonday);
        thisWeekMonday.setHours(0, 0, 0, 0);

        const thisWeekSunday = new Date(thisWeekMonday);
        thisWeekSunday.setDate(thisWeekMonday.getDate() + 6);
        thisWeekSunday.setHours(23, 59, 59, 999);

        const queryStartDate = new Date(Math.min(startCalendarDate.getTime(), thisWeekMonday.getTime()));
        const queryEndDate = new Date(Math.max(endCalendarDate.getTime(), thisWeekSunday.getTime()));

        const url = `${API_BASE}/schedule?start=${encodeURIComponent(fmtLocalDateTime(queryStartDate))}&end=${encodeURIComponent(fmtLocalDateTime(queryEndDate))}&_t=${new Date().getTime()}`;

        schedulesByDate = {};
        try {
            const res = await fetch(url, { headers: authHeaders() });
            const text = await res.text();
            log(`GET ${url.replace(API_BASE,'')}`, `status: ${res.status}\n${text}`);
            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    showToast('로그인이 만료되었습니다. 다시 로그인해주세요.', true);
                    localStorage.removeItem('jwtToken');
                    const badge = document.getElementById('tokenBadge');
                    if (badge) {
                        badge.textContent = '로그인 필요';
                        badge.classList.add('off');
                    }
                    document.getElementById('authNotice').style.display = '';
                    document.getElementById('calendarPanel').style.display = 'none';
                    return;
                }
                showToast('일정 조회 실패: ' + res.status, true);
            } else {
                const schedules = JSON.parse(text);

                // 오늘 및 이번 주 카운트 실시간 업데이트
                updateScheduleSummaryCounts(schedules);

                schedules.forEach(s => {
                    if (!s.startDate) return;
                    const startStr = getDateOnly(s.startDate);
                    const endStr = s.endDate ? getDateOnly(s.endDate) : startStr;

                    // 달력에 표시할 범위(startCalendarDate ~ endCalendarDate) 내에 존재하는 일정들만 달력 날짜에 렌더링 매핑
                    const startDateObj = new Date(startStr);
                    const endDateObj = new Date(endStr);
                    startDateObj.setHours(0,0,0,0);
                    endDateObj.setHours(23,59,59,999);

                    if (startDateObj <= endCalendarDate && endDateObj >= startCalendarDate) {
                        if (startStr === endStr) {
                            if (!schedulesByDate[startStr]) schedulesByDate[startStr] = [];
                            schedulesByDate[startStr].push(s);
                        } else {
                            // 2일 이상 걸치는 기간형 일정을 달력 표시 기간에 겹치는 날짜에만 매핑
                            const calendarStart = new Date(Math.max(startDateObj.getTime(), startCalendarDate.getTime()));
                            const calendarEnd = new Date(Math.min(endDateObj.getTime(), endCalendarDate.getTime()));

                            let currDate = new Date(calendarStart.getFullYear(), calendarStart.getMonth(), calendarStart.getDate());
                            const targetEndDateOnly = new Date(calendarEnd.getFullYear(), calendarEnd.getMonth(), calendarEnd.getDate());

                            while (currDate <= targetEndDateOnly) {
                                const dateKey = `${currDate.getFullYear()}-${pad(currDate.getMonth()+1)}-${pad(currDate.getDate())}`;
                                if (!schedulesByDate[dateKey]) schedulesByDate[dateKey] = [];
                                schedulesByDate[dateKey].push(s);
                                currDate.setDate(currDate.getDate() + 1);
                            }
                        }
                    }
                });
            }
        } catch (e) {
            log('GET /schedule (에러)', e.message);
        }
        renderCalendar();
        syncSelectedDateToMonth();
    }

    function syncUrlWithDateKey(dateKey) {
        if (dateKey) {
            const params = new URLSearchParams(window.location.search);
            params.set('date', dateKey);
            const newUrl = `${window.location.pathname}?${params.toString()}`;
            window.history.replaceState({ path: newUrl }, '', newUrl);
        }
    }

    function syncSelectedDateToMonth() {
        if (!selectedDateKey) return;
        const parts = selectedDateKey.split('-');
        const selY = parseInt(parts[0], 10);
        const selM = parseInt(parts[1], 10) - 1;

        if (selY !== viewYear || selM !== viewMonth) {
            const padStr = (n) => String(n).padStart(2, '0');
            const today = new Date();
            if (today.getFullYear() === viewYear && today.getMonth() === viewMonth) {
                selectedDateKey = `${viewYear}-${padStr(viewMonth+1)}-${padStr(today.getDate())}`;
            } else {
                selectedDateKey = `${viewYear}-${padStr(viewMonth+1)}-01`;
            }
        }
        syncUrlWithDateKey(selectedDateKey);
        renderSelectedDateEvents(selectedDateKey);
    }

    function moveMonth(delta) {
        viewMonth += delta;
        if (viewMonth < 0) { viewMonth = 11; viewYear--; }
        if (viewMonth > 11) { viewMonth = 0; viewYear++; }
        loadMonthSchedules();
    }

    function goToday() {
        const now = new Date();
        viewYear = now.getFullYear();
        viewMonth = now.getMonth();
        const padStr = (n) => String(n).padStart(2, '0');
        selectedDateKey = `${viewYear}-${padStr(viewMonth+1)}-${padStr(now.getDate())}`;
        loadMonthSchedules();
    }

    function showDatePicker(event) {
        if (document.getElementById('monthSelect') || document.getElementById('yearSelect')) return;
        event.stopPropagation();

        const label = document.getElementById('monthLabel');
        const currentYear = new Date().getFullYear();
        let yearOptions = '';
        for (let y = currentYear - 10; y <= currentYear + 10; y++) {
            yearOptions += `<option value="${y}" ${y === viewYear ? 'selected' : ''}>${y}년</option>`;
        }

        let monthOptions = '';
        for (let m = 1; m <= 12; m++) {
            monthOptions += `<option value="${m - 1}" ${(m - 1) === viewMonth ? 'selected' : ''}>${m}월</option>`;
        }

        label.innerHTML = `
            <select id="yearSelect" style="font-size: 16px; font-weight: 800; color: #075985; border: 1px solid #38BDF8; border-radius: 4px; padding: 2px 4px;" onclick="event.stopPropagation()">
                ${yearOptions}
            </select>
            <select id="monthSelect" style="font-size: 16px; font-weight: 800; color: #075985; border: 1px solid #38BDF8; border-radius: 4px; padding: 2px 4px;" onclick="event.stopPropagation()">
                ${monthOptions}
            </select>
            <button id="dateMoveBtn" style="font-size: 13px; font-weight: 900; background: #075985; color: #fff; border: 0; border-radius: 4px; padding: 4px 8px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#0369a1'" onmouseout="this.style.background='#075985'" onclick="onDateSelectorConfirm(event)">이동</button>
        `;
    }

    function onDateSelectorConfirm(event) {
        if (event) event.stopPropagation();
        const yearSel = document.getElementById('yearSelect');
        const monthSel = document.getElementById('monthSelect');
        if (yearSel && monthSel) {
            viewYear = parseInt(yearSel.value, 10);
            viewMonth = parseInt(monthSel.value, 10);
            loadMonthSchedules();
        }
    }

    document.addEventListener('click', function(e) {
        const label = document.getElementById('monthLabel');
        if (label && !label.contains(e.target)) {
            if (document.getElementById('monthSelect') || document.getElementById('yearSelect')) {
                label.textContent = `${viewYear}년 ${viewMonth + 1}월`;
            }
        }
    });

    function renderCalendar() {
        document.getElementById('monthLabel').textContent = `${viewYear}년 ${viewMonth + 1}월`;

        const firstOfMonth = new Date(viewYear, viewMonth, 1);
        const startDow = firstOfMonth.getDay(); // 0=일
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

        const today = new Date();
        const todayKey = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;

        const cells = [];
        // 이전달 꼬리
        for (let i = startDow - 1; i >= 0; i--) {
            const d = daysInPrevMonth - i;
            cells.push({ day: d, otherMonth: true, y: viewMonth === 0 ? viewYear - 1 : viewYear, m: viewMonth === 0 ? 11 : viewMonth - 1 });
        }
        // 이번달
        for (let d = 1; d <= daysInMonth; d++) {
            cells.push({ day: d, otherMonth: false, y: viewYear, m: viewMonth });
        }
        // 다음달 머리 (6주 채우기)
        const targetM = viewMonth === 11 ? 0 : viewMonth + 1;
        const targetY = viewMonth === 11 ? viewYear + 1 : viewYear;
        let nextDay = 1;
        while (cells.length % 7 !== 0 || cells.length < 35) {
            cells.push({ day: nextDay++, otherMonth: true, y: targetY, m: targetM });
        }

        // 1. 달력 범위의 모든 날짜 키 수집 및 슬롯 초기화
        const dateKeys = cells.map(c => `${c.y}-${pad(c.m+1)}-${pad(c.day)}`);
        const scheduledSlots = {};
        dateKeys.forEach(dk => {
            scheduledSlots[dk] = [null, null, null]; // 기본 3개 슬롯
        });

        // 2. 현재 달력 영역에 나타나는 고유 일정들 수집
        const uniqueEventsMap = new Map();
        dateKeys.forEach(dk => {
            const evs = schedulesByDate[dk] || [];
            evs.forEach(e => {
                const startStr = getDateOnly(e.startDate);
                uniqueEventsMap.set(e.scheduleId + "_" + startStr, e);
            });
        });
        const allEvents = Array.from(uniqueEventsMap.values());

        // 3. 우선순위 정렬 (기간이 긴 일정, 시작일이 빠른 일정 우선)
        allEvents.sort((a, b) => {
            const aStart = getDateOnly(a.startDate);
            const aEnd = a.endDate ? getDateOnly(a.endDate) : aStart;
            const bStart = getDateOnly(b.startDate);
            const bEnd = b.endDate ? getDateOnly(b.endDate) : bStart;

            const aDuration = (new Date(aEnd) - new Date(aStart));
            const bDuration = (new Date(bEnd) - new Date(bStart));

            if (aDuration !== bDuration) {
                return bDuration - aDuration; // 기간이 더 긴 일정 우선
            }
            if (aStart !== bStart) {
                return aStart.localeCompare(bStart); // 시작일이 빠른 일정 우선
            }
            return (a.title || '').localeCompare(b.title || '');
        });

        // 4. 슬롯 할당 알고리즘 구동
        allEvents.forEach(e => {
            const startStr = getDateOnly(e.startDate);
            const endStr = e.endDate ? getDateOnly(e.endDate) : startStr;

            // 달력 노출 범위와 겹치는 실제 날짜들 추출
            const activeDates = dateKeys.filter(dk => dk >= startStr && dk <= endStr);
            if (activeDates.length === 0) return;

            // 모든 겹치는 날짜들 중에서 공통적으로 비어있는 가장 낮은 슬롯 인덱스 탐색
            let targetSlot = -1;
            for (let slotIdx = 0; slotIdx < 3; slotIdx++) {
                let isAvailable = true;
                for (let dk of activeDates) {
                    if (scheduledSlots[dk][slotIdx] !== null) {
                        isAvailable = false;
                        break;
                    }
                }
                if (isAvailable) {
                    targetSlot = slotIdx;
                    break;
                }
            }

            if (targetSlot !== -1) {
                // 비어있는 공통 슬롯에 배치
                activeDates.forEach(dk => {
                    scheduledSlots[dk][targetSlot] = e;
                });
            }
        });

        const grid = document.getElementById('calGrid');
        grid.innerHTML = cells.map((c, cellIdx) => {
            const dateKey = dateKeys[cellIdx];
            const isToday = dateKey === todayKey;
            
            // 일요일 & 공휴일 판정
            const isSunday = new Date(c.y, c.m, c.day).getDay() === 0;
            const mmdd = `${pad(c.m+1)}-${pad(c.day)}`;
            const isSolarHoliday = ["01-01", "03-01", "05-05", "06-06", "07-17", "08-15", "10-03", "10-09", "12-25"].includes(mmdd);
            const isHoliday = !!HOLIDAYS[dateKey] || isSolarHoliday;
            const isRedDay = isSunday || isHoliday;
            
            // 토요일 판정 (일요일/공휴일과 겹치지 않을 때만 파란색 적용)
            const isSaturday = (new Date(c.y, c.m, c.day).getDay() === 6) && !isRedDay;
            const isSelected = dateKey === selectedDateKey;

            // 슬롯 렌더링
            const slots = scheduledSlots[dateKey];
            const chips = slots.map(s => {
                if (s === null) {
                    // 빈 자리: 높이만 확보해 주어 다른 연속 일정이 일직선 상을 유지하도록 홀더 렌더링
                    return `<div class="event-chip placeholder" style="visibility: hidden; pointer-events: none; border-color: transparent;">&nbsp;</div>`;
                }

                const matches = currentSearchQuery && s.title.toLowerCase().includes(currentSearchQuery.toLowerCase());
                const searchClass = currentSearchQuery 
                    ? (matches ? ' search-match' : ' search-mismatch') 
                    : '';
                const isPub = (s.isPublic === true || s.isPublic === 'Y' || s.public === true || s.public === 'Y');
                
                // 연속 일정 판정 클래스 부여 (시작일, 중간일, 종료일 판정)
                let durationClass = '';
                try {
                    if (s.startDate && s.endDate) {
                        const startStr = getDateOnly(s.startDate);
                        const endStr = getDateOnly(s.endDate);
                        if (startStr && endStr && startStr !== endStr) {
                            if (dateKey === startStr) {
                                durationClass = ' event-start';
                            } else if (dateKey === endStr) {
                                durationClass = ' event-end';
                            } else if (dateKey > startStr && dateKey < endStr) {
                                durationClass = ' event-middle';
                            }
                        }
                    }
                } catch (e) {
                    console.error("연속 일정 판정 오류:", e);
                }

                let timePrefix = '';
                if (s.startDate && s.endDate) {
                    const isAllDay = (s.startDate.includes('T00:00') || s.startDate.includes(' 00:00')) && (s.endDate.includes('T23:59') || s.endDate.includes(' 23:59'));
                    if (!isAllDay) {
                        try {
                            const timeStr = s.startDate.includes('T') ? s.startDate.split('T')[1] : s.startDate.split(' ')[1];
                            if (timeStr) {
                                timePrefix = `[${timeStr.slice(0, 5)}] `;
                            }
                        } catch (e) {
                            console.error("칩 시간 추출 오류:", e);
                        }
                    }
                }

                const displayTitle = (durationClass === ' event-middle' || durationClass === ' event-end')
                    ? '&nbsp;'
                    : timePrefix + escapeHtml(s.title);

                const baseColor = window.personalCalendarColor || '#3B82F6';
                let colorStyle = `background-color: ${baseColor}; color: white; border: none; text-shadow: 0px 1px 2px rgba(0,0,0,0.3);`;
                if (!isPub) colorStyle += ' opacity: 0.5;';

                return `<div class="event-chip${isPub ? ' public' : ''}${searchClass}${durationClass}" style="${colorStyle}">${displayTitle}</div>`;
            }).join('');

            // 더보기 개수 계산
            const totalSchedules = (schedulesByDate[dateKey] || []).length;
            const displayedCount = slots.filter(s => s !== null).length;
            const moreCount = totalSchedules - displayedCount;
            const more = moreCount > 0 ? `<div class="event-more">+${moreCount}개 더보기</div>` : '';

            return `
        <div class="cal-day${c.otherMonth ? ' other-month' : ''}${isToday ? ' today' : ''}${isSelected ? ' selected-day' : ''}" data-date="${dateKey}" onclick="handleDateClick('${dateKey}')">
          <div class="date-num${isRedDay ? ' red-day' : ''}${isSaturday ? ' blue-day' : ''}">${c.day}</div>
          ${chips}
          ${more}
        </div>`;
        }).join('');
    }

    /* ======================================================== */
    /* 선택한 날의 일정 전체/부분 삭제 기능 (일괄 처리)           */
    /* ======================================================== */
    async function deleteSelectedDateSchedules() {
        if (!selectedDateKey) {
            showToast('먼저 삭제할 날짜를 선택해주세요.', true);
            return;
        }

        const daySchedules = schedulesByDate[selectedDateKey] || [];
        if (daySchedules.length === 0) {
            showToast(`${selectedDateKey}에 지울 일정이 없습니다.`, true);
            return;
        }

        // 연속 일정 또는 반복 일정 존재 여부 판별
        let hasMultiDayOrRecurrent = false;
        daySchedules.forEach(s => {
            const startDateStr = getDateOnly(s.startDate);
            const endDateStr = s.endDate ? getDateOnly(s.endDate) : startDateStr;
            const isRecurrent = s.scheduleType && s.scheduleType !== 'DAILY';
            if (startDateStr !== endDateStr || isRecurrent) {
                hasMultiDayOrRecurrent = true;
            }
        });

        const listHtml = daySchedules.map(s => `<li style="font-weight: 700; color: #1E293B; margin-bottom: 4px; list-style-position: inside; text-align: left;">• ${escapeHtml(s.title)}</li>`).join('');
        const btnGroup = document.getElementById('deleteModalBtnGroup');

        // 가로 2버튼 모달창 복원
        document.querySelector('#deleteConfirmModal h3').textContent = '일정 일괄 삭제';
        document.getElementById('deleteConfirmModalMsg').innerHTML =
            `선택한 날인 <strong>${selectedDateKey}</strong>의 모든 일정 (${daySchedules.length}개)을 삭제하시겠습니까?<br><br>` +
            `<div style="text-align: left; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px; margin-bottom: 16px;">` +
            `  <span style="font-weight: 800; color: #0F172A; display: block; margin-bottom: 8px; font-size: 13.5px;">📋 선택한 날의 일정 (${daySchedules.length}개)</span>` +
            `  <ul style="margin: 0; padding: 0; font-size: 12.5px; color: #334155; list-style: none;">${listHtml}</ul>` +
            `</div>`;

        btnGroup.style.flexDirection = 'row';
        btnGroup.innerHTML = `
            <button class="ghost" onclick="closeDeleteConfirmModal()" style="flex: 1; padding: 12px; font-size: 13.5px; border-radius: 10px; border: 2px solid #E2E8F0; background: white; color: #475569; font-weight: bold; cursor: pointer;">
                취소
            </button>
            <button id="deleteAllBtn" class="primary" onclick="executeDeleteChoice('single')" style="flex: 1; padding: 12px; font-size: 13.5px; border-radius: 10px; border: 0; background: #EF4444; color: white; font-weight: bold; cursor: pointer;">
                🗑️ 모든 일정 삭제 확정
            </button>
        `;
        const modal = document.getElementById('deleteConfirmModal');
        modal.style.display = 'flex';
        modal.focus();

    }

    function getNextRecurrentDate(dateStr, type) {
        const d = new Date(dateStr.replace(' ', 'T'));
        if (type === 'WEEKLY') {
            d.setDate(d.getDate() + 7);
        } else if (type === 'MONTHLY') {
            d.setMonth(d.getMonth() + 1);
        } else if (type === 'YEARLY') {
            d.setFullYear(d.getFullYear() + 1);
        }
        return d;
    }

    function getPrevRecurrentDate(dateStr, type) {
        const d = new Date(dateStr.replace(' ', 'T'));
        if (type === 'WEEKLY') {
            d.setDate(d.getDate() - 7);
        } else if (type === 'MONTHLY') {
            d.setMonth(d.getMonth() - 1);
        } else if (type === 'YEARLY') {
            d.setFullYear(d.getFullYear() - 1);
        }
        return d;
    }

    async function executeDeleteChoice(choice) {
        closeDeleteConfirmModal();
        showToast('선택하신 일정 삭제 처리 중...');

        const daySchedules = schedulesByDate[selectedDateKey] || [];

        for (let tempS of daySchedules) {
            let s = tempS;
            try {
                const res = await fetch(`${API_BASE}/schedule/${tempS.scheduleId}`, { headers: authHeaders() });
                if (res.ok) {
                    s = await res.json();
                }
            } catch (e) {
                console.error("DB 원본 일정 상세 로드 실패:", e);
            }

            const startDateStr = getDateOnly(s.startDate);
            const endDateStr = s.endDate ? getDateOnly(s.endDate) : startDateStr;
            const isMultiDay = startDateStr !== endDateStr;
            const isRecurrent = s.scheduleType && s.scheduleType !== 'DAILY';

            if (choice === 'all' || (!isMultiDay && !isRecurrent)) {
                // 전체 삭제 대상이거나, 단일 일정인 경우 무조건 삭제(DELETE)
                try {
                    await fetch(`${API_BASE}/schedule/${s.scheduleId}`, {
                        method: 'DELETE',
                        headers: authHeaders()
                    });
                } catch (e) {
                    console.error("일정 삭제 실패:", e);
                }
            } else if (choice === 'single') {
                if (isRecurrent) {
                    // 반복 일정 중 하루만 삭제
                    try {
                        const recurEndStr = s.recurrenceEndDate || null;
                        
                        if (selectedDateKey === startDateStr) {
                            // 시작일 삭제 -> 다음 반복일로 시작일 미루기
                            const nextStart = getNextRecurrentDate(s.startDate, s.scheduleType);
                            const nextStartStr = fmtLocalDateTime(nextStart);
                            let nextEndStr = null;
                            if (s.endDate) {
                                const origStart = new Date(s.startDate.replace(' ', 'T'));
                                const origEnd = new Date(s.endDate.replace(' ', 'T'));
                                const diff = origEnd.getTime() - origStart.getTime();
                                const nextEnd = new Date(nextStart.getTime() + diff);
                                nextEndStr = fmtLocalDateTime(nextEnd);
                            }
                            await updateScheduleDates(s, nextStartStr, nextEndStr, s.recurrenceEndDate);
                        } else if (recurEndStr && selectedDateKey === recurEndStr) {
                            // 마지막일 삭제 -> 반복 종료일을 이전 반복일로 당기기
                            const prevEnd = getPrevRecurrentDate(recurEndStr, s.scheduleType);
                            const prevEndStr = prevEnd.getFullYear() + '-' + String(prevEnd.getMonth()+1).padStart(2,'0') + '-' + String(prevEnd.getDate()).padStart(2,'0');
                            await updateScheduleDates(s, s.startDate, s.endDate, prevEndStr);
                        } else {
                            // 중간일 삭제 -> 앞부분 단축 (반복 종료일을 이전 반복일로) & 뒷부분 신규 생성 (다음 반복일로)
                            const prevEnd = getPrevRecurrentDate(selectedDateKey, s.scheduleType);
                            const prevEndStr = prevEnd.getFullYear() + '-' + String(prevEnd.getMonth()+1).padStart(2,'0') + '-' + String(prevEnd.getDate()).padStart(2,'0');
                            await updateScheduleDates(s, s.startDate, s.endDate, prevEndStr);
                            
                            const nextStart = getNextRecurrentDate(selectedDateKey, s.scheduleType);
                            const nextStartStr = fmtLocalDateTime(nextStart);
                            let nextEndStr = null;
                            if (s.endDate) {
                                const origStart = new Date(s.startDate.replace(' ', 'T'));
                                const origEnd = new Date(s.endDate.replace(' ', 'T'));
                                const diff = origEnd.getTime() - origStart.getTime();
                                const nextEnd = new Date(nextStart.getTime() + diff);
                                nextEndStr = fmtLocalDateTime(nextEnd);
                            }
                            await createSplitSchedule(s, nextStartStr, nextEndStr, s.recurrenceEndDate);
                        }
                    } catch (e) {
                        console.error("반복 일정 부분 삭제 실패:", e);
                    }
                } else if (isMultiDay) {
                    // 연속 일정 부분 삭제
                    const startD = new Date(startDateStr);
                    const endD = new Date(endDateStr);
                    try {
                        if (selectedDateKey === startDateStr) {
                            startD.setDate(startD.getDate() + 1);
                            const newStartStr = fmtLocalDateTime(startD);
                            await updateScheduleDates(s, newStartStr, s.endDate, s.recurrenceEndDate);
                        } else if (selectedDateKey === endDateStr) {
                            endD.setDate(endD.getDate() - 1);
                            const newEndStr = fmtLocalDateTime(endD);
                            await updateScheduleDates(s, s.startDate, newEndStr, s.recurrenceEndDate);
                        } else {
                            const frontEndD = new Date(selectedDateKey);
                            frontEndD.setDate(frontEndD.getDate() - 1);
                            frontEndD.setHours(23, 59, 59, 0);
                            const frontEndStr = fmtLocalDateTime(frontEndD);
                            await updateScheduleDates(s, s.startDate, frontEndStr, s.recurrenceEndDate);

                            const backStartD = new Date(selectedDateKey);
                            backStartD.setDate(backStartD.getDate() + 1);
                            backStartD.setHours(0, 0, 0, 0);
                            const backStartStr = fmtLocalDateTime(backStartD);
                            await createSplitSchedule(s, backStartStr, s.endDate, s.recurrenceEndDate);
                        }
                    } catch (e) {
                        console.error("연속 일정 부분 삭제 실패:", e);
                    }
                }
            }
        }

        showToast(`🗑️ 일정 삭제 및 단축 처리가 모두 완료되었습니다.`);
        await loadMonthSchedules();
        renderSelectedDateEvents(selectedDateKey);
    }

    window.closeDeleteConfirmModal = function() {
        document.getElementById('deleteConfirmModal').style.display = 'none';
        
        // 삭제 모달이 닫힐 때 뒤의 조회/등록/수정 iframe 창이 띄워져 있다면 포커스를 복구하여 연속 ESC 작동 보장
        const iframeModal = document.getElementById('scheduleIframeContainer');
        const iframe = document.getElementById('scheduleIframe');
        if (iframeModal && iframeModal.classList.contains('open') && iframe) {
            setTimeout(() => {
                iframe.focus();
                if (iframe.contentWindow) {
                    iframe.contentWindow.focus();
                }
            }, 50);
        }
    };

    // 일정 날짜 업데이트 PUT 호출 도우미
    async function updateScheduleDates(originalSchedule, newStart, newEnd, newRecurEnd) {
        const fmtStart = newStart ? fmtLocalDateTime(new Date(newStart.replace(' ', 'T'))) : null;
        const fmtEnd = newEnd ? fmtLocalDateTime(new Date(newEnd.replace(' ', 'T'))) : null;

        const payload = {
            title: originalSchedule.title,
            description: originalSchedule.description,
            scheduleType: originalSchedule.scheduleType,
            startDate: fmtStart,
            endDate: fmtEnd,
            isPublic: (originalSchedule.isPublic === 'Y' || originalSchedule.isPublic === true || originalSchedule.public === 'Y' || originalSchedule.public === true),
            location: originalSchedule.location,
            recurrenceEndDate: (newRecurEnd !== undefined) ? newRecurEnd : originalSchedule.recurrenceEndDate
        };

        const res = await fetch(`${API_BASE}/schedule/${originalSchedule.scheduleId}`, {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || '일정 기간 단축 업데이트 실패');
        }
    }

    // 쪼개진 일정 생성 POST 호출 도우미
    async function createSplitSchedule(originalSchedule, start, end, newRecurEnd) {
        const fmtStart = start ? fmtLocalDateTime(new Date(start.replace(' ', 'T'))) : null;
        const fmtEnd = end ? fmtLocalDateTime(new Date(end.replace(' ', 'T'))) : null;

        const payload = {
            title: originalSchedule.title,
            description: originalSchedule.description,
            scheduleType: originalSchedule.scheduleType,
            startDate: fmtStart,
            endDate: fmtEnd,
            isPublic: (originalSchedule.isPublic === 'Y' || originalSchedule.isPublic === true || originalSchedule.public === 'Y' || originalSchedule.public === true),
            location: originalSchedule.location,
            recurrenceEndDate: (newRecurEnd !== undefined) ? newRecurEnd : originalSchedule.recurrenceEndDate
        };

        const res = await fetch(`${API_BASE}/schedule`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || '쪼개진 일정 생성 실패');
        }
    }
    /* ======================================================== */
    /* 선택한 날의 일정 전체/부분 삭제 기능 끝                    */
    /* ======================================================== */

    function openNewSchedule(dateKey) {
        if (!dateKey) {
            dateKey = selectedDateKey || new Date().toISOString().slice(0, 10);
        }
        openScheduleIframeModal(`/schedule/new?date=${dateKey}`);
    }

    function handleDateClick(dateKey) {
        if (selectedDateKey === dateKey) {
            selectedDateKey = null;
            syncUrlWithDateKey(null);
            document.querySelectorAll('.cal-day').forEach(el => el.classList.remove('selected-day'));
            const list = document.getElementById('selectedDateEventsList');
            const label = document.getElementById('selectedDateLabel');
            if (list) list.innerHTML = '';
            if (label) label.textContent = '날짜를 선택해주세요';
        } else {
            selectedDateKey = dateKey;
            syncUrlWithDateKey(dateKey);
            
            document.querySelectorAll('.cal-day').forEach(el => el.classList.remove('selected-day'));
            const currentEl = document.querySelector(`.cal-day[data-date="${dateKey}"]`);
            if (currentEl) {
                currentEl.classList.add('selected-day');
            }
            
            renderSelectedDateEvents(dateKey);
        }
    }

    function renderSelectedDateEvents(dateKey) {
        const label = document.getElementById('selectedDateLabel');
        const list = document.getElementById('selectedDateEventsList');
        if (!label || !list) return;

        const days = ['일', '월', '화', '수', '목', '금', '토'];
        const dateObj = new Date(dateKey);
        const dayOfWeek = days[dateObj.getDay()];
        const parts = dateKey.split('-');
        label.textContent = `${parts[0]}년 ${parseInt(parts[1], 10)}월 ${parseInt(parts[2], 10)}일 (${dayOfWeek}) 일정`;

        const dayEvents = schedulesByDate[dateKey] || [];
        if (dayEvents.length === 0) {
            list.innerHTML = `<div class="empty-notice" style="padding: 20px; font-weight: 700; color: #94A3B8;">등록된 일정이 없습니다.</div>`;
            return;
        }

        list.innerHTML = dayEvents.map(s => {
            const matches = currentSearchQuery && s.title.toLowerCase().includes(currentSearchQuery.toLowerCase());
            const searchClass = currentSearchQuery 
                ? (matches ? ' search-match' : ' search-mismatch') 
                : '';

            let timeText = '하루종일';
            if (s.startDate && s.endDate) {
                const isAllDay = (s.startDate.includes('T00:00') || s.startDate.includes(' 00:00')) && (s.endDate.includes('T23:59') || s.endDate.includes(' 23:59'));
                if (!isAllDay) {
                     const startT = s.startDate.includes('T') ? s.startDate.split('T')[1].slice(0, 5) : s.startDate.split(' ')[1].slice(0, 5);
                     const endT = s.endDate.includes('T') ? s.endDate.split('T')[1].slice(0, 5) : s.endDate.split(' ')[1].slice(0, 5);
                     timeText = `${startT} ~ ${endT}`;
                }
            }

            const isPub = (s.isPublic === true || s.isPublic === 'Y' || s.public === true || s.public === 'Y');
            const baseColor = window.personalCalendarColor || '#3B82F6';
            const borderColor = isPub ? baseColor : `color-mix(in srgb, ${baseColor} 50%, white)`;

            const visibilityBadge = isPub 
                ? `<span style="font-size:10px; display:inline-block; width:50px; text-align:center; padding:3px 0; background:${borderColor}; color:#1e293b; font-weight:800; border-radius:4px; margin-right:8px; flex-shrink:0;">공개</span>`
                : `<span style="font-size:10px; display:inline-block; width:50px; text-align:center; padding:3px 0; background:${borderColor}; color:#1e293b; font-weight:800; border-radius:4px; margin-right:8px; flex-shrink:0;">비공개</span>`;

            return `
                <div class="selected-event-item${searchClass}" style="cursor: pointer; border: 1px solid ${borderColor}; border-left: 5px solid ${borderColor}; background: #ffffff; border-radius: 6px; padding: 8px 12px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;" onclick="openSchedule(${s.scheduleId}, '${dateKey}')">
                    <div style="display: flex; align-items: center; flex: 1; min-width: 0;">
                        ${visibilityBadge}
                        <span class="selected-event-title" style="font-weight: 700; color: #1E293B; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(s.title)}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:12px;">
                        <span class="selected-event-time" style="font-size: 12px; color: #64748B; font-weight: 600; white-space: nowrap;">${timeText}</span>
                        <div style="display:flex; gap:4px;">
                            <button class="btn-edit" onclick="event.stopPropagation(); openScheduleModify(${s.scheduleId}, '${dateKey}')">수정</button>
                            <button class="btn-delete" onclick="event.stopPropagation(); deleteSingleSchedule(${s.scheduleId}, '${escapeHtml(s.title).replace(/'/g, "\\'")}', '${dateKey}')">삭제</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    async function performSearch() {
        const input = document.getElementById('scheduleSearchInput');
        if (!input) return;
        
        const q = input.value.trim();
        if (!q) {
            clearSearch();
            return;
        }
        
        currentSearchQuery = q;
        const clearBtn = document.getElementById('searchClearBtn');
        clearBtn.style.display = 'inline-block';
        const searchBtn = document.getElementById('searchBtn');
        if (searchBtn) searchBtn.style.display = 'none';
        
        try {
            const currentYear = new Date().getFullYear();
            const startLimit = `${currentYear - 10}-01-01T00:00:00`;
            const endLimit = `${currentYear + 10}-12-31T23:59:59`;
            const url = `${API_BASE}/schedule?start=${encodeURIComponent(startLimit)}&end=${encodeURIComponent(endLimit)}`;
            
            const res = await fetch(url, { headers: authHeaders() });
            if (!res.ok) {
                showToast('검색 중 일정 조회 실패: ' + res.status, true);
                return;
            }
            const allSchedules = await res.json();
            
            searchMatches = allSchedules.filter(s => s.title && s.title.toLowerCase().includes(q.toLowerCase()))
                                        .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
            
            if (searchMatches.length === 0) {
                showToast('검색 결과와 일치하는 일정이 없습니다.', false);
                document.getElementById('searchPrevBtn').style.display = 'none';
                document.getElementById('searchNextBtn').style.display = 'none';
                renderCalendar();
                if (selectedDateKey) {
                    renderSelectedDateEvents(selectedDateKey);
                }
                return;
            }

            document.getElementById('searchPrevBtn').style.display = 'inline-block';
            document.getElementById('searchNextBtn').style.display = 'inline-block';

            const today = new Date();
            let closestIndex = 0;
            let minDiff = Infinity;

            searchMatches.forEach((s, idx) => {
                if (!s.startDate) return;
                const d = new Date(s.startDate);
                const diff = Math.abs(d.getTime() - today.getTime());
                if (diff < minDiff) {
                    minDiff = diff;
                    closestIndex = idx;
                }
            });

            searchMatchIndex = closestIndex;
            const targetSchedule = searchMatches[searchMatchIndex];
            const targetDate = new Date(targetSchedule.startDate);
            const padStr = (n) => String(n).padStart(2, '0');
            const targetDateKey = `${targetDate.getFullYear()}-${padStr(targetDate.getMonth()+1)}-${padStr(targetDate.getDate())}`;

            const isInCurrentMonth = targetDate.getFullYear() === viewYear && targetDate.getMonth() === viewMonth;
            selectedDateKey = targetDateKey;

            if (!isInCurrentMonth) {
                viewYear = targetDate.getFullYear();
                viewMonth = targetDate.getMonth();
                await loadMonthSchedules();
                highlightDate(targetDateKey);
            } else {
                renderCalendar();
                highlightDate(targetDateKey);
                renderSelectedDateEvents(targetDateKey);
            }
            
            showToast(`[${searchMatchIndex + 1}/${searchMatches.length}] 번째 매칭 일정으로 이동했습니다.`, false);
        } catch (e) {
            console.error(e);
            showToast('검색 요청 중 오류가 발생했습니다: ' + e.message, true);
        }
    }

    async function goToNextMatch() {
        if (searchMatches.length === 0 || searchMatchIndex === -1) return;

        if (searchMatchIndex >= searchMatches.length - 1) {
            showToast('더 이상 다음 검색 결과가 없습니다.', false);
            return;
        }

        searchMatchIndex++;
        const targetSchedule = searchMatches[searchMatchIndex];
        if (!targetSchedule || !targetSchedule.startDate) return;

        const targetDate = new Date(targetSchedule.startDate);
        const padStr = (n) => String(n).padStart(2, '0');
        const targetDateKey = `${targetDate.getFullYear()}-${padStr(targetDate.getMonth()+1)}-${padStr(targetDate.getDate())}`;

        const isInCurrentMonth = targetDate.getFullYear() === viewYear && targetDate.getMonth() === viewMonth;
        selectedDateKey = targetDateKey;

        if (!isInCurrentMonth) {
            viewYear = targetDate.getFullYear();
            viewMonth = targetDate.getMonth();
            await loadMonthSchedules();
            highlightDate(targetDateKey);
        } else {
            renderCalendar();
            highlightDate(targetDateKey);
            renderSelectedDateEvents(targetDateKey);
        }

        showToast(`[${searchMatchIndex + 1}/${searchMatches.length}] 번째 매칭 일정으로 이동했습니다.`, false);
    }

    async function goToPrevMatch() {
        if (searchMatches.length === 0 || searchMatchIndex === -1) return;

        if (searchMatchIndex <= 0) {
            showToast('더 이상 이전 검색 결과가 없습니다.', false);
            return;
        }

        searchMatchIndex--;
        const targetSchedule = searchMatches[searchMatchIndex];
        if (!targetSchedule || !targetSchedule.startDate) return;

        const targetDate = new Date(targetSchedule.startDate);
        const padStr = (n) => String(n).padStart(2, '0');
        const targetDateKey = `${targetDate.getFullYear()}-${padStr(targetDate.getMonth()+1)}-${padStr(targetDate.getDate())}`;

        const isInCurrentMonth = targetDate.getFullYear() === viewYear && targetDate.getMonth() === viewMonth;
        selectedDateKey = targetDateKey;

        if (!isInCurrentMonth) {
            viewYear = targetDate.getFullYear();
            viewMonth = targetDate.getMonth();
            await loadMonthSchedules();
            highlightDate(targetDateKey);
        } else {
            renderCalendar();
            highlightDate(targetDateKey);
            renderSelectedDateEvents(targetDateKey);
        }

        showToast(`[${searchMatchIndex + 1}/${searchMatches.length}] 번째 매칭 일정으로 이동했습니다.`, false);
    }

    function clearSearch() {
        const input = document.getElementById('scheduleSearchInput');
        if (input) input.value = '';
        currentSearchQuery = '';
        searchMatches = [];
        searchMatchIndex = -1;
        
        document.getElementById('searchClearBtn').style.display = 'none';
        document.getElementById('searchPrevBtn').style.display = 'none';
        document.getElementById('searchNextBtn').style.display = 'none';
        const searchBtn = document.getElementById('searchBtn');
        if (searchBtn) searchBtn.style.display = 'inline-block';
        renderCalendar();
        if (selectedDateKey) {
            renderSelectedDateEvents(selectedDateKey);
        }
    }

    function handleSearchKeyup(event) {
        if (event.key === 'Enter') {
            performSearch();
        }
    }

    function openSchedule(scheduleId, dateKey) {
        openScheduleIframeModal(`/schedule/${scheduleId}?date=${dateKey}`);
    }

    function openScheduleModify(scheduleId, dateKey) {
        openScheduleIframeModal(`/schedule/${scheduleId}/edit?date=${dateKey}`);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    }

    // 초기화
    (function init() {
        const params = new URLSearchParams(window.location.search);
        const dateParam = params.get('date'); // 등록/수정 완료 후 넘어온 날짜 (YYYY-MM-DD)

        const base = dateParam ? new Date(dateParam) : new Date();
        viewYear = base.getFullYear();
        viewMonth = base.getMonth();

        const padStr = (n) => String(n).padStart(2, '0');
        selectedDateKey = dateParam || `${base.getFullYear()}-${padStr(base.getMonth()+1)}-${padStr(base.getDate())}`;

        if (checkAuth()) {
            fetch('/members/me', { headers: authHeaders() })
                .then(r => r.json())
                .then(data => {
                    window.personalCalendarColor = data.calendarColor || '#3B82F6';
                    renderPersonalGuide();
                    renderCalendar();
                    renderSelectedDateEvents(selectedDateKey);
                }).catch(e => console.error('Failed to load user color:', e));
                
            loadGoogleSyncStatus();
            loadMonthSchedules().then(() => {
                if (dateParam) highlightDate(dateParam);
                renderSelectedDateEvents(selectedDateKey);
            });

            // 다른 페이지에서 [결과 확인]을 눌러 리다이렉트되어 온 경우
            if (params.get('showAiResult') === 'true') {
                const showModalFn = () => {
                    const cachedDataStr = localStorage.getItem('ps_ai_cached_result');
                    if (cachedDataStr) {
                        try {
                            const resultData = JSON.parse(cachedDataStr);
                            aiCachedResultData = resultData;

                            const modal = document.getElementById('aiImageModal');
                            if (modal) {
                                modal.style.display = 'flex';
                                document.getElementById('aiUploadStep').style.display = 'none';
                                document.getElementById('aiLoadingStep').style.display = 'none';
                                displayAnalysisResult(aiCachedResultData);
                            }
                        } catch (e) {
                            console.error("AI 모달 복구 에러:", e);
                            if (typeof clearAiStorage === 'function') clearAiStorage();
                        }
                    }
                };

                if (document.readyState === 'loading') {
                    window.addEventListener('DOMContentLoaded', showModalFn);
                } else {
                    showModalFn();
                }
            }
        }
    })();

    function highlightDate(dateKey) {
        const el = document.querySelector(`.cal-day[data-date="${dateKey}"]`);
        if (!el) return;
        el.classList.add('just-added');
        setTimeout(() => el.classList.remove('just-added'), 2500);
    }

    // ===== AI 이미지 일정 분석 모달 연동 스크립트 =====
    let aiSelectedFile = null;
    let aiCachedResultData = null;

    function openAiImageModal() {
        if (!token) {
            showToast('로그인이 필요합니다. 먼저 로그인 해주세요.', true);
            return;
        }
        const modal = document.getElementById('aiImageModal');
        modal.style.display = 'flex';
        modal.setAttribute('tabindex', '-1');
        modal.focus();
        resetStep();
    }

    function closeAiImageModal() {
        document.getElementById('aiImageModal').style.display = 'none';
    }

    async function discardAiImageAnalysis() {
        let requestId = document.getElementById('aiRequestId') ? document.getElementById('aiRequestId').value : null;
        if (!requestId) {
            requestId = localStorage.getItem('ps_ai_request_id');
        }

        // 1) 즉시 취소 상태 플래그 할당 (백그라운드 로딩 루프 취소 감지용)
        localStorage.setItem('ps_ai_status', 'CANCELLED');

        // 팝업 숨기기 및 기본 상태 초기화 선제 수행
        closeAiImageModal();
        if (typeof clearFileSelect === 'function') clearFileSelect();
        if (typeof resetStep === 'function') resetStep();

        if (!requestId) {
            if (typeof clearAiStorage === 'function') clearAiStorage();
            return;
        }

        if (typeof clearAiStorage === 'function') clearAiStorage();

        try {
            const res = await fetch(`${API_BASE}/ai-image-schedule/${requestId}`, {
                method: 'DELETE',
                headers: authHeaders()
            });
            if (res.ok) {
                console.log(`[AI-Clean] Discarded temp request #${requestId} and physical image.`);
            }
        } catch (e) {
            console.error('[AI-Clean] Discard failed:', e);
        }
    }

    function resetStep() {
        document.getElementById('aiUploadStep').style.display = 'block';
        document.getElementById('aiLoadingStep').style.display = 'none';
        document.getElementById('aiResultStep').style.display = 'none';
        clearFileSelect();
        document.getElementById('aiPromptType').value = '예시';
        document.getElementById('aiPromptText').value = '이 이미지를 분석해서 캘린더에 추가해줘';
        onPromptTypeChange();

        // 상태 초기화: 처음으로 돌아가면 이전 작업 상태를 완전히 지웁니다.
        if (typeof window.clearAiStorage === 'function') {
            window.clearAiStorage();
            if (typeof window.closeAiWidget === 'function') {
                window.closeAiWidget();
            }
        }
    }

    function onPromptTypeChange() {
        const type = document.getElementById('aiPromptType').value;
        const presets = document.getElementById('aiPromptPresets');
        const promptText = document.getElementById('aiPromptText');
        if (type === '예시') {
            presets.style.display = 'flex';
            promptText.readOnly = true;
            promptText.style.background = '#F8FAFC';
            promptText.style.color = '#000000';
        } else {
            presets.style.display = 'none';
            promptText.readOnly = false;
            promptText.style.background = '#FFFFFF';
            promptText.style.color = '#334155';
        }
    }

    function applyPreset(text) {
        document.getElementById('aiPromptText').value = text;
    }

    function triggerFileInput() {
        document.getElementById('aiImageFileInput').click();
    }

    function handleDragOver(e) {
        e.preventDefault();
        document.getElementById('dropzone').style.borderColor = '#6366F1';
        document.getElementById('dropzone').style.background = '#EEF2F6';
    }

    function handleDragLeave(e) {
        e.preventDefault();
        document.getElementById('dropzone').style.borderColor = '#CBD5E1';
        document.getElementById('dropzone').style.background = '#F8FAFC';
    }

    function handleDrop(e) {
        e.preventDefault();
        handleDragLeave(e);
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            setFile(files[0]);
        }
    }

    function handleFileSelect(e) {
        const files = e.target.files;
        if (files.length > 0) {
            setFile(files[0]);
        }
    }

    function setFile(file) {
        if (!file.type.startsWith('image/')) {
            showToast('맞지 않는 형식입니다.', true);
            return;
        }
        aiSelectedFile = file;
        document.getElementById('uploadText').innerText = file.name;
        document.getElementById('uploadIcon').innerText = '🖼️';

        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('aiImagePreview').src = e.target.result;
            document.getElementById('aiImagePreviewContainer').style.display = 'block';
        }
        reader.readAsDataURL(file);
    }

    function clearFileSelect() {
        aiSelectedFile = null;
        document.getElementById('aiImageFileInput').value = '';
        document.getElementById('uploadText').innerText = '이미지 파일을 드래그 앤 드롭하거나 클릭하여 선택하세요.';
        document.getElementById('uploadIcon').innerText = '📁';
        document.getElementById('aiImagePreviewContainer').style.display = 'none';
        document.getElementById('aiImagePreview').src = '';
    }

    async function submitAiAnalysis() {
        if (!aiSelectedFile) {
            showToast('분석할 이미지 파일을 선택해 주세요.', true);
            return;
        }

        const promptType = document.getElementById('aiPromptType').value;
        const promptText = document.getElementById('aiPromptText').value.trim();

        // 모달창을 즉시 닫고, 다른 작업을 하실 수 있도록 백그라운드로 돌립니다.
        closeAiImageModal();

        // 1) 우선 로컬 스토리지 상태를 'PROCESSING'으로 세팅하고 위젯을 공통 호출로 가동합니다.
        localStorage.setItem('ps_ai_status', 'PROCESSING');
        localStorage.removeItem('ps_ai_cached_result');
        localStorage.removeItem('ps_ai_fail_reason');
        
        if (typeof checkAndRecoverAiBackgroundProcess === 'function') {
            checkAndRecoverAiBackgroundProcess();
        }

        const formData = new FormData();
        formData.append('image', aiSelectedFile);
        formData.append('promptType', promptType);
        formData.append('promptText', promptText);

        // 비동기 백그라운드 통신 기동
        (async () => {
            try {
                // A. 이미지 업로드 API 호출
                const uploadRes = await fetch(`${API_BASE}/ai-image-schedule`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });

                if (!uploadRes.ok) {
                    const err = await uploadRes.json();
                    throw new Error(err.message || '업로드 실패');
                }

                const uploadData = await uploadRes.json();
                const requestId = uploadData.id;

                if (localStorage.getItem('ps_ai_status') === 'CANCELLED') {
                    await fetch(`${API_BASE}/ai-image-schedule/${requestId}`, {
                        method: 'DELETE',
                        headers: authHeaders()
                    });
                    console.log(`[AI-Cancel-Guard] Cleaned up request #${requestId} on early cancel.`);
                    return;
                }

                localStorage.setItem('ps_ai_request_id', requestId);

                if (typeof checkAndRecoverAiBackgroundProcess === 'function') {
                    checkAndRecoverAiBackgroundProcess();
                }

                if (localStorage.getItem('ps_ai_status') === 'CANCELLED') {
                    await fetch(`${API_BASE}/ai-image-schedule/${requestId}`, {
                        method: 'DELETE',
                        headers: authHeaders()
                    });
                    return;
                }

                const analyzeRes = await fetch(`${API_BASE}/ai-image-schedule/${requestId}/analyze`, {
                    method: 'POST',
                    headers: authHeaders()
                });

                if (!analyzeRes.ok) {
                    throw new Error('AI 분석 도중 에러가 발생했습니다.');
                }

                const resultData = await analyzeRes.json();

                if (localStorage.getItem('ps_ai_status') === 'CANCELLED') {
                    await fetch(`${API_BASE}/ai-image-schedule/${requestId}`, {
                        method: 'DELETE',
                        headers: authHeaders()
                    });
                    return;
                }

                if (resultData.status === 'FAILED') {
                    throw new Error(resultData.failReason || 'AI 분석이 실패했습니다.');
                }

                // E. 캐시 세팅 및 완료 처리
                localStorage.setItem('ps_ai_status', 'COMPLETED');
                localStorage.setItem('ps_ai_cached_result', JSON.stringify(resultData));
                aiCachedResultData = resultData;

                // 공통 헤더 위젯 UI 업데이트 유도
                if (typeof checkAndRecoverAiBackgroundProcess === 'function') {
                    checkAndRecoverAiBackgroundProcess();
                }

            } catch (e) {
                console.error(e);
                localStorage.setItem('ps_ai_status', 'FAILED');
                localStorage.setItem('ps_ai_fail_reason', e.message);
                if (typeof checkAndRecoverAiBackgroundProcess === 'function') {
                    checkAndRecoverAiBackgroundProcess();
                }
            }
        })();
    }

    let currentExtractedList = [];

    function parseExtractedDateRange(dateRangeStr) {
        if (!dateRangeStr) {
            const today = new Date().toISOString().slice(0, 10);
            return { startD: today, endD: today };
        }
        const clean = dateRangeStr.trim();
        let parts = [];
        if (clean.includes(' to ')) {
            parts = clean.split(' to ');
        } else if (clean.includes(' ~ ')) {
            parts = clean.split(' ~ ');
        } else {
            parts = [clean];
        }
        const startD = parts[0] || new Date().toISOString().slice(0, 10);
        const endD = parts[1] || startD;
        return { startD, endD };
    }

    function displayAnalysisResult(data) {
        document.getElementById('aiLoadingStep').style.display = 'none';
        document.getElementById('aiResultStep').style.display = 'block';

        document.getElementById('aiRequestId').value = data.id;
        document.getElementById('aiConfidenceBadge').innerText = `신뢰도: ${data.confidenceScore ? data.confidenceScore.toFixed(2) : '95.00'}%`;
        
        currentExtractedList = data.extractedSchedules || [];
        document.getElementById('aiResultSummaryText').innerText = `AI 일정 추출 완료 (${currentExtractedList.length}건)`;

        const container = document.getElementById('aiSchedulesContainer');
        container.innerHTML = '';

        if (currentExtractedList.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding: 20px; color:#64748B; font-size:13px;">추출된 일정이 없습니다.</div>';
            return;
        }

        currentExtractedList.forEach((item, index) => {
            const card = document.createElement('div');
            card.className = 'ai-schedule-card';
            card.style = 'background: white; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); text-align: left;';
            
            const startDVal = item.startDate ? item.startDate.slice(0, 10) : '';
            const endDVal = item.endDate ? item.endDate.slice(0, 10) : startDVal;
            const startTVal = item.startDate && item.startDate.includes('T') ? item.startDate.split('T')[1].slice(0, 5) : '09:00';
            const endTVal = item.endDate && item.endDate.includes('T') ? item.endDate.split('T')[1].slice(0, 5) : '10:00';

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 11px; font-weight: 800; color: #6366F1; background: #EEF2F6; padding: 2px 6px; border-radius: 4px;">일정 #${index + 1}</span>
                    <button style="background:none; border:0; color:#EF4444; font-size:12px; font-weight:bold; cursor:pointer;" onclick="removeExtractedItem(${index})">삭제</button>
                </div>
                <div>
                    <input type="text" placeholder="일정 제목" class="ai-item-title" value="${escapeHtml(item.title)}" style="width: 100%; padding: 6px 10px; border: 1px solid #CBD5E1; border-radius: 6px; font-size: 13px; font-weight: 700; color: #334155; box-sizing: border-box;">
                </div>
                <div>
                    <input type="text" placeholder="일정 설명 (상세 내용)" class="ai-item-description" value="${escapeHtml(item.description || '')}" style="width: 100%; padding: 6px 10px; border: 1px solid #CBD5E1; border-radius: 6px; font-size: 12px; color: #475569; box-sizing: border-box;">
                </div>

                <div style="margin-bottom: 4px;">
                    <label style="font-size: 10px; font-weight: 800; color: #64748B; display:block; margin-bottom:2px;">일정 날짜 범위 *</label>
                    <input type="text" class="ai-item-date" id="ai-date-${index}" placeholder="날짜를 선택하세요" style="width: 100%; padding: 6px 10px; border: 1px solid #CBD5E1; border-radius: 6px; font-size: 12px; font-weight: 700; color: #334155; box-sizing: border-box; background: #fff;" required>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 4px;">
                    <div>
                        <label style="font-size: 10px; font-weight: 800; color: #64748B; display:block; margin-bottom:2px;">시작 시간</label>
                        <input type="time" class="ai-item-start-time" value="${startTVal}" step="900" style="width: 100%; padding: 6px 10px; border: 1px solid #CBD5E1; border-radius: 6px; font-size: 12px; font-weight: 700; color: #334155; box-sizing: border-box; background: #fff;">
                    </div>
                    <div>
                        <label style="font-size: 10px; font-weight: 800; color: #64748B; display:block; margin-bottom:2px;">종료 시간</label>
                        <input type="time" class="ai-item-end-time" value="${endTVal}" step="900" style="width: 100%; padding: 6px 10px; border: 1px solid #CBD5E1; border-radius: 6px; font-size: 12px; font-weight: 700; color: #334155; box-sizing: border-box; background: #fff;">
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 8px;">
                    <input type="text" placeholder="장소 (선택)" class="ai-item-location" value="${escapeHtml(item.location)}" style="width: 100%; padding: 6px 10px; border: 1px solid #CBD5E1; border-radius: 6px; font-size: 12px; font-weight: 700; color: #334155; box-sizing: border-box;">
                    <select class="ai-item-type" style="width: 100%; padding: 6px 10px; border: 1px solid #CBD5E1; border-radius: 6px; font-size: 12px; font-weight: 700; color: #334155; box-sizing: border-box;">
                        <option value="DAILY">단일 일정</option>
                        <option value="WEEKLY">주간 반복</option>
                        <option value="MONTHLY">월간 반복</option>
                    </select>
                </div>
            `;
            container.appendChild(card);

            flatpickr(`#ai-date-${index}`, {
                mode: "range",
                locale: "ko",
                dateFormat: "Y-m-d",
                defaultDate: startDVal ? [startDVal, endDVal] : []
            });
        });
    }

    function removeExtractedItem(index) {
        syncCurrentExtractedList();
        currentExtractedList.splice(index, 1);
        displayAnalysisResult({
            id: document.getElementById('aiRequestId').value,
            confidenceScore: parseFloat(document.getElementById('aiConfidenceBadge').innerText.replace(/[^0-9.]/g, '')),
            extractedSchedules: currentExtractedList
        });
    }

    function syncCurrentExtractedList() {
        const container = document.getElementById('aiSchedulesContainer');
        const cards = container.querySelectorAll('.ai-schedule-card');
        
        currentExtractedList = [];
        cards.forEach((card, index) => {
            const title = card.querySelector('.ai-item-title').value.trim();
            const description = card.querySelector('.ai-item-description').value.trim();
            const dateRange = card.querySelector('.ai-item-date').value;
            const startTime = card.querySelector('.ai-item-start-time').value;
            const endTime = card.querySelector('.ai-item-end-time').value;
            const location = card.querySelector('.ai-item-location').value.trim();
            
            const { startD, endD } = parseExtractedDateRange(dateRange);

            currentExtractedList.push({
                title: title,
                description: description,
                startDate: `${startD}T${startTime || '00:00'}:00`,
                endDate: `${endD}T${endTime || '00:00'}:00`,
                location: location || null
            });
        });
    }

            async function reAnalyze() {
        const requestId = document.getElementById('aiRequestId').value;
        // 재분석 시는 사용자가 입력한 요청사항을 최대한 보존하거나, 디폴트 값을 전달합니다.
        const promptText = document.getElementById('aiPromptText') ? document.getElementById('aiPromptText').value.trim() : "일정 재분석 요청";

        // 모달창을 즉시 닫고 처음 분석처럼 하단 백그라운드 진행 바를 띄웁니다.
        closeAiImageModal();

        localStorage.setItem('ps_ai_status', 'PROCESSING');
        localStorage.removeItem('ps_ai_cached_result');
        localStorage.removeItem('ps_ai_fail_reason');

        if (typeof checkAndRecoverAiBackgroundProcess === 'function') {
            checkAndRecoverAiBackgroundProcess();
        }

        // 비동기 백그라운드 재분석 기동
        (async () => {
            try {
                // 1) 프롬프트 업데이트 PATCH 호출 (백엔드 PATCH 메소드 내부에서 AI 분석까지 다이렉트 동기 처리 후 완본 리턴함)
                const patchRes = await fetch(`${API_BASE}/ai-image-schedule/${requestId}`, {
                    method: 'PATCH',
                    headers: {
                        ...authHeaders(),
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        promptText: promptText || "일정 재분석 요청",
                        promptType: '직접'
                    })
                });

                if (!patchRes.ok) {
                    throw new Error('재분석 프롬프트 수정 실패');
                }

                const resultData = await patchRes.json();

                if (resultData.status === 'FAILED') {
                    throw new Error(resultData.failReason || 'AI 재분석에 실패했습니다.');
                }

                // 2) 완료 처리 및 캐시 데이터 갱신
                localStorage.setItem('ps_ai_status', 'COMPLETED');
                localStorage.setItem('ps_ai_cached_result', JSON.stringify(resultData));
                aiCachedResultData = resultData;

                // 하단 백그라운드 진행 바 완료 위젯 UI 업데이트
                if (typeof checkAndRecoverAiBackgroundProcess === 'function') {
                    checkAndRecoverAiBackgroundProcess();
                }

            } catch (e) {
                console.error(e);
                localStorage.setItem('ps_ai_status', 'FAILED');
                localStorage.setItem('ps_ai_fail_reason', e.message);
                if (typeof checkAndRecoverAiBackgroundProcess === 'function') {
                    checkAndRecoverAiBackgroundProcess();
                }
            }
        })();
    }

    async function confirmSchedule() {
        const confirmBtn = document.getElementById('aiConfirmBtn');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.innerText = '⏳ 등록 처리 중...';
            confirmBtn.style.opacity = '0.6';
            confirmBtn.style.pointerEvents = 'none';
        }

        const restoreBtn = () => {
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.innerText = '📅 캘린더 등록 확정';
                confirmBtn.style.opacity = '1';
                confirmBtn.style.pointerEvents = 'auto';
            }
        };

        let requestId = document.getElementById('aiRequestId').value;
        if (!requestId) {
            requestId = localStorage.getItem('ps_ai_request_id');
        }
        if (!requestId) {
            showToast('AI 분석 요청 ID가 유효하지 않습니다. 새로고침 후 다시 시도해 주세요.', true);
            restoreBtn();
            return;
        }
        const container = document.getElementById('aiSchedulesContainer');
        const cards = container.querySelectorAll('.ai-schedule-card');
        
        if (cards.length === 0) {
            showToast('등록할 일정이 없습니다.', true);
            restoreBtn();
            return;
        }

        const confirmRequests = [];
        let hasError = false;

        cards.forEach((card, index) => {
            const title = card.querySelector('.ai-item-title').value.trim();
            const dateRange = card.querySelector('.ai-item-date').value;
            const startTime = card.querySelector('.ai-item-start-time').value;
            const endTime = card.querySelector('.ai-item-end-time').value;
            const location = card.querySelector('.ai-item-location').value.trim();
            const type = card.querySelector('.ai-item-type').value;

            if (!title) {
                showToast(`일정 #${index + 1}의 제목은 필수입니다.`, true);
                hasError = true;
                return;
            }
            if (!dateRange) {
                showToast(`일정 #${index + 1}의 날짜는 필수입니다.`, true);
                hasError = true;
                return;
            }

            const { startD, endD } = parseExtractedDateRange(dateRange);

            const description = card.querySelector('.ai-item-description')
                ? card.querySelector('.ai-item-description').value.trim()
                : "AI 이미지 분석 등록";

            confirmRequests.push({
                title: title,
                description: description || "AI 이미지 분석 등록",
                scheduleType: type,
                startDate: `${startD}T${startTime || '00:00'}:00`,
                endDate: `${endD}T${endTime || '00:00'}:00`,
                location: location || null,
                isPublic: false
            });
        });

        if (hasError) {
            restoreBtn();
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/ai-image-schedule/${requestId}/confirm`, {
                method: 'POST',
                headers: {
                    ...authHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(confirmRequests)
            });

            if (!res.ok) {
                const errDetail = await res.json().catch(() => ({}));
                throw new Error(errDetail.message || '캘린더 등록에 실패했습니다.');
            }

            showToast(`🎉 총 ${confirmRequests.length}개의 일정이 성공적으로 개인 캘린더에 추가되었습니다!`);
            closeAiImageModal();
            if (typeof clearFileSelect === 'function') clearFileSelect();
            if (typeof resetStep === 'function') resetStep();
            if (typeof clearAiStorage === 'function') clearAiStorage();
            
            if (typeof loadMonthSchedules === 'function') {
                await loadMonthSchedules();
            } else {
                location.reload();
            }

        } catch (e) {
            console.error(e);
            showToast('확정 등록 오류: ' + e.message, true);
            restoreBtn();
        }
    }
    function getDateOnly(dateStr) {
        if (!dateStr) return '';
        if (dateStr.includes('T')) {
            return dateStr.split('T')[0];
        }
        if (dateStr.includes(' ')) {
            return dateStr.split(' ')[0];
        }
        return dateStr.slice(0, 10);
    }
    /* ======================================================== */
    /* iframe 기반 하위 페이지 모달 조작 및 부모-자식 브릿지 로직  */
    /* ======================================================== */
    window.openScheduleIframeModal = function(url) {
        const modal = document.getElementById('scheduleIframeModal');
        const iframe = document.getElementById('scheduleIframe');
        const container = document.getElementById('scheduleIframeContainer');
        if (modal && iframe && container) {
            // iframe 로드 완료 후 실제 콘텐츠 높이에 맞춰 모달 크기 자동 조절
            iframe.onload = function() {
                try {
                    const doc = iframe.contentDocument || iframe.contentWindow.document;
                    // 콘텐츠 실제 높이 + 여유분
                    const contentHeight = doc.documentElement.scrollHeight + 40;
                    const maxH = window.innerHeight * 0.96; // 화면의 92%까지만
                    container.style.height = Math.min(contentHeight, maxH) + 'px';
                } catch(e) {
                    // cross-origin 등 에러 시 기본값
                    container.style.height = '700px';
                }
                
                // 포커스 강제 설정으로 ESC 키 작동 보장
                setTimeout(() => {
                    iframe.focus();
                    if (iframe.contentWindow) {
                        iframe.contentWindow.focus();
                    }
                }, 50);
            };
            container.style.height = '0px'; // 로드 전 숨기기
            iframe.src = url;
            modal.style.display = 'flex';
            
            modal.setAttribute('tabindex', '-1');
            modal.focus();
        }
    };

    window.adjustScheduleIframeHeight = function() {
        const modal = document.getElementById('scheduleIframeModal');
        const iframe = document.getElementById('scheduleIframe');
        const container = document.getElementById('scheduleIframeContainer');
        if (modal && iframe && container && modal.style.display !== 'none') {
            try {
                const doc = iframe.contentDocument || iframe.contentWindow.document;
                
                // 1. transition 임시 해제 (transition 작동 중에는 scrollHeight 측정 오류 발생)
                const origTransition = container.style.transition;
                container.style.transition = 'none';
                
                // 2. 높이 일시 축소
                container.style.height = '100px'; 
                
                // 3. 실제 필요 높이 측정
                const contentHeight = doc.documentElement.scrollHeight + 32;
                const maxH = window.innerHeight * 0.96;
                const targetHeight = Math.min(contentHeight, maxH) + 'px';
                
                // 4. 새로운 높이 바로 대입
                container.style.height = targetHeight;
                
                // 5. reflow 강제 유발하여 즉시 반영되도록 함
                container.offsetHeight; 
                
                // 6. transition 원복
                container.style.transition = origTransition;
            } catch(e) {
                console.error("높이 재조정 실패:", e);
            }
        }
    };

    window.closeScheduleIframeModal = function() {
        const modal = document.getElementById('scheduleIframeModal');
        const iframe = document.getElementById('scheduleIframe');
        if (modal && iframe) {
            iframe.src = '';
            modal.style.display = 'none';
            // 포커스를 즉시 부모 윈도우/바디로 가져와서 ESC 등 키 감지 상태 복원
            window.focus();
            document.body.focus();
        }
    };

    // 하위 페이지에서 등록/수정/삭제 완료 시 부모 창을 닫고 캘린더를 리프레시하기 위한 브릿지 API
    window.closeScheduleModalAndReload = function(dateKey) {
        closeScheduleIframeModal();
        if (dateKey) {
            selectedDateKey = dateKey;
            syncUrlWithDateKey(dateKey);
            
            document.querySelectorAll('.cal-day').forEach(el => el.classList.remove('selected-day'));
            const currentEl = document.querySelector(`.cal-day[data-date="${dateKey}"]`);
            if (currentEl) {
                currentEl.classList.add('selected-day');
            }
            
            loadMonthSchedules().then(() => {
                highlightDate(dateKey);
                renderSelectedDateEvents(dateKey);
            });
        } else {
            loadMonthSchedules();
        }
    };

    window.deleteSingleSchedule = async function(scheduleId, title, targetDate) {
        try {
            const res = await fetch(`${API_BASE}/schedule/${scheduleId}`, { headers: authHeaders() });
            if (!res.ok) {
                showToast('일정 정보 조회 실패', true);
                return;
            }
            const s = await res.json();
            const startDateStr = getDateOnly(s.startDate);
            const endDateStr = s.endDate ? getDateOnly(s.endDate) : startDateStr;
            const isMultiDay = startDateStr !== endDateStr;
            const isRecurrent = s.scheduleType && s.scheduleType !== 'DAILY';

            const btnGroup = document.getElementById('deleteModalBtnGroup');

            // 연속/반복 일정이든 일반 일정이든 가로 2버튼 모달창으로 무조건 통일하여 노출시킵니다!
            document.querySelector('#deleteConfirmModal h3').textContent = '일정 삭제 확인';
            document.getElementById('deleteConfirmModalMsg').innerHTML = 
                `⚠️ 정말로 '${escapeHtml(title)}' 일정을 삭제하시겠습니까?`;
            
            btnGroup.style.flexDirection = 'row';
            btnGroup.innerHTML = `
                <button class="ghost" onclick="closeDeleteConfirmModal()" style="flex: 1; padding: 12px; font-size: 13.5px; border-radius: 10px; border: 2px solid #E2E8F0; background: white; color: #475569; font-weight: bold; cursor: pointer;">
                    취소
                </button>
                <button id="deleteAllBtn" class="primary" style="flex: 1; padding: 12px; font-size: 13.5px; border-radius: 10px; border: 0; background: #EF4444; color: white; font-weight: bold; cursor: pointer;">
                    🗑️ 일정 삭제 확정
                </button>
            `;

            document.getElementById('deleteAllBtn').onclick = async () => {
                closeDeleteConfirmModal();

                if ((isMultiDay || isRecurrent) && targetDate) {
                    // 연속/반복 일정이면 당일 쪼개기(단축) 삭감 API 실행
                    showToast('일정 단축 처리 중...');
                    try {
                        if (isRecurrent) {
                            const recurEndStr = s.recurrenceEndDate || null;
                            if (targetDate === startDateStr) {
                                const nextStart = getNextRecurrentDate(s.startDate, s.scheduleType);
                                const nextStartStr = fmtLocalDateTime(nextStart);
                                let nextEndStr = null;
                                if (s.endDate) {
                                    const origStart = new Date(s.startDate.replace(' ', 'T'));
                                    const origEnd = new Date(s.endDate.replace(' ', 'T'));
                                    const diff = origEnd.getTime() - origStart.getTime();
                                    const nextEnd = new Date(nextStart.getTime() + diff);
                                    nextEndStr = fmtLocalDateTime(nextEnd);
                                }
                                await updateScheduleDates(s, nextStartStr, nextEndStr, s.recurrenceEndDate);
                            } else if (recurEndStr && targetDate === recurEndStr) {
                                const prevEnd = getPrevRecurrentDate(recurEndStr, s.scheduleType);
                                const prevEndStr = prevEnd.getFullYear() + '-' + String(prevEnd.getMonth()+1).padStart(2,'0') + '-' + String(prevEnd.getDate()).padStart(2,'0');
                                await updateScheduleDates(s, s.startDate, s.endDate, prevEndStr);
                            } else {
                                const prevEnd = getPrevRecurrentDate(targetDate, s.scheduleType);
                                const prevEndStr = prevEnd.getFullYear() + '-' + String(prevEnd.getMonth()+1).padStart(2,'0') + '-' + String(prevEnd.getDate()).padStart(2,'0');
                                await updateScheduleDates(s, s.startDate, s.endDate, prevEndStr);

                                const nextStart = getNextRecurrentDate(targetDate, s.scheduleType);
                                const nextStartStr = fmtLocalDateTime(nextStart);
                                let nextEndStr = null;
                                if (s.endDate) {
                                    const origStart = new Date(s.startDate.replace(' ', 'T'));
                                    const origEnd = new Date(s.endDate.replace(' ', 'T'));
                                    const diff = origEnd.getTime() - origStart.getTime();
                                    const nextEnd = new Date(nextStart.getTime() + diff);
                                    nextEndStr = fmtLocalDateTime(nextEnd);
                                }
                                await createSplitSchedule(s, nextStartStr, nextEndStr, s.recurrenceEndDate);
                            }
                        } else if (isMultiDay) {
                            const startD = new Date(startDateStr);
                            const endD = new Date(endDateStr);
                            if (targetDate === startDateStr) {
                                startD.setDate(startD.getDate() + 1);
                                const newStartStr = fmtLocalDateTime(startD);
                                await updateScheduleDates(s, newStartStr, s.endDate, s.recurrenceEndDate);
                            } else if (targetDate === endDateStr) {
                                endD.setDate(endD.getDate() - 1);
                                const newEndStr = fmtLocalDateTime(endD);
                                await updateScheduleDates(s, s.startDate, newEndStr, s.recurrenceEndDate);
                            } else {
                                const frontEndD = new Date(targetDate);
                                frontEndD.setDate(frontEndD.getDate() - 1);
                                frontEndD.setHours(23, 59, 59, 0);
                                const frontEndStr = fmtLocalDateTime(frontEndD);
                                await updateScheduleDates(s, s.startDate, frontEndStr, s.recurrenceEndDate);

                                const backStartD = new Date(targetDate);
                                backStartD.setDate(backStartD.getDate() + 1);
                                backStartD.setHours(0, 0, 0, 0);
                                const backStartStr = fmtLocalDateTime(backStartD);
                                await createSplitSchedule(s, backStartStr, s.endDate, s.recurrenceEndDate);
                            }
                        }
                        showToast('일정이 성공적으로 단축 삭제되었습니다.');
                        if (window.closeScheduleIframeModal) closeScheduleIframeModal();
                        await loadMonthSchedules();
                        if (selectedDateKey) renderSelectedDateEvents(selectedDateKey);
                    } catch (err) {
                        console.error(err);
                        showToast('단축 삭제 중 오류 발생', true);
                    }
                } else {
                    // 단일 일정이면 단순 DELETE API 실행
                    showToast('일정을 삭제하는 중입니다...');
                    const delRes = await fetch(`${API_BASE}/schedule/${scheduleId}`, { method: 'DELETE', headers: authHeaders() });
                    if (delRes.ok) {
                        showToast('일정이 성공적으로 삭제되었습니다.');
                        if (window.closeScheduleIframeModal) closeScheduleIframeModal();
                        await loadMonthSchedules();
                        if (selectedDateKey) renderSelectedDateEvents(selectedDateKey);
                    } else {
                        showToast('삭제 실패', true);
                    }
                }
            };

            const modal = document.getElementById('deleteConfirmModal');
            modal.style.display = 'flex';
            modal.focus();
            // 삭제 선택 창을 띄우기 전에, 뒤에 있던 조회/수정 모달창을 닫아 깔끔하게 처리합니다.
            if (window.closeScheduleIframeModal) {
                closeScheduleIframeModal();
            }

            const delModal = document.getElementById('deleteConfirmModal');
            delModal.style.display = 'flex';
            delModal.setAttribute('tabindex', '-1');
            setTimeout(() => {
                const cancelBtn = delModal.querySelector('.ghost');
                if (cancelBtn) {
                    cancelBtn.focus();
                } else {
                    delModal.focus();
                }
            }, 60);
        } catch (e) {
            console.error(e);
            showToast('삭제 조회 중 오류 발생', true);
        }
    };

    // ESC 키 입력 시 모든 활성 모달 닫기
    function handleEscKey(event) {
        if (event.key === 'Escape' || event.key === 'Esc' || event.keyCode === 27) {
            // 1. 삭제 확인 모달 닫기 (최우선)
            const delModal = document.getElementById('deleteConfirmModal');
            if (delModal && delModal.style.display === 'flex') {
                if (typeof window.closeDeleteConfirmModal === 'function') {
                    window.closeDeleteConfirmModal();
                } else if (typeof closeDeleteConfirmModal === 'function') {
                    closeDeleteConfirmModal();
                }
                event.stopPropagation();
                event.preventDefault();
                return;
            }
            // 2. AI 이미지 모달 닫기
            const aiModal = document.getElementById('aiImageModal');
            if (aiModal && (aiModal.style.display === 'flex' || aiModal.classList.contains('open'))) {
                if (typeof closeAiImageModal === 'function') closeAiImageModal();
                event.stopPropagation();
                event.preventDefault();
                return;
            }
            // 3. iframe 일정 등록/수정/상세 모달 닫기
            const iframeModal = document.getElementById('scheduleIframeContainer');
            if (iframeModal && iframeModal.classList.contains('open')) {
                if (typeof closeScheduleIframeModal === 'function') closeScheduleIframeModal();
            }
        }
    }
    window.addEventListener('keydown', handleEscKey, true);
    window.addEventListener('keyup', handleEscKey, true);

    window.currentPersonalPaletteMode = null;
    function renderPersonalGuide() {
        const wrapper = document.getElementById('personalGuideWrapper');
        if (!wrapper) return;
        
        const myColor = window.personalCalendarColor || '#3B82F6';
        
        wrapper.innerHTML = `
            <span id="btnGuidePublic" style="cursor: pointer; display: inline-flex; align-items: center; gap: 4px; font-weight: 700; color: #f8fafc;">
                <span id="guidePublicDot" style="display:inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${myColor};"></span> 공개
            </span>
            <span id="btnGuidePrivate" style="cursor: pointer; display: inline-flex; align-items: center; gap: 4px; font-weight: 700; color: #f8fafc; margin-left: 8px;">
                <span id="guidePrivateDot" style="display:inline-block; width: 10px; height: 10px; border-radius: 50%; background: color-mix(in srgb, ${myColor} 50%, white);"></span> 비공개
            </span>
        `;
        
        const palette = document.getElementById('personalPaletteSection');
        const customPalette = document.getElementById('personalColorPaletteContainer');
        const paletteTitle = document.getElementById('personalPaletteTitle');
        
        if (!customPalette) return;
        
        const colors = ["#EF4444", "#F97316", "#F59E0B", "#10B981", "#6366F1", "#8B5CF6", "#D946EF", "#F43F5E", "#14B8A6", "#84CC16", "#059669", "#7C3AED", "#3B82F6", "#94A3B8"];
        customPalette.innerHTML = '';
        colors.forEach(c => {
            const circle = document.createElement('div');
            circle.style.width = '20px';
            circle.style.height = '20px';
            circle.style.borderRadius = '50%';
            circle.style.backgroundColor = c;
            circle.style.cursor = 'pointer';
            circle.style.border = '1px solid #CBD5E1';
            circle.title = '이 색상으로 변경';
            circle.onclick = async () => {
                try {
                    await fetch('/members/me/calendar-color', {
                        method: 'PATCH',
                        headers: Object.assign({'Content-Type': 'application/json'}, authHeaders()),
                        body: JSON.stringify({ calendarColor: c })
                    });
                    window.personalCalendarColor = c;
                    window.personalPublicColor = c;
                    window.personalPrivateColor = c;
                    
                    renderPersonalGuide();
                } catch(e) { console.error('DB 색상 동기화 실패:', e); }
                
                renderCalendar();
                if (selectedDateKey) {
                    renderSelectedDateEvents(selectedDateKey);
                }
                palette.style.display = 'none';
                window.currentPersonalPaletteMode = null;
            };
            customPalette.appendChild(circle);
        });
        
        const togglePalette = () => {
            if (palette.style.display === 'block') {
                palette.style.display = 'none';
            } else {
                palette.style.display = 'block';
                paletteTitle.textContent = '캘린더 테마 색상 선택';
            }
        };

        const btnPublic = document.getElementById('btnGuidePublic');
        const btnPrivate = document.getElementById('btnGuidePrivate');
        if (btnPublic) btnPublic.onclick = togglePalette;
        if (btnPrivate) btnPrivate.onclick = togglePalette;
    }
