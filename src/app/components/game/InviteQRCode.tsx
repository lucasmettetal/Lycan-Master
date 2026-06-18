import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check } from "lucide-react";

type Props =
  | { mode: "session"; sessionCode: string; inviteUrl: string; onCopy?: () => void }
  | { mode: "static"; inviteUrl: string; onCopy?: () => void };

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch { /* fallback */ }
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.cssText = "position:fixed;top:-9999px;left:-9999px";
    document.body.appendChild(el);
    el.focus();
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
    return;
  } catch { /* fallback */ }
  prompt("Copie ce lien :", text);
}

export function InviteQRCode(props: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await copyToClipboard(props.inviteUrl);
    setCopied(true);
    props.onCopy?.();
    setTimeout(() => setCopied(false), 2200);
  };

  const isSession = props.mode === "session";
  const displayUrl = props.inviteUrl.replace(/^https?:\/\//, "");

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: isSession ? "rgba(11,10,15,0.72)" : "rgba(11,10,15,0.6)",
        border: isSession
          ? "1px solid rgba(201,160,48,0.18)"
          : "1px solid rgba(201,160,48,0.1)",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <p
          className="text-[9px] uppercase tracking-[0.28em] mb-1"
          style={{
            fontFamily: "var(--font-mono)",
            color: isSession ? "rgba(201,160,48,0.55)" : "rgba(201,160,48,0.35)",
          }}
        >
          {isSession ? "QR de cette partie" : "QR permanent · À imprimer"}
        </p>
        {isSession ? (
          <p
            className="text-xl tracking-[0.22em] font-bold"
            style={{ fontFamily: "var(--font-display)", color: "var(--gold)" }}
          >
            {props.sessionCode}
          </p>
        ) : (
          <p
            className="text-sm leading-snug"
            style={{
              fontFamily: "var(--font-body)",
              color: "rgba(200,192,176,0.5)",
              fontStyle: "italic",
            }}
          >
            Les joueurs scannent, puis saisissent le code de partie.
          </p>
        )}
      </div>

      {/* QR Code — fond blanc pour scannabilité */}
      <div className="flex justify-center px-5 pb-4">
        <div
          className="rounded-xl p-3"
          style={{ background: "#ffffff", display: "inline-block" }}
        >
          <QRCodeSVG
            value={props.inviteUrl}
            size={isSession ? 220 : 200}
            bgColor="#ffffff"
            fgColor="#0b0a0f"
            level="M"
          />
        </div>
      </div>

      {/* Message produit */}
      <div className="px-5 pb-3 flex flex-col items-center gap-0.5">
        {isSession ? (
          <>
            <p
              className="text-[10px] text-center"
              style={{ fontFamily: "var(--font-mono)", color: "rgba(200,192,176,0.45)" }}
            >
              Scanne avec ton téléphone · Aucune installation
            </p>
            <p
              className="text-[10px] text-center"
              style={{ fontFamily: "var(--font-mono)", color: "rgba(200,192,176,0.3)" }}
            >
              Compatible iPhone et Android via navigateur
            </p>
          </>
        ) : (
          <p
            className="text-[10px] text-center"
            style={{ fontFamily: "var(--font-mono)", color: "rgba(200,192,176,0.3)" }}
          >
            Imprime ce QR · Valable pour toutes tes soirées
          </p>
        )}
      </div>

      {/* URL + bouton copier */}
      <div className="px-4 pb-5">
        <button
          onClick={handleCopy}
          className="w-full flex items-center gap-3 rounded-xl px-4 py-3 transition-all active:scale-[0.98]"
          style={{
            background: copied ? "rgba(74,222,128,0.08)" : "rgba(201,160,48,0.05)",
            border: `1px solid ${copied ? "rgba(74,222,128,0.3)" : "rgba(201,160,48,0.12)"}`,
          }}
        >
          <span
            className="flex-1 text-left text-[10px] truncate"
            style={{
              fontFamily: "var(--font-mono)",
              color: copied ? "rgba(74,222,128,0.7)" : "rgba(200,192,176,0.38)",
            }}
          >
            {copied ? "✓ Lien copié !" : displayUrl}
          </span>
          <div
            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
            style={{
              background: copied ? "rgba(74,222,128,0.15)" : "rgba(201,160,48,0.08)",
              color: copied ? "rgba(74,222,128,0.85)" : "rgba(201,160,48,0.55)",
            }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </div>
        </button>
      </div>
    </div>
  );
}
