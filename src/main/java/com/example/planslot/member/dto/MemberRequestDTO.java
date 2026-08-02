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
        @NotBlank(message = "아이디를 입력해주세요.")
        @jakarta.validation.constraints.Pattern(regexp = "^[a-zA-Z0-9]{4,20}$", message = "아이디는 4~20자의 영문 대소문자와 숫자로만 입력해주세요.")
        private String loginId;

        @NotBlank(message = "비밀번호를 입력해주세요.")
        @jakarta.validation.constraints.Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>/?]).{8,20}$", message = "비밀번호는 8~20자이며, 영문 대문자, 소문자, 특수문자를 각각 1개 이상 포함해야 합니다.")
        private String password;

        @NotBlank(message = "이메일을 입력해주세요.")
        @jakarta.validation.constraints.Email(message = "올바른 이메일 형식이 아닙니다.")
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
        private String calendarColor;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    public static class UpdateNotification {
        private boolean allowActivityNoti;
        private boolean allowMarketingNoti;
    }
}
