package com.example.planslot.groupchat.repository;

import com.example.planslot.groupchat.entity.GroupReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

@Repository
public interface GroupReportRepository extends JpaRepository<GroupReport, Long> {
    boolean existsByMember_IdAndChatMessage_Id(Long memberId, Long chatMessageId);

    @Query("SELECT r.chatMessage.id FROM GroupReport r WHERE r.group.id = :groupId AND r.member.id = :memberId")
    List<Long> findReportedMessageIds(@Param("groupId") Long groupId, @Param("memberId") Long memberId);
}
