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

import com.example.planslot.auth.service.EmailService;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;
    private final MemberService memberService;
    private final EmailService emailService;

    @PostMapping("/signup")
    public ResponseEntity<String> signUp(@jakarta.validation.Valid @RequestBody MemberRequestDTO.SignUp request) {
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
            String type = request.getType();
            if (type == null || type.isEmpty()) type = "signup";
            emailService.sendAuthCode(request.getEmail(), type);
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

    @PostMapping("/find-id")
    public ResponseEntity<?> findId(@RequestBody AuthRequestDTO.FindId request) {
        try {
            String loginId = authService.findIdByEmail(request.getEmail(), request.getAuthCode());
            return ResponseEntity.ok(loginId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/find-pw")
    public ResponseEntity<?> findPw(@RequestBody AuthRequestDTO.FindPw request) {
        try {
            authService.resetPassword(request.getLoginId(), request.getEmail(), request.getAuthCode());
            return ResponseEntity.ok("임시 비밀번호가 이메일로 발송되었습니다.");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

}
