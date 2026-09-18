window.MoneySnapshotSelect = (() => {
    const instances = new WeakMap();
    let nextId = 0;

    // Enhance any single-value select with data-custom-select. After changing its
    // value/options programmatically, call create(select).refresh().
    function create(select) {
        if (!select || select.multiple) return null;
        if (instances.has(select)) return instances.get(select);

        const root = document.createElement("div");
        root.className = "custom-select";
        const trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "custom-select-trigger";
        trigger.id = `custom-select-${++nextId}`;
        trigger.setAttribute("role", "combobox");
        trigger.setAttribute("aria-haspopup", "listbox");
        trigger.setAttribute("aria-expanded", "false");
        const list = document.createElement("div");
        list.id = `${trigger.id}-list`;
        list.className = "custom-select-list";
        list.setAttribute("role", "listbox");
        list.hidden = true;
        const usePopover = select.hasAttribute("data-select-popover") && typeof list.showPopover === "function";
        if (usePopover) list.setAttribute("popover", "manual");
        trigger.setAttribute("aria-controls", list.id);
        root.append(trigger, list);
        select.after(root);
        select.hidden = true;
        let activeIndex = -1;
        let search = "";
        let searchTimer;
        // Native validation belongs to this component; aria-invalid on the
        // source select remains owned by the surrounding form/server validation.
        let nativeInvalid = false;

        function close() {
            if (usePopover && list.matches(":popover-open")) list.hidePopover();
            list.hidden = true;
            document.removeEventListener("pointerdown", handleOutsidePointer);
            document.removeEventListener("scroll", handleScroll, true);
            window.removeEventListener("resize", close);
            trigger.setAttribute("aria-expanded", "false");
            trigger.removeAttribute("aria-activedescendant");
        }

        function handleOutsidePointer(event) {
            if (!root.contains(event.target)) close();
        }

        function handleScroll(event) {
            if (!list.contains(event.target)) close();
        }

        function activate(index) {
            activeIndex = index;
            Array.from(list.children).forEach((option, i) => {
                option.classList.toggle("is-active", i === index);
            });
            const active = list.children[index];
            if (active) {
                trigger.setAttribute("aria-activedescendant", active.id);
                active.scrollIntoView({block: "nearest"});
            }
        }

        function enabledIndices() {
            return Array.from(select.options).flatMap((option, i) =>
                option.disabled || option.hidden || option.parentElement.disabled ? [] : [i]);
        }

        function open() {
            if (select.disabled) return;
            list.hidden = false;
            if (usePopover) {
                const bounds = trigger.getBoundingClientRect();
                list.style.minWidth = `${bounds.width}px`;
                list.style.left = `${bounds.left}px`;
                list.style.top = `${bounds.bottom + 8}px`;
                list.showPopover();
                const menuBounds = list.getBoundingClientRect();
                list.style.left = `${Math.max(8, Math.min(bounds.left, window.innerWidth - menuBounds.width - 8))}px`;
                if (bounds.bottom + 8 + menuBounds.height > window.innerHeight) {
                    list.style.top = `${Math.max(8, bounds.top - menuBounds.height - 8)}px`;
                }
                document.addEventListener("scroll", handleScroll, true);
                window.addEventListener("resize", close);
            }
            document.addEventListener("pointerdown", handleOutsidePointer);
            trigger.setAttribute("aria-expanded", "true");
            const indices = enabledIndices();
            activate(indices.includes(select.selectedIndex) ? select.selectedIndex : indices[0]);
        }

        function choose(index) {
            if (!enabledIndices().includes(index)) return;
            const changed = select.selectedIndex !== index;
            select.selectedIndex = index;
            close();
            refresh();
            if (changed) {
                select.dispatchEvent(new Event("input", {bubbles: true}));
                select.dispatchEvent(new Event("change", {bubbles: true}));
            }
        }

        function renderOption(target, option) {
            const content = document.createElement("span");
            content.className = "custom-select-content";
            if (option?.dataset.icon) {
                const icon = document.createElement("img");
                icon.className = "custom-select-icon";
                icon.src = option.dataset.icon;
                icon.alt = "";
                icon.setAttribute("aria-hidden", "true");
                content.append(icon);
            } else if (option?.dataset.iconText) {
                const icon = document.createElement("span");
                icon.className = "custom-select-symbol";
                icon.textContent = option.dataset.iconText;
                icon.setAttribute("aria-hidden", "true");
                content.append(icon);
            }
            content.append(document.createTextNode(option?.textContent ?? ""));
            target.replaceChildren(content);
        }

        function syncValidity() {
            if (select.validity.valid) nativeInvalid = false;
            trigger.setAttribute("aria-required", String(select.required));
            trigger.setAttribute("aria-invalid", nativeInvalid ? "true" : select.getAttribute("aria-invalid") ?? "false");
            const description = select.getAttribute("aria-describedby");
            if (description) {
                trigger.setAttribute("aria-describedby", description);
            } else {
                trigger.removeAttribute("aria-describedby");
            }
        }

        function refresh() {
            close();
            syncValidity();
            renderOption(trigger, select.selectedOptions[0]);
            trigger.disabled = select.disabled;
            const label = select.getAttribute("aria-labelledby");
            if (label) {
                trigger.setAttribute("aria-labelledby", `${label} ${trigger.id}`);
                list.setAttribute("aria-labelledby", label);
            } else {
                const name = select.getAttribute("aria-label") || Array.from(select.labels || []).map(label => label.textContent.trim()).join(" ");
                trigger.setAttribute("aria-label", `${name}: ${select.selectedOptions[0]?.textContent ?? ""}`);
                list.setAttribute("aria-label", name);
            }
            list.replaceChildren();
            Array.from(select.options).forEach((option, index) => {
                const item = document.createElement("div");
                item.id = `${list.id}-${index}`;
                item.className = "custom-select-option";
                renderOption(item, option);
                item.hidden = option.hidden;
                item.setAttribute("role", "option");
                item.setAttribute("aria-selected", String(option.selected));
                item.setAttribute("aria-disabled", String(!enabledIndices().includes(index)));
                item.addEventListener("mousedown", event => event.preventDefault());
                item.addEventListener("click", () => { choose(index); trigger.focus(); });
                list.append(item);
            });
        }

        trigger.addEventListener("click", () => list.hidden ? open() : close());
        trigger.addEventListener("keydown", event => {
            const indices = enabledIndices();
            if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                event.preventDefault();
                if (list.hidden) {
                    open();
                    if (event.key === "ArrowDown" || event.key === "ArrowUp") return;
                }
                const position = indices.indexOf(activeIndex);
                const next = event.key === "Home" ? 0 : event.key === "End" ? indices.length - 1
                    : Math.max(0, Math.min(indices.length - 1, position + (event.key === "ArrowDown" ? 1 : -1)));
                activate(indices[next]);
            } else if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                list.hidden ? open() : choose(activeIndex);
            } else if (event.key === "Escape" && !list.hidden) {
                event.preventDefault();
                event.stopPropagation();
                close();
            } else if (event.key === "Tab") {
                close();
            } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
                event.preventDefault();
                if (list.hidden) open();
                clearTimeout(searchTimer);
                search += event.key.toLocaleLowerCase();
                const match = indices.find(i => select.options[i].textContent.trim().toLocaleLowerCase().startsWith(search));
                if (match !== undefined) activate(match);
                searchTimer = setTimeout(() => { search = ""; }, 700);
            }
        });
        root.addEventListener("focusout", event => { if (!root.contains(event.relatedTarget)) close(); });
        select.addEventListener("change", refresh);
        select.addEventListener("invalid", (event) => {
            event.preventDefault();
            nativeInvalid = true;
            syncValidity();
            trigger.focus();
        });
        new MutationObserver(syncValidity).observe(select, {
            attributes: true,
            attributeFilter: ["aria-invalid", "aria-describedby", "required"]
        });
        select.form?.addEventListener("reset", (event) => setTimeout(() => {
            if (event.defaultPrevented) return;
            nativeInvalid = false;
            refresh();
        }, 0));
        const instance = {refresh, focus: (options) => trigger.focus(options)};
        instances.set(select, instance);
        refresh();
        return instance;
    }

    document.querySelectorAll("select[data-custom-select]").forEach(create);
    return {create};
})();
