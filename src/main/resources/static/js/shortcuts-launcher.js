(() => {
    const topbarElement = document.querySelector(".topbar");
    const roots = document.querySelectorAll("[data-shortcuts-launcher]");

    if (roots.length === 0) {
        return;
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

        if (!(button instanceof HTMLElement) || !(panel instanceof HTMLElement)) {
            return;
        }

        let lastTrigger = null;
        let inertedElements = [];
        let scrollTop = 0;
        const focusableSelector = "[autofocus], button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

        function isOpen() {
            return !panel.hidden && panel.classList.contains("is-open");
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
            updateLauncherOffset();
            scrollTop = window.scrollY || window.pageYOffset || 0;
            lockTargets();
            const topbarHeight = topbarElement instanceof HTMLElement
                ? Math.round(topbarElement.getBoundingClientRect().height)
                : 0;
            document.body.style.setProperty("--shortcuts-launcher-scroll-top", `${scrollTop}px`);
            document.body.style.setProperty("--topbar-lock-height", `${topbarHeight}px`);
            document.documentElement.classList.add("shortcuts-launcher-scroll-locked");
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

        function close() {
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
            if (focusTarget instanceof HTMLElement) {
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

        panel.addEventListener("click", (event) => {
            if (event.target === panel) {
                close();
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

        document.addEventListener("keydown", (event) => {
            if (!isOpen()) {
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
    });

    updateLauncherOffset();
    window.addEventListener("resize", updateLauncherOffset);
})();
