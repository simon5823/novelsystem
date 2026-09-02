import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

function Svg({ children, ...p }: P) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
      {children}
    </svg>
  );
}

export const Ico = {
  pen: (p: P) => (
    <Svg {...p}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </Svg>
  ),
  clock: (p: P) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  ),
  person: (p: P) => (
    <Svg {...p}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 19a7 7 0 0 1 14 0" />
    </Svg>
  ),
  globe: (p: P) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </Svg>
  ),
  branch: (p: P) => (
    <Svg {...p}>
      <circle cx="6" cy="6" r="2.2" />
      <circle cx="18" cy="6" r="2.2" />
      <circle cx="12" cy="18" r="2.2" />
      <path d="M8 7v2a4 4 0 0 0 4 4h0a4 4 0 0 0 4-4V7M12 13v3" />
    </Svg>
  ),
  book: (p: P) => (
    <Svg {...p}>
      <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Z" />
      <path d="M6 3v16" />
    </Svg>
  ),
  search: (p: P) => (
    <Svg {...p}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </Svg>
  ),
  gear: (p: P) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </Svg>
  ),
  save: (p: P) => (
    <Svg {...p}>
      <path d="M5 5h11l3 3v11H5Z" />
      <path d="M8 5v5h8M8 19v-6h8v6" />
    </Svg>
  ),
  folder: (p: P) => (
    <Svg {...p}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </Svg>
  ),
  file: (p: P) => (
    <Svg {...p}>
      <path d="M7 3h7l5 5v13H7Z" />
      <path d="M14 3v5h5" />
    </Svg>
  ),
  plus: (p: P) => (
    <Svg {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  ),
  trash: (p: P) => (
    <Svg {...p}>
      <path d="M4 7h16M9 7V5h6v2M8 7l1 13h6l1-13" />
    </Svg>
  ),
  undo: (p: P) => (
    <Svg {...p}>
      <path d="M9 8H5V4" />
      <path d="M5 8a8 8 0 1 1-1 5" />
    </Svg>
  ),
  redo: (p: P) => (
    <Svg {...p}>
      <path d="M15 8h4V4" />
      <path d="M19 8a8 8 0 1 0 1 5" />
    </Svg>
  ),
  inspector: (p: P) => (
    <Svg {...p}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M14 4v16M17 8h-3M17 12h-3" />
    </Svg>
  ),
  cards: (p: P) => (
    <Svg {...p}>
      <rect x="3" y="5" width="7" height="6" rx="1" />
      <rect x="13" y="5" width="8" height="6" rx="1" />
      <rect x="3" y="14" width="8" height="6" rx="1" />
      <rect x="14" y="14" width="7" height="6" rx="1" />
    </Svg>
  ),
  history: (p: P) => (
    <Svg {...p}>
      <path d="M4 12a8 8 0 1 0 2-5.3" />
      <path d="M4 5v5h5M12 8v4l3 2" />
    </Svg>
  ),
  export: (p: P) => (
    <Svg {...p}>
      <path d="M12 4v10M8 8l4-4 4 4" />
      <path d="M5 15v4h14v-4" />
    </Svg>
  ),
  focus: (p: P) => (
    <Svg {...p}>
      <path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" />
      <circle cx="12" cy="12" r="2.5" />
    </Svg>
  ),
  close: (p: P) => (
    <Svg {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  ),
  chevronL: (p: P) => (
    <Svg {...p}>
      <path d="m14 6-6 6 6 6" />
    </Svg>
  ),
  chevronR: (p: P) => (
    <Svg {...p}>
      <path d="m10 6 6 6-6 6" />
    </Svg>
  ),
  panel: (p: P) => (
    <Svg {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </Svg>
  ),
  zoomIn: (p: P) => (
    <Svg {...p}>
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4M11 8v6M8 11h6" />
    </Svg>
  ),
  zoomOut: (p: P) => (
    <Svg {...p}>
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4M8 11h6" />
    </Svg>
  ),
  restore: (p: P) => (
    <Svg {...p}>
      <path d="M4 13a8 8 0 1 0 2-5" />
      <path d="M4 5v5h5" />
    </Svg>
  ),
  open: (p: P) => (
    <Svg {...p}>
      <path d="M5 7h6l2 2h6v10H5Z" />
      <path d="M9 7V5h6l2 2" />
    </Svg>
  ),
  demo: (p: P) => (
    <Svg {...p}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M8 10h8M8 14h5" />
    </Svg>
  ),
  pin: (p: P) => (
    <Svg {...p}>
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2" />
    </Svg>
  ),
};
