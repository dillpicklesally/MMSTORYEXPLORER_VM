// Chart.js Theme Configuration
(function() {
    'use strict';

    // Function to update Chart.js default colors
    function updateChartTheme() {
        if (typeof Chart === 'undefined') return;

        const isDarkMode = !document.documentElement.hasAttribute('data-theme') || 
                          document.documentElement.getAttribute('data-theme') !== 'light';

        // Set chart defaults for text color
        Chart.defaults.color = '#808080'; // Gray color for both themes
        Chart.defaults.borderColor = 'rgba(128, 128, 128, 0.2)';
        
        // Update plugin defaults
        if (Chart.defaults.plugins) {
            if (Chart.defaults.plugins.legend) {
                Chart.defaults.plugins.legend.labels = {
                    ...Chart.defaults.plugins.legend.labels,
                    color: '#808080'
                };
            }
            
            if (Chart.defaults.plugins.tooltip) {
                Chart.defaults.plugins.tooltip.titleColor = '#808080';
                Chart.defaults.plugins.tooltip.bodyColor = '#808080';
                Chart.defaults.plugins.tooltip.backgroundColor = isDarkMode ? 
                    'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.9)';
                Chart.defaults.plugins.tooltip.borderColor = isDarkMode ? 
                    'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)';
                Chart.defaults.plugins.tooltip.borderWidth = 1;
            }
        }

        // Update scale defaults
        if (Chart.defaults.scales) {
            Chart.defaults.scales.category = {
                ...Chart.defaults.scales.category,
                ticks: { color: '#808080' },
                grid: { color: 'rgba(128, 128, 128, 0.1)' }
            };
            
            Chart.defaults.scales.linear = {
                ...Chart.defaults.scales.linear,
                ticks: { color: '#808080' },
                grid: { color: 'rgba(128, 128, 128, 0.1)' }
            };
        }

        // Force update of existing charts
        Chart.helpers.each(Chart.instances, function(instance) {
            if (instance.options.plugins && instance.options.plugins.legend) {
                instance.options.plugins.legend.labels = {
                    ...instance.options.plugins.legend.labels,
                    color: '#808080'
                };
            }
            
            // Update scales
            if (instance.options.scales) {
                Object.keys(instance.options.scales).forEach(key => {
                    if (instance.options.scales[key].ticks) {
                        instance.options.scales[key].ticks.color = '#808080';
                    }
                    if (instance.options.scales[key].grid) {
                        instance.options.scales[key].grid.color = 'rgba(128, 128, 128, 0.1)';
                    }
                });
            }
            
            instance.update();
        });
    }

    // Initialize chart theme
    function init() {
        // Wait for Chart.js to be loaded
        if (typeof Chart === 'undefined') {
            // Try again in 100ms
            setTimeout(init, 100);
            return;
        }

        // Set initial theme
        updateChartTheme();

        // Listen for theme changes
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
                    updateChartTheme();
                }
            });
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme']
        });

        // Also listen to the theme toggle if available
        if (window.ThemeToggle) {
            const originalToggle = window.ThemeToggle.toggle;
            window.ThemeToggle.toggle = function() {
                originalToggle();
                setTimeout(updateChartTheme, 100); // Small delay to ensure theme is applied
            };
        }
    }

    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();