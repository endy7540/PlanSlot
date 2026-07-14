package com.example.planslot.notification.dto;

import com.example.planslot.notification.entity.NotificationType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationDTO {
    private Long notificationId;
    private NotificationType notificationType;
    private String title;
    private String content;
    private String targetType;
    private Long targetId;
    private boolean read;
    private LocalDateTime createdAt;
    private LocalDateTime readAt;
}
