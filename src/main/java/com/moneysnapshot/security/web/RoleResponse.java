package com.moneysnapshot.security.web;

import com.moneysnapshot.security.Role;
import java.util.UUID;

public record RoleResponse(
        UUID id,
        String code,
        String name
) {
    public static RoleResponse from(Role role) {
        return new RoleResponse(role.getId(), role.getCode(), role.getName());
    }
}
