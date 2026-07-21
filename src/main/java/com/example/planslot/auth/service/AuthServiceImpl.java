package com.example.planslot.auth.service;

import com.example.planslot.auth.dto.AuthRequestDTO;
import com.example.planslot.global.security.jwt.JwtTokenProvider;
import com.example.planslot.member.entity.Member;
import com.example.planslot.member.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuthServiceImpl implements AuthService{
    private final MemberRepository memberRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    @Override
    @Transactional
    public String login(AuthRequestDTO.Login request) {
        Member member = memberRepository.findByLoginId(request.getLoginId())
                .orElseThrow(() -> new IllegalArgumentException("아이디 또는 비밀번호를 확인해주세요."));
        if (!passwordEncoder.matches(request.getPassword(), member.getPassword())) {
            throw new IllegalArgumentException("아이디 또는 비밀번호를 확인해주세요.");
        }

        if (member.getStatus() == Member.Status.WITHDRAWN) {
            throw new IllegalArgumentException("탈퇴 처리된 계정입니다.");
        }

        // 로그인 시 정지 기간이 지났는지 체크하여 자동 해제 (로그인은 항상 허용)
        if (member.getStatus() == Member.Status.SUSPENDED) {
            if (member.getSuspendedUntil() != null && java.time.LocalDateTime.now().isAfter(member.getSuspendedUntil())) {
                member.updateStatus(Member.Status.ACTIVE, null);
            }
        }

        return jwtTokenProvider.createAccessToken(member.getEmail(), member.getRole().name(), request.isKeepLogin());
    }
}
