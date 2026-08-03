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

    async function updateStatus(memberId, status, selectElement) {
        let msg = '해당 회원의 상태를 정상으로 변경하시겠습니까?';
        let suspendDays = null;
        
        if (status === 'SUSPENDED') {
            const daysInput = prompt('일시 정지할 기간(일)을 숫자로 입력하세요.\n(예: 1=하루, 7=일주일, 30=한달)');
            if (!daysInput || isNaN(daysInput) || parseInt(daysInput) <= 0) {
                alert('올바른 기간을 입력하지 않아 취소되었습니다.');
                selectElement.value = selectElement.getAttribute('data-original');
                return;
            }
            suspendDays = parseInt(daysInput);
            msg = `해당 회원을 ${suspendDays}일 동안 일시 정지 처리하시겠습니까?`;
        } else if (status === 'BANNED') {
            msg = '해당 회원을 영구 정지(BANNED) 처리하시겠습니까? (사이트 이용 영구 제한)';
        }
        
        if(!confirm(msg)) {
            selectElement.value = selectElement.getAttribute('data-original');
            return;
        }

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
                alert('상태가 변경되었습니다.');
                window.location.reload();
            } else {
                alert('오류가 발생했습니다.');
                selectElement.value = selectElement.getAttribute('data-original');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('네트워크 오류가 발생했습니다.');
            selectElement.value = selectElement.getAttribute('data-original');
        }
    }
function changeMemberStatus(memberId, selectId) {
    const select = document.getElementById(selectId);
    updateStatus(memberId, select.value, select);
}
