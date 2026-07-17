window.addEventListener("DOMContentLoaded", function() {
    const token = localStorage.getItem("jwtToken");
    const loginBtn = document.getElementById("loginBtn");
    const profileWrap = document.getElementById("profileWrap");
    const profileBtn = document.getElementById("profileBtn");
    const profileDropdown = document.getElementById("profileDropdown");
    const logoutBtn = document.getElementById("logoutBtn");
    
    if (!token) {
        if (loginBtn) loginBtn.style.display = "block";
        if (profileWrap) profileWrap.style.display = "none";
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
                headerNickname.innerText = data.nickname + '님';
                const headerProfileImage = document.getElementById("headerProfileImage");
                if (headerProfileImage) {
                    if (data.profileImageUrl) {
                        headerProfileImage.src = data.profileImageUrl;
                    } else {
                        headerProfileImage.src = "/images/default-avatar.png";
                    }
                }

                if (data.role === 'ADMIN') {
                    if (!document.getElementById("adminPageLink")) {
                        const adminLink = document.createElement('a');
                        adminLink.id = "adminPageLink";
                        adminLink.href = "/admin";
                        adminLink.innerText = "관리자 페이지";
                        adminLink.style.color = "#e11d48";
                        adminLink.style.fontWeight = "bold";
                        profileDropdown.insertBefore(adminLink, profileDropdown.firstChild);
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
                    document.cookie = "jwtToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                    alert("안전하게 로그아웃 되었습니다.");
                    window.location.reload();
                }
            });
        }
    }
});
