package com.moneysnapshot.security;

import com.moneysnapshot.account.AccountRepository;
import com.moneysnapshot.account.BankRepository;
import com.moneysnapshot.snapshot.AccountSnapshotRepository;
import com.moneysnapshot.security.web.CreateUserRequest;
import com.moneysnapshot.security.web.UpdateProfileRequest;
import com.moneysnapshot.security.web.UpdateUserRequest;
import jakarta.transaction.Transactional;
import java.util.List;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class UserManagementService {

    private final AppUserRepository userRepository;
    private final RoleRepository roleRepository;
    private final AccountSnapshotRepository snapshotRepository;
    private final AccountRepository accountRepository;
    private final BankRepository bankRepository;
    private final UserSettingRepository settingRepository;
    private final CurrentUserService currentUserService;
    private final PasswordEncoder passwordEncoder;

    public UserManagementService(
            AppUserRepository userRepository,
            RoleRepository roleRepository,
            AccountSnapshotRepository snapshotRepository,
            AccountRepository accountRepository,
            BankRepository bankRepository,
            UserSettingRepository settingRepository,
            CurrentUserService currentUserService,
            PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.snapshotRepository = snapshotRepository;
        this.accountRepository = accountRepository;
        this.bankRepository = bankRepository;
        this.settingRepository = settingRepository;
        this.currentUserService = currentUserService;
        this.passwordEncoder = passwordEncoder;
    }

    public List<AppUser> listUsers() {
        return userRepository.findAllByOrderByEmail();
    }

    public AppUser getUser(UUID id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));
    }

    public List<Role> listRoles() {
        return roleRepository.findAllByOrderByName();
    }

    public AppUser getCurrentUser() {
        return currentUserService.currentUser();
    }

    @Transactional
    public AppUser createUser(CreateUserRequest request) {
        String email = normalizeEmail(request.email());
        ensureEmailAvailable(email, null);

        Role role = roleRepository.findById(request.roleId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Role not found."));

        try {
            return userRepository.save(new AppUser(
                    email,
                    request.firstName().trim(),
                    request.lastName().trim(),
                    normalizeDescription(request.description()),
                    role,
                    request.status(),
                    passwordEncoder.encode(request.password())
            ));
        } catch (DataIntegrityViolationException exception) {
            throw duplicateEmailConflict(exception);
        }
    }

    @Transactional
    public AppUser updateUser(UUID id, UpdateUserRequest request) {
        AppUser user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));
        String email = normalizeEmail(request.email());
        ensureEmailAvailable(email, id);

        Role role = roleRepository.findById(request.roleId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Role not found."));
        AppUser currentUser = currentUserService.currentUser();
        if (currentUser.getId().equals(id) && (!Role.ADMINISTRATOR.equals(role.getCode()) || request.status() != UserStatus.ACTIVE)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot remove your own administrator access.");
        }

        user.updateDetails(
                email,
                request.firstName().trim(),
                request.lastName().trim(),
                normalizeDescription(request.description()),
                role,
                request.status(),
                encodePassword(request.password())
        );

        try {
            return userRepository.save(user);
        } catch (DataIntegrityViolationException exception) {
            throw duplicateEmailConflict(exception);
        }
    }

    @Transactional
    public AppUser updateCurrentUser(UpdateProfileRequest request) {
        AppUser user = currentUserService.currentUser();
        user.updateDetails(
                user.getEmail(),
                request.firstName().trim(),
                request.lastName().trim(),
                normalizeDescription(request.description()),
                user.getRole(),
                user.getStatus(),
                encodePassword(request.password())
        );

        return userRepository.save(user);
    }

    @Transactional
    public void deleteUser(UUID id) {
        AppUser currentUser = currentUserService.currentUser();
        if (currentUser.getId().equals(id)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot delete your own user.");
        }
        if (!userRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found.");
        }

        snapshotRepository.deleteByOwnerId(id);
        accountRepository.deleteByOwnerId(id);
        bankRepository.deleteByOwnerId(id);
        settingRepository.deleteByUserId(id);
        userRepository.deleteById(id);
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase();
    }

    private void ensureEmailAvailable(String email, UUID excludedUserId) {
        userRepository.findByNormalizedEmail(email)
                .filter(existingUser -> excludedUserId == null || !existingUser.getId().equals(excludedUserId))
                .ifPresent(existingUser -> {
                    throw duplicateEmailConflict(null);
                });
    }

    private String normalizeDescription(String description) {
        if (description == null || description.isBlank()) {
            return null;
        }

        return description.trim();
    }

    private String encodePassword(String password) {
        if (password == null || password.isBlank()) {
            return null;
        }

        return passwordEncoder.encode(password);
    }

    private ResponseStatusException duplicateEmailConflict(Exception cause) {
        return new ResponseStatusException(HttpStatus.CONFLICT, "User with this email already exists.", cause);
    }
}
