package com.example.planslot.group.service;

import com.example.planslot.group.dto.GroupDTO;
import com.example.planslot.schedule.dto.ScheduleDTO;

import java.time.LocalDateTime;
import java.util.List;

public interface GroupService {

    // 모임 생성
    GroupDTO.Response createGroup(Long memberId, GroupDTO.CreateRequest request);

    // 내 모임 목록 조회
    List<GroupDTO.ListResponse> getMyGroups(Long memberId);

    // 모임 상세 조회
    GroupDTO.DetailResponse getGroupDetail(Long groupId, Long memberId);

    // 모임 이름 수정
    void updateGroupName(Long groupId, String newName, Long memberId);

    // 모임 삭제
    void deleteGroup(Long groupId, Long memberId);

    // 모임 탈퇴
    void leaveGroup(Long groupId, Long memberId, Long newOwnerId);

    // 모임원 추방
    void kickMember(Long groupId, Long targetMemberId, Long memberId);

    // 모임 초대
    void inviteMember(Long groupId, String email, Long memberId);

    // 초대 수락
    void acceptInvite(Long groupId, Long memberId);

    // 초대 거절
    void rejectInvite(Long groupId, Long memberId);

    // 모임 캘린더용 일정 조회
    List<GroupDTO.CalendarScheduleInfo> getGroupSchedules(Long groupId, Long memberId, LocalDateTime start, LocalDateTime end);

    // 모임 캘린더에 일정 추가
    void addGroupSchedule(Long groupId, Long memberId, String title, String dateStr, String timeStr, String visibility);
}
