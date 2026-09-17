package com.moneysnapshot.security;

import com.moneysnapshot.security.web.UpdateUserSettingsRequest;
import com.moneysnapshot.security.web.UserSettingsResponse;
import jakarta.transaction.Transactional;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

@Service
public class UserSettingsService {

    public static final String DEFAULT_CURRENCY = "defaultCurrency";
    public static final String THEME = "theme";
    public static final String DATE_TIME_FORMAT = "dateTimeFormat";
    public static final String MONEY_FORMAT = "moneyFormat";
    public static final String BILLING_MONTH_START_DAY = "billingMonthStartDay";
    public static final String PERIOD_COMPARISON_HISTORY_PERIODS = "periodComparisonHistoryPeriods";
    public static final int DEFAULT_PERIOD_COMPARISON_HISTORY_PERIODS = 3;
    public static final int MAX_PERIOD_COMPARISON_HISTORY_PERIODS = 6;

    private static final Map<String, String> DEFAULT_VALUES = Map.of(
            DEFAULT_CURRENCY, "PLN",
            THEME, "light",
            DATE_TIME_FORMAT, "Y-m-d H:m",
            MONEY_FORMAT, "### ###,00 zł",
            BILLING_MONTH_START_DAY, "1",
            PERIOD_COMPARISON_HISTORY_PERIODS, "3"
    );

    private final UserSettingRepository settingRepository;
    private final CurrentUserService currentUserService;
    private final ApplicationEventPublisher eventPublisher;
    private final Map<UUID, UserSettingsResponse> cache = new ConcurrentHashMap<>();

    public UserSettingsService(
            UserSettingRepository settingRepository,
            CurrentUserService currentUserService,
            ApplicationEventPublisher eventPublisher
    ) {
        this.settingRepository = settingRepository;
        this.currentUserService = currentUserService;
        this.eventPublisher = eventPublisher;
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
        eventPublisher.publishEvent(new UserSettingsUpdatedEvent(user.getId()));
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
        String normalizedValue = normalizeValue(normalizedKey, value);
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

    private String normalizeValue(String key, String value) {
        if (value == null || value.isBlank() || value.length() > 1000) {
            return null;
        }

        String normalizedValue = value.trim();
        if (BILLING_MONTH_START_DAY.equals(key)) {
            try {
                int day = Integer.parseInt(normalizedValue);
                if (day < 1 || day > 31) {
                    return null;
                }
                return Integer.toString(day);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }

        if (PERIOD_COMPARISON_HISTORY_PERIODS.equals(key)) {
            try {
                int periods = Integer.parseInt(normalizedValue);
                return periods >= 1 && periods <= MAX_PERIOD_COMPARISON_HISTORY_PERIODS ? Integer.toString(periods) : null;
            } catch (NumberFormatException ignored) {
                return null;
            }
        }

        if (THEME.equals(key)) {
            return "dark".equals(normalizedValue) || "light".equals(normalizedValue) ? normalizedValue : null;
        }

        return normalizedValue;
    }

    private UserSettingsResponse response(Map<String, String> values) {
        int billingMonthStartDay = parseBillingMonthStartDay(values.get(BILLING_MONTH_START_DAY));
        int periodComparisonHistoryPeriods = parsePeriodComparisonHistoryPeriods(values.get(PERIOD_COMPARISON_HISTORY_PERIODS));
        String theme = normalizeTheme(values.get(THEME));
        Map<String, String> sanitizedValues = new LinkedHashMap<>(values);
        sanitizedValues.put(THEME, theme);
        sanitizedValues.put(BILLING_MONTH_START_DAY, Integer.toString(billingMonthStartDay));
        sanitizedValues.put(PERIOD_COMPARISON_HISTORY_PERIODS, Integer.toString(periodComparisonHistoryPeriods));
        Map<String, String> immutableValues = Map.copyOf(sanitizedValues);
        return new UserSettingsResponse(
                sanitizedValues.get(DEFAULT_CURRENCY),
                theme,
                sanitizedValues.get(DATE_TIME_FORMAT),
                sanitizedValues.get(MONEY_FORMAT),
                billingMonthStartDay,
                periodComparisonHistoryPeriods,
                immutableValues
        );
    }

    private String normalizeTheme(String value) {
        return "dark".equals(value) ? "dark" : "light";
    }

    private int parseBillingMonthStartDay(String value) {
        try {
            int day = Integer.parseInt(value);
            return day >= 1 && day <= 31 ? day : 1;
        } catch (NumberFormatException ignored) {
            return 1;
        }
    }

    private int parsePeriodComparisonHistoryPeriods(String value) {
        try {
            int periods = Integer.parseInt(value);
            return periods >= 1 && periods <= MAX_PERIOD_COMPARISON_HISTORY_PERIODS
                    ? periods : DEFAULT_PERIOD_COMPARISON_HISTORY_PERIODS;
        } catch (NumberFormatException ignored) {
            return DEFAULT_PERIOD_COMPARISON_HISTORY_PERIODS;
        }
    }

}
