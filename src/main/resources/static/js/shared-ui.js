window.MoneySnapshotUi = (() => {
    const bulkSnapshotSuccessKey = "money-snapshot-bulk-snapshot-success-count";
    const themeStorageKey = "money-snapshot-theme";
    const defaultSettings = {
        defaultCurrency: "PLN",
        theme: "light",
        dateTimeFormat: "Y-m-d H:m",
        moneyFormat: "### ###,00 zł",
        billingMonthStartDay: 1,
        values: {
            defaultCurrency: "PLN",
            theme: "light",
            dateTimeFormat: "Y-m-d H:m",
            moneyFormat: "### ###,00 zł",
            billingMonthStartDay: "1"
        }
    };
    let settingsPromise = null;
    let tooltipElement = null;
    let activeTooltipTarget = null;
    let tooltipPositionFrame = null;
    const tooltipDescribedById = "app-tooltip";

    function ensureTooltipElement() {
        if (tooltipElement) {
            return tooltipElement;
        }

        tooltipElement = document.createElement("div");
        tooltipElement.id = tooltipDescribedById;
        tooltipElement.setAttribute("role", "tooltip");
        tooltipElement.className = "app-tooltip";
        tooltipElement.hidden = true;
        document.body.append(tooltipElement);
        return tooltipElement;
    }

    function addTooltipDescription(element) {
        const describedBy = (element.getAttribute("aria-describedby") || "")
            .split(/\s+/)
            .filter(Boolean);
        if (!describedBy.includes(tooltipDescribedById)) {
            describedBy.push(tooltipDescribedById);
            element.setAttribute("aria-describedby", describedBy.join(" "));
        }
    }

    function removeTooltipDescription(element) {
        if (!element) {
            return;
        }

        const describedBy = (element.getAttribute("aria-describedby") || "")
            .split(/\s+/)
            .filter((value) => value && value !== tooltipDescribedById);
        if (describedBy.length > 0) {
            element.setAttribute("aria-describedby", describedBy.join(" "));
        } else {
            element.removeAttribute("aria-describedby");
        }
    }

    function positionTooltip(element) {
        if (!element?.dataset.tooltip) {
            return;
        }

        const tooltip = ensureTooltipElement();
        const horizontalPadding = 18;
        const verticalOffset = 8;
        const tooltipMaxWidth = Math.max(Math.min(384, window.innerWidth - (horizontalPadding * 2)), 160);

        tooltip.textContent = element.dataset.tooltip;
        tooltip.hidden = false;
        tooltip.dataset.placement = "top";
        tooltip.style.left = "0px";
        tooltip.style.top = "0px";
        tooltip.style.maxWidth = `${tooltipMaxWidth}px`;

        const elementRect = element.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();

        let left = elementRect.left + (elementRect.width / 2) - (tooltipRect.width / 2);
        left = Math.max(horizontalPadding, Math.min(left, window.innerWidth - tooltipRect.width - horizontalPadding));

        let top = elementRect.top - tooltipRect.height - verticalOffset;
        let placement = "top";
        if (top < 12) {
            top = elementRect.bottom + verticalOffset;
            placement = "bottom";
        }
        const maxTop = Math.max(12, window.innerHeight - tooltipRect.height - 12);
        top = Math.max(12, Math.min(top, maxTop));

        tooltip.dataset.placement = placement;
        tooltip.style.left = `${Math.round(left)}px`;
        tooltip.style.top = `${Math.round(top)}px`;
    }

    function showTooltip(element) {
        if (!element?.dataset.tooltip) {
            return;
        }

        if (element.dataset.suppressTooltipOnFocusOnce === "true") {
            delete element.dataset.suppressTooltipOnFocusOnce;
            return;
        }

        activeTooltipTarget = element;
        addTooltipDescription(element);
        positionTooltip(element);
    }

    function scheduleTooltipPositionUpdate() {
        if (!activeTooltipTarget || tooltipPositionFrame !== null) {
            return;
        }

        tooltipPositionFrame = window.requestAnimationFrame(() => {
            tooltipPositionFrame = null;
            if (activeTooltipTarget) {
                positionTooltip(activeTooltipTarget);
            }
        });
    }

    function hideTooltip(element) {
        if (element && activeTooltipTarget && element !== activeTooltipTarget) {
            return;
        }

        removeTooltipDescription(activeTooltipTarget);
        activeTooltipTarget = null;
        if (tooltipPositionFrame !== null) {
            window.cancelAnimationFrame(tooltipPositionFrame);
            tooltipPositionFrame = null;
        }
        if (tooltipElement) {
            tooltipElement.hidden = true;
            tooltipElement.textContent = "";
        }
    }

    function storedTheme() {
        try {
            return normalizeTheme(localStorage.getItem(themeStorageKey));
        } catch {
            return "light";
        }
    }

    function fallbackSettings() {
        const theme = storedTheme();
        return {
            ...defaultSettings,
            theme,
            values: {
                ...defaultSettings.values,
                theme
            }
        };
    }

    function createTrashIcon() {
        const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        icon.setAttribute("viewBox", "0 0 24 24");
        icon.setAttribute("fill", "none");
        icon.setAttribute("stroke", "currentColor");
        icon.setAttribute("stroke-width", "2");
        icon.setAttribute("stroke-linecap", "round");
        icon.setAttribute("stroke-linejoin", "round");
        icon.setAttribute("aria-hidden", "true");

        [
            "M3 6h18",
            "M8 6V4h8v2",
            "M19 6l-1 14H6L5 6",
            "M10 11v6",
            "M14 11v6"
        ].forEach((value) => {
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", value);
            icon.append(path);
        });

        return icon;
    }

    function createEditIcon() {
        const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        icon.setAttribute("viewBox", "0 0 24 24");
        icon.setAttribute("fill", "none");
        icon.setAttribute("stroke", "currentColor");
        icon.setAttribute("stroke-width", "2");
        icon.setAttribute("stroke-linecap", "round");
        icon.setAttribute("stroke-linejoin", "round");
        icon.setAttribute("aria-hidden", "true");

        [
            "M12 20h9",
            "M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"
        ].forEach((value) => {
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", value);
            icon.append(path);
        });

        return icon;
    }

    function createClearFiltersIcon() {
        const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        icon.setAttribute("viewBox", "0 0 24 24");
        icon.setAttribute("fill", "none");
        icon.setAttribute("stroke", "currentColor");
        icon.setAttribute("stroke-width", "2");
        icon.setAttribute("stroke-linecap", "round");
        icon.setAttribute("stroke-linejoin", "round");
        icon.setAttribute("aria-hidden", "true");

        [
            "M4 6h16",
            "M7 12h10",
            "M10 18h4",
            "M17 17l4 4",
            "M21 17l-4 4"
        ].forEach((value) => {
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", value);
            icon.append(path);
        });

        return icon;
    }

    function createAddIcon() {
        const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        icon.setAttribute("viewBox", "0 0 24 24");
        icon.setAttribute("fill", "none");
        icon.setAttribute("stroke", "currentColor");
        icon.setAttribute("stroke-width", "2");
        icon.setAttribute("stroke-linecap", "round");
        icon.setAttribute("stroke-linejoin", "round");
        icon.setAttribute("aria-hidden", "true");

        [
            "M12 5v14",
            "M5 12h14"
        ].forEach((value) => {
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", value);
            icon.append(path);
        });

        return icon;
    }

    function createInfoIcon() {
        const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        icon.setAttribute("viewBox", "0 0 24 24");
        icon.setAttribute("fill", "none");
        icon.setAttribute("stroke", "currentColor");
        icon.setAttribute("stroke-width", "2");
        icon.setAttribute("stroke-linecap", "round");
        icon.setAttribute("stroke-linejoin", "round");
        icon.setAttribute("aria-hidden", "true");

        [
            "M12 16v-4",
            "M12 8h.01",
            "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z"
        ].forEach((value) => {
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", value);
            icon.append(path);
        });

        return icon;
    }

    function safeReturnToPath(value) {
        if (!value) {
            return "";
        }

        try {
            const url = new URL(value, window.location.origin);
            if (url.origin !== window.location.origin || !url.pathname.startsWith("/")) {
                return "";
            }
            return `${url.pathname}${url.search}${url.hash}`;
        } catch {
            return "";
        }
    }

    function setTooltip(element, label) {
        if (!element) {
            return;
        }

        if (label) {
            element.dataset.tooltip = label;
            element.classList.add("has-app-tooltip");
            if (!element.dataset.tooltipBound) {
                element.addEventListener("mouseenter", () => showTooltip(element));
                element.addEventListener("mouseleave", () => hideTooltip(element));
                element.addEventListener("focus", () => showTooltip(element));
                element.addEventListener("blur", () => hideTooltip(element));
                element.dataset.tooltipBound = "true";
            }
        } else {
            delete element.dataset.tooltip;
            element.classList.remove("has-app-tooltip");
            hideTooltip(element);
        }

        element.removeAttribute("title");
        if (activeTooltipTarget === element && !tooltipElement?.hidden) {
            if (label) {
                scheduleTooltipPositionUpdate();
            } else {
                hideTooltip(element);
            }
        }
    }

    document.addEventListener("scroll", () => {
        scheduleTooltipPositionUpdate();
    }, {passive: true, capture: true});

    window.addEventListener("resize", () => {
        scheduleTooltipPositionUpdate();
    });

    function createModal({modalSelector, closeSelectors = []}) {
        const modal = document.querySelector(modalSelector);
        const closeButtons = closeSelectors
            .flatMap((selector) => [...document.querySelectorAll(selector)])
            .filter(Boolean);
        const dialog = modal?.querySelector("[role='dialog']") ?? modal?.firstElementChild ?? modal;
        let lastActiveElement = null;

        function focusFirstElement() {
            const focusTarget = dialog?.querySelector(
                "[autofocus], button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
            );
            if (focusTarget instanceof HTMLElement) {
                focusTarget.focus();
                return;
            }

            if (dialog instanceof HTMLElement) {
                dialog.focus();
            }
        }

        function open({trigger = document.activeElement} = {}) {
            lastActiveElement = trigger instanceof HTMLElement ? trigger : null;
            hideTooltip(lastActiveElement);
            modal.hidden = false;
            document.body.classList.add("modal-open");
            window.requestAnimationFrame(focusFirstElement);
        }

        function close() {
            modal.hidden = true;
            document.body.classList.remove("modal-open");
            const nextActiveElement = lastActiveElement;
            lastActiveElement = null;
            if (nextActiveElement?.isConnected) {
                nextActiveElement.dataset.suppressTooltipOnFocusOnce = "true";
                nextActiveElement.focus();
            }
        }

        closeButtons.forEach((button) => button.addEventListener("click", close));

        modal?.addEventListener("click", (event) => {
            if (event.target === modal) {
                close();
            }
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && modal && !modal.hidden) {
                close();
            }
        });

        return {
            open,
            close,
            isOpen: () => Boolean(modal && !modal.hidden),
            modal,
            dialog
        };
    }

    function createToastManager({durationMs = 5000} = {}) {
        let container = null;
        let activeToast = null;
        let removeToastTimer = null;

        function ensureContainer() {
            if (container) {
                return container;
            }

            container = document.createElement("div");
            container.className = "app-toast-stack";
            document.body.append(container);
            return container;
        }

        function clear() {
            if (removeToastTimer !== null) {
                window.clearTimeout(removeToastTimer);
                removeToastTimer = null;
            }
            if (activeToast) {
                activeToast.remove();
                activeToast = null;
            }
        }

        function show(message, {type = "", timeoutMs = durationMs} = {}) {
            if (!message) {
                clear();
                return;
            }

            clear();
            const stack = ensureContainer();
            const toast = document.createElement("div");
            toast.className = "app-toast";
            toast.dataset.type = type;
            toast.textContent = message;
            stack.append(toast);
            activeToast = toast;

            window.requestAnimationFrame(() => {
                toast.classList.add("is-visible");
            });

            removeToastTimer = window.setTimeout(() => {
                toast.classList.remove("is-visible");
                window.setTimeout(() => {
                    if (activeToast === toast) {
                        toast.remove();
                        activeToast = null;
                    }
                }, 180);
                removeToastTimer = null;
            }, timeoutMs);
        }

        return {
            show,
            clear
        };
    }

    function createConfirmModal({modalSelector, subjectSelector, confirmSelector, cancelSelector}) {
        const modal = document.querySelector(modalSelector);
        const subject = document.querySelector(subjectSelector);
        const confirmButton = document.querySelector(confirmSelector);
        const cancelButton = document.querySelector(cancelSelector);
        let selectedItem = null;
        const modalController = createModal({
            modalSelector,
            closeSelectors: [cancelSelector]
        });

        function open(item, subjectText) {
            selectedItem = item;
            subject.textContent = subjectText;
            modalController.open();
            window.requestAnimationFrame(() => confirmButton.focus());
        }

        function close() {
            selectedItem = null;
            modalController.close();
        }

        return {
            open,
            close,
            getSelectedItem: () => selectedItem,
            confirmButton
        };
    }

    async function loadUserSettings() {
        if (!settingsPromise) {
            settingsPromise = fetch("/api/users/me/settings")
                    .then((response) => response.ok ? response.json() : fallbackSettings())
                    .catch(() => fallbackSettings());
        }

        return settingsPromise;
    }

    function normalizeTheme(theme) {
        return theme === "dark" ? "dark" : "light";
    }

    function applyTheme(theme) {
        const normalizedTheme = normalizeTheme(theme);
        document.documentElement.dataset.theme = normalizedTheme;
        try {
            localStorage.setItem(themeStorageKey, normalizedTheme);
        } catch {
        }
    }

    function clearUserSettingsCache() {
        settingsPromise = null;
    }

    function initializeMobileNavigation() {
        const menuToggle = document.querySelector(".menu-toggle");
        const topbarActions = document.querySelector(".topbar-actions");
        const mainMenu = document.querySelector("#main-menu");

        if (!menuToggle || !topbarActions || !mainMenu) {
            return;
        }

        const openLabel = menuToggle.querySelector(".menu-toggle-open-label");
        const closeLabel = menuToggle.querySelector(".menu-toggle-close-label");

        function syncMenuState(isOpen) {
            const nextLabel = (isOpen ? closeLabel?.textContent : openLabel?.textContent)?.trim();
            menuToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
            if (nextLabel) {
                menuToggle.setAttribute("aria-label", nextLabel);
            }
            topbarActions.classList.toggle("is-open", isOpen);
            document.body.classList.toggle("menu-open", isOpen);
        }

        menuToggle.addEventListener("click", () => {
            const isOpen = menuToggle.getAttribute("aria-expanded") !== "true";
            syncMenuState(isOpen);
        });

        mainMenu.addEventListener("click", (event) => {
            if (window.matchMedia("(max-width: 1024px)").matches && event.target instanceof HTMLAnchorElement) {
                syncMenuState(false);
            }
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") {
                syncMenuState(false);
                menuToggle.focus();
            }
        });

        window.addEventListener("resize", () => {
            if (!window.matchMedia("(max-width: 1024px)").matches) {
                syncMenuState(false);
            }
        });

        const labelObserver = new MutationObserver(() => {
            syncMenuState(menuToggle.getAttribute("aria-expanded") === "true");
        });
        if (openLabel) {
            labelObserver.observe(openLabel, {childList: true, characterData: true, subtree: true});
        }
        if (closeLabel) {
            labelObserver.observe(closeLabel, {childList: true, characterData: true, subtree: true});
        }

        syncMenuState(false);
    }

    function pad(value) {
        return String(value).padStart(2, "0");
    }

    function localIsoDate(date = new Date()) {
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }

    function formatDateWithPattern(value, pattern, includeTime) {
        if (!value) {
            return "-";
        }
        const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
        if (Number.isNaN(date.getTime())) {
            return value;
        }

        const dateParts = {
            Y: date.getFullYear(),
            m: pad(date.getMonth() + 1),
            d: pad(date.getDate())
        };
        const timeParts = {
            H: pad(date.getHours()),
            m: pad(date.getMinutes()),
            s: pad(date.getSeconds())
        };
        const [datePattern, timePattern = ""] = pattern.split(" ");
        let result = datePattern.replace(/[Ymd]/g, (token) => dateParts[token] ?? token);
        if (includeTime && timePattern) {
            result += ` ${timePattern.replace(/[Hms]/g, (token) => timeParts[token] ?? token)}`;
        }

        return result;
    }

    async function formatDate(value) {
        const settings = await loadUserSettings();
        return formatDateValue(value, settings);
    }

    async function formatDateTime(value) {
        const settings = await loadUserSettings();
        return formatDateTimeValue(value, settings);
    }

    function formatDateValue(value, settings) {
        settings = settings || defaultSettings;
        return formatDateWithPattern(value, settings.dateTimeFormat, false);
    }

    function formatDateTimeValue(value, settings) {
        settings = settings || defaultSettings;
        return formatDateWithPattern(value, settings.dateTimeFormat, true);
    }

    function formatMoneyValue(value, settings) {
        settings = settings || defaultSettings;
        const mask = settings.moneyFormat || defaultSettings.moneyFormat;
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) {
            return "-";
        }
        const suffix = mask.replace(/[#,.\s0]+/g, "").trim();
        const hasDecimalComma = mask.includes(",");
        const decimalSeparator = hasDecimalComma ? "," : ".";
        const groupSeparator = mask.includes(" ") ? " " : ",";
        const fractionDigits = hasDecimalComma ? mask.split(",").at(-1).replace(/[^0]/g, "").length : 2;
        const sign = numericValue < 0 ? "-" : "";
        const fixed = Math.abs(numericValue).toFixed(fractionDigits);
        const [integerPart, fractionPart] = fixed.split(".");
        const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, groupSeparator);
        const formatted = `${sign}${groupedInteger}${fractionDigits > 0 ? decimalSeparator + fractionPart : ""}`;
        return suffix ? `${formatted} ${suffix}` : formatted;
    }

    async function formatMoney(value) {
        const settings = await loadUserSettings();
        return formatMoneyValue(value, settings);
    }

    document.addEventListener("DOMContentLoaded", () => {
        initializeMobileNavigation();
        loadUserSettings().then((settings) => applyTheme(settings.theme));
    });

    return {
        applyTheme,
        bulkSnapshotSuccessKey,
        clearUserSettingsCache,
        createAddIcon,
        createModal,
        createToastManager,
        createConfirmModal,
        createClearFiltersIcon,
        createEditIcon,
        createInfoIcon,
        safeReturnToPath,
        setTooltip,
        createTrashIcon,
        initializeMobileNavigation,
        formatDate,
        formatDateValue,
        formatDateTime,
        formatDateTimeValue,
        formatMoney,
        formatMoneyValue,
        localIsoDate,
        loadUserSettings
    };
})();
