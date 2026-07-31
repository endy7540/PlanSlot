
    

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

    // 외부 클릭 시 드롭다운 닫기 (detached 엘리먼트 버그 방지 포함)
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('timeRangeDropdown');
        const input = document.getElementById('f-timeRange');
        if (dropdown && input && !dropdown.contains(e.target) && e.target !== input && !e.target.classList.contains('time-select-item')) {
            dropdown.style.display = 'none';
        }
    });

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

    let isSubmitting = false;

    async function submitSchedule() {
        if (isSubmitting) return;

        if (!token) {
            showToast('먼저 로그인해주세요.', true);
            return;
        }
        
        const titleVal = document.getElementById('f-title').value.trim();
        const { dateVal, endDateVal } = parseSelectedDates();
        const isAllDay = document.getElementById('f-allDay').checked;
        const { startTime, endTime } = parseSelectedTimes();

        if (!titleVal) {
            showToast('제목은 필수입니다.', true);
            return;
        }
        if (!dateVal) {
            showToast('일정 날짜를 선택해주세요.', true);
            return;
        }
        const timeInputVal = document.getElementById('f-timeRange').value.trim();
        if (!isAllDay && !timeInputVal) {
            showToast('일정 시간을 선택해주세요.', true);
            return;
        }

        const startDtStr = isAllDay ? `${dateVal}T00:00:00` : `${dateVal}T${startTime}:00`;
        const endDtStr = isAllDay ? `${endDateVal}T23:59:59` : `${endDateVal}T${endTime}:00`;

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

        isSubmitting = true;
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = '등록 중...';
            submitBtn.style.opacity = '0.6';
            submitBtn.style.pointerEvents = 'none';
        }

        const resetBtnState = () => {
            isSubmitting = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = '등록 완료';
                submitBtn.style.opacity = '1';
                submitBtn.style.pointerEvents = 'auto';
            }
        };

        const body = buildScheduleBody();
        const groupId = new URLSearchParams(window.location.search).get('groupId');
        const url = groupId ? `${API_BASE}/group/${groupId}/schedules` : `${API_BASE}/schedule`;

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify(body)
            });
            if (!res.ok) {
                showToast('등록 실패: ' + res.status, true);
                resetBtnState();
                return;
            }
            showToast('일정이 등록되었습니다.');
            setTimeout(() => {
                if (window.parent && typeof window.parent.closeScheduleModalAndReload === 'function') {
                    window.parent.closeScheduleModalAndReload(dateVal);
                } else {
                    window.location.href = `/schedule?date=${dateVal}`;
                }
            }, 800);
        } catch (e) {
            console.error(e);
            showToast('요청 중 오류가 발생했습니다.', true);
            resetBtnState();
        }
    }

    function applyUrlParams() {
        const dateParam = new URLSearchParams(window.location.search).get('date');
        if (fpInstance) {
            const isRangeMode = fpInstance.config.mode === "range";
            if (isRangeMode) {
                fpInstance.clear();
            } else {
                if (dateParam) {
                    fpInstance.setDate(dateParam);
                } else {
                    const todayStr = new Date().toISOString().slice(0, 10);
                    fpInstance.setDate(todayStr);
                }
            }
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
        initFlatpickr(false);
        confirmTimeRange(); // 기본값 주입
        applyUrlParams();
        updateDeadlineMax();
    }
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
