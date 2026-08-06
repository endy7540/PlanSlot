package com.example.planslot.schedule.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.example.planslot.schedule.entity.AiImage;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public class AiImageDTO {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ExtractedSchedule {
        private String title;
        private String description;
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
        private LocalDateTime startDate;
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
        private LocalDateTime endDate;
        private String location;
    }

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Response {
        private Long id;
        private Long memberId;
        private String imageUrl;
        private String promptType;
        private String promptText;
        private String status;
        private String extractedTitle;

        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
        private LocalDateTime extractedStartDate;

        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
        private LocalDateTime extractedEndDate;

        private String extractedLocation;
        private BigDecimal confidenceScore;
        private String failReason;
        private Long scheduleId;

        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
        private LocalDateTime createdAt;

        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
        private LocalDateTime analyzedAt;

        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
        private LocalDateTime confirmedAt;

        // 이미지 분석을 통해 추출된 여러 개의 일정 리스트
        private List<ExtractedSchedule> extractedSchedules;

        public static Response from(AiImage entity, List<ExtractedSchedule> list) {
            return Response.builder()
                    .id(entity.getId())
                    .memberId(entity.getMember() != null ? entity.getMember().getId() : null)
                    .imageUrl(entity.getImageUrl())
                    .promptType(entity.getPromptType())
                    .promptText(entity.getPromptText())
                    .status(entity.getStatus())
                    .extractedTitle(entity.getExtractedTitle())
                    .extractedStartDate(entity.getExtractedStartDate())
                    .extractedEndDate(entity.getExtractedEndDate())
                    .extractedLocation(entity.getExtractedLocation())
                    .confidenceScore(entity.getConfidenceScore())
                    .failReason(entity.getFailReason())
                    .scheduleId(entity.getSchedule() != null ? entity.getSchedule().getScheduleId() : null)
                    .createdAt(entity.getCreatedAt())
                    .analyzedAt(entity.getAnalyzedAt())
                    .confirmedAt(entity.getConfirmedAt())
                    .extractedSchedules(list)
                    .build();
        }
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UploadRequest {
        private String promptType;
        private String promptText;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UpdateRequest {
        private String promptType;
        private String promptText;
        private String extractedTitle;

        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
        private LocalDateTime extractedStartDate;

        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
        private LocalDateTime extractedEndDate;

        private String extractedLocation;
        private BigDecimal confidenceScore;
        private List<ExtractedSchedule> extractedSchedules;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ConfirmRequest {
        private String title;
        private String description;
        private String scheduleType; // DAILY, WEEKLY 등

        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
        private LocalDateTime startDate;

        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
        private LocalDateTime endDate;

        private String location;
        private Boolean isPublic;
    }
}
