package com.moneysnapshot.security;

import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class CurrentUserService {

    private final AppUserRepository userRepository;

    public CurrentUserService(AppUserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public AppUser currentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new IllegalStateException("No authenticated user.");
        }

        return userRepository.findByNormalizedEmail(authentication.getName())
                .orElseThrow(() -> new IllegalStateException("Authenticated user not found."));
    }

    public UUID currentUserId() {
        return currentUser().getId();
    }

    public boolean isAdministrator() {
        return Role.ADMINISTRATOR.equals(currentUser().getRole().getCode());
    }
}
