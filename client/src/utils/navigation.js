export function getPageUrl(page, { domain, id, source, area } = {}) {
  const params = new URLSearchParams();
  if (page && page !== 'usecase3') {
    params.set('page', page);
  }
  if (domain) {
    params.set('domain', domain);
  }
  if (id) {
    params.set('id', id);
  }
  if (source) {
    params.set('source', source);
  }
  if (area) {
    params.set('area', area);
  }
  const str = params.toString();
  return str ? `/?${str}` : '/';
}

export function isPlainLeftClick(e) {
  return e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey;
}
