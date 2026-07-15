package com.example.planslot.boardreport.entity;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum BoardReportReasonCode {
    ABUSE("욕설·비방"),
    SPAM("스팸·광고"),
    INAPPROPRIATE("음란·부적절한 내용"),
    PERSONAL_INFORMATION("개인정보 노출"),
    OTHER("기타");

    private final String description;
}
