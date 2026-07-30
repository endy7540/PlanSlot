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
    GroupDTO.DetailResponse getGroupRead(Long groupId, Long memberId);

    // 모임 이름 수정
    void updateGroupName(Long groupId, String newName, Long memberId);



    // 모임 프로필 이미지 수정
    void updateGroupProfileImage(Long groupId, String imageUrl, Long memberId);

    // 모임 삭제
    void deleteGroup(Long groupId, Long memberId);

    // 모임 탈퇴
    void leaveGroup(Long groupId, Long memberId, Long newOwnerId);

    // 모임원 추방
    void kickMember(Long groupId, Long targetMemberId, Long memberId);

    // 모임 초대
    void inviteMember(Long groupId, String email, Long memberId);
    void acceptInvite(Long groupId, Long memberId, String color);
    void rejectInvite(Long groupId, Long memberId);
    void toggleFavorite(Long groupId, Long memberId);

    // 모임 캘린더용 일정 조회
    List<GroupDTO.CalendarScheduleInfo> getGroupSchedules(Long groupId, Long memberId, LocalDateTime start, LocalDateTime end);

    // 모임 캘린더에 일정 추가
    void addGroupSchedule(Long groupId, Long memberId, ScheduleDTO requestDTO);

    // 타인에게 내 일정 공유하기
    void shareSchedulesWithPeers(Long groupId, Long sharerId, List<Long> scheduleIds, List<Long> targetMemberIds);

    // 나에게 공유된 타인의 일정 조회
    List<GroupDTO.SharedPeerSchedule> getSharedPeerSchedules(Long groupId, Long targetMemberId);

    // 내가 타인에게 공유한 일정 조회
    List<GroupDTO.SharedPeerSchedule> getSchedulesSharedByMe(Long groupId, Long sharerId);

    // 내가 공유한 일정 공유 중지(삭제)
    void deleteSharedPeerSchedule(Long shareId, Long sharerId);

    // 타인이 공유해준 일정 내 캘린더로 가져오기 (겹침 확인)
    GroupDTO.ImportResult importSharedPeerSchedule(Long shareId, Long memberId, boolean overwrite, String isPublic);
}
