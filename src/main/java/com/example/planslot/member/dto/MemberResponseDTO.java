package com.example.planslot.member.dto;

import lombok.Builder;
import lombok.Getter;

public class MemberResponseDTO {

    @Getter
    @Builder
    public static class MyPage {
        private String email;
        private String nickname;
        private String address;
        private String profileImageUrl;
        private boolean allowActivityNoti;
        private boolean allowMarketingNoti;
        private String role;
    }
}
