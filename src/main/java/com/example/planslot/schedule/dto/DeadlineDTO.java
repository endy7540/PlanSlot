package com.example.planslot.schedule.dto;

import com.example.planslot.schedule.entity.Deadline;
import jakarta.validation.constraints.NotNull;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class DeadlineDTO {

    private Long deadlineId;

    @NotNull(message = "데드라인 날짜는 필수입니다.")
    private LocalDate deadlineDate;

    @NotNull(message = "알림 일수는 필수입니다.")
    private Integer notifyDaysBefore;

    public static DeadlineDTO from(Deadline deadline) {
        if (deadline == null) return null;
        return DeadlineDTO.builder()
                .deadlineId(deadline.getDeadlineId())
                .deadlineDate(deadline.getDeadlineDate())
                .notifyDaysBefore(deadline.getNotifyDaysBefore())
                .build();
    }
}