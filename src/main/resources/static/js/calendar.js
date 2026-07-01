const calendarBoardElement = document.getElementById("calendar-board");
const previousMonthButton = document.getElementById("calendar-previous-month");
const nextMonthButton = document.getElementById("calendar-next-month");
const todayButton = document.getElementById("calendar-today");
const calendarMonthLabelElement = document.getElementById("calendar-panel-month-label");
const eventsSubtitleElement = document.getElementById("calendar-events-subtitle");
const eventsListElement = document.getElementById("calendar-events-list");
const eventsPanelElement = document.querySelector(".calendar-day-panel");
const calendarPanelElement = document.querySelector(".calendar-panel");

let currentLanguage = "pl";
let messages = {};
let userSettings = null;
let selectedDate = MoneySnapshotUi.localIsoDate();
let currentMonthDate = startOfMonth(selectedDate);
let currentWeekdayLabelMode = resolveWeekdayLabelMode();
let currentEvents = [];
let currentEventsRequestId = 0;
let currentEventsAbortController = null;

function startOfMonth(isoDate) {
    return `${isoDate.slice(0, 7)}-01`;
}

function parseUtcDate(isoDate) {
    return new Date(`${isoDate}T00:00:00Z`);
}

function toIsoDate(date) {
    return date.toISOString().slice(0, 10);
}

function shiftMonth(isoDate, deltaMonths) {
    const date = parseUtcDate(isoDate);
    return toIsoDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + deltaMonths, 1)));
}

function shiftDay(isoDate, deltaDays) {
    const date = parseUtcDate(isoDate);
    date.setUTCDate(date.getUTCDate() + deltaDays);
    return toIsoDate(date);
}

function formatMonthLabel(isoDate) {
    const value = new Intl.DateTimeFormat(currentLanguage === "en" ? "en-US" : "pl-PL", {
        month: "long",
        year: "numeric",
        timeZone: "UTC"
    }).format(parseUtcDate(isoDate));
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatSelectedDate(isoDate) {
    return isoDate ? MoneySnapshotUi.formatDateValue(isoDate, userSettings) : (messages["calendar.summary.emptySelection"] ?? "-");
}

function resolveWeekdayLabelMode() {
    if (window.innerWidth <= 760) {
        return "narrow";
    }

    if (window.innerWidth <= 1024) {
        return "compact";
    }

    return "short";
}

function weekdayLabels() {
    const labelMode = resolveWeekdayLabelMode();
    if (labelMode === "narrow") {
        return currentLanguage === "en"
            ? ["M", "T", "W", "T", "F", "S", "S"]
            : ["P", "W", "S", "C", "P", "S", "N"];
    }

    if (labelMode === "compact") {
        return currentLanguage === "en"
            ? ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
            : ["Pn", "Wt", "Sr", "Cz", "Pt", "So", "Nd"];
    }

    const monday = parseUtcDate("2024-01-01");
    return [...Array(7)].map((_, index) => new Intl.DateTimeFormat(currentLanguage === "en" ? "en-US" : "pl-PL", {
        weekday: "short",
        timeZone: "UTC"
    }).format(new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + index))));
}

function eventsForDate(isoDate) {
    return currentEvents
        .filter((event) => event.date === isoDate)
        .sort((left, right) => (left.title ?? eventTypeLabel(left.type)).localeCompare(
            right.title ?? eventTypeLabel(right.type),
            currentLanguage
        ));
}

function eventTypeLabel(type) {
    return messages[`calendar.event.type.${type}`] ?? type;
}

function eventMetaLabel(event) {
    if (event.type === "PAYMENT") {
        const formattedAmount = MoneySnapshotUi.formatMoneyValue(Number(event.amount ?? 0), userSettings);
        return `${messages["calendar.event.amount"] ?? "Kwota"}: ${formattedAmount}${event.currencyCode ? ` ${event.currencyCode}` : ""}`;
    }

    if (event.type === "SNAPSHOT") {
        const snapshotLabel = event.snapshotLabel && messages[`snapshots.type.${event.snapshotLabel}`]
            ? messages[`snapshots.type.${event.snapshotLabel}`]
            : (event.snapshotLabel ?? "-");
        return `${messages["calendar.event.snapshot"] ?? "Typ migawki"}: ${snapshotLabel}`;
    }

    return messages["calendar.event.period"] ?? "Okres rozliczeniowy";
}

function shouldScrollToEventsPanel() {
    return window.innerWidth <= 1024;
}

