package com.example.planslot.group.repository;

import com.example.planslot.group.entity.GroupScheduleShare;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GroupScheduleShareRepository extends JpaRepository<GroupScheduleShare, Long> {
    List<GroupScheduleShare> findByGroup_IdAndTargetMember_Id(Long groupId, Long targetMemberId);
    List<GroupScheduleShare> findByGroup_IdAndSharer_Id(Long groupId, Long sharerId);
    boolean existsByGroup_IdAndSchedule_ScheduleIdAndTargetMember_Id(Long groupId, Long scheduleId, Long targetMemberId);
}
