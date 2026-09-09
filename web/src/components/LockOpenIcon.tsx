/** Small monochrome lock-open glyph — a host that refused our cert and is
 * being forwarded encrypted instead of intercepted. Shared by ClientsSidebar
 * (the passthrough list) and TopBar (the status pill). */
export function LockOpenIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 7.5-2" />
    </svg>
  );
}
