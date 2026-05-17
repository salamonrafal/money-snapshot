package com.moneysnapshot.security;

import com.moneysnapshot.security.web.UpdateUserSettingsRequest;
import com.moneysnapshot.security.web.UserSettingsResponse;
import jakarta.transaction.Transactional;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

@Service
public class UserSettingsService {

    public static final String DEFAULT_CURRENCY = "defaultCurrency";
    public static final String DATE_TIME_FORMAT = "dateTimeFormat";
    public static final String MONEY_FORMAT = "moneyFormat";

    private static final Map<String, String> DEFAULT_VALUES = Map.of(
            DEFAULT_CURRENCY, "PLN",
            DATE_TIME_FORMAT, "Y-m-d H:m",
            MONEY_FORMAT, "### ###,00 zł"
    );

    private final UserSettingRepository settingRepository;
    private final CurrentUserService currentUserService;
    private final Map<UUID, UserSettingsResponse> cache = new ConcurrentHashMap<>();

    public UserSettingsService(UserSettingRepository settingRepository, CurrentUserService currentUserService) {
        this.settingRepository = settingRepository;
        this.currentUserService = currentUserService;
    }

    public UserSettingsResponse currentUserSettings() {
        UUID userId = currentUserService.currentUserId();
        return cache.computeIfAbsent(userId, this::loadSettings);
    }

    @Transactional
    public UserSettingsResponse updateCurrentUserSettings(UpdateUserSettingsRequest request) {
        AppUser user = currentUserService.currentUser();
        request.values().forEach((key, value) -> saveSetting(user, key, value));
        cache.remove(user.getId());
        return currentUserSettings();
    }

    public void evict(UUID userId) {
        cache.remove(userId);
    }

    private UserSettingsResponse loadSettings(UUID userId) {
        Map<String, String> values = new LinkedHashMap<>(DEFAULT_VALUES);
        settingRepository.findAllByUserId(userId)
                .forEach(setting -> values.put(setting.getKey(), setting.getValue()));

        return response(values);
    }

    private void saveSetting(AppUser user, String key, String value) {
        String normalizedKey = normalizeKey(key);
        String normalizedValue = normalizeValue(value);
        if (normalizedKey == null || normalizedValue == null) {
            return;
        }

        settingRepository.findByUserIdAndKey(user.getId(), normalizedKey)
                .ifPresentOrElse(
                        setting -> setting.updateValue(normalizedValue),
                        () -> settingRepository.save(new UserSetting(user, normalizedKey, normalizedValue))
                );
    }

    private String normalizeKey(String key) {
        if (key == null || key.isBlank() || key.length() > 120) {
            return null;
        }

        return key.trim();
    }

    private String normalizeValue(String value) {
        if (value == null || value.isBlank() || value.length() > 1000) {
            return null;
        }

        return value.trim();
    }

    private UserSettingsResponse response(Map<String, String> values) {
        Map<String, String> immutableValues = Map.copyOf(values);
        return new UserSettingsResponse(
                values.get(DEFAULT_CURRENCY),
                values.get(DATE_TIME_FORMAT),
                values.get(MONEY_FORMAT),
                immutableValues
        );
    }
}
