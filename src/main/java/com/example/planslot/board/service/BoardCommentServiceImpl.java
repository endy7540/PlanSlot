package com.example.planslot.board.service;

import com.example.planslot.board.dto.BoardCommentDTO;
import com.example.planslot.board.entity.Board;
import com.example.planslot.board.entity.BoardComment;
import com.example.planslot.board.entity.BoardCommentStatus;
import com.example.planslot.board.entity.BoardStatus;
import com.example.planslot.board.repository.BoardCommentRepository;
import com.example.planslot.board.repository.BoardRepository;
import com.example.planslot.boardreport.dto.BoardReportRequestDTO;
import com.example.planslot.boardreport.entity.BoardReport;
import com.example.planslot.boardreport.entity.BoardReportTargetType;
import com.example.planslot.boardreport.repository.BoardReportRepository;
import com.example.planslot.member.entity.Member;
import com.example.planslot.member.repository.MemberRepository;
import com.example.planslot.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BoardCommentServiceImpl implements BoardCommentService {
    private static final String DELETED_COMMENT_MESSAGE = "삭제된 댓글입니다.";

    private final BoardCommentRepository boardCommentRepository;
    private final BoardRepository boardRepository;
    private final MemberRepository memberRepository;
    private final BoardReportRepository boardReportRepository;
    private final NotificationService notificationService;

    // 댓글 및 대댓글 등록
    @Override
    @Transactional
    public Long createComment(Long boardId, BoardCommentDTO commentDTO, String memberEmail) {
        Board board = findBoard(boardId);
        Member writer = findMember(memberEmail);
        validateCommunityAccess(writer);

        validateCommentDTO(commentDTO);

        BoardComment parentComment = null;

        if (commentDTO.getParentCommentId() != null) {
            parentComment = findActiveComment(commentDTO.getParentCommentId());
            validateParentComment(parentComment, boardId);
        }

        BoardComment comment = BoardComment.builder()
                .board(board)
                .parentComment(parentComment)
                .writer(writer)
                .content(commentDTO.getContent().trim())
                .build();

        Long commentId = boardCommentRepository.save(comment).getCommentId();
        sendCommentNotifications(board, parentComment, writer, boardId);

        return commentId;
    }

    // 게시글 작성자와 부모 댓글 작성자에게 중복 없이 알림 전송
    private void sendCommentNotifications(Board board, BoardComment parentComment, Member writer, Long boardId) {
        Long boardWriterId = board.getWriter().getId();
        Long writerId = writer.getId();

        if (parentComment != null) {
            Long parentWriterId = parentComment.getWriter().getId();

            if (!Objects.equals(parentWriterId, writerId)) {
                notificationService.sendBoardMessage(
                        parentWriterId,
                        "새로운 대댓글",
                        writer.getDisplayName() + "님이 회원님의 댓글에 대댓글을 작성했습니다.",
                        "BOARD",
                        boardId
                );
            }

            if (!Objects.equals(boardWriterId, writerId) && !Objects.equals(boardWriterId, parentWriterId)) {
                sendBoardWriterCommentNotification(board, writer, boardId);
            }
            return;
        }

        if (!Objects.equals(boardWriterId, writerId)) {
            sendBoardWriterCommentNotification(board, writer, boardId);
        }
    }

    // 게시글 작성자에게 댓글 작성 알림 전송
    private void sendBoardWriterCommentNotification(Board board, Member writer, Long boardId) {
        notificationService.sendBoardMessage(
                board.getWriter().getId(),
                "새로운 댓글",
                writer.getDisplayName() + "님이 '" + board.getTitle() + "' 게시글에 댓글을 작성했습니다.",
                "BOARD",
                boardId
        );
    }

    // 게시글 부모 댓글 페이징 조회 및 대댓글 함께 조회
    @Override
    public Page<BoardCommentDTO> getCommentList(Long boardId, Pageable pageable) {
        findBoard(boardId);

        Page<BoardComment> rootCommentPage = boardCommentRepository.findVisibleRootComments(
                boardId, BoardCommentStatus.ACTIVE, pageable
        );
        List<BoardComment> rootComments = rootCommentPage.getContent();

        if (rootComments.isEmpty()) {
            return new PageImpl<>(List.of(), pageable, rootCommentPage.getTotalElements());
        }

        List<Long> rootCommentIds = rootComments.stream()
                .map(BoardComment::getCommentId)
                .toList();

        List<BoardComment> replies = boardCommentRepository.findActiveReplies(
                rootCommentIds, BoardCommentStatus.ACTIVE
        );

        Map<Long, List<BoardCommentDTO>> repliesByParentId = new LinkedHashMap<>();

        for (BoardComment reply : replies) {
            Long parentCommentId = reply.getParentComment().getCommentId();

            repliesByParentId.computeIfAbsent(parentCommentId, key -> new ArrayList<>())
                    .add(toDTO(reply, List.of()));
        }

        List<BoardCommentDTO> comments = rootComments.stream()
                .map(rootComment -> {
                    List<BoardCommentDTO> commentReplies = repliesByParentId.getOrDefault(
                            rootComment.getCommentId(), List.of()
                    );

                    return rootComment.getCommentStatus() == BoardCommentStatus.DELETED
                            ? toDeletedRootDTO(rootComment, commentReplies)
                            : toDTO(rootComment, commentReplies);
                })
                .toList();

        return new PageImpl<>(comments, pageable, rootCommentPage.getTotalElements());
    }

    // 댓글 및 대댓글 수정
    @Override
    @Transactional
    public BoardCommentDTO updateComment(Long commentId, BoardCommentDTO commentDTO, String memberEmail) {
        BoardComment comment = findActiveComment(commentId);
        Member member = findMember(memberEmail);

        validateWriter(comment, member);
        validateCommunityAccess(member);
        validateCommentDTO(commentDTO);

        comment.update(commentDTO.getContent().trim());

        return toDTO(comment, List.of());
    }

    // 댓글 및 대댓글 삭제
    @Override
    @Transactional
    public void deleteComment(Long commentId, String memberEmail) {
        BoardComment comment = findActiveComment(commentId);
        Member member = findMember(memberEmail);

        validateWriter(comment, member);

        comment.delete();
    }

    // 댓글 및 대댓글 신고
    @Override
    @Transactional
    public Long reportComment(Long commentId, BoardReportRequestDTO reportRequestDTO, String reporterEmail) {
        BoardComment comment = findActiveComment(commentId);
        Member reporter = findMember(reporterEmail);

        validateCommunityAccess(reporter);

        if (Objects.equals(comment.getWriter().getId(), reporter.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "본인이 작성한 댓글은 신고할 수 없습니다.");
        }

        validateBoardReportRequest(reportRequestDTO);

        boolean duplicated = boardReportRepository.existsByReporter_IdAndTargetTypeAndTargetId(
                reporter.getId(), BoardReportTargetType.COMMENT, commentId
        );

        if (duplicated) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 신고한 댓글입니다.");
        }

        BoardReport boardReport = BoardReport.builder()
                .reporter(reporter)
                .targetType(BoardReportTargetType.COMMENT)
                .targetId(commentId)
                .reasonCode(reportRequestDTO.getReasonCode())
                .reasonDetail(normalizeReportDetail(reportRequestDTO.getReasonDetail()))
                .build();

        return boardReportRepository.save(boardReport).getReportId();
    }

    // 활성 게시글 조회
    private Board findBoard(Long boardId) {
        if (boardId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "게시글 ID가 필요합니다.");
        }

        return boardRepository.findByBoardIdAndBoardStatus(boardId, BoardStatus.ACTIVE)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다."
                ));
    }

    // 로그인 회원 조회
    private Member findMember(String memberEmail) {
        if (memberEmail == null || memberEmail.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
        }

        return memberRepository.findByEmail(memberEmail)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED, "로그인 회원을 찾을 수 없습니다."
                ));
    }

    // 커뮤니티 기능(작성 등) 이용 가능 여부 확인
    private void validateCommunityAccess(Member member) {
        if (member.getStatus() == Member.Status.BANNED) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "영구 정지된 회원은 커뮤니티 기능을 이용할 수 없습니다.");
        }
        if (member.getStatus() == Member.Status.SUSPENDED) {
            if (member.getSuspendedUntil() != null && java.time.LocalDateTime.now().isBefore(member.getSuspendedUntil())) {
                java.time.format.DateTimeFormatter formatter = java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "일시 정지 상태입니다. 정지 해제일: " + member.getSuspendedUntil().format(formatter));
            } else {
                member.updateStatus(Member.Status.ACTIVE, null);
                memberRepository.save(member);
            }
        }
    }

    // 활성 댓글 조회
    private BoardComment findActiveComment(Long commentId) {
        if (commentId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "댓글 ID가 필요합니다.");
        }

        BoardComment comment = boardCommentRepository.findByCommentIdAndCommentStatus(
                        commentId, BoardCommentStatus.ACTIVE
                )
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "댓글을 찾을 수 없습니다."
                ));

        if (comment.getBoard().getBoardStatus() != BoardStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다.");
        }

        return comment;
    }

    // 대댓글의 부모 댓글 확인
    private void validateParentComment(BoardComment parentComment, Long boardId) {
        if (!Objects.equals(parentComment.getBoard().getBoardId(), boardId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "해당 게시글의 댓글이 아닙니다.");
        }

        if (parentComment.getParentComment() != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "대댓글에는 다시 대댓글을 작성할 수 없습니다.");
        }
    }

    // 댓글 작성자 확인
    private void validateWriter(BoardComment comment, Member member) {
        if (!Objects.equals(comment.getWriter().getId(), member.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "댓글 작성자만 수정하거나 삭제할 수 있습니다.");
        }
    }

    // 댓글 입력값 확인
    private void validateCommentDTO(BoardCommentDTO commentDTO) {
        if (commentDTO == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "댓글 정보를 입력해 주세요.");
        }

        if (commentDTO.getContent() == null || commentDTO.getContent().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "댓글 내용을 입력해 주세요.");
        }

        if (commentDTO.getContent().trim().length() > 1000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "댓글은 1000자 이하로 입력해 주세요.");
        }
    }

    // 댓글 신고 입력값 확인
    private void validateBoardReportRequest(BoardReportRequestDTO reportRequestDTO) {
        if (reportRequestDTO == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "신고 정보를 입력해 주세요.");
        }

        if (reportRequestDTO.getReasonCode() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "신고 사유를 선택해 주세요.");
        }

        String reasonDetail = normalizeReportDetail(reportRequestDTO.getReasonDetail());
        if (reasonDetail == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "신고 세부내용을 입력해 주세요.");
        }
        if (reasonDetail.length() > 200) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "신고 세부내용은 200자 이하로 입력해 주세요.");
        }
    }

    // 신고 세부내용 정리
    private String normalizeReportDetail(String reasonDetail) {
        return reasonDetail == null || reasonDetail.isBlank() ? null : reasonDetail.trim();
    }

    // 활성 댓글 DTO 변환
    private BoardCommentDTO toDTO(BoardComment comment, List<BoardCommentDTO> replies) {
        Long parentCommentId = comment.getParentComment() == null
                ? null
                : comment.getParentComment().getCommentId();

        return BoardCommentDTO.builder()
                .commentId(comment.getCommentId())
                .boardId(comment.getBoard().getBoardId())
                .parentCommentId(parentCommentId)
                .writerId(comment.getWriter().getId())
                .writerNickname(comment.getWriter().getDisplayName())
                .writerProfileImageUrl(comment.getWriter().getProfileImageUrl())
                .content(comment.getContent())
                .commentStatus(comment.getCommentStatus())
                .replies(replies)
                .createdAt(comment.getCreatedAt())
                .updatedAt(comment.getUpdatedAt())
                .build();
    }

    // 삭제된 부모 댓글 DTO 변환
    private BoardCommentDTO toDeletedRootDTO(BoardComment comment, List<BoardCommentDTO> replies) {
        return BoardCommentDTO.builder()
                .commentId(comment.getCommentId())
                .boardId(comment.getBoard().getBoardId())
                .parentCommentId(null)
                .writerId(null)
                .writerNickname(null)
                .writerProfileImageUrl(null)
                .content(DELETED_COMMENT_MESSAGE)
                .commentStatus(BoardCommentStatus.DELETED)
                .replies(replies)
                .createdAt(comment.getCreatedAt())
                .updatedAt(comment.getUpdatedAt())
                .build();
    }
}
