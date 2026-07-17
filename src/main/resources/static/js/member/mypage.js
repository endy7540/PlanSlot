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

            // Update Profile Image
            if (data.profileImageUrl) {
                document.getElementById('profileImagePreview').src = data.profileImageUrl;
            } else {
                document.getElementById('profileImagePreview').src = "/images/default-avatar.png";
            }

            // Update Notifications
            if (document.getElementById('toggleActivityNoti')) {
                document.getElementById('toggleActivityNoti').checked = data.allowActivityNoti;
            }
            if (document.getElementById('toggleMarketingNoti')) {
                document.getElementById('toggleMarketingNoti').checked = data.allowMarketingNoti;
            }
            
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

    // Profile Image Upload with Cropper.js
    const profileImageInput = document.getElementById('profileImageInput');
    const profileImagePreview = document.getElementById('profileImagePreview');
    const cropModal = document.getElementById('cropModal');
    const cropImageTarget = document.getElementById('cropImageTarget');
    const btnCancelCrop = document.getElementById('btnCancelCrop');
    const btnConfirmCrop = document.getElementById('btnConfirmCrop');
    let cropper = null;

    if (profileImageInput) {
        profileImageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Validate file size
            if (file.size > 5 * 1024 * 1024) {
                alert('파일 크기는 5MB 이하여야 합니다.');
                profileImageInput.value = '';
                return;
            }

            // Validate file type
            const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!validImageTypes.includes(file.type)) {
                alert('이미지 파일(jpg, png, gif, webp)만 업로드 가능합니다.');
                profileImageInput.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = function(event) {
                cropImageTarget.src = event.target.result;
                cropModal.style.display = 'flex';
                
                // 모달이 열릴 때 '적용 및 업로드' 버튼으로 포커스를 이동시켜 엔터키가 동작하게 함
                setTimeout(() => {
                    if (btnConfirmCrop) btnConfirmCrop.focus();
                }, 100);
                
                if (cropper) {
                    cropper.destroy();
                }
                
                cropper = new Cropper(cropImageTarget, {
                    aspectRatio: 1, // 1:1 ratio
                    viewMode: 1,
                    autoCropArea: 1,
                    dragMode: 'move',
                    background: false
                });
            };
            reader.readAsDataURL(file);
        });
    }

    if (btnCancelCrop) {
        btnCancelCrop.addEventListener('click', () => {
            cropModal.style.display = 'none';
            profileImageInput.value = '';
            if (cropper) {
                cropper.destroy();
                cropper = null;
            }
        });
    }

    // 엔터키 입력 시 '적용 및 업로드' 버튼 클릭 처리
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && cropModal.style.display === 'flex' && !btnConfirmCrop.disabled) {
            e.preventDefault(); // 기본 엔터 동작 방지
            btnConfirmCrop.click();
        }
    });

    if (btnConfirmCrop) {
        btnConfirmCrop.addEventListener('click', () => {
            if (!cropper) return;
            
            btnConfirmCrop.innerText = '업로드 중...';
            btnConfirmCrop.disabled = true;

            cropper.getCroppedCanvas({
                width: 300,
                height: 300
            }).toBlob((blob) => {
                if (!blob) {
                    alert('이미지 크롭에 실패했습니다.');
                    btnConfirmCrop.innerText = '적용 및 업로드';
                    btnConfirmCrop.disabled = false;
                    return;
                }
                
                const formData = new FormData();
                formData.append('file', blob, 'profile.png');

                fetch('/members/profile-image', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + token
                    },
                    body: formData
                })
                .then(async res => {
                    if (res.ok) {
                        const data = await res.json();
                        profileImagePreview.src = data.imageUrl;
                        
                        // Update header image immediately
                        const headerProfileImg = document.getElementById("headerProfileImage");
                        if (headerProfileImg) {
                            headerProfileImg.src = data.imageUrl;
                        }
                        
                        showToast("프로필 이미지가 변경되었습니다.");
                        cropModal.style.display = 'none';
                        profileImageInput.value = '';
                        cropper.destroy();
                        cropper = null;
                    } else {
                        const errorData = await res.json();
                        throw new Error(errorData.message || "이미지 업로드에 실패했습니다.");
                    }
                })
                .catch(err => {
                    alert(err.message);
                })
                .finally(() => {
                    btnConfirmCrop.innerText = '적용 및 업로드';
                    btnConfirmCrop.disabled = false;
                });
            }, 'image/png');
        });
    }

    // Withdraw Modal Logic
    const btnShowWithdraw = document.getElementById('btnShowWithdraw');
    const withdrawModal = document.getElementById('withdrawModal');
    const btnCancelWithdraw = document.getElementById('btnCancelWithdraw');
    const btnSubmitWithdraw = document.getElementById('btnSubmitWithdraw');
    const withdrawConfirmText = document.getElementById('withdrawConfirmText');

    if (btnShowWithdraw && withdrawModal) {
        btnShowWithdraw.addEventListener('click', (e) => {
            e.preventDefault();
            withdrawModal.style.display = 'flex';
            withdrawConfirmText.value = '';
            btnSubmitWithdraw.disabled = true;
        });

        btnCancelWithdraw.addEventListener('click', () => {
            withdrawModal.style.display = 'none';
        });

        withdrawConfirmText.addEventListener('input', (e) => {
            if (e.target.value === '회원 탈퇴') {
                btnSubmitWithdraw.disabled = false;
            } else {
                btnSubmitWithdraw.disabled = true;
            }
        });

        btnSubmitWithdraw.addEventListener('click', () => {
            if (withdrawConfirmText.value !== '회원 탈퇴') return;

            fetch('/members/me', {
                method: 'DELETE',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Accept': 'application/json'
                }
            })
            .then(res => {
                if (res.ok) {
                    alert('회원 탈퇴가 완료되었습니다. 그동안 이용해 주셔서 감사합니다.');
                    localStorage.removeItem('jwtToken');
                    window.location.href = '/planslot';
                } else {
                    alert('회원 탈퇴 처리에 실패했습니다. 다시 시도해 주세요.');
                }
            })
            .catch(err => {
                console.error(err);
                alert('회원 탈퇴 중 오류가 발생했습니다.');
            });
        });
    }

    // Tab Switching
    window.switchTab = function(tabId) {
        // Update sidebar active state
        document.querySelectorAll('.sidebar-menu li').forEach(li => li.classList.remove('active'));
        document.querySelector(`.sidebar-menu a[href="#${tabId}"]`).parentElement.classList.add('active');

        // Show selected section
        document.querySelectorAll('.mypage-section').forEach(sec => sec.style.display = 'none');
        document.getElementById(`section-${tabId}`).style.display = 'block';
    };

    // Save Notifications
    window.saveNotificationSettings = function() {
        const allowActivityNoti = document.getElementById('toggleActivityNoti').checked;
        const allowMarketingNoti = document.getElementById('toggleMarketingNoti').checked;

        fetch('/members/notifications', {
            method: 'PUT',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                allowActivityNoti,
                allowMarketingNoti
            })
        })
        .then(async res => {
            if (res.ok) {
                showToast("알림 설정이 저장되었습니다.");
            } else {
                throw new Error("설정 저장에 실패했습니다.");
            }
        })
        .catch(err => {
            alert(err.message);
        });
    };
});
