package com.example.planslot.board.service;

import com.example.planslot.board.dto.BoardCommentDTO;
import com.example.planslot.boardreport.dto.BoardReportRequestDTO;

import java.util.List;

public interface BoardCommentService {
    // 댓글 및 대댓글 등록
    Long createComment(Long boardId, BoardCommentDTO commentDTO, String memberEmail);

    // 게시글 댓글 목록 조회
    List<BoardCommentDTO> getCommentList(Long boardId);

    // 댓글 및 대댓글 수정
    BoardCommentDTO updateComment(Long commentId, BoardCommentDTO commentDTO, String memberEmail);

    // 댓글 및 대댓글 삭제
    void deleteComment(Long commentId, String memberEmail);

    // 댓글 및 대댓글 신고
    Long reportComment(Long commentId, BoardReportRequestDTO reportRequestDTO, String reporterEmail);
}