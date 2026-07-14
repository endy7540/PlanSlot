package com.example.planslot.auth.service;

import com.example.planslot.member.entity.AuthEmail;
import com.example.planslot.member.repository.AuthEmailRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Random;

@Service
@RequiredArgsConstructor
public class EmailServiceImpl implements EmailService {

    private final JavaMailSender javaMailSender;
    private final AuthEmailRepository authEmailRepository;
    private final com.example.planslot.member.repository.MemberRepository memberRepository;

    @Override
    @Transactional
    public void sendAuthCode(String email) {
        if (memberRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("이미 가입된 이메일입니다. (소셜 로그인 계정 포함)");
        }

        // 6자리 랜덤 코드 생성
        String authCode = createCode();

        // 이메일 발송
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(email);
        message.setSubject("[PlanSlot] 회원가입 이메일 인증 번호입니다.");
        message.setText("인증 번호: " + authCode + "\n\n5분 이내에 입력해 주세요.");
        javaMailSender.send(message);

        // DB에 저장 (만료시간 5분)
        AuthEmail authEmail = AuthEmail.builder()
                .email(email)
                .authCode(authCode)
                .isVerified("N")
                .expiredAt(LocalDateTime.now().plusMinutes(5))
                .build();
        
        authEmailRepository.save(authEmail);
    }

    @Override
    @Transactional
    public boolean verifyAuthCode(String email, String authCode) {
        AuthEmail authEmail = authEmailRepository.findTopByEmailOrderByCreatedAtDesc(email)
                .orElseThrow(() -> new IllegalArgumentException("인증 요청 내역이 없습니다."));

        if ("Y".equals(authEmail.getIsVerified())) {
            throw new IllegalArgumentException("이미 인증된 이메일입니다.");
        }

        if (authEmail.getExpiredAt().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("인증 시간이 만료되었습니다.");
        }

        if (!authEmail.getAuthCode().equals(authCode)) {
            throw new IllegalArgumentException("인증 번호가 일치하지 않습니다.");
        }

        authEmail.verifySuccess();
        return true;
    }

    private String createCode() {
        Random random = new Random();
        StringBuilder key = new StringBuilder();
        for (int i = 0; i < 6; i++) {
            key.append(random.nextInt(10));
        }
        return key.toString();
    }
}
