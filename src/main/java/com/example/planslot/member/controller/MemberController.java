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
}
