package com.example.planslot.group.repository;

import com.example.planslot.group.entity.GroupMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface GroupMemberRepository extends JpaRepository<GroupMember, Long> {

    Optional<GroupMember> findByGroup_IdAndMember_Id(Long groupId, Long memberId);

    boolean existsByGroup_IdAndMember_Id(Long groupId, Long memberId);
}
