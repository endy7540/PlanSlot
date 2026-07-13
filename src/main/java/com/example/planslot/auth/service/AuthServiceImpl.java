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
    public String login(AuthRequestDTO.Login request) {
        Member member = memberRepository.findByLoginId(request.getLoginId())
                .orElseThrow(() -> new IllegalArgumentException("가입되지 않은 아이디입니다."));
        if (!passwordEncoder.matches(request.getPassword(), member.getPassword())) {
            throw new IllegalArgumentException("비밀번호가 일치하지 않습니다.");
        }
        return jwtTokenProvider.createAccessToken(member.getEmail(), member.getRole().name());
    }
}
