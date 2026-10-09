package com.moneysnapshot.web;

import com.moneysnapshot.ApplicationEnvironmentProperties;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ModelAttribute;

@ControllerAdvice
public class ApplicationEnvironmentModelAdvice {

    private final ApplicationEnvironmentProperties applicationEnvironmentProperties;

    public ApplicationEnvironmentModelAdvice(ApplicationEnvironmentProperties applicationEnvironmentProperties) {
        this.applicationEnvironmentProperties = applicationEnvironmentProperties;
    }

    @ModelAttribute("applicationEnvironment")
    public ApplicationEnvironmentProperties applicationEnvironment() {
        return applicationEnvironmentProperties;
    }
}
