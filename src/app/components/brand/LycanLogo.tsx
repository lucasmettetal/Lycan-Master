interface LycanLogoProps {
  size?: number;
  className?: string;
}

export function LycanLogo({ size = 160, className }: LycanLogoProps) {
  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: "9999px",
        boxShadow:
          "0 0 0 2px var(--gold), 0 0 0 6px rgba(201,160,48,0.18), 0 0 36px 4px rgba(201,160,48,0.28)",
        overflow: "hidden",
        background: "var(--bg-deep)",
        flexShrink: 0,
      }}
    >
      <img
        src="/lycan/wolf-emblem.png"
        alt="Emblème Lycan Master"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: "scale(1.08)",
        }}
      />
      {/* Vignette interne pour fondre les bords */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "9999px",
          boxShadow: "inset 0 0 24px 6px rgba(11,10,15,0.55)",
        }}
      />
    </div>
  );
}

export default LycanLogo;
