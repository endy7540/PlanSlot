package com.example.planslot.global.security.oauth2;

import com.example.planslot.global.security.jwt.JwtTokenProvider;
import com.example.planslot.member.entity.Member;
import com.example.planslot.member.repository.MemberRepository;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientService;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class OAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final JwtTokenProvider jwtTokenProvider;
    private final MemberRepository memberRepository;
    private final OAuth2AuthorizedClientService authorizedClientService;

    @Override
    @Transactional
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, Authentication authentication) throws IOException, ServletException {
        OAuth2AuthenticationToken oauthToken = (OAuth2AuthenticationToken) authentication;
        OAuth2User oAuth2User = oauthToken.getPrincipal();
        
        String linkEmail = (String) request.getSession().getAttribute("LINK_GOOGLE_EMAIL");
        if (linkEmail != null) {
            Member member = memberRepository.findByEmail(linkEmail)
                    .orElseThrow(() -> new IllegalArgumentException("계정을 찾을 수 없습니다."));
            
            if ("google".equals(oauthToken.getAuthorizedClientRegistrationId())) {
                OAuth2AuthorizedClient client = authorizedClientService.loadAuthorizedClient(
                        oauthToken.getAuthorizedClientRegistrationId(),
                        oauthToken.getName());
                
                if (client != null) {
                    String accessToken = client.getAccessToken().getTokenValue();
                    String refreshToken = client.getRefreshToken() != null ? client.getRefreshToken().getTokenValue() : null;
                    member.updateGoogleTokens(accessToken, refreshToken);
                    memberRepository.save(member);
                }
            }
            
            request.getSession().removeAttribute("LINK_GOOGLE_EMAIL");
            getRedirectStrategy().sendRedirect(request, response, "/mypage?sync=success");
            return;
        }

        String email = String.valueOf(oAuth2User.getAttributes().get("normalized_email"));
        
        Member member = memberRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("가입되지 않은 계정입니다."));

        if ("google".equals(oauthToken.getAuthorizedClientRegistrationId())) {
            OAuth2AuthorizedClient client = authorizedClientService.loadAuthorizedClient(
                    oauthToken.getAuthorizedClientRegistrationId(),
                    oauthToken.getName());
            
            if (client != null) {
                String accessToken = client.getAccessToken().getTokenValue();
                String refreshToken = client.getRefreshToken() != null ? client.getRefreshToken().getTokenValue() : null;
                member.updateGoogleTokens(accessToken, refreshToken);
                memberRepository.save(member);
            }
        }

        String token = jwtTokenProvider.createAccessToken(member.getEmail(), member.getRole().name(), false);
        boolean isNew = Boolean.TRUE.equals(oAuth2User.getAttributes().get("is_new"));
        String redirectUrl = "/auth/oauth2-callback?token=" + token + (isNew ? "&isNew=true" : "");
        getRedirectStrategy().sendRedirect(request, response, redirectUrl);
    }
}
