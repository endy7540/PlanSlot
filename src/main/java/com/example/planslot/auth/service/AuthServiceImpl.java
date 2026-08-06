package com.example.planslot.auth.service;

import com.example.planslot.auth.dto.AuthRequestDTO;
import com.example.planslot.global.security.jwt.JwtTokenProvider;
import com.example.planslot.member.entity.Member;
import com.example.planslot.member.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.SimpleMailMessage;
import java.util.UUID;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuthServiceImpl implements AuthService{
    private final MemberRepository memberRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final EmailService emailService;
    private final JavaMailSender javaMailSender;

    @Override
    @Transactional
    public String login(AuthRequestDTO.Login request) {
        if (request.getLoginId() == null || request.getLoginId().trim().isEmpty()) {
            throw new IllegalArgumentException("아이디를 입력해주세요.");
        }
        Member member = memberRepository.findByLoginId(request.getLoginId())
                .orElseThrow(() -> new IllegalArgumentException("아이디 또는 비밀번호를 확인해주세요."));
        
        if (member.getPassword() == null || !passwordEncoder.matches(request.getPassword(), member.getPassword())) {
            throw new IllegalArgumentException("아이디 또는 비밀번호를 확인해주세요.");
        }

        if (member.getStatus() == Member.Status.WITHDRAWN) {
            throw new IllegalArgumentException("탈퇴 처리된 계정입니다.");
        }

        if (member.getStatus() == Member.Status.SUSPENDED) {
            if (member.getSuspendedUntil() != null && LocalDateTime.now().isAfter(member.getSuspendedUntil())) {
                member.updateStatus(Member.Status.ACTIVE, null);
            }
        }

        return jwtTokenProvider.createAccessToken(member.getEmail(), member.getRole().name(), request.isKeepLogin());
    }

    @Override
    @Transactional
    public String findIdByEmail(String email, String authCode) {
        emailService.verifyAuthCode(email, authCode);
        Member member = memberRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("가입된 이메일이 아닙니다."));
        if (member.getLoginId() == null) {
            throw new IllegalArgumentException("해당 이메일은 구글 소셜 로그인으로 가입된 계정입니다.");
        }
        return member.getLoginId();
    }

    @Override
    @Transactional
    public void resetPassword(String loginId, String email, String authCode) {
        if (loginId == null || loginId.trim().isEmpty()) {
            throw new IllegalArgumentException("아이디를 입력해주세요.");
        }
        emailService.verifyAuthCode(email, authCode);
        Member member = memberRepository.findByLoginId(loginId)
                .orElseThrow(() -> new IllegalArgumentException("일치하는 회원 정보가 없습니다."));
        if (member.getLoginId() == null || member.getPassword() == null) {
            throw new IllegalArgumentException("소셜 로그인 계정은 비밀번호를 재설정할 수 없습니다.");
        }
        if (!member.getEmail().equals(email)) {
            throw new IllegalArgumentException("일치하는 회원 정보가 없습니다.");
        }
        
        String tempPw = UUID.randomUUID().toString().substring(0, 8);
        member.updateInfo(null, passwordEncoder.encode(tempPw), null);
        
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(email);
        message.setSubject("[PlanSlot] 임시 비밀번호 발급 안내");
        message.setText("임시 비밀번호: " + tempPw + "\n\n로그인 후 비밀번호를 반드시 변경해주세요.");
        javaMailSender.send(message);
    }
}
