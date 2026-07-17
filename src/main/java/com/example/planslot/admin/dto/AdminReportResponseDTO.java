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

    public static AdminReportResponseDTO fromEntity(BoardReport report, String targetContent) {
        return AdminReportResponseDTO.builder()
                .reportId(report.getReportId())
                .reporterNickname(report.getReporter().getNickname())
                .targetType(report.getTargetType().name())
                .targetId(report.getTargetId())
                .reasonCode(report.getReasonCode().getDescription())
                .reasonDetail(report.getReasonDetail())
                .status(report.getStatus().name())
                .createdAt(report.getCreatedAt())
                .targetContent(targetContent)
                .build();
    }
}
