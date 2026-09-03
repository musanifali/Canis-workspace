/**
 * OG card as a real PNG (#100). SVG OG images do not render on X, LinkedIn or
 * Slack — they need a raster — so this is generated with next/og rather than
 * shipped as the SVG we use elsewhere.
 */
import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Ticora — generative UI that can only build what your contract allows";

export default function OG() {
  // A web drawn with plain divs: Satori supports transforms and borders, but
  // not arbitrary SVG paths reliably — so the motif is radial spokes + rings.
  const spokes = Array.from({ length: 18 }, (_, i) => (i * 180) / 18);
  const rings = [130, 200, 270, 340];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", position: "relative",
          background: "#07070b", fontFamily: "sans-serif", overflow: "hidden",
        }}
      >
        {/* web */}
        <div style={{ position: "absolute", right: -150, top: -70, width: 760, height: 760, display: "flex" }}>
          {spokes.map((deg) => (
            <div
              key={deg}
              style={{
                position: "absolute", left: 380, top: 0, width: 1, height: 760,
                background: "linear-gradient(180deg, rgba(232,180,74,0) 0%, rgba(232,180,74,0.5) 50%, rgba(232,180,74,0) 100%)",
                transform: `rotate(${deg}deg)`,
              }}
            />
          ))}
          {rings.map((r) => (
            <div
              key={r}
              style={{
                position: "absolute", left: 380 - r, top: 380 - r, width: r * 2, height: r * 2,
                border: "1px solid rgba(232,180,74,0.34)", borderRadius: r,
              }}
            />
          ))}
        </div>
        {/* copy */}
        <div style={{ display: "flex", flexDirection: "column", padding: "0 80px", justifyContent: "center", zIndex: 1 }}>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 5, color: "#938f86", marginBottom: 26 }}>
            TICORA
          </div>
          <div style={{ display: "flex", fontSize: 78, fontWeight: 700, color: "#f5f2ea", letterSpacing: -3 }}>
            One thread in.
          </div>
          <div style={{ display: "flex", fontSize: 78, fontWeight: 700, color: "#e8b44a", letterSpacing: -3 }}>
            Structure out.
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#a8a49a", marginTop: 26, maxWidth: 640 }}>
            Generative UI that can only build what your data contract allows.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
