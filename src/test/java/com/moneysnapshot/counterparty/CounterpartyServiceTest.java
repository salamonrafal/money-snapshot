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
import org.springframework.dao.DataIntegrityViolationException;
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
    void createCounterpartyTranslatesDuplicateNameRaceOnFlush() {
        UUID ownerId = UUID.randomUUID();
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        when(owner.getId()).thenReturn(ownerId);

        CounterpartyService service = new CounterpartyService(
                counterpartyRepository,
                billRepository,
                normalizer,
                currentUserService
        );

        var request = new com.moneysnapshot.counterparty.web.CreateCounterpartyRequest(
                "Orange Polska",
                "12121212121212121212121212",
                null,
                null
        );

        when(currentUserService.currentUser()).thenReturn(owner);
        when(normalizer.normalize("Orange Polska")).thenReturn("orange-polska");
        when(counterpartyRepository.findByOwnerIdAndNormalizedName(ownerId, "orange-polska")).thenReturn(Optional.empty());
        when(counterpartyRepository.saveAndFlush(org.mockito.ArgumentMatchers.any(Counterparty.class)))
                .thenThrow(new DataIntegrityViolationException("duplicate key"));

        assertThatThrownBy(() -> service.createCounterparty(request))
                .isInstanceOf(DuplicateCounterpartyNameException.class)
                .hasMessageContaining("orange-polska");
    }

    @Test
    void updateCounterpartyTranslatesDuplicateNameRaceOnFlush() {
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

        var request = new com.moneysnapshot.counterparty.web.CreateCounterpartyRequest(
                "Orange Polska",
                "12121212121212121212121212",
                null,
                null
        );

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(normalizer.normalize("Orange Polska")).thenReturn("orange-polska");
        when(counterpartyRepository.findByIdAndOwnerId(counterpartyId, ownerId)).thenReturn(Optional.of(counterparty));
        when(counterpartyRepository.findByOwnerIdAndNormalizedName(ownerId, "orange-polska")).thenReturn(Optional.empty());
        when(counterpartyRepository.saveAndFlush(counterparty))
                .thenThrow(new DataIntegrityViolationException("duplicate key"));

        assertThatThrownBy(() -> service.updateCounterparty(counterpartyId, request))
                .isInstanceOf(DuplicateCounterpartyNameException.class)
                .hasMessageContaining("orange-polska");
    }

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
