package com.example.planslot.groupchat.service;

import com.example.planslot.groupchat.dto.ChatMessageDTO;
import com.example.planslot.groupchat.entity.ChatMessage;
import com.example.planslot.groupchat.entity.GroupChatRoom;
import com.example.planslot.groupchat.repository.ChatMessageRepository;
import com.example.planslot.groupchat.repository.GroupChatRoomRepository;
import com.example.planslot.member.entity.Member;
import com.example.planslot.member.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GroupChatServiceImpl implements GroupChatService {

    private final ChatMessageRepository chatMessageRepository;
    private final GroupChatRoomRepository groupChatRoomRepository;
    private final MemberRepository memberRepository;
    private final com.example.planslot.group.repository.GroupRepository groupRepository;

    @Override
    @Transactional
    public ChatMessageDTO saveMessage(ChatMessageDTO messageDTO) {
        GroupChatRoom chatRoom = groupChatRoomRepository.findByGroup_Id(messageDTO.getGroupId())
                .orElseGet(() -> {
                    com.example.planslot.group.entity.Group group = groupRepository.findById(messageDTO.getGroupId())
                            .orElseThrow(() -> new IllegalArgumentException("모임을 찾을 수 없습니다."));
                    GroupChatRoom newRoom = GroupChatRoom.builder().group(group).build();
                    return groupChatRoomRepository.save(newRoom);
                });

        Member sender = memberRepository.findById(messageDTO.getSenderId())
                .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다."));

        ChatMessage message = ChatMessage.builder()
                .groupChatRoom(chatRoom)
                .sender(sender)
                .content(messageDTO.getContent())
                .build();

        ChatMessage savedMessage = chatMessageRepository.save(message);
        
        return ChatMessageDTO.from(savedMessage);
    }

    @Override
    @Transactional
    public List<ChatMessageDTO> getChatHistory(Long groupId) {
        GroupChatRoom chatRoom = groupChatRoomRepository.findByGroup_Id(groupId)
                .orElseGet(() -> {
                    com.example.planslot.group.entity.Group group = groupRepository.findById(groupId)
                            .orElseThrow(() -> new IllegalArgumentException("모임을 찾을 수 없습니다."));
                    GroupChatRoom newRoom = GroupChatRoom.builder().group(group).build();
                    return groupChatRoomRepository.save(newRoom);
                });

        List<ChatMessage> messages = chatMessageRepository.findByGroupChatRoom_IdOrderByCreatedAtAsc(chatRoom.getId());
        
        return messages.stream()
                .map(ChatMessageDTO::from)
                .collect(Collectors.toList());
    }
}
