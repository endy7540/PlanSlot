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
import com.example.planslot.schedule.repository.ScheduleRepository;
import com.example.planslot.schedule.dto.ScheduleDTO;
import com.example.planslot.schedule.entity.Schedule;
import com.example.planslot.schedule.entity.ScheduleType;
import com.example.planslot.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
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
    private final ScheduleRepository scheduleRepository;
    private final NotificationService notificationService;
    private final com.example.planslot.group.repository.GroupScheduleShareRepository groupScheduleShareRepository;
    private final com.example.planslot.schedule.entity.SourceType sourceType = null; // Unused dummy to prevent import issue

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
    public GroupDTO.DetailResponse getGroupRead(Long groupId, Long memberId) {
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
                memberId.toString(),
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
    public void leaveGroup(Long groupId, Long memberId, Long newOwnerId) {
        Group group = groupRepository.findById(groupId).orElseThrow(() -> new IllegalArgumentException("모임을 찾을 수 없습니다."));
        if (group.getOwner().getId().equals(memberId)) {
            if (newOwnerId == null) throw new IllegalArgumentException("방장을 위임할 사용자를 선택해야 합니다.");
            Member newOwner = memberRepository.findById(newOwnerId).orElseThrow(() -> new IllegalArgumentException("위임할 사용자를 찾을 수 없습니다."));
            group.changeOwner(newOwner);
        }
        GroupMember membership = groupMemberRepository.findByGroup_IdAndMember_Id(groupId, memberId).orElseThrow(() -> new IllegalArgumentException("참여 중이 아닙니다."));
        groupMemberRepository.delete(membership);
        group.decreasePersonCount();
    }

    @Override
    @Transactional
    public void kickMember(Long groupId, Long targetMemberId, Long memberId) {
        Group group = groupRepository.findById(groupId).orElseThrow(() -> new IllegalArgumentException("모임을 찾을 수 없습니다."));
        if (!group.getOwner().getId().equals(memberId)) throw new IllegalArgumentException("권한이 없습니다.");
        GroupMember target = groupMemberRepository.findByGroup_IdAndMember_Id(groupId, targetMemberId).orElseThrow(() -> new IllegalArgumentException("대상을 찾을 수 없습니다."));

        // 추방 알림 전송 (그룹 멤버에서 삭제되기 전에 전송해야 알림 설정 필터를 통과함)
        notificationService.sendGroupMessage(
                targetMemberId,
                groupId,
                "모임 추방 안내",
                group.getGroupName() + " 모임에서 추방되었습니다.",
                "group_kick",
                groupId
        );

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
        Member inviterMember = memberRepository.findById(memberId)
                .orElseThrow(() -> new IllegalArgumentException("초대자를 찾을 수 없습니다."));
        GroupMember membership = GroupMember.createInvited(group, targetMember, inviterMember);
        groupMemberRepository.save(membership);

        // 초대 알림 전송
        notificationService.sendGroupInvitation(
                targetMember.getId(),
                "새로운 모임 초대",
                group.getGroupName() + " 모임에 초대되었습니다.",
                "GROUP",
                groupId
        );
    }

    @Override
    @Transactional
    public void acceptInvite(Long groupId, Long memberId) {
        GroupMember membership = groupMemberRepository.findByGroup_IdAndMember_Id(groupId, memberId).orElseThrow(() -> new IllegalArgumentException("초대 내역이 없습니다."));
        if (membership.getMemberStatus() != GroupMemberStatus.WAITING) throw new IllegalArgumentException("대기 중인 초대가 아닙니다.");
        membership.changeStatus(GroupMemberStatus.ACTIVE);
    }

    @Override
    public List<GroupDTO.CalendarScheduleInfo> getGroupSchedules(Long groupId, Long memberId, LocalDateTime start, LocalDateTime end) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new IllegalArgumentException("모임을 찾을 수 없습니다."));

        List<GroupMember> groupMembers = groupMemberRepository.findByGroup_Id(groupId);

        // 현재 사용자가 모임원인지 확인
        boolean isMember = groupMembers.stream()
                .anyMatch(gm -> gm.getMember().getId().equals(memberId) &&
                        gm.getMemberStatus() == GroupMemberStatus.ACTIVE);
        
        if (!isMember) {
            throw new IllegalArgumentException("모임원이 아닙니다.");
        }

        List<GroupDTO.CalendarScheduleInfo> result = new ArrayList<>();
        for (GroupMember gm : groupMembers) {
            if (gm.getMemberStatus() == GroupMemberStatus.ACTIVE) {
                Long targetMemberId = gm.getMember().getId();
                String nickname = gm.getMember().getNickname();
                List<Schedule> schedules;
                if (start != null && end != null) {
                    schedules = scheduleRepository.findAllByMemberIdAndPeriodCandidate(targetMemberId, start, end);
                    for (Schedule s : schedules) {
                        if ("Y".equals(s.getIsPublic()) || targetMemberId.equals(memberId)) {
                            if (s.getScheduleType() == null || s.getScheduleType() == ScheduleType.DAILY) {
                                String dateStr = s.getStartDate() != null ? s.getStartDate().toLocalDate().toString() : "";
                                String timeStr = s.getStartDate() != null ? s.getStartDate().toLocalTime().toString() : "";
                                result.add(new GroupDTO.CalendarScheduleInfo(
                                        s.getScheduleId().toString(),
                                        nickname,
                                        s.getTitle(),
                                        dateStr,
                                        timeStr,
                                        s.getIsPublic()
                                ));
                            } else {
                                 LocalDateTime eventStart = s.getStartDate();
                                 LocalDateTime eventEnd = s.getEndDate();
                                 LocalDate searchStart = start.toLocalDate();
                                 LocalDate searchEnd = end.toLocalDate();
                                 LocalDate limitStart = eventStart.toLocalDate();
                                 LocalDate limitEnd = s.getRecurrenceEndDate();

                                 for (LocalDate date = searchStart; !date.isAfter(searchEnd); date = date.plusDays(1)) {
                                     if (date.isBefore(limitStart)) {
                                         continue;
                                     }
                                     if (limitEnd != null && date.isAfter(limitEnd)) {
                                         continue;
                                     }


                                    boolean matches = false;
                                    if (s.getScheduleType() == ScheduleType.WEEKLY) {
                                        matches = (date.getDayOfWeek() == limitStart.getDayOfWeek());
                                    } else if (s.getScheduleType() == ScheduleType.MONTHLY) {
                                        int targetDay = limitStart.getDayOfMonth();
                                        int maxDayInMonth = date.lengthOfMonth();
                                        int actualDay = Math.min(targetDay, maxDayInMonth);
                                        matches = (date.getDayOfMonth() == actualDay);
                                    } else if (s.getScheduleType() == ScheduleType.YEARLY) {
                                        int targetMonth = limitStart.getMonthValue();
                                        int targetDay = limitStart.getDayOfMonth();
                                        if (date.getMonthValue() == targetMonth) {
                                            if (targetMonth == 2 && targetDay == 29 && !date.isLeapYear()) {
                                                matches = (date.getDayOfMonth() == 28);
                                            } else {
                                                matches = (date.getDayOfMonth() == targetDay);
                                            }
                                        }
                                    }

                                    if (matches) {
                                        String dateStr = date.toString();
                                        String timeStr = eventStart.toLocalTime().toString();
                                        result.add(new GroupDTO.CalendarScheduleInfo(
                                                s.getScheduleId().toString(),
                                                nickname,
                                                s.getTitle(),
                                                dateStr,
                                                timeStr,
                                                s.getIsPublic()
                                        ));
                                    }
                                }
                            }
                        }
                    }
                } else {
                    schedules = scheduleRepository.findAllByMemberId(targetMemberId);
                    for (Schedule s : schedules) {
                        if ("Y".equals(s.getIsPublic()) || targetMemberId.equals(memberId)) {
                            String dateStr = s.getStartDate() != null ? s.getStartDate().toLocalDate().toString() : "";
                            String timeStr = s.getStartDate() != null ? s.getStartDate().toLocalTime().toString() : "";
                            result.add(new GroupDTO.CalendarScheduleInfo(
                                    s.getScheduleId().toString(),
                                    nickname,
                                    s.getTitle(),
                                    dateStr,
                                    timeStr,
                                    s.getIsPublic()
                            ));
                        }
                    }
                }
            }
        }
        return result;
    }

    @Override
    @Transactional
    public void rejectInvite(Long groupId, Long memberId) {
        GroupMember membership = groupMemberRepository.findByGroup_IdAndMember_Id(groupId, memberId).orElseThrow(() -> new IllegalArgumentException("초대 내역이 없습니다."));
        if (membership.getMemberStatus() != GroupMemberStatus.WAITING) throw new IllegalArgumentException("대기 중인 초대가 아닙니다.");
        groupMemberRepository.delete(membership);
    }

    @Override
    @Transactional
    public void addGroupSchedule(Long groupId, Long memberId, String title, String dateStr, String timeStr, String visibility) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new IllegalArgumentException("모임을 찾을 수 없습니다."));
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다."));

        boolean isMember = groupMemberRepository.findByGroup_Id(groupId).stream()
                .anyMatch(gm -> gm.getMember().getId().equals(memberId) &&
                        gm.getMemberStatus() == GroupMemberStatus.ACTIVE);
        if (!isMember) {
            throw new IllegalArgumentException("모임원이 아닙니다.");
        }

        LocalDateTime startDateTime = LocalDateTime.parse(dateStr + "T" + (timeStr.length() == 5 ? timeStr + ":00" : timeStr));
        boolean isPublic = "public".equals(visibility);

        Schedule schedule = Schedule.builder()
                .member(member)
                .title(title)
                .startDate(startDateTime)
                .scheduleType(ScheduleType.DAILY)
                .isPublic(isPublic ? "Y" : "N")
                .sourceType(com.example.planslot.schedule.entity.SourceType.MANUAL)
                .build();

        schedule = scheduleRepository.save(schedule);

        GroupSchedule groupSchedule = GroupSchedule.builder()
                .group(group)
                .sharer(member)
                .schedule(schedule)
                .isVisible(isPublic)
                .build();

        groupScheduleRepository.save(groupSchedule);
    }

    @Override
    @Transactional
    public void shareSchedulesWithPeers(Long groupId, Long sharerId, List<Long> scheduleIds, List<Long> targetMemberIds) {
        Group group = groupRepository.findById(groupId).orElseThrow();
        Member sharer = memberRepository.findById(sharerId).orElseThrow();

        for (Long scheduleId : scheduleIds) {
            Schedule schedule = scheduleRepository.findById(scheduleId).orElseThrow();
            for (Long targetMemberId : targetMemberIds) {
                if (groupScheduleShareRepository.existsByGroup_IdAndSchedule_ScheduleIdAndTargetMember_Id(groupId, scheduleId, targetMemberId)) {
                    continue;
                }
                Member target = memberRepository.findById(targetMemberId).orElseThrow();
                com.example.planslot.group.entity.GroupScheduleShare share = com.example.planslot.group.entity.GroupScheduleShare.builder()
                        .group(group)
                        .schedule(schedule)
                        .sharer(sharer)
                        .targetMember(target)
                        .sharedTitle(schedule.getTitle())
                        .build();
                groupScheduleShareRepository.save(share);
            }
        }
    }

    @Override
    public List<GroupDTO.SharedPeerSchedule> getSharedPeerSchedules(Long groupId, Long targetMemberId) {
        List<com.example.planslot.group.entity.GroupScheduleShare> shares = groupScheduleShareRepository.findByGroup_IdAndTargetMember_Id(groupId, targetMemberId);
        return shares.stream().map(share -> {
            Schedule schedule = share.getSchedule();
            String dateStr = schedule.getStartDate() != null ? schedule.getStartDate().toLocalDate().toString() : "";
            String timeStr = schedule.getStartDate() != null ? schedule.getStartDate().toLocalTime().toString() : "";
            return new GroupDTO.SharedPeerSchedule(
                    share.getId().toString(),
                    schedule.getScheduleId().toString(),
                    schedule.getTitle(),
                    dateStr,
                    timeStr,
                    share.getSharer().getNickname(),
                    schedule.getIsPublic(),
                    schedule.getScheduleType() != null ? schedule.getScheduleType().name() : "DAILY"
            );
        }).toList();
    }

    @Override
    public List<GroupDTO.SharedPeerSchedule> getSchedulesSharedByMe(Long groupId, Long sharerId) {
        List<com.example.planslot.group.entity.GroupScheduleShare> shares = groupScheduleShareRepository.findByGroup_IdAndSharer_Id(groupId, sharerId);
        return shares.stream().map(share -> {
            Schedule schedule = share.getSchedule();
            String dateStr = schedule.getStartDate() != null ? schedule.getStartDate().toLocalDate().toString() : "";
            String timeStr = schedule.getStartDate() != null ? schedule.getStartDate().toLocalTime().toString() : "";
            return new GroupDTO.SharedPeerSchedule(
                    share.getId().toString(),
                    schedule.getScheduleId().toString(),
                    schedule.getTitle(),
                    dateStr,
                    timeStr,
                    share.getTargetMember().getNickname(), // For this method, sharerName field is repurposed to hold the target member's name
                    schedule.getIsPublic(),
                    schedule.getScheduleType() != null ? schedule.getScheduleType().name() : "DAILY"
            );
        }).toList();
    }

    @Override
    @Transactional
    public void deleteSharedPeerSchedule(Long shareId, Long sharerId) {
        com.example.planslot.group.entity.GroupScheduleShare share = groupScheduleShareRepository.findById(shareId).orElseThrow(() -> new IllegalArgumentException("해당 공유 일정을 찾을 수 없습니다."));
        if (!share.getSharer().getId().equals(sharerId)) {
            throw new IllegalArgumentException("공유 일정을 취소할 권한이 없습니다.");
        }
        groupScheduleShareRepository.delete(share);
    }

    @Override
    @Transactional
    public GroupDTO.ImportResult importSharedPeerSchedule(Long shareId, Long memberId, boolean overwrite, String isPublic) {
        com.example.planslot.group.entity.GroupScheduleShare share = groupScheduleShareRepository.findById(shareId)
                .orElseThrow(() -> new IllegalArgumentException("해당 공유 일정을 찾을 수 없습니다."));

        if (!share.getTargetMember().getId().equals(memberId)) {
            throw new IllegalArgumentException("자신에게 공유된 일정만 가져올 수 있습니다.");
        }

        Schedule sharedSchedule = share.getSchedule();
        LocalDateTime sharedStart = sharedSchedule.getStartDate();
        
        List<Schedule> mySchedules = scheduleRepository.findAllByMemberId(memberId);
        
        if (!overwrite) {
            for (Schedule mySchedule : mySchedules) {
                if (mySchedule.getStartDate() != null && sharedStart != null && java.time.Duration.between(mySchedule.getStartDate(), sharedStart).abs().toMinutes() < 60) {
                    return new GroupDTO.ImportResult(false, mySchedule.getTitle(), mySchedule.getStartDate().toLocalTime().toString(), sharedStart.toLocalDate().toString());
                }
            }
        } else {
            for (Schedule mySchedule : mySchedules) {
                if (mySchedule.getStartDate() != null && sharedStart != null && java.time.Duration.between(mySchedule.getStartDate(), sharedStart).abs().toMinutes() < 60) {
                    mySchedule.softDelete();
                    scheduleRepository.save(mySchedule);
                }
            }
        }
        
        Schedule newSchedule = Schedule.builder()
                .member(share.getTargetMember())
                .title(sharedSchedule.getTitle())
                .description(sharedSchedule.getDescription())
                .scheduleType(sharedSchedule.getScheduleType())
                .startDate(sharedSchedule.getStartDate())
                .endDate(sharedSchedule.getEndDate())
                .isPublic(isPublic != null ? isPublic : "N")
                .sourceType(sharedSchedule.getSourceType())
                .location(sharedSchedule.getLocation())
                .recurrenceEndDate(sharedSchedule.getRecurrenceEndDate())
                .build();
        
        scheduleRepository.save(newSchedule);
        
        return new GroupDTO.ImportResult(true, null, null, sharedStart != null ? sharedStart.toLocalDate().toString() : "");
    }
}
