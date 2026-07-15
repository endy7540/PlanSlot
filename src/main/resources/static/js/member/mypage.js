document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('jwtToken');
    if (!token) {
        alert("로그인이 필요한 서비스입니다.");
        window.location.href = "/auth/login";
        return;
    }

    const emailInput = document.getElementById('email');
    const nicknameInput = document.getElementById('nickname');
    const addressInput = document.getElementById('address');
    const passwordInput = document.getElementById('password');
    const updateForm = document.getElementById('updateForm');

    // Fetch user info
    fetch('/members/me', {
        headers: {
            'Authorization': 'Bearer ' + token
        }
    })
    .then(res => {
        if (res.status === 401) {
            throw new Error("unauthorized");
        }
        return res.json();
    })
    .then(data => {
        emailInput.value = data.email || '';
        nicknameInput.value = data.nickname || '';
        addressInput.value = data.address || '';
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

    // Update user info
    updateForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const nickname = nicknameInput.value.trim();
        const address = addressInput.value.trim();
        const password = passwordInput.value.trim();

        if (!nickname) {
            alert("닉네임을 입력해주세요.");
            return;
        }

        const body = { nickname, address };
        if (password) {
            body.password = password;
        }

        fetch('/members/me', {
            method: 'PUT',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        })
        .then(res => {
            if (res.ok) {
                showToast("정보가 성공적으로 수정되었습니다.");
                passwordInput.value = ''; // 비밀번호 필드 초기화
            } else {
                throw new Error("update failed");
            }
        })
        .catch(err => {
            console.error(err);
            alert("정보 수정에 실패했습니다.");
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
