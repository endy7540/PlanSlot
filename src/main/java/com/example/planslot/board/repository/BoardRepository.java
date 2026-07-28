package com.example.planslot.board.repository;

import jakarta.persistence.LockModeType;
import com.example.planslot.board.entity.Board;
import com.example.planslot.board.entity.BoardRecruitmentStatus;
import com.example.planslot.board.entity.BoardStatus;
import com.example.planslot.board.entity.BoardType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface BoardRepository extends JpaRepository<Board, Long> {

    @EntityGraph(attributePaths = {"writer"})
    Page<Board> findByBoardTypeAndBoardStatus(BoardType boardType, BoardStatus boardStatus, Pageable pageable);

    @EntityGraph(attributePaths = {"writer"})
    Page<Board> findByBoardTypeAndBoardStatusAndTitleContainingIgnoreCase(
            BoardType boardType, BoardStatus boardStatus, String keyword, Pageable pageable
    );

    @EntityGraph(attributePaths = {"writer"})
    Page<Board> findByBoardTypeAndBoardStatusAndContentContainingIgnoreCase(
            BoardType boardType, BoardStatus boardStatus, String keyword, Pageable pageable
    );

    @EntityGraph(attributePaths = {"writer"})
    Page<Board> findByBoardTypeAndBoardStatusAndWriter_NicknameContainingIgnoreCase(
            BoardType boardType, BoardStatus boardStatus, String keyword, Pageable pageable
    );

    @EntityGraph(attributePaths = {"writer"})
    Page<Board> findByBoardTypeAndBoardStatusAndTitleContainingIgnoreCaseOrBoardTypeAndBoardStatusAndContentContainingIgnoreCase(
            BoardType titleBoardType, BoardStatus titleBoardStatus, String titleKeyword,
            BoardType contentBoardType, BoardStatus contentBoardStatus, String contentKeyword,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {"writer"})
    Page<Board> findByBoardTypeAndBoardStatusAndWriter_Id(
            BoardType boardType, BoardStatus boardStatus, Long writerId, Pageable pageable
    );

    @EntityGraph(attributePaths = {"writer"})
    Page<Board> findByBoardTypeAndBoardStatusAndWriter_IdAndTitleContainingIgnoreCase(
            BoardType boardType, BoardStatus boardStatus, Long writerId, String keyword, Pageable pageable
    );

    @EntityGraph(attributePaths = {"writer"})
    Page<Board> findByBoardTypeAndBoardStatusAndWriter_IdAndContentContainingIgnoreCase(
            BoardType boardType, BoardStatus boardStatus, Long writerId, String keyword, Pageable pageable
    );

    @EntityGraph(attributePaths = {"writer"})
    Page<Board> findByBoardTypeAndBoardStatusAndWriter_IdAndWriter_NicknameContainingIgnoreCase(
            BoardType boardType, BoardStatus boardStatus, Long writerId, String keyword, Pageable pageable
    );

    @EntityGraph(attributePaths = {"writer"})
    Page<Board> findByBoardTypeAndBoardStatusAndWriter_IdAndTitleContainingIgnoreCaseOrBoardTypeAndBoardStatusAndWriter_IdAndContentContainingIgnoreCase(
            BoardType titleBoardType, BoardStatus titleBoardStatus, Long titleWriterId, String titleKeyword,
            BoardType contentBoardType, BoardStatus contentBoardStatus, Long contentWriterId, String contentKeyword,
            Pageable pageable
    );

    @Query(value = """
            SELECT b.*
            FROM board b
            JOIN member m ON m.member_id = b.writer_id
            LEFT JOIN (
                SELECT board_id, COUNT(*) AS comment_count
                FROM board_comment
                WHERE comment_status = 'ACTIVE'
                GROUP BY board_id
            ) comment_summary ON comment_summary.board_id = b.board_id
            WHERE b.board_type = :boardType
              AND b.board_status = :boardStatus
              AND (:writerId IS NULL OR b.writer_id = :writerId)
              AND (
                    :keyword IS NULL
                    OR (:searchType = 'title' AND LOWER(b.title) LIKE LOWER(CONCAT('%', :keyword, '%')))
                    OR (:searchType = 'content' AND LOWER(b.content) LIKE LOWER(CONCAT('%', :keyword, '%')))
                    OR (:searchType = 'writer' AND LOWER(m.nickname) LIKE LOWER(CONCAT('%', :keyword, '%')))
                    OR (:searchType = 'titleContent' AND (
                        LOWER(b.title) LIKE LOWER(CONCAT('%', :keyword, '%'))
                        OR LOWER(b.content) LIKE LOWER(CONCAT('%', :keyword, '%'))
                    ))
              )
            ORDER BY COALESCE(comment_summary.comment_count, 0) DESC, b.created_at DESC, b.board_id DESC
            """, countQuery = """
            SELECT COUNT(*)
            FROM board b
            JOIN member m ON m.member_id = b.writer_id
            WHERE b.board_type = :boardType
              AND b.board_status = :boardStatus
              AND (:writerId IS NULL OR b.writer_id = :writerId)
              AND (
                    :keyword IS NULL
                    OR (:searchType = 'title' AND LOWER(b.title) LIKE LOWER(CONCAT('%', :keyword, '%')))
                    OR (:searchType = 'content' AND LOWER(b.content) LIKE LOWER(CONCAT('%', :keyword, '%')))
                    OR (:searchType = 'writer' AND LOWER(m.nickname) LIKE LOWER(CONCAT('%', :keyword, '%')))
                    OR (:searchType = 'titleContent' AND (
                        LOWER(b.title) LIKE LOWER(CONCAT('%', :keyword, '%'))
                        OR LOWER(b.content) LIKE LOWER(CONCAT('%', :keyword, '%'))
                    ))
              )
            """, nativeQuery = true)
    Page<Board> findBoardListOrderByCommentCount(@Param("boardType") String boardType,
                                                  @Param("boardStatus") String boardStatus,
                                                  @Param("searchType") String searchType,
                                                  @Param("keyword") String keyword,
                                                  @Param("writerId") Long writerId,
                                                  Pageable pageable);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE Board b
            SET b.viewCount = b.viewCount + 1
            WHERE b.boardId = :boardId
              AND b.boardStatus = :boardStatus
            """)
    int increaseViewCount(@Param("boardId") Long boardId,
                          @Param("boardStatus") BoardStatus boardStatus);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE Board b
            SET b.groupId = :groupId,
                b.recruitmentStatus = :recruitmentStatus
            WHERE b.boardId = :boardId
              AND b.boardStatus = :boardStatus
              AND b.groupId IS NULL
            """)
    int connectGroup(@Param("boardId") Long boardId,
                     @Param("boardStatus") BoardStatus boardStatus,
                     @Param("groupId") Long groupId,
                     @Param("recruitmentStatus") BoardRecruitmentStatus recruitmentStatus);

    @Modifying(flushAutomatically = true)
    @Query("""
            UPDATE Board b
            SET b.groupId = NULL
            WHERE b.boardId = :boardId
              AND b.groupId = :groupId
            """)
    int clearGroupId(@Param("boardId") Long boardId,
                     @Param("groupId") Long groupId);

    @EntityGraph(attributePaths = {"writer"})
    Optional<Board> findByBoardIdAndBoardStatus(Long boardId, BoardStatus boardStatus);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"writer"})
    @Query("""
            SELECT b
            FROM Board b
            WHERE b.boardId = :boardId
              AND b.boardStatus = :boardStatus
            """)
    Optional<Board> findActiveBoardForUpdate(@Param("boardId") Long boardId,
                                             @Param("boardStatus") BoardStatus boardStatus);
}

