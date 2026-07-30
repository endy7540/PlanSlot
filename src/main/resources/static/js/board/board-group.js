let boardGroupCandidates = null;
let boardGroupProfileBlob = null;
let boardGroupCropper = null;

function initializeBoardGroupModal() {
  const modal = document.getElementById('boardGroupModal');
  if (!modal) return;

  document.getElementById('boardGroupCancelStep1')?.addEventListener('click', closeBoardGroupModal);
  document.getElementById('boardGroupCancelStep2')?.addEventListener('click', closeBoardGroupModal);
  document.getElementById('boardGroupNext')?.addEventListener('click', showBoardGroupStep2);
  document.getElementById('boardGroupPrevious')?.addEventListener('click', showBoardGroupStep1);
  document.getElementById('boardGroupCreate')?.addEventListener('click', createBoardGroup);
  document.getElementById('boardGroupName')?.addEventListener('input', updateBoardGroupNameCount);
  document.getElementById('boardGroupProfileImage')?.addEventListener('change', openBoardGroupCropModal);
  document.getElementById('boardGroupCropCancel')?.addEventListener('click', closeBoardGroupCropModal);
  document.getElementById('boardGroupCropConfirm')?.addEventListener('click', applyBoardGroupCrop);

  modal.addEventListener('click', event => {
    if (event.target === modal) closeBoardGroupModal();
  });
  document.getElementById('boardGroupCropModal')?.addEventListener('click', event => {
    if (event.target.id === 'boardGroupCropModal') cancelBoardGroupCrop();
  });
}
async function openBoardGroupModal(board, button) {
  await runBoardRequest(`group-candidates-${board.boardId}`, button, '불러오는 중...', async () => {
    try {
      boardGroupCandidates = await fetchBoardJson(`/board/${board.boardId}/group/candidates`);
      resetBoardGroupSettings();
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
  hideBoardGroupCropModal();
  boardGroupCandidates = null;
  clearBoardGroupProfile();
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
function resetBoardGroupSettings() {
  clearBoardGroupProfile();
  document.querySelectorAll('[data-group-candidate]').forEach(input => input.checked = false);
}
function openBoardGroupCropModal(event) {
  const file = event.target.files?.[0];
  if (!file) {
    boardGroupProfileBlob = null;
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    showBoardToast('파일 크기는 5MB 이하여야 합니다.', true);
    event.target.value = '';
    boardGroupProfileBlob = null;
    return;
  }
  if (typeof Cropper === 'undefined') {
    showBoardToast('사진 편집 기능을 불러오지 못했습니다.', true);
    event.target.value = '';
    boardGroupProfileBlob = null;
    return;
  }

  const reader = new FileReader();
  reader.onload = loadEvent => {
    const image = document.getElementById('boardGroupCropImage');
    image.src = loadEvent.target.result;
    document.getElementById('boardGroupCropModal').classList.add('open');

    destroyBoardGroupCropper();
    boardGroupCropper = new Cropper(image, {
      aspectRatio: 1,
      viewMode: 1,
      autoCropArea: 1,
      dragMode: 'move',
      background: false
    });
  };
  reader.readAsDataURL(file);
}
function hideBoardGroupCropModal() {
  document.getElementById('boardGroupCropModal')?.classList.remove('open');
  destroyBoardGroupCropper();
}
function cancelBoardGroupCrop() {
  hideBoardGroupCropModal();
  const input = document.getElementById('boardGroupProfileImage');
  if (input) input.value = '';
  boardGroupProfileBlob = null;
}
function closeBoardGroupCropModal() {
  cancelBoardGroupCrop();
}
function destroyBoardGroupCropper() {
  if (!boardGroupCropper) return;
  boardGroupCropper.destroy();
  boardGroupCropper = null;
}
function applyBoardGroupCrop() {
  if (!boardGroupCropper) return;

  const confirmButton = document.getElementById('boardGroupCropConfirm');
  confirmButton.textContent = '적용 중...';
  confirmButton.disabled = true;

  boardGroupCropper.getCroppedCanvas({ width: 300, height: 300 }).toBlob(blob => {
    confirmButton.textContent = '적용';
    confirmButton.disabled = false;

    if (!blob) {
      showBoardToast('이미지 크롭에 실패했습니다.', true);
      return;
    }

    boardGroupProfileBlob = blob;
    hideBoardGroupCropModal();
    showBoardToast('사진이 적용되었습니다.', false, 'success');
  }, 'image/png');
}
function clearBoardGroupProfile() {
  boardGroupProfileBlob = null;
  const input = document.getElementById('boardGroupProfileImage');
  if (input) input.value = '';
}
async function uploadBoardGroupProfile(groupId) {
  if (!boardGroupProfileBlob) return;

  const formData = new FormData();
  formData.append('file', boardGroupProfileBlob, 'group-profile.png');
  await fetchBoardJson(`/group/${groupId}/image`, { method: 'POST', body: formData });
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
        body: JSON.stringify({ groupName, selectedApplicantIds, selectedInviteeIds })
      });

      let profileUploadFailed = false;
      if (response?.groupId && boardGroupProfileBlob) {
        try {
          await uploadBoardGroupProfile(response.groupId);
        } catch (error) {
          profileUploadFailed = true;
          console.error(error);
        }
      }

      closeBoardGroupModal();
      showBoardToast(profileUploadFailed ? '모임은 생성됐지만 프로필 사진 등록에 실패했습니다.' : '모임 캘린더를 생성했습니다.', profileUploadFailed, profileUploadFailed ? '' : 'success');
      if (response?.groupId) {
        await new Promise(resolve => setTimeout(resolve, 700));
        location.href = `/group/read?id=${response.groupId}`;
      }
    } catch (error) {
      showBoardToast(error.message, true);
    }
  });
}
