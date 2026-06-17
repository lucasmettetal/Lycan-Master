interface SceneBackgroundProps {
  src: string;
  children: React.ReactNode;
  objectPosition?: string;
  glowColor?: string;
  glowPosition?: "top" | "center";
  bottomFade?: number;
}

export function SceneBackground({
  src,
  children,
  objectPosition = "center center",
  glowColor = "rgba(201,160,48,0.18)",
  glowPosition = "top",
  bottomFade = 0.75,
}: SceneBackgroundProps) {
  return (
    <div
      className="relative overflow-hidden"
      style={{ minHeight: "100%", background: "var(--bg-deep)" }}
    >
      {/* Image de fond */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <img
          src={src}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition,
          }}
        />
        {/* Assombrissement haut pour lisibilité */}
        <div
          className="absolute inset-x-0 top-0 h-1/2"
          style={{
            background:
              "linear-gradient(180deg, rgba(11,10,15,0.6) 0%, rgba(11,10,15,0.05) 100%)",
          }}
        />
        {/* Fondu bas vers fond profond */}
        <div
          className="absolute inset-x-0 bottom-0"
          style={{
            height: `${Math.round(bottomFade * 100)}%`,
            background: `linear-gradient(180deg, rgba(11,10,15,0) 0%, rgba(11,10,15,0.78) 40%, var(--bg-deep) 92%)`,
          }}
        />
        {/* Halo de lune */}
        <div
          className="absolute left-1/2 -translate-x-1/2 h-[280px] w-[280px] rounded-full"
          style={{
            top: glowPosition === "top" ? "4%" : "30%",
            background: `radial-gradient(circle, ${glowColor} 0%, rgba(201,160,48,0.04) 50%, transparent 70%)`,
          }}
        />
        {/* Vignette latérale */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(125% 95% at 50% 35%, transparent 50%, rgba(11,10,15,0.75) 100%)",
          }}
        />
      </div>

      {/* Contenu */}
      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-[430px] flex-col px-6 pb-10 pt-14">
        {children}
      </div>
    </div>
  );
}

export default SceneBackground;
