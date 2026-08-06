package com.example.planslot.groupchat.repository;

import com.example.planslot.groupchat.entity.GroupChatRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface GroupChatRoomRepository extends JpaRepository<GroupChatRoom, Long> {
    Optional<GroupChatRoom> findByGroup_Id(Long groupId);
    void deleteByGroup_Id(Long groupId);
}
