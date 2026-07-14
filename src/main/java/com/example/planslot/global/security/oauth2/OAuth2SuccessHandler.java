package com.example.planslot.global.security.oauth2;

import com.example.planslot.global.security.jwt.JwtTokenProvider;
import com.example.planslot.member.entity.Member;
import com.example.planslot.member.repository.MemberRepository;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class OAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final JwtTokenProvider jwtTokenProvider;
    private final MemberRepository memberRepository;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, Authentication authentication) throws IOException, ServletException {
        OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();
        
        String providerId = String.valueOf(oAuth2User.getAttributes().get("sub"));
        String loginId = "google_" + providerId;
        
        Member member = memberRepository.findByLoginId(loginId)
                .orElseThrow(() -> new IllegalArgumentException("가입되지 않은 소셜 계정입니다."));

        // JWT 토큰 발급 (기본 1시간 유지로 설정)
        String token = jwtTokenProvider.createAccessToken(member.getLoginId(), member.getRole().name(), false);

        // 프론트엔드로 토큰을 전달하기 위해 리다이렉트 (임시 페이지에서 로컬스토리지에 저장하도록 유도)
        String redirectUrl = "/auth/oauth2-callback?token=" + token;
        getRedirectStrategy().sendRedirect(request, response, redirectUrl);
    }
}
