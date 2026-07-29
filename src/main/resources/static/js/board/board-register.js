let existingRegisterImage = null;
let removeExistingRegisterImage = false;
let selectedRegisterImage = null;
let selectedRegisterImagePreviewUrl = null;

async function initializeBoardRegister() {
  const type = getRegisterBoardType();
  if (!type || !BOARD_TYPE_INFO[type]) {
    showRegisterAccessDenied('게시판 유형을 확인할 수 없습니다. 목록에서 다시 글쓰기를 눌러 주세요.');
    return;
  }

  document.body.dataset.boardType = type;
  document.querySelectorAll('[data-board-nav]').forEach(link => link.classList.toggle('active', link.dataset.boardNav === type));

  if (!currentBoardMember) {
    showBoardLoginPanel();
    return;
  }
  if (type === 'NOTICE' && currentBoardMember.role !== 'ADMIN') {
    showRegisterAccessDenied('공지사항은 관리자만 작성할 수 있습니다.');
    return;
  }

  const boardId = Number(new URLSearchParams(location.search).get('boardId')) || null;
  const returnTo = getBoardReturnUrl(type);
  const form = document.getElementById('boardRegisterForm');
  const titleInput = document.getElementById('boardRegisterTitle');
  const contentInput = document.getElementById('boardRegisterContent');
  const imageInput = document.getElementById('boardRegisterImage');
  const imageSelectButton = document.getElementById('boardRegisterImageSelect');

  document.getElementById('boardRegisterCategory').textContent = BOARD_TYPE_INFO[type].label;
  document.getElementById('boardRegisterPageTitle').textContent = boardId ? '게시글 수정' : '새 게시글 작성';
  document.getElementById('boardRegisterSubmit').textContent = boardId ? '수정 완료' : '등록하기';
  document.getElementById('boardRegisterListLink').href = returnTo;
  document.getElementById('boardRegisterCancel').addEventListener('click', () => {
    location.href = boardId ? buildBoardReadUrl(boardId, returnTo) : returnTo;
  });

  titleInput.addEventListener('input', () => updateRegisterCount('boardRegisterTitleCount', titleInput.value.length, 100));
  contentInput.addEventListener('input', () => updateRegisterCount('boardRegisterContentCount', contentInput.value.length, 1000));
  imageInput.addEventListener('change', handleRegisterImageSelection);
  imageSelectButton?.addEventListener('click', () => imageInput.click());
  initializeRegisterImageDropzone(imageSelectButton);
  document.getElementById('boardRegisterImageRemove').addEventListener('click', clearRegisterImage);
  form.addEventListener('submit', event => saveBoardPost(event, type, boardId));

  if (boardId && !(await loadBoardForEdit(boardId, type))) return;
  document.getElementById('boardRegisterPanel').hidden = false;
  document.getElementById('boardRegisterLoading').hidden = true;
}
async function loadBoardForEdit(boardId, expectedType) {
  try {
    const board = await fetchBoardJson(`/board/${boardId}?increaseView=false`);

    if (board.boardType !== expectedType) {
      showRegisterAccessDenied('게시판 유형이 올바르지 않습니다.');
      return false;
    }

    const canEditBoard = currentBoardMember && (
      Number(currentBoardMember.memberId) === Number(board.writerId) ||
      (board.boardType === 'NOTICE' && currentBoardMember.role === 'ADMIN')
    );

    if (!canEditBoard) {
      showRegisterAccessDenied(expectedType === 'NOTICE' ? '공지사항은 작성자 또는 관리자만 수정할 수 있습니다.' : '게시글 작성자만 수정할 수 있습니다.');
      return false;
    }

    document.getElementById('boardRegisterTitle').value = board.title || '';
    document.getElementById('boardRegisterContent').value = board.content || '';
    updateRegisterCount('boardRegisterTitleCount', (board.title || '').length, 100);
    updateRegisterCount('boardRegisterContentCount', (board.content || '').length, 1000);

    if (board.boardImage?.fileUrl) {
      existingRegisterImage = board.boardImage;
      updateRegisterImageFileName('현재 등록된 이미지');
      showRegisterImagePreview(board.boardImage.fileUrl);
    }
  } catch (error) {
    showRegisterAccessDenied(error.message);
    return false;
  }

  return true;
}
async function saveBoardPost(event, type, boardId) {
  event.preventDefault();
  if (!requireBoardLogin()) return;

  const title = document.getElementById('boardRegisterTitle').value.trim();
  const content = document.getElementById('boardRegisterContent').value.trim();
  if (!title) {
    showBoardToast('제목을 입력해 주세요.', true);
    return;
  }
  if (!content) {
    showBoardToast('내용을 입력해 주세요.', true);
    return;
  }
  if (title.length > 100 || content.length > 1000) {
    showBoardToast('제목 또는 내용의 글자 수를 확인해 주세요.', true);
    return;
  }

  const submit = document.getElementById('boardRegisterSubmit');
  await runBoardRequest(`save-board-${boardId || 'new'}`, submit, '저장 중...', async () => {
    let savedBoardId = boardId;

    try {
      if (boardId) {
        await fetchBoardJson(`/board/${boardId}`, {
          method: 'PUT',
          body: JSON.stringify({ title, content })
        });
      } else {
        const boardTypePath = BOARD_TYPE_INFO[type]?.path;
        if (!boardTypePath) throw new Error('게시판 유형을 확인할 수 없습니다.');

        savedBoardId = await fetchBoardJson(`/board/type/${encodeURIComponent(boardTypePath)}`, {
          method: 'POST',
          body: JSON.stringify({ title, content })
        });
        savedBoardId = Number(savedBoardId);
        if (!Number.isInteger(savedBoardId) || savedBoardId <= 0) throw new Error('등록된 게시글 번호를 확인할 수 없습니다.');
      }
    } catch (error) {
      showBoardToast(error.message, true);
      return;
    }

    let imageErrorOccurred = false;
    if (selectedRegisterImage) {
      try {
        const formData = new FormData();
        formData.append('image', selectedRegisterImage);
        await fetchBoardJson(`/board/${savedBoardId}/image`, { method: 'POST', body: formData });
      } catch (imageError) {
        imageErrorOccurred = true;
        console.error('이미지 업로드 실패:', imageError);
      }
    } else if (boardId && removeExistingRegisterImage && existingRegisterImage) {
      try {
        await fetchBoardJson(`/board/${boardId}/image/${existingRegisterImage.fileId}`, { method: 'DELETE' });
      } catch (imageError) {
        imageErrorOccurred = true;
        console.error('이미지 삭제 실패:', imageError);
      }
    }

    if (imageErrorOccurred) {
      storeBoardToast(boardId ? '게시글 수정은 완료되었으나 이미지 처리 중 오류가 발생했습니다.' : '게시글은 등록되었으나 이미지 업로드에 실패했습니다.', true);
    } else {
      showBoardToast(boardId ? '게시글을 수정했습니다.' : '게시글을 등록했습니다.', false, 'success');
    }

    await new Promise(resolve => setTimeout(resolve, imageErrorOccurred ? 100 : 600));
    location.href = buildBoardReadUrl(savedBoardId, getBoardReturnUrl(type));
  });
}
function handleRegisterImageSelection(event) {
  const file = event.target.files?.[0];

  if (!file) return;

  applyRegisterImageFile(file);
}
function initializeRegisterImageDropzone(dropzone) {
  if (!dropzone) return;

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, event => {
      event.preventDefault();
      dropzone.classList.add('dragging');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, event => {
      event.preventDefault();
      dropzone.classList.remove('dragging');
    });
  });

  dropzone.addEventListener('drop', event => {
    const file = event.dataTransfer?.files?.[0];
    if (file) applyRegisterImageFile(file);
  });
}
function applyRegisterImageFile(file) {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

  if (!allowedTypes.includes(file.type)) {
    document.getElementById('boardRegisterImage').value = '';
    showBoardToast('JPG, PNG, WEBP 이미지 파일만 첨부할 수 있습니다.', true);
    return;
  }

  if (selectedRegisterImagePreviewUrl) URL.revokeObjectURL(selectedRegisterImagePreviewUrl);

  selectedRegisterImage = file;
  removeExistingRegisterImage = false;
  selectedRegisterImagePreviewUrl = URL.createObjectURL(file);
  updateRegisterImageFileName(file.name);
  showRegisterImagePreview(selectedRegisterImagePreviewUrl);
}
function clearRegisterImage() {
  document.getElementById('boardRegisterImage').value = '';
  if (selectedRegisterImagePreviewUrl) URL.revokeObjectURL(selectedRegisterImagePreviewUrl);
  selectedRegisterImagePreviewUrl = null;
  selectedRegisterImage = null;
  removeExistingRegisterImage = Boolean(existingRegisterImage);
  updateRegisterImageFileName('선택된 파일 없음');
  document.getElementById('boardRegisterImagePreviewWrap').classList.remove('show');
  document.getElementById('boardRegisterImagePreview').removeAttribute('src');
}
function updateRegisterImageFileName(fileName) {
  const fileNameElement = document.getElementById('boardRegisterImageFileName');
  const dropzone = document.getElementById('boardRegisterImageSelect');

  if (fileNameElement) fileNameElement.textContent = fileName;
  if (dropzone) dropzone.classList.toggle('has-file', fileName !== '선택된 파일 없음');
}
function showRegisterImagePreview(url) {
  const wrap = document.getElementById('boardRegisterImagePreviewWrap');
  const image = document.getElementById('boardRegisterImagePreview');

  image.src = url;
  wrap.classList.add('show');
}
function showRegisterAccessDenied(message) {
  document.getElementById('boardRegisterLoading').innerHTML = `
    <div class="board-auth-panel">
      <h2>작성할 수 없습니다</h2>
      <p>${escapeBoardHtml(message)}</p>
      <a class="board-btn board-btn-primary" href="/board/notice">게시판으로 돌아가기</a>
    </div>
  `;

  document.getElementById('boardRegisterPanel').hidden = true;
}
function showBoardLoginPanel() {
  document.querySelectorAll('[data-board-auth-content]').forEach(element => {
    element.hidden = true;
  });

  const panel = document.getElementById('boardLoginPanel');

  if (panel) panel.hidden = false;
}
function updateRegisterCount(elementId, current, max) {
  const element = document.getElementById(elementId);

  if (element) element.textContent = `${current} / ${max}`;
}
