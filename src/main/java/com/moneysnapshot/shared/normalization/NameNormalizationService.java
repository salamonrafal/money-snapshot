package com.moneysnapshot.shared.normalization;

import java.text.Normalizer;
import java.util.Locale;
import org.springframework.stereotype.Service;

@Service
public class NameNormalizationService {

    public String normalize(String value) {
        if (value == null) {
            return "";
        }

        String normalized = replaceSeparators(value.trim().toLowerCase(Locale.ROOT));
        normalized = replaceNationalCharacters(normalized);
        normalized = Normalizer.normalize(normalized, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");

        return normalized.replaceAll("-+", "-")
                .replaceAll("^-|-$", "");
    }

    private String replaceSeparators(String value) {
        StringBuilder normalized = new StringBuilder();
        value.codePoints()
                .forEach(codePoint -> {
                    if (shouldReplaceWithHyphen(codePoint)) {
                        normalized.append('-');
                    } else {
                        normalized.appendCodePoint(codePoint);
                    }
                });
        return normalized.toString();
    }

    private boolean shouldReplaceWithHyphen(int codePoint) {
        if (Character.isWhitespace(codePoint) || Character.isISOControl(codePoint)) {
            return true;
        }

        return switch (Character.getType(codePoint)) {
            case Character.SPACE_SEPARATOR,
                    Character.LINE_SEPARATOR,
                    Character.PARAGRAPH_SEPARATOR,
                    Character.CONTROL,
                    Character.FORMAT -> true;
            default -> false;
        };
    }

    private String replaceNationalCharacters(String value) {
        return value
                .replace('ą', 'a')
                .replace('ć', 'c')
                .replace('ę', 'e')
                .replace('ł', 'l')
                .replace('ń', 'n')
                .replace('ó', 'o')
                .replace('ś', 's')
                .replace('ź', 'z')
                .replace('ż', 'z');
    }
}
