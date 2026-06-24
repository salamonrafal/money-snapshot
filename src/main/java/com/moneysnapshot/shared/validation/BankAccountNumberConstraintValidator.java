package com.moneysnapshot.shared.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class BankAccountNumberConstraintValidator implements ConstraintValidator<ValidBankAccountNumber, String> {

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null || value.isBlank()) {
            return true;
        }

        return BankAccountNumbers.isValid(value);
    }
}
