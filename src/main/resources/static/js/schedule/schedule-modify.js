
    if (window.self !== window.top) {
    document.documentElement.classList.add('in-iframe');
}

    // iframe 내부 로드 시 공통 헤더 숨기기 및 레이아웃 최적화
    (function optimizeForIframe() {
        if (window.self !== window.top) {
            // 상단 헤더 요소 탐색 및 숨김
            const headers = document.querySelectorAll('header, .header, nav, .navbar, div[class*="header"]');
            headers.forEach(h => {
                h.style.setProperty('display', 'none', 'important');
            });
            
            // wrap 컨테이너 밀착 조율
            const wrap = document.querySelector('.wrap');
            if (wrap) {
                wrap.style.setProperty('padding', '0', 'important');
                wrap.style.setProperty('margin', '0 auto', 'important');
                wrap.style.setProperty('max-width', '100%', 'important');
            }
            
            // body 스타일 제거
            document.body.style.setProperty('background', 'transparent', 'important');
            document.body.style.setProperty('padding', '0', 'important');
            document.body.style.setProperty('margin', '0', 'important');
            
            // 패널 테두리와 그림자 제거하여 모달 컨테이너에 완전히 녹아들게 함
            const panels = document.querySelectorAll('.panel');
            panels.forEach(p => {
                p.style.setProperty('border', 'none', 'important');
                p.style.setProperty('box-shadow', 'none', 'important');
                p.style.setProperty('padding', '10px 20px', 'important');
                p.style.setProperty('margin', '0', 'important');
            });
        }
    })();

