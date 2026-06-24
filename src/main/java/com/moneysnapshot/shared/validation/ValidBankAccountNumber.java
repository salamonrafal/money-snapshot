package com.moneysnapshot.shared.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = BankAccountNumberConstraintValidator.class)
public @interface ValidBankAccountNumber {

    String message() default "Invalid bank account number.";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
