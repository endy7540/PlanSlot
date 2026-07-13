package com.example.planslot.group.service;

import com.example.planslot.group.dto.GroupDTO;
import com.example.planslot.group.entity.Group;
import com.example.planslot.group.entity.GroupMember;
import com.example.planslot.group.repository.GroupMemberRepository;
import com.example.planslot.group.repository.GroupRepository;
import com.example.planslot.member.entity.Member;
import com.example.planslot.member.repository.MemberRepository;
import com.example.planslot.global.exception.CustomException;
import com.example.planslot.global.response.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GroupServiceImpl implements GroupService {

    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final MemberRepository memberRepository;

    @Override
    @Transactional
    public GroupDTO.Response createGroup(Long memberId, GroupDTO.CreateRequest request) {
        Member owner = memberRepository.findById(memberId)
                .orElseThrow(() -> new CustomException(ErrorCode.UNAUTHORIZED));

        Group group = Group.builder()
                .groupName(request.groupName())
                .owner(owner)
                .build();
        groupRepository.save(group);

        GroupMember ownerMembership = GroupMember.createOwner(group, owner);
        groupMemberRepository.save(ownerMembership);

        return GroupDTO.Response.from(group);
    }
}
