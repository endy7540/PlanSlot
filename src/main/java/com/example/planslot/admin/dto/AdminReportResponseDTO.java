package com.example.planslot.admin.dto;

import com.example.planslot.boardreport.entity.BoardReport;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class AdminReportResponseDTO {
    private String reportId;
    private String reporterNickname;
    private String targetType;
    private Long targetId;
    private String reasonCode;
    private String reasonDetail;
    private String status;
    private LocalDateTime createdAt;
    
    private String targetContent;
    private String targetBody;
    private String reportedNickname;

    public static AdminReportResponseDTO fromEntity(BoardReport report, String targetContent, String targetBody, String reportedNickname) {
        return AdminReportResponseDTO.builder()
                .reportId("B_" + report.getReportId())
                .reporterNickname(report.getReporter().getNickname())
                .reportedNickname(reportedNickname)
                .targetType(report.getTargetType().name())
                .targetId(report.getTargetId())
                .reasonCode(report.getReasonCode().getDescription())
                .reasonDetail(report.getReasonDetail())
                .status(report.getStatus().name())
                .createdAt(report.getCreatedAt())
                .targetContent(targetContent)
                .targetBody(targetBody)
                .build();
    }
    public static AdminReportResponseDTO fromGroupEntity(com.example.planslot.groupchat.entity.GroupReport report) {
        String translatedReason = report.getReason();
        try {
            translatedReason = com.example.planslot.boardreport.entity.BoardReportReasonCode.valueOf(report.getReason()).getDescription();
        } catch (Exception e) {
            // ignore and use raw string
        }
        
        return AdminReportResponseDTO.builder()
                .reportId("C_" + report.getId())
                .reporterNickname(report.getMember().getNickname())
                .reportedNickname(report.getReportedMember().getNickname())
                .targetType("CHAT")
                .targetId(report.getChatMessage().getId())
                .reasonCode(translatedReason)
                .reasonDetail(report.getReasonDetail())
                .status(report.getStatus().name())
                .createdAt(report.getCreatedAt())
                .targetContent(report.getGroup().getGroupName() + " 채팅방")
                .targetBody(report.getChatMessage().getContent())
                .build();
    }
}
