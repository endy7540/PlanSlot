package com.example.planslot.member.servcie;

import com.example.planslot.member.dto.MemberRequestDTO;
import com.example.planslot.member.entity.Member;
import com.example.planslot.member.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Random;

import com.example.planslot.member.dto.MemberResponseDTO;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MemberServiceImpl implements MemberService{
    private final MemberRepository memberRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public Long signUp(MemberRequestDTO.SignUp request) {
        if(memberRepository.existsByLoginId(request.getLoginId())) {
            throw new IllegalArgumentException("이미 사용 중인 아이디입니다.");
        }
        if(memberRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("이미 등록된 이메일입니다.");
        }

        String encodePassword = passwordEncoder.encode(request.getPassword());
        
        String reqNickname = request.getNickname();
        if (reqNickname != null && reqNickname.length() > 20) {
            throw new IllegalArgumentException("닉네임은 최대 20자까지 입력 가능합니다.");
        }
        String uniqueNickname = generateUniqueNickname(reqNickname);

        Member member = Member.builder()
                .loginId(request.getLoginId())
                .password(encodePassword)
                .email(request.getEmail())
                .nickname(uniqueNickname)
                .address(request.getAddress())
                .role(Member.Role.MEMBER)
                .status(Member.Status.ACTIVE)
                .allowActivityNoti(request.isAllowActivityNoti())
                .allowMarketingNoti(request.isAllowMarketingNoti())
                .build();

        return memberRepository.save(member).getId();
    }

    @Override
    public boolean checkDuplicateId(String loginId) {
        return memberRepository.existsByLoginId(loginId);
    }

    @Override
    public MemberResponseDTO.MyPage getMyPage(String email) {
        Member member = memberRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 회원입니다."));
        return MemberResponseDTO.MyPage.builder()
                .email(member.getEmail())
                .nickname(member.getNickname())
                .displayName(member.getDisplayName())
                .address(member.getAddress())
                .profileImageUrl(member.getProfileImageUrl())
                .allowActivityNoti(member.isAllowActivityNoti())
                .allowMarketingNoti(member.isAllowMarketingNoti())
                .role(member.getRole().name())
                .calendarColor(member.getCalendarColor())
                .build();
    }

    @Override
    @Transactional
    public void updateMyInfo(String email, MemberRequestDTO.UpdateInfo request) {
        Member member = memberRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 회원입니다."));
        
        String encodedPassword = null;
        if (request.getNewPassword() != null && !request.getNewPassword().trim().isEmpty()) {
            if (request.getCurrentPassword() == null || request.getCurrentPassword().trim().isEmpty()) {
                throw new IllegalArgumentException("현재 비밀번호를 입력해주세요.");
            }
            if (!passwordEncoder.matches(request.getCurrentPassword(), member.getPassword())) {
                throw new IllegalArgumentException("현재 비밀번호가 일치하지 않습니다.");
            }
            encodedPassword = passwordEncoder.encode(request.getNewPassword());
        }
        
        String finalNickname = member.getNickname();
        if (request.getNickname() != null && 
            !request.getNickname().equals(member.getDisplayName()) && 
            !request.getNickname().equals(member.getNickname())) {
            
            String reqNickname = request.getNickname().trim();
            if (reqNickname.length() > 20) {
                throw new IllegalArgumentException("닉네임은 최대 20자까지 입력 가능합니다.");
            }
            finalNickname = generateUniqueNickname(reqNickname);
        }
        
        member.updateInfo(finalNickname, encodedPassword, request.getAddress());
        member.updateCalendarColor(request.getCalendarColor());
    }

    @Override
    @Transactional
    public void updateCalendarColor(String email, String color) {
        Member member = memberRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 회원입니다."));
        member.updateCalendarColor(color);
    }

    @Override
    @Transactional
    public void withdraw(String email) {
        Member member = memberRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 회원입니다."));
        member.withdraw();
    }

    @Override
    @Transactional
    public void updateNotification(String email, MemberRequestDTO.UpdateNotification request) {
        Member member = memberRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 회원입니다."));
        member.updateNotification(request.isAllowActivityNoti(), request.isAllowMarketingNoti());
    }

    @Override
    @Transactional
    public void updateProfileImage(String email, String imageUrl) {
        Member member = memberRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 회원입니다."));
        member.updateProfileImage(imageUrl);
    }
    
    @Override
    @Transactional
    public void updateGoogleSyncEnabled(String email, boolean enabled) {
        Member member = memberRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 회원입니다."));
        member.setGoogleSyncEnabled(enabled);
    }

    @Override
    public Member getMember(String email) {
        return memberRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 회원입니다."));
    }

    private String generateUniqueNickname(String baseNickname) {
        Random random = new Random();
        String newNickname;
        int attempts = 0;
        int tagMax = 10000;
        String format = "#%04d";
        
        do {
            int tag = random.nextInt(tagMax);
            newNickname = baseNickname + String.format(format, tag);
            attempts++;
            
            // 50번 실패할 때마다 자릿수를 늘림 (4자리 -> 5자리 -> 6자리...)
            if (attempts % 50 == 0) {
                tagMax *= 10;
                format = "#%0" + (String.valueOf(tagMax - 1).length()) + "d";
            }
        } while (memberRepository.existsByNickname(newNickname));
        return newNickname;
    }
}
