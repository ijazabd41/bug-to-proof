import React from "react";
const paths = {
  cases: "M5 3h14v18H5z M9 7h6 M9 11h6 M9 15h4",
  proof: "M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7z M8 12l3 3 5-6",
  arrow: "M9 5l7 7-7 7", plus: "M12 5v14 M5 12h14",
  code: "M8 6 2 12l6 6 M16 6l6 6-6 6 M14 3l-4 18",
  check: "M5 12l4 4L19 6",
} as const;
export function Icon({ name }: { name: keyof typeof paths }) {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}
