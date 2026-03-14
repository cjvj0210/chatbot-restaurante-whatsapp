/**
 * Announces a message to screen readers via an aria-live region.
 * The region must exist in the DOM (added by DashboardLayout or App root).
 */
export function announceToSR(message: string): void {
  const el = document.getElementById("sr-announcer");
  if (!el) return;
  // Clear first to force re-announcement even if text is the same
  el.textContent = "";
  requestAnimationFrame(() => {
    el.textContent = message;
  });
}
