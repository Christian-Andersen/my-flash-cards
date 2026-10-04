import type { AccentName } from "../lib/types";

/**
 * Per-accent class sets, written out as complete literals.
 *
 * Tailwind scans source text for class names, so composing these from
 * fragments like `` `text-${accent}-300` `` would produce classes it never
 * sees and the styles would be dropped from the build. Full literals keep
 * the scanner working.
 */
type AccentStyles = {
  readonly chip: string;
  readonly dot: string;
  readonly edge: string;
};

export const ACCENT_STYLES: Readonly<Record<AccentName, AccentStyles>> = {
  amber: {
    chip: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    dot: "bg-amber-400",
    edge: "from-amber-500/40",
  },
  blue: {
    chip: "border-blue-500/30 bg-blue-500/10 text-blue-300",
    dot: "bg-blue-400",
    edge: "from-blue-500/40",
  },
  cyan: {
    chip: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
    dot: "bg-cyan-400",
    edge: "from-cyan-500/40",
  },
  emerald: {
    chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    dot: "bg-emerald-400",
    edge: "from-emerald-500/40",
  },
  indigo: {
    chip: "border-indigo-500/30 bg-indigo-500/10 text-indigo-300",
    dot: "bg-indigo-400",
    edge: "from-indigo-500/40",
  },
  orange: {
    chip: "border-orange-500/30 bg-orange-500/10 text-orange-300",
    dot: "bg-orange-400",
    edge: "from-orange-500/40",
  },
  rose: {
    chip: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    dot: "bg-rose-400",
    edge: "from-rose-500/40",
  },
  sky: {
    chip: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    dot: "bg-sky-400",
    edge: "from-sky-500/40",
  },
  teal: {
    chip: "border-teal-500/30 bg-teal-500/10 text-teal-300",
    dot: "bg-teal-400",
    edge: "from-teal-500/40",
  },
  violet: {
    chip: "border-violet-500/30 bg-violet-500/10 text-violet-300",
    dot: "bg-violet-400",
    edge: "from-violet-500/40",
  },
};
