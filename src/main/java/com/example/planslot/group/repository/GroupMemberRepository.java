package com.example.planslot.group.repository;

import com.example.planslot.group.entity.GroupMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

import java.util.List;
import com.example.planslot.group.entity.GroupMemberStatus;

public interface GroupMemberRepository extends JpaRepository<GroupMember, Long> {

    Optional<GroupMember> findByGroup_IdAndMember_Id(Long groupId, Long memberId);

    boolean existsByGroup_IdAndMember_Id(Long groupId, Long memberId);

    List<GroupMember> findByMember_IdAndMemberStatusIn(Long memberId, List<GroupMemberStatus> statuses);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"member"})
    List<GroupMember> findByGroup_Id(Long groupId);

    int countByGroup_IdAndMemberStatus(Long groupId, GroupMemberStatus status);

    void deleteByGroup_Id(Long groupId);
}
