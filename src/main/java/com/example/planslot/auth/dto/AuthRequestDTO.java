package com.example.planslot.auth.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;

public class AuthRequestDTO {
    @Getter
    @NoArgsConstructor
    public static class Login {
        private String loginId;
        private String password;
        private boolean keepLogin;
    }

    @Getter
    @NoArgsConstructor
    public static class EmailSend {
        private String email;
    }

    @Getter
    @NoArgsConstructor
    public static class EmailVerify {
        private String email;
        private String authCode;
    }
}
