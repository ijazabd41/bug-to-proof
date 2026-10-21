import React from "react";

const paths = {
  cases: "M5 3h14v18H5z M9 7h6 M9 11h6 M9 15h4",
  proof: "M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7z M8 12l3 3 5-6",
  arrow: "M9 5l7 7-7 7",
  plus: "M12 5v14 M5 12h14",
  code: "M8 6 2 12l6 6 M16 6l6 6-6 6 M14 3l-4 18",
  check: "M5 12l4 4L19 6",
  search: "M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z",
  refresh: "M21 12a9 9 0 11-2.636-6.364M21 3v6h-6",
  terminal: "M4 17l6-5-6-5M12 19h8",
  sparkles: "M12 2v4m0 12v4M2 12h4m12 0h4m-3.5-6.5l-2.8 2.8m-7.4 7.4l-2.8 2.8m0-13l2.8 2.8m7.4 7.4l2.8 2.8",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  filter: "M22 3H2l8 9.46V19l4 2v-8.54L22 3z",
  external: "M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3",
} as const;

export function Icon({ name, size = 18 }: { name: keyof typeof paths; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon icon-${name}`}
    >
      <path d={paths[name]} />
    </svg>
  );
}
