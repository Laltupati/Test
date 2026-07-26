// /* ══════════════════════════════════════════════════════════════════
//    TOOL DETAILS POPUP
//    Click-based popup for card info buttons (.btn-i[data-tool-info])
// ═══════════════════════════════════════════════════════════════════ */
// (function () {
//   'use strict';

//   let popup = null;
//   let activeTrigger = null;

//   function initToolDetailsPopup() {
//     const triggers = document.querySelectorAll('.btn-i[data-tool-info]');

//     if (!triggers.length) return;

//     createPopup();

//     document.addEventListener('click', handleDocumentClick);
//     document.addEventListener('keydown', handleKeydown);
//     window.addEventListener('resize', closePopup);
//     window.addEventListener('scroll', closePopup, true);

//     triggers.forEach(trigger => {
//       trigger.addEventListener('click', handleTriggerClick);
//     });
//   }

//   function createPopup() {
//     if (popup) return;

//     popup = document.createElement('div');
//     popup.className = 'tool-details-pop';
//     popup.setAttribute('hidden', '');

//     popup.innerHTML = `
//       <div class="tool-details-pop__inner">
//         <div class="tool-details-pop__head">
//           <div class="tool-details-pop__title-wrap">
//             <p class="tool-details-pop__eyebrow">Tool Details</p>
//             <h4 class="tool-details-pop__title">Tool Information</h4>
//           </div>
//           <button
//             type="button"
//             class="tool-details-pop__close"
//             aria-label="Close tool details"
//           >
//             ×
//           </button>
//         </div>

//         <div class="tool-details-pop__section">
//           <p class="tool-details-pop__label">Tool Overview</p>
//           <p class="tool-details-pop__overview"></p>
//         </div>

//         <div class="tool-details-pop__section">
//           <p class="tool-details-pop__label">Key Capabilities</p>
//           <ul class="tool-details-pop__list"></ul>
//         </div>
//       </div>
//     `;

//     document.body.appendChild(popup);

//     const closeBtn = popup.querySelector('.tool-details-pop__close');
//     if (closeBtn) {
//       closeBtn.addEventListener('click', function (event) {
//         event.stopPropagation();
//         closePopup();
//       });
//     }

//     popup.addEventListener('click', function (event) {
//       event.stopPropagation();
//     });
//   }

//   function handleTriggerClick(event) {
//     event.preventDefault();
//     event.stopPropagation();

//     const trigger = event.currentTarget;
//     const toolId = trigger.getAttribute('data-tool-info');

//     if (!toolId) return;

//     if (activeTrigger === trigger && isPopupOpen()) {
//       closePopup();
//       return;
//     }

//     const details = getToolDetails(toolId);
//     renderPopup(details);
//     openPopup(trigger);
//   }

//   function getToolDetails(toolId) {
//     const source = window.TOOL_DETAILS || {};
//     const detail = source[toolId];

//     if (!detail) {
//       return {
//         title: 'Tool Information',
//         overview: 'Details are not available for this tool yet.',
//         capabilities: ['Tool overview and capabilities will be added soon.']
//       };
//     }

//     return detail;
//   }

//   function renderPopup(details) {
//     if (!popup) return;

//     const titleEl = popup.querySelector('.tool-details-pop__title');
//     const overviewEl = popup.querySelector('.tool-details-pop__overview');
//     const listEl = popup.querySelector('.tool-details-pop__list');

//     if (titleEl) {
//       titleEl.textContent = details.title || 'Tool Information';
//     }

//     if (overviewEl) {
//       overviewEl.textContent = details.overview || 'No overview available.';
//     }

//     if (listEl) {
//       listEl.innerHTML = '';

//       const capabilities = Array.isArray(details.capabilities)
//         ? details.capabilities
//         : [];

//       if (!capabilities.length) {
//         const li = document.createElement('li');
//         li.textContent = 'No capabilities available.';
//         listEl.appendChild(li);
//       } else {
//         capabilities.forEach(item => {
//           const li = document.createElement('li');
//           li.textContent = item;
//           listEl.appendChild(li);
//         });
//       }
//     }
//   }

