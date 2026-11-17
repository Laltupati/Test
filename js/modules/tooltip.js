/* ══════════════════════════════════════════════════════════════════
   TOOLTIP FUNCTIONALITY
   ═══════════════════════════════════════════════════════════════════ */

let currentTooltip = null;
let tooltipTimeout = null;

function initTooltipListeners() {
  const descElements = document.querySelectorAll('[data-tooltip]');
  
  descElements.forEach(element => {
    element.addEventListener('mouseenter', showTooltip);
    element.addEventListener('mouseleave', hideTooltip);
    element.addEventListener('mousemove', positionTooltip);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTooltipListeners);
} else {
  initTooltipListeners();
}

function showTooltip(e) {
  const text = e.currentTarget.getAttribute('data-tooltip');
  if (!text || !text.trim()) return;
  
  clearTimeout(tooltipTimeout);
  
  if (currentTooltip) {
    currentTooltip.remove();
  }
  
  const tooltip = document.createElement('div');
  tooltip.className = 'tooltip show';
  tooltip.textContent = text;
  document.body.appendChild(tooltip);
  
  currentTooltip = tooltip;
  
  // Position it
  positionTooltip.call(e.currentTarget);
}

function positionTooltip(e) {
  if (!currentTooltip) return;
  
  const element = e.currentTarget || this;
  const rect = element.getBoundingClientRect();
  
  // Position above the element
  const x = rect.left + rect.width / 2;
  const y = rect.top - 10;
  
  currentTooltip.style.left = x + 'px';
  currentTooltip.style.top = y + 'px';
  currentTooltip.style.transform = 'translate(-50%, -100%)';
}

function hideTooltip() {
  tooltipTimeout = setTimeout(() => {
    if (currentTooltip) {
      currentTooltip.classList.remove('show');
      setTimeout(() => {
        if (currentTooltip) {
          currentTooltip.remove();
          currentTooltip = null;
        }
      }, 200);
    }
  }, 100);
}