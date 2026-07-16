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
        private boolean allowActivityNoti;
        private boolean allowMarketingNoti;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    public static class UpdateInfo {
        private String nickname;
        private String address;
        private String currentPassword;
        private String newPassword;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    public static class UpdateNotification {
        private boolean allowActivityNoti;
        private boolean allowMarketingNoti;
    }
}
