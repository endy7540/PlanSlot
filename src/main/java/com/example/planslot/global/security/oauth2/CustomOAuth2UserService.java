package com.example.planslot.global.security.oauth2;

import com.example.planslot.member.entity.Member;
import com.example.planslot.member.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CustomOAuth2UserService implements OAuth2UserService<OAuth2UserRequest, OAuth2User> {

    private final MemberRepository memberRepository;

    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        OAuth2UserService<OAuth2UserRequest, OAuth2User> delegate = new DefaultOAuth2UserService();
        OAuth2User oAuth2User = delegate.loadUser(userRequest);

        String registrationId = userRequest.getClientRegistration().getRegistrationId();
        Map<String, Object> attributes = oAuth2User.getAttributes();

        String providerId = "";
        String email = "";
        String name = "";

        if ("google".equals(registrationId)) {
            providerId = String.valueOf(attributes.get("sub"));
            email = String.valueOf(attributes.get("email"));
            name = String.valueOf(attributes.get("name"));
        }

        String loginId = registrationId + "_" + providerId;
        
        Member member = memberRepository.findByLoginId(loginId).orElse(null);
        if (member == null) {
            String nickname = name + "_" + UUID.randomUUID().toString().substring(0, 4);
            member = Member.builder()
                    .loginId(loginId)
                    .password("") // 소셜 로그인은 비밀번호 없음
                    .email(email)
                    .nickname(nickname)
                    .role(Member.Role.MEMBER)
                    .status(Member.Status.ACTIVE)
                    .build();
            memberRepository.save(member);
        }

        return new DefaultOAuth2User(
                Collections.singleton(new SimpleGrantedAuthority("ROLE_MEMBER")),
                attributes,
                "sub" // 구글의 PK 키 이름
        );
    }
}
