/** A run link someone else could open: only a web address. The Mac app's `app://` address (and any other scheme) opens
 * nowhere but this computer, so there is nothing to copy; a shareable proof page has its own control (ShareProof). */
export function shareableRunLink(location: Pick<Location, 'protocol' | 'href'>): string | null {
  return location.protocol === 'https:' || location.protocol === 'http:' ? location.href : null
}
