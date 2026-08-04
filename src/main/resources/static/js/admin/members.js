let allRows = [];
    let filteredRows = [];
    let currentPage = 1;
    const itemsPerPage = 10;

    document.addEventListener("DOMContentLoaded", () => {
        const rows = document.querySelectorAll('.member-row');
        allRows = Array.from(rows);
        filteredRows = [...allRows];
        renderTable();
    });

    function searchMembers() {
        const type = document.getElementById('memberSearchType').value;
        const input = document.getElementById('memberSearchInput').value.toLowerCase();
        
        filteredRows = allRows.filter(row => {
            const nickname = row.querySelector('.member-nickname').innerText.toLowerCase();
            let status = "";
            const statusSelect = row.querySelector('.select-status');
            if (statusSelect) {
                status = statusSelect.options[statusSelect.selectedIndex].text.toLowerCase();
            } else if (row.querySelector('.badge-withdrawn')) {
                status = "탈퇴 회원";
            }
            
            if (type === 'ALL') {
                return nickname.includes(input) || status.includes(input);
            } else if (type === 'NICKNAME') {
                return nickname.includes(input);
            } else if (type === 'STATUS') {
                return status.includes(input);
            }
            return true;
        });

        currentPage = 1; // 검색 시 첫 페이지로
        document.getElementById('totalCountSpan').innerText = filteredRows.length;
        renderTable();
    }

    function renderTable() {
        // 모든 행 숨기기
        allRows.forEach(row => row.style.display = 'none');

        // 현재 페이지에 해당하는 행만 표시
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const pageRows = filteredRows.slice(startIndex, endIndex);
        
        pageRows.forEach(row => row.style.display = '');

        renderPagination();
    }

    function renderPagination() {
        const totalPages = Math.ceil(filteredRows.length / itemsPerPage);
        const container = document.getElementById('paginationContainer');
        container.innerHTML = '';

        if (totalPages <= 1) return;

        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            btn.className = 'board-page-btn' + (i === currentPage ? ' active' : '');
            btn.innerText = i;
            btn.onclick = () => {
                currentPage = i;
                renderTable();
            };
            container.appendChild(btn);
        }
    }

    let pendingSuspendTarget = null;
    let pendingSuspendSelect = null;
    let pendingConfirmAction = null;
    let pendingConfirmCancel = null;
    let pendingAlertAction = null;

    function showAlertModal(message, onConfirm) {
        document.getElementById('alertModalMessage').innerHTML = message.replace(/\n/g, '<br>');
        document.getElementById('alertModal').style.display = 'flex';
        pendingAlertAction = onConfirm;
    }

    function closeAlertModal(event, isConfirmed = false) {
        if (event && event.type === 'click' && event.target !== event.currentTarget) return;
        document.getElementById('alertModal').style.display = 'none';
        
        if (pendingAlertAction) {
            pendingAlertAction();
        }
        pendingAlertAction = null;
    }

    function showConfirmModal(message, onConfirm, onCancel) {
        document.getElementById('confirmModalMessage').innerHTML = message.replace(/\n/g, '<br>');
        document.getElementById('confirmModal').style.display = 'flex';
        pendingConfirmAction = onConfirm;
        pendingConfirmCancel = onCancel;
    }

    function closeConfirmModal(event, isConfirmed = false) {
        if (event && event.type === 'click' && event.target !== event.currentTarget) return;
        document.getElementById('confirmModal').style.display = 'none';
        
        if (isConfirmed && pendingConfirmAction) {
            pendingConfirmAction();
        } else if (!isConfirmed && pendingConfirmCancel) {
            pendingConfirmCancel();
        }
        
        pendingConfirmAction = null;
        pendingConfirmCancel = null;
    }

    async function updateStatus(memberId, status, selectElement) {
        let msg = '해당 회원의 상태를 정상으로 변경하시겠습니까?';
        let suspendDays = null;
        
        if (status === 'SUSPENDED') {
            pendingSuspendTarget = memberId;
            pendingSuspendSelect = selectElement;
            document.getElementById('customSuspendDays').value = '';
            document.getElementById('suspendModal').style.display = 'flex';
            return; // Wait for modal interaction
        } else if (status === 'BANNED') {
            msg = '해당 회원을 영구 정지(BANNED) 처리하시겠습니까?\n(사이트 이용 영구 제한)';
        }
        
        showConfirmModal(msg, 
            () => processStatusUpdate(memberId, status, null, selectElement),
            () => { selectElement.value = selectElement.getAttribute('data-original'); }
        );
    }

    async function processStatusUpdate(memberId, status, suspendDays, selectElement) {
        try {
            const payload = { status: status };
            if (suspendDays !== null) {
                payload.suspendDays = suspendDays.toString();
            }
            
            const response = await fetch(`/api/admin/members/${memberId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                showAlertModal('상태가 변경되었습니다.', () => { window.location.reload(); });
            } else {
                showAlertModal('오류가 발생했습니다.', () => { selectElement.value = selectElement.getAttribute('data-original'); });
            }
        } catch (error) {
            console.error('Error:', error);
            showAlertModal('네트워크 오류가 발생했습니다.', () => { selectElement.value = selectElement.getAttribute('data-original'); });
        }
    }
    
    function changeMemberStatus(memberId, selectId) {
        const select = document.getElementById(selectId);
        updateStatus(memberId, select.value, select);
    }

    function closeSuspendModal(event) {
        if (event && event.target !== event.currentTarget) return;
        document.getElementById('suspendModal').style.display = 'none';
        if (pendingSuspendSelect) {
            pendingSuspendSelect.value = pendingSuspendSelect.getAttribute('data-original');
        }
        pendingSuspendTarget = null;
        pendingSuspendSelect = null;
    }

    // ESC 키로 모달 닫기
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            const alertModal = document.getElementById('alertModal');
            if (alertModal && alertModal.style.display === 'flex') {
                closeAlertModal({ type: 'click', target: alertModal, currentTarget: alertModal }, false);
                return;
            }
            const suspendModal = document.getElementById('suspendModal');
            if (suspendModal && suspendModal.style.display === 'flex') {
                closeSuspendModal({ target: suspendModal, currentTarget: suspendModal });
                return;
            }
            const confirmModal = document.getElementById('confirmModal');
            if (confirmModal && confirmModal.style.display === 'flex') {
                closeConfirmModal({ type: 'click', target: confirmModal, currentTarget: confirmModal }, false);
            }
        }
    });

    function setSuspendDays(days) {
        document.getElementById('customSuspendDays').value = days;
    }

    function confirmSuspend() {
        const days = parseInt(document.getElementById('customSuspendDays').value);
        if (!days || isNaN(days) || days <= 0) {
            showAlertModal('올바른 정지 기간(일)을 입력해주세요.');
            return;
        }
        
        document.getElementById('suspendModal').style.display = 'none';
        showConfirmModal(`해당 회원을 ${days}일 동안\n일시 정지 처리하시겠습니까?`, 
            () => processStatusUpdate(pendingSuspendTarget, 'SUSPENDED', days, pendingSuspendSelect),
            () => { 
                if (pendingSuspendSelect) {
                    pendingSuspendSelect.value = pendingSuspendSelect.getAttribute('data-original');
                }
                pendingSuspendTarget = null;
                pendingSuspendSelect = null;
            }
        );
    }
