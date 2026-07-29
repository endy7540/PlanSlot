let allRows = [];
    let filteredRows = [];
    let currentPage = 1;
    const itemsPerPage = 10;

    document.addEventListener("DOMContentLoaded", () => {
        const rows = document.querySelectorAll('.report-row');
        allRows = Array.from(rows);
        filteredRows = [...allRows];
        renderTable();
    });

    function searchReports() {
        const type = document.getElementById('reportSearchType').value;
        const input = document.getElementById('reportSearchInput').value.toLowerCase();
        
        filteredRows = allRows.filter(row => {
            const target = row.querySelector('.report-target').innerText.toLowerCase();
            const reason = row.querySelector('.report-reason').innerText.toLowerCase();
            const reporter = row.querySelector('.report-reporter').innerText.toLowerCase();
            const reported = row.querySelector('.report-reported').innerText.toLowerCase();
            
            if (type === 'ALL') {
                return target.includes(input) || reason.includes(input) || reporter.includes(input) || reported.includes(input);
            } else if (type === 'TITLE') {
                return target.includes(input);
            } else if (type === 'REASON') {
                return reason.includes(input);
            } else if (type === 'REPORTER') {
                return reporter.includes(input);
            } else if (type === 'REPORTED') {
                return reported.includes(input);
            }
            return true;
        });

        currentPage = 1;
        document.getElementById('totalReportCountSpan').innerText = filteredRows.length;
        renderTable();
    }

    function renderTable() {
        allRows.forEach(row => row.style.display = 'none');

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

    function openModal(targetType, targetContent, targetBody, reasonCode, reasonDetail, reporterNickname, reportedNickname) {
        document.getElementById('modalReasonCode').innerText = reasonCode;
        document.getElementById('modalReporter').innerText = reporterNickname;
        document.getElementById('modalReported').innerText = reportedNickname;
        document.getElementById('modalReasonDetail').innerText = reasonDetail;
        
        let targetLabelText = '신고 대상';
        if (targetType === 'POST') targetLabelText = '신고 대상 게시물';
        else if (targetType === 'COMMENT') targetLabelText = '신고 대상 댓글';
        else if (targetType === 'CHAT') targetLabelText = '신고 대상 채팅방';
        
        document.getElementById('modalTargetLabel').innerText = targetLabelText;
        document.getElementById('modalTitleBadge').innerText = targetType === 'POST' ? '제목' : (targetType === 'CHAT' ? '방 이름' : '내용');
        document.getElementById('modalTargetContent').innerText = targetContent;
        
        if ((targetType === 'POST' || targetType === 'CHAT') && targetBody) {
            document.getElementById('modalTargetBodyContainer').style.display = 'block';
            document.getElementById('modalTargetBody').innerText = targetBody;
        } else {
            document.getElementById('modalTargetBodyContainer').style.display = 'none';
        }
        
        document.getElementById('reportModal').style.display = 'flex';
    }
    
    function closeModal(e) {
        if(e) e.preventDefault();
        document.getElementById('reportModal').style.display = 'none';
    }

    async function processReport(reportId, action) {
        if(!confirm(action === 'approve' ? '해당 대상을 정말로 [삭제 조치] 하시겠습니까?' : '이 신고를 [기각] 처리하시겠습니까? (대상은 유지됩니다)')) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/reports/${reportId}/${action}`, {
                method: 'POST'
            });

            const result = await response.text();
            if (response.ok) {
                alert(result);
                window.location.reload();
            } else {
                alert('처리 실패: ' + result);
            }
        } catch (error) {
            alert('서버 통신에 실패했습니다.');
        }
    }