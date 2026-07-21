package com.example.planslot.admin.dto;

import com.example.planslot.boardreport.entity.BoardReport;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class AdminReportResponseDTO {
    private Long reportId;
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
                .reportId(report.getReportId())
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
}
