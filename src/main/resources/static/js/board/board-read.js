let reportTarget = null;
let currentCommentPage = 0;
let currentReadBoard = null;

function initializeReportModal() {
  const modal = document.getElementById('boardReportModal');
  const cancelButton = document.getElementById('boardReportCancel');
  const submitButton = document.getElementById('boardReportSubmit');

  if (!modal || !cancelButton || !submitButton) return;

  cancelButton.addEventListener('click', closeReportModal);

  modal.addEventListener('click', event => {
    if (event.target === modal) closeReportModal();
  });

  submitButton.addEventListener('click', submitBoardReport);
}
async function openReportModal(targetType, targetId) {
  if (!requireBoardLogin()) return;

  const path = targetType === 'POST'
      ? `/board/${targetId}/report/check`
      : `/board/comment/${targetId}/report/check`;

  await runBoardRequest(`report-check-${targetType}-${targetId}`, null, '', async () => {
    try {
      const duplicated = await fetchBoardJson(path);
      if (duplicated) {
        if (targetType === 'POST') document.getElementById('boardReportButton')?.classList.add('board-btn-reported');
        showBoardToast(targetType === 'POST' ? '이미 신고한 게시글입니다.' : '이미 신고한 댓글입니다.', true);
        return;
      }

      reportTarget = { targetType, targetId };
      document.getElementById('boardReportReason').value = '';
      document.getElementById('boardReportDetail').value = '';
      document.getElementById('boardReportTitle').textContent = targetType === 'POST' ? '게시글 신고' : '댓글 신고';
      document.getElementById('boardReportModal').classList.add('open');
    } catch (error) {
      showBoardToast(error.message, true);
    }
  });
}
function closeReportModal() {
  document.getElementById('boardReportModal')?.classList.remove('open');
  reportTarget = null;
}
async function submitBoardReport() {
  if (!reportTarget) return;

  const reasonCode = document.getElementById('boardReportReason').value;
  const reasonDetail = document.getElementById('boardReportDetail').value.trim();

  if (!reasonCode) {
    showBoardToast('신고 사유를 선택해 주세요.', true);
    return;
  }
  if (reasonCode === 'OTHER' && !reasonDetail) {
    showBoardToast('기타 신고 사유의 세부내용을 입력해 주세요.', true);
    return;
  }
  if (reasonDetail.length > 200) {
    showBoardToast('신고 세부내용은 200자 이하로 입력해 주세요.', true);
    return;
  }

  const target = { ...reportTarget };
  const path = target.targetType === 'POST'
      ? `/board/${target.targetId}/report`
      : `/board/comment/${target.targetId}/report`;
  const submitButton = document.getElementById('boardReportSubmit');

  await runBoardRequest(`report-${target.targetType}-${target.targetId}`, submitButton, '접수 중...', async () => {
    try {
      await fetchBoardJson(path, {
        method: 'POST',
        body: JSON.stringify({ reasonCode, reasonDetail })
      });

      closeReportModal();
      if (target.targetType === 'POST') document.getElementById('boardReportButton')?.classList.add('board-btn-reported');
      showBoardToast('신고가 접수되었습니다.', false, 'success');
    } catch (error) {
      if (error.status === 409) {
        if (target.targetType === 'POST') document.getElementById('boardReportButton')?.classList.add('board-btn-reported');
        showBoardToast(target.targetType === 'POST' ? '이미 신고한 게시글입니다.' : '이미 신고한 댓글입니다.', true);
        return;
      }
      showBoardToast(error.message, true);
    }
  });
}
async function initializeBoardRead() {
  const boardId = getPathNumberAfter('read');

  if (!boardId) {
    redirectToBoardHome('게시글 주소가 올바르지 않습니다.');
    return;
  }

  const commentSubmitButton = document.getElementById('boardCommentSubmit');
  const commentTextarea = document.getElementById('boardCommentContent');
  commentSubmitButton?.addEventListener('click', event => createBoardComment(boardId, null, null, event.currentTarget));
  commentTextarea?.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    createBoardComment(boardId, null, null, commentSubmitButton);
  });
  document.getElementById('boardBackButton')?.addEventListener('click', () => location.href = getBoardReturnUrl());
  document.getElementById('boardCommentList')?.addEventListener('click', event => handleCommentAction(event, boardId));
  updateBoardCommentFormState();

  const readLoaded = await loadBoardRead(boardId);
  if (!readLoaded) {
    document.querySelector('.board-comments')?.setAttribute('hidden', '');
    return;
  }

  await loadBoardComments(boardId);
}
async function loadBoardRead(boardId) {
  const article = document.getElementById('boardArticle');

  try {
    const board = await fetchBoardJson(`/board/${boardId}`);
    const boardTypeInfo = BOARD_TYPE_INFO[board?.boardType];
    if (!boardTypeInfo) throw new Error('게시글 정보를 불러올 수 없습니다.');

    currentReadBoard = board;
    document.body.dataset.boardType = board.boardType;
    document.querySelectorAll('[data-board-nav]').forEach(link => link.classList.toggle('active', link.dataset.boardNav === board.boardType));

    document.title = `PlanSlot - ${board.title}`;
    document.getElementById('boardReadCategory').textContent = boardTypeInfo.label;
    document.getElementById('boardReadTitle').textContent = board.title;
    renderBoardReadWriter(board);
    document.getElementById('boardReadDate').textContent = formatBoardDateTimeWithModified(board.createdAt, board.updatedAt);
    document.getElementById('boardReadViews').textContent = `조회 ${board.viewCount ?? 0}`;
    document.getElementById('boardReadContent').textContent = board.content || '';
    document.getElementById('boardReadCommentCount').textContent = board.commentCount ?? 0;
    document.getElementById('boardListLink').href = getBoardReturnUrl(board.boardType);
    document.getElementById('boardListLink').textContent = boardTypeInfo.label;
    renderReadRecruitmentBadges(board);

    const image = document.getElementById('boardReadImage');
    if (board.boardImage?.fileUrl) {
      image.src = board.boardImage.fileUrl;
      image.alt = `${board.title} 첨부 이미지`;
      image.hidden = false;
    } else {
      image.hidden = true;
    }

    renderBoardReadActions(board);
    article.hidden = false;
    document.getElementById('boardReadLoading').hidden = true;
    return true;
  } catch (error) {
    if (error.status === 404 || error.status === 410) {
      redirectToBoardHome(error.message);
      return false;
    }

    const message = error.status ? error.message : '게시글 정보를 불러오는 중 오류가 발생했습니다.';
    document.getElementById('boardReadLoading').innerHTML = `<div class="board-error">${escapeBoardHtml(message)}</div>`;
    return false;
  }
}
function renderBoardReadWriter(board) {
  const writer = document.getElementById('boardReadWriter');
  const nickname = board.writerNickname || '알 수 없음';

  writer.className = 'board-read-author';
  writer.innerHTML = `
    ${renderBoardProfileAvatar(board.writerProfileImageUrl, nickname, 'board-read-avatar')}
    <span class="board-read-author-name">${escapeBoardHtml(nickname)}</span>
  `;

  initializeBoardProfileImages(writer);
}
function renderBoardProfileAvatar(profileImageUrl, nickname, avatarClass) {
  const safeNickname = nickname || '알 수 없음';
  const imageUrl = profileImageUrl || '/images/default-avatar.png';

  return `
    <span class="board-profile-avatar ${avatarClass}">
      <img src="${escapeBoardAttribute(imageUrl)}" alt="${escapeBoardAttribute(safeNickname)} 프로필 이미지" loading="lazy" data-board-profile-image>
    </span>
  `;
}
function initializeBoardProfileImages(container) {
  container.querySelectorAll('[data-board-profile-image]').forEach(image => {
    const avatar = image.closest('.board-profile-avatar');
    const localDefaultImage = '/images/default-avatar.png';
    const externalDefaultImage = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';

    const showImage = () => {
      image.hidden = false;
      avatar?.classList.add('has-profile-image');
    };

    const showFallback = () => {
      if (!image.dataset.boardLocalFallback && image.getAttribute('src') !== localDefaultImage) {
        image.dataset.boardLocalFallback = 'true';
        image.src = localDefaultImage;
        return;
      }
      if (!image.dataset.boardExternalFallback) {
        image.dataset.boardExternalFallback = 'true';
        image.src = externalDefaultImage;
        return;
      }
      image.hidden = true;
      avatar?.classList.remove('has-profile-image');
    };

    image.addEventListener('load', showImage);
    image.addEventListener('error', showFallback);

    if (image.complete) {
      if (image.naturalWidth > 0) showImage();
      else showFallback();
    }
  });
}
function renderBoardReadActions(board) {
  const actions = document.getElementById('boardReadActions');
  const isLoggedIn = Boolean(currentBoardMember);
  const isWriter = isLoggedIn && Number(currentBoardMember.memberId) === Number(board.writerId);
  const recruitmentBoard = isRecruitmentBoard(board.boardType);
  const recruitmentOpen = board.recruitmentStatus === 'OPEN';
  const groupCreated = Boolean(board.groupId);
  const canOpenGroup = isLoggedIn && groupCreated && (isWriter || board.myGroupMemberStatus === 'ACTIVE' || board.myGroupMemberStatus === 'WAITING');
  const returnTo = getBoardReturnUrl(board.boardType);
  let recruitmentActions = '';
  let managementActions = '';

  if (isLoggedIn && recruitmentBoard && isWriter && !groupCreated) {
    recruitmentActions += '<button class="board-btn board-btn-sky" type="button" id="boardGroupOpenButton">모임 만들기</button>';
    recruitmentActions += `<button class="board-btn board-btn-ghost" type="button" id="boardRecruitmentStatusButton">${recruitmentOpen ? '모집 마감' : '모집 재개'}</button>`;
  }
  if (recruitmentBoard && !isWriter && recruitmentOpen && !groupCreated && !board.myApplicationStatus) {
    recruitmentActions += '<button class="board-btn board-btn-sky" type="button" id="boardApplyButton">신청하기</button>';
  }
  if (isLoggedIn && recruitmentBoard && !isWriter && !groupCreated && board.myApplicationStatus === 'PENDING') {
    recruitmentActions += '<button class="board-btn board-btn-ghost" type="button" id="boardApplicationCancelButton">신청 취소</button>';
  }
  if (canOpenGroup) {
    recruitmentActions += '<button class="board-btn board-btn-primary" type="button" id="boardGroupViewButton">모임 보기</button>';
  }

  const canEditBoard = isWriter || (board.boardType === 'NOTICE' && currentBoardMember?.role === 'ADMIN');
  const canDeleteBoard = isWriter || currentBoardMember?.role === 'ADMIN';

  let editAction = '';
  let deleteAction = '';
  let reportAction = '';

  if (canEditBoard) {
    const editUrl = buildBoardUrlWithReturnTo(`/board/register/${BOARD_TYPE_INFO[board.boardType].path}?boardId=${board.boardId}`, returnTo);
    editAction = `<a class="board-btn board-btn-ghost" href="${escapeBoardAttribute(editUrl)}">수정</a>`;
  }
  if (canDeleteBoard) {
    deleteAction = '<button class="board-btn board-btn-danger" type="button" id="boardDeleteButton">삭제</button>';
  }
  if (board.boardType !== 'NOTICE' && !isWriter && !canDeleteBoard) {
    reportAction = '<button class="board-btn board-btn-danger" type="button" id="boardReportButton">신고</button>';
  }

  managementActions = `${editAction}${deleteAction}${reportAction}`;

  actions.innerHTML = `
    <div class="board-action-group">
      <button class="board-btn board-btn-ghost" type="button" id="boardReadListButton">목록으로</button>
      ${recruitmentActions}
    </div>
    <div class="board-action-group">${managementActions}</div>
  `;

  document.getElementById('boardReadListButton').addEventListener('click', () => location.href = returnTo);
  document.getElementById('boardReportButton')?.addEventListener('click', () => openReportModal('POST', board.boardId));
  document.getElementById('boardDeleteButton')?.addEventListener('click', event => deleteBoardPost(board, event.currentTarget));
  document.getElementById('boardApplyButton')?.addEventListener('click', event => applyToBoardGroup(board.boardId, event.currentTarget));
  document.getElementById('boardApplicationCancelButton')?.addEventListener('click', event => cancelBoardApplication(board.boardId, event.currentTarget));
  document.getElementById('boardGroupOpenButton')?.addEventListener('click', event => openBoardGroupModal(board, event.currentTarget));
  document.getElementById('boardRecruitmentStatusButton')?.addEventListener('click', event => updateBoardRecruitmentStatus(board, event.currentTarget));
  document.getElementById('boardGroupViewButton')?.addEventListener('click', () => location.href = `/group/read?id=${board.groupId}`);
  updateBoardReportButtonState(board.boardId);
}
async function updateBoardReportButtonState(boardId) {
  const reportButton = document.getElementById('boardReportButton');
  if (!reportButton || !currentBoardMember) return;

  try {
    const duplicated = await fetchBoardJson(`/board/${boardId}/report/check`);
    reportButton.classList.toggle('board-btn-reported', Boolean(duplicated));
  } catch (error) {
    if (error.status !== 401 && error.status !== 403) console.warn('게시글 신고 여부를 확인하지 못했습니다.', error);
  }
}
function updateBoardCommentFormState() {
  const form = document.getElementById('boardCommentForm');
  if (form) form.hidden = false;
}
function renderReadRecruitmentBadges(board) {
  const container = document.getElementById('boardReadRecruitmentBadges');
  if (!container) return;

  if (!isRecruitmentBoard(board.boardType)) {
    container.hidden = true;
    container.innerHTML = '';
    return;
  }

  const statusBadge = board.recruitmentStatus === 'CLOSED'
      ? '<span class="board-recruitment-badge closed">모집 마감</span>'
      : '<span class="board-recruitment-badge open">모집 중</span>';
  container.innerHTML = statusBadge;
  container.hidden = false;
}
async function applyToBoardGroup(boardId, button) {
  if (!requireBoardLogin()) return;

  await runBoardRequest(`apply-${boardId}`, button, '신청 중...', async () => {
    try {
      await fetchBoardJson(`/board/${boardId}/group/applications`, { method: 'POST' });
      currentReadBoard.myApplicationStatus = 'PENDING';
      renderBoardReadActions(currentReadBoard);
      showBoardToast('모임 참가를 신청했습니다.', false, 'success');
    } catch (error) {
      showBoardToast(error.message, true);
    }
  });
}
async function cancelBoardApplication(boardId, button) {
  if (!requireBoardLogin() || !confirm('참가 신청을 취소하시겠습니까?')) return;

  await runBoardRequest(`cancel-application-${boardId}`, button, '취소 중...', async () => {
    try {
      await fetchBoardJson(`/board/${boardId}/group/applications/me`, { method: 'DELETE' });
      currentReadBoard.myApplicationStatus = null;
      renderBoardReadActions(currentReadBoard);
      showBoardToast('참가 신청을 취소했습니다.', false, 'success');
    } catch (error) {
      showBoardToast(error.message, true);
    }
  });
}
async function updateBoardRecruitmentStatus(board, button) {
  if (!requireBoardLogin()) return;

  const nextStatus = board.recruitmentStatus === 'OPEN' ? 'CLOSED' : 'OPEN';
  const actionLabel = nextStatus === 'CLOSED' ? '마감' : '재개';
  const confirmMessage = nextStatus === 'CLOSED'
      ? '모집을 마감하시겠습니까? 기존 신청 내역은 유지되며 모임은 계속 만들 수 있습니다.'
      : '모집을 다시 시작하시겠습니까?';
  if (!confirm(confirmMessage)) return;

  await runBoardRequest(`recruitment-${board.boardId}`, button, `${actionLabel} 중...`, async () => {
    try {
      const updatedBoard = await fetchBoardJson(`/board/${board.boardId}/recruitment-status?status=${nextStatus}`, { method: 'PATCH' });
      currentReadBoard = updatedBoard;
      renderReadRecruitmentBadges(updatedBoard);
      renderBoardReadActions(updatedBoard);
      showBoardToast(`모집을 ${actionLabel}했습니다.`, false, 'success');
    } catch (error) {
      showBoardToast(error.message, true);
    }
  });
}
async function deleteBoardPost(board, button) {
  if (!requireBoardLogin() || !confirm('게시글을 삭제하시겠습니까?')) return;

  await runBoardRequest(`delete-board-${board.boardId}`, button, '삭제 중...', async () => {
    try {
      await fetchBoardJson(`/board/${board.boardId}`, { method: 'DELETE' });
      showBoardToast('게시글을 삭제했습니다.', false, 'success');
      await new Promise(resolve => setTimeout(resolve, 450));
      location.href = getBoardReturnUrl(board.boardType);
    } catch (error) {
      showBoardToast(error.message, true);
    }
  });
}
async function loadBoardComments(boardId, moveToLastPage = false) {
  const list = document.getElementById('boardCommentList');
  const pagination = document.getElementById('boardCommentPagination');
  list.innerHTML = '<div class="board-loading">댓글을 불러오는 중...</div>';
  if (pagination) pagination.innerHTML = '';

  const params = new URLSearchParams({ page: currentCommentPage, size: 10 });

  try {
    const page = await fetchBoardJson(`/board/${boardId}/comments?${params}`);
    const totalPages = page.totalPages || 0;

    if (moveToLastPage && totalPages > 0 && currentCommentPage !== totalPages - 1) {
      currentCommentPage = totalPages - 1;
      await loadBoardComments(boardId);
      return;
    }

    if (!(page.content || []).length && currentCommentPage > 0) {
      currentCommentPage = Math.max(0, totalPages - 1);
      await loadBoardComments(boardId);
      return;
    }

    renderBoardComments(page.content || []);
    renderBoardCommentPagination(page, boardId);
  } catch (error) {
    list.innerHTML = `<div class="board-error">${escapeBoardHtml(error.message)}</div>`;
  }
}
function renderBoardComments(comments) {
  const list = document.getElementById('boardCommentList');

  if (!comments.length) {
    list.innerHTML = `<div class="board-empty">${currentBoardMember ? '첫 댓글을 남겨보세요.' : '등록된 댓글이 없습니다.'}</div>`;
    return;
  }

  list.innerHTML = comments.map(comment => {
    const root = renderSingleComment(comment, false);
    const replies = (comment.replies || []).map(reply => renderSingleComment(reply, true)).join('');
    return root + replies;
  }).join('');

  initializeBoardProfileImages(list);
}
function renderBoardCommentPagination(page, boardId) {
  const pagination = document.getElementById('boardCommentPagination');
  const totalPages = page.totalPages || 0;

  if (!pagination || totalPages <= 1) return;

  const current = page.number || 0;
  const start = Math.max(0, current - 2);
  const end = Math.min(totalPages - 1, start + 4);
  let html = `<button class="board-page-button" data-comment-page="${current - 1}" ${current === 0 ? 'disabled' : ''}>‹</button>`;

  for (let index = start; index <= end; index++) {
    html += `<button class="board-page-button ${index === current ? 'active' : ''}" data-comment-page="${index}">${index + 1}</button>`;
  }

  html += `<button class="board-page-button" data-comment-page="${current + 1}" ${current >= totalPages - 1 ? 'disabled' : ''}>›</button>`;
  pagination.innerHTML = html;

  pagination.querySelectorAll('[data-comment-page]').forEach(button => {
    button.addEventListener('click', async () => {
      if (button.disabled) return;

      currentCommentPage = Number(button.dataset.commentPage);
      await loadBoardComments(boardId);
      document.querySelector('.board-comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}
function renderSingleComment(comment, reply) {
  if (comment.commentStatus === 'DELETED') {
    return `<div class="board-comment deleted" data-comment-id="${comment.commentId}">${escapeBoardHtml(comment.content)}</div>`;
  }

  const isLoggedIn = Boolean(currentBoardMember);
  const isWriter = isLoggedIn && Number(currentBoardMember.memberId) === Number(comment.writerId);
  const nickname = comment.writerNickname || '알 수 없음';
  let actionButtons = '';

  if (!reply) actionButtons += '<button class="board-text-button" data-comment-action="reply">답글</button>';

  if (isWriter) {
    actionButtons += `
      <button class="board-text-button" data-comment-action="edit">수정</button>
      <button class="board-text-button danger" data-comment-action="delete">삭제</button>
    `;
  } else {
    actionButtons += '<button class="board-text-button danger" data-comment-action="report">신고</button>';
  }

  return `
    <article class="board-comment ${reply ? 'reply' : ''}" data-comment-id="${comment.commentId}" data-comment-content="${escapeBoardAttribute(comment.content)}">
      <div class="board-comment-head">
        <div class="board-comment-author">
          ${renderBoardProfileAvatar(comment.writerProfileImageUrl, nickname, 'board-comment-avatar')}
          <span>${escapeBoardHtml(nickname)}<small class="board-comment-time">${formatBoardDateTimeWithModified(comment.createdAt, comment.updatedAt)}</small></span>
        </div>
        ${actionButtons ? `<div class="board-comment-actions">${actionButtons}</div>` : ''}
      </div>
      <div class="board-comment-content">${escapeBoardHtml(comment.content)}</div>
      <div class="board-inline-slot"></div>
    </article>
  `;
}
async function createBoardComment(boardId, parentCommentId = null, content = null, button = null) {
  if (!requireBoardLogin()) return;

  const textarea = parentCommentId ? null : document.getElementById('boardCommentContent');
  const commentContent = (content ?? textarea?.value ?? '').trim();

  if (!commentContent) {
    showBoardToast('댓글 내용을 입력해 주세요.', true);
    return;
  }
  if (commentContent.length > 500) {
    showBoardToast('댓글은 500자 이하로 입력해 주세요.', true);
    return;
  }

  const key = `create-comment-${boardId}-${parentCommentId || 'root'}`;
  await runBoardRequest(key, button, parentCommentId ? '등록 중...' : '등록 중...', async () => {
    try {
      await fetchBoardJson(`/board/${boardId}/comment`, {
        method: 'POST',
        body: JSON.stringify({ content: commentContent, parentCommentId })
      });

      if (textarea) textarea.value = '';
      updateBoardCommentCount(1);
      showBoardToast(parentCommentId ? '답글을 등록했습니다.' : '댓글을 등록했습니다.', false, 'success');
      await loadBoardComments(boardId, !parentCommentId);
    } catch (error) {
      showBoardToast(error.message, true);
    }
  });
}
function handleCommentAction(event, boardId) {
  const button = event.target.closest('[data-comment-action]');
  if (!button) return;

  const comment = button.closest('.board-comment');
  const commentId = Number(comment.dataset.commentId);
  const action = button.dataset.commentAction;

  if (action === 'report') openReportModal('COMMENT', commentId);
  if (action === 'delete') deleteBoardComment(commentId, boardId, button);
  if (action === 'reply') {
    if (!requireBoardLogin()) return;
    showCommentInlineForm(comment, 'reply', boardId);
  }
  if (action === 'edit') showCommentInlineForm(comment, 'edit', boardId);
}
function showCommentInlineForm(commentElement, mode, boardId) {
  const slot = commentElement.querySelector('.board-inline-slot');
  const commentId = Number(commentElement.dataset.commentId);
  const initialContent = mode === 'edit' ? commentElement.dataset.commentContent : '';

  document.querySelectorAll('.board-inline-slot').forEach(other => {
    if (other !== slot) other.innerHTML = '';
  });

  slot.innerHTML = `
    <div class="board-inline-form">
      <textarea maxlength="500" placeholder="${mode === 'edit' ? '수정할 내용을 입력하세요.' : '답글을 입력하세요.'}">${escapeBoardHtml(initialContent)}</textarea>
      <button class="board-btn board-btn-primary board-btn-small" type="button">${mode === 'edit' ? '수정' : '등록'}</button>
      <button class="board-btn board-btn-ghost board-btn-small" type="button">취소</button>
    </div>
  `;

  const textarea = slot.querySelector('textarea');
  const buttons = slot.querySelectorAll('button');
  buttons[0].addEventListener('click', () => {
    if (mode === 'edit') updateBoardComment(commentId, textarea.value, boardId, buttons[0]);
    else createBoardComment(boardId, commentId, textarea.value, buttons[0]);
  });
  buttons[1].addEventListener('click', () => slot.innerHTML = '');
  if (mode === 'reply') {
    textarea.addEventListener('keydown', event => {
      if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      createBoardComment(boardId, commentId, textarea.value, buttons[0]);
    });
  }
  textarea.focus();
}
async function updateBoardComment(commentId, content, boardId, button) {
  if (!requireBoardLogin()) return;

  const trimmed = content.trim();
  if (!trimmed) {
    showBoardToast('댓글 내용을 입력해 주세요.', true);
    return;
  }
  if (trimmed.length > 500) {
    showBoardToast('댓글은 500자 이하로 입력해 주세요.', true);
    return;
  }

  await runBoardRequest(`update-comment-${commentId}`, button, '수정 중...', async () => {
    try {
      await fetchBoardJson(`/board/comment/${commentId}`, {
        method: 'PUT',
        body: JSON.stringify({ content: trimmed })
      });
      showBoardToast('댓글을 수정했습니다.', false, 'success');
      await loadBoardComments(boardId);
    } catch (error) {
      showBoardToast(error.message, true);
    }
  });
}
async function deleteBoardComment(commentId, boardId, button) {
  if (!requireBoardLogin() || !confirm('댓글을 삭제하시겠습니까?')) return;

  await runBoardRequest(`delete-comment-${commentId}`, button, '삭제 중...', async () => {
    try {
      await fetchBoardJson(`/board/comment/${commentId}`, { method: 'DELETE' });
      updateBoardCommentCount(-1);
      showBoardToast('댓글을 삭제했습니다.', false, 'success');
      await loadBoardComments(boardId);
    } catch (error) {
      showBoardToast(error.message, true);
    }
  });
}
function updateBoardCommentCount(change) {
  if (!currentReadBoard) return;

  currentReadBoard.commentCount = Math.max(0, Number(currentReadBoard.commentCount || 0) + change);
  const count = document.getElementById('boardReadCommentCount');
  if (count) count.textContent = currentReadBoard.commentCount;
}
