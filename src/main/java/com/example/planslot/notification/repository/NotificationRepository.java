package com.example.planslot.notification.repository;

import com.example.planslot.notification.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findAllByReceiver_IdOrderByCreatedAtDesc(Long receiverId);

    Optional<Notification> findByIdAndReceiver_Id(Long notificationId, Long receiverId);

    // 읽지 않은 알림 목록 조회 (벨 아이콘·드롭다운용)
    List<Notification> findAllByReceiver_IdAndIsReadFalseOrderByCreatedAtDesc(Long receiverId);

    List<Notification> findAllByReceiver_IdAndIsReadFalse(Long receiverId);

    long countByReceiver_IdAndIsReadFalse(Long receiverId);
}
