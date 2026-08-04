const API_BASE = window.location.origin;

    const agreeAllCheckbox = document.getElementById('agreeAll');
    const termCheckboxes = document.querySelectorAll('.term-checkbox');

    // 전체 동의 클릭 시 개별 체크박스 토글
    agreeAllCheckbox.addEventListener('change', (e) => {
        termCheckboxes.forEach(cb => cb.checked = e.target.checked);
    });

    // 개별 체크박스 클릭 시 전체 동의 상태 업데이트
    termCheckboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            const allChecked = Array.from(termCheckboxes).every(c => c.checked);
            agreeAllCheckbox.checked = allChecked;
        });
    });

    async function submitTerms() {
        const agreeSystemNoti = document.getElementById('agreeSystemNoti').checked;
        const allowActivityNoti = document.getElementById('allowActivityNoti').checked;
        const allowMarketingNoti = document.getElementById('allowMarketingNoti').checked;
        const errorMsg = document.getElementById('errorMsg');

        if (!agreeSystemNoti) {
            errorMsg.innerText = '[필수] 시스템 및 보안 중요 알림 수신에 동의해주세요.';
            return;
        }

        const urlParams = new URLSearchParams(window.location.search);
        const isSocial = urlParams.get('social') === 'true';

        errorMsg.style.color = "#334155";
        errorMsg.innerText = "처리 중...";

        if (isSocial) {
            // 소셜 회원가입의 경우 이미 계정은 생성되어 로그인 상태임 (토큰 발급됨)
            // JWT 토큰을 localStorage 또는 cookie에서 가져와서 PUT /members/notifications 요청
            const token = localStorage.getItem('jwtToken') || getCookie('jwtToken');
            
            try {
                const response = await fetch(`${API_BASE}/members/notifications`, {
                    method: "PUT",
                    headers: { 
                        "Content-Type": "application/json",
                        "Authorization": "Bearer " + token
                    },
                    body: JSON.stringify({
                        allowActivityNoti: allowActivityNoti,
                        allowMarketingNoti: allowMarketingNoti
                    })
                });

                if (response.ok) {
                    window.location.href = '/planslot'; // 홈으로 이동
                } else {
                    throw new Error();
                }
            } catch(e) {
                errorMsg.style.color = "#B91C1C";
                errorMsg.innerText = "설정 저장에 실패했습니다. 홈으로 이동합니다.";
                setTimeout(() => window.location.href = '/planslot', 1500);
            }
        } else {
            // 일반 회원가입의 경우 sessionStorage에서 기존에 입력한 정보 가져와서 POST /auth/signup 요청
            const signupDataStr = sessionStorage.getItem('signupData');
            if (!signupDataStr) {
                alert('잘못된 접근입니다.');
                window.location.href = '/auth/login';
                return;
            }
            const signupData = JSON.parse(signupDataStr);
            signupData.allowActivityNoti = allowActivityNoti;
            signupData.allowMarketingNoti = allowMarketingNoti;

            try {
                const response = await fetch(`${API_BASE}/auth/signup`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(signupData)
                });
                
                const result = await response.text();
                
                if(response.ok) {
                    sessionStorage.removeItem('signupData');
                    alert("회원가입이 완료되었습니다! 로그인해주세요.");
                    window.location.href = '/auth/login';
                } else {
                    alert('회원가입에 실패했습니다.');
                    window.location.href = '/auth/login';
                }
            } catch (error) {
                errorMsg.style.color = "#B91C1C";
                errorMsg.innerText = '서버 통신에 실패했습니다.';
            }
        }
    }

    // 쿠키 가져오는 유틸
    function getCookie(name) {
        let matches = document.cookie.match(new RegExp(
            "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
        ));
        return matches ? decodeURIComponent(matches[1]) : undefined;
    }