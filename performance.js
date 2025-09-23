// Performance optimizations for Story Archive Explorer

(function() {
    'use strict';

    // 1. Throttle function for scroll events
    function throttle(func, wait) {
        let timeout;
        let lastTime = 0;
        
        return function(...args) {
            const now = Date.now();
            const remaining = wait - (now - lastTime);
            
            if (remaining <= 0 || remaining > wait) {
                if (timeout) {
                    clearTimeout(timeout);
                    timeout = null;
                }
                lastTime = now;
                func.apply(this, args);
            } else if (!timeout) {
                timeout = setTimeout(() => {
                    lastTime = Date.now();
                    timeout = null;
                    func.apply(this, args);
                }, remaining);
            }
        };
    }

    // 2. Optimize scroll performance
    function optimizeScrollPerformance() {
        const scrollContainers = [
            '.user-dates-container',
            '.date-users-container', 
            '.profile-dates-container',
            '.frequency-chart',
            '.reshares-list'
        ];

        scrollContainers.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                if (element) {
                    // Add passive listeners for better scroll performance
                    element.addEventListener('scroll', throttle(() => {
                        // Minimal scroll handler
                    }, 100), { passive: true });
                }
            });
        });
    }

    // 3. Lazy load images
    function setupLazyLoading() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.removeAttribute('data-src');
                            observer.unobserve(img);
                        }
                    }
                });
            }, {
                rootMargin: '50px 0px',
                threshold: 0.01
            });

            // Observe all images with data-src
            document.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });
        }
    }

    // 4. Debounce resize events
    const debouncedResize = throttle(() => {
        // Handle resize events efficiently
        document.body.style.setProperty('--viewport-height', `${window.innerHeight}px`);
    }, 250);

    // 5. Optimize animation performance
    function optimizeAnimations() {
        // Pause animations when not visible
        const animatedElements = document.querySelectorAll(
            '#file-picker-view::before, #home-view::before, .loading-ring'
        );

        const animationObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.animationPlayState = 'running';
                } else {
                    entry.target.style.animationPlayState = 'paused';
                }
            });
        });

        animatedElements.forEach(el => {
            if (el) animationObserver.observe(el);
        });
    }

    // 6. Use requestAnimationFrame for smooth animations
    function smoothAnimation(callback) {
        let ticking = false;
        
        return function(...args) {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    callback.apply(this, args);
                    ticking = false;
                });
                ticking = true;
            }
        };
    }

    // 7. Optimize hover effects
    function optimizeHoverEffects() {
        // Remove hover effects during scroll
        let scrollTimer;
        const scrollableElements = document.querySelectorAll(
            '.users-list, .dates-grid, .dates-list, .profiles-list'
        );

        scrollableElements.forEach(element => {
            element.addEventListener('scroll', () => {
                if (!element.classList.contains('is-scrolling')) {
                    element.classList.add('is-scrolling');
                }
                
                clearTimeout(scrollTimer);
                scrollTimer = setTimeout(() => {
                    element.classList.remove('is-scrolling');
                }, 150);
            }, { passive: true });
        });
    }

    // 8. Initialize performance optimizations
    function init() {
        // Wait for DOM ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }

        // Apply optimizations
        optimizeScrollPerformance();
        setupLazyLoading();
        optimizeAnimations();
        optimizeHoverEffects();

        // Setup event listeners
        window.addEventListener('resize', debouncedResize, { passive: true });

        // Reduce motion if user prefers
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            document.documentElement.classList.add('reduce-motion');
        }
    }

    // Start optimizations
    init();

})();