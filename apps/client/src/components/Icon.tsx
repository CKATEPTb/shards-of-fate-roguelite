type IconName =
  | "play"
  | "pause"
  | "step"
  | "reset"
  | "save"
  | "load"
  | "sun"
  | "sword"
  | "shield"
  | "heart"
  | "dice"
  | "check"
  | "leaf";
const paths: Record<IconName, string> = {
  play: "M8 5 19 12 8 19Z",
  pause: "M8 5v14M16 5v14",
  step: "m5 5 10 7-10 7ZM19 5v14",
  reset: "M4 10a8 8 0 1 1 1 7M4 4v6h6",
  save: "M5 3h12l4 4v14H3V3ZM7 3v7h10V3M7 21v-7h10v7",
  load: "M4 12v8h16v-8M12 3v12m-5-5 5 5 5-5",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1",
  sword: "m5 19 3-3m0-5 5 5m-3-3 9-9 1 1-1 4-7 7M4 20l1 1 3-3-1-1Z",
  shield: "m12 3 8 3v6c0 4-8 9-8 9S4 16 4 12V6Z",
  heart: "M12 20 4 12a5 5 0 0 1 8-6 5 5 0 0 1 8 6Z",
  dice: "m12 2 10 7-4 12H6L2 9Zm0 0L6 21 22 9H2l16 12Z",
  check: "m5 12 4 4L19 6",
  leaf: "M5 19C-1 7 9 3 20 4c1 13-7 19-15 15Zm0 0L16 8",
};
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
