package com.moneysnapshot.counterparty;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.moneysnapshot.bill.BillRepository;
import com.moneysnapshot.security.AppUser;
import com.moneysnapshot.security.CurrentUserService;
import com.moneysnapshot.shared.normalization.NameNormalizationService;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class CounterpartyServiceTest {

    @Mock
    private CounterpartyRepository counterpartyRepository;

    @Mock
    private BillRepository billRepository;

    @Mock
    private NameNormalizationService normalizer;

    @Mock
    private CurrentUserService currentUserService;

    @Test
    void deleteCounterpartyRejectsLinkedBills() {
        UUID ownerId = UUID.randomUUID();
        UUID counterpartyId = UUID.randomUUID();
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);

        CounterpartyService service = new CounterpartyService(
                counterpartyRepository,
                billRepository,
                normalizer,
                currentUserService
        );

        Counterparty counterparty = new Counterparty(
                owner,
                "Orange Polska",
                "orange-polska",
                "12121212121212121212121212",
                null,
                null
        );
        ReflectionTestUtils.setField(counterparty, "id", counterpartyId);

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(counterpartyRepository.findByIdAndOwnerId(counterpartyId, ownerId)).thenReturn(Optional.of(counterparty));
        when(billRepository.existsByCounterpartyIdAndOwnerId(counterpartyId, ownerId)).thenReturn(true);

        assertThatThrownBy(() -> service.deleteCounterparty(counterpartyId))
                .isInstanceOf(CounterpartyInUseException.class)
                .hasMessageContaining("cannot be deleted");

        verify(counterpartyRepository, never()).deleteById(counterpartyId);
        verify(counterpartyRepository, never()).flush();
    }
}