//   function openPopup(trigger) {
//     if (!popup) return;

//     if (activeTrigger && activeTrigger !== trigger) {
//       activeTrigger.classList.remove('active');
//       activeTrigger.setAttribute('aria-expanded', 'false');
//     }

//     activeTrigger = trigger;
//     activeTrigger.classList.add('active');
//     activeTrigger.setAttribute('aria-expanded', 'true');

//     popup.removeAttribute('hidden');
//     positionPopup(trigger);
//   }

//   function closePopup() {
//     if (!popup || !isPopupOpen()) return;

//     popup.setAttribute('hidden', '');

//     if (activeTrigger) {
//       activeTrigger.classList.remove('active');
//       activeTrigger.setAttribute('aria-expanded', 'false');
//       activeTrigger = null;
//     }
//   }

//   function isPopupOpen() {
//     return popup && !popup.hasAttribute('hidden');
//   }

//   function handleDocumentClick(event) {
//     if (!isPopupOpen()) return;

//     const clickedTrigger = event.target.closest('.btn-i[data-tool-info]');
//     if (clickedTrigger) return;

//     if (popup && popup.contains(event.target)) return;

//     closePopup();
//   }

//   function handleKeydown(event) {
//     if (event.key === 'Escape') {
//       closePopup();
//     }
//   }

//   function positionPopup(trigger) {
//     if (!popup || !trigger) return;

//     const rect = trigger.getBoundingClientRect();
//     const popupWidth = 360;
//     const gap = 12;

//     popup.style.width = popupWidth + 'px';
//     popup.style.left = '0px';
//     popup.style.top = '0px';
//     popup.style.transform = 'none';

//     // Make visible temporarily for size calculation
//     const wasHidden = popup.hasAttribute('hidden');
//     if (wasHidden) popup.removeAttribute('hidden');

//     const popupRect = popup.getBoundingClientRect();
//     const actualWidth = popupRect.width || popupWidth;
//     const actualHeight = popupRect.height || 260;

//     let left = rect.right - actualWidth;
//     let top = rect.top - actualHeight - gap;
//     let placement = 'top';

//     // If not enough room above, place below
//     if (top < 12) {
//       top = rect.bottom + gap;
//       placement = 'bottom';
//     }

//     // Keep within viewport
//     const minLeft = 12;
//     const maxLeft = window.innerWidth - actualWidth - 12;
//     left = Math.max(minLeft, Math.min(left, maxLeft));

//     // If below also overflows viewport, clamp
//     const maxTop = window.innerHeight - actualHeight - 12;
//     top = Math.max(12, Math.min(top, maxTop));

//     popup.style.left = `${left + window.scrollX}px`;
//     popup.style.top = `${top + window.scrollY}px`;
//     popup.setAttribute('data-placement', placement);

//     if (wasHidden) popup.setAttribute('hidden', '');
//   }

//   if (document.readyState === 'loading') {
//     document.addEventListener('DOMContentLoaded', initToolDetailsPopup);
//   } else {
//     initToolDetailsPopup();
//   }
// })();







































