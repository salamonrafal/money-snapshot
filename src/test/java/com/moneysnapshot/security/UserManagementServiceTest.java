package com.moneysnapshot.security;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.moneysnapshot.account.AccountRepository;
import com.moneysnapshot.account.BankRepository;
import com.moneysnapshot.security.web.CreateUserRequest;
import com.moneysnapshot.security.web.UpdateUserRequest;
import com.moneysnapshot.snapshot.AccountSnapshotRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

class UserManagementServiceTest {

    private final AppUserRepository userRepository = mock(AppUserRepository.class);
    private final RoleRepository roleRepository = mock(RoleRepository.class);
    private final AccountSnapshotRepository snapshotRepository = mock(AccountSnapshotRepository.class);
    private final AccountRepository accountRepository = mock(AccountRepository.class);
    private final BankRepository bankRepository = mock(BankRepository.class);
    private final UserSettingRepository settingRepository = mock(UserSettingRepository.class);
    private final CurrentUserService currentUserService = mock(CurrentUserService.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final UserManagementService service = new UserManagementService(
            userRepository,
            roleRepository,
            snapshotRepository,
            accountRepository,
            bankRepository,
            settingRepository,
            currentUserService,
            passwordEncoder
    );

    @Test
    void createUserRejectsDuplicateEmailDetectedBeforeSave() {
        CreateUserRequest request = new CreateUserRequest(
                "existing@example.com",
                "Jan",
                "Kowalski",
                null,
                UUID.randomUUID(),
                UserStatus.ACTIVE,
                "secret123"
        );

        when(userRepository.findByNormalizedEmail("existing@example.com")).thenReturn(Optional.of(mock(AppUser.class)));

        assertThatThrownBy(() -> service.createUser(request))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("User with this email already exists.")
                .extracting(error -> ((ResponseStatusException) error).getStatusCode())
                .isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void createUserRejectsDuplicateEmailWhenDatabaseConstraintTriggers() {
        UUID roleId = UUID.randomUUID();
        CreateUserRequest request = new CreateUserRequest(
                "User@Example.com",
                "Jan",
                "Kowalski",
                null,
                roleId,
                UserStatus.ACTIVE,
                "secret123"
        );
        Role role = mock(Role.class);

        when(userRepository.findByNormalizedEmail("user@example.com")).thenReturn(Optional.empty());
        when(roleRepository.findById(roleId)).thenReturn(Optional.of(role));
        when(passwordEncoder.encode("secret123")).thenReturn("encoded-secret");
        when(userRepository.saveAndFlush(any(AppUser.class))).thenThrow(new DataIntegrityViolationException("duplicate key"));

        assertThatThrownBy(() -> service.createUser(request))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("User with this email already exists.")
                .extracting(error -> ((ResponseStatusException) error).getStatusCode())
                .isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void updateUserRejectsDuplicateEmailWhenDatabaseConstraintTriggers() {
        UUID userId = UUID.randomUUID();
        UUID roleId = UUID.randomUUID();
        Role existingRole = mock(Role.class);
        Role nextRole = mock(Role.class);
        AppUser currentUser = mock(AppUser.class);
        AppUser user = new AppUser(
                "current@example.com",
                "Jan",
                "Kowalski",
                null,
                existingRole,
                UserStatus.ACTIVE,
                "encoded-secret"
        );
        UpdateUserRequest request = new UpdateUserRequest(
                "other@example.com",
                "Jan",
                "Kowalski",
                null,
                roleId,
                UserStatus.ACTIVE,
                null
        );

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.findByNormalizedEmail("other@example.com")).thenReturn(Optional.empty());
        when(roleRepository.findById(roleId)).thenReturn(Optional.of(nextRole));
        when(currentUser.getId()).thenReturn(UUID.randomUUID());
        when(currentUserService.currentUser()).thenReturn(currentUser);
        when(userRepository.saveAndFlush(user)).thenThrow(new DataIntegrityViolationException("duplicate key"));

        assertThatThrownBy(() -> service.updateUser(userId, request))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("User with this email already exists.")
                .extracting(error -> ((ResponseStatusException) error).getStatusCode())
                .isEqualTo(HttpStatus.CONFLICT);
    }
}
