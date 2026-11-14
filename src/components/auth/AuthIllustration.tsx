/** Small line-art scenes for the auth pages, drawn in the brand colours. */

export type IllustrationName = "shop" | "welcome" | "mail" | "key" | "done";

const NAVY = "#002583";
const YELLOW = "#ffb800";
const SOFT = "#e9edf8";

function Sparkles() {
  return (
    <g fill={YELLOW}>
      <path d="M38 34l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />
      <circle cx="172" cy="42" r="4" />
      <circle cx="186" cy="150" r="3" opacity=".7" />
      <circle cx="26" cy="140" r="3" opacity=".7" />
    </g>
  );
}

function Bag({ x = 70, y = 62 }: { x?: number; y?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M18 20V12a12 12 0 0 1 24 0v8" fill="none" stroke={NAVY} strokeWidth="5" strokeLinecap="round" />
      <path d="M4 18h52a3 3 0 0 1 3 3l4 55a5 5 0 0 1-5 5H2a5 5 0 0 1-5-5l4-55a3 3 0 0 1 3-3z" fill={YELLOW} />
      <circle cx="18" cy="26" r="3" fill={NAVY} />
      <circle cx="42" cy="26" r="3" fill={NAVY} />
      <path d="M20 46c3 6 17 6 20 0" fill="none" stroke={NAVY} strokeWidth="4" strokeLinecap="round" />
    </g>
  );
}

const SCENES: Record<IllustrationName, React.ReactNode> = {
  shop: (
    <>
      <path d="M44 86h112v70H44z" fill={SOFT} />
      <path d="M38 70h124l-8 20H46z" fill={YELLOW} />
      <path d="M38 70l10-22h104l10 22" fill={NAVY} />
      <path d="M90 118h22v38H90z" fill={NAVY} />
      <rect x="54" y="104" width="24" height="20" rx="3" fill="#fff" stroke={NAVY} strokeWidth="3" />
      <rect x="124" y="104" width="24" height="20" rx="3" fill="#fff" stroke={NAVY} strokeWidth="3" />
      <path d="M30 156h140" stroke={NAVY} strokeWidth="4" strokeLinecap="round" />
    </>
  ),
  welcome: (
    <>
      <circle cx="100" cy="102" r="58" fill={SOFT} />
      <Bag />
    </>
  ),
  mail: (
    <>
      <circle cx="100" cy="102" r="58" fill={SOFT} />
      <rect x="50" y="72" width="100" height="66" rx="8" fill="#fff" stroke={NAVY} strokeWidth="4" />
      <path d="M54 78l46 34 46-34" fill="none" stroke={NAVY} strokeWidth="4" strokeLinejoin="round" />
      <circle cx="146" cy="72" r="16" fill={YELLOW} />
      <path d="M139 72l5 5 9-10" fill="none" stroke={NAVY} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  key: (
    <>
      <circle cx="100" cy="102" r="58" fill={SOFT} />
      <path d="M80 92V78a20 20 0 0 1 40 0v14" fill="none" stroke={NAVY} strokeWidth="6" strokeLinecap="round" />
      <rect x="66" y="90" width="68" height="54" rx="10" fill={YELLOW} />
      <circle cx="100" cy="112" r="7" fill={NAVY} />
      <path d="M100 116v12" stroke={NAVY} strokeWidth="5" strokeLinecap="round" />
    </>
  ),
  done: (
    <>
      <circle cx="100" cy="102" r="58" fill={SOFT} />
      <circle cx="100" cy="102" r="36" fill={YELLOW} />
      <path d="M84 102l11 11 22-24" fill="none" stroke={NAVY} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
};

export default function AuthIllustration({ name, className }: { name: IllustrationName; className?: string }) {
  return (
    <svg viewBox="0 0 200 190" aria-hidden="true" className={className}>
      <Sparkles />
      {SCENES[name]}
    </svg>
  );
}
