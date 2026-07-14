package com.example.planslot.schedule.dto;

import com.example.planslot.schedule.entity.Deadline;
import com.example.planslot.schedule.entity.Schedule;
import com.example.planslot.schedule.entity.ScheduleType;
import com.example.planslot.schedule.entity.SourceType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.time.LocalDateTime;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class ScheduleDTO {

    private Long scheduleId;

    @NotBlank(message = "제목은 필수입니다.")
    @Size(max = 50, message = "제목은 50자를 넘을 수 없습니다.")
    private String title;

    @Size(max = 400, message = "설명은 400자를 넘을 수 없습니다.")
    private String description;

    @NotNull(message = "일정 유형은 필수입니다.")
    private ScheduleType scheduleType;

    @NotNull(message = "시작 일시는 필수입니다.")
    private LocalDateTime startDate;

    private LocalDateTime endDate;

    @Builder.Default
    private Boolean isPublic = false;

    @Builder.Default
    private Boolean googleSyncYn = false;

    private String googleEventId;

    private SourceType sourceType;

    @Size(max = 200, message = "장소는 200자를 넘을 수 없습니다.")
    private String location;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private java.time.LocalDate deadlineDate;
    private Integer notifyDaysBefore;

    // ===== 변환 메서드 =====

    public static ScheduleDTO from(Schedule schedule) {
        return ScheduleDTO.builder()
                .scheduleId(schedule.getScheduleId())
                .title(schedule.getTitle())
                .description(schedule.getDescription())
                .scheduleType(schedule.getScheduleType())
                .startDate(schedule.getStartDate())
                .endDate(schedule.getEndDate())
                .isPublic("Y".equals(schedule.getIsPublic()))
                .googleSyncYn("Y".equals(schedule.getGoogleSyncYn()))
                .googleEventId(schedule.getGoogleEventId())
                .sourceType(schedule.getSourceType())
                .location(schedule.getLocation())
                .createdAt(schedule.getCreatedAt())
                .updatedAt(schedule.getUpdatedAt())
                .build();
    }
    public static ScheduleDTO fromWithDeadline(Schedule schedule, Deadline deadline) {
        ScheduleDTO dto = from(schedule);
        if (deadline != null) {
            dto.deadlineDate = deadline.getDeadlineDate();
            dto.notifyDaysBefore = deadline.getNotifyDaysBefore();
        }
        return dto;
    }
}