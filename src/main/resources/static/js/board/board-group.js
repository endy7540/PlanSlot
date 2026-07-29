let boardGroupCandidates = null;

function initializeBoardGroupModal() {
  const modal = document.getElementById('boardGroupModal');
  if (!modal) return;

  document.getElementById('boardGroupCancelStep1')?.addEventListener('click', closeBoardGroupModal);
  document.getElementById('boardGroupCancelStep2')?.addEventListener('click', closeBoardGroupModal);
  document.getElementById('boardGroupNext')?.addEventListener('click', showBoardGroupStep2);
  document.getElementById('boardGroupPrevious')?.addEventListener('click', showBoardGroupStep1);
  document.getElementById('boardGroupCreate')?.addEventListener('click', createBoardGroup);
  document.getElementById('boardGroupName')?.addEventListener('input', updateBoardGroupNameCount);
  modal.addEventListener('click', event => {
    if (event.target === modal) closeBoardGroupModal();
  });
}
async function openBoardGroupModal(board, button) {
  await runBoardRequest(`group-candidates-${board.boardId}`, button, '불러오는 중...', async () => {
    try {
      boardGroupCandidates = await fetchBoardJson(`/board/${board.boardId}/group/candidates`);
      document.getElementById('boardGroupName').value = boardGroupCandidates.groupName || board.title || '';
      updateBoardGroupNameCount();
      renderBoardGroupCandidates('boardApplicantCandidates', boardGroupCandidates.applicants || [], 'applicant');
      renderBoardGroupCandidates('boardInviteCandidates', boardGroupCandidates.inviteCandidates || [], 'invitee');
      showBoardGroupStep1();
      document.getElementById('boardGroupModal').classList.add('open');
    } catch (error) {
      showBoardToast(error.message, true);
    }
  });
}
function closeBoardGroupModal() {
  document.getElementById('boardGroupModal')?.classList.remove('open');
  boardGroupCandidates = null;
}
function showBoardGroupStep1() {
  document.getElementById('boardGroupStep1').hidden = false;
  document.getElementById('boardGroupStep2').hidden = true;
}
function showBoardGroupStep2() {
  const groupName = document.getElementById('boardGroupName').value.trim();

  if (!groupName) {
    showBoardToast('모임 이름을 입력해 주세요.', true);
    return;
  }
  if (groupName.length > 30) {
    showBoardToast('모임 이름은 30자 이하로 입력해 주세요.', true);
    return;
  }

  document.getElementById('boardGroupStep1').hidden = true;
  document.getElementById('boardGroupStep2').hidden = false;
}
function renderBoardGroupCandidates(elementId, candidates, type) {
  const container = document.getElementById(elementId);

  if (!candidates.length) {
    container.innerHTML = `<div class="board-group-candidate-empty">${type === 'applicant' ? '현재 대기 중인 신청자가 없습니다.' : '신청자와 게시글 작성자를 제외한 추가 댓글 작성자가 없습니다.'}</div>`;
    return;
  }

  container.innerHTML = candidates.map(candidate => `
    <label class="board-group-candidate">
      <input type="checkbox" data-group-candidate="${type}" value="${candidate.memberId}">
      <span>${escapeBoardHtml(candidate.nickname)}</span>
    </label>
  `).join('');
}
function getSelectedBoardGroupIds(type) {
  return Array.from(document.querySelectorAll(`[data-group-candidate="${type}"]:checked`)).map(input => Number(input.value));
}
function updateBoardGroupNameCount() {
  const input = document.getElementById('boardGroupName');
  const count = document.getElementById('boardGroupNameCount');
  if (input && count) count.textContent = `${input.value.length} / 30`;
}
async function createBoardGroup() {
  if (!boardGroupCandidates || !currentReadBoard) return;

  const groupName = document.getElementById('boardGroupName').value.trim();
  const selectedApplicantIds = getSelectedBoardGroupIds('applicant');
  const selectedInviteeIds = getSelectedBoardGroupIds('invitee');

  if (!groupName) {
    showBoardToast('모임 이름을 입력해 주세요.', true);
    showBoardGroupStep1();
    return;
  }
  if (!selectedApplicantIds.length && !selectedInviteeIds.length) {
    showBoardToast('신청자 또는 초대 대상자를 한 명 이상 선택해 주세요.', true);
    return;
  }

  const createButton = document.getElementById('boardGroupCreate');
  await runBoardRequest(`create-group-${currentReadBoard.boardId}`, createButton, '생성 중...', async () => {
    try {
      const response = await fetchBoardJson(`/board/${currentReadBoard.boardId}/group/create`, {
        method: 'POST',
        body: JSON.stringify({
          groupName,
          selectedApplicantIds,
          selectedInviteeIds
        })
      });

      closeBoardGroupModal();
      showBoardToast('모임 캘린더를 생성했습니다.', false, 'success');
      if (response?.groupId) {
        await new Promise(resolve => setTimeout(resolve, 500));
        location.href = `/group/read?id=${response.groupId}`;
      }
    } catch (error) {
      showBoardToast(error.message, true);
    }
  });
}
