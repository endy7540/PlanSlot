// Global Fetch Interceptor for Sliding Session
const originalFetch = window.fetch;
window.fetch = async function() {
    let response = await originalFetch.apply(this, arguments);
    if (response.headers && response.headers.has('New-Token')) {
        const newToken = response.headers.get('New-Token');
        if (newToken) {
            localStorage.setItem('jwtToken', newToken);
            document.cookie = "jwtToken=" + newToken + "; path=/;";
        }
    }
    return response;
};

window.addEventListener("DOMContentLoaded", function() {
    const token = localStorage.getItem("jwtToken");
    const loginBtn = document.getElementById("loginBtn");
    const profileWrap = document.getElementById("profileWrap");
    const profileBtn = document.getElementById("profileBtn");
    const profileDropdown = document.getElementById("profileDropdown");
    const logoutBtn = document.getElementById("logoutBtn");
    const headerMenuToggle = document.getElementById("headerMenuToggle");
    const headerMenu = document.getElementById("headerMenu");

    function closeHeaderMenu() {
        if (!headerMenuToggle || !headerMenu) return;
        headerMenuToggle.setAttribute("aria-expanded", "false");
        headerMenuToggle.setAttribute("aria-label", "전체 메뉴 열기");
        headerMenu.classList.remove("open");
    }

    if (headerMenuToggle && headerMenu) {
        headerMenuToggle.addEventListener("click", function(e) {
            e.stopPropagation();
            const willOpen = !headerMenu.classList.contains("open");

            const profileDropdown = document.getElementById("profileDropdown");
            const notificationDropdown = document.getElementById("notificationDropdown");
            const notificationBell = document.getElementById("notificationBell");
            if (profileDropdown) profileDropdown.style.display = "none";
            if (notificationDropdown) notificationDropdown.classList.remove("open");
            if (notificationBell) notificationBell.classList.remove("active");

            headerMenu.classList.toggle("open", willOpen);
            headerMenuToggle.setAttribute("aria-expanded", String(willOpen));
            headerMenuToggle.setAttribute("aria-label", willOpen ? "전체 메뉴 닫기" : "전체 메뉴 열기");
        });

        headerMenu.querySelectorAll("a").forEach(link => link.addEventListener("click", closeHeaderMenu));

        document.addEventListener("click", function(e) {
            if (!headerMenu.contains(e.target) && !headerMenuToggle.contains(e.target)) closeHeaderMenu();
        });

        window.addEventListener("resize", function() {
            if (window.innerWidth > 900) closeHeaderMenu();
        });
    }
    
    if (!token) {
        if (loginBtn) loginBtn.style.display = "block";
        if (profileWrap) profileWrap.style.display = "none";
        
        // 비로그인 사용자 메뉴 비활성화 처리
        const allLinks = Array.from(document.querySelectorAll('.header-menu a'));
        const protectedLinks = allLinks.filter(a => ['개인 캘린더', '모임 캘린더', '모임 채팅방'].includes(a.textContent.trim()));
        protectedLinks.forEach(link => {
            link.style.color = '#94A3B8';
            link.style.opacity = '0.5';
            link.style.cursor = 'pointer';
            link.addEventListener('click', function(e) {
                e.preventDefault();
                alert('로그인이 필요한 서비스입니다.');
                window.location.href = '/auth/login';
            });
        });
    } else {
        if (loginBtn) loginBtn.style.display = "none";
        if (profileWrap) profileWrap.style.display = "block";

        if (profileBtn) {
            profileBtn.addEventListener("click", function(e) {
                e.stopPropagation();
                
                // 알림 드롭다운이 열려있다면 닫기
                const notiDropdown = document.getElementById('notificationDropdown');
                const notiBell = document.getElementById('notificationBell');
                if (notiDropdown) notiDropdown.classList.remove('open');
                if (notiBell) notiBell.classList.remove('active');

                if (profileDropdown.style.display === "none" || profileDropdown.style.display === "") {
                    profileDropdown.style.display = "flex";
                } else {
                    profileDropdown.style.display = "none";
                }
            });
        }

        // 외부 클릭 시 드롭다운 닫기
        document.addEventListener("click", function(e) {
            if (profileWrap && !profileWrap.contains(e.target)) {
                if (profileDropdown) profileDropdown.style.display = "none";
            }
        });

        const headerNickname = document.getElementById("headerNickname");
        if (headerNickname) {
            fetch('/members/me', {
                headers: { 
                    'Authorization': 'Bearer ' + token,
                    'Accept': 'application/json'
                }
            })
            .then(res => {
                if (res.ok) return res.json();
                throw new Error();
            })
            .then(data => {
                headerNickname.innerText = (data.displayName || data.nickname) + '님';
                const headerProfileImage = document.getElementById("headerProfileImage");
                if (headerProfileImage) {
                    if (data.profileImageUrl) {
                        headerProfileImage.src = data.profileImageUrl;
                    } else {
                        headerProfileImage.src = "/images/default-avatar.png";
                    }
                }

                if (data.role === 'ADMIN') {
                    const adminLink = document.getElementById("adminPageLink");
                    if (adminLink) {
                        adminLink.style.display = "block";
                        adminLink.href = "/admin";
                    }
                }
            })
            .catch(() => {
                headerNickname.innerText = '회원님';
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener("click", function() {
                if (confirm("정말 로그아웃 하시겠습니까?")) {
                    localStorage.removeItem("jwtToken");
                    localStorage.removeItem("memberId");
                    sessionStorage.removeItem("planslotChatbotMessages");
                    document.cookie = "jwtToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                    alert("안전하게 로그아웃 되었습니다.");
                    window.location.reload();
                }
            });
        }
    }
});




const HEADER_API_BASE = window.location.origin;
      let headerPollingTimer = null;

      function getAuthToken() {
          return localStorage.getItem('jwtToken');
      }

      async function closeAiWidget() {
          const widget = document.getElementById('aiFloatingWidget');
          if (widget) widget.style.display = 'none';

          const requestId = localStorage.getItem('ps_ai_request_id');
          const status = localStorage.getItem('ps_ai_status');

          if (requestId && (status === 'PROCESSING' || status === 'COMPLETED' || status === 'FAILED')) {
              try {
                  const tokenVal = getAuthToken();
                  if (tokenVal) {
                      await fetch(`${HEADER_API_BASE}/ai-image-schedule/${requestId}`, {
                          method: 'DELETE',
                          headers: {
                              'Authorization': `Bearer ${tokenVal}`
                          }
                      });
                      console.log(`[AI-Clean-Header] Discarded request #${requestId} on widget close.`);
                  }
              } catch (e) {
                  console.error('[AI-Clean-Header] Discard failed:', e);
              }
          }
          clearAiStorage();
      }

      function clearAiStorage() {
          localStorage.removeItem('ps_ai_request_id');
          localStorage.removeItem('ps_ai_status');
          localStorage.removeItem('ps_ai_cached_result');
          localStorage.removeItem('ps_ai_fail_reason');
      }

      function openWidgetResult() {
          const resultDataStr = localStorage.getItem('ps_ai_cached_result');
          if (!resultDataStr) return;

          if (window.location.pathname.startsWith('/schedule')) {
              const widget = document.getElementById('aiFloatingWidget');
              if (widget) widget.style.display = 'none';
              
              const aiImageModal = document.getElementById('aiImageModal');
              if (aiImageModal) {
                  aiImageModal.style.display = 'flex';
                  document.getElementById('aiUploadStep').style.display = 'none';
                  document.getElementById('aiLoadingStep').style.display = 'none';
                  
                  aiCachedResultData = JSON.parse(resultDataStr);
                  displayAnalysisResult(aiCachedResultData);
              }
          } else {
              window.location.href = '/schedule?showAiResult=true';
          }
      }

      function checkAndRecoverAiBackgroundProcess() {
          const requestId = localStorage.getItem('ps_ai_request_id');
          const status = localStorage.getItem('ps_ai_status');

          if (!requestId || !status) return;

          const widget = document.getElementById('aiFloatingWidget');
          if (!widget) return;

          const widgetTitle = document.getElementById('aiWidgetTitle');
          const widgetDesc = document.getElementById('aiWidgetDesc');
          const widgetBar = document.getElementById('aiWidgetProgressBar');
          const widgetAction = document.getElementById('aiWidgetActionContainer');

          if (status === 'PROCESSING') {
              if (widget.style.display !== 'block') document.getElementById('aiWidgetContainer').appendChild(widget);
              widget.style.display = 'block';
              widgetTitle.innerText = 'AI 일정 분석 중';
              widgetDesc.innerText = '이전 페이지에서 시작된 AI 분석 작업을 계속 수행 중입니다...';
              widgetBar.style.width = '65%';
              widgetBar.style.background = 'linear-gradient(90deg, #6366F1, #3B82F6)';
              widgetAction.style.display = 'none';

              startHeaderAiPolling(requestId);
          } else if (status === 'COMPLETED') {
              const cachedDataStr = localStorage.getItem('ps_ai_cached_result');
              if (cachedDataStr) {
                  try {
                      const resultData = JSON.parse(cachedDataStr);
                      const count = (resultData.extractedSchedules || []).length;

                      if (widget.style.display !== 'block') document.getElementById('aiWidgetContainer').appendChild(widget);
                      widget.style.display = 'block';
                      widgetTitle.innerText = 'AI 분석 완료!';
                      widgetDesc.innerText = `총 ${count}개의 일정이 발견되었습니다. 결과를 확인하세요.`;
                      widgetBar.style.width = '100%';
                      widgetBar.style.background = '#10B981';
                      widgetAction.style.display = 'block';
                  } catch (e) {
                      clearAiStorage();
                  }
              } else {
                  if (widget.style.display !== 'block') document.getElementById('aiWidgetContainer').appendChild(widget);
                  widget.style.display = 'block';
                  startHeaderAiPolling(requestId);
              }
          } else if (status === 'FAILED') {
              const failReason = localStorage.getItem('ps_ai_fail_reason') || 'AI 분석이 실패했습니다.';
              if (widget.style.display !== 'block') document.getElementById('aiWidgetContainer').appendChild(widget);
              widget.style.display = 'block';
              widgetTitle.innerText = 'AI 분석 실패';
              widgetDesc.innerText = failReason;
              widgetBar.style.width = '100%';
              widgetBar.style.background = '#EF4444';
              widgetAction.style.display = 'none';
          }
      }

      function startHeaderAiPolling(requestId) {
          if (headerPollingTimer) clearInterval(headerPollingTimer);

          headerPollingTimer = setInterval(async () => {
              const tokenVal = getAuthToken();
              if (!tokenVal) {
                  clearInterval(headerPollingTimer);
                  return;
              }

              try {
                  const res = await fetch(`${HEADER_API_BASE}/ai-image-schedule/${requestId}`, {
                      headers: {
                          'Authorization': `Bearer ${tokenVal}`,
                          'Accept': 'application/json'
                      }
                  });
                  if (!res.ok) {
                      clearInterval(headerPollingTimer);
                      const widget = document.getElementById('aiFloatingWidget');
                      if (widget) widget.style.display = 'none';
                      clearAiStorage();
                      return;
                  }
                  const data = await res.json();
                  
                  const widget = document.getElementById('aiFloatingWidget');
                  const widgetTitle = document.getElementById('aiWidgetTitle');
                  const widgetDesc = document.getElementById('aiWidgetDesc');
                  const widgetBar = document.getElementById('aiWidgetProgressBar');
                  const widgetAction = document.getElementById('aiWidgetActionContainer');

                  if (!widget) {
                      clearInterval(headerPollingTimer);
                      return;
                  }

                  if (data.status === 'COMPLETED') {
                      clearInterval(headerPollingTimer);
                      
                      localStorage.setItem('ps_ai_status', 'COMPLETED');
                      localStorage.setItem('ps_ai_cached_result', JSON.stringify(data));
                      
                      const count = (data.extractedSchedules || []).length;
                      if (widget.style.display !== 'block') document.getElementById('aiWidgetContainer').appendChild(widget);
                      widget.style.display = 'block';
                      widgetTitle.innerText = 'AI 분석 완료!';
                      widgetDesc.innerText = `총 ${count}개의 일정이 발견되었습니다. 결과를 확인하세요.`;
                      widgetBar.style.width = '100%';
                      widgetBar.style.background = '#10B981';
                      widgetAction.style.display = 'block';
                  } else if (data.status === 'FAILED') {
                      clearInterval(headerPollingTimer);
                      const failReason = data.failReason || 'AI 분석 실패';
                      
                      localStorage.setItem('ps_ai_status', 'FAILED');
                      localStorage.setItem('ps_ai_fail_reason', failReason);
                      
                      if (widget.style.display !== 'block') document.getElementById('aiWidgetContainer').appendChild(widget);
                      widget.style.display = 'block';
                      widgetTitle.innerText = 'AI 분석 실패';
                      widgetDesc.innerText = failReason;
                      widgetBar.style.width = '100%';
                      widgetBar.style.background = '#EF4444';
                  }
              } catch (e) {
                  console.error("공통 AI 폴링 에러:", e);
              }
          }, 3000);
      }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', checkAndRecoverAiBackgroundProcess);
        } else {
            checkAndRecoverAiBackgroundProcess();
        }

        // ===== 모임 AI 시간 추천: 페이지 이동 후에도 계속되는 백그라운드 폴링 =====
        // 폴링은 항상 header 스크립트가 전담한다. (상태 조회 API는 완료 시 결과를 한 번만
        // 내려주고 서버에서 지워버리기 때문에, 페이지와 header가 동시에 폴링하면
        // 둘 중 하나가 결과를 못 받는 경쟁 상태가 생긴다.)
        const GROUP_AI_POLL_INTERVAL_MS = 3000;
        let groupAiPollingTimer = null;

        function closeGroupAiWidget() {
            const widget = document.getElementById('groupAiFloatingWidget');
            if (widget) widget.style.display = 'none';
            clearGroupAiStorage();
        }

        function clearGroupAiStorage() {
            localStorage.removeItem('ps_group_ai_job_id');
            localStorage.removeItem('ps_group_ai_group_id');
            localStorage.removeItem('ps_group_ai_start_date');
            localStorage.removeItem('ps_group_ai_status');
            localStorage.removeItem('ps_group_ai_cached_result');
            localStorage.removeItem('ps_group_ai_fail_reason');
            if (groupAiPollingTimer) {
                clearInterval(groupAiPollingTimer);
                groupAiPollingTimer = null;
            }
        }
        window.clearGroupAiStorage = clearGroupAiStorage;

        function openGroupAiWidgetResult() {
            const groupId = localStorage.getItem('ps_group_ai_group_id');
            if (!groupId) return;

            const params = new URLSearchParams(window.location.search);
            const onSamePage = window.location.pathname.startsWith('/group/recommend') && params.get('id') === groupId;

            if (onSamePage) {
                // 이미 결과 페이지에 있다면 위젯만 닫는다 (본문 렌더링은 이벤트로 이미 처리됨)
                const widget = document.getElementById('groupAiFloatingWidget');
                if (widget) widget.style.display = 'none';
            } else {
                window.location.href = `/group/recommend?id=${groupId}`;
            }
        }

        function showGroupAiProcessingWidget() {
            const widget = document.getElementById('groupAiFloatingWidget');
            if (!widget) return;
            if (widget.style.display !== 'block') document.getElementById('aiWidgetContainer').appendChild(widget);
            widget.style.display = 'block';
            document.getElementById('groupAiWidgetTitle').innerText = 'AI 시간 추천 분석 중';
            document.getElementById('groupAiWidgetDesc').innerText = '모임원들의 일정을 분석해서 추천 시간을 찾는 중입니다...';
            const bar = document.getElementById('groupAiWidgetProgressBar');
            bar.style.width = '40%';
            bar.style.background = 'linear-gradient(90deg, #0D9488, #38BDF8)';
            document.getElementById('groupAiWidgetActionContainer').style.display = 'none';
        }

        function showGroupAiCompletedWidget() {
            const widget = document.getElementById('groupAiFloatingWidget');
            if (!widget) return;
            if (widget.style.display !== 'block') document.getElementById('aiWidgetContainer').appendChild(widget);
            widget.style.display = 'block';
            document.getElementById('groupAiWidgetTitle').innerText = 'AI 추천 완료!';
            document.getElementById('groupAiWidgetDesc').innerText = '추천 시간을 찾았어요. 결과를 확인해보세요.';
            const bar = document.getElementById('groupAiWidgetProgressBar');
            bar.style.width = '100%';
            bar.style.background = '#10B981';
            document.getElementById('groupAiWidgetActionContainer').style.display = 'block';
        }

        function showGroupAiFailedWidget(reason) {
            const widget = document.getElementById('groupAiFloatingWidget');
            if (!widget) return;
            if (widget.style.display !== 'block') document.getElementById('aiWidgetContainer').appendChild(widget);
            widget.style.display = 'block';
            document.getElementById('groupAiWidgetTitle').innerText = 'AI 추천 실패';
            document.getElementById('groupAiWidgetDesc').innerText = reason || 'AI 분석이 실패했습니다.';
            const bar = document.getElementById('groupAiWidgetProgressBar');
            bar.style.width = '100%';
            bar.style.background = '#EF4444';
            document.getElementById('groupAiWidgetActionContainer').style.display = 'none';
        }

        // ai-recommend.html에서 Job을 시작하자마자 호출: localStorage에 기록하고 폴링을 시작한다.
        function registerGroupAiJob(jobId, groupId, startDateStr) {
            localStorage.setItem('ps_group_ai_job_id', jobId);
            localStorage.setItem('ps_group_ai_group_id', String(groupId));
            localStorage.setItem('ps_group_ai_start_date', startDateStr || '');
            localStorage.setItem('ps_group_ai_status', 'PROCESSING');
            localStorage.removeItem('ps_group_ai_cached_result');
            localStorage.removeItem('ps_group_ai_fail_reason');

            showGroupAiProcessingWidget();
            startGroupAiPolling(jobId, groupId);
        }
        window.registerGroupAiJob = registerGroupAiJob;

        function startGroupAiPolling(jobId, groupId) {
            if (groupAiPollingTimer) clearInterval(groupAiPollingTimer);

            groupAiPollingTimer = setInterval(async () => {
                const tokenVal = getAuthToken();
                if (!tokenVal) {
                    clearInterval(groupAiPollingTimer);
                    groupAiPollingTimer = null;
                    return;
                }

                try {
                    const res = await fetch(`${HEADER_API_BASE}/group/ai-recommendations/status/${jobId}`, {
                        headers: {
                            'Authorization': `Bearer ${tokenVal}`,
                            'Accept': 'application/json'
                        }
                    });
                    if (!res.ok) {
                        clearInterval(groupAiPollingTimer);
                        groupAiPollingTimer = null;
                        return;
                    }
                    const result = await res.json();

                    if (result.status === 'COMPLETED') {
                        clearInterval(groupAiPollingTimer);
                        groupAiPollingTimer = null;

                        if (result.data && result.data.error) {
                            localStorage.setItem('ps_group_ai_status', 'FAILED');
                            localStorage.setItem('ps_group_ai_fail_reason', result.data.error);
                            showGroupAiFailedWidget(result.data.error);
                            window.dispatchEvent(new CustomEvent('planslot:groupAiFailed', {
                                detail: { jobId, groupId, reason: result.data.error }
                            }));
                            return;
                        }

                        localStorage.setItem('ps_group_ai_status', 'COMPLETED');
                        localStorage.setItem('ps_group_ai_cached_result', JSON.stringify(result.data));
                        showGroupAiCompletedWidget();

                        window.dispatchEvent(new CustomEvent('planslot:groupAiCompleted', {
                            detail: { jobId, groupId, data: result.data }
                        }));

                    } else if (result.status !== 'PROCESSING') {
                        clearInterval(groupAiPollingTimer);
                        groupAiPollingTimer = null;

                        const reason = '분석 중 오류가 발생했습니다.';
                        localStorage.setItem('ps_group_ai_status', 'FAILED');
                        localStorage.setItem('ps_group_ai_fail_reason', reason);
                        showGroupAiFailedWidget(reason);
                        window.dispatchEvent(new CustomEvent('planslot:groupAiFailed', {
                            detail: { jobId, groupId, reason }
                        }));
                    }
                    // PROCESSING이면 다음 폴링까지 대기
                } catch (e) {
                    console.error('그룹 AI 추천 폴링 에러:', e);
                }
            }, GROUP_AI_POLL_INTERVAL_MS);
        }

        // 페이지가 새로 열릴 때(새로고침 포함) 진행 중이던 그룹 AI 작업이 있으면 복구한다.
        function checkAndRecoverGroupAiJob() {
            const jobId = localStorage.getItem('ps_group_ai_job_id');
            const groupId = localStorage.getItem('ps_group_ai_group_id');
            const status = localStorage.getItem('ps_group_ai_status');

            if (!jobId || !groupId || !status) return;

            if (status === 'PROCESSING') {
                showGroupAiProcessingWidget();
                startGroupAiPolling(jobId, groupId);
            } else if (status === 'COMPLETED') {
                if (localStorage.getItem('ps_group_ai_cached_result')) {
                    showGroupAiCompletedWidget();
                }
            } else if (status === 'FAILED') {
                showGroupAiFailedWidget(localStorage.getItem('ps_group_ai_fail_reason'));
            }
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', checkAndRecoverGroupAiJob);
        } else {
            checkAndRecoverGroupAiJob();
        }

        // ===== 모임 채팅 AI 요약 백그라운드 폴링 =====
        const CHAT_AI_POLL_INTERVAL_MS = 3000;
        let chatAiPollingTimer = null;

        function closeChatAiWidget() {
            const widget = document.getElementById('chatAiFloatingWidget');
            if (widget) widget.style.display = 'none';
            clearChatAiStorage();
        }

        function clearChatAiStorage() {
            localStorage.removeItem('ps_chat_ai_job_id');
            localStorage.removeItem('ps_chat_ai_group_id');
            localStorage.removeItem('ps_chat_ai_status');
            localStorage.removeItem('ps_chat_ai_cached_result');
            localStorage.removeItem('ps_chat_ai_fail_reason');
            if (chatAiPollingTimer) {
                clearInterval(chatAiPollingTimer);
                chatAiPollingTimer = null;
            }
        }
        window.clearChatAiStorage = clearChatAiStorage;

        function openChatAiWidgetResult() {
            const groupId = localStorage.getItem('ps_chat_ai_group_id');
            if (!groupId) return;

            const onSamePage = window.location.pathname === `/groupChat/${groupId}`;

            if (onSamePage) {
                const widget = document.getElementById('chatAiFloatingWidget');
                if (widget) widget.style.display = 'none';
                
                if (typeof window.showChatAiModalWithData === 'function') {
                    const dataStr = localStorage.getItem('ps_chat_ai_cached_result');
                    if(dataStr && dataStr !== "undefined") {
                        try {
                            window.showChatAiModalWithData(JSON.parse(dataStr));
                        } catch(e) {
                            console.error("Failed to parse chat AI result", e);
                            alert("오류가 발생했습니다. AI 요약을 다시 진행해주세요.");
                            clearChatAiStorage();
                        }
                    } else if (dataStr === "undefined") {
                        alert("요약 데이터가 유실되었습니다. 다시 요약을 진행해주세요.");
                        clearChatAiStorage();
                    }
                }
            } else {
                window.location.href = `/groupChat/${groupId}?showAiSummary=true`;
            }
        }

        function showChatAiProcessingWidget() {
            const widget = document.getElementById('chatAiFloatingWidget');
            if (!widget) return;
            if (widget.style.display !== 'block') document.getElementById('aiWidgetContainer').appendChild(widget);
            widget.style.display = 'block';
            document.getElementById('chatAiWidgetTitle').innerText = 'AI 채팅 요약 진행 중';
            document.getElementById('chatAiWidgetDesc').innerText = '대화 내용을 요약하고 일정을 찾는 중입니다...';
            const bar = document.getElementById('chatAiWidgetProgressBar');
            bar.style.width = '40%';
            bar.style.background = 'linear-gradient(90deg, #F59E0B, #EF4444)';
            document.getElementById('chatAiWidgetActionContainer').style.display = 'none';
        }

        function showChatAiCompletedWidget() {
            const widget = document.getElementById('chatAiFloatingWidget');
            if (!widget) return;
            if (widget.style.display !== 'block') document.getElementById('aiWidgetContainer').appendChild(widget);
            widget.style.display = 'block';
            document.getElementById('chatAiWidgetTitle').innerText = 'AI 요약 완료!';
            document.getElementById('chatAiWidgetDesc').innerText = '대화 요약이 완료되었습니다. 결과를 확인해보세요.';
            const bar = document.getElementById('chatAiWidgetProgressBar');
            bar.style.width = '100%';
            bar.style.background = '#10B981';
            document.getElementById('chatAiWidgetActionContainer').style.display = 'block';
        }

        function showChatAiFailedWidget(reason) {
            const widget = document.getElementById('chatAiFloatingWidget');
            if (!widget) return;
            if (widget.style.display !== 'block') document.getElementById('aiWidgetContainer').appendChild(widget);
            widget.style.display = 'block';
            document.getElementById('chatAiWidgetTitle').innerText = 'AI 요약 실패';
            document.getElementById('chatAiWidgetDesc').innerText = reason || 'AI 분석이 실패했습니다.';
            const bar = document.getElementById('chatAiWidgetProgressBar');
            bar.style.width = '100%';
            bar.style.background = '#EF4444';
            document.getElementById('chatAiWidgetActionContainer').style.display = 'none';
        }

        function registerChatAiJob(jobId, groupId) {
            localStorage.setItem('ps_chat_ai_job_id', jobId);
            localStorage.setItem('ps_chat_ai_group_id', String(groupId));
            localStorage.setItem('ps_chat_ai_status', 'PROCESSING');
            localStorage.removeItem('ps_chat_ai_cached_result');
            localStorage.removeItem('ps_chat_ai_fail_reason');

            showChatAiProcessingWidget();
            startChatAiPolling(jobId, groupId);
        }
        window.registerChatAiJob = registerChatAiJob;

        function startChatAiPolling(jobId, groupId) {
            if (chatAiPollingTimer) clearInterval(chatAiPollingTimer);

            chatAiPollingTimer = setInterval(async () => {
                const tokenVal = getAuthToken();
                if (!tokenVal) {
                    clearInterval(chatAiPollingTimer);
                    chatAiPollingTimer = null;
                    return;
                }

                try {
                    const response = await fetch(`/groupChat/${groupId}/ai-summary/status/${jobId}`, {
                        method: 'GET',
                        headers: {
                            'Authorization': 'Bearer ' + tokenVal,
                            'Content-Type': 'application/json'
                        }
                    });

                    if (response.ok) {
                        const data = await response.json();
                        localStorage.setItem('ps_chat_ai_status', data.status);

                        if (data.status === 'COMPLETED') {
                            clearInterval(chatAiPollingTimer);
                            chatAiPollingTimer = null;
                            const actualData = data.result || data.data;
                            localStorage.setItem('ps_chat_ai_cached_result', JSON.stringify(actualData));
                            showChatAiCompletedWidget();
                            if (window.onChatAiCompleted) {
                                window.onChatAiCompleted(data.result);
                            }
                        } else if (data.status === 'FAILED') {
                            clearInterval(chatAiPollingTimer);
                            chatAiPollingTimer = null;
                            const err = data.error || '알 수 없는 오류가 발생했습니다.';
                            localStorage.setItem('ps_chat_ai_fail_reason', err);
                            showChatAiFailedWidget(err);
                        }
                    }
                } catch (error) {
                    console.error("Chat AI Status polling error", error);
                }
            }, CHAT_AI_POLL_INTERVAL_MS);
        }

        function checkAndRecoverChatAiJob() {
            const jobId = localStorage.getItem('ps_chat_ai_job_id');
            const groupId = localStorage.getItem('ps_chat_ai_group_id');
            const status = localStorage.getItem('ps_chat_ai_status');

            if (!jobId || !groupId || !status) return;

            if (status === 'PROCESSING') {
                showChatAiProcessingWidget();
                startChatAiPolling(jobId, groupId);
            } else if (status === 'COMPLETED') {
                if (localStorage.getItem('ps_chat_ai_cached_result')) {
                    showChatAiCompletedWidget();
                }
            } else if (status === 'FAILED') {
                showChatAiFailedWidget(localStorage.getItem('ps_chat_ai_fail_reason'));
            }
        }
        
        checkAndRecoverChatAiJob();