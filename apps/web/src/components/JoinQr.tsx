import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * QR code for the join link on the big screen: a stranger scans, joins, and is in the game in under a
 * minute (the judges' "60 seconds, zero explanation" test). Rendered client-side as an SVG data URL.
 */
export function JoinQr({ url, size = 132 }: { url: string; size?: number }) {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { margin: 1, width: size * 2, color: { dark: '#ffffff', light: '#00000000' }, errorCorrectionLevel: 'M' })
      .then((s) => { if (!cancelled) setSrc(s); })
      .catch(() => { if (!cancelled) setSrc(undefined); });
    return () => { cancelled = true; };
  }, [url, size]);
  if (!src) return null;
  return <img src={src} width={size} height={size} alt={`QR code: ${url}`} style={{ display: 'block', imageRendering: 'pixelated' }} />;
}
