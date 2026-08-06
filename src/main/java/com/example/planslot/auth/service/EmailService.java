package com.example.planslot.auth.service;

public interface EmailService {
    void sendAuthCode(String email, String type);
    boolean verifyAuthCode(String email, String authCode);
}
