import type { DeviceKind } from "../types";

/** Small monochrome device glyph, picked by detected client kind. */
export function DeviceIcon({ kind, size = 16 }: { kind?: DeviceKind; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (kind) {
    case "phone":
      return (<svg {...p}><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><line x1="11" y1="18.5" x2="13" y2="18.5" /></svg>);
    case "tablet":
      return (<svg {...p}><rect x="5" y="3" width="14" height="18" rx="2" /><line x1="11" y1="18" x2="13" y2="18" /></svg>);
    case "laptop":
      return (<svg {...p}><rect x="4" y="5" width="16" height="11" rx="1.5" /><path d="M2 19h20" /></svg>);
    case "desktop":
      return (<svg {...p}><rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M9 20h6M12 16v4" /></svg>);
    default:
      return (<svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.3 2.5 14.7 0 17M12 3.5c-2.5 2.3-2.5 14.7 0 17" /></svg>);
  }
}
