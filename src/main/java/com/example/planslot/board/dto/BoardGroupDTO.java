package com.example.planslot.board.dto;

import java.util.List;

public class BoardGroupDTO {

    public record Candidate(Long memberId, String nickname) {
    }

    public record CandidatesResponse(
            String groupName,
            List<Candidate> applicants,
            List<Candidate> inviteCandidates
    ) {
    }

    public record CreateRequest(
            String groupName,
            List<Long> applicantCandidateIds,
            List<Long> inviteCandidateIds,
            List<Long> selectedApplicantIds,
            List<Long> selectedInviteeIds
    ) {
    }

    public record CreateResponse(Long groupId) {
    }
}
