window.MoneySnapshotSlider = (() => {
    function create(rootElement) {
        if (!rootElement) {
            return null;
        }

        const trackElement = rootElement.querySelector(".summary-slider-track");
        const slides = [...rootElement.querySelectorAll("[data-summary-slide]")];
        const dots = [...rootElement.querySelectorAll("[data-summary-slide-to]")];
        const previousButton = rootElement.querySelector("[data-summary-slide-previous]");
        const nextButton = rootElement.querySelector("[data-summary-slide-next]");
        let activeSlide = 0;
        let scrollSettleTimeout = null;
        let wheelDelta = 0;
        let wheelDebounceTimeout = null;
        let wheelLocked = false;

        if (!trackElement || slides.length === 0) {
            return null;
        }

        function updateIndicators() {
            dots.forEach((dot, dotIndex) => {
                const isActive = dotIndex === activeSlide;
                dot.classList.toggle("is-active", isActive);
                dot.setAttribute("aria-selected", `${isActive}`);
            });
        }

        function goTo(index, behavior = "smooth") {
            window.clearTimeout(scrollSettleTimeout);
            activeSlide = (index + slides.length) % slides.length;
            trackElement.scrollTo({
                left: trackElement.clientWidth * activeSlide,
                behavior
            });
            updateIndicators();
        }

        function syncFromScroll() {
            window.clearTimeout(scrollSettleTimeout);
            const slideWidth = trackElement.clientWidth;
            if (slideWidth <= 0) {
                return;
            }

            const nextSlide = Math.round(trackElement.scrollLeft / slideWidth);
            if (nextSlide !== activeSlide) {
                activeSlide = nextSlide;
                updateIndicators();
            }
        }

        // Intermediate positions during smooth scrolling must not undo the selected dot.
        // The timeout also supports browsers without the scrollend event.
        trackElement.addEventListener("scroll", () => {
            window.clearTimeout(scrollSettleTimeout);
            scrollSettleTimeout = window.setTimeout(syncFromScroll, 150);
        }, {passive: true});
        trackElement.addEventListener("scrollend", syncFromScroll, {passive: true});
        trackElement.addEventListener("wheel", (event) => {
            if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
                return;
            }

            event.preventDefault();
            if (wheelLocked) {
                return;
            }

            wheelDelta += event.deltaY;
            window.clearTimeout(wheelDebounceTimeout);
            wheelDebounceTimeout = window.setTimeout(() => {
                if (wheelDelta === 0) {
                    return;
                }

                goTo(activeSlide + (wheelDelta > 0 ? 1 : -1));
                wheelDelta = 0;
                wheelLocked = true;
                window.setTimeout(() => {
                    wheelLocked = false;
                }, 500);
            }, 100);
        }, {passive: false});
        dots.forEach((dot) => {
            dot.addEventListener("click", () => goTo(Number(dot.dataset.summarySlideTo)));
        });
        previousButton?.addEventListener("click", () => goTo(activeSlide - 1));
        nextButton?.addEventListener("click", () => goTo(activeSlide + 1));
        rootElement.addEventListener("keydown", (event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                goTo(activeSlide + (event.key === "ArrowRight" ? 1 : -1));
            }
        });

        updateIndicators();
        return {goTo};
    }

    return {create};
})();
