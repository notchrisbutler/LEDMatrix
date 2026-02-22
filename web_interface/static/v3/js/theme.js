/**
 * Theme initialization — must load synchronously in <head> before CSS to prevent FOUC.
 * Handles data-bs-theme, toggleTheme(), updateThemeIcon(), and OS preference detection.
 */
(function() {
    // Safely read from localStorage (may throw in private browsing / restricted contexts)
    function getStorage(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    }
    function setStorage(key, value) {
        try { localStorage.setItem(key, value); } catch (e) { /* no-op */ }
    }

    // Safely query prefers-color-scheme (matchMedia may be unavailable)
    function prefersDark() {
        try {
            return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        } catch (e) { return false; }
    }

    var saved = getStorage('theme');
    var theme = saved || (prefersDark() ? 'dark' : 'light');
    document.documentElement.setAttribute('data-bs-theme', theme);

    // Theme toggle function
    window.toggleTheme = function() {
        try {
            var current = document.documentElement.getAttribute('data-bs-theme');
            var next = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-bs-theme', next);
            setStorage('theme', next);
            window.updateThemeIcon(next);
        } catch (e) { /* no-op */ }
    };

    // Update icon visibility and ARIA state based on current theme
    window.updateThemeIcon = function(theme) {
        var darkIcon = document.getElementById('theme-icon-dark');
        var lightIcon = document.getElementById('theme-icon-light');
        var btn = document.getElementById('theme-toggle');
        if (darkIcon && lightIcon) {
            if (theme === 'dark') {
                darkIcon.classList.add('hidden');
                lightIcon.classList.remove('hidden');
            } else {
                darkIcon.classList.remove('hidden');
                lightIcon.classList.add('hidden');
            }
        }
        if (btn) {
            var isDark = theme === 'dark';
            btn.setAttribute('aria-pressed', String(isDark));
            var label = isDark ? 'Switch to light mode' : 'Switch to dark mode';
            btn.setAttribute('aria-label', label);
            btn.setAttribute('title', label);
        }
    };

    // Initialize icon state once DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
        window.updateThemeIcon(document.documentElement.getAttribute('data-bs-theme') || 'light');
    });

    // Listen for OS theme changes (only when no explicit user preference)
    try {
        var mql = window.matchMedia('(prefers-color-scheme: dark)');
        var handler = function(e) {
            if (!getStorage('theme')) {
                var t = e.matches ? 'dark' : 'light';
                document.documentElement.setAttribute('data-bs-theme', t);
                window.updateThemeIcon(t);
            }
        };
        if (mql.addEventListener) {
            mql.addEventListener('change', handler);
        } else if (mql.addListener) {
            mql.addListener(handler);
        }
    } catch (e) { /* matchMedia unavailable */ }
})();
