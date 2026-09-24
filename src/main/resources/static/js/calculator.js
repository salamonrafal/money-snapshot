(() => {
    const roots = document.querySelectorAll("[data-shortcuts-calculator]");

    function evaluateExpression(expression) {
        const source = expression.replace(/,/g, ".").replace(/\s+/g, "");
        let position = 0;

        function peek() {
            return source[position];
        }

        function consume(character) {
            if (peek() === character) {
                position += 1;
                return true;
            }
            return false;
        }

        function parseNumber() {
            const match = source.slice(position).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
            if (!match) throw new Error("Invalid number");
            position += match[0].length;
            return Number(match[0]);
        }

        function parsePrimary() {
            if (consume("(")) {
                const value = parseAdditive();
                if (!consume(")")) throw new Error("Missing parenthesis");
                return value;
            }
            return parseNumber();
        }

        function parseUnary() {
            if (consume("+")) return parseUnary();
            if (consume("-")) return -parseUnary();
            return parsePrimary();
        }

        function parseMultiplicative() {
            let value = parseUnary();
            while (peek() === "*" || peek() === "/") {
                const operator = source[position++];
                const right = parseUnary();
                if (operator === "/" && right === 0) throw new Error("Division by zero");
                value = operator === "*" ? value * right : value / right;
            }
            return value;
        }

        function parseAdditive() {
            let value = parseMultiplicative();
            while (peek() === "+" || peek() === "-") {
                const operator = source[position++];
                const right = parseMultiplicative();
                value = operator === "+" ? value + right : value - right;
            }
            return value;
        }

        if (!source) throw new Error("Empty expression");
        const value = parseAdditive();
        if (position !== source.length || !Number.isFinite(value)) throw new Error("Invalid expression");
        return value;
    }

    roots.forEach((calculator) => {
        const root = calculator.closest(".shortcuts-calculator-panel");
        const button = root?.querySelector("[data-shortcuts-calculator-button]")
            ?? document.querySelector("[data-shortcuts-calculator-button]");
        const panel = root ?? document.querySelector("[data-shortcuts-calculator-panel]");
        const display = calculator.querySelector("[data-calculator-display]");
        const displayInfo = calculator.querySelector("[data-calculator-display-info]");
        const copyFeedback = calculator.querySelector("[data-calculator-copy-feedback]");
        const currencyToggle = calculator.querySelector("[data-calculator-currency-toggle]");
        const currencyTools = calculator.querySelector("[data-calculator-currency-tools]");
        const currencyFromSelect = calculator.querySelector("[data-calculator-currency-from]");
        const currencyToSelect = calculator.querySelector("[data-calculator-currency-to]");
        const currencySwapButton = calculator.querySelector("[data-calculator-currency-swap]");
        const currencyConvertButton = calculator.querySelector("[data-calculator-currency-convert]");
        const currencyCloseButton = calculator.querySelector("[data-calculator-currency-close]");
        const currencyHelpButton = calculator.querySelector("[data-calculator-currency-help]");
        const currencyRatesPanel = calculator.querySelector("[data-calculator-currency-rates]");
        const currencyRatesBody = calculator.querySelector("[data-calculator-currency-rates-body]");
        const currencyRatesDate = calculator.querySelector("[data-calculator-currency-rates-date]");
        const currencyRatesCloseButton = calculator.querySelector("[data-calculator-currency-rates-close]");
        const currencyMessage = calculator.querySelector("[data-calculator-currency-message]");
        const closeButton = panel?.querySelector("[data-shortcuts-calculator-close]");
        if (!(button instanceof HTMLElement) || !(panel instanceof HTMLElement) || !(display instanceof HTMLElement)) return;

        if (panel.parentElement !== document.body) {
            document.body.append(panel);
        }

        let expression = "";
        let justCalculated = false;
        let memoryValue = 0;
        let hasMemory = false;
        let calculatorErrorMessage = "Błąd";
        let copyFeedbackTimer = null;
        let currencyRates = new Map();
        let currencyRatesEffectiveDate = "";
        let currencyRatesFetchedAt = 0;
        let currencySettings = null;
        let currencyLoadingPromise = null;
        let convertedCurrency = "";
        let conversionInfo = "";
        let conversionSourceAmount = null;
        let conversionSourceCode = "";
        let currencyLoadingMessage = "Ładowanie kursów walut...";
        let currencyErrorMessage = "Nie udało się pobrać kursów walut.";
        let currencySameMessage = "Wybierz różne waluty.";
        let currencyFromLabel = "Waluta podanej kwoty";
        let currencyToLabel = "Waluta docelowa";
        let currencySwapLabel = "Zamień waluty";
        let currencyConvertLabel = "Przelicz";
        let currencyRatesHelpLabel = "Pokaż kursy walut";
        let currencyRatesCloseLabel = "Zamknij kursy walut";
        let currencyRatesDateLabel = "Data kursu";
        // Kept separate so this can be replaced with a user setting later.
        let currencyDecimalPlaces = 2;
        const currencyRatesCacheDurationMs = 15 * 60 * 1000;
        const operators = new Set(["+", "-", "*", "/"]);

        function render(value = expression || "0") {
            const formattedValue = value.replace(/\./g, ",");
            display.textContent = convertedCurrency ? `${formattedValue} ${convertedCurrency}` : formattedValue;
            if (displayInfo instanceof HTMLElement) {
                displayInfo.textContent = conversionInfo;
                displayInfo.hidden = !conversionInfo;
            }
            display.scrollLeft = display.scrollWidth;
        }

        function clearConvertedCurrency() {
            convertedCurrency = "";
            conversionInfo = "";
            conversionSourceAmount = null;
            conversionSourceCode = "";
            if (displayInfo instanceof HTMLElement) {
                displayInfo.textContent = "";
                displayInfo.hidden = true;
            }
        }

        // Keep the final digit visible when the panel opens or its width changes.
        const displayResizeObserver = new ResizeObserver(() => {
            display.scrollLeft = display.scrollWidth;
        });
        displayResizeObserver.observe(display);

        function close() {
            panel.hidden = true;
            button.setAttribute("aria-expanded", "false");
            button.dataset.suppressTooltipOnFocusOnce = "true";
            button.focus();
        }

        function open() {
            document.querySelectorAll("[data-shortcuts-events-panel]").forEach((eventsPanel) => {
                eventsPanel.hidden = true;
                eventsPanel.closest(".shortcuts-events-anchor")?.querySelector("[data-shortcuts-events-button]")?.setAttribute("aria-expanded", "false");
            });
            document.querySelectorAll("[data-shortcuts-calculator-panel]").forEach((otherPanel) => {
                if (otherPanel !== panel) otherPanel.hidden = true;
            });
            panel.hidden = false;
            button.setAttribute("aria-expanded", "true");
            calculator.focus();
        }

        function input(value) {
            if (justCalculated && !operators.has(value)) expression = "";
            clearConvertedCurrency();
            justCalculated = false;
            const currentOperand = expression.match(/[^+\-*/()]*$/)?.[0] ?? "";
            if (value === "." && currentOperand.includes(".")) return;
            if (operators.has(value) && (!expression && value !== "-" || /[+\-*/.]$/.test(expression))) {
                if (value === "-" && /[+\-*/]$/.test(expression)) expression += value;
                else if (expression) expression = expression.slice(0, -1) + value;
                render();
                return;
            }
            expression += value;
            render();
        }

        function backspace() {
            clearConvertedCurrency();
            expression = expression.slice(0, -1);
            justCalculated = false;
            render();
        }

        function animateElement(key) {
            if (!(key instanceof HTMLElement)) return;
            key.classList.remove("is-keyboard-pressed");
            window.requestAnimationFrame(() => {
                key.classList.add("is-keyboard-pressed");
                window.setTimeout(() => key.classList.remove("is-keyboard-pressed"), 140);
            });
        }

        function animateKey(value) {
            const key = [...calculator.querySelectorAll("[data-calculator-input], [data-calculator-action]")]
                .find((element) => element.dataset.calculatorInput === value
                    || (value === "equals" && element.dataset.calculatorAction === "equals")
                    || (value === "backspace" && element.dataset.calculatorAction === "backspace"));
            animateElement(key);
        }

        function calculate() {
            try {
                clearConvertedCurrency();
                const value = evaluateExpression(expression);
                expression = String(value);
                justCalculated = true;
                render(formatDisplayValue(value));
            } catch {
                display.textContent = calculatorErrorMessage;
                expression = "";
                justCalculated = true;
            }
        }

        function currentValue() {
            if (expression) return evaluateExpression(expression);
            const value = Number(display.textContent.replace(/,/g, "."));
            if (!Number.isFinite(value)) throw new Error("Invalid value");
            return value;
        }

        function formatValue(value) {
            return String(value);
        }

        function formatDisplayValue(value) {
            if (Number.isInteger(value)) return String(value);
            const rounded = Number(value.toFixed(10));
            return rounded === 0 && value !== 0 ? String(value) : String(rounded);
        }

        function formatCurrencyValue(value) {
            return Number(value.toFixed(currencyDecimalPlaces));
        }

        function formatRateValue(value, decimalPlaces = 4) {
            if (!Number.isFinite(value)) return "";
            return value.toFixed(decimalPlaces).replace(/\.?0+$/, "");
        }

        function setCurrencyMessage(message = "") {
            if (!(currencyMessage instanceof HTMLElement)) return;
            currencyMessage.textContent = message;
            currencyMessage.hidden = !message;
        }

        function refreshCurrencySelects() {
            if (!(currencyFromSelect instanceof HTMLSelectElement)
                || !(currencyToSelect instanceof HTMLSelectElement)) return;

            let fromValue = currencyFromSelect.value;
            let toValue = currencyToSelect.value;
            if (fromValue === toValue) {
                const alternative = Array.from(currencyToSelect.options).find((option) => option.value !== fromValue);
                if (alternative) {
                    currencyToSelect.value = alternative.value;
                    toValue = alternative.value;
                }
            }
            Array.from(currencyFromSelect.options).forEach((option) => {
                option.disabled = option.value === toValue;
            });
            Array.from(currencyToSelect.options).forEach((option) => {
                option.disabled = option.value === fromValue;
            });
            MoneySnapshotSelect.create(currencyFromSelect)?.refresh();
            MoneySnapshotSelect.create(currencyToSelect)?.refresh();
            const fromTrigger = currencyFromSelect.nextElementSibling?.querySelector(".custom-select-trigger");
            const toTrigger = currencyToSelect.nextElementSibling?.querySelector(".custom-select-trigger");
            MoneySnapshotUi.setTooltip(fromTrigger, currencyFromLabel);
            MoneySnapshotUi.setTooltip(toTrigger, currencyToLabel);
            MoneySnapshotUi.setTooltip(currencySwapButton, currencySwapLabel);
            MoneySnapshotUi.setTooltip(currencyConvertButton, currencyConvertLabel);
            MoneySnapshotUi.setTooltip(currencyHelpButton, currencyRatesHelpLabel);
            MoneySnapshotUi.setTooltip(currencyRatesCloseButton, currencyRatesCloseLabel);
        }

        function renderCurrencyRatesTable() {
            if (!(currencyRatesBody instanceof HTMLElement)) return;
            currencyRatesBody.replaceChildren();
            currencyRates.forEach((rate) => {
                const row = document.createElement("tr");
                [
                    rate.code,
                    rate.name,
                    formatRateValue(Number(rate.rateToPln)).replace(".", ",")
                ].forEach((value) => {
                    const cell = document.createElement("td");
                    cell.textContent = value;
                    row.append(cell);
                });
                currencyRatesBody.append(row);
            });
            if (currencyRatesDate instanceof HTMLElement) {
                currencyRatesDate.textContent = currencyRatesEffectiveDate
                    ? `${currencyRatesDateLabel}: ${currencyRatesEffectiveDate}`
                    : "";
            }
        }

        function renderCurrencyOptions() {
            if (!(currencyFromSelect instanceof HTMLSelectElement)
                || !(currencyToSelect instanceof HTMLSelectElement)) return;

            const options = [...currencyRates.values()];
            const previousFrom = currencyFromSelect.value;
            const previousTo = currencyToSelect.value;
            const preferredFrom = currencySettings?.defaultCurrency;
            const fromCode = currencyRates.has(previousFrom)
                ? previousFrom
                : currencyRates.has(preferredFrom) ? preferredFrom : "PLN";
            const toCode = currencyRates.has(previousTo) && previousTo !== fromCode
                ? previousTo
                : options.find((rate) => rate.code !== fromCode)?.code ?? "";
            const createOptions = (select) => {
                select.replaceChildren(...options.map((rate) => {
                    const option = document.createElement("option");
                    option.value = rate.code;
                    option.textContent = rate.code;
                    return option;
                }));
            };
            createOptions(currencyFromSelect);
            createOptions(currencyToSelect);
            currencyFromSelect.value = fromCode;
            currencyToSelect.value = toCode;
            refreshCurrencySelects();
        }

        function focusCurrencySelect(select) {
            const trigger = select?.nextElementSibling?.querySelector(".custom-select-trigger");
            if (trigger instanceof HTMLElement) {
                window.requestAnimationFrame(() => trigger.focus({preventScroll: true}));
            }
        }

        async function loadCurrencyRates() {
            if (currencyRates.size > 0
                && Date.now() - currencyRatesFetchedAt < currencyRatesCacheDurationMs) return true;
            if (currencyLoadingPromise) return currencyLoadingPromise;

            currencyLoadingPromise = Promise.all([
                MoneySnapshotUi.loadUserSettings(),
                fetch("/api/currency-rates")
            ]).then(async ([settings, response]) => {
                if (!response.ok) throw new Error("Cannot load currency rates.");
                const payload = await response.json();
                currencySettings = settings;
                currencyRatesEffectiveDate = payload.effectiveDate ?? "";
                currencyRates = new Map((payload.rates ?? [])
                    .filter((rate) => ["PLN", "EUR", "USD"].includes(rate.code))
                    .map((rate) => [rate.code, rate]));
                currencyRatesFetchedAt = Date.now();
                renderCurrencyOptions();
                renderCurrencyRatesTable();
                setCurrencyMessage();
                return true;
            }).catch(() => {
                setCurrencyMessage(currencyErrorMessage);
                return false;
            }).finally(() => {
                currencyLoadingPromise = null;
            });
            return currencyLoadingPromise;
        }

        async function convertCurrency() {
            if (!(currencyFromSelect instanceof HTMLSelectElement)
                || !(currencyToSelect instanceof HTMLSelectElement)) return;
            if (!await loadCurrencyRates()) return;
            if (currencyFromSelect.value === currencyToSelect.value) {
                setCurrencyMessage(currencySameMessage);
                return;
            }

            try {
                const sourceCode = currencyFromSelect.value;
                const value = conversionSourceCode === sourceCode
                    && Number.isFinite(conversionSourceAmount)
                    ? conversionSourceAmount
                    : currentValue();
                const fromRate = currencyRates.get(currencyFromSelect.value)?.rateToPln;
                const toRate = currencyRates.get(currencyToSelect.value)?.rateToPln;
                if (!Number.isFinite(value) || !Number.isFinite(Number(fromRate)) || !Number.isFinite(Number(toRate))) {
                    throw new Error("Invalid currency conversion.");
                }
                const convertedValue = formatCurrencyValue(value * Number(fromRate) / Number(toRate));
                conversionSourceAmount = value;
                conversionSourceCode = sourceCode;
                expression = formatValue(convertedValue);
                justCalculated = true;
                convertedCurrency = currencyToSelect.value;
                const conversionRate = Number(fromRate) / Number(toRate);
                conversionInfo = `1 ${currencyFromSelect.value} = ${formatRateValue(conversionRate, 8).replace(".", ",")} ${currencyToSelect.value}`;
                render(formatDisplayValue(convertedValue));
                setCurrencyMessage();
            } catch {
                setCurrencyMessage("Wprowadź poprawną wartość do przeliczenia.");
            }
        }

        function swapCurrencies() {
            if (!(currencyFromSelect instanceof HTMLSelectElement)
                || !(currencyToSelect instanceof HTMLSelectElement)) return;
            const fromValue = currencyFromSelect.value;
            currencyFromSelect.value = currencyToSelect.value;
            currencyToSelect.value = fromValue;
            refreshCurrencySelects();
            currencySwapButton?.focus({preventScroll: true});
        }

        function memoryAction(action) {
            if (action === "memory-clear") {
                memoryValue = 0;
                hasMemory = false;
                return;
            }

            if (action === "memory-read") {
                if (hasMemory) {
                    clearConvertedCurrency();
                    const storedValue = formatValue(memoryValue);
                    if (expression && !justCalculated) {
                        const operandMatch = expression.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/);
                        if (operandMatch) {
                            let operandStart = operandMatch.index;
                            const signIndex = operandStart - 1;
                            if (expression[signIndex] === "-"
                                && (signIndex === 0 || "+-*/(".includes(expression[signIndex - 1]))) {
                                operandStart = signIndex;
                            }
                            expression = expression.slice(0, operandStart) + storedValue;
                            render();
                        } else {
                            input(storedValue);
                        }
                    } else {
                        expression = storedValue;
                        justCalculated = false;
                        render();
                    }
                }
                return;
            }

            try {
                const value = currentValue();
                memoryValue = action === "memory-subtract" ? memoryValue - value : memoryValue + value;
                hasMemory = true;
                if (expression && !justCalculated) {
                    expression = formatValue(value);
                    render(formatDisplayValue(value));
                }
                justCalculated = true;
            } catch {
                // Ignore memory updates for an invalid expression.
            }
        }

        function showCopyFeedback() {
            if (!(copyFeedback instanceof HTMLElement)) return;
            window.clearTimeout(copyFeedbackTimer);
            display.classList.add("is-copying");
            copyFeedback.hidden = false;
            copyFeedback.classList.remove("is-visible");
            window.requestAnimationFrame(() => copyFeedback.classList.add("is-visible"));
            copyFeedbackTimer = window.setTimeout(() => {
                copyFeedback.classList.remove("is-visible");
                display.classList.remove("is-copying");
                window.setTimeout(() => {
                    copyFeedback.hidden = true;
                }, 220);
            }, 900);
        }

        async function copyResult() {
            try {
                if (expression && !justCalculated) {
                    const value = evaluateExpression(expression);
                    expression = formatValue(value);
                    justCalculated = true;
                    render(formatDisplayValue(value));
                }

                const displayValue = display.textContent?.trim() || "0";
                const valueToCopy = convertedCurrency
                    ? formatDisplayValue(Number(expression)).replace(/\./g, ",")
                    : displayValue;
                if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(valueToCopy);
                } else {
                    const previousFocus = document.activeElement instanceof HTMLElement
                        ? document.activeElement
                        : calculator;
                    let copyField = null;
                    try {
                        copyField = document.createElement("textarea");
                        copyField.value = valueToCopy;
                        copyField.setAttribute("readonly", "");
                        copyField.style.position = "fixed";
                        copyField.style.opacity = "0";
                        document.body.append(copyField);
                        copyField.select();
                        if (!document.execCommand("copy")) throw new Error("Copy failed");
                    } finally {
                        copyField?.remove();
                        previousFocus.focus({preventScroll: true});
                    }
                }
                showCopyFeedback();
            } catch {
                // Do not show success feedback when the expression or clipboard is unavailable.
            }
        }

        calculator.addEventListener("click", (event) => {
            const key = event.target.closest("[data-calculator-input], [data-calculator-action]");
            if (!(key instanceof HTMLElement)) return;
            if (key.dataset.calculatorAction?.startsWith("memory-")) {
                memoryAction(key.dataset.calculatorAction);
            } else if (key.dataset.calculatorAction === "clear") {
                clearConvertedCurrency();
                expression = "";
                justCalculated = false;
                render();
            } else if (key.dataset.calculatorAction === "backspace") {
                backspace();
            } else if (key.dataset.calculatorAction === "equals") calculate();
            else input(key.dataset.calculatorInput);
        });

        function setCurrencyToolsOpen(isOpen) {
            if (!(currencyTools instanceof HTMLElement)) return;
            currencyTools.hidden = !isOpen;
            calculator.classList.toggle("is-currency-tools-open", isOpen);
            currencyToggle?.toggleAttribute("hidden", isOpen);
            currencyToggle?.setAttribute("aria-expanded", String(isOpen));
            if (!isOpen && currencyRatesPanel instanceof HTMLElement) {
                currencyRatesPanel.hidden = true;
                currencyHelpButton?.setAttribute("aria-expanded", "false");
            }
            if (isOpen) {
                loadCurrencyRates();
                // Keep keyboard input on the calculator after expanding the currency tools.
                // The selects remain available by mouse click or normal Tab navigation.
                calculator.focus({preventScroll: true});
            } else {
                currencyToggle?.focus({preventScroll: true});
            }
        }

        currencyToggle?.addEventListener("click", () => setCurrencyToolsOpen(true));
        currencyCloseButton?.addEventListener("click", () => setCurrencyToolsOpen(false));
        currencyHelpButton?.addEventListener("click", () => {
            if (!(currencyRatesPanel instanceof HTMLElement)) return;
            const isOpen = currencyRatesPanel.hidden;
            currencyRatesPanel.hidden = !isOpen;
            currencyHelpButton.setAttribute("aria-expanded", String(isOpen));
            if (isOpen) {
                loadCurrencyRates();
                renderCurrencyRatesTable();
                currencyRatesCloseButton?.setAttribute("data-suppress-tooltip-on-focus-once", "true");
                currencyRatesCloseButton?.focus({preventScroll: true});
                MoneySnapshotUi.dismissTooltip();
            } else {
                currencyHelpButton.focus({preventScroll: true});
            }
        });
        currencyRatesCloseButton?.addEventListener("click", () => {
            if (!(currencyRatesPanel instanceof HTMLElement)) return;
            currencyRatesPanel.hidden = true;
            currencyHelpButton?.setAttribute("aria-expanded", "false");
            currencyHelpButton?.focus({preventScroll: true});
        });
        currencyRatesPanel?.addEventListener("keydown", (event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            currencyRatesPanel.hidden = true;
            currencyHelpButton?.setAttribute("aria-expanded", "false");
            currencyHelpButton?.focus({preventScroll: true});
        });
        currencyFromSelect?.addEventListener("change", () => {
            if (convertedCurrency) {
                clearConvertedCurrency();
                render();
            }
            refreshCurrencySelects();
            focusCurrencySelect(currencyFromSelect);
        });
        currencyToSelect?.addEventListener("change", () => {
            refreshCurrencySelects();
            focusCurrencySelect(currencyToSelect);
        });
        currencySwapButton?.addEventListener("click", swapCurrencies);
        currencyConvertButton?.addEventListener("click", convertCurrency);

        button.addEventListener("click", () => {
            if (panel.hidden) {
                open();
            } else if (!calculator.contains(document.activeElement)) {
                calculator.focus();
            }
        });
        closeButton?.addEventListener("click", close);
        panel.addEventListener("pointerdown", (event) => {
            if (event.target instanceof Element && !event.target.closest("button")) {
                event.preventDefault();
                if (!calculator.contains(document.activeElement)) {
                    calculator.focus();
                }
            }
        });
        panel.addEventListener("click", (event) => {
            if (event.target instanceof Element
                && !event.target.closest("button")
                && !calculator.contains(document.activeElement)) {
                calculator.focus();
            }
        });
        document.addEventListener("click", (event) => {
            if (!panel.hidden && event.target instanceof Element
                && !event.target.closest("[data-shortcuts-calculator-panel], [data-shortcuts-calculator-button]")) {
                if (calculator.contains(document.activeElement)) {
                    document.activeElement.blur();
                }
            }
        });
        document.addEventListener("keydown", (event) => {
            if (panel.hidden) return;
            if (!(document.activeElement instanceof Element) || !calculator.contains(document.activeElement)) return;
            if (event.key === "Escape") close();
            else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
                event.preventDefault();
                copyResult();
            }
            else if (event.ctrlKey || event.metaKey || event.altKey) {
                return;
            }
            else if (event.key === "Enter" && document.activeElement instanceof HTMLButtonElement) {
                animateElement(document.activeElement);
            }
            else if (event.key === "=") {
                animateKey("equals");
                event.preventDefault();
                calculate();
            }
            else if (event.key === "Enter") {
                animateKey("equals");
                event.preventDefault();
                calculate();
            }
            else if (event.key === "Backspace") {
                event.preventDefault();
                animateKey("backspace");
                backspace();
            }
            else if (event.key === ",") {
                event.preventDefault();
                animateKey(".");
                input(".");
            }
            else if (/^[0-9.+\-*/()]$/.test(event.key)) {
                event.preventDefault();
                animateKey(event.key);
                input(event.key);
            }
        });

        document.addEventListener("money-snapshot:i18n-language-change", async (event) => {
            const language = typeof event.detail?.language === "string" ? event.detail.language : "pl";
            try {
                const response = await fetch(`/api/calendar/messages?lang=${encodeURIComponent(language)}`);
                if (!response.ok) return;
                const messages = await response.json();
                const label = messages["launcher.calculator.button"] ?? "Kalkulator";
                calculatorErrorMessage = messages["launcher.calculator.error"] ?? "Błąd";
                currencyLoadingMessage = messages["launcher.calculator.currencyLoading"] ?? currencyLoadingMessage;
                currencyErrorMessage = messages["launcher.calculator.currencyError"] ?? currencyErrorMessage;
                currencySameMessage = messages["launcher.calculator.currencySame"] ?? currencySameMessage;
                currencyFromLabel = messages["launcher.calculator.currencyFrom"] ?? currencyFromLabel;
                currencyToLabel = messages["launcher.calculator.currencyTo"] ?? currencyToLabel;
                currencySwapLabel = messages["launcher.calculator.currencySwap"] ?? currencySwapLabel;
                currencyConvertLabel = messages["launcher.calculator.currencyConvert"] ?? currencyConvertLabel;
                currencyRatesHelpLabel = messages["launcher.calculator.currencyRatesHelp"] ?? currencyRatesHelpLabel;
                currencyRatesCloseLabel = messages["launcher.calculator.currencyRatesClose"] ?? currencyRatesCloseLabel;
                currencyRatesDateLabel = messages["launcher.calculator.currencyRatesDate"] ?? currencyRatesDateLabel;
                const currencyTitle = panel.querySelector(".shortcuts-calculator-currency-title");
                if (currencyTitle instanceof HTMLElement) {
                    currencyTitle.textContent = messages["launcher.calculator.currencyTitle"] ?? "Przeliczanie walut";
                }
                if (currencyToggle instanceof HTMLElement) {
                    currencyToggle.textContent = messages["launcher.calculator.currencyToggle"] ?? "Przeliczanie walut";
                    currencyToggle.setAttribute("aria-label", messages["launcher.calculator.currencyToggle"] ?? "Przeliczanie walut");
                }
                panel.querySelector("[data-calculator-currency-from]")?.setAttribute("aria-label", currencyFromLabel);
                panel.querySelector("[data-calculator-currency-to]")?.setAttribute("aria-label", currencyToLabel);
                if (currencyConvertButton instanceof HTMLElement) {
                    currencyConvertButton.setAttribute("aria-label", currencyConvertLabel);
                    currencyConvertButton.querySelector("[data-i18n='launcher.calculator.currencyConvert']").textContent = currencyConvertLabel;
                }
                MoneySnapshotUi.setTooltip(currencySwapButton, currencySwapLabel);
                currencySwapButton?.setAttribute("aria-label", currencySwapLabel);
                refreshCurrencySelects();
                button.setAttribute("aria-label", label);
                MoneySnapshotUi.setTooltip(button, label);
                button.querySelector("[data-i18n='launcher.calculator.button']").textContent = label;
                const calculatorTitle = messages["launcher.calculator.title"] ?? label;
                panel.querySelector("#shortcuts-calculator-title").textContent = calculatorTitle;
                panel.querySelector("[data-i18n-aria-label='launcher.calculator.title']")?.setAttribute("aria-label", calculatorTitle);
                panel.querySelector("[data-shortcuts-calculator-close]")?.setAttribute("aria-label", messages["common.close"] ?? "Zamknij");
                const controlMessageKeys = {
                    "memory-read": "launcher.calculator.memoryRecall",
                    "memory-clear": "launcher.calculator.memoryClear",
                    "memory-add": "launcher.calculator.memoryAdd",
                    "memory-subtract": "launcher.calculator.memorySubtract",
                    backspace: "launcher.calculator.backspace"
                };
                Object.entries(controlMessageKeys).forEach(([action, messageKey]) => {
                    const control = calculator.querySelector(`[data-calculator-action='${action}']`);
                    const controlLabel = messages[messageKey];
                    if (!(control instanceof HTMLElement) || !controlLabel) return;
                    MoneySnapshotUi.setTooltip(control, controlLabel);
                    if (action === "backspace") control.setAttribute("aria-label", controlLabel);
                });
            } catch {
                // Keep the Polish labels from the HTML when translations cannot be loaded.
            }
        });
    });
})();
