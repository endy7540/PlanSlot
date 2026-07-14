package com.example.planslot.auth.service;

public interface EmailService {
    void sendAuthCode(String email);
    boolean verifyAuthCode(String email, String authCode);
}
