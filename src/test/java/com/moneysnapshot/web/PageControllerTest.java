package com.moneysnapshot.web;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.moneysnapshot.ApplicationEnvironmentProperties;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class PageControllerTest {

    @Test
    void rendersTransactionAnalyzerWhenFeatureIsEnabled() {
        PageController controller = pageController(true);

        assertEquals("transaction-analyzer", controller.transactionAnalyzer());
    }

    @Test
    void hidesTransactionAnalyzerWhenFeatureIsDisabled() {
        PageController controller = pageController(false);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, controller::transactionAnalyzer);

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
    }

    private PageController pageController(boolean transactionAnalyzerEnabled) {
        return new PageController("", new ApplicationEnvironmentProperties(
                "test",
                Map.of("transaction-analyzer", transactionAnalyzerEnabled)
        ));
    }
}
