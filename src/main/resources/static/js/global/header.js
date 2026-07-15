document.addEventListener("DOMContentLoaded", function() {
  const token = localStorage.getItem("jwtToken");
  const authBtn = document.getElementById("authBtn");

  if (authBtn) {
    if (!token) {
      authBtn.innerText = "로그인 / 회원가입";
      authBtn.onclick = function() {
        window.location.href = "/auth/login";
      };
    } else {
      authBtn.innerText = "로그아웃";
      authBtn.onclick = function() {
        if (confirm("정말 로그아웃 하시겠습니까?")) {
          localStorage.removeItem("jwtToken");
          localStorage.removeItem("memberId");
          alert("안전하게 로그아웃 되었습니다.");
          window.location.href = "/";
        }
      };
    }
  }
});
