
    

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

    function showToast(msg, isError) {
        const t = document.getElementById('toast');
        t.textContent = msg;
        t.className = 'toast show' + (isError ? ' error' : '');
        setTimeout(() => t.classList.remove('show'), 2200);
    }

    function checkAuth() {
        token = localStorage.getItem('jwtToken') || '';
        const notice = document.getElementById('authNotice');
        const detailPanel = document.getElementById('scheduleDetailPanel');

        if (token) {
            notice.style.display = 'none';
            detailPanel.style.display = '';
        } else {
            notice.style.display = '';
            detailPanel.style.display = 'none';
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

    function formatDate(iso) {
        if (!iso) return '-';
        return iso.replace('T', ' ').slice(0, 16);
    }

    async function loadScheduleDetail() {
        const parts = window.location.pathname.split('/').filter(Boolean);
        scheduleId = parts[parts.length - 1]; // /schedule/{scheduleId}

        if (!scheduleId || isNaN(scheduleId)) {
            showToast('유효하지 않은 일정 ID입니다.', true);
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/schedule/${scheduleId}`, { headers: authHeaders() });
            if (!res.ok) {
                showToast('일정을 불러오는 데 실패했습니다: ' + res.status, true);
                return;
            }
            const s = await res.json();
            
            document.getElementById('detail-title-val').textContent = s.title;
            
            const params = new URLSearchParams(window.location.search);
            const dateParam = params.get('date');
            let displayStart = s.startDate;
            let displayEnd = s.endDate;
            
            if (dateParam && s.startDate) {
                const timePart = s.startDate.includes('T') ? s.startDate.split('T')[1] : s.startDate.split(' ')[1] || '09:00:00';
                const origStart = new Date(s.startDate);
                displayStart = `${dateParam}T${timePart}`;
                
                if (s.endDate) {
                    const origEnd = new Date(s.endDate);
                    const newStart = new Date(`${dateParam}T${timePart}`);
                    const newEnd = new Date(newStart.getTime() + (origEnd.getTime() - origStart.getTime()));
                    const pad = (n) => String(n).padStart(2, '0');
                    displayEnd = `${newEnd.getFullYear()}-${pad(newEnd.getMonth()+1)}-${pad(newEnd.getDate())}T${pad(newEnd.getHours())}:${pad(newEnd.getMinutes())}:${pad(newEnd.getSeconds())}`;
                }
            }
            
            const timeStr = displayEnd 
                ? `${formatDate(displayStart)} ~ ${formatDate(displayEnd)}`
                : `${formatDate(displayStart)}`;
            document.getElementById('detail-time-val').textContent = timeStr;

            document.getElementById('detail-type').textContent = s.scheduleType;
            
            const pubSpan = document.getElementById('detail-public');
            const isPub = (s.isPublic === true || s.isPublic === 'Y' || s.public === true || s.public === 'Y');
            if (isPub) {
                pubSpan.textContent = '공개 일정';
                pubSpan.className = 'badge public';
            } else {
                pubSpan.textContent = '비공개 일정';
                pubSpan.className = 'badge private';
            }

            if (s.location) {
                document.getElementById('location-row').style.display = '';
                document.getElementById('detail-location-val').textContent = s.location;
            } else {
                document.getElementById('location-row').style.display = 'none';
            }

            if (s.description) {
                document.getElementById('description-row').style.display = '';
                document.getElementById('detail-description-val').textContent = s.description;
            } else {
                document.getElementById('description-row').style.display = 'none';
            }

            let finalDeadlineDate = s.deadlineDate;
            if (dateParam && s.startDate && s.deadlineDate) {
                const origStartOnly = s.startDate.split('T')[0];
                if (origStartOnly !== dateParam) {
                    const origStartD = new Date(origStartOnly);
                    const targetD = new Date(dateParam);
                    const diffTime = targetD.getTime() - origStartD.getTime();
                    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays !== 0) {
                        const origDeadlineD = new Date(s.deadlineDate);
                        origDeadlineD.setDate(origDeadlineD.getDate() + diffDays);
                        const pad = (n) => String(n).padStart(2, '0');
                        finalDeadlineDate = `${origDeadlineD.getFullYear()}-${pad(origDeadlineD.getMonth()+1)}-${pad(origDeadlineD.getDate())}`;
                    }
                }
            }

            if (finalDeadlineDate) {
                document.getElementById('deadline-row').style.display = '';
                document.getElementById('detail-deadline-val').textContent = finalDeadlineDate;
            } else {
                document.getElementById('deadline-row').style.display = 'none';
            }

            if (s.notifyDaysBefore !== null && s.notifyDaysBefore !== undefined) {
                document.getElementById('notify-row').style.display = '';
                document.getElementById('detail-notify-val').textContent = `${s.notifyDaysBefore}일 전 알림`;
            } else {
                document.getElementById('notify-row').style.display = 'none';
            }

        } catch (e) {
            console.error(e);
            showToast('일정 정보를 가져오는 중 오류가 발생했습니다.', true);
        } finally {
            // 데이터 렌더링 완료 후 부모에게 실제 높이 전달
            notifyParentResize();
        }
    }

    function notifyParentResize() {
        if (window.self === window.top) return;
        try {
            const h = document.documentElement.scrollHeight + 40; // 여유값 40px
            const maxH = window.parent.innerHeight * 0.92;
            const finalH = Math.min(h, maxH);
            const container = window.parent.document.getElementById('scheduleIframeContainer');
            if (container) container.style.height = finalH + 'px';
        } catch(e) {}
    }

    function goToEdit() {
        if (scheduleId) {
            const params = new URLSearchParams(window.location.search);
            const dateParam = params.get('date');
            if (dateParam) {
                window.location.href = `/schedule/${scheduleId}/edit?date=${dateParam}`;
            } else {
                window.location.href = `/schedule/${scheduleId}/edit`;
            }
        }
    }

    async function deleteCurrentSchedule() {
        const params = new URLSearchParams(window.location.search);
        const targetDateParam = params.get('date');
        const title = document.getElementById('detail-title-val').textContent;

        if (window.parent && typeof window.parent.deleteSingleSchedule === 'function') {
            window.parent.deleteSingleSchedule(scheduleId, title, targetDateParam);
        } else {
            if (!confirm(`'${title}' 일정을 삭제하시겠습니까?`)) return;
            await performDeleteAll(scheduleId);
        }
    }

    async function performDeleteAll(id) {
        const res = await fetch(`${API_BASE}/schedule/${id}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        if (!res.ok) {
            showToast('삭제 실패: ' + res.status, true);
            return;
        }
        showToast('일정이 성공적으로 삭제되었습니다.');
        setTimeout(() => { window.location.href = '/schedule'; }, 800);
    }

    async function deleteFutureSchedules(origSchedule, targetDateParam) {
        const targetDate = new Date(targetDateParam);
        const padLocal = (n) => String(n).padStart(2, '0');

        const prevEndDate = new Date(targetDateParam);
        const originalType = origSchedule.scheduleType;
        if (originalType === 'WEEKLY') {
            prevEndDate.setDate(prevEndDate.getDate() - 7);
        } else if (originalType === 'MONTHLY') {
            prevEndDate.setMonth(prevEndDate.getMonth() - 1);
        } else if (originalType === 'YEARLY') {
            prevEndDate.setFullYear(prevEndDate.getFullYear() - 1);
        }
        const prevEndDateStr = `${prevEndDate.getFullYear()}-${padLocal(prevEndDate.getMonth()+1)}-${padLocal(prevEndDate.getDate())}`;

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
            showToast('향후 일정 삭제 처리 실패', true);
            return;
        }

        showToast('선택한 날짜부터의 향후 일정이 모두 삭제되었습니다.');
        setTimeout(() => { window.location.href = '/schedule'; }, 800);
    }

    async function deleteSingleDaySchedule(origSchedule, targetDateParam) {
        const targetDate = new Date(targetDateParam);
        const padLocal = (n) => String(n).padStart(2, '0');

        const prevEndDate = new Date(targetDateParam);
        const originalType = origSchedule.scheduleType;
        if (originalType === 'WEEKLY') {
            prevEndDate.setDate(prevEndDate.getDate() - 7);
        } else if (originalType === 'MONTHLY') {
            prevEndDate.setMonth(prevEndDate.getMonth() - 1);
        } else if (originalType === 'YEARLY') {
            prevEndDate.setFullYear(prevEndDate.getFullYear() - 1);
        }
        const prevEndDateStr = `${prevEndDate.getFullYear()}-${padLocal(prevEndDate.getMonth()+1)}-${padLocal(prevEndDate.getDate())}`;

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
            showToast('일정 단축 처리 실패', true);
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
            const timePart = extractTime(origSchedule.startDate);
            const nextStartStrWithTime = `${nextStartDateStr}T${timePart}`;
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
                showToast('다음 반복 일정 분리 실패', true);
                return;
            }
        }

        showToast('선택한 당일 하루 일정이 삭제되었습니다.');
        setTimeout(() => { window.location.href = '/schedule'; }, 800);
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

    function askDeleteChoice(date) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.style = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.5); display: flex; align-items: center;
                justify-content: center; z-index: 10000; font-family: sans-serif;
            `;
            modal.innerHTML = `
                <div style="background: white; padding: 24px; border-radius: 12px; max-width: 400px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
                    <h3 style="margin-top: 0; color: #0f172a; font-size: 18px; font-weight: 800;">반복 일정 삭제 선택</h3>
                    <p style="color: #475569; font-size: 14px; line-height: 1.5; margin: 12px 0 20px;">
                        이 일정은 반복되는 일정입니다.<br>삭제 방식을 선택해 주세요.
                    </p>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <button id="btnDeleteDay" style="background: #FEF2F2; color: #EF4444; border: 1px solid #FEE2E2; padding: 12px; border-radius: 8px; font-weight: 800; cursor: pointer; text-align: left; transition: all 0.2s;">
                            🗑️ 선택한 당일(\${date})만 삭제
                        </button>
                        <button id="btnDeleteFuture" style="background: #EF4444; color: white; border: 0; padding: 12px; border-radius: 8px; font-weight: 800; cursor: pointer; text-align: left; transition: all 0.2s;">
                            📅 선택한 날부터 향후 일정을 모두 삭제
                        </button>
                        <button id="btnCancelDelete" style="background: #F1F5F9; color: #475569; border: 0; padding: 12px; border-radius: 8px; font-weight: 800; cursor: pointer; margin-top: 5px;">
                            취소
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.querySelector('#btnDeleteDay').onclick = () => {
                document.body.removeChild(modal);
                resolve('day');
            };
            modal.querySelector('#btnDeleteFuture').onclick = () => {
                document.body.removeChild(modal);
                resolve('future');
            };
            modal.querySelector('#btnCancelDelete').onclick = () => {
                document.body.removeChild(modal);
                resolve('cancel');
            };
        });
    }

    function askMultiDayDeleteChoice(date) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(8px); display: flex; align-items: center;
                justify-content: center; z-index: 10000; font-family: sans-serif;
            `;
            modal.innerHTML = `
                <div style="background: white; padding: 24px; border-radius: 16px; max-width: 440px; width: 90%; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); text-align: center; border: 1px solid #E2E8F0;">
                    <span style="font-size: 32px; display: block; margin-bottom: 12px;">📅</span>
                    <h3 style="margin-top: 0; color: #0f172a; font-size: 18px; font-weight: 800;">연속 일정 삭제 선택</h3>
                    <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 12px 0 20px; word-break: keep-all;">
                        이 일정은 다른 날과 연결된 연속 일정입니다.<br>선택한 날인 <strong>${date}</strong>의 일정만 지우시겠습니까? 아니면 전체 일정을 삭제하시겠습니까?
                    </p>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <button id="btnDeleteSingle" style="background: #3B82F6; color: white; border: 0; padding: 12px; border-radius: 10px; font-weight: 800; cursor: pointer; transition: all 0.2s;">
                            👉 선택한 날의 일정만 삭제 (기간 단축)
                        </button>
                        <button id="btnDeleteAll" style="background: #EF4444; color: white; border: 0; padding: 12px; border-radius: 10px; font-weight: 800; cursor: pointer; transition: all 0.2s;">
                            🗑️ 연결된 전체 일정 삭제
                        </button>
                        <button id="btnCancel" style="background: #F1F5F9; color: #475569; border: 0; padding: 10px; border-radius: 10px; font-weight: 800; cursor: pointer; margin-top: 4px;">
                            취소
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.querySelector('#btnDeleteSingle').onclick = () => {
                document.body.removeChild(modal);
                resolve('single');
            };
            modal.querySelector('#btnDeleteAll').onclick = () => {
                document.body.removeChild(modal);
                resolve('all');
            };
            modal.querySelector('#btnCancel').onclick = () => {
                document.body.removeChild(modal);
                resolve('cancel');
            };
        });
    }

    async function deleteSingleDayOfMultiDaySchedule(s, dateParam) {
        const startD = new Date(getDateOnly(s.startDate));
        const endD = new Date(s.endDate ? getDateOnly(s.endDate) : getDateOnly(s.startDate));
        
        try {
            if (dateParam === getDateOnly(s.startDate)) {
                startD.setDate(startD.getDate() + 1);
                const newStartStr = fmtLocalDateTime(startD);
                await updateScheduleDates(s, newStartStr, s.endDate);
            } else if (dateParam === getDateOnly(s.endDate)) {
                endD.setDate(endD.getDate() - 1);
                const newEndStr = fmtLocalDateTime(endD);
                await updateScheduleDates(s, s.startDate, newEndStr);
            } else {
                const frontEndD = new Date(dateParam);
                frontEndD.setDate(frontEndD.getDate() - 1);
                frontEndD.setHours(23, 59, 59, 0);
                const frontEndStr = fmtLocalDateTime(frontEndD);
                await updateScheduleDates(s, s.startDate, frontEndStr);

                const backStartD = new Date(dateParam);
                backStartD.setDate(backStartD.getDate() + 1);
                backStartD.setHours(0, 0, 0, 0);
                const backStartStr = fmtLocalDateTime(backStartD);

                await createSplitSchedule(s, backStartStr, s.endDate);
            }
            showToast('선택한 당일 하루 일정이 연속 일정에서 삭제되었습니다.');
            setTimeout(() => { window.location.href = `/schedule?date=${dateParam}`; }, 800);
        } catch (e) {
            console.error("연속 일정 부분 삭제 실패:", e);
            showToast("삭제 실패: " + e.message, true);
        }
    }

    async function updateScheduleDates(originalSchedule, newStart, newEnd) {
        const payload = {
            title: originalSchedule.title,
            description: originalSchedule.description,
            scheduleType: originalSchedule.scheduleType,
            startDate: newStart,
            endDate: newEnd,
            isPublic: (originalSchedule.isPublic === 'Y' || originalSchedule.isPublic === true || originalSchedule.public === 'Y' || originalSchedule.public === true),
            location: originalSchedule.location,
            recurrenceEndDate: originalSchedule.recurrenceEndDate
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

    async function createSplitSchedule(originalSchedule, start, end) {
        const payload = {
            title: originalSchedule.title,
            description: originalSchedule.description,
            scheduleType: originalSchedule.scheduleType,
            startDate: start,
            endDate: end,
            isPublic: (originalSchedule.isPublic === 'Y' || originalSchedule.isPublic === true || originalSchedule.public === 'Y' || originalSchedule.public === true),
            location: originalSchedule.location,
            recurrenceEndDate: originalSchedule.recurrenceEndDate
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

    function pad(n) { return String(n).padStart(2, '0'); }

    function fmtLocalDateTime(date) {
        return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }

    if (checkAuth()) {
        loadScheduleDetail();
    }
    window.goToList = function() {
        const params = new URLSearchParams(window.location.search);
        const dateKey = params.get('date') || '';
        if (window.parent && typeof window.parent.closeScheduleIframeModal === 'function') {
            window.parent.closeScheduleIframeModal();
        } else {
            window.location.href = `/schedule?date=${dateKey}`;
        }
    };

    function handleEscInIframe(event) {
        if (event.key === 'Escape' || event.key === 'Esc' || event.keyCode === 27) {
            // 부모창에 삭제 확인 모달이 떠있다면 그 모달부터 닫음
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
