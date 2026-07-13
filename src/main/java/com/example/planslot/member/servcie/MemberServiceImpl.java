package com.example.planslot.member.servcie;

import com.example.planslot.member.dto.MemberRequestDTO;
import com.example.planslot.member.entity.Member;
import com.example.planslot.member.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MemberServiceImpl implements MemberService{
    private final MemberRepository memberRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public Long signUp(MemberRequestDTO.SignUp request) {
        if(memberRepository.existsByLoginId(request.getLoginId())) {
            throw new IllegalArgumentException("이미 사용 중인 아이디입니다.");
        }
        if(memberRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("이미 등록된 이메일입니다.");
        }

        String encodePassword = passwordEncoder.encode(request.getPassword());

        Member member = Member.builder()
                .loginId(request.getLoginId())
                .password(encodePassword)
                .email(request.getEmail())
                .nickname(request.getNickname())
                .address(request.getAddress())
                .role(Member.Role.MEMBER)
                .status(Member.Status.ACTIVE)
                .build();

        return memberRepository.save(member).getId();
    }
}