/* ══════════════════════════════════════════════════════════════════
   TOOL DETAILS BOTTOM SHEET
   Opens from bottom of screen for .btn-i[data-tool-info]
═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  let root = null;
  let panel = null;
  let overlay = null;
  let titleEl = null;
  let overviewEl = null;
  let listEl = null;
  let closeBtn = null;
  let activeTrigger = null;
  let closeTimer = null;

  function initToolDetailsSheet() {
    const triggers = document.querySelectorAll('.btn-i[data-tool-info]');

    if (!triggers.length) return;

    createSheet();

    triggers.forEach(trigger => {
      trigger.addEventListener('click', handleTriggerClick);
    });

    document.addEventListener('keydown', handleKeydown);
  }

  function createSheet() {
    if (root) return;

    root = document.createElement('div');
    root.className = 'tool-sheet';
    root.setAttribute('hidden', '');

    root.innerHTML = `
      <div class="tool-sheet__overlay" data-sheet-close="overlay"></div>

      <section
        class="tool-sheet__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tool-sheet-title"
      >
        <div class="tool-sheet__handle"></div>

        <div class="tool-sheet__head">
          <div class="tool-sheet__title-wrap">
            <p class="tool-sheet__eyebrow">Tool Details</p>
            <h3 class="tool-sheet__title" id="tool-sheet-title">Tool Information</h3>
          </div>

          <button
            type="button"
            class="tool-sheet__close"
            aria-label="Close tool details"
            data-sheet-close="button"
          >
            ×
          </button>
        </div>

        <div class="tool-sheet__body">
          <div class="tool-sheet__section">
            <p class="tool-sheet__label">Tool Overview</p>
            <p class="tool-sheet__overview"></p>
          </div>

          <div class="tool-sheet__section">
            <p class="tool-sheet__label">Key Capabilities</p>
            <ul class="tool-sheet__list"></ul>
          </div>
        </div>
      </section>
    `;

    document.body.appendChild(root);

    panel = root.querySelector('.tool-sheet__panel');
    overlay = root.querySelector('.tool-sheet__overlay');
    titleEl = root.querySelector('.tool-sheet__title');
    overviewEl = root.querySelector('.tool-sheet__overview');
    listEl = root.querySelector('.tool-sheet__list');
    closeBtn = root.querySelector('.tool-sheet__close');

    if (overlay) {
      overlay.addEventListener('click', closeSheet);
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', closeSheet);
    }

    if (panel) {
      panel.addEventListener('click', function (event) {
        event.stopPropagation();
      });
    }
  }

  function handleTriggerClick(event) {
    event.preventDefault();
    event.stopPropagation();

    const trigger = event.currentTarget;
    const toolId = trigger.getAttribute('data-tool-info');

    if (!toolId) return;

    if (activeTrigger === trigger && isOpen()) {
      closeSheet();
      return;
    }

    const details = getToolDetails(toolId);
    renderSheet(details);
    openSheet(trigger);
  }

  function getToolDetails(toolId) {
    const source = window.TOOL_DETAILS || {};
    const detail = source[toolId];

    if (!detail) {
      return {
        title: 'Tool Information',
        overview: 'Details are not available for this tool yet.',
        capabilities: ['Tool overview and key capabilities will be added soon.']
      };
    }

    return detail;
  }

  function renderSheet(details) {
    if (!titleEl || !overviewEl || !listEl) return;

    titleEl.textContent = details.title || 'Tool Information';
    overviewEl.textContent = details.overview || 'No overview available.';

    listEl.innerHTML = '';

    const capabilities = Array.isArray(details.capabilities)
      ? details.capabilities
      : [];

    if (!capabilities.length) {
      const li = document.createElement('li');
      li.textContent = 'No capabilities available.';
      listEl.appendChild(li);
      return;
    }

    capabilities.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      listEl.appendChild(li);
    });
  }

  function openSheet(trigger) {
    clearTimeout(closeTimer);

    if (activeTrigger && activeTrigger !== trigger) {
      activeTrigger.classList.remove('active');
      activeTrigger.setAttribute('aria-expanded', 'false');
    }

    activeTrigger = trigger;
    activeTrigger.classList.add('active');
    activeTrigger.setAttribute('aria-expanded', 'true');

    root.removeAttribute('hidden');

    // Force reflow so transition works every time
    void root.offsetWidth;

    root.classList.add('is-open');
    document.body.classList.add('tool-sheet-open');
  }

  function closeSheet() {
    if (!root || !isOpen()) return;

    root.classList.remove('is-open');
    document.body.classList.remove('tool-sheet-open');

    if (activeTrigger) {
      activeTrigger.classList.remove('active');
      activeTrigger.setAttribute('aria-expanded', 'false');
      activeTrigger = null;
    }

    clearTimeout(closeTimer);
    closeTimer = setTimeout(function () {
      if (root && !root.classList.contains('is-open')) {
        root.setAttribute('hidden', '');
      }
    }, 320);
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      closeSheet();
    }
  }

  function isOpen() {
    return root && root.classList.contains('is-open');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initToolDetailsSheet);
  } else {
    initToolDetailsSheet();
  }
})();