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
import lombok.RequiredArgsConstructor;
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

    // 댓글 및 대댓글 등록
    @Override
    @Transactional
    public Long createComment(Long boardId, BoardCommentDTO commentDTO, String memberEmail) {
        Board board = findBoard(boardId);
        Member writer = findMember(memberEmail);

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

        return boardCommentRepository.save(comment).getCommentId();
    }

    // 게시글 댓글 목록 조회
    @Override
    public List<BoardCommentDTO> getCommentList(Long boardId) {
        findBoard(boardId);

        List<BoardComment> rootComments = boardCommentRepository.findRootComments(boardId);

        if (rootComments.isEmpty()) {
            return List.of();
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

        List<BoardCommentDTO> result = new ArrayList<>();

        for (BoardComment rootComment : rootComments) {
            List<BoardCommentDTO> commentReplies = repliesByParentId.getOrDefault(
                    rootComment.getCommentId(), List.of()
            );

            if (rootComment.getCommentStatus() == BoardCommentStatus.DELETED) {
                if (commentReplies.isEmpty()) {
                    continue;
                }

                result.add(toDeletedRootDTO(rootComment, commentReplies));
                continue;
            }

            result.add(toDTO(rootComment, commentReplies));
        }

        return result;
    }

    // 댓글 및 대댓글 수정
    @Override
    @Transactional
    public BoardCommentDTO updateComment(Long commentId, BoardCommentDTO commentDTO, String memberEmail) {
        BoardComment comment = findActiveComment(commentId);
        Member member = findMember(memberEmail);

        validateWriter(comment, member);
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
                .reasonDetail(reportRequestDTO.getReasonDetail().trim())
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

        String reasonDetail = reportRequestDTO.getReasonDetail();

        if (reasonDetail == null || reasonDetail.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "신고 세부내용을 입력해 주세요.");
        }

        if (reasonDetail.trim().length() > 500) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "신고 세부내용은 500자 이하로 입력해 주세요.");
        }
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
                .writerNickname(comment.getWriter().getNickname())
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
                .content(DELETED_COMMENT_MESSAGE)
                .commentStatus(BoardCommentStatus.DELETED)
                .replies(replies)
                .createdAt(comment.getCreatedAt())
                .updatedAt(comment.getUpdatedAt())
                .build();
    }
}