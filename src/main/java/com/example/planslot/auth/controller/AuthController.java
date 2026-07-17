package com.example.planslot.auth.controller;

import com.example.planslot.auth.dto.AuthRequestDTO;
import com.example.planslot.auth.service.AuthService;
import com.example.planslot.member.dto.MemberRequestDTO;
import com.example.planslot.member.servcie.MemberService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;
    private final MemberService memberService;
    private final com.example.planslot.auth.service.EmailService emailService;

    @PostMapping("/signup")
    public ResponseEntity<String> signUp(@RequestBody MemberRequestDTO.SignUp request) {
        Long memberId = memberService.signUp(request);
        return ResponseEntity.ok("회원가입 성공");
    }

    @PostMapping("/login")
    public ResponseEntity<String> login(@RequestBody AuthRequestDTO.Login request) {
        try {
            String token = authService.login(request);
            return ResponseEntity.ok("Bearer " + token);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/email/send")
    public ResponseEntity<?> sendEmailCode(@RequestBody AuthRequestDTO.EmailSend request) {
        try {
            emailService.sendAuthCode(request.getEmail());
            return ResponseEntity.ok("인증 번호 발송 완료");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/email/verify")
    public ResponseEntity<?> verifyEmailCode(@RequestBody AuthRequestDTO.EmailVerify request) {
        try {
            emailService.verifyAuthCode(request.getEmail(), request.getAuthCode());
            return ResponseEntity.ok("인증 성공");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
