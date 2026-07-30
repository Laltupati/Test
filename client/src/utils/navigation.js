export function getPageUrl(page, { domain, id } = {}) {
  const params = new URLSearchParams();
  if (page && page !== 'categories') {
    params.set('page', page);
  }
  if (domain) {
    params.set('domain', domain);
  }
  if (id) {
    params.set('id', id);
  }
  const str = params.toString();
  return str ? `/?${str}` : '/';
}

export function isPlainLeftClick(e) {
  return e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey;
}
