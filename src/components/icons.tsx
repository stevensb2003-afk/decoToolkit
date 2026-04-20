import type { SVGProps } from "react";
// This file is now unused, but is kept to avoid breaking imports.
// It can be safely removed if no other component is using it.
export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 12.2c-.3-3.6-2.2-6.8-5-9.2-2.2-1.9-4.8-3-7.5-3-2.9.3-5.5,1.7-7.5,4C.2,7.2,0,10.2,0,13.2c0,3.3,1.1,6.3,3.3,8.8,2.2,2.5,5.3,4,8.7,4,3.1,0,6.1-1.3,8.4-3.5 2-1.9,3.1-4.3,3.6-7.1" />
      <path d="M2.5,14c5-5,10-5,15,0" />
      <path d="M5.5,17c4-4,8-4,12,0" />
    </svg>
  );
}
