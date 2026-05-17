package com.moneysnapshot.security.web;

import com.moneysnapshot.security.UserManagementService;
import com.moneysnapshot.security.UserSettingsService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class UserManagementController {

    private final UserManagementService userManagementService;
    private final UserSettingsService userSettingsService;

    public UserManagementController(UserManagementService userManagementService, UserSettingsService userSettingsService) {
        this.userManagementService = userManagementService;
        this.userSettingsService = userSettingsService;
    }

    @GetMapping("/roles")
    public List<RoleResponse> listRoles() {
        return userManagementService.listRoles().stream()
                .map(RoleResponse::from)
                .toList();
    }

    @GetMapping("/users")
    public List<UserResponse> listUsers() {
        return userManagementService.listUsers().stream()
                .map(UserResponse::from)
                .toList();
    }

    @GetMapping("/users/{id}")
    public UserResponse getUser(@PathVariable UUID id) {
        return UserResponse.from(userManagementService.getUser(id));
    }

    @PostMapping("/users")
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody CreateUserRequest request) {
        UserResponse response = UserResponse.from(userManagementService.createUser(request));
        return ResponseEntity.created(URI.create("/api/users/" + response.id())).body(response);
    }

    @PutMapping("/users/{id}")
    public UserResponse updateUser(@PathVariable UUID id, @Valid @RequestBody UpdateUserRequest request) {
        return UserResponse.from(userManagementService.updateUser(id, request));
    }

    @DeleteMapping("/users/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteUser(@PathVariable UUID id) {
        userManagementService.deleteUser(id);
    }

    @GetMapping("/users/me")
    public UserResponse currentUser() {
        return UserResponse.from(userManagementService.getCurrentUser());
    }

    @PutMapping("/users/me")
    public UserResponse updateCurrentUser(@Valid @RequestBody UpdateProfileRequest request) {
        return UserResponse.from(userManagementService.updateCurrentUser(request));
    }

    @GetMapping("/users/me/settings")
    public UserSettingsResponse currentUserSettings() {
        return userSettingsService.currentUserSettings();
    }

    @PutMapping("/users/me/settings")
    public UserSettingsResponse updateCurrentUserSettings(@Valid @RequestBody UpdateUserSettingsRequest request) {
        return userSettingsService.updateCurrentUserSettings(request);
    }
}
