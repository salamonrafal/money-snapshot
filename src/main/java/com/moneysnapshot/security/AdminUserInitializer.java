package com.moneysnapshot.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class AdminUserInitializer implements ApplicationRunner {

    private final AppUserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final String email;
    private final String password;
    private final String firstName;
    private final String lastName;

    public AdminUserInitializer(
            AppUserRepository userRepository,
            RoleRepository roleRepository,
            PasswordEncoder passwordEncoder,
            @Value("${app.admin.email:}") String email,
            @Value("${app.admin.password:}") String password,
            @Value("${app.admin.first-name:Admin}") String firstName,
            @Value("${app.admin.last-name:User}") String lastName
    ) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.email = email;
        this.password = password;
        this.firstName = firstName;
        this.lastName = lastName;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (email == null || email.isBlank() || password == null || password.isBlank() || userRepository.existsByEmailIgnoreCase(email)) {
            return;
        }

        Role adminRole = roleRepository.findByCode(Role.ADMINISTRATOR)
                .orElseThrow(() -> new IllegalStateException("Administrator role is missing."));
        userRepository.save(new AppUser(
                email.trim().toLowerCase(),
                firstName.trim(),
                lastName.trim(),
                "Initial administrator",
                adminRole,
                UserStatus.ACTIVE,
                passwordEncoder.encode(password)
        ));
    }
}
