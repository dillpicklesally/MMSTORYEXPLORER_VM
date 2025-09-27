// Theme Toggle Functionality
(function() {
    'use strict';

    const THEME_KEY = 'mm-story-archive-theme';
    const THEMES = {
        DARK: 'dark',
        LIGHT: 'light'
    };

    let currentTheme = THEMES.DARK;

    // Get theme preference from localStorage or default to dark
    function getInitialTheme() {
        const savedTheme = localStorage.getItem(THEME_KEY);
        
        if (savedTheme && Object.values(THEMES).includes(savedTheme)) {
            return savedTheme;
        }

        // Always default to dark mode
        return THEMES.DARK;
    }

    // Apply theme to document
    function applyTheme(theme) {
        currentTheme = theme;
        
        if (theme === THEMES.LIGHT) {
            document.documentElement.setAttribute('data-theme', 'light');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }

        // Store preference
        localStorage.setItem(THEME_KEY, theme);

        // Update button accessibility
        updateButtonAccessibility();
    }

    // Toggle between themes
    function toggleTheme() {
        const newTheme = currentTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
        applyTheme(newTheme);
    }

    // Update button aria-label and title
    function updateButtonAccessibility() {
        const button = document.getElementById('theme-toggle');
        if (button) {
            const isLight = currentTheme === THEMES.LIGHT;
            button.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
            button.title = isLight ? 'Switch to dark mode' : 'Switch to light mode';
        }
    }

    // Initialize theme toggle
    function init() {
        // Always start with dark mode as default
        applyTheme(THEMES.DARK);

        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupEventListeners);
        } else {
            setupEventListeners();
        }

        // Listen for system theme changes
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
            
            // Modern browsers
            if (mediaQuery.addEventListener) {
                mediaQuery.addEventListener('change', handleSystemThemeChange);
            } 
            // Older browsers
            else if (mediaQuery.addListener) {
                mediaQuery.addListener(handleSystemThemeChange);
            }
        }
    }

    // Handle system theme change
    function handleSystemThemeChange(e) {
        // Only update if user hasn't manually set a preference
        const savedTheme = localStorage.getItem(THEME_KEY);
        if (!savedTheme) {
            const systemTheme = e.matches ? THEMES.LIGHT : THEMES.DARK;
            applyTheme(systemTheme);
        }
    }

    // Setup event listeners
    function setupEventListeners() {
        const themeToggle = document.getElementById('theme-toggle');
        
        if (themeToggle) {
            themeToggle.addEventListener('click', toggleTheme);
            
            // Add keyboard support
            themeToggle.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleTheme();
                }
            });

            // Add proper ARIA attributes
            themeToggle.setAttribute('role', 'button');
            themeToggle.setAttribute('tabindex', '0');
            updateButtonAccessibility();
        }
    }

    // Add smooth transition when switching themes
    function addThemeTransition() {
        const style = document.createElement('style');
        style.textContent = `
            *, *::before, *::after {
                transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease !important;
            }
        `;
        document.head.appendChild(style);

        // Remove transition after animation completes
        setTimeout(() => {
            style.remove();
        }, 300);
    }

    // Override toggle function to include transition
    const originalToggleTheme = toggleTheme;
    function toggleThemeWithTransition() {
        addThemeTransition();
        originalToggleTheme();
    }

    // Replace the toggle function
    toggleTheme = toggleThemeWithTransition;

    // Export for potential external use
    window.ThemeToggle = {
        toggle: toggleTheme,
        setTheme: applyTheme,
        getCurrentTheme: () => currentTheme,
        THEMES
    };

    // Initialize
    init();

})();