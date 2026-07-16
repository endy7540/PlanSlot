document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('jwtToken');
    if (!token) {
        alert("로그인이 필요한 서비스입니다.");
        window.location.href = "/auth/login";
        return;
    }

    // View Elements
    const viewMode = document.getElementById('viewMode');
    const viewEmail = document.getElementById('viewEmail');
    const viewNickname = document.getElementById('viewNickname');
    const viewAddress = document.getElementById('viewAddress');
    const btnEditMode = document.getElementById('btnEditMode');

    // Edit Elements
    const updateForm = document.getElementById('updateForm');
    const emailInput = document.getElementById('email');
    const nicknameInput = document.getElementById('nickname');
    
    // Initialize Region Selects
    if (typeof initRegionSelects === 'function') {
        initRegionSelects('addressSido', 'addressSigungu');
    }
    
    // Password Elements
    const currentPassword = document.getElementById('currentPassword');
    const newPassword = document.getElementById('newPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    const passwordError = document.getElementById('passwordError');
    const btnCancelEdit = document.getElementById('btnCancelEdit');

    let currentData = {};

    function maskEmail(email) {
        if (!email) return '-';
        const split = email.split('@');
        if (split.length !== 2) return email;
        
        let local = split[0];
        const domain = split[1];
        
        if (local.length <= 2) {
            local = local.charAt(0) + '*'.repeat(local.length - 1);
        } else {
            local = local.substring(0, 3) + '*'.repeat(local.length - 3);
        }
        return local + '@' + domain;
    }

    // Fetch user info
    function loadUserInfo() {
        fetch('/members/me', {
            headers: { 
                'Authorization': 'Bearer ' + token,
                'Accept': 'application/json'
            }
        })
        .then(res => {
            if (res.status === 401) throw new Error("unauthorized");
            return res.json();
        })
        .then(data => {
            currentData = data;
            const maskedEmail = maskEmail(data.email);
            // Update View
            viewEmail.textContent = maskedEmail;
            viewNickname.textContent = data.nickname || '-';
            viewAddress.textContent = data.address || '등록된 주소가 없습니다.';
            
            // Update Form
            emailInput.value = maskedEmail;
            nicknameInput.value = data.nickname || '';
            
            if (data.address) {
                const parts = data.address.split(' ');
                if (parts.length >= 2) {
                    const sidoSelect = document.getElementById('addressSido');
                    sidoSelect.value = parts[0];
                    if (typeof updateSigunguSelect === 'function') {
                        updateSigunguSelect(parts[0], 'addressSigungu');
                        document.getElementById('addressSigungu').value = parts[1];
                    }
                }
            } else {
                document.getElementById('addressSido').value = '';
                if (typeof updateSigunguSelect === 'function') {
                    updateSigunguSelect('', 'addressSigungu');
                }
            }
        })
        .catch(err => {
            if (err.message === "unauthorized") {
                alert("인증이 만료되었습니다. 다시 로그인해주세요.");
                window.location.href = "/auth/login";
            } else {
                console.error(err);
                alert("회원 정보를 불러오는데 실패했습니다.");
            }
        });
    }

    loadUserInfo();

    // Toggle Modes
    btnEditMode.addEventListener('click', () => {
        viewMode.style.display = 'none';
        updateForm.style.display = 'block';
        clearPasswords();
    });

    btnCancelEdit.addEventListener('click', () => {
        updateForm.style.display = 'none';
        viewMode.style.display = 'block';
        // Reset form to current data
        nicknameInput.value = currentData.nickname || '';
        
        if (currentData.address) {
            const parts = currentData.address.split(' ');
            if (parts.length >= 2) {
                const sidoSelect = document.getElementById('addressSido');
                sidoSelect.value = parts[0];
                if (typeof updateSigunguSelect === 'function') {
                    updateSigunguSelect(parts[0], 'addressSigungu');
                    document.getElementById('addressSigungu').value = parts[1];
                }
            }
        } else {
            document.getElementById('addressSido').value = '';
            if (typeof updateSigunguSelect === 'function') {
                updateSigunguSelect('', 'addressSigungu');
            }
        }
        
        clearPasswords();
    });

    function clearPasswords() {
        currentPassword.value = '';
        newPassword.value = '';
        confirmPassword.value = '';
        passwordError.textContent = '';
    }

    // Password Validation on typing
    function validatePasswordMatch() {
        if (newPassword.value !== confirmPassword.value) {
            passwordError.textContent = "새 비밀번호가 일치하지 않습니다.";
            return false;
        }
        passwordError.textContent = "";
        return true;
    }

    newPassword.addEventListener('input', validatePasswordMatch);
    confirmPassword.addEventListener('input', validatePasswordMatch);

    // Update user info
    updateForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const nickname = nicknameInput.value.trim();
        const sido = document.getElementById('addressSido').value;
        const sigungu = document.getElementById('addressSigungu').value;
        const address = (sido && sigungu) ? `${sido} ${sigungu}` : '';
        const currentPw = currentPassword.value.trim();
        const newPw = newPassword.value.trim();

        if (!nickname) {
            alert("닉네임을 입력해주세요.");
            return;
        }

        const body = { nickname, address };

        if (newPw) {
            if (!currentPw) {
                alert("현재 비밀번호를 입력해주세요.");
                currentPassword.focus();
                return;
            }
            if (!validatePasswordMatch()) {
                alert("새 비밀번호 확인을 다시 진행해주세요.");
                confirmPassword.focus();
                return;
            }
            body.currentPassword = currentPw;
            body.newPassword = newPw;
        }

        fetch('/members/me', {
            method: 'PUT',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(body)
        })
        .then(async res => {
            if (res.ok) {
                showToast("정보가 성공적으로 수정되었습니다.");
                // Switch back to view mode and reload
                updateForm.style.display = 'none';
                viewMode.style.display = 'block';
                loadUserInfo();
                
                // Update header nickname instantly
                const headerNickname = document.getElementById("headerNickname");
                if (headerNickname) headerNickname.innerText = nickname + '님';
            } else {
                const errorData = await res.json();
                throw new Error(errorData.message || "정보 수정에 실패했습니다.");
            }
        })
        .catch(err => {
            alert(err.message);
        });
    });

    function showToast(msg) {
        const toast = document.getElementById('toastMsg');
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
});
