if (!localStorage.getItem('jwtToken')) {
            alert('로그인이 필요한 서비스입니다.');
            window.location.href = '/auth/login';
        }

// 페이지 렌더링(페인트) 직전에 동기적으로 상태를 복구하여 깜빡임(잔상) 방지
  (function() {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const activeTab = sessionStorage.getItem('chatActiveTab') || 'right';
    const leftSidebar = document.querySelector('.chat-left-sidebar');
    const rightSidebar = document.querySelector('.chat-sidebar');
    const btnToggleLeft = document.getElementById('btnToggleLeftSidebar');
    const btnToggleRight = document.getElementById('btnToggleRightSidebar');

    // 모바일 화면에서는 사이드바가 채팅창을 가리지 않도록, 진입 시에는
    // 항상 대화창을 먼저 보여주고 사이드바는 버튼을 눌렀을 때만 오버레이로 연다.
    if (isMobile) {
      if (leftSidebar) leftSidebar.classList.add('hidden');
      if (rightSidebar) rightSidebar.classList.add('hidden');
      if (btnToggleLeft) btnToggleLeft.classList.remove('active');
      if (btnToggleRight) btnToggleRight.classList.remove('active');
      return;
    }

    if (activeTab === 'left') {
      if (leftSidebar) leftSidebar.classList.remove('hidden');
      if (btnToggleLeft) btnToggleLeft.classList.add('active');
      if (rightSidebar) rightSidebar.classList.add('hidden');
      if (btnToggleRight) btnToggleRight.classList.remove('active');
    } else {
      if (rightSidebar) rightSidebar.classList.remove('hidden');
      if (btnToggleRight) btnToggleRight.classList.add('active');
      if (leftSidebar) leftSidebar.classList.add('hidden');
      if (btnToggleLeft) btnToggleLeft.classList.remove('active');
    }
  })();
