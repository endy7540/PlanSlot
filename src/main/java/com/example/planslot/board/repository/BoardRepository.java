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

