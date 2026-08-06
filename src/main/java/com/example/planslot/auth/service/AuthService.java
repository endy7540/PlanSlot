package com.example.planslot.auth.service;

import com.example.planslot.auth.dto.AuthRequestDTO;

public interface AuthService {
    String login(AuthRequestDTO.Login request);
    String findIdByEmail(String email, String authCode);
    void resetPassword(String loginId, String email, String authCode);
}
