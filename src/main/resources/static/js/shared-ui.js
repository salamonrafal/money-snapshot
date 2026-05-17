window.MoneySnapshotUi = (() => {
    const defaultSettings = {
        defaultCurrency: "PLN",
        dateTimeFormat: "Y-m-d H:m",
        moneyFormat: "### ###,00 zł",
        values: {
            defaultCurrency: "PLN",
            dateTimeFormat: "Y-m-d H:m",
            moneyFormat: "### ###,00 zł"
        }
    };
    let settingsPromise = null;

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

    function createConfirmModal({modalSelector, subjectSelector, confirmSelector, cancelSelector}) {
        const modal = document.querySelector(modalSelector);
        const subject = document.querySelector(subjectSelector);
        const confirmButton = document.querySelector(confirmSelector);
        const cancelButton = document.querySelector(cancelSelector);
        let selectedItem = null;

        function open(item, subjectText) {
            selectedItem = item;
            subject.textContent = subjectText;
            modal.hidden = false;
            confirmButton.focus();
        }

        function close() {
            selectedItem = null;
            modal.hidden = true;
        }

        cancelButton.addEventListener("click", close);

        modal.addEventListener("click", (event) => {
            if (event.target === modal) {
                close();
            }
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && !modal.hidden) {
                close();
            }
        });

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
                    .then((response) => response.ok ? response.json() : defaultSettings)
                    .catch(() => defaultSettings);
        }

        return settingsPromise;
    }

    function clearUserSettingsCache() {
        settingsPromise = null;
    }

    function pad(value) {
        return String(value).padStart(2, "0");
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

    return {
        clearUserSettingsCache,
        createConfirmModal,
        createEditIcon,
        createTrashIcon,
        formatDate,
        formatDateValue,
        formatDateTime,
        formatDateTimeValue,
        formatMoney,
        formatMoneyValue,
        loadUserSettings
    };
})();
