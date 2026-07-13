package com.example.planslot.member.servcie;

import com.example.planslot.member.dto.MemberRequestDTO;

public interface MemberService {
    Long signUp(MemberRequestDTO.SignUp request);
}
