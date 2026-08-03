const API_BASE = "http://localhost:8080";

    // 메시지 출력 헬퍼 함수
    function showFieldMsg(id, text, isSuccess = false) {
        const el = document.getElementById(id);
        if(el) {
            el.innerText = text;
            el.style.color = isSuccess ? '#047857' : '#B91C1C';
        }
    }

    function clearAllFieldMsgs() {
        document.querySelectorAll('.field-msg').forEach(el => el.innerText = '');
    }

    // 화면 전환 함수
    function togglePage(target, updateUrl = true) {
        document.querySelectorAll('.auth-page').forEach(page => page.classList.remove('active'));
        document.getElementById('page-' + target).classList.add('active');
        
        // 화면 전환 시 메시지 초기화
        clearAllFieldMsgs();

        // 입력 폼 초기화
        document.querySelectorAll('.auth-container input').forEach(input => {
            if (input.type === 'checkbox') {
                input.checked = false;
            } else {
                input.value = '';
            }
        });
        
        // 중복 확인 및 이메일 인증 상태 초기화
        if (typeof isIdVerified !== 'undefined') isIdVerified = false;
        if (typeof isEmailVerified !== 'undefined') isEmailVerified = false;
        if (typeof emailTimerInterval !== 'undefined') clearInterval(emailTimerInterval);
        const authContainer = document.getElementById('authCodeContainer');
        if (authContainer) authContainer.style.display = 'none';
        const sendBtn = document.getElementById('sendEmailBtn');
        if (sendBtn) sendBtn.innerText = '인증번호 발송';

        // 브라우저 URL 동기화
        if (updateUrl) {
            const newPath = target === 'signup' ? '/auth/signup' : '/auth/login';
            if (window.location.pathname !== newPath) {
                window.history.pushState({}, '', newPath);
            }
        }
    }

    window.addEventListener('DOMContentLoaded', () => {
        // 아이디 변경 시 중복확인 초기화 및 영어/숫자 외 문자 즉시 차단
        document.getElementById('signupId').addEventListener('input', function(e) {
            isIdVerified = false;
            const originalValue = this.value;
            const newValue = originalValue.replace(/[^a-zA-Z0-9]/g, '');
            if (originalValue !== newValue) {
                this.value = newValue;
                showFieldMsg('signupIdMsg', '아이디는 영문과 숫자만 입력 가능합니다.');
            } else {
                showFieldMsg('signupIdMsg', '');
            }
        });

        // 비밀번호 실시간 검증 이벤트 리스너 등록
        document.getElementById('signupPw').addEventListener('input', function(e) {
            const originalValue = this.value;
            const newValue = originalValue.replace(/[^a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/g, '');
            if (originalValue !== newValue) {
                this.value = newValue;
            }
            
            if (this.value.length === 0) {
                showFieldMsg('signupPwMsg', '');
            } else {
                const pwRegex = /^(?=.*[a-zA-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?])[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]{8,20}$/;
                if (!pwRegex.test(this.value)) {
                    showFieldMsg('signupPwMsg', '비밀번호는 영문, 숫자, 특수문자를 각각 1개 이상 포함한 8~20자여야 합니다.');
                } else {
                    showFieldMsg('signupPwMsg', '사용 가능한 비밀번호입니다.', true);
                }
            }
            checkPasswordMatch();
        });
        document.getElementById('signupPwConfirm').addEventListener('input', function(e) {
            const originalValue = this.value;
            const newValue = originalValue.replace(/[^a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/g, '');
            if (originalValue !== newValue) {
                this.value = newValue;
            }
            checkPasswordMatch();
        });

        // 닉네임 실시간 검증
        document.getElementById('signupNickname').addEventListener('input', function(e) {
            const val = this.value;
            if (val.length === 0) {
                showFieldMsg('signupNicknameMsg', '');
            } else if (val.trim().length < 2 || val.trim().length > 20) {
                showFieldMsg('signupNicknameMsg', '닉네임은 2자 이상 20자 이하로 입력해주세요.');
            } else {
                showFieldMsg('signupNicknameMsg', '사용 가능한 닉네임입니다.', true);
            }
        });
        
        // CapsLock 감지 및 UI 업데이트 로직
        let isCapsOn = false;
        
        const updateCapsUI = () => {
            const activeId = document.activeElement ? document.activeElement.id : null;
            ['loginPw', 'signupPw', 'signupPwConfirm'].forEach(id => {
                const capsMsgEl = document.getElementById(id + 'CapsMsg');
                if (capsMsgEl) {
                    if (id === activeId && isCapsOn) {
                        capsMsgEl.classList.add('is-visible');
                    } else {
                        capsMsgEl.classList.remove('is-visible');
                    }
                }
            });
        };

        const handleModifierEvent = (e) => {
            if (typeof e.getModifierState === 'function') {
                isCapsOn = e.getModifierState('CapsLock');
                updateCapsUI();
            }
        };

        // 키보드나 마우스 이벤트 시 CapsLock 상태 갱신
        document.addEventListener('keydown', handleModifierEvent);
        document.addEventListener('keyup', handleModifierEvent);
        document.addEventListener('mousedown', handleModifierEvent);
        document.addEventListener('mouseup', handleModifierEvent);
        document.addEventListener('click', handleModifierEvent);
        
        // 포커스 이동 시에도 현재 필드에 맞춰 표시/숨김 처리
        document.addEventListener('focusin', updateCapsUI);
        document.addEventListener('focusout', updateCapsUI);
        
        if (window.location.pathname.includes('/auth/signup')) {
            togglePage('signup', false);
        } else {
            togglePage('login', false);
        }
    });

    let isIdVerified = false;

    // 아이디 중복 확인 요청
    async function checkDuplicateIdBtn() {
        const id = document.getElementById('signupId').value;

        if (!id) {
            showFieldMsg('signupIdMsg', '아이디를 입력해주세요.');
            return;
        }

        const idRegex = /^[a-zA-Z0-9]{4,20}$/;
        if (!idRegex.test(id)) {
            showFieldMsg('signupIdMsg', '아이디는 4~20자의 영문과 숫자로만 입력해주세요.');
            return;
        }

        const btn = document.getElementById('checkDuplicateBtn');
        const originalText = btn.innerText;
        btn.disabled = true;
        btn.innerText = '처리중...';

        try {
            clearAllFieldMsgs();
            const response = await fetch(`${API_BASE}/members/checkDuplicate?loginId=${encodeURIComponent(id)}`);
            if (response.ok) {
                const isDuplicate = await response.json(); // 백엔드에서 true/false 반환
                if (isDuplicate) {
                    showFieldMsg('signupIdMsg', '이미 사용 중인 아이디입니다.');
                    isIdVerified = false;
                } else {
                    showFieldMsg('signupIdMsg', '사용 가능한 아이디입니다.', true);
                    isIdVerified = true;
                }
            } else {
                showFieldMsg('signupIdMsg', '중복 확인에 실패했습니다.');
            }
        } catch (error) {
            showFieldMsg('signupIdMsg', '서버 통신에 실패했습니다.');
        } finally {
            btn.disabled = false;
            btn.innerText = originalText;
        }
    }

    let isEmailVerified = false;
    let emailTimerInterval;
    let emailTimeLeft = 300;

    function startEmailTimer() {
        clearInterval(emailTimerInterval);
        emailTimeLeft = 300;
        const timerSpan = document.getElementById('authTimer');
        timerSpan.style.display = 'inline-block';
        
        function updateDisplay() {
            const m = Math.floor(emailTimeLeft / 60).toString().padStart(2, '0');
            const s = (emailTimeLeft % 60).toString().padStart(2, '0');
            timerSpan.innerText = `${m}:${s}`;
        }
        
        updateDisplay();
        emailTimerInterval = setInterval(() => {
            emailTimeLeft--;
            updateDisplay();
            if (emailTimeLeft <= 0) {
                clearInterval(emailTimerInterval);
                showFieldMsg('signupAuthCodeMsg', '인증 시간이 만료되었습니다. 인증번호를 다시 발송해주세요.');
                document.getElementById('authCodeContainer').style.display = 'none';
            }
        }, 1000);
    }

    // 이메일 입력값 변경 시 인증 상태 초기화
    document.getElementById('signupEmail').addEventListener('input', () => {
        isEmailVerified = false;
        clearInterval(emailTimerInterval);
        document.getElementById('sendEmailBtn').innerText = '인증번호 발송';
        document.getElementById('authCodeContainer').style.display = 'none';
        document.getElementById('signupAuthCode').value = '';
        showFieldMsg('signupEmailMsg', '');
        showFieldMsg('signupAuthCodeMsg', '');
    });

    // 인증번호 발송 요청
    async function sendEmailCodeBtn() {
        const email = document.getElementById('signupEmail').value;

        if (!email) {
            showFieldMsg('signupEmailMsg', '이메일을 입력해주세요.');
            return;
        }

        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(email)) {
            showFieldMsg('signupEmailMsg', '올바른 이메일 형식을 입력해주세요.');
            return;
        }

        const btn = document.getElementById('sendEmailBtn');
        const originalText = btn.innerText;
        btn.disabled = true;
        btn.innerText = '처리중...';

        try {
            showFieldMsg('signupEmailMsg', '인증번호 발송 중... (최대 10초 소요)', true);
            const response = await fetch(`${API_BASE}/auth/email/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email })
            });
            
            if (response.ok) {
                showFieldMsg('signupEmailMsg', '이메일로 인증번호가 발송되었습니다. 5분 안에 입력해주세요.', true);
                document.getElementById('authCodeContainer').style.display = 'flex';
                btn.innerText = '재발송';
                startEmailTimer();
            } else {
                const errorMsg = await response.text();
                showFieldMsg('signupEmailMsg', errorMsg || '이메일 발송에 실패했습니다. 올바른 주소인지 확인해주세요.');
                btn.innerText = originalText;
            }
        } catch (error) {
            showFieldMsg('signupEmailMsg', '서버 통신에 실패했습니다.');
            btn.innerText = originalText;
        } finally {
            btn.disabled = false;
        }
    }

    // 인증번호 확인 요청
    async function verifyEmailCodeBtn() {
        const email = document.getElementById('signupEmail').value;
        const authCode = document.getElementById('signupAuthCode').value;

        if (!authCode) {
            showFieldMsg('signupAuthCodeMsg', '인증번호를 입력해주세요.');
            return;
        }

        const btn = document.getElementById('verifyEmailBtn');
        const originalText = btn.innerText;
        btn.disabled = true;
        btn.innerText = '처리중...';

        try {
            const response = await fetch(`${API_BASE}/auth/email/verify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email, authCode: authCode })
            });

            if (response.ok) {
                showFieldMsg('signupAuthCodeMsg', '이메일 인증이 완료되었습니다.', true);
                isEmailVerified = true;
                clearInterval(emailTimerInterval);
                document.getElementById('authCodeContainer').style.display = 'none';
                showFieldMsg('signupEmailMsg', '');
            } else {
                showFieldMsg('signupAuthCodeMsg', '인증 실패: 잘못된 인증번호이거나 만료되었습니다.');
            }
        } catch (error) {
            showFieldMsg('signupAuthCodeMsg', '서버 통신에 실패했습니다.');
        } finally {
            btn.disabled = false;
            btn.innerText = originalText;
        }
    }

    // 비밀번호 실시간 검증 함수
    function checkPasswordMatch() {
        const pw = document.getElementById('signupPw').value;
        const pwConfirm = document.getElementById('signupPwConfirm').value;

        if (pwConfirm.length === 0) {
            showFieldMsg('signupPwConfirmMsg', '');
            return;
        }

        if (pw === pwConfirm) {
            showFieldMsg('signupPwConfirmMsg', '비밀번호가 일치합니다.', true);
        } else {
            showFieldMsg('signupPwConfirmMsg', '비밀번호가 서로 일치하지 않습니다.');
        }
    }

    // Moved DOMContentLoaded to the top

    // 로그인 로직
    async function doLogin() {
        const id = document.getElementById('loginId').value;
        const pw = document.getElementById('loginPw').value;
        const keep = document.getElementById('keepLogin').checked;

        if(!id && !pw) {
            showFieldMsg('loginPwMsg', '아이디와 비밀번호를 입력해주세요.');
            return;
        } else if(!id) {
            showFieldMsg('loginPwMsg', '아이디를 입력해주세요.');
            return;
        } else if(!pw) {
            showFieldMsg('loginPwMsg', '비밀번호를 입력해주세요.');
            return;
        }

        const btn = document.getElementById('loginBtn');
        const originalText = btn.innerText;
        btn.disabled = true;
        btn.innerText = '처리중...';

        try {
            clearAllFieldMsgs();
            const response = await fetch(`${API_BASE}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ loginId: id, password: pw, keepLogin: keep })
            });

            const result = await response.text();

            if(response.ok) {
                showFieldMsg('loginPwMsg', `로그인 성공! 홈 화면으로 이동합니다...`, true);

                const tokenStr = result.replace("Bearer ", "").trim();
                sessionStorage.removeItem("planslotChatbotMessages");
                localStorage.setItem("jwtToken", tokenStr);
                document.cookie = "jwtToken=" + tokenStr + "; path=/;";

                window.location.href = "/planslot";
            } else {
                showFieldMsg('loginPwMsg', result || '로그인에 실패했습니다. 아이디와 비밀번호를 확인해주세요.');
                document.getElementById('loginPw').value = '';
            }
        } catch (error) {
            showFieldMsg('loginPwMsg', '서버 통신에 실패했습니다.');
            document.getElementById('loginPw').value = '';
        }
    }

    // 회원가입 로직
    async function doSignUp() {
        clearAllFieldMsgs();
        
        const id = document.getElementById('signupId').value;
        const pw = document.getElementById('signupPw').value;
        const pwConfirm = document.getElementById('signupPwConfirm').value;
        const email = document.getElementById('signupEmail').value;
        const nickname = document.getElementById('signupNickname').value;
        const sido = document.getElementById('signupSido').value;
        const sigungu = document.getElementById('signupSigungu').value;
        const address = (sido && sigungu) ? `${sido} ${sigungu}` : '';

        if(!id || !pw || !pwConfirm || !email || !nickname) {
            showFieldMsg('signupNicknameMsg', '필수 항목(아이디, 비밀번호, 비밀번호 재확인, 이메일, 닉네임)을 모두 입력해주세요.');
            return;
        }

        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(email)) {
            showFieldMsg('signupEmailMsg', '올바른 이메일 형식을 입력해주세요.');
            return;
        }

        if(nickname.trim().length < 2 || nickname.trim().length > 20) {
            showFieldMsg('signupNicknameMsg', '닉네임은 2자 이상 20자 이하로 입력해주세요.');
            return;
        }

        const idRegex = /^[a-zA-Z0-9]{4,20}$/;
        if (!idRegex.test(id)) {
            showFieldMsg('signupIdMsg', '아이디는 4~20자의 영문과 숫자로만 입력해주세요.');
            return;
        }

        const pwRegex = /^(?=.*[a-zA-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?])[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]{8,20}$/;
        if (!pwRegex.test(pw)) {
            showFieldMsg('signupPwMsg', '비밀번호는 영문, 숫자, 특수문자를 각각 1개 이상 포함한 8~20자여야 합니다.');
            return;
        }

        if(!isIdVerified) {
            showFieldMsg('signupIdMsg', '아이디 중복 확인을 먼저 진행해주세요.');
            return;
        }

        if(!isEmailVerified) {
            showFieldMsg('signupEmailMsg', '이메일 인증을 먼저 진행해주세요.');
            return;
        }

        if(pw !== pwConfirm) {
            showFieldMsg('signupPwConfirmMsg', '비밀번호가 서로 일치하지 않습니다.');
            return;
        }

        const btn = document.getElementById('signupBtn');
        const originalText = btn.innerText;
        btn.disabled = true;
        btn.innerText = '처리중...';

        // 기존에는 API를 호출했으나, 약관 동의 페이지로 이동시킴
        const signupData = {
            loginId: id,
            password: pw,
            email: email,
            nickname: nickname,
            address: address
        };
        sessionStorage.setItem('signupData', JSON.stringify(signupData));
        window.location.href = '/auth/terms?social=false';
    }

    let findIdInterval;
    let findPwInterval;
    
    function startFindTimer(type) {
        const timerSpan = type === 'find-id' ? document.getElementById('findIdAuthTimer') : document.getElementById('findPwAuthTimer');
        let timeLeft = 300; // 5분
        timerSpan.style.display = 'block';

        const updateText = () => {
            const m = Math.floor(timeLeft / 60);
            const s = timeLeft % 60;
            timerSpan.textContent = `${m}:${s.toString().padStart(2, '0')}`;
        };
        updateText();
        
        let interval = setInterval(() => {
            timeLeft--;
            updateText();
            if (timeLeft <= 0) {
                clearInterval(interval);
                timerSpan.textContent = "시간 초과";
            }
        }, 1000);
        
        if(type === 'find-id') findIdInterval = interval;
        else findPwInterval = interval;
    }

    async function sendFindAuthCodeBtn(type) {
        const emailInput = type === 'find-id' ? document.getElementById('findIdEmail') : document.getElementById('findPwEmail');
        const msg = type === 'find-id' ? 'findIdEmailMsg' : 'findPwEmailMsg';
        const container = type === 'find-id' ? document.getElementById('findIdAuthCodeContainer') : document.getElementById('findPwAuthCodeContainer');
        const btn = type === 'find-id' ? document.getElementById('findIdSendBtn') : document.getElementById('findPwSendBtn');

        const email = emailInput.value.trim();
        if (!email) {
            showFieldMsg(msg, '이메일을 입력해주세요.', false);
            return;
        }
        
        btn.disabled = true;
        btn.textContent = '발송 중...';

        try {
            const res = await fetch('/auth/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, type: 'find' })
            });

            if (res.ok) {
                showFieldMsg(msg, '인증번호가 발송되었습니다.', true);
                container.style.display = 'flex';
                btn.textContent = '재발송';
                btn.disabled = false;
                startFindTimer(type);
            } else {
                const text = await res.text();
                showFieldMsg(msg, text || '이메일 발송에 실패했습니다.', false);
                btn.textContent = '인증 발송';
                btn.disabled = false;
            }
        } catch (error) {
            showFieldMsg(msg, '서버 통신 오류가 발생했습니다.', false);
            btn.textContent = '인증 발송';
            btn.disabled = false;
        }
    }
    
    async function doFindId() {
        const email = document.getElementById('findIdEmail').value.trim();
        const authCode = document.getElementById('findIdAuthCode').value.trim();
        const msg = 'findIdAuthCodeMsg';
        
        if(!authCode) {
            showFieldMsg(msg, '인증번호를 입력해주세요.', false);
            return;
        }
        
        try {
            const res = await fetch('/auth/find-id', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, authCode })
            });
            const text = await res.text();
            if(res.ok) {
                if(findIdInterval) clearInterval(findIdInterval);
                document.getElementById('findIdAuthTimer').style.display = 'none';
                showFieldMsg(msg, `가입하신 아이디는 '${text}' 입니다.`, true);
            } else {
                showFieldMsg(msg, text || '인증에 실패했습니다.', false);
            }
        } catch(e) {
            showFieldMsg(msg, '서버 통신 오류가 발생했습니다.', false);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerText = originalText;
            }
        }
    }
    
    async function doFindPw() {
        const loginId = document.getElementById('findPwId').value.trim();
        const email = document.getElementById('findPwEmail').value.trim();
        const authCode = document.getElementById('findPwAuthCode').value.trim();
        const msg = 'findPwAuthCodeMsg';
        
        if(!loginId) {
            showFieldMsg(msg, '아이디를 입력해주세요.', false);
            return;
        }
        if(!authCode) {
            showFieldMsg(msg, '인증번호를 입력해주세요.', false);
            return;
        }
        
        try {
            const res = await fetch('/auth/find-pw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ loginId, email, authCode })
            });
            const text = await res.text();
            if(res.ok) {
                if(findPwInterval) clearInterval(findPwInterval);
                document.getElementById('findPwAuthTimer').style.display = 'none';
                showFieldMsg(msg, text, true);
            } else {
                showFieldMsg(msg, text || '인증에 실패했습니다.', false);
            }
        } catch(e) {
            showFieldMsg(msg, '서버 통신 오류가 발생했습니다.', false);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerText = originalText;
            }
        }
    }

    window.addEventListener('DOMContentLoaded', () => {
        if (typeof initRegionSelects === 'function') {
            initRegionSelects('signupSido', 'signupSigungu');
        }
    });

    function togglePw(inputId, btn) {
        const input = document.getElementById(inputId);
        if (input.type === 'password') {
            input.type = 'text';
            btn.innerHTML = '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg>';
        } else {
            input.type = 'password';
            btn.innerHTML = '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>';
        }
    }