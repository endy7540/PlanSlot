package com.example.planslot.notification.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationSettingDTO {
    private boolean allEnabled;
    private boolean groupEnabled;
    private boolean scheduleEnabled;
    private boolean boardEnabled;
    private boolean applicationEnabled;
    private boolean reminderEnabled;
}
