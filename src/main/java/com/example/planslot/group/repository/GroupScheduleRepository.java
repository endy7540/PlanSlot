package com.example.planslot.group.repository;

import com.example.planslot.group.entity.GroupSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

import org.springframework.data.jpa.repository.EntityGraph;

public interface GroupScheduleRepository extends JpaRepository<GroupSchedule, Long> {

    @EntityGraph(attributePaths = {"schedule"})
    List<GroupSchedule> findByGroup_IdAndSharer_Id(Long groupId, Long sharerId);
    void deleteByGroup_Id(Long groupId);
    void deleteByGroup_IdAndSharer_Id(Long groupId, Long sharerId);
}
