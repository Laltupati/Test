/* ═══════════════════════════════════════════════════════════════════
   JAVASCRIPT LOADER - Module Initialization
   Loads all JS modules in the correct order to ensure dependencies
   are satisfied. Run this AFTER DOM is fully loaded.
   ═══════════════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  // Module loading queue - order matters for dependencies
  const modules = [
    'js/modules/ui-controls.js',      // UI interactions (must load first)
    'js/modules/chips.js',             // Filter chip management
    'js/modules/filters.js',           // Filter logic (depends on chips & ui-controls)
    'js/modules/tooltip.js',            // Tooltip functionality
    'js/modules/tool-details-popup.js' // Popup window for cards(tools info)
  ];

  /**
   * Dynamically load a script and return a promise
   * @param {string} src - Script source path
   * @returns {Promise} Resolves when script is loaded
   */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.type = 'text/javascript';
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  /**
   * Load all modules sequentially to maintain order
   */
  async function initializeModules() {
    try {
      for (const module of modules) {
        await loadScript(module);
        console.log(`✓ Loaded: ${module}`);
      }
      console.log('✓ All modules initialized successfully');
    } catch (error) {
      console.error('✗ Module loading failed:', error);
    }
  }

  // Wait for DOM to be fully loaded before initializing
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeModules);
  } else {
    // DOM already loaded
    initializeModules();
  }
})();