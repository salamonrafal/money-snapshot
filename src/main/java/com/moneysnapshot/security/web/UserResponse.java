package com.moneysnapshot.security.web;

import com.moneysnapshot.security.AppUser;
import com.moneysnapshot.security.UserStatus;
import java.time.OffsetDateTime;
import java.util.UUID;

public record UserResponse(
        UUID id,
        String email,
        String firstName,
        String lastName,
        String description,
        UUID roleId,
        String roleCode,
        String roleName,
        UserStatus status,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
    public static UserResponse from(AppUser user) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.getDescription(),
                user.getRole().getId(),
                user.getRole().getCode(),
                user.getRole().getName(),
                user.getStatus(),
                user.getCreatedAt(),
                user.getUpdatedAt()
        );
    }
}