const API_BASE = window.location.origin;
    let token = '';
    let scheduleId = null;
    let originalStartDateOnly = '';
    let targetDateParam = '';

    function showToast(msg, isError) {
        const t = document.getElementById('iframeToast');
        const txt = document.getElementById('iframeToastText');
        if (t && txt) {
            txt.textContent = msg;
            t.style.display = 'flex';
            if (isError) {
                t.style.background = '#FEF2F2';
                t.style.borderColor = '#FCA5A5';
                t.style.color = '#991B1B';
            } else {
                t.style.background = '#F0FDF4';
                t.style.borderColor = '#BBF7D0';
                t.style.color = '#166534';
            }
            if (window.iframeToastTimer) clearTimeout(window.iframeToastTimer);
            window.iframeToastTimer = setTimeout(() => {
                t.style.display = 'none';
            }, 3000);
            return;
        }

        if (window.parent && typeof window.parent.showToast === 'function') {
            window.parent.showToast(msg, isError);
            return;
        }
        const ot = document.getElementById('toast');
        if (ot) {
            ot.textContent = msg;
            ot.className = 'toast show' + (isError ? ' error' : '');
            setTimeout(() => ot.classList.remove('show'), 2200);
        }
    }

    function updateDescCounter(el) {
        const max = 400;
        const len = el.value.length;
        const counter = document.getElementById('desc-counter');
        const warn = document.getElementById('desc-warn');
        if (counter) {
            counter.textContent = len + ' / ' + max;
            counter.style.color = len >= max ? '#EF4444' : '#94A3B8';
            counter.style.fontWeight = len >= max ? '800' : '500';
        }
        if (warn) warn.style.display = len >= max ? 'block' : 'none';
        if (len >= max) el.style.borderColor = '#FCA5A5';
        else el.style.borderColor = '';
    }

    function checkAuth() {
        token = localStorage.getItem('jwtToken') || '';
        const notice = document.getElementById('authNotice');
        const formPanel = document.getElementById('scheduleFormPanel');

        if (token) {
            notice.style.display = 'none';
            formPanel.style.display = '';
        } else {
            notice.style.display = '';
            formPanel.style.display = 'none';
        }
        return !!token;
    }

    function authHeaders() {
        return {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': 'Bearer ' + token
        };
    }

    let fpInstance = null;
    let deadlineFpInstance = null;
    let selectedStartHour = "09";
    let selectedStartMin = "00";
    let selectedEndHour = "10";
    let selectedEndMin = "00";

    function initFlatpickr(isRange = false) {
        if (fpInstance) {
            fpInstance.destroy();
        }

        const placeholderText = isRange ? "시작일과 종료일을 선택하세요" : "날짜를 선택하세요";
        const labelText = isRange ? "일정 기간 선택 *" : "일정 날짜 선택 *";

        document.getElementById('f-dateRange').placeholder = placeholderText;
        document.getElementById('dateRangeLabel').textContent = labelText;

        fpInstance = flatpickr("#f-dateRange", {
            mode: isRange ? "range" : "single",
            locale: "ko",
            dateFormat: "Y-m-d",
            onReady: function(selectedDates, dateStr, instance) {
                instance.calendarContainer.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    if (e.deltaY > 0) instance.changeMonth(1);
                    else if (e.deltaY < 0) instance.changeMonth(-1);
                }, { passive: false });
            },
            onChange: function() {
                updateDeadlineMax();
            }
        });

        flatpickr("#f-recurrenceEndDate", { locale: "ko", dateFormat: "Y-m-d" });
        deadlineFpInstance = flatpickr("#f-deadlineDate", {
            locale: "ko",
            dateFormat: "Y-m-d",
            onChange: function() {
                updateDeadlineNotificationCalc();
            }
        });
    }

    // 커스텀 시간 범위 관련 구현
    function renderTimeOptions() {
        const startList = document.getElementById('startTimeList');
        const endList = document.getElementById('endTimeList');
        if (!startList || !endList) return;

        startList.innerHTML = '';
        endList.innerHTML = '';

        for (let h = 0; h < 24; h++) {
            const hh = String(h).padStart(2, '0');
            ["00", "15", "30", "45"].forEach(mm => {
                const timeStr = `${hh}:${mm}`;

                // 시작 시간 항목
                const startItem = document.createElement('div');
                startItem.className = 'time-select-item' + (selectedStartHour === hh && selectedStartMin === mm ? ' active' : '');
                startItem.textContent = timeStr;
                startItem.onclick = () => selectTimeVal('start', hh, mm);
                startList.appendChild(startItem);

                // 종료 시간 항목
                const endItem = document.createElement('div');
                endItem.className = 'time-select-item' + (selectedEndHour === hh && selectedEndMin === mm ? ' active' : '');
                endItem.textContent = timeStr;
                endItem.onclick = () => selectTimeVal('end', hh, mm);
                endList.appendChild(endItem);
            });
        }
    }

    function selectTimeVal(type, hh, mm) {
        if (type === 'start') {
            selectedStartHour = hh;
            selectedStartMin = mm;
        } else {
            selectedEndHour = hh;
            selectedEndMin = mm;
        }

        renderTimeOptions();

        // 클릭 즉시 시간 범위 텍스트 인풋 반영
        const input = document.getElementById('f-timeRange');
        if (input) {
            input.value = `${selectedStartHour}:${selectedStartMin} ~ ${selectedEndHour}:${selectedEndMin}`;
        }
    }

    function toggleTimeDropdown(show) {
        const dropdown = document.getElementById('timeRangeDropdown');
        if (show === undefined) {
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        } else {
            dropdown.style.display = show ? 'block' : 'none';
        }
        if (dropdown.style.display === 'block') {
            renderTimeOptions();
        }
    }

    // 외부 클릭 시 드롭다운 닫기 (detached 엘리먼트 버그 방지 포함)
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('timeRangeDropdown');
        const input = document.getElementById('f-timeRange');
        if (dropdown && input && !dropdown.contains(e.target) && e.target !== input && !e.target.classList.contains('time-select-item')) {
            dropdown.style.display = 'none';
        }
    });

    function confirmTimeRange() {
        const startTotalMin = parseInt(selectedStartHour, 10) * 60 + parseInt(selectedStartMin, 10);
        const endTotalMin = parseInt(selectedEndHour, 10) * 60 + parseInt(selectedEndMin, 10);

        if (endTotalMin < startTotalMin) {
            showToast('종료 시간은 시작 시간보다 빠를 수 없습니다.', true);
            return;
        }

        const input = document.getElementById('f-timeRange');
        input.value = `${selectedStartHour}:${selectedStartMin} ~ ${selectedEndHour}:${selectedEndMin}`;
        toggleTimeDropdown(false);
        updateDeadlineNotificationCalc();
    }

    function setPeriodMode(isRange) {
        document.getElementById('btn-single-day').classList.toggle('active', !isRange);
        document.getElementById('btn-range-day').classList.toggle('active', isRange);
        handlePeriodToggle(isRange);
    }

    function handlePeriodToggle(checked) {
        const currentDates = fpInstance ? fpInstance.selectedDates : [];
        initFlatpickr(checked);
        if (checked) {
            fpInstance.clear();
        } else {
            if (currentDates.length > 0) {
                fpInstance.setDate(currentDates[0]);
            }
        }
        updateDeadlineMax();
        if (window.parent && typeof window.parent.adjustScheduleIframeHeight === 'function') {
            window.parent.adjustScheduleIframeHeight();
        }
    }

    function toggleAllDay(checked) {
        const timeInputs = document.getElementById('timeInputs');
        if (checked) {
            timeInputs.style.opacity = '0.4';
            timeInputs.style.pointerEvents = 'none';
        } else {
            timeInputs.style.opacity = '1';
            timeInputs.style.pointerEvents = 'auto';
        }
    }

    function toggleRecurrenceRow(type) {
        const row = document.getElementById('recurrenceEndDateRow');
        const input = document.getElementById('f-recurrenceEndDate');
        if (type !== 'DAILY') {
            row.style.display = '';
        } else {
            row.style.display = 'none';
            input.value = '';
        }
        if (window.parent && typeof window.parent.adjustScheduleIframeHeight === 'function') {
            window.parent.adjustScheduleIframeHeight();
        }
    }

    function parseSelectedDates() {
        const dates = fpInstance ? fpInstance.selectedDates : [];
        if (dates.length === 0) {
            return { dateVal: null, endDateVal: null };
        }
        const pad = (n) => String(n).padStart(2, '0');
        const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
        const dateVal = fmt(dates[0]);
        const endDateVal = dates[1] ? fmt(dates[1]) : dateVal;
        return { dateVal, endDateVal };
    }

    function parseSelectedTimes() {
        const isAllDay = document.getElementById('f-allDay').checked;
        if (isAllDay) {
            return { startTime: '00:00', endTime: '23:59' };
        }
        return {
            startTime: `${selectedStartHour}:${selectedStartMin}`,
            endTime: `${selectedEndHour}:${selectedEndMin}`
        };
    }

    function buildScheduleBody() {
        const { dateVal, endDateVal } = parseSelectedDates();
        const isAllDay = document.getElementById('f-allDay').checked;
        const { startTime, endTime } = parseSelectedTimes();
        const recurrenceEndDate = document.getElementById('f-recurrenceEndDate').value;

        let startDate = null;
        let endDate = null;

        if (dateVal) {
            if (isAllDay) {
                startDate = `${dateVal}T00:00:00`;
                endDate = `${endDateVal}T23:59:59`;
            } else {
                startDate = `${dateVal}T${startTime}:00`;
                endDate = `${endDateVal}T${endTime}:00`;
            }
        }

        const body = {
            title: document.getElementById('f-title').value.trim(),
            description: document.getElementById('f-description').value.trim() || null,
            scheduleType: document.getElementById('f-scheduleType').value,
            startDate: startDate,
            endDate: endDate,
            isPublic: document.getElementById('f-isPublic').checked,
            location: document.getElementById('f-location').value.trim() || null,
            recurrenceEndDate: recurrenceEndDate || null
        };
        const deadlineDate = document.getElementById('f-deadlineDate').value;
        const notifyDaysBefore = document.getElementById('f-notifyDaysBefore').value;
        if (deadlineDate) {
            body.deadlineDate = deadlineDate;
            body.notifyDaysBefore = notifyDaysBefore ? Number(notifyDaysBefore) : 0;
        }
        return body;
    }

    async function loadScheduleData() {
        const parts = window.location.pathname.split('/').filter(Boolean); // ['schedule', '{scheduleId}', 'edit']
        scheduleId = parts[1]; // scheduleId

        if (!scheduleId || isNaN(scheduleId)) {
            showToast('유효하지 않은 일정 ID입니다.', true);
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/schedule/${scheduleId}`, { headers: authHeaders() });
            if (!res.ok) {
                showToast('일정 조회 실패: ' + res.status, true);
                return;
            }
            const s = await res.json();

            // 최초 원본 시작 날짜 백업
            if (s.startDate) {
                originalStartDateOnly = s.startDate.slice(0, 10);
            }

            const params = new URLSearchParams(window.location.search);
            const dateParam = params.get('date');
            targetDateParam = dateParam || '';

            if (dateParam && s.startDate) {
                const timePart = s.startDate.includes('T') ? s.startDate.split('T')[1] : s.startDate.split(' ')[1] || '09:00:00';
                const origStart = new Date(s.startDate);
                
                s.startDate = `${dateParam}T${timePart}`;
                
                if (s.endDate) {
                    const origEnd = new Date(s.endDate);
                    const newStart = new Date(`${dateParam}T${timePart}`);
                    const newEnd = new Date(newStart.getTime() + (origEnd.getTime() - origStart.getTime()));
                    const pad = (n) => String(n).padStart(2, '0');
                    s.endDate = `${newEnd.getFullYear()}-${pad(newEnd.getMonth()+1)}-${pad(newEnd.getDate())}T${pad(newEnd.getHours())}:${pad(newEnd.getMinutes())}:${pad(newEnd.getSeconds())}`;
                }
            }

            const isAllDay = s.startDate && (s.startDate.includes('T00:00') || s.startDate.includes(' 00:00')) && s.endDate && (s.endDate.includes('T23:59') || s.endDate.includes(' 23:59'));
            const isPeriod = s.startDate && s.endDate && (s.startDate.slice(0, 10) !== s.endDate.slice(0, 10));

            document.getElementById('btn-single-day').classList.toggle('active', !isPeriod);
            document.getElementById('btn-range-day').classList.toggle('active', isPeriod);
            initFlatpickr(isPeriod);

            document.getElementById('f-allDay').checked = isAllDay;
            document.getElementById('f-title').value = s.title || '';
            const descEl = document.getElementById('f-description');
            descEl.value = s.description || '';
            updateDescCounter(descEl);
            document.getElementById('f-scheduleType').value = s.scheduleType || 'DAILY';
            document.getElementById('f-location').value = s.location || '';
            
            if (s.startDate) {
                const startStr = s.startDate.slice(0, 10);
                const endStr = s.endDate ? s.endDate.slice(0, 10) : startStr;
                if (fpInstance) {
                    if (isPeriod) {
                        fpInstance.setDate([startStr, endStr]);
                    } else {
                        fpInstance.setDate(startStr);
                    }
                }

                if (!isAllDay) {
                    const startTimePart = s.startDate.includes('T') ? s.startDate.split('T')[1].slice(0, 5) : s.startDate.split(' ')[1].slice(0, 5) || '09:00';
                    const endTimePart = s.endDate
                        ? (s.endDate.includes('T') ? s.endDate.split('T')[1].slice(0, 5) : s.endDate.split(' ')[1].slice(0, 5) || startTimePart)
                        : startTimePart;

                    const startParts = startTimePart.split(':');
                    const endParts = endTimePart.split(':');
                    selectedStartHour = startParts[0] || '09';
                    selectedStartMin = startParts[1] || '00';
                    selectedEndHour = endParts[0] || '10';
                    selectedEndMin = endParts[1] || '00';
                    confirmTimeRange();
                }
            }

            toggleAllDay(isAllDay);

            document.getElementById('f-deadlineDate').value = s.deadlineDate || '';
            document.getElementById('f-notifyDaysBefore').value = s.notifyDaysBefore || '';
            const isPub = (s.isPublic === true || s.isPublic === 'Y' || s.public === true || s.public === 'Y');
            document.getElementById('f-isPublic').checked = isPub;
            
            document.getElementById('f-recurrenceEndDate').value = s.recurrenceEndDate || '';
            toggleRecurrenceRow(s.scheduleType || 'DAILY');
        } catch (e) {
            console.error(e);
            showToast('일정 데이터를 가져오는 데 실패했습니다.', true);
        }
    }

    async function updateSchedule() {
        if (!token) {
            showToast('먼저 로그인해주세요.', true);
            return;
        }
        
        const { dateVal, endDateVal } = parseSelectedDates();
        const isAllDay = document.getElementById('f-allDay').checked;
        const { startTime, endTime } = parseSelectedTimes();

        if (!dateVal) {
            showToast('일정 기간을 선택해주세요.', true);
            return;
        }
        const timeInputVal = document.getElementById('f-timeRange').value.trim();
        if (!isAllDay && !timeInputVal) {
            showToast('일정 시간을 선택해주세요.', true);
            return;
        }

        const startDtStr = isAllDay ? `${dateVal}T00:00:00` : `${dateVal}T${startTime || '00:00'}:00`;
        const endDtStr = isAllDay ? `${endDateVal}T23:59:59` : `${endDateVal}T${endTime || '23:59'}:00`;

        const startDt = new Date(startDtStr);
        const endDt = new Date(endDtStr);

        if (endDt < startDt) {
            showToast('종료일시는 시작일시보다 빠를 수 없습니다.', true);
            return;
        }

        const descVal = document.getElementById('f-description').value;
        if (descVal.length > 400) {
            showToast('설명은 400자를 초과할 수 없습니다.', true);
            document.getElementById('f-description').focus();
            return;
        }

        const origRes = await fetch(`${API_BASE}/schedule/${scheduleId}`, { headers: authHeaders() });
        if (!origRes.ok) {
            showToast('기존 일정 정보 조회 실패', true);
            return;
        }
        const origSchedule = await origRes.json();
        const originalType = origSchedule.scheduleType;
        const isOrigRecurrent = (originalType && originalType !== 'DAILY');

        const isMiddleInstance = originalStartDateOnly && targetDateParam && (originalStartDateOnly < targetDateParam);
        const body = buildScheduleBody();

        // 종료일 세팅
        if (endDateVal && endDateVal !== dateVal) {
            if (isAllDay) {
                body.endDate = `${endDateVal}T23:59:59`;
            } else {
                body.endDate = `${endDateVal}T${endTime || '10:00'}:00`;
            }
        }

        const scheduleType = document.getElementById('f-scheduleType').value;

        try {
            // A. 기존 일정이 반복 일정(isOrigRecurrent)이었고, 사용자가 이 날의 인스턴스를 DAILY(일간)로 변경하는 경우
            if (isOrigRecurrent && scheduleType === 'DAILY') {
                const targetDate = new Date(targetDateParam);
                const padLocal = (n) => String(n).padStart(2, '0');

                // A-1. 첫 번째 인스턴스를 DAILY로 변경하는 경우
                if (originalStartDateOnly === targetDateParam) {
                    // 1) 원래 반복 일정의 시작 날짜를 1주 뒤(다음 인스턴스 일자)로 밀어서 갱신 (PUT)
                    const nextStartDate = new Date(targetDateParam);
                    if (originalType === 'WEEKLY') {
                        nextStartDate.setDate(nextStartDate.getDate() + 7);
                    } else if (originalType === 'MONTHLY') {
                        nextStartDate.setMonth(nextStartDate.getMonth() + 1);
                    } else if (originalType === 'YEARLY') {
                        nextStartDate.setFullYear(nextStartDate.getFullYear() + 1);
                    }
                    const nextStartDateStr = `${nextStartDate.getFullYear()}-${padLocal(nextStartDate.getMonth()+1)}-${padLocal(nextStartDate.getDate())}`;

                    let hasFuture = true;
                    if (origSchedule.recurrenceEndDate) {
                        const limitDate = new Date(origSchedule.recurrenceEndDate);
                        if (nextStartDate > limitDate) {
                            hasFuture = false;
                        }
                    }

                    if (hasFuture) {
                        const nextStartStrWithTime = `${nextStartDateStr}T${extractTime(origSchedule.startDate)}`;
                        let nextEndStrWithTime = null;
                        if (origSchedule.endDate && origSchedule.startDate) {
                            const origStart = new Date(origSchedule.startDate);
                            const origEnd = new Date(origSchedule.endDate);
                            const diffMs = origEnd - origStart;
                            const nextEnd = new Date(nextStartDate.getTime() + diffMs);
                            nextEndStrWithTime = `${nextEnd.getFullYear()}-${padLocal(nextEnd.getMonth()+1)}-${padLocal(nextEnd.getDate())}T${extractTime(origSchedule.endDate)}`;
                        }

                        const updateOrigBody = {
                            title: origSchedule.title,
                            description: origSchedule.description,
                            scheduleType: origSchedule.scheduleType,
                            startDate: nextStartStrWithTime,
                            endDate: nextEndStrWithTime,
                            isPublic: origSchedule.isPublic,
                            location: origSchedule.location,
                            recurrenceEndDate: origSchedule.recurrenceEndDate || null
                        };
                        if (origSchedule.deadlineDate) {
                            updateOrigBody.deadlineDate = origSchedule.deadlineDate;
                            updateOrigBody.notifyDaysBefore = origSchedule.notifyDaysBefore || 0;
                        }

                        const putRes = await fetch(`${API_BASE}/schedule/${scheduleId}`, {
                            method: 'PUT',
                            headers: authHeaders(),
                            body: JSON.stringify(updateOrigBody)
                        });
                        if (!putRes.ok) {
                            showToast('기존 반복 일정 시작일 갱신 실패: ' + putRes.status, true);
                            resetBtnState();
                            return;
                        }
                    } else {
                        // 미래 반복이 없으면 그냥 기존 일정을 삭제합니다.
                        const delRes = await fetch(`${API_BASE}/schedule/${scheduleId}`, {
                            method: 'DELETE',
                            headers: authHeaders()
                        });
                        if (!delRes.ok) {
                            showToast('기존 반복 일정 삭제 실패', true);
                            resetBtnState();
                            return;
                        }
                    }

                    // 2) 수정한 내용을 새로운 DAILY 일정으로 생성 (POST)
                    const newDailyBody = {
                        title: body.title,
                        description: body.description,
                        scheduleType: 'DAILY',
                        startDate: body.startDate,
                        endDate: body.endDate,
                        isPublic: body.isPublic,
                        location: body.location,
                        recurrenceEndDate: null
                    };
                    if (body.deadlineDate) {
                        newDailyBody.deadlineDate = body.deadlineDate;
                        newDailyBody.notifyDaysBefore = body.notifyDaysBefore || 0;
                    }

                    const postDailyRes = await fetch(`${API_BASE}/schedule`, {
                        method: 'POST',
                        headers: authHeaders(),
                        body: JSON.stringify(newDailyBody)
                    });
                    if (!postDailyRes.ok) {
                        showToast('새 단일 일정 생성 실패', true);
                        resetBtnState();
                        return;
                    }

                    showToast('첫 번째 반복 일정이 분리되어 당일 일정으로 등록되었습니다.');
                    const dateKey = newDailyBody.startDate.slice(0, 10);
                    setTimeout(() => {
                        if (window.parent && typeof window.parent.closeScheduleModalAndReload === 'function') { window.parent.closeScheduleModalAndReload(dateKey); } else { if (window.parent && typeof window.parent.closeScheduleModalAndReload === 'function') { window.parent.closeScheduleModalAndReload(dateKey); } else { window.location.href = `/schedule?date=${dateKey}`; }; }
                    }, 800);
                    return;
                }
                // A-2. 중간/미래 인스턴스를 DAILY로 변경하는 경우
                else if (originalStartDateOnly < targetDateParam) {
                    let prevEndDateStr = '';
                    const prevEndDate = new Date(targetDateParam);
                    if (originalType === 'WEEKLY') {
                        prevEndDate.setDate(prevEndDate.getDate() - 7);
                    } else if (originalType === 'MONTHLY') {
                        prevEndDate.setMonth(prevEndDate.getMonth() - 1);
                    } else if (originalType === 'YEARLY') {
                        prevEndDate.setFullYear(prevEndDate.getFullYear() - 1);
                    }
                    prevEndDateStr = `${prevEndDate.getFullYear()}-${padLocal(prevEndDate.getMonth()+1)}-${padLocal(prevEndDate.getDate())}`;

                    const updateOrigBody = {
                        title: origSchedule.title,
                        description: origSchedule.description,
                        scheduleType: origSchedule.scheduleType,
                        startDate: origSchedule.startDate,
                        endDate: origSchedule.endDate,
                        isPublic: origSchedule.isPublic,
                        location: origSchedule.location,
                        recurrenceEndDate: prevEndDateStr
                    };
                    if (origSchedule.deadlineDate) {
                        updateOrigBody.deadlineDate = origSchedule.deadlineDate;
                        updateOrigBody.notifyDaysBefore = origSchedule.notifyDaysBefore || 0;
                    }

                    const putRes = await fetch(`${API_BASE}/schedule/${scheduleId}`, {
                        method: 'PUT',
                        headers: authHeaders(),
                        body: JSON.stringify(updateOrigBody)
                    });
                    if (!putRes.ok) {
                        showToast('기존 일정 기간 축소 실패: ' + putRes.status, true);
                        resetBtnState();
                        return;
                    }

                    const newDailyBody = {
                        title: body.title,
                        description: body.description,
                        scheduleType: 'DAILY',
                        startDate: body.startDate,
                        endDate: body.endDate,
                        isPublic: body.isPublic,
                        location: body.location,
                        recurrenceEndDate: null
                    };
                    if (body.deadlineDate) {
                        newDailyBody.deadlineDate = body.deadlineDate;
                        newDailyBody.notifyDaysBefore = body.notifyDaysBefore || 0;
                    }

                    const postDailyRes = await fetch(`${API_BASE}/schedule`, {
                        method: 'POST',
                        headers: authHeaders(),
                        body: JSON.stringify(newDailyBody)
                    });
                    if (!postDailyRes.ok) {
                        showToast('단일 일정 생성 실패', true);
                        resetBtnState();
                        return;
                    }

                    const nextStartDate = new Date(targetDateParam);
                    if (originalType === 'WEEKLY') {
                        nextStartDate.setDate(nextStartDate.getDate() + 7);
                    } else if (originalType === 'MONTHLY') {
                        nextStartDate.setMonth(nextStartDate.getMonth() + 1);
                    } else if (originalType === 'YEARLY') {
                        nextStartDate.setFullYear(nextStartDate.getFullYear() + 1);
                    }
                    const nextStartDateStr = `${nextStartDate.getFullYear()}-${padLocal(nextStartDate.getMonth()+1)}-${padLocal(nextStartDate.getDate())}`;

                    let hasFuture = true;
                    if (origSchedule.recurrenceEndDate) {
                        const limitDate = new Date(origSchedule.recurrenceEndDate);
                        if (nextStartDate > limitDate) {
                            hasFuture = false;
                        }
                    }

                    if (hasFuture) {
                        const nextStartStrWithTime = `${nextStartDateStr}T${extractTime(origSchedule.startDate)}`;
                        let nextEndStrWithTime = null;
                        if (origSchedule.endDate && origSchedule.startDate) {
                            const origStart = new Date(origSchedule.startDate);
                            const origEnd = new Date(origSchedule.endDate);
                            const diffMs = origEnd - origStart;
                            const nextEnd = new Date(nextStartDate.getTime() + diffMs);
                            nextEndStrWithTime = `${nextEnd.getFullYear()}-${padLocal(nextEnd.getMonth()+1)}-${padLocal(nextEnd.getDate())}T${extractTime(origSchedule.endDate)}`;
                        }

                        const nextScheduleBody = {
                            title: origSchedule.title,
                            description: origSchedule.description,
                            scheduleType: origSchedule.scheduleType,
                            startDate: nextStartStrWithTime,
                            endDate: nextEndStrWithTime,
                            isPublic: origSchedule.isPublic,
                            location: origSchedule.location,
                            recurrenceEndDate: origSchedule.recurrenceEndDate || null
                        };
                        if (origSchedule.deadlineDate) {
                            nextScheduleBody.deadlineDate = origSchedule.deadlineDate;
                            nextScheduleBody.notifyDaysBefore = origSchedule.notifyDaysBefore || 0;
                        }

                        const postNextRes = await fetch(`${API_BASE}/schedule`, {
                            method: 'POST',
                            headers: authHeaders(),
                            body: JSON.stringify(nextScheduleBody)
                        });
                        if (!postNextRes.ok) {
                            showToast('이후 반복 일정 분리 생성 실패', true);
                            return;
                        }
                    }

                    showToast('선택한 하루 일정이 분리되어 당일 일정으로 등록되었습니다.');
                    const dateKey = newDailyBody.startDate.slice(0, 10);
                    setTimeout(() => {
                        if (window.parent && typeof window.parent.closeScheduleModalAndReload === 'function') { window.parent.closeScheduleModalAndReload(dateKey); } else { if (window.parent && typeof window.parent.closeScheduleModalAndReload === 'function') { window.parent.closeScheduleModalAndReload(dateKey); } else { window.location.href = `/schedule?date=${dateKey}`; }; }
                    }, 800);
                    return;
                }
            }
            // B. 기존 일정이 반복 일정(isOrigRecurrent)이었고, 사용자가 이 날의 인스턴스를 반복 유형 그대로(WEEKLY 등) 두면서 "이 일정 및 향후 일정"을 변경(수정)하는 경우
            else if (isOrigRecurrent && isMiddleInstance) {
                const targetDate = new Date(targetDateParam);
                const padLocal = (n) => String(n).padStart(2, '0');
                const dayBeforeStr = `${targetDate.getFullYear()}-${padLocal(targetDate.getMonth()+1)}-${padLocal(targetDate.getDate() - 1)}`;

                const updateOrigBody = {
                    title: origSchedule.title,
                    description: origSchedule.description,
                    scheduleType: origSchedule.scheduleType,
                    startDate: origSchedule.startDate,
                    endDate: origSchedule.endDate,
                    isPublic: origSchedule.isPublic,
                    location: origSchedule.location,
                    recurrenceEndDate: dayBeforeStr
                };
                if (origSchedule.deadlineDate) {
                    updateOrigBody.deadlineDate = origSchedule.deadlineDate;
                    updateOrigBody.notifyDaysBefore = origSchedule.notifyDaysBefore || 0;
                }

                const putRes = await fetch(`${API_BASE}/schedule/${scheduleId}`, {
                    method: 'PUT',
                    headers: authHeaders(),
                    body: JSON.stringify(updateOrigBody)
                });
                if (!putRes.ok) {
                    showToast('기존 일정 기간 축소 실패: ' + putRes.status, true);
                    return;
                }

                const newScheduleBody = {
                    title: body.title,
                    description: body.description,
                    scheduleType: body.scheduleType,
                    startDate: body.startDate,
                    endDate: body.endDate,
                    isPublic: body.isPublic,
                    location: body.location,
                    recurrenceEndDate: origSchedule.recurrenceEndDate || null
                };
                if (body.deadlineDate) {
                    newScheduleBody.deadlineDate = body.deadlineDate;
                    newScheduleBody.notifyDaysBefore = body.notifyDaysBefore || 0;
                }

                const postRes = await fetch(`${API_BASE}/schedule`, {
                    method: 'POST',
                    headers: authHeaders(),
                    body: JSON.stringify(newScheduleBody)
                });
                if (!postRes.ok) {
                    showToast('새로운 일정 등록 실패: ' + postRes.status, true);
                    return;
                }

                showToast('이 일정 및 향후 일정이 수정되었습니다. 캘린더로 이동합니다...');
                const dateKey = newScheduleBody.startDate.slice(0, 10);
                setTimeout(() => {
                    if (window.parent && typeof window.parent.closeScheduleModalAndReload === 'function') { window.parent.closeScheduleModalAndReload(dateKey); } else { if (window.parent && typeof window.parent.closeScheduleModalAndReload === 'function') { window.parent.closeScheduleModalAndReload(dateKey); } else { window.location.href = `/schedule?date=${dateKey}`; }; }
                }, 800);
                return;
            }

            // C. 일반적인 단순 수정(DAILY 일정을 수정하거나, 혹은 첫 번째 날의 반복 일정 정보를 통째로 갱신하는 경우)
            const url = `${API_BASE}/schedule/${scheduleId}`;
            const res = await fetch(url, {
                method: 'PUT',
                headers: authHeaders(),
                body: JSON.stringify(body)
            });
            if (!res.ok) {
                showToast('수정 실패: ' + res.status, true);
                resetBtnState();
                return;
            }
            showToast('일정이 수정되었습니다. 캘린더로 이동합니다...');
            const dateKey = body.startDate.slice(0, 10);
            setTimeout(() => {
                if (window.parent && typeof window.parent.closeScheduleModalAndReload === 'function') { window.parent.closeScheduleModalAndReload(dateKey); } else { if (window.parent && typeof window.parent.closeScheduleModalAndReload === 'function') { window.parent.closeScheduleModalAndReload(dateKey); } else { window.location.href = `/schedule?date=${dateKey}`; }; }
            }, 800);

        } catch (e) {
            console.error(e);
            showToast('수정 처리 중 오류가 발생했습니다.', true);
        }
    }

    function updateDeadlineMax() {
        const { dateVal, endDateVal } = parseSelectedDates();
        const isPeriodMode = document.getElementById('btn-range-day').classList.contains('active');
        if (dateVal) {
            const minAllowed = dateVal;
            const maxAllowed = (isPeriodMode && endDateVal) ? endDateVal : dateVal;
            
            if (deadlineFpInstance) {
                deadlineFpInstance.set('minDate', minAllowed);
                deadlineFpInstance.set('maxDate', maxAllowed);
                
                const currentVal = document.getElementById('f-deadlineDate').value;
                if (!currentVal || currentVal > maxAllowed || currentVal < minAllowed) {
                    deadlineFpInstance.setDate(maxAllowed);
                }
            }
        }
    }

    function extractTime(dtStr) {
        if (!dtStr) return "00:00:00";
        const parts = dtStr.split('T');
        if (parts.length < 2) return "00:00:00";
        let timePart = parts[1];
        const timeSplits = timePart.split(':');
        if (timeSplits.length === 2) {
            return timePart + ":00";
        }
        return timePart;
    }

    function updateDeadlineNotificationCalc() {
        const deadlineVal = document.getElementById('f-deadlineDate').value;
        const daysVal = document.getElementById('f-notifyDaysBefore').value;
        const calcRow = document.getElementById('deadlineNotificationCalcRow');
        const calcText = document.getElementById('deadlineNotificationCalcText');
        
        if (!calcRow || !calcText) return;
        
        const triggerHeightAdjust = () => {
            if (window.parent && typeof window.parent.adjustScheduleIframeHeight === 'function') {
                window.parent.adjustScheduleIframeHeight();
            }
        };

        if (!deadlineVal) {
            calcRow.style.display = 'none';
            triggerHeightAdjust();
            return;
        }
        
        const days = parseInt(daysVal, 10);
        if (isNaN(days) || days < 0) {
            calcRow.style.display = 'none';
            triggerHeightAdjust();
            return;
        }
        
        const deadlineDate = new Date(deadlineVal.replace(' ', 'T'));
        if (isNaN(deadlineDate.getTime())) {
            calcRow.style.display = 'none';
            triggerHeightAdjust();
            return;
        }
        
        const calcDate = new Date(deadlineDate.getTime());
        calcDate.setDate(calcDate.getDate() - days);
        
        const formatted = `${calcDate.getFullYear()}년 ${calcDate.getMonth() + 1}월 ${calcDate.getDate()}일`;

        // 시작 시간 추출 및 포맷팅
        const isAllDay = document.getElementById('f-allDay').checked;
        let timeStr = '09:00';
        if (!isAllDay) {
            const { startTime } = parseSelectedTimes();
            if (startTime) timeStr = startTime;
        }
        
        const parts = timeStr.split(':');
        const hh = parseInt(parts[0] || '9', 10);
        const mm = parseInt(parts[1] || '0', 10);
        const ampm = hh < 12 ? '오전' : '오후';
        const displayHour = hh === 0 ? 12 : (hh > 12 ? hh - 12 : hh);
        const displayMin = String(mm).padStart(2, '0');
        const formattedTime = `${ampm} ${displayHour}시 ${displayMin}분`;
        
        calcText.innerHTML = `🔔 지정하신 마감일의 <strong style="color:#15803d; font-size:13px;">${days}일 전</strong>인 <strong style="color:#15803d; font-size:13px;">${formatted} ${formattedTime}</strong>에 알림이 발송됩니다.`;
        calcRow.style.display = 'block';
        triggerHeightAdjust();
    }

    document.getElementById('f-notifyDaysBefore').addEventListener('input', updateDeadlineNotificationCalc);
    document.getElementById('f-notifyDaysBefore').addEventListener('change', updateDeadlineNotificationCalc);
    document.getElementById('f-deadlineDate').addEventListener('change', updateDeadlineNotificationCalc);
    document.getElementById('f-allDay').addEventListener('change', updateDeadlineNotificationCalc);

    if (checkAuth()) {
        initFlatpickr();
        loadScheduleData().then(() => {
            updateDeadlineMax();
            updateDeadlineNotificationCalc();
        });
    }
    // iframe 취소/닫기 핸들러 글로벌 노출
    window.handleCancel = function() {
        if (window.parent && typeof window.parent.closeScheduleIframeModal === 'function') {
            window.parent.closeScheduleIframeModal();
        } else {
            history.back();
        }
    };

    function handleEscInIframe(event) {
        if (event.key === 'Escape' || event.key === 'Esc' || event.keyCode === 27) {
            if (window.parent && window.parent.document) {
                const delModal = window.parent.document.getElementById('deleteConfirmModal');
                if (delModal && delModal.style.display === 'flex') {
                    if (typeof window.parent.closeDeleteConfirmModal === 'function') {
                        window.parent.closeDeleteConfirmModal();
                        event.stopPropagation();
                        event.preventDefault();
                        return;
                    }
                }
            }
            if (window.parent && typeof window.parent.closeScheduleIframeModal === 'function') {
                window.parent.closeScheduleIframeModal();
            }
        }
    }
    window.addEventListener('keydown', handleEscInIframe, true);
    window.addEventListener('keyup', handleEscInIframe, true);
