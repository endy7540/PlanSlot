package com.example.planslot.board.service;

import com.example.planslot.board.dto.BoardGroupDTO;
import com.example.planslot.board.entity.*;
import com.example.planslot.board.repository.BoardApplicationRepository;
import com.example.planslot.board.repository.BoardCommentRepository;
import com.example.planslot.board.repository.BoardRepository;
import com.example.planslot.group.entity.Group;
import com.example.planslot.group.entity.GroupMember;
import com.example.planslot.group.entity.GroupMemberStatus;
import com.example.planslot.group.repository.GroupMemberRepository;
import com.example.planslot.group.repository.GroupRepository;
import com.example.planslot.member.entity.Member;
import com.example.planslot.member.repository.MemberRepository;
import com.example.planslot.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BoardGroupServiceImpl implements BoardGroupService {

    private final BoardRepository boardRepository;
    private final BoardApplicationRepository boardApplicationRepository;
    private final BoardCommentRepository boardCommentRepository;
    private final MemberRepository memberRepository;
    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final NotificationService notificationService;

    @Override
    @Transactional
    public Long apply(Long boardId, String memberEmail) {
        Board board = findRecruitmentBoardForUpdate(boardId);
        Member applicant = findMember(memberEmail);

        validateRecruitmentOpen(board);

        if (Objects.equals(board.getWriter().getId(), applicant.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "본인이 작성한 게시글에는 신청할 수 없습니다.");
        }

        if (boardApplicationRepository.existsByBoard_BoardIdAndApplicant_Id(boardId, applicant.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 신청한 게시글입니다.");
        }

        BoardApplication application = BoardApplication.builder()
                .board(board)
                .applicant(applicant)
                .build();

        Long applicationId = boardApplicationRepository.save(application).getApplicationId();

        notificationService.sendApplicationNotification(
                board.getWriter().getId(),
                "새로운 모임 참가 신청",
                applicant.getNickname() + "님이 '" + board.getTitle() + "' 게시글에 참가 신청했습니다.",
                "BOARD",
                boardId
        );

        return applicationId;
    }

    @Override
    @Transactional
    public void cancelApplication(Long boardId, String memberEmail) {
        Board board = findRecruitmentBoardForUpdate(boardId);
        Member applicant = findMember(memberEmail);

        validateRecruitmentOpen(board);

        BoardApplication application = boardApplicationRepository
                .findByBoard_BoardIdAndApplicant_Id(boardId, applicant.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "신청 내역을 찾을 수 없습니다."));

        if (application.getApplicationStatus() != BoardApplicationStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "대기 중인 신청만 취소할 수 있습니다.");
        }

        boardApplicationRepository.delete(application);
    }

    @Override
    public BoardGroupDTO.CandidatesResponse getCandidates(Long boardId, String memberEmail) {
        Board board = findRecruitmentBoard(boardId);
        Member writer = findMember(memberEmail);

        validateWriter(board, writer);
        validateRecruitmentOpen(board);

        List<BoardApplication> applications = getPendingApplications(boardId);
        Set<Long> applicationMemberIds = boardApplicationRepository.findByBoard_BoardId(boardId).stream()
                .map(application -> application.getApplicant().getId())
                .collect(Collectors.toSet());

        List<BoardGroupDTO.Candidate> applicants = applications.stream()
                .map(application -> new BoardGroupDTO.Candidate(
                        application.getApplicant().getId(), application.getApplicant().getNickname()
                ))
                .toList();

        List<BoardGroupDTO.Candidate> inviteCandidates = getInviteCandidateMembers(board, applicationMemberIds).stream()
                .map(member -> new BoardGroupDTO.Candidate(member.getId(), member.getNickname()))
                .toList();

        return new BoardGroupDTO.CandidatesResponse(board.getTitle(), applicants, inviteCandidates);
    }

    @Override
    @Transactional
    public Long createGroup(Long boardId, BoardGroupDTO.CreateRequest request, String memberEmail) {
        Board board = boardRepository.findActiveBoardForUpdate(boardId, BoardStatus.ACTIVE)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다."));
        Member writer = findMember(memberEmail);

        validateRecruitmentBoard(board);
        validateWriter(board, writer);
        validateRecruitmentOpen(board);
        validateCreateRequest(request);

        if (board.getGroupId() != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 모임이 생성된 게시글입니다.");
        }

        List<BoardApplication> pendingApplications = getPendingApplications(boardId);
        Map<Long, BoardApplication> applicationMap = pendingApplications.stream().collect(Collectors.toMap(
                application -> application.getApplicant().getId(), Function.identity()
        ));
        Set<Long> applicationCandidateIds = applicationMap.keySet();

        Set<Long> allApplicationMemberIds = boardApplicationRepository.findByBoard_BoardId(boardId).stream()
                .map(application -> application.getApplicant().getId())
                .collect(Collectors.toSet());
        List<Member> inviteCandidateMembers = getInviteCandidateMembers(board, allApplicationMemberIds);
        Map<Long, Member> inviteCandidateMap = inviteCandidateMembers.stream()
                .collect(Collectors.toMap(Member::getId, Function.identity()));
        Set<Long> inviteCandidateIds = inviteCandidateMap.keySet();

        Set<Long> selectedApplicantIds = normalizeIds(request.selectedApplicantIds());
        Set<Long> selectedInviteeIds = normalizeIds(request.selectedInviteeIds());
        selectedInviteeIds.removeAll(selectedApplicantIds);

        if (!applicationCandidateIds.containsAll(selectedApplicantIds) || !inviteCandidateIds.containsAll(selectedInviteeIds)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "선택한 회원 정보가 유효하지 않거나 후보 목록이 변경되었습니다. 다시 확인해 주세요.");
        }

        if (selectedApplicantIds.isEmpty() && selectedInviteeIds.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "신청자 또는 초대 대상자를 한 명 이상 선택해 주세요.");
        }

        Group group = Group.builder()
                .groupName(request.groupName().trim())
                .owner(writer)
                .build();
        groupRepository.save(group);

        groupMemberRepository.save(GroupMember.createOwner(group, writer));

        for (BoardApplication application : pendingApplications) {
            Member applicant = application.getApplicant();

            if (selectedApplicantIds.contains(applicant.getId())) {
                application.accept();
                GroupMember activeMember = GroupMember.builder()
                        .group(group)
                        .member(applicant)
                        .inviter(writer)
                        .nickname(applicant.getNickname())
                        .memberStatus(GroupMemberStatus.ACTIVE)
                        .build();
                groupMemberRepository.save(activeMember);
                group.increasePersonCount();

                notificationService.sendApplicationNotification(
                        applicant.getId(),
                        "모임 참여 확정",
                        "'" + board.getTitle() + "' 게시글의 모임 참여가 확정되었습니다.",
                        "GROUP",
                        group.getId()
                );
            } else {
                application.reject();

                notificationService.sendApplicationNotification(
                        applicant.getId(),
                        "모임 참가 신청 결과",
                        "'" + board.getTitle() + "' 게시글의 참가 신청이 거절되었습니다.",
                        "BOARD",
                        boardId
                );
            }
        }

        for (Long inviteeId : selectedInviteeIds) {
            Member invitee = inviteCandidateMap.get(inviteeId);
            groupMemberRepository.save(GroupMember.createInvited(group, invitee, writer));

            notificationService.sendGroupInvitation(
                    invitee.getId(),
                    "새로운 모임 초대",
                    group.getGroupName() + " 모임에 초대되었습니다.",
                    "GROUP",
                    group.getId()
            );
        }

        int connectedCount = boardRepository.connectGroup(
                boardId, BoardStatus.ACTIVE, group.getId(), BoardRecruitmentStatus.CLOSED
        );

        if (connectedCount == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 모임이 생성되었거나 모집 상태가 변경되었습니다.");
        }

        return group.getId();
    }


    private Board findRecruitmentBoardForUpdate(Long boardId) {
        Board board = boardRepository.findActiveBoardForUpdate(boardId, BoardStatus.ACTIVE)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다."));
        validateRecruitmentBoard(board);
        return board;
    }

    private Board findRecruitmentBoard(Long boardId) {
        Board board = boardRepository.findByBoardIdAndBoardStatus(boardId, BoardStatus.ACTIVE)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다."));
        validateRecruitmentBoard(board);
        return board;
    }

    private Member findMember(String memberEmail) {
        if (memberEmail == null || memberEmail.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
        }

        return memberRepository.findByEmail(memberEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인 회원을 찾을 수 없습니다."));
    }

    private List<BoardApplication> getPendingApplications(Long boardId) {
        return boardApplicationRepository.findByBoard_BoardIdAndApplicationStatusOrderByCreatedAtAsc(
                boardId, BoardApplicationStatus.PENDING
        );
    }

    private List<Member> getInviteCandidateMembers(Board board, Set<Long> applicationMemberIds) {
        List<BoardComment> comments = new ArrayList<>(boardCommentRepository.findRootComments(board.getBoardId()));
        List<Long> rootCommentIds = comments.stream()
                .map(BoardComment::getCommentId)
                .toList();

        if (!rootCommentIds.isEmpty()) {
            comments.addAll(boardCommentRepository.findActiveReplies(rootCommentIds, BoardCommentStatus.ACTIVE));
        }

        return comments.stream()
                .filter(comment -> comment.getCommentStatus() == BoardCommentStatus.ACTIVE)
                .map(BoardComment::getWriter)
                .filter(member -> !Objects.equals(member.getId(), board.getWriter().getId()))
                .filter(member -> !applicationMemberIds.contains(member.getId()))
                .collect(Collectors.toMap(
                        Member::getId,
                        Function.identity(),
                        (first, duplicate) -> first,
                        LinkedHashMap::new
                ))
                .values()
                .stream()
                .sorted(Comparator.comparing(Member::getNickname, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    private Set<Long> normalizeIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return new LinkedHashSet<>();
        }

        return ids.stream()
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private void validateRecruitmentBoard(Board board) {
        if (board.getBoardType() != BoardType.STUDY && board.getBoardType() != BoardType.GROUP) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "스터디와 소모임 게시글에서만 이용할 수 있습니다.");
        }
    }

    private void validateRecruitmentOpen(Board board) {
        if (!board.isRecruitmentOpen()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 모집이 마감된 게시글입니다.");
        }
    }

    private void validateWriter(Board board, Member member) {
        if (!Objects.equals(board.getWriter().getId(), member.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "게시글 작성자만 모임을 만들 수 있습니다.");
        }
    }

    private void validateCreateRequest(BoardGroupDTO.CreateRequest request) {
        if (request == null || request.groupName() == null || request.groupName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "모임 이름을 입력해 주세요.");
        }

        if (request.groupName().trim().length() > 30) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "모임 이름은 30자 이하로 입력해 주세요.");
        }
    }
}
