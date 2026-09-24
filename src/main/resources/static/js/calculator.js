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
        const copyFeedback = calculator.querySelector("[data-calculator-copy-feedback]");
        const closeButton = panel?.querySelector("[data-shortcuts-calculator-close]");
        if (!(button instanceof HTMLElement) || !(panel instanceof HTMLElement) || !(display instanceof HTMLElement)) return;

        let expression = "";
        let justCalculated = false;
        let memoryValue = 0;
        let hasMemory = false;
        let calculatorErrorMessage = "Błąd";
        let copyFeedbackTimer = null;
        const operators = new Set(["+", "-", "*", "/"]);

        function render(value = expression || "0") {
            const formattedValue = value.replace(/\./g, ",");
            display.textContent = formattedValue;
            display.scrollLeft = display.scrollWidth;
        }

        // Keep the final digit visible when the panel opens or its width changes.
        const displayResizeObserver = new ResizeObserver(() => {
            display.scrollLeft = display.scrollWidth;
        });
        displayResizeObserver.observe(display);

        function close() {
            panel.hidden = true;
            button.setAttribute("aria-expanded", "false");
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
                const value = evaluateExpression(expression);
                expression = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(10)));
                justCalculated = true;
                render();
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
            return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(10)));
        }

        function memoryAction(action) {
            if (action === "memory-clear") {
                memoryValue = 0;
                hasMemory = false;
                return;
            }

            if (action === "memory-read") {
                if (hasMemory) {
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
                    render();
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
                    render();
                }

                const valueToCopy = display.textContent ?? "0";
                if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(valueToCopy);
                } else {
                    const copyField = document.createElement("textarea");
                    copyField.value = valueToCopy;
                    copyField.setAttribute("readonly", "");
                    copyField.style.position = "fixed";
                    copyField.style.opacity = "0";
                    document.body.append(copyField);
                    copyField.select();
                    if (!document.execCommand("copy")) throw new Error("Copy failed");
                    copyField.remove();
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
                expression = "";
                justCalculated = false;
                render();
            } else if (key.dataset.calculatorAction === "backspace") {
                backspace();
            } else if (key.dataset.calculatorAction === "equals") calculate();
            else input(key.dataset.calculatorInput);
        });

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
            else if (event.key === "Enter" && document.activeElement instanceof HTMLButtonElement) {
                animateElement(document.activeElement);
            }
            else if ((event.key === "Enter" || event.key === "=")
                && !(document.activeElement instanceof HTMLButtonElement)) {
                animateKey("equals");
                event.preventDefault();
                calculate();
            }
            else if (event.key === "Backspace") {
                animateKey("backspace");
                backspace();
            }
            else if (event.key === ",") {
                animateKey(".");
                input(".");
            }
            else if (/^[0-9.+\-*/()]$/.test(event.key)) {
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
                button.setAttribute("aria-label", label);
                button.setAttribute("title", label);
                button.querySelector("[data-i18n='launcher.calculator.button']").textContent = label;
                const calculatorTitle = messages["launcher.calculator.title"] ?? label;
                panel.querySelector("#shortcuts-calculator-title").textContent = calculatorTitle;
                panel.querySelector("[data-i18n-aria-label='launcher.calculator.title']")?.setAttribute("aria-label", calculatorTitle);
                panel.querySelector("[data-shortcuts-calculator-close]")?.setAttribute("aria-label", messages["common.close"] ?? "Zamknij");
            } catch {
                // Keep the Polish labels from the HTML when translations cannot be loaded.
            }
        });
    });
})();
