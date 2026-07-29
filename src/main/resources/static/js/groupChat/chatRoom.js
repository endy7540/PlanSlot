if (!localStorage.getItem('jwtToken')) {
            alert('로그인이 필요한 서비스입니다.');
            window.location.href = '/auth/login';
        }

// 페이지 렌더링(페인트) 직전에 동기적으로 상태를 복구하여 깜빡임(잔상) 방지
  (function() {
    const activeTab = sessionStorage.getItem('chatActiveTab') || 'right';
    const leftSidebar = document.querySelector('.chat-left-sidebar');
    const rightSidebar = document.querySelector('.chat-sidebar');
    const btnToggleLeft = document.getElementById('btnToggleLeftSidebar');
    const btnToggleRight = document.getElementById('btnToggleRightSidebar');

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