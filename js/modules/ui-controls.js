/* ══════════════════════════════════════════════════════════════════
   UI CONTROLS
   Filter Toggle, Page Switching, Accordion Toggle
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Toggle filter panel visibility
 */
function toggleFilter() {
  const panel = document.querySelector('.filter-panel');
  const btn = document.getElementById('filterToggle');
  panel.classList.toggle('collapsed');
  btn.classList.toggle('active');
}

/**
 * Switch between pages (Use Cases / Admin Panel)
 * @param {string} id - Page identifier
 * @param {HTMLElement} btn - Button element clicked
 */
function switchPage(id, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.page-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  btn.classList.add('active');
}

/**
 * Toggle filter group accordion
 * @param {string} id - Filter group identifier
 */
function toggleFg(id) {
  document.getElementById(id).classList.toggle('open');
}

/**
 * Toggle checkbox state
 * @param {HTMLElement} row - Checkbox row element
 */
function toggleCb(row) {
  row.classList.toggle('checked');
}