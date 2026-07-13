package com.example.planslot.auth.controller;

import com.example.planslot.auth.dto.AuthRequestDTO;
import com.example.planslot.auth.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<String> login(@RequestBody AuthRequestDTO.Login request) {
        String token = authService.login(request);
        return ResponseEntity.ok("Bearer " + token);
    }
}
