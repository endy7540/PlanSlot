package com.example.planslot.member.controller;

import com.example.planslot.member.servcie.MemberService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

@RestController
@RequestMapping("/members")
@RequiredArgsConstructor
public class MemberController {
    private final MemberService memberService;

    @GetMapping("/checkDuplicate")
    public ResponseEntity<Boolean> checkDuplicate(@RequestParam("loginId") String loginId) {
        return ResponseEntity.ok(memberService.checkDuplicateId(loginId));
    }

    @GetMapping("/me")
    public ResponseEntity<com.example.planslot.member.dto.MemberResponseDTO.MyPage> getMyPage(org.springframework.security.core.Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(memberService.getMyPage(authentication.getName()));
    }

    @org.springframework.web.bind.annotation.PutMapping("/me")
    public ResponseEntity<Void> updateMyPage(org.springframework.security.core.Authentication authentication, @org.springframework.web.bind.annotation.RequestBody com.example.planslot.member.dto.MemberRequestDTO.UpdateInfo request) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.UNAUTHORIZED).build();
        }
        memberService.updateMyInfo(authentication.getName(), request);
        return ResponseEntity.ok().build();
    }
}
