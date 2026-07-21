package com.example.planslot.admin.dto;

import com.example.planslot.member.entity.Member;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class AdminMemberResponseDTO {
    private Long id;
    private String loginId;
    private String email;
    private String nickname;
    private String role;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime deletedAt;
    private LocalDateTime suspendedUntil;
    private int reportedCount;

    public static AdminMemberResponseDTO fromEntity(Member member, int reportedCount) {
        return AdminMemberResponseDTO.builder()
                .id(member.getId())
                .loginId(member.getLoginId())
                .email(maskEmail(member.getEmail()))
                .nickname(member.getNickname())
                .role(member.getRole().name())
                .status(member.getStatus().name())
                .createdAt(member.getCreatedAt())
                .deletedAt(member.getDeletedAt())
                .suspendedUntil(member.getSuspendedUntil())
                .reportedCount(reportedCount)
                .build();
    }

    private static String maskEmail(String email) {
        if (email == null || !email.contains("@")) {
            return email;
        }
        String[] parts = email.split("@");
        String localPart = parts[0];
        String domainPart = parts[1];
        
        if (localPart.length() <= 3) {
            localPart = localPart.charAt(0) + "***";
        } else {
            localPart = localPart.substring(0, 3) + "***";
        }
        return localPart + "@" + domainPart;
    }
}
