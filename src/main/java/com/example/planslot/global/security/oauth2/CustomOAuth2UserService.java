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
        Map<String, Object> modifiableAttributes = new java.util.HashMap<>(attributes);

        String providerId = "";
        String email = "";
        String name = "";
        String profileImageUrl = null;
        String userNameAttributeName = "";

        if ("google".equals(registrationId)) {
            providerId = String.valueOf(attributes.get("sub"));
            email = String.valueOf(attributes.get("email"));
            name = String.valueOf(attributes.get("name"));
            profileImageUrl = attributes.containsKey("picture") ? String.valueOf(attributes.get("picture")) : null;
            userNameAttributeName = "sub";
        } else if ("kakao".equals(registrationId)) {
            providerId = String.valueOf(attributes.get("id"));
            Map<String, Object> kakaoAccount = (Map<String, Object>) attributes.get("kakao_account");
            Map<String, Object> profile = (Map<String, Object>) kakaoAccount.get("profile");
            
            email = kakaoAccount.containsKey("email") ? String.valueOf(kakaoAccount.get("email")) : "kakao_" + providerId + "@kakao.com";
            name = profile.containsKey("nickname") ? String.valueOf(profile.get("nickname")) : "카카오유저";
            profileImageUrl = profile.containsKey("profile_image_url") ? String.valueOf(profile.get("profile_image_url")) : null;
            userNameAttributeName = "id";
        }

        modifiableAttributes.put("normalized_email", email);

        // 이메일로 기존 회원 조회 (소셜 연동)
        Member member = memberRepository.findByEmail(email).orElse(null);
        if (member == null) {
            String loginId = registrationId + "_" + providerId;
            
            String nickname;
            java.util.Random random = new java.util.Random();
            int attempts = 0;
            int tagMax = 10000;
            String format = "#%04d";
            
            do {
                int tag = random.nextInt(tagMax);
                nickname = name + String.format(format, tag);
                attempts++;
                
                // 50번 실패할 때마다 자릿수를 늘림 (4자리 -> 5자리 -> 6자리...)
                if (attempts % 50 == 0) {
                    tagMax *= 10;
                    format = "#%0" + (String.valueOf(tagMax - 1).length()) + "d";
                }
            } while (memberRepository.existsByNickname(nickname));

            member = Member.builder()
                    .loginId(loginId)
                    .password("") // 소셜 로그인은 비밀번호 없음
                    .email(email)
                    .nickname(nickname)
                    .profileImageUrl(profileImageUrl)
                    .role(Member.Role.MEMBER)
                    .status(Member.Status.ACTIVE)
                    .build();
            memberRepository.save(member);
            modifiableAttributes.put("is_new", true);
        } else {
            // 기존 회원이지만 프로필 이미지가 없는 경우 소셜 이미지로 동기화
            if (member.getProfileImageUrl() == null && profileImageUrl != null) {
                member.updateProfileImage(profileImageUrl);
                memberRepository.save(member);
            }
        }

        return new DefaultOAuth2User(
                Collections.singleton(new SimpleGrantedAuthority("ROLE_MEMBER")),
                modifiableAttributes,
                userNameAttributeName
        );
    }
}