// Inline Script extracted from chatRoom.html
  const msgInput = document.getElementById('msgInput');
  const chatMessages = document.getElementById('chatMessages');

  // 모바일 환경에서 입력창 placeholder 변경
  function updatePlaceholder() {
    if (window.innerWidth <= 768) {
      msgInput.placeholder = "메시지를 입력하세요";
    } else {
      msgInput.placeholder = "메시지를 입력하세요 (Shift+Enter로 줄바꿈)";
    }
  }
  window.addEventListener('resize', updatePlaceholder);
  updatePlaceholder();

  // 말풍선 길게 누르기(1초)로 액션 버튼 표시
  let pressTimer = null;
  chatMessages.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.msg-action-btn')) return; // 버튼 클릭은 무시
    const msgItem = e.target.closest('.msg-item');
    if (!msgItem) return;

    if (pressTimer) clearTimeout(pressTimer);

    pressTimer = setTimeout(() => {
      const actions = msgItem.querySelector('.msg-actions');
      if (actions) {
        // 이전에 띄워둔 액션 숨기기
        document.querySelectorAll('.msg-actions.show-actions').forEach(el => {
          if (el !== actions) el.classList.remove('show-actions');
        });
        actions.classList.add('show-actions');
      }
    }, 1000);
  });

  const clearTimer = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  };

  chatMessages.addEventListener('pointerup', clearTimer);
  chatMessages.addEventListener('pointercancel', clearTimer);
  chatMessages.addEventListener('pointerleave', clearTimer);
  chatMessages.addEventListener('scroll', clearTimer);

  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.msg-actions') && !e.target.closest('.msg-item')) {
       document.querySelectorAll('.msg-actions.show-actions').forEach(el => {
         el.classList.remove('show-actions');
       });
    }
  });

  // 스크롤 맨 아래로 이동
  function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  scrollToBottom(); // 초기 렌더링 시 스크롤

  // WebSocket / STOMP 연결
  const sock = new SockJS("/ws-stomp");
  const stompClient = Stomp.over(sock);
  stompClient.debug = null; // 콘솔 로그 숨기기

  const token = localStorage.getItem('jwtToken');
  stompClient.connect({ 'Authorization': 'Bearer ' + token }, function (frame) {
    console.log("Connected: " + frame);
    // 방 구독
    stompClient.subscribe("/sub/chat/room/" + groupId, function (message) {
      const msg = JSON.parse(message.body);
      
      if (msg.type === 'UPDATE') {
        const bubble = document.getElementById('msgContent-' + msg.id);
        if (bubble) {
          const escapedContent = msg.content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
          bubble.innerHTML = escapedContent.replace(/\n/g, '<br>');
        }
        const timeDiv = document.getElementById('msgTime-' + msg.id);
        if (timeDiv && !timeDiv.querySelector('.edited-mark')) {
          timeDiv.innerHTML += '<span class="edited-mark" style="font-size:10px; color:#94a3b8; margin-left:2px;">(수정됨)</span>';
        }
        return;
      }
      
      if (msg.type === 'DELETE') {
        const bubble = document.getElementById('msgContent-' + msg.id);
        if (bubble) {
          bubble.innerHTML = '삭제된 메시지입니다.';
          bubble.className = 'bubble deleted';
        }
        const msgDiv = document.getElementById('msg-' + msg.id);
        if (msgDiv) {
          const msgActions = msgDiv.querySelector('.msg-actions');
          if (msgActions) msgActions.remove();
        }
        return;
      }
      
      appendMessage(msg);
      
      // 현재 채팅방에 있으므로 메시지를 받자마자 읽음 처리 요청
      fetch(`/groupChat/${groupId}/read`, { method: 'POST' }).catch(console.error);
      
      // 내 채팅을 포함해 메시지가 오면 사이드바 목록 정렬을 갱신하기 위해 이벤트 발생
      window.dispatchEvent(new CustomEvent('notificationReceived'));
    });

    // 입장 메시지 전송 (필요 시 주석 해제)
    /*
    stompClient.send("/pub/chat/message", {}, JSON.stringify({
      type: 'ENTER',
      groupId: groupId,
      senderId: myMemberId,
      senderName: '나' // TODO: 내 닉네임 가져오기
    }));
    */
  });

  function appendMessage(msg) {
    const now = new Date();
    const timeStr = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
    const dateStr = String(now.getFullYear()) + '-' + String(now.getMonth()+1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    let html = "";
    
    if (msg.type === 'ENTER' || msg.type === 'LEAVE') {
      html = `<div class="message system msg-item" data-date="${dateStr}">${msg.content}</div>`;
    } else {
      // XSS 방지를 위한 HTML 이스케이프 처리 후 줄바꿈 변환
      const escapedContent = msg.content
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      const contentSafe = escapedContent.replace(/\n/g, '<br>');
      const isDeleted = msg.content === '삭제된 메시지입니다.' || msg.content === '관리자에 의해 삭제된 메시지입니다.';
      const bubbleClass = isDeleted ? 'bubble deleted' : 'bubble';
      
      if (msg.senderId === myMemberId) {
        html = `
          <div class="message mine msg-item" id="msg-${msg.id}" data-date="${dateStr}">
            <div class="message-inner">
              <div class="msg-actions" ${isDeleted ? 'style="display:none;"' : ''}>
                <button class="msg-action-btn" data-action="edit" data-id="${msg.id}">수정</button>
                <button class="msg-action-btn danger" data-action="delete" data-id="${msg.id}">삭제</button>
              </div>
              <div class="${bubbleClass}" id="msgContent-${msg.id}">${contentSafe}</div>
              <div class="time" id="msgTime-${msg.id}">
                <span>${timeStr}</span>
                ${msg.isEdited ? '<span class="edited-mark" style="font-size:10px; color:#94a3b8; margin-left:2px;">(수정됨)</span>' : ''}
              </div>
            </div>
          </div>
        `;
      } else {
        html = `
          <div class="message other msg-item" id="msg-${msg.id}" data-date="${dateStr}">
            <div class="sender alias-target" data-sender-id="${msg.senderId}">${msg.senderName}</div>
            <div class="message-inner">
              <div class="avatar" style="background: #e2e8f0; display:flex; justify-content:center; align-items:center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              </div>
              <div class="${bubbleClass}" id="msgContent-${msg.id}">${contentSafe}</div>
              <div style="display:flex; flex-direction:column; align-items:flex-start; gap:2px;">
                <div class="time" id="msgTime-${msg.id}">
                  <span>${timeStr}</span>
                  ${msg.isEdited && !isDeleted ? '<span class="edited-mark" style="font-size:10px; color:#94a3b8; margin-left:2px;">(수정됨)</span>' : ''}
                </div>
              </div>
              <div class="msg-actions" ${isDeleted ? 'style="display:none;"' : ''}>
                ${msg.id && !isDeleted ? (reportedMessageIds.has(msg.id)
                  ? `<button id="reportBtn-${msg.id}" class="msg-action-btn" style="cursor:not-allowed; color:#94a3b8;" disabled>신고됨</button>`
                  : `<button id="reportBtn-${msg.id}" data-action="report" data-id="${msg.id}" class="msg-action-btn danger">신고</button>`) : ''}
              </div>
            </div>
          </div>
        `;
      }
    }
    chatMessages.innerHTML += html;
    renderDateDividers();
    applyAliases();
    scrollToBottom();
  }

  // 메시지 액션 이벤트 위임
  chatMessages.addEventListener('click', (e) => {
    const btn = e.target.closest('.msg-action-btn');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    const msgIdStr = btn.getAttribute('data-id');
    if (!msgIdStr) return;
    const msgId = parseInt(msgIdStr, 10);

    if (action === 'edit') {
      startEditMessage(msgId);
    } else if (action === 'delete') {
      deleteMessage(msgId);
    } else if (action === 'report') {
      openReportModal(msgId);
    }
  });

  function renderDateDividers() {
    const messages = document.querySelectorAll('.msg-item');
    let lastDate = '';
    
    messages.forEach(msg => {
      const date = msg.getAttribute('data-date');
      if (date && date !== lastDate) {
        // 해당 메시지 앞에 구분선이 없다면 생성
        const prev = msg.previousElementSibling;
        if (!prev || !prev.classList.contains('date-divider')) {
          const [yyyy, mm, dd] = date.split('-');
          const dateText = `${yyyy}년 ${parseInt(mm)}월 ${parseInt(dd)}일`;
          
          const divider = document.createElement('div');
          divider.className = 'date-divider';
          divider.style.cssText = 'text-align:center; font-size:12px; color:#94a3b8; margin:16px 0; position:relative; width:100%;';
          divider.innerHTML = `
            <span style="background:var(--bg-light); padding:0 8px; position:relative; z-index:1;">${dateText}</span>
            <div style="position:absolute; top:50%; left:0; right:0; border-top:1px solid #e2e8f0; z-index:0;"></div>
          `;
          msg.parentNode.insertBefore(divider, msg);
        }
        lastDate = date;
      }
    });
  }

  function resolveAlias(memberId, defaultName) {
    const alias = localStorage.getItem('alias_' + groupId + '_' + memberId);
    if (alias) {
        let origNick = defaultName;
        const match = defaultName.match(/\(([^)]+)\)$/);
        if (match) {
            origNick = match[1];
        }
        if (alias !== origNick) {
            return `${alias} (${origNick})`;
        }
        return alias;
    }
    return defaultName;
  }

  function applyAliases() {
    document.querySelectorAll('.alias-target').forEach(el => {
      const senderId = el.getAttribute('data-sender-id');
      if (senderId && senderId !== myMemberId.toString()) {
        const original = el.getAttribute('data-original-name') || el.textContent;
        if (!el.getAttribute('data-original-name')) {
          el.setAttribute('data-original-name', original);
        }
        el.textContent = resolveAlias(senderId, original);
      }
    });
  }

  // 초기 렌더링 시에도 구분선 및 별명 적용
  renderDateDividers();
  applyAliases();

  // 메시지 전송 로직
  msgInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('btnSend').click();
    }
  });

  document.getElementById('btnSend').addEventListener('click', function() {
    const text = msgInput.value.trim();
    if (!text) return;
    
    // 서버로 STOMP Publish
    stompClient.send("/pub/chat/message", {}, JSON.stringify({
      type: 'TALK',
      groupId: groupId,
      senderId: myMemberId,
      content: text
    }));
    
    msgInput.value = '';
  });

  // 사이드바 토글 로직
  const leftSidebar = document.querySelector('.chat-left-sidebar');
  const rightSidebar = document.querySelector('.chat-sidebar');
  const btnToggleLeft = document.getElementById('btnToggleLeftSidebar');
  const btnToggleRight = document.getElementById('btnToggleRightSidebar');

  // 모임방 목록 (왼쪽 사이드바) 선택
  if (btnToggleLeft && leftSidebar) {
    btnToggleLeft.addEventListener('click', function() {
      leftSidebar.classList.remove('hidden');
      btnToggleLeft.classList.add('active');

      if (rightSidebar) {
        rightSidebar.classList.add('hidden');
        if (btnToggleRight) btnToggleRight.classList.remove('active');
      }
      sessionStorage.setItem('chatActiveTab', 'left');
    });
  }

  // 대화 인원 (오른쪽 사이드바) 선택
  if (btnToggleRight && rightSidebar) {
    btnToggleRight.addEventListener('click', function() {
      rightSidebar.classList.remove('hidden');
      btnToggleRight.classList.add('active');

      if (leftSidebar) {
        leftSidebar.classList.add('hidden');
        if (btnToggleLeft) btnToggleLeft.classList.remove('active');
      }
      sessionStorage.setItem('chatActiveTab', 'right');
    });
  }

  // 모바일: 사이드바(모임방 목록 / 채팅방 인원)를 닫고 대화창으로 돌아가기
  window.closeMobileSidebar = function() {
    if (leftSidebar) leftSidebar.classList.add('hidden');
    if (rightSidebar) rightSidebar.classList.add('hidden');
    if (btnToggleLeft) btnToggleLeft.classList.remove('active');
    if (btnToggleRight) btnToggleRight.classList.remove('active');
    sessionStorage.setItem('chatActiveTab', 'none');
  };

  // 신고 로직
  let currentReportMessageId = null;

  async function openReportModal(msgId) {
    if (!msgId) return;

    try {
        const response = await fetch(`/groupChat/${groupId}/report/check?messageId=${msgId}`, {
            credentials: 'include'
        });
        const exists = await response.json();
        if (exists) {
            alert("이미 신고된 채팅입니다");
            return;
        }
    } catch (e) {
        console.error("중복 신고 확인 중 오류 발생", e);
    }

    currentReportMessageId = msgId;
    document.getElementById('reportReason').value = '';
    document.getElementById('reportDetail').value = '';
    document.getElementById('reportModal').classList.add('open');
  };

  // 메시지 수정 및 삭제 로직
  function startEditMessage(msgId) {
    const bubble = document.getElementById('msgContent-' + msgId);
    if (!bubble) return;
    
    // 이미 수정창이 열려있다면 무시
    if (document.getElementById('msgEditBox-' + msgId)) return;

    let oldContent = bubble.innerHTML.replace(/<br>/g, '\n');
    
    // 말풍선 숨기기
    bubble.style.display = 'none';
    
    // 인라인 수정창 생성
    const editBox = document.createElement('div');
    editBox.id = 'msgEditBox-' + msgId;
    editBox.style.cssText = 'display:flex; flex-direction:column; gap:6px; width:100%; min-width:200px; background:#f8fafc; padding:10px; border-radius:12px; border:1px solid #cbd5e1;';
    
    editBox.innerHTML = `
      <textarea id="msgEditText-${msgId}" style="width:100%; min-height:50px; border:none; background:transparent; resize:none; font-size:14px; color:var(--ink-dark); outline:none; font-family:inherit;">${oldContent}</textarea>
      <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:4px;">
        <button onclick="cancelEditMessage(${msgId})" style="border:none; background:none; font-size:12px; color:#64748b; cursor:pointer;">취소</button>
        <button onclick="submitEditMessage(${msgId})" style="border:none; background:var(--primary); color:#fff; font-size:12px; padding:4px 12px; border-radius:4px; font-weight:bold; cursor:pointer;">저장</button>
      </div>
    `;
    
    bubble.parentNode.insertBefore(editBox, bubble.nextSibling);
    
    // 포커스 및 맨 끝으로 커서 이동
    const textarea = document.getElementById('msgEditText-' + msgId);
    textarea.focus();
    textarea.selectionStart = textarea.value.length;
    
    // Enter 키로 저장 (Shift+Enter는 줄바꿈)
    textarea.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitEditMessage(msgId);
      }
    });
  }

  function cancelEditMessage(msgId) {
    const bubble = document.getElementById('msgContent-' + msgId);
    const editBox = document.getElementById('msgEditBox-' + msgId);
    if (editBox) editBox.remove();
    if (bubble) bubble.style.display = 'block';
  }

  function submitEditMessage(msgId) {
    const textarea = document.getElementById('msgEditText-' + msgId);
    const bubble = document.getElementById('msgContent-' + msgId);
    if (!textarea || !bubble) return;
    
    const newContent = textarea.value.trim();
    let oldContent = bubble.innerHTML.replace(/<br>/g, '\n').trim();
    
    if (newContent !== '' && newContent !== oldContent) {
      stompClient.send("/pub/chat/message/update", {}, JSON.stringify({
        type: 'UPDATE',
        id: msgId,
        groupId: groupId,
        senderId: myMemberId,
        content: newContent
      }));
    }
    
    cancelEditMessage(msgId);
  }

  function deleteMessage(msgId) {
    if (confirm('메시지를 삭제하시겠습니까?')) {
      stompClient.send("/pub/chat/message/delete", {}, JSON.stringify({
        type: 'DELETE',
        id: msgId,
        groupId: groupId,
        senderId: myMemberId
      }));
    }
  }

  // AI Summary Logic
  window.currentAiOffset = 0;
  
  function triggerAiSummary(isRetry = false) {
    if (!isRetry) {
        window.currentAiOffset = 0;
    }
    
    if (localStorage.getItem('ps_chat_ai_status') === 'PROCESSING') {
      alert("이미 AI 요약이 진행 중입니다.");
      return;
    }
    
    // 즉각적인 시각적 피드백을 위해 모달을 띄움
    const modal = document.getElementById('aiSummaryModal');
    const content = document.getElementById('aiSummaryContent');
    modal.style.display = 'flex';
    content.innerHTML = '<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 0; gap:16px;">' +
                        '<div style="color:var(--primary); font-weight:bold; font-size:16px;">AI가 대화 내용을 요약하고 있습니다...</div>' +
                        '<div style="color:var(--ink-soft); font-size:13px; text-align:center;">이 창을 닫거나 다른 페이지로 이동하셔도<br>우측 하단의 위젯을 통해 백그라운드에서 요약이 계속 진행됩니다!</div>' +
                        '</div>';
    
    fetch('/groupChat/' + groupId + '/ai-summary/async?offset=' + window.currentAiOffset, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    .then(res => res.json())
    .then(data => {
      if (data.jobId) {
        if (typeof window.registerChatAiJob === 'function') {
          window.registerChatAiJob(data.jobId, groupId);
        } else {
          console.error("registerChatAiJob function not found!");
        }
      } else {
        alert("작업 시작에 실패했습니다.");
      }
    })
    .catch(err => {
      alert("AI 요약 요청 중 오류가 발생했습니다.");
    });
  }

  document.getElementById('btnAiSummary').addEventListener('click', () => triggerAiSummary(false));

  window.aiScheduleState = [];

  window.showChatAiModalWithData = function(data) {
    const modal = document.getElementById('aiSummaryModal');
    const content = document.getElementById('aiSummaryContent');
    modal.style.display = 'flex';
    
    // reset state
    window.aiScheduleState = [];

    let html = '<div style="margin-bottom:16px; white-space:pre-wrap; max-height:200px; overflow-y:auto; padding:12px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">' + data.summary + '</div>';
    
    if (data.proposedSchedules && data.proposedSchedules.length > 0) {
      html += '<h4 style="margin:16px 0 8px 0; color:var(--primary);">추천 일정 제안</h4>';
      html += '<div style="display:flex; flex-direction:column; gap:12px; max-height:300px; overflow-y:auto; padding-right:4px;">';
      data.proposedSchedules.forEach((schedule, index) => {
        const safeTitle = (schedule.title || '').replace(/"/g, '&quot;');
        const safeDate = schedule.date || '';
        const safeEndDate = schedule.endDate || safeDate;
        const safeTime = schedule.time || '';
        const safeEndTime = schedule.endTime || '';
        const isPeriod = safeEndDate && safeEndDate !== safeDate;
        const isAllDay = !safeTime;

        // initialize state for this item
        let startH = "12", startM = "00";
        if (safeTime && safeTime.includes(":")) {
            const parts = safeTime.split(":");
            startH = parts[0]; startM = parts[1];
        }
        let endH = "13", endM = "00";
        if (safeEndTime && safeEndTime.includes(":")) {
            const parts = safeEndTime.split(":");
            endH = parts[0]; endM = parts[1];
        } else if (!safeEndTime) {
            endH = String(parseInt(startH) + 1).padStart(2, '0');
            if (parseInt(endH) > 23) endH = "23";
            endM = startM;
        }

        window.aiScheduleState[index] = {
            fpInstance: null,
            startH: startH, startM: startM,
            endH: endH, endM: endM,
            isRange: isPeriod,
            defaultDates: isPeriod ? [safeDate, safeEndDate] : [safeDate]
        };

        const timeRangeValue = `${startH}:${startM} ~ ${endH}:${endM}`;

        html += `
          <div id="aiSchBlock_${index}" style="display:flex; flex-direction:column; gap:8px; padding:16px; background:var(--bg); border:1px solid var(--line); border-radius:8px; margin-bottom:12px; position:relative;">
            <div style="position:absolute; top:12px; right:12px;">
              <button type="button" onclick="removeAiSchedule(${index})" style="background:transparent; border:none; cursor:pointer; color:#94a3b8; font-size:14px; padding:4px; display:flex; align-items:center; justify-content:center; border-radius:50%; transition:background 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'" title="이 추천 일정 삭제">❌</button>
            </div>
            <div style="display:flex; flex-direction:column; gap:4px; padding-right:24px;">
              <label style="font-size:12px; color:var(--ink-soft); font-weight:bold;">일정 제목</label>
              <input type="text" id="aiSchTitle_${index}" value="${safeTitle}" style="padding:8px; border:2px solid #DCEFFC; border-radius:10px; font-size:14px; outline:none; width:100%; box-sizing:border-box;" onfocus="this.style.borderColor='#38BDF8'" onblur="this.style.borderColor='#DCEFFC'">
            </div>

            <div style="display: flex; gap: 12px; margin-top: 4px; align-items: center; flex-wrap: wrap;">
                <div class="period-btn-group" style="flex: 1; display: flex; background: #EEF2F6; padding: 4px; border-radius: 10px;">
                    <button id="aiBtnSingleDay_${index}" type="button" class="${isPeriod ? '' : 'active'}" style="flex: 1; padding: 6px; border-radius: 8px; font-size: 13px; font-weight: 800; cursor: pointer; transition: all 0.2s;" onclick="toggleAiPeriodMode(${index}, false)">하루 일정</button>
                    <button id="aiBtnRangeDay_${index}" type="button" class="${isPeriod ? 'active' : ''}" style="flex: 1; padding: 6px; border-radius: 8px; font-size: 13px; font-weight: 800; cursor: pointer; transition: all 0.2s;" onclick="toggleAiPeriodMode(${index}, true)">기간 일정</button>
                </div>
                <div style="flex: 1; display: flex; align-items: center; justify-content: space-between; background: #F3FAFF; border: 2px solid #DCEFFC; border-radius: 10px; padding: 4px 10px; height: 38px; box-sizing: border-box;">
                    <span style="font-size: 13px; font-weight: 700; color: #075985;">하루종일</span>
                    <label class="toggle-switch" style="margin: 0; transform: scale(0.8);">
                        <input id="aiSchAllDay_${index}" type="checkbox" onchange="toggleAiAllDay(${index}, this.checked)" ${isAllDay ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
            </div>

            <div style="display:flex; flex-direction:column; gap:4px; margin-top:4px;">
                <label id="aiDateRangeLabel_${index}" style="font-size:12px; color:var(--ink-soft); font-weight:bold;">${isPeriod ? '일정 기간 선택' : '일정 날짜 선택'} *</label>
                <input id="aiSchDateRange_${index}" type="text" class="chip-input" placeholder="${isPeriod ? '시작일과 종료일을 선택하세요' : '날짜를 선택하세요'}">
            </div>
            
            <div id="aiSchTimeContainer_${index}" style="display:flex; opacity:${isAllDay ? '0.4' : '1'}; pointer-events:${isAllDay ? 'none' : 'auto'}; flex-direction:column; gap:4px; margin-top: 4px; position: relative;">
                <label style="font-size:12px; color:var(--ink-soft); font-weight:bold;">일정 시간 범위 선택 *</label>
                <input id="aiSchTimeRange_${index}" type="text" readonly class="chip-input" placeholder="시간을 선택하세요 (예: 09:00 ~ 10:00)" value="${timeRangeValue}" onclick="toggleAiTimeDropdown(${index})">

                <!-- 시간 범위 드롭다운 레이어 -->
                <div id="aiTimeRangeDropdown_${index}" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: #fff; border: 2px solid #DCEFFC; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); z-index: 100; padding: 16px; margin-top: 6px;">
                    <div style="display: flex; gap: 12px;">
                        <div style="flex: 1;">
                            <div style="font-size: 12px; font-weight: 700; color: #64748B; margin-bottom: 6px; text-align: center;">시작 시간</div>
                            <div id="aiStartTimeList_${index}" style="max-height: 180px; overflow-y: auto; border: 1px solid #E2E8F0; border-radius: 6px; background:#fff;"></div>
                        </div>
                        <div style="flex: 1;">
                            <div style="font-size: 12px; font-weight: 700; color: #64748B; margin-bottom: 6px; text-align: center;">종료 시간</div>
                            <div id="aiEndTimeList_${index}" style="max-height: 180px; overflow-y: auto; border: 1px solid #E2E8F0; border-radius: 6px; background:#fff;"></div>
                        </div>
                    </div>
                    <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; border-top: 1px solid #F1F5F9; padding-top: 10px;">
                        <button type="button" style="padding: 6px 12px; font-size: 12px; border-radius:6px; background:transparent; color:#64748b; border:2px solid transparent; font-weight:900; cursor:pointer;" onclick="toggleAiTimeDropdown(${index}, false)">닫기</button>
                        <button type="button" style="padding: 6px 12px; font-size: 12px; border-radius:6px; background:#0ea5e9; color:white; border:2px solid transparent; font-weight:900; cursor:pointer;" onclick="confirmAiTimeRange(${index})">선택 완료</button>
                    </div>
                </div>
            </div>

            <div style="text-align:right; margin-top:8px;">
              <button id="aiSchBtn_${index}" onclick="addAiScheduleFromInput(${index})" style="padding:8px 16px; background:#0ea5e9; color:white; border:none; border-radius:10px; cursor:pointer; font-size:13px; font-weight:bold; transition:all 0.2s;">일정 추가</button>
            </div>
          </div>`;
      });
      html += '</div>';
    }
    
    // 이전 대화 요약 재시도 버튼 추가
    html += `
      <div style="margin-top:16px; padding-top:16px; border-top:1px solid #e2e8f0; text-align:center;">
        <div style="font-size:12px; color:var(--ink-soft); margin-bottom:8px;">찾으시는 일정이 안보이시나요?</div>
        <button type="button" onclick="window.retryAiSummary()" style="padding:8px 16px; background:#fff; color:var(--primary); border:1px solid var(--primary); border-radius:6px; cursor:pointer; font-size:13px; font-weight:bold; transition:all 0.2s;" onmouseover="this.style.background='#f0f9ff'" onmouseout="this.style.background='#fff'">
          더 과거 대화에서 찾기
        </button>
      </div>
    `;
    
    content.innerHTML = html;
    
    // Initialize flatpickrs after HTML is injected
    if (data.proposedSchedules && data.proposedSchedules.length > 0) {
        data.proposedSchedules.forEach((schedule, index) => {
            initAiFlatpickr(index, window.aiScheduleState[index].isRange);
        });
    }

    // Close the floating widget since we are showing the modal
    if (typeof window.clearChatAiStorage === 'function') {
        window.closeChatAiWidget();
    }
  };

  window.initAiFlatpickr = function(index, isRange) {
      if (window.aiScheduleState[index].fpInstance) {
          window.aiScheduleState[index].fpInstance.destroy();
      }
      const el = document.getElementById('aiSchDateRange_' + index);
      const defDates = window.aiScheduleState[index].defaultDates;
      window.aiScheduleState[index].fpInstance = flatpickr(el, {
          mode: isRange ? "range" : "single",
          locale: "ko",
          dateFormat: "Y-m-d",
          defaultDate: defDates
      });
  };

  window.toggleAiPeriodMode = function(index, isRange) {
      window.aiScheduleState[index].isRange = isRange;
      const btnSingle = document.getElementById('aiBtnSingleDay_' + index);
      const btnRange = document.getElementById('aiBtnRangeDay_' + index);
      
      if(isRange) {
          btnSingle.classList.remove('active');
          btnRange.classList.add('active');
          document.getElementById('aiDateRangeLabel_' + index).innerText = '일정 기간 선택 *';
          document.getElementById('aiSchDateRange_' + index).placeholder = '시작일과 종료일을 선택하세요';
      } else {
          btnRange.classList.remove('active');
          btnSingle.classList.add('active');
          document.getElementById('aiDateRangeLabel_' + index).innerText = '일정 날짜 선택 *';
          document.getElementById('aiSchDateRange_' + index).placeholder = '날짜를 선택하세요';
      }

      const currentDates = window.aiScheduleState[index].fpInstance ? window.aiScheduleState[index].fpInstance.selectedDates : [];
      initAiFlatpickr(index, isRange);
      if (currentDates.length > 0) {
          if (!isRange) window.aiScheduleState[index].fpInstance.setDate(currentDates[0]);
          else window.aiScheduleState[index].fpInstance.setDate(currentDates);
      }
  };

  window.renderAiTimeOptions = function(index) {
      const startList = document.getElementById('aiStartTimeList_' + index);
      const endList = document.getElementById('aiEndTimeList_' + index);
      if (!startList || !endList) return;

      startList.innerHTML = '';
      endList.innerHTML = '';

      const state = window.aiScheduleState[index];

      for (let h = 0; h < 24; h++) {
          const hh = String(h).padStart(2, '0');
          ["00", "15", "30", "45"].forEach(mm => {
              const timeStr = `${hh}:${mm}`;

              const startItem = document.createElement('div');
              startItem.className = 'time-select-item' + (state.startH === hh && state.startM === mm ? ' active' : '');
              startItem.textContent = timeStr;
              startItem.onclick = () => selectAiTimeVal(index, 'start', hh, mm);
              startList.appendChild(startItem);

              const endItem = document.createElement('div');
              endItem.className = 'time-select-item' + (state.endH === hh && state.endM === mm ? ' active' : '');
              endItem.textContent = timeStr;
              endItem.onclick = () => selectAiTimeVal(index, 'end', hh, mm);
              endList.appendChild(endItem);
          });
      }
  }

  window.selectAiTimeVal = function(index, type, hh, mm) {
      const state = window.aiScheduleState[index];
      let nextStartH = state.startH, nextStartM = state.startM;
      let nextEndH = state.endH, nextEndM = state.endM;

      if (type === 'start') {
          nextStartH = hh; nextStartM = mm;
      } else {
          nextEndH = hh; nextEndM = mm;
      }

      const startTotalMin = parseInt(nextStartH, 10) * 60 + parseInt(nextStartM, 10);
      const endTotalMin = parseInt(nextEndH, 10) * 60 + parseInt(nextEndM, 10);

      if (endTotalMin < startTotalMin) {
          alert('종료 시간은 시작 시간보다 빠를 수 없습니다.');
          return;
      }

      state.startH = nextStartH; state.startM = nextStartM;
      state.endH = nextEndH; state.endM = nextEndM;

      renderAiTimeOptions(index);
      document.getElementById('aiSchTimeRange_' + index).value = `${state.startH}:${state.startM} ~ ${state.endH}:${state.endM}`;
  };

  window.toggleAiTimeDropdown = function(index, show) {
      const dropdown = document.getElementById('aiTimeRangeDropdown_' + index);
      if (!dropdown) return;
      if (show === undefined) {
          dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
      } else {
          dropdown.style.display = show ? 'block' : 'none';
      }
      if (dropdown.style.display === 'block') {
          renderAiTimeOptions(index);
      }
  };

  window.confirmAiTimeRange = function(index) {
      toggleAiTimeDropdown(index, false);
  };

  window.toggleAiAllDay = function(index, isAllDay) {
      const timeContainer = document.getElementById('aiSchTimeContainer_' + index);
      const timeInputEl = document.getElementById('aiSchTimeRange_' + index);
      if(isAllDay) {
          timeContainer.style.opacity = '0.4';
          timeContainer.style.pointerEvents = 'none';
      } else {
          timeContainer.style.opacity = '1';
          timeContainer.style.pointerEvents = 'auto';
      }
  };

  document.addEventListener('click', (e) => {
      // close all time dropdowns if clicked outside
      const stateArr = window.aiScheduleState || [];
      for (let i = 0; i < stateArr.length; i++) {
          const dropdown = document.getElementById('aiTimeRangeDropdown_' + i);
          const input = document.getElementById('aiSchTimeRange_' + i);
          if (dropdown && input && !dropdown.contains(e.target) && e.target !== input && !e.target.classList.contains('time-select-item')) {
              dropdown.style.display = 'none';
          }
      }
  });

  window.retryAiSummary = function() {
      window.currentAiOffset += 100;
      triggerAiSummary(true);
  };

  window.removeAiSchedule = function(index) {
      if(!confirm("이 추천 일정을 삭제하시겠습니까?")) return;
      const block = document.getElementById('aiSchBlock_' + index);
      if(block) {
          block.style.display = 'none';
      }
      
      // Check if all are hidden
      setTimeout(() => {
          const allBlocks = document.querySelectorAll('[id^="aiSchBlock_"]');
          let anyVisible = false;
          allBlocks.forEach(b => {
              if (b.style.display !== 'none') anyVisible = true;
          });
          if (!anyVisible) {
              const modalContent = document.getElementById('aiSummaryContent');
              if(modalContent) {
                 const header = modalContent.querySelector('h4');
                 if(header) header.style.display = 'none';
                 
                 const noMoreMsg = document.createElement('div');
                 noMoreMsg.style.textAlign = 'center';
                 noMoreMsg.style.color = '#64748b';
                 noMoreMsg.style.padding = '20px';
                 noMoreMsg.style.fontSize = '14px';
                 noMoreMsg.innerText = '추천된 일정이 모두 삭제되었습니다.';
                 modalContent.appendChild(noMoreMsg);
              }
          }
      }, 50);
  };

  window.addAiScheduleFromInput = function(index) {
      const titleInput = document.getElementById('aiSchTitle_' + index);
      const isPeriod = document.getElementById('aiBtnRangeDay_' + index).classList.contains('active');
      const isAllDay = document.getElementById('aiSchAllDay_' + index).checked;
      const dateRangeInput = document.getElementById('aiSchDateRange_' + index);
      const state = window.aiScheduleState[index];
      
      const dates = state.fpInstance ? state.fpInstance.selectedDates : [];
      if(!titleInput.value || dates.length === 0) {
          alert("일정 제목과 날짜를 선택해주세요.");
          return;
      }

      const pad = (n) => String(n).padStart(2, '0');
      const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      
      const dateVal = fmt(dates[0]);
      const endDateVal = dates[1] ? fmt(dates[1]) : dateVal;
      
      if(!confirm("이 일정을 모임 캘린더에 추가하시겠습니까?")) return;
      
      const title = titleInput.value;
      const date = dateVal;
      const endDate = isPeriod ? endDateVal : date;
      const time = isAllDay ? "00:00" : `${state.startH}:${state.startM}`;
      const endTime = isAllDay ? "23:59" : `${state.endH}:${state.endM}`;
      
      const btn = document.getElementById('aiSchBtn_' + index);
      btn.disabled = true;
      btn.innerText = "추가 중...";
      btn.style.opacity = "0.7";

      fetch('/group/' + groupId + '/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title, date: date, endDate: endDate, time: time, endTime: endTime, visibility: 'PUBLIC' })
      }).then(res => {
          if(res.ok) {
              alert("일정이 추가되었습니다.");
              btn.innerText = "추가 완료";
              btn.style.background = "#10B981";
              titleInput.disabled = true;
              dateRangeInput.disabled = true;
              document.getElementById('aiSchTimeRange_' + index).disabled = true;
          } else {
              alert("일정 추가 실패");
              btn.disabled = false;
              btn.innerText = "일정 추가";
              btn.style.opacity = "1";
          }
      }).catch(err => {
          alert("일정 추가 중 오류가 발생했습니다.");
          btn.disabled = false;
          btn.innerText = "일정 추가";
          btn.style.opacity = "1";
      });
  };

  window.onChatAiCompleted = function(data) {
      // Called directly from polling if the user stayed on the chatRoom page
      // Instead of forcing the modal open immediately, we let them click the widget button
  };

  // Check if we need to show the modal automatically on page load
  window.addEventListener('load', function() {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('showAiSummary') === 'true') {
          const dataStr = localStorage.getItem('ps_chat_ai_cached_result');
          if (dataStr) {
              window.showChatAiModalWithData(JSON.parse(dataStr));
              // Remove the query param without reloading
              window.history.replaceState({}, document.title, window.location.pathname);
          }
      }
  });

  document.getElementById('aiSummaryClose').addEventListener('click', function() { document.getElementById('aiSummaryModal').style.display = 'none'; });
  document.getElementById('aiSummaryCloseBtn').addEventListener('click', function() { document.getElementById('aiSummaryModal').style.display = 'none'; });

  window.addAiSchedule = function(title, date, time) {
    if(!confirm("이 일정을 모임 캘린더에 추가하시겠습니까?")) return;
    fetch('/group/' + groupId + '/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title, date: date, time: time, visibility: 'PUBLIC' })
    }).then(res => {
      if(res.ok) {
        alert("일정이 추가되었습니다.");
        document.getElementById('aiSummaryModal').style.display = 'none';
      } else {
        alert("일정 추가 실패");
      }
    });
  };

  document.getElementById('reportCancel').addEventListener('click', function() {
    document.getElementById('reportModal').classList.remove('open');
    currentReportMessageId = null;
  });

  const reportModal = document.getElementById('reportModal');
  reportModal.addEventListener('click', function(event) {
    if (event.target === reportModal) {
      reportModal.classList.remove('open');
      currentReportMessageId = null;
    }
  });

  document.getElementById('reportConfirm').addEventListener('click', function() {
    if (!currentReportMessageId) return;
    
    const reason = document.getElementById('reportReason').value;
    const detail = document.getElementById('reportDetail').value;

    if (!reason) {
      alert("신고 사유를 선택해 주세요.");
      return;
    }
    if (!detail.trim()) {
      alert("세부내용을 입력해 주세요.");
      return;
    }
    
    fetch(`/groupChat/${groupId}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          messageId: currentReportMessageId,
          reason: reason,
          reasonDetail: detail
        })
      }).then(async res => {
        if (res.ok) {
          alert("신고가 접수되었습니다.");
          document.getElementById('reportModal').classList.remove('open');
          reportedMessageIds.add(currentReportMessageId);
          const btn = document.getElementById('reportBtn-' + currentReportMessageId);
          if (btn) {
            btn.style.color = '#94a3b8';
            btn.style.cursor = 'not-allowed';
            btn.style.textDecoration = 'none';
            btn.title = '이미 신고됨';
            btn.disabled = true;
            btn.onclick = null;
            btn.innerText = '신고됨';
          }
        } else {
          const errMsg = await res.text();
          alert(errMsg || "신고 처리 중 오류가 발생했습니다.");
        }
      });
  });

  // 다른 채팅방에서 메시지가 왔을 때 좌측 사이드바 실시간 갱신 (정렬 & 배지 업데이트)
  window.addEventListener('notificationReceived', function(e) {
    fetch('/group/mygroup')
      .then(res => res.json())
      .then(data => {
        const sidebarList = document.querySelector('.chat-left-sidebar > div:nth-child(2)');
        if (!sidebarList) return;
        
        let html = '';
        data.forEach(g => {
          if (g.filter !== 'joined') return;
          
          const isCurrent = (g.id === groupId.toString());
          const bgStyle = isCurrent ? 'background: #e0f2fe; color: #0284c7; font-weight: bold;' : '';
          
          let avatarHtml = '';
          if (g.profileImageUrl && g.profileImageUrl !== 'null' && g.profileImageUrl.trim() !== '') {
            avatarHtml = `<div style="width: 36px; height: 36px; border-radius: 12px; overflow: hidden; flex-shrink: 0; border: 1px solid var(--line);">
                            <img src="${g.profileImageUrl}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.outerHTML=decodeURIComponent('%3Cdiv%20style%3D%22background%3A%20%23e2e8f0%3B%20width%3A%20100%25%3B%20height%3A%20100%25%3B%20display%3Aflex%3B%20justify-content%3Acenter%3B%20align-items%3Acenter%3B%22%3E%3Csvg%20width%3D%2218%22%20height%3D%2218%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M17%2021v-2a4%204%200%200%200-4-4H5a4%204%200%200%200-4%204v2%22%3E%3C/path%3E%3Ccircle%20cx%3D%229%22%20cy%3D%227%22%20r%3D%224%22%3E%3C/circle%3E%3Cpath%20d%3D%22M23%2021v-2a4%204%200%200%200-3-3.87%22%3E%3C/path%3E%3Cpath%20d%3D%22M16%203.13a4%204%200%200%201%200%207.75%22%3E%3C/path%3E%3C/svg%3E%3C/div%3E')">
                          </div>`;
          } else {
            avatarHtml = `<div style="width: 36px; height: 36px; border-radius: 12px; background: #e2e8f0; display: flex; justify-content: center; align-items: center; flex-shrink: 0; border: 1px solid var(--line);">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                          </div>`;
          }
          
          let badgeHtml = '';
          if (g.unreadChatCount > 0) {
            badgeHtml = `<div style="background-color:#EF4444; color:white; border-radius:9999px; padding:2px 6px; font-size:10px; font-weight:bold; margin-right:6px;">
                           ${g.unreadChatCount > 99 ? '99+' : g.unreadChatCount}
                         </div>`;
          }
          
          let favIconHtml = g.isFavorite 
            ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="cursor:pointer;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`
            : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="cursor:pointer;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
          
          html += `
            <a href="/groupChat/${g.id}?sidebar=left" 
               style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; text-decoration: none; color: inherit; cursor: pointer; transition: background 0.2s; ${bgStyle}"
               onmouseover="if(this.style.background!=='rgb(224, 242, 254)' && this.style.background!=='#e0f2fe') this.style.background='#f1f5f9'"
               onmouseout="if(this.style.background!=='rgb(224, 242, 254)' && this.style.background!=='#e0f2fe') this.style.background='transparent'">
              ${avatarHtml}
              <div style="flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 13.5px;">${g.name}</div>
              ${badgeHtml}
              <div onclick="event.preventDefault(); event.stopPropagation(); toggleFavorite('${g.id}')" style="padding:4px; z-index:10; display:flex; align-items:center;">
                ${favIconHtml}
              </div>
            </a>
          `;
        });
        sidebarList.innerHTML = html;
      });
  });

  window.toggleFavorite = function(id) {
    fetch(`/group/${id}/favorite`, { method: 'POST' })
      .then(res => {
        if (res.ok) {
          window.dispatchEvent(new CustomEvent('notificationReceived'));
        } else {
          alert('즐겨찾기 변경에 실패했습니다.');
        }
      })
      .catch(console.error);
  };
