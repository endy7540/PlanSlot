package com.example.planslot.global.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class ViewController {

    @GetMapping("/auth/login")
    public String loginPage() {
        return "global/auth";
    }

    @GetMapping("/auth/signup")
    public String signupPage() {
        return "global/auth";
    }

    @GetMapping({"/", "/planslot"})
    public String home() {
        return "global/home";
    }

    @GetMapping("/auth/oauth2-callback")
    public String oauth2Callback() {
        return "global/oauth2-callback";
    }

    @GetMapping("/mypage")
    public String mypage() {
        return "member/mypage";
    }
}

