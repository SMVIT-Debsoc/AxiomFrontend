import {useEffect, useState} from "react";
import QRCode from "qrcode";
import {cn} from "../../lib/utils";

// <QrCode value="https://..." size={240} label="Scan to check in" />
// SVG QR with high error correction. Dark modules are carbon on a white quiet
// zone in BOTH themes, so phones can always scan it (inverted QRs often fail).
export default function QrCode({value, size = 240, label, className}) {
  const [result, setResult] = useState({value: null, svg: "", error: false});

  useEffect(() => {
    if (!value) return undefined;
    let cancelled = false;
    QRCode.toString(String(value), {
      type: "svg",
      errorCorrectionLevel: "H",
      margin: 4,
      color: {dark: "#1D1E18", light: "#FFFFFF"},
    })
      .then((svg) => { if (!cancelled) setResult({value, svg, error: false}); })
      .catch(() => { if (!cancelled) setResult({value, svg: "", error: true}); });
    return () => { cancelled = true; };
  }, [value]);

  const ready = result.value === value && result.svg;
  const box = {width: size, height: size, maxWidth: "100%"};

  return (
    <figure className={cn("m-0 inline-flex flex-col items-center gap-2", className)}>
      {ready ? (
        <div
          role="img"
          aria-label={label ? `QR code: ${label}` : "QR code"}
          style={box}
          className="aspect-square overflow-hidden rounded-xl bg-white [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
          // SVG markup generated locally by the `qrcode` package from `value`.
          dangerouslySetInnerHTML={{__html: result.svg}}
        />
      ) : (
        <div
          role={result.error && result.value === value ? "alert" : "status"}
          style={box}
          className="grid aspect-square place-items-center rounded-xl bg-white p-4 text-center text-sm font-semibold text-[#1D1E18]"
        >
          {!value ? "No code yet" : result.error && result.value === value ? "Could not draw the QR code" : <span className="h-1/2 w-1/2 animate-pulse rounded-lg bg-[#1D1E18]/10" aria-label="Drawing QR code" />}
        </div>
      )}
      {label && <figcaption className="text-center text-sm font-semibold text-foreground">{label}</figcaption>}
    </figure>
  );
}
