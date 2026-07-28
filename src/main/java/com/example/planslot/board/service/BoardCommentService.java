package com.example.planslot.board.service;

import com.example.planslot.board.dto.BoardCommentDTO;
import com.example.planslot.boardreport.dto.BoardReportRequestDTO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface BoardCommentService {
    // 댓글 및 대댓글 등록
    Long createComment(Long boardId, BoardCommentDTO commentDTO, String memberEmail);

    // 게시글 부모 댓글 페이징 조회 및 대댓글 함께 조회
    Page<BoardCommentDTO> getCommentList(Long boardId, Pageable pageable);

    // 댓글 및 대댓글 수정
    BoardCommentDTO updateComment(Long commentId, BoardCommentDTO commentDTO, String memberEmail);

    // 댓글 및 대댓글 삭제
    void deleteComment(Long commentId, String memberEmail);

    // 댓글 및 대댓글 신고 여부 확인
    boolean hasReportedComment(Long commentId, String reporterEmail);

    // 댓글 및 대댓글 신고
    Long reportComment(Long commentId, BoardReportRequestDTO reportRequestDTO, String reporterEmail);
}
