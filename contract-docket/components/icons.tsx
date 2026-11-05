import type { SVGProps } from "react";

type IconName =
  | "archive"
  | "arrow"
  | "bell"
  | "check"
  | "chevron"
  | "close"
  | "contract"
  | "download"
  | "edit"
  | "file"
  | "help"
  | "mail"
  | "plus"
  | "search"
  | "send"
  | "upload";

const paths: Record<IconName, React.ReactNode> = {
  archive: (
    <>
      <path d="M3 5.5h18v4H3z" />
      <path d="M5 9.5v10h14v-10M9 13h6" />
    </>
  ),
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  bell: (
    <>
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  contract: (
    <>
      <path d="M6 3.75h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.75a1 1 0 0 1 1-1Z" />
      <path d="M14 4v4h4M8 12h8m-8 4h5" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12m-5-5 5 5 5-5M4 20h16" />
    </>
  ),
  edit: (
    <>
      <path d="m14 5 5 5M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4Z" />
    </>
  ),
  file: (
    <>
      <path d="M6 3.75h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.75a1 1 0 0 1 1-1Z" />
      <path d="M14 4v4h4" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9a2.5 2.5 0 1 1 4.5 1.5c-.9 1-2.1 1.2-2.1 2.8m0 3h.01" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  plus: <path d="M12 5v14m-7-7h14" />,
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 4 4" />
    </>
  ),
  send: (
    <>
      <path d="m21 3-7.5 18-3.8-7.7L2 9.5 21 3Z" />
      <path d="M9.7 13.3 21 3" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4m-5 5 5-5 5 5M4 20h16" />
    </>
  ),
};

export function Icon({
  name,
  size = 18,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