function scrollToEventsPanel() {
    if (!eventsPanelElement || !shouldScrollToEventsPanel()) {
        return;
    }

    eventsPanelElement.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

function syncEventsPanelHeight() {
    if (!eventsPanelElement) {
        return;
    }

    if (window.innerWidth <= 1024 || !calendarPanelElement) {
        eventsPanelElement.style.removeProperty("--calendar-panel-height");
        return;
    }

    eventsPanelElement.style.setProperty("--calendar-panel-height", `${calendarPanelElement.offsetHeight}px`);
}

function firstCalendarDay(monthIsoDate) {
    const monthStart = parseUtcDate(monthIsoDate);
    const dayOfWeek = (monthStart.getUTCDay() + 6) % 7;
    monthStart.setUTCDate(monthStart.getUTCDate() - dayOfWeek);
    return toIsoDate(monthStart);
}

function isCurrentVisibleMonth(isoDate) {
    return isoDate.slice(0, 7) === currentMonthDate.slice(0, 7);
}

function renderPanelState() {
    const selectedEvents = selectedDate ? eventsForDate(selectedDate) : [];

    if (calendarMonthLabelElement) {
        calendarMonthLabelElement.textContent = formatMonthLabel(currentMonthDate);
    }
    if (eventsSubtitleElement) {
        eventsSubtitleElement.textContent = selectedDate
            ? (messages["calendar.events.selectedDaySummary"] ?? "{date} · {countLabel}: {count}")
                .replace("{date}", formatSelectedDate(selectedDate))
                .replace("{countLabel}", messages["calendar.summary.count"] ?? "Event count")
                .replace("{count}", String(selectedEvents.length))
            : (messages["calendar.events.noneSelected"] ?? "");
    }
}

function renderEventList() {
    if (!eventsListElement) {
        return;
    }

    const selectedEvents = eventsForDate(selectedDate);

    if (selectedEvents.length === 0) {
        const emptyElement = document.createElement("p");
        emptyElement.className = "calendar-events-empty";
        emptyElement.textContent = messages["calendar.events.empty"] ?? "";
        eventsListElement.replaceChildren(emptyElement);
        return;
    }

    eventsListElement.replaceChildren(...selectedEvents.map((event) => {
        const article = document.createElement("article");
        article.className = "calendar-event-card";

        const badge = document.createElement("span");
        badge.className = `calendar-event-badge calendar-event-badge-${event.type.toLowerCase()}`;
        badge.textContent = eventTypeLabel(event.type);

        const title = document.createElement("h4");
        title.className = "calendar-event-title";
        title.textContent = event.title ?? eventTypeLabel(event.type);

        const meta = document.createElement("p");
        meta.className = "calendar-event-meta";
        meta.textContent = eventMetaLabel(event);

        const description = document.createElement("p");
        description.className = "calendar-event-description";
        description.textContent = event.description ?? "";

        article.append(badge, title, meta, description);
        return article;
    }));
}

function createDayCell(isoDate) {
    const cell = document.createElement("div");
    cell.className = "calendar-cell";
    cell.setAttribute("role", "gridcell");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day-button";

    if (!isCurrentVisibleMonth(isoDate)) {
        button.classList.add("calendar-day-button-outside");
    }
    if (isoDate === MoneySnapshotUi.localIsoDate()) {
        button.classList.add("calendar-day-button-today");
    }
    if (isoDate === selectedDate) {
        button.classList.add("calendar-day-button-selected");
        button.setAttribute("aria-current", "date");
    }

    const dayNumber = document.createElement("span");
    dayNumber.className = "calendar-day-number";
    dayNumber.textContent = String(parseUtcDate(isoDate).getUTCDate());

    const markers = document.createElement("div");
    markers.className = "calendar-day-markers";

    const dayEvents = eventsForDate(isoDate);
    dayEvents.slice(0, 2).forEach((event) => {
        const marker = document.createElement("span");
        marker.className = `calendar-day-marker calendar-day-marker-${event.type.toLowerCase()}`;
        marker.textContent = eventTypeLabel(event.type);
        markers.append(marker);
    });

    if (dayEvents.length > 2) {
        const more = document.createElement("span");
        more.className = "calendar-day-more";
        more.textContent = `+${dayEvents.length - 2} ${messages["calendar.calendar.more"] ?? ""}`.trim();
        markers.append(more);
    }

    const dateLabel = new Intl.DateTimeFormat(currentLanguage === "en" ? "en-US" : "pl-PL", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC"
    }).format(parseUtcDate(isoDate));
    const ariaKey = isoDate === selectedDate ? "calendar.aria.dayButtonSelected" : "calendar.aria.dayButton";
    button.setAttribute("aria-label", (messages[ariaKey] ?? "{date}, {count}").replace("{date}", dateLabel).replace("{count}", String(dayEvents.length)));
    button.addEventListener("click", () => {
        selectedDate = isoDate;
        renderCalendar();
        scrollToEventsPanel();
    });

    button.append(dayNumber, markers);
    cell.append(button);
    return cell;
}

