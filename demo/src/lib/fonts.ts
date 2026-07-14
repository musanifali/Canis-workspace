import localFont from "next/font/local";

export const sentient = localFont({
  src: [
    {
      path: "../../public/fonts/Sentient/Sentient-Light.woff2",
      weight: "300",
      style: "normal",
    },
  ],
  display: "swap",
  variable: "--font-sentient",
  fallback: ["Georgia", "serif"],
});

export const geist = localFont({
  src: [
    {
      path: "../../public/fonts/Geist/Geist-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/Geist/Geist-Medium.woff2",
      weight: "500",
      style: "normal",
    },
  ],
  display: "swap",
  variable: "--font-geist",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

export const geistMono = localFont({
  src: [
    {
      path: "../../public/fonts/GeistMono/GeistMono-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/GeistMono/GeistMono-Medium.woff2",
      weight: "500",
      style: "normal",
    },
  ],
  display: "swap",
  variable: "--font-geist-mono",
  fallback: ["ui-monospace", "SFMono-Regular", "monospace"],
});

export const fontVariables = `${sentient.variable} ${geist.variable} ${geistMono.variable}`;
