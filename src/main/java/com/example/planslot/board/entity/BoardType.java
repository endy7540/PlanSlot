package com.example.planslot.board.entity;

import java.util.Locale;

public enum BoardType {
    NOTICE,
    STUDY,
    CLUB,
    FREE;

    // 문자열을 게시판 유형으로 변환
    public static BoardType from(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("게시판 유형을 입력해 주세요.");
        }

        try {
            return BoardType.valueOf(value.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("존재하지 않는 게시판 유형입니다.");
        }
    }
}