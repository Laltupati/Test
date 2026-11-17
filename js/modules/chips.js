/* ══════════════════════════════════════════════════════════════════
   ACTIVE FILTER CHIPS
   Rendering and management of active filter chips
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Label mapping for filter values to display text
 */
const labelMap = {
  'banking-finance': 'Banking & Finance',
  'hr': 'HR',
  'healthcare': 'HealthCare',
  'insurance': 'Insurance',
  'technology': 'Technology',
  'genai': 'GenAI & Agentic AI',
  'rag': 'RAG',
  'nlp': 'NLP',
  'llm': 'LLM',
  'computer-vision': 'Computer Vision',
  'content-generation': 'Content Generation',
  'text-summarization': 'Text Summarization',
  'classification': 'Classification/Regression',
  'qa-systems': 'Q&A Systems',
  'document-analysis': 'Document Analysis'
};

/**
 * Render active filter chips
 * @param {Object} checked - Object containing arrays of checked values per group
 */
function renderChips(checked) {
  const el = document.getElementById('activeChips');
  el.innerHTML = '';
  Object.values(checked).flat().forEach(val => {
    const chip = document.createElement('div');
    chip.className = 'achip';
    chip.innerHTML = (labelMap[val] || val) + ' <span class="achip-x" onclick="removeChip(\'' + val + '\')">✕</span>';
    el.appendChild(chip);
  });
}

/**
 * Remove a specific filter chip and update filters
 * @param {string} val - Filter value to remove
 */
function removeChip(val) {
  document.querySelectorAll('.cb-row').forEach(row => {
    if (row.dataset.val === val) row.classList.remove('checked');
  });
  applyFilters();
}