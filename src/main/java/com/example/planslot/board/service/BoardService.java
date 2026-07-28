package com.example.planslot.board.service;

import com.example.planslot.board.dto.BoardDTO;
import com.example.planslot.board.dto.BoardImageDTO;
import com.example.planslot.board.dto.BoardMemberDTO;
import com.example.planslot.board.entity.BoardRecruitmentStatus;
import com.example.planslot.board.entity.BoardType;
import com.example.planslot.boardreport.dto.BoardReportRequestDTO;
import org.springframework.data.domain.Page;
import org.springframework.web.multipart.MultipartFile;

public interface BoardService {
    // 게시글 등록
    Long createBoard(BoardType boardType, BoardDTO boardDTO, String memberEmail);

    // 게시판 종류별 목록 및 검색
    Page<BoardDTO> getBoardList(BoardType boardType, String searchType, String keyword, String sort, boolean mine, int page, int size, String memberEmail);

    // 게시글 조회
    BoardDTO readBoard(Long boardId, String memberEmail, boolean increaseView);

    BoardDTO readBoard(Long boardId, String memberEmail);

    // 로그인 회원 조회
    BoardMemberDTO getLoginMember(String memberEmail);

    // 게시글 수정
    BoardDTO updateBoard(Long boardId, BoardDTO boardDTO, String memberEmail);

    // 게시글 삭제
    void deleteBoard(Long boardId, String memberEmail);

    // 모집 상태 수정
    BoardDTO updateRecruitmentStatus(Long boardId, BoardRecruitmentStatus recruitmentStatus, String memberEmail);

    // 게시글 신고 여부 확인
    boolean hasReportedBoard(Long boardId, String reporterEmail);

    // 게시글 신고
    Long reportBoard(Long boardId, BoardReportRequestDTO reportRequestDTO, String reporterEmail);

    // 게시글 이미지 등록 및 교체
    BoardImageDTO uploadBoardImage(Long boardId, MultipartFile image, String memberEmail);

    // 게시글 이미지 정보 및 실제 파일 삭제
    void deleteBoardImage(Long boardId, Long imageId, String memberEmail);
}