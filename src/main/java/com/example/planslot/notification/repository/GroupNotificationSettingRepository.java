package com.example.planslot.notification.repository;

import com.example.planslot.notification.entity.GroupNotificationSetting;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GroupNotificationSettingRepository extends JpaRepository<GroupNotificationSetting, Long> {

    List<GroupNotificationSetting> findAllByMember_Id(Long memberId);

    Optional<GroupNotificationSetting> findByGroup_IdAndMember_Id(Long groupId, Long memberId);
}
