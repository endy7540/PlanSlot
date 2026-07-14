package com.example.planslot.notification.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupNotificationSettingDTO {
    private Long groupId;
    private String groupName;
    private boolean enabled;
}
