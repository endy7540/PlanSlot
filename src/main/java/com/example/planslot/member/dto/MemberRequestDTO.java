package com.example.planslot.member.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

public class MemberRequestDTO {
    @Getter
    @Setter
    @NoArgsConstructor
    public static class SignUp {
        private String loginId;
        private String password;
        private String email;
        private String nickname;
        private String address;
    }
}
