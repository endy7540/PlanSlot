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

    @Override
    public boolean checkDuplicateId(String loginId) {
        return memberRepository.existsByLoginId(loginId);
    }

    @Override
    public com.example.planslot.member.dto.MemberResponseDTO.MyPage getMyPage(String email) {
        Member member = memberRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 회원입니다."));
        return com.example.planslot.member.dto.MemberResponseDTO.MyPage.builder()
                .email(member.getEmail())
                .nickname(member.getNickname())
                .address(member.getAddress())
                .profileImageUrl(member.getProfileImageUrl())
                .role(member.getRole().name())
                .build();
    }

    @Override
    @Transactional
    public void updateMyInfo(String email, MemberRequestDTO.UpdateInfo request) {
        Member member = memberRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 회원입니다."));
        
        String encodedPassword = null;
        if (request.getNewPassword() != null && !request.getNewPassword().trim().isEmpty()) {
            if (request.getCurrentPassword() == null || request.getCurrentPassword().trim().isEmpty()) {
                throw new IllegalArgumentException("현재 비밀번호를 입력해주세요.");
            }
            if (!passwordEncoder.matches(request.getCurrentPassword(), member.getPassword())) {
                throw new IllegalArgumentException("현재 비밀번호가 일치하지 않습니다.");
            }
            encodedPassword = passwordEncoder.encode(request.getNewPassword());
        }
        
        member.updateInfo(request.getNickname(), encodedPassword, request.getAddress());
    }

    @Override
    @Transactional
    public void withdraw(String email) {
        Member member = memberRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 회원입니다."));
        member.withdraw();
    }

    @Override
    @Transactional
    public void updateNotification(String email, MemberRequestDTO.UpdateNotification request) {
        Member member = memberRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 회원입니다."));
        member.updateNotification(request.isAllowActivityNoti(), request.isAllowMarketingNoti());
    }

    @Override
    @Transactional
    public void updateProfileImage(String email, String imageUrl) {
        Member member = memberRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 회원입니다."));
        member.updateProfileImage(imageUrl);
    }
}
