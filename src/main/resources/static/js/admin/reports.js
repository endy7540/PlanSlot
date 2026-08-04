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

    // ESC 키로 모달 닫기
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            const alertModal = document.getElementById('alertModal');
            if (alertModal && alertModal.style.display === 'flex') {
                closeAlertModal({ type: 'click', target: alertModal, currentTarget: alertModal }, false);
                return;
            }
            const confirmModal = document.getElementById('confirmModal');
            if (confirmModal && confirmModal.style.display === 'flex') {
                closeConfirmModal({ type: 'click', target: confirmModal, currentTarget: confirmModal }, false);
                return;
            }
            const modal = document.getElementById('reportModal');
            if (modal && modal.style.display === 'flex') {
                closeModal();
            }
        }
    });

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

    function processReport(reportId, action) {
        const msg = action === 'approve' 
            ? '해당 대상을 정말로 [삭제 조치] 하시겠습니까?' 
            : '이 신고를 [기각] 처리하시겠습니까?\n(대상은 유지됩니다)';
            
        showConfirmModal(msg, async () => {
            try {
                const response = await fetch(`/api/admin/reports/${reportId}/${action}`, {
                    method: 'POST'
                });

                const result = await response.text();
                if (response.ok) {
                    showAlertModal(result, () => { window.location.reload(); });
                } else {
                    showAlertModal('처리 실패: ' + result);
                }
            } catch (error) {
                console.error('Error:', error);
                showAlertModal('네트워크 오류가 발생했습니다.');
            }
        });
    }