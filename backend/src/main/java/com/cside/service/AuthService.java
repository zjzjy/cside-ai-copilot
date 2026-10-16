package com.cside.service;

import com.cside.config.JwtUtil;
import com.cside.dto.LoginRequest;
import com.cside.dto.LoginResponse;
import com.cside.entity.User;
import com.cside.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public LoginResponse login(LoginRequest request) {
        if (request.getUsername() == null || request.getUsername().isBlank()) {
            throw new IllegalArgumentException("参数为空");
        }

        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new BadCredentialsException("密码错误"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new BadCredentialsException("密码错误");
        }

        String token = jwtUtil.generateToken(user.getUsername(), user.getRole());
        log.info("User logged in: {}", user.getUsername());

        return new LoginResponse(token, user.getUsername(), user.getRole());
    }
}