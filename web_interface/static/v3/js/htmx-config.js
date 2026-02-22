/**
 * HTMX configuration — event handlers and error handling for form submissions.
 * Tab content loading is handled by app-init.js loadTabContent().
 */
(function() {
    function setup() {
        if (!document.body) {
            document.addEventListener('DOMContentLoaded', setup);
            return;
        }

        // Validate HTMX swap targets before swap
        document.body.addEventListener('htmx:beforeSwap', function(event) {
            try {
                const target = event.detail.target;
                if (!target || !(target instanceof Element) || !document.body.contains(target)) {
                    event.detail.shouldSwap = false;
                    return false;
                }
                return true;
            } catch (e) {
                event.detail.shouldSwap = false;
                return false;
            }
        });

        // Suppress harmless HTMX console noise
        const originalError = console.error;
        console.error = function(...args) {
            const str = args.join(' ');
            if ((str.includes('insertBefore') || str.includes("Cannot read properties of null")) &&
                (str.includes('htmx') || args.some(a => a && typeof a === 'object' && a.stack && a.stack.includes('htmx')))) {
                return;
            }
            originalError.apply(console, args);
        };

        const originalWarn = console.warn;
        console.warn = function(...args) {
            const str = args.join(' ');
            if (str.includes('Permissions-Policy') || str.includes('Unrecognized feature')) {
                return;
            }
            originalWarn.apply(console, args);
        };

        // Log HTMX response errors
        document.body.addEventListener('htmx:responseError', function(event) {
            const xhr = event.detail.xhr;
            console.error('HTMX response error:', {
                status: xhr?.status,
                url: xhr?.responseURL,
                target: event.detail.target?.id
            });
        });

        // Re-execute scripts after HTMX swaps (for form responses)
        document.body.addEventListener('htmx:afterSwap', function(event) {
            if (event.detail && event.detail.target) {
                try {
                    const scripts = event.detail.target.querySelectorAll('script');
                    scripts.forEach(function(oldScript) {
                        try {
                            const newScript = document.createElement('script');
                            if (oldScript.src) newScript.src = oldScript.src;
                            if (oldScript.type) newScript.type = oldScript.type;
                            if (oldScript.textContent) newScript.textContent = oldScript.textContent;
                            if (oldScript.parentNode) {
                                oldScript.replaceWith(newScript);
                            }
                        } catch (e) { /* ignore script execution errors */ }
                    });
                } catch (e) { /* ignore */ }
            }
        });
    }
    setup();

    // Section toggle utility (used by loaded content)
    window.toggleSection = function(sectionId) {
        const section = document.getElementById(sectionId);
        const icon = document.getElementById(sectionId + '-icon');
        if (!section || !icon) return;

        const isHidden = section.classList.contains('hidden') ||
                         window.getComputedStyle(section).display === 'none';

        if (isHidden) {
            section.classList.remove('hidden');
            section.style.display = 'block';
            icon.classList.replace('fa-chevron-right', 'fa-chevron-down');
        } else {
            section.classList.add('hidden');
            section.style.display = 'none';
            icon.classList.replace('fa-chevron-down', 'fa-chevron-right');
        }
    };
})();
