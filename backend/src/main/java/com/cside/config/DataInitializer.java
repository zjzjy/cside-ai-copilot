package com.cside.config;

import com.cside.entity.User;
import com.cside.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        if (!userRepository.existsByUsername("admin")) {
            User admin = new User();
            admin.setUsername("admin");
            admin.setPassword(passwordEncoder.encode("admin123"));
            admin.setRole("admin");
            userRepository.save(admin);
            log.info("Default admin user created: admin/admin123");
        }

        if (!userRepository.existsByUsername("agent")) {
            User agent = new User();
            agent.setUsername("agent");
            agent.setPassword(passwordEncoder.encode("agent123"));
            agent.setRole("agent");
            userRepository.save(agent);
            log.info("Default agent user created: agent/agent123");
        }
    }
}