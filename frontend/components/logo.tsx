import { siteConfig } from "@/lib/config";
import type { ReactNode } from "react";

/**
 * The mark is a B cut from tesserae — the same unit the fold artwork is built
 * from, reduced to the smallest count of tiles that still reads as the letter.
 *
 * It sits bare on the surface. No tile, no chip, no rounded square behind it:
 * a mark parked on a coloured box is a component-kit default, and the letter
 * carries enough weight to hold its own space.
 */

/** Column/row coordinates on a 3x5 grid: the stem, and the two bowls. */
const CELLS: [number, number][] = [
  [0, 0], [1, 0], [2, 0],
  [0, 1], [2, 1],
  [0, 2], [1, 2],
  [0, 3], [2, 3],
  [0, 4], [1, 4], [2, 4],
];

/** Grid step and tile size in viewBox units — the 1-unit remainder is grout. */
const STEP = 6;
const TILE = 5;

export function BailiffMark({ className = "h-5 w-auto" }: { className?: string }): ReactNode {
  return (
    <svg viewBox="0 0 17 29" fill="none" className={className} aria-hidden="true">
      {CELLS.map(([c, r]) => (
        <rect
          key={`${c}-${r}`}
          x={c * STEP}
          y={r * STEP}
          width={TILE}
          height={TILE}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}

export function BailiffLogo({
  className = "",
  word = true,
}: {
  className?: string;
  word?: boolean;
}): ReactNode {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* Sized in em so the mark tracks the wordmark's cap height wherever the
          lockup is used, rather than being pinned to one pixel size. */}
      <BailiffMark className="h-[0.95em] w-auto" />
      {word && (
        <span className="text-[1.0625rem] leading-none font-medium tracking-tight">
          {siteConfig.name}
        </span>
      )}
    </span>
  );
}
