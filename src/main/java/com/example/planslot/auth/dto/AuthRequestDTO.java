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
        private String type; // "signup" or "find"
    }

    @Getter
    @NoArgsConstructor
    public static class EmailVerify {
        private String email;
        private String authCode;
    }

    @Getter
    @NoArgsConstructor
    public static class FindId {
        private String email;
        private String authCode;
    }

    @Getter
    @NoArgsConstructor
    public static class FindPw {
        private String loginId;
        private String email;
        private String authCode;
    }
}
