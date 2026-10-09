package com.moneysnapshot;

import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.environment")
public record ApplicationEnvironmentProperties(String name, Map<String, Boolean> features) {

    public ApplicationEnvironmentProperties {
        features = features == null ? Map.of() : Map.copyOf(features);
    }

    public boolean featureEnabled(String featureName) {
        return Boolean.TRUE.equals(features.get(featureName));
    }
}
