

async function testApiCall() {
  const token = localStorage.getItem("jwtToken");

  if (!token) {
    alert("로그인 후 이용할 수 있는 기능입니다.");
    return;
  }

  alert("현재 브라우저에 저장된 토큰:\n" + token.substring(0, 30)
          + "... \n\n이 토큰을 백엔드로 보내면 유저 정보를 알 수 있습니다!");
}
