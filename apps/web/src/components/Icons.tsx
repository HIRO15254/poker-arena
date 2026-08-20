/**
 * インライン stroke SVG アイコン (Tabler スタイル)。
 * viewBox 24x24 / stroke-width 2 / round caps。絵文字は使わない。
 */

import type { ReactNode } from "react";

interface IconProps {
  className?: string;
}

function Stroke({ className = "icn", children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function IconTrophy(p: IconProps) {
  return (
    <Stroke {...p}>
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v6a5 5 0 0 1-10 0z" />
      <path d="M7 6H4a2 2 0 0 0 2 4" />
      <path d="M17 6h3a2 2 0 0 1-2 4" />
    </Stroke>
  );
}

export function IconEye(p: IconProps) {
  return (
    <Stroke {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
    </Stroke>
  );
}

export function IconRobot(p: IconProps) {
  return (
    <Stroke {...p}>
      <rect x="5" y="9" width="14" height="10" rx="2" />
      <path d="M12 9V6" />
      <circle cx="12" cy="4.5" r="1.5" />
      <path d="M9.5 13.5h.01" />
      <path d="M14.5 13.5h.01" />
      <path d="M9.5 16.5h5" />
    </Stroke>
  );
}

export function IconHistory(p: IconProps) {
  return (
    <Stroke {...p}>
      <path d="M12 8v4l3 3" />
      <path d="M3.5 11a8.5 8.5 0 1 1 .6 4.2" />
      <path d="M3 5.5V11h5.5" />
    </Stroke>
  );
}

export function IconCards(p: IconProps) {
  return (
    <Stroke {...p}>
      <rect x="9" y="3" width="11" height="15" rx="2" />
      <path d="M5.5 7 4.1 17.4a2 2 0 0 0 1.7 2.2l7.4 1" />
      <path d="M13 8.5v5" />
      <path d="M16.5 11h-5" />
    </Stroke>
  );
}

export function IconSearch(p: IconProps) {
  return (
    <Stroke {...p}>
      <circle cx="10" cy="10" r="7" />
      <path d="M21 21l-6-6" />
    </Stroke>
  );
}

export function IconChevronDown(p: IconProps) {
  return (
    <Stroke {...p}>
      <path d="M6 9l6 6 6-6" />
    </Stroke>
  );
}

export function IconChevronRight(p: IconProps) {
  return (
    <Stroke {...p}>
      <path d="M9 6l6 6-6 6" />
    </Stroke>
  );
}

export function IconChevronLeft(p: IconProps) {
  return (
    <Stroke {...p}>
      <path d="M15 6l-6 6 6 6" />
    </Stroke>
  );
}

export function IconPlus(p: IconProps) {
  return (
    <Stroke {...p}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Stroke>
  );
}

export function IconUsers(p: IconProps) {
  return (
    <Stroke {...p}>
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      <path d="M16 3.1a4 4 0 0 1 0 7.8" />
      <path d="M21 21v-2a4 4 0 0 0-3-3.9" />
    </Stroke>
  );
}

export function IconClock(p: IconProps) {
  return (
    <Stroke {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </Stroke>
  );
}

export function IconPlay(p: IconProps) {
  return (
    <Stroke {...p}>
      <path d="M7 4v16l13-8z" />
    </Stroke>
  );
}

export function IconPause(p: IconProps) {
  return (
    <Stroke {...p}>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </Stroke>
  );
}

export function IconSkipBack(p: IconProps) {
  return (
    <Stroke {...p}>
      <path d="M20 5v14L9 12z" />
      <path d="M5 5v14" />
    </Stroke>
  );
}

export function IconSkipForward(p: IconProps) {
  return (
    <Stroke {...p}>
      <path d="M4 5v14l11-7z" />
      <path d="M19 5v14" />
    </Stroke>
  );
}

export function IconKey(p: IconProps) {
  return (
    <Stroke {...p}>
      <circle cx="8" cy="15" r="4" />
      <path d="M10.9 12.1L19 4" />
      <path d="M17.5 5.5l2 2" />
      <path d="M14.5 8.5l2 2" />
    </Stroke>
  );
}

export function IconUpload(p: IconProps) {
  return (
    <Stroke {...p}>
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      <path d="M7 9l5-5 5 5" />
      <path d="M12 4v12" />
    </Stroke>
  );
}

export function IconRefresh(p: IconProps) {
  return (
    <Stroke {...p}>
      <path d="M20 11a8 8 0 1 0-.6 4" />
      <path d="M20 4v7h-7" />
    </Stroke>
  );
}

export function IconAlert(p: IconProps) {
  return (
    <Stroke {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
    </Stroke>
  );
}

export function IconCheck(p: IconProps) {
  return (
    <Stroke {...p}>
      <path d="M5 12.5l5 5L19 7" />
    </Stroke>
  );
}

export function IconCopy(p: IconProps) {
  return (
    <Stroke {...p}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 5.5A2.5 2.5 0 0 0 12.5 4H6a2 2 0 0 0-2 2v6.5A2.5 2.5 0 0 0 6.5 15" />
    </Stroke>
  );
}

export function IconTrash(p: IconProps) {
  return (
    <Stroke {...p}>
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M9 7V4h6v3" />
    </Stroke>
  );
}

export function IconPower(p: IconProps) {
  return (
    <Stroke {...p}>
      <path d="M12 4v8" />
      <path d="M7.5 7a7 7 0 1 0 9 0" />
    </Stroke>
  );
}

export function IconLogout(p: IconProps) {
  return (
    <Stroke {...p}>
      <path d="M14 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2" />
      <path d="M20 12H10" />
      <path d="M17 9l3 3-3 3" />
    </Stroke>
  );
}
