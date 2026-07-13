package com.example.planslot.member.controller;

import com.example.planslot.member.dto.MemberRequestDTO;
import com.example.planslot.member.servcie.MemberService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/members")
@RequiredArgsConstructor
public class MemberController {
    private final MemberService memberService;

    @PostMapping("/signup")
    public ResponseEntity<String> signUp(@RequestBody MemberRequestDTO.SignUp request) {
        Long memberId = memberService.signUp(request);
        return ResponseEntity.ok("회원가입 성공");
    }
}
