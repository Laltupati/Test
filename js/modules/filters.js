/* ══════════════════════════════════════════════════════════════════
   FILTER & SEARCH FUNCTIONALITY
   Apply filters, search, and card visibility management
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Apply filters based on search input and checkbox selections
 * Filters cards by domain, technology, capability, and search term
 */
function applyFilters() {
  const q = document.getElementById('si').value.toLowerCase().trim();

  // Collect checked values per group
  const checked = { domain: [], tech: [], cap: [], status: [] };
  document.querySelectorAll('.cb-row.checked').forEach(row => {
    const group = row.dataset.filter;
    if (checked[group]) checked[group].push(row.dataset.val);
  });

  const cards = document.querySelectorAll('.card');
  let n = 0;
  const ex = document.querySelector('.empty');
  if (ex) ex.remove();

  // Iterate through cards and apply filter logic
  cards.forEach(card => {
    const titleOk = !q || card.dataset.t.includes(q);
    const domainOk = checked.domain.length === 0 || checked.domain.some(v => (card.dataset.domain || '').includes(v));
    const techOk = checked.tech.length === 0 || checked.tech.some(v => (card.dataset.tech || '').includes(v));
    const capOk = checked.cap.length === 0 || checked.cap.some(v => (card.dataset.cap || '').includes(v));
    const statusOk = checked.status.length === 0 || checked.status.some(v => (card.dataset.status || '').includes(v));

    const show = titleOk && domainOk && techOk && capOk && statusOk;
    card.style.display = show ? '' : 'none';
    if (show) n++;
  });

  // Update results counter
  const rcElement = document.getElementById('rc');
  if (rcElement) {
    rcElement.textContent = n + ' solution' + (n !== 1 ? 's' : '');
  }

  // Render active chips
  renderChips(checked);

  // Show empty state if no results
  if (n === 0) {
    const g = document.getElementById('grid');
    const e = document.createElement('div');
    e.className = 'empty';
    e.innerHTML = '<div class="empty-ico">🔍</div><h3>No solutions found</h3><p>Adjust your filters or search.</p>';
    g.appendChild(e);
  }
}

/**
 * Reset all filters and search
 */
function resetFilters() {
  document.querySelectorAll('.cb-row').forEach(r => r.classList.remove('checked'));
  document.getElementById('si').value = '';
  applyFilters();
}