package com.example.planslot.member.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
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
        
        @NotBlank(message = "닉네임을 입력해주세요.")
        @Size(min = 2, max = 20, message = "닉네임은 2자 이상 20자 이하로 입력해주세요.")
        private String nickname;
        
        private String address;
        private boolean allowActivityNoti;
        private boolean allowMarketingNoti;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    public static class UpdateInfo {
        @NotBlank(message = "닉네임을 입력해주세요.")
        @Size(min = 2, max = 20, message = "닉네임은 2자 이상 20자 이하로 입력해주세요.")
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
