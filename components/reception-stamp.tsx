export function ReceptionStamp({
  instrument,
  fee,
  state,
}: {
  instrument: string;
  fee: number;
  state: "sealed" | "redacted";
}) {
  const color = state === "redacted" ? "var(--danger)" : "var(--stamp-bright)";
  const mark = state === "redacted" ? "REDACTED" : "SEALED";
  return (
    <svg
      viewBox="0 0 180 180"
      className="stamp-press h-36 w-36 shrink-0"
      style={{ color }}
      aria-hidden="true"
    >
      <circle cx="90" cy="90" r="78" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="90" cy="90" r="70" fill="none" stroke="currentColor" strokeWidth="1" />
      <text
        x="90"
        y="62"
        textAnchor="middle"
        fill="currentColor"
        fontFamily="Barlow Condensed, sans-serif"
        fontSize="16"
        fontWeight="600"
      >
        RECORDED
      </text>
      <text
        x="90"
        y="92"
        textAnchor="middle"
        fill="currentColor"
        fontFamily="Barlow Condensed, sans-serif"
        fontSize="22"
        fontWeight="600"
      >
        {instrument.toUpperCase()}
      </text>
      <text
        x="90"
        y="116"
        textAnchor="middle"
        fill="currentColor"
        fontFamily="Barlow Condensed, sans-serif"
        fontSize="15"
      >
        FEE {fee}
      </text>
      <text
        x="90"
        y="140"
        textAnchor="middle"
        fill="currentColor"
        fontFamily="Barlow Condensed, sans-serif"
        fontSize="16"
        fontWeight="600"
      >
        {mark}
      </text>
    </svg>
  );
}
