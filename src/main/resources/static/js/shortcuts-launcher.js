(() => {
    const topbarElement = document.querySelector(".topbar");
    const roots = document.querySelectorAll("[data-shortcuts-launcher]");

    if (roots.length === 0) {
        return;
    }

    let calendarMessages = null;
    let calendarMessagesLanguage = null;
    let userSettingsPromise = null;

    async function loadCalendarMessages(language = document.documentElement.lang || "pl") {
        if (calendarMessages && calendarMessagesLanguage === language) {
            return calendarMessages;
        }

        const response = await fetch(`/api/calendar/messages?lang=${encodeURIComponent(language)}`);
        if (!response.ok) {
            throw new Error("Cannot load calendar messages.");
        }

        calendarMessages = await response.json();
        calendarMessagesLanguage = language;
        return calendarMessages;
    }

    async function loadUserSettings() {
        if (!userSettingsPromise) {
            userSettingsPromise = MoneySnapshotUi.loadUserSettings();
        }
        return userSettingsPromise;
    }

    function eventTypeLabel(messages, type) {
        return messages[`calendar.event.type.${type}`] ?? type;
    }

    function eventMetaLabel(messages, event, settings) {
        if (event.type === "PAYMENT") {
            const formattedAmount = MoneySnapshotUi.formatMoneyValue(Number(event.amount ?? 0), settings);
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

    function updateLauncherOffset() {
        const launcherTop = topbarElement ? topbarElement.getBoundingClientRect().height : 0;
        document.documentElement.style.setProperty("--shortcuts-launcher-top", `${Math.round(launcherTop)}px`);
    }

    function lockTargets() {
        document.querySelectorAll("[data-shortcuts-lock-on-open]").forEach((element) => {
            if (!(element instanceof HTMLElement)) {
                return;
            }

            const rect = element.getBoundingClientRect();
            element.dataset.shortcutsLauncherLocked = "true";
            element.style.position = "fixed";
            element.style.top = `${Math.round(rect.top)}px`;
            element.style.left = `${Math.round(rect.left)}px`;
            element.style.width = `${Math.round(rect.width)}px`;
            element.style.marginTop = "0";
        });
    }

    function unlockTargets() {
        document.querySelectorAll("[data-shortcuts-lock-on-open][data-shortcuts-launcher-locked='true']").forEach((element) => {
            if (!(element instanceof HTMLElement)) {
                return;
            }

            delete element.dataset.shortcutsLauncherLocked;
            element.style.removeProperty("position");
            element.style.removeProperty("top");
            element.style.removeProperty("left");
            element.style.removeProperty("width");
            element.style.removeProperty("margin-top");
        });
    }

    function isScrollableWithinLauncher(target) {
        if (!(target instanceof Element)) {
            return false;
        }

        const scrollableElement = target.closest(".shortcuts-launcher-surface");
        return Boolean(scrollableElement && scrollableElement.scrollHeight > scrollableElement.clientHeight);
    }

    function focusedControlUsesKey(target, key) {
        if (!(target instanceof Element)) {
            return false;
        }

        if (target.closest("input, textarea, select, [contenteditable='true']")) {
            return true;
        }

        if (key === " " && target.closest("button, [role='button']")) {
            return true;
        }

        return false;
    }

    roots.forEach((root) => {
        const button = root.querySelector("[data-shortcuts-launcher-button]");
        const panel = root.querySelector("[data-shortcuts-launcher-panel]");
        const closeButton = root.querySelector("[data-shortcuts-launcher-close]");
        const eventsButton = root.querySelector("[data-shortcuts-events-button]");
        const eventsPanel = root.querySelector("[data-shortcuts-events-panel]");
        const eventsCloseButton = root.querySelector("[data-shortcuts-events-close]");
        const eventsList = root.querySelector("[data-shortcuts-events-list]");
        const eventsBadge = root.querySelector("[data-shortcuts-events-badge]");
        const eventsLabel = root.querySelector("[data-shortcuts-events-button-label]");
        const eventsTitle = root.querySelector("[data-shortcuts-events-title]");

        if (!(button instanceof HTMLElement) || !(panel instanceof HTMLElement)) {
            return;
        }

        let lastTrigger = null;
        let inertedElements = [];
        let scrollTop = 0;
        let eventsLoadedDate = null;
        const focusableSelector = "[autofocus], button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

        function isOpen() {
            return !panel.hidden && panel.classList.contains("is-open");
        }

        function isEventsOpen() {
            return eventsPanel instanceof HTMLElement && !eventsPanel.hidden;
        }

        function closeEventsPanel({restoreFocus = true} = {}) {
            if (!(eventsPanel instanceof HTMLElement) || !(eventsButton instanceof HTMLElement)) {
                return;
            }

            eventsPanel.hidden = true;
            eventsButton.setAttribute("aria-expanded", "false");
            if (restoreFocus) {
                window.requestAnimationFrame(() => {
                    eventsButton.dataset.suppressTooltipOnFocusOnce = "true";
                    eventsButton.focus();
                });
            }
        }

        function applyEventsMessages(messages) {
            if (!(eventsButton instanceof HTMLElement)) {
                return;
            }

            const titleTemplate = messages["launcher.todayEvents.button"] ?? "Dzisiejsze zdarzenia ({count})";
            const titleWithoutCount = messages["launcher.todayEvents.buttonNoCount"] ?? "Dzisiejsze zdarzenia";
            const badgeCount = Number(eventsButton.dataset.shortcutsEventsCount ?? "0");
            const fullLabel = badgeCount > 0
                ? titleTemplate.replace("{count}", String(badgeCount))
                : titleWithoutCount;

            MoneySnapshotUi.setTooltip(eventsButton, fullLabel);
            eventsButton.setAttribute("aria-label", fullLabel);
            if (eventsLabel instanceof HTMLElement) {
                eventsLabel.textContent = fullLabel;
            }
            if (eventsTitle instanceof HTMLElement) {
                eventsTitle.textContent = messages["launcher.todayEvents.title"] ?? titleWithoutCount;
            }
            if (eventsPanel instanceof HTMLElement) {
                eventsPanel.setAttribute("aria-label", messages["launcher.todayEvents.title"] ?? titleWithoutCount);
            }
            if (eventsCloseButton instanceof HTMLElement) {
                eventsCloseButton.setAttribute("aria-label", messages["common.close"] ?? "Zamknij");
            }
        }

        function renderEventsBadge(count) {
            if (!(eventsButton instanceof HTMLElement)) {
                return;
            }

            eventsButton.dataset.shortcutsEventsCount = String(count);
            if (eventsBadge instanceof HTMLElement) {
                eventsBadge.hidden = count <= 0;
                eventsBadge.textContent = count > 0 ? String(count) : "";
            }

            if (calendarMessages) {
                applyEventsMessages(calendarMessages);
            }
        }

        async function loadTodayEvents(force = false, language = document.documentElement.lang || "pl") {
            if (!(eventsList instanceof HTMLElement) || !(eventsButton instanceof HTMLElement)) {
                return;
            }

            const today = MoneySnapshotUi.localIsoDate();
            if (!force && eventsLoadedDate === today && calendarMessagesLanguage === language && calendarMessages) {
                return;
            }

            const [messages, settings, response] = await Promise.all([
                loadCalendarMessages(language),
                loadUserSettings(),
                fetch(`/api/calendar/events?fromDate=${encodeURIComponent(today)}&toDate=${encodeURIComponent(today)}`)
            ]);
            if (!response.ok) {
                throw new Error("Cannot load today's calendar events.");
            }

            const events = await response.json();
            eventsLoadedDate = today;
            applyEventsMessages(messages);
            renderEventsBadge(events.length);

            if (events.length === 0) {
                const empty = document.createElement("p");
                empty.className = "shortcuts-events-empty";
                empty.textContent = messages["launcher.todayEvents.empty"] ?? "Brak zdarzeń zaplanowanych na dzisiaj.";
                eventsList.replaceChildren(empty);
                return;
            }

            events.sort((left, right) => (left.title ?? eventTypeLabel(messages, left.type)).localeCompare(
                right.title ?? eventTypeLabel(messages, right.type),
                document.documentElement.lang || "pl"
            ));

            eventsList.replaceChildren(...events.map((event) => {
                const article = document.createElement("article");
                article.className = "shortcuts-events-card";

                const header = document.createElement("div");
                header.className = "shortcuts-events-card-header";

                const title = document.createElement("h3");
                title.className = "shortcuts-events-card-title";
                title.textContent = event.title ?? eventTypeLabel(messages, event.type);

                const badge = document.createElement("span");
                badge.className = `calendar-event-badge calendar-event-badge-${event.type.toLowerCase()}`;
                badge.textContent = eventTypeLabel(messages, event.type);

                const meta = document.createElement("p");
                meta.className = "shortcuts-events-card-meta";
                meta.textContent = eventMetaLabel(messages, event, settings);

                header.append(title, badge);
                article.append(header, meta);

                if (event.description) {
                    const description = document.createElement("p");
                    description.className = "shortcuts-events-card-description";
                    description.textContent = event.description;
                    article.append(description);
                }

                return article;
            }));
        }

        function openEventsPanel() {
            if (!(eventsPanel instanceof HTMLElement) || !(eventsButton instanceof HTMLElement)) {
                return;
            }

            close({restoreFocus: false});
            eventsPanel.hidden = false;
            eventsButton.setAttribute("aria-expanded", "true");
            loadTodayEvents()
                .then(() => {
                    if (isEventsOpen() && eventsCloseButton instanceof HTMLElement) {
                        eventsCloseButton.dataset.suppressTooltipOnFocusOnce = "true";
                        eventsCloseButton.focus();
                    }
                })
                .catch((error) => {
                    console.error(error);
                });
        }

        function focusableElements() {
            return [...panel.querySelectorAll(focusableSelector)]
                .filter((element) => element instanceof HTMLElement && !element.hidden && element.offsetParent !== null);
        }

        function focusFirstElement() {
            const focusTarget = focusableElements()[0];
            if (focusTarget instanceof HTMLElement) {
                focusTarget.focus();
                return;
            }

            panel.focus();
        }

        function setPageInert(isInert) {
            if (isInert) {
                inertedElements = [...document.body.children]
                    .filter((element) => element instanceof HTMLElement
                        && element !== root
                        && !element.contains(root))
                    .map((element) => ({
                        element,
                        wasInert: element.inert
                    }));
                inertedElements.forEach(({element}) => {
                    element.inert = true;
                });
                return;
            }

            inertedElements.forEach(({element, wasInert}) => {
                if (element.isConnected) {
                    element.inert = wasInert;
                }
            });
            inertedElements = [];
        }

        function open(trigger = button) {
            MoneySnapshotUi.dismissTooltip();
            closeEventsPanel({restoreFocus: false});
            updateLauncherOffset();
            scrollTop = window.scrollY || window.pageYOffset || 0;
            lockTargets();
            const topbarHeight = topbarElement instanceof HTMLElement
                ? Math.round(topbarElement.getBoundingClientRect().height)
                : 0;
            document.body.style.setProperty("--shortcuts-launcher-scroll-top", `${scrollTop}px`);
            document.body.style.setProperty("--topbar-lock-height", `${topbarHeight}px`);
            if (MoneySnapshotUi.shouldReserveScrollbarSpace()) {
                document.documentElement.classList.add("shortcuts-launcher-scroll-locked");
            }
            panel.hidden = false;
            document.body.classList.add("shortcuts-launcher-open");
            button.setAttribute("aria-expanded", "true");
            lastTrigger = trigger instanceof HTMLElement ? trigger : button;
            button.blur();
            setPageInert(true);
            window.requestAnimationFrame(() => {
                panel.classList.add("is-open");
                if (closeButton instanceof HTMLElement) {
                    closeButton.dataset.suppressTooltipOnFocusOnce = "true";
                    closeButton.focus();
                    return;
                }
                focusFirstElement();
            });
        }

        function close({restoreFocus = true} = {}) {
            if (!isOpen()) {
                return;
            }

            MoneySnapshotUi.dismissTooltip();
            panel.classList.remove("is-open");
            setPageInert(false);
            button.setAttribute("aria-expanded", "false");
            document.body.classList.remove("shortcuts-launcher-open");
            document.documentElement.classList.remove("shortcuts-launcher-scroll-locked");
            document.body.style.removeProperty("--shortcuts-launcher-scroll-top");
            document.body.style.removeProperty("--topbar-lock-height");
            window.scrollTo(0, scrollTop);
            unlockTargets();

            const finalizeClose = () => {
                if (!panel.classList.contains("is-open")) {
                    panel.hidden = true;
                }
            };

            panel.addEventListener("transitionend", finalizeClose, {once: true});

            const focusTarget = lastTrigger;
            lastTrigger = null;
            if (restoreFocus && focusTarget instanceof HTMLElement) {
                window.requestAnimationFrame(() => {
                    MoneySnapshotUi.dismissTooltip();
                    focusTarget.dataset.suppressTooltipOnFocusOnce = "true";
                    focusTarget.focus();
                });
            }
        }

        button.addEventListener("click", () => {
            if (isOpen()) {
                close();
                return;
            }

            open(button);
        });

        closeButton?.addEventListener("click", () => {
            close();
        });

        eventsButton?.addEventListener("click", () => {
            if (isEventsOpen()) {
                MoneySnapshotUi.dismissTooltip(eventsButton);
                eventsButton.dataset.suppressTooltipOnFocusOnce = "true";
                eventsButton.blur();
                closeEventsPanel({restoreFocus: false});
                return;
            }

            openEventsPanel();
        });

        eventsCloseButton?.addEventListener("click", () => {
            closeEventsPanel();
        });

        panel.addEventListener("click", (event) => {
            if (event.target === panel) {
                close();
                return;
            }

            if (event.target instanceof Element
                && event.target.closest("a[href], button:not([data-shortcuts-launcher-close])")) {
                close({restoreFocus: false});
            }
        });

        document.addEventListener("click", (event) => {
            if (!isOpen() || !(event.target instanceof Element)) {
                return;
            }

            const clickedInsidePanel = Boolean(event.target.closest("[data-shortcuts-launcher-panel]"));
            const clickedLauncherButton = Boolean(event.target.closest("[data-shortcuts-launcher-button]"));
            if (!clickedInsidePanel && !clickedLauncherButton) {
                close();
            }
        });

        document.addEventListener("click", (event) => {
            if (!isEventsOpen() || !(event.target instanceof Element)) {
                return;
            }

            const clickedInsideEventsPanel = Boolean(event.target.closest("[data-shortcuts-events-panel]"));
            const clickedEventsButton = Boolean(event.target.closest("[data-shortcuts-events-button]"));
            if (!clickedInsideEventsPanel && !clickedEventsButton) {
                closeEventsPanel({restoreFocus: false});
            }
        });

        document.addEventListener("keydown", (event) => {
            if (!isOpen()) {
                if (isEventsOpen() && event.key === "Escape") {
                    closeEventsPanel();
                }
                return;
            }

            if (event.key === "Escape") {
                close();
                return;
            }

            if (event.key === "Tab") {
                const focusable = focusableElements();
                if (focusable.length === 0) {
                    event.preventDefault();
                    panel.focus();
                    return;
                }

                const firstElement = focusable[0];
                const lastElement = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === firstElement) {
                    event.preventDefault();
                    lastElement.focus();
                } else if (!event.shiftKey && document.activeElement === lastElement) {
                    event.preventDefault();
                    firstElement.focus();
                }
                return;
            }

            const scrollKeys = new Set([" ", "PageDown", "PageUp", "End", "Home", "ArrowDown", "ArrowUp"]);
            if (scrollKeys.has(event.key)
                && !focusedControlUsesKey(document.activeElement, event.key)
                && !isScrollableWithinLauncher(document.activeElement)) {
                event.preventDefault();
            }
        });

        document.addEventListener("wheel", (event) => {
            if (isOpen() && !isScrollableWithinLauncher(event.target)) {
                event.preventDefault();
            }
        }, {passive: false});

        document.addEventListener("touchmove", (event) => {
            if (isOpen() && !isScrollableWithinLauncher(event.target)) {
                event.preventDefault();
            }
        }, {passive: false});

        document.addEventListener("money-snapshot:i18n-language-change", (event) => {
            const language = typeof event.detail?.language === "string"
                ? event.detail.language
                : (document.documentElement.lang || "pl");
            calendarMessages = null;
            calendarMessagesLanguage = null;
            eventsLoadedDate = null;
            loadTodayEvents(true, language).catch((error) => {
                console.error(error);
            });
        });

        window.addEventListener("money-snapshot:shortcut-action-saved", (event) => {
            if (event.detail?.type !== "bulk-snapshots") {
                return;
            }

            eventsLoadedDate = null;
            loadTodayEvents(true).catch((error) => {
                console.error(error);
            });
        });
    });

    updateLauncherOffset();
    window.addEventListener("resize", updateLauncherOffset);
})();