async function loadCalendarEvents() {
    currentEventsAbortController?.abort();
    currentEventsAbortController = new AbortController();

    const requestId = currentEventsRequestId + 1;
    currentEventsRequestId = requestId;
    const fromDate = firstCalendarDay(currentMonthDate);
    const toDate = shiftDay(fromDate, 41);
    const response = await fetch(`/api/calendar/events?fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}`, {
        signal: currentEventsAbortController.signal
    });
    if (!response.ok) {
        throw new Error("Cannot load calendar events.");
    }

    const nextEvents = await response.json();
    if (requestId !== currentEventsRequestId) {
        return false;
    }

    currentEvents = nextEvents;
    return true;
}

function renderCalendar() {
    if (!calendarBoardElement || !userSettings) {
        return;
    }

    document.title = `${messages["calendar.heading.title"] ?? "Kalendarz"} | ${messages["app.name"] ?? "Money Snapshot"}`;

    const weekdayRow = document.createElement("div");
    weekdayRow.className = "calendar-weekdays";
    weekdayRow.setAttribute("role", "row");
    weekdayLabels().forEach((label) => {
        const element = document.createElement("div");
        element.className = "calendar-weekday";
        element.setAttribute("role", "columnheader");
        element.textContent = label;
        weekdayRow.append(element);
    });

    const grid = document.createElement("div");
    grid.className = "calendar-grid";
    grid.setAttribute("role", "rowgroup");

    let dayPointer = firstCalendarDay(currentMonthDate);
    for (let weekIndex = 0; weekIndex < 6; weekIndex += 1) {
        const row = document.createElement("div");
        row.className = "calendar-row";
        row.setAttribute("role", "row");

        for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
            row.append(createDayCell(dayPointer));
            dayPointer = shiftDay(dayPointer, 1);
        }

        grid.append(row);
    }

    calendarBoardElement.replaceChildren(weekdayRow, grid);
    calendarBoardElement.setAttribute("aria-label", `${messages["calendar.aria.grid"] ?? ""}: ${formatMonthLabel(currentMonthDate)}`.trim());
    renderPanelState();
    renderEventList();
    syncEventsPanelHeight();
}

previousMonthButton?.addEventListener("click", () => {
    currentMonthDate = shiftMonth(currentMonthDate, -1);
    selectedDate = currentMonthDate;
    loadCalendarEvents()
        .then((didUpdate) => {
            if (!didUpdate) {
                return;
            }
            renderCalendar();
        })
        .catch((error) => {
            if (error.name === "AbortError") {
                return;
            }
            console.error(error);
        });
});

nextMonthButton?.addEventListener("click", () => {
    currentMonthDate = shiftMonth(currentMonthDate, 1);
    selectedDate = currentMonthDate;
    loadCalendarEvents()
        .then((didUpdate) => {
            if (!didUpdate) {
                return;
            }
            renderCalendar();
        })
        .catch((error) => {
            if (error.name === "AbortError") {
                return;
            }
            console.error(error);
        });
});

todayButton?.addEventListener("click", () => {
    selectedDate = MoneySnapshotUi.localIsoDate();
    currentMonthDate = startOfMonth(selectedDate);
    loadCalendarEvents()
        .then((didUpdate) => {
            if (!didUpdate) {
                return;
            }
            renderCalendar();
        })
        .catch((error) => {
            if (error.name === "AbortError") {
                return;
            }
            console.error(error);
        });
});

window.addEventListener("resize", () => {
    syncEventsPanelHeight();

    const nextWeekdayLabelMode = resolveWeekdayLabelMode();
    if (nextWeekdayLabelMode === currentWeekdayLabelMode) {
        return;
    }

    currentWeekdayLabelMode = nextWeekdayLabelMode;
    renderCalendar();
});

MoneySnapshotI18n.init({
    endpoint: "/api/calendar/messages",
    onLanguageChange: ({language, messages: nextMessages}) => {
        currentLanguage = language;
        messages = nextMessages;
        renderCalendar();
    }
})
    .then(() => MoneySnapshotUi.loadUserSettings())
    .then((settings) => {
        userSettings = settings;
        return loadCalendarEvents();
    })
    .then((didUpdate) => {
        if (!didUpdate) {
            return;
        }
        renderCalendar();
        if (typeof ResizeObserver === "function" && calendarPanelElement) {
            const resizeObserver = new ResizeObserver(() => {
                syncEventsPanelHeight();
            });
            resizeObserver.observe(calendarPanelElement);
        }
    })
    .catch((error) => {
        if (error.name === "AbortError") {
            return;
        }
        console.error(error);
    });
