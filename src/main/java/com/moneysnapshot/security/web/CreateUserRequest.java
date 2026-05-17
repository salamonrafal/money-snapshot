package com.moneysnapshot.security.web;

import com.moneysnapshot.security.UserStatus;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record CreateUserRequest(
        @NotBlank @Email @Size(max = 180) String email,
        @NotBlank @Size(max = 120) String firstName,
        @NotBlank @Size(max = 120) String lastName,
        @Size(max = 500) String description,
        @NotNull UUID roleId,
        @NotNull UserStatus status,
        @NotBlank @Size(min = 8, max = 120) String password
) {
}
