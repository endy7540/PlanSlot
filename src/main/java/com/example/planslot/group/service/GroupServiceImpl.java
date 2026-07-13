package com.example.planslot.group.service;

import com.example.planslot.group.dto.GroupDTO;
import com.example.planslot.group.entity.Group;
import com.example.planslot.group.entity.GroupMember;
import com.example.planslot.group.entity.GroupMemberStatus;
import com.example.planslot.group.entity.GroupSchedule;
import com.example.planslot.group.repository.GroupMemberRepository;
import com.example.planslot.group.repository.GroupRepository;
import com.example.planslot.group.repository.GroupScheduleRepository;
import com.example.planslot.member.entity.Member;
import com.example.planslot.member.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.ArrayList;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GroupServiceImpl implements GroupService {

    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final MemberRepository memberRepository;
    private final GroupScheduleRepository groupScheduleRepository;

    @Override
    @Transactional
    public GroupDTO.Response createGroup(Long memberId, GroupDTO.CreateRequest request) {
        Member owner = memberRepository.findById(memberId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 회원입니다."));

        Group group = Group.builder()
                .groupName(request.groupName())
                .owner(owner)
                .build();
        groupRepository.save(group);

        GroupMember ownerMembership = GroupMember.createOwner(group, owner);
        groupMemberRepository.save(ownerMembership);

        return GroupDTO.Response.from(group);
    }

    @Override
    public List<GroupDTO.ListResponse> getMyGroups(Long memberId) {
        List<GroupMemberStatus> validStatuses = Arrays.asList(
                GroupMemberStatus.ACTIVE,
                GroupMemberStatus.WAITING
        );
        List<GroupMember> groupMembers = groupMemberRepository.findByMember_IdAndMemberStatusIn(memberId, validStatuses);

        return groupMembers.stream()
                .map(gm -> {
                    int activeCount = groupMemberRepository.countByGroup_IdAndMemberStatus(
                            gm.getGroup().getId(), 
                            GroupMemberStatus.ACTIVE
                    );
                    return GroupDTO.ListResponse.of(gm, activeCount);
                })
                .collect(Collectors.toList());
    }

    @Override
    public GroupDTO.DetailResponse getGroupDetail(Long groupId, Long memberId) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 모임입니다."));

        List<GroupMember> allMembers = groupMemberRepository.findByGroup_Id(groupId);

        GroupMember myMembership = allMembers.stream()
                .filter(m -> m.getMember().getId().equals(memberId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("이 모임에 접근할 권한이 없습니다."));

        String filter = myMembership.getMemberStatus().name().equals("WAITING") ? "waiting" : "joined";
        String ownerIdStr = group.getOwner().getId().toString();

        List<GroupDTO.MemberInfo> members = new ArrayList<>();
        List<GroupDTO.WaitingInfo> waiting = new ArrayList<>();

        for (GroupMember gm : allMembers) {
            String mId = gm.getMember().getId().toString();
            String mName = gm.getMember().getNickname();
            if (gm.getMemberStatus().name().equals("WAITING")) {
                boolean isMe = mId.equals(memberId.toString());
                waiting.add(new GroupDTO.WaitingInfo(mId, gm.getMember().getEmail(), group.getOwner().getNickname(), isMe));
            } else if (gm.getMemberStatus().name().equals("ACTIVE")) {
                String role = ownerIdStr.equals(mId) ? "owner" : "member";
                members.add(new GroupDTO.MemberInfo(mId, mName, role));
            }
        }

        List<GroupSchedule> myGroupSchedules = groupScheduleRepository.findByGroup_IdAndSharer_Id(groupId, memberId);
        
        List<GroupDTO.ScheduleInfo> mySchedules = myGroupSchedules.stream().map(gs -> {
            java.time.LocalDateTime start = gs.getSchedule().getStartDate();
            String dateStr = start != null ? start.toLocalDate().toString() : "";
            String timeStr = start != null ? start.toLocalTime().toString() : "";
            String visibility = gs.isVisible() ? "public" : "private";
            return new GroupDTO.ScheduleInfo(
                    gs.getId().toString(),
                    gs.getSchedule().getTitle(),
                    dateStr,
                    timeStr,
                    visibility
            );
        }).collect(Collectors.toList());

        return new GroupDTO.DetailResponse(
                group.getId().toString(),
                group.getGroupName(),
                ownerIdStr,
                filter,
                members,
                waiting,
                mySchedules,
                new ArrayList<>(),
                new ArrayList<>()
        );
    }

    @Override
    @Transactional
    public void updateGroupName(Long groupId, String newName, Long memberId) {
        Group group = groupRepository.findById(groupId).orElseThrow(() -> new IllegalArgumentException("모임을 찾을 수 없습니다."));
        if (!group.getOwner().getId().equals(memberId)) throw new IllegalArgumentException("권한이 없습니다.");
        group.updateGroupName(newName);
    }

    @Override
    @Transactional
    public void deleteGroup(Long groupId, Long memberId) {
        Group group = groupRepository.findById(groupId).orElseThrow(() -> new IllegalArgumentException("모임을 찾을 수 없습니다."));
        if (!group.getOwner().getId().equals(memberId)) throw new IllegalArgumentException("권한이 없습니다.");

        // 외래키 참조 무결성을 위해 관련된 자식 레코드들을 먼저 삭제합니다.
        groupScheduleRepository.deleteByGroup_Id(groupId);
        groupMemberRepository.deleteByGroup_Id(groupId);

        groupRepository.delete(group);
    }

    @Override
    @Transactional
    public void leaveGroup(Long groupId, Long memberId) {
        Group group = groupRepository.findById(groupId).orElseThrow(() -> new IllegalArgumentException("모임을 찾을 수 없습니다."));
        if (group.getOwner().getId().equals(memberId)) throw new IllegalArgumentException("방장은 탈퇴할 수 없습니다.");
        GroupMember membership = groupMemberRepository.findByGroup_IdAndMember_Id(groupId, memberId).orElseThrow(() -> new IllegalArgumentException("참여 중이 아닙니다."));
        groupMemberRepository.delete(membership);
    }

    @Override
    @Transactional
    public void kickMember(Long groupId, Long targetMemberId, Long memberId) {
        Group group = groupRepository.findById(groupId).orElseThrow(() -> new IllegalArgumentException("모임을 찾을 수 없습니다."));
        if (!group.getOwner().getId().equals(memberId)) throw new IllegalArgumentException("권한이 없습니다.");
        GroupMember target = groupMemberRepository.findByGroup_IdAndMember_Id(groupId, targetMemberId).orElseThrow(() -> new IllegalArgumentException("대상을 찾을 수 없습니다."));
        groupMemberRepository.delete(target);
    }

    @Override
    @Transactional
    public void inviteMember(Long groupId, String email, Long memberId) {
        Group group = groupRepository.findById(groupId).orElseThrow(() -> new IllegalArgumentException("모임을 찾을 수 없습니다."));
        if (!group.getOwner().getId().equals(memberId)) throw new IllegalArgumentException("권한이 없습니다.");
        Member targetMember = memberRepository.findByEmail(email).orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다."));
        if (groupMemberRepository.existsByGroup_IdAndMember_Id(groupId, targetMember.getId())) {
            throw new IllegalArgumentException("이미 초대되었거나 참여 중인 사용자입니다.");
        }
        GroupMember membership = GroupMember.builder()
                .group(group)
                .member(targetMember)
                .memberStatus(GroupMemberStatus.WAITING)
                .build();
        groupMemberRepository.save(membership);
    }

    @Override
    @Transactional
    public void acceptInvite(Long groupId, Long memberId) {
        GroupMember membership = groupMemberRepository.findByGroup_IdAndMember_Id(groupId, memberId).orElseThrow(() -> new IllegalArgumentException("초대 내역이 없습니다."));
        if (membership.getMemberStatus() != GroupMemberStatus.WAITING) throw new IllegalArgumentException("대기 중인 초대가 아닙니다.");
        membership.changeStatus(GroupMemberStatus.ACTIVE);
    }

    @Override
    @Transactional
    public void rejectInvite(Long groupId, Long memberId) {
        GroupMember membership = groupMemberRepository.findByGroup_IdAndMember_Id(groupId, memberId).orElseThrow(() -> new IllegalArgumentException("초대 내역이 없습니다."));
        if (membership.getMemberStatus() != GroupMemberStatus.WAITING) throw new IllegalArgumentException("대기 중인 초대가 아닙니다.");
        groupMemberRepository.delete(membership);
    }
}
