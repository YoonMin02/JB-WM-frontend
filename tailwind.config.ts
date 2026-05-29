import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // ─── JB Financial Group Brand Colors ───────────────────────────
      colors: {
        blue: {
          950: "#0B235B",
          900: "#0A31A8", // primary — body bg, filled buttons
          850: "#0D2A8A",
          800: "#0D2D77",
          750: "#123ECC",
          700: "#1C56FF", // interactive accent — links, hover
          600: "#1850FF",
          400: "#598AFF",
          300: "#7AA1FF",
          200: "#26A2F8",
          100: "#31B6F0",
          50:  "#F0F4FF", // blue-tinted background
        },
        gray: {
          400: "#B2B2B2", // muted / inactive
          300: "#D5DBE5", // borders
          200: "#E5E5E5", // dividers
          100: "#F3F3F3",
          50:  "#F6F7FB",
          25:  "#FAFAFA",
        },
        green: {
          400: "#51E3A4", // positive indicator
          200: "#9ECFA9",
        },
        text: {
          primary:   "#333333",
          secondary: "#444444",
          muted:     "#666666",
          light:     "#848484",
          disabled:  "#999999",
        },
      },

      // ─── Typography ─────────────────────────────────────────────────
      fontFamily: {
        sans: [
          "SUIT Variable",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        en: [
          "roc-grotesk",
          "SUIT Variable",
          "-apple-system",
          "BlinkMacSystemFont",
          "sans-serif",
        ],
      },

      fontSize: {
        // fluid base — override in globals.css with clamp()
        "headline-1": ["4.889rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "headline-2": ["3.556rem", { lineHeight: "1.3", letterSpacing: "-0.02em" }],
        "headline-3": ["2.667rem", { lineHeight: "1.5", letterSpacing: "-0.02em" }],
        "title-0":    ["4rem",     { lineHeight: "1.2", letterSpacing: "-0.03em" }],
        "title-1":    ["2.222rem", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
        "title-2":    ["1.778rem", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
        "title-3":    ["1.333rem", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
        "title-4":    ["1.222rem", { lineHeight: "1.4", letterSpacing: "-0.02em" }],
        "body-1":     ["1.111rem", { lineHeight: "1.6", letterSpacing: "-0.02em" }],
        "body-2":     ["1rem",     { lineHeight: "1.6", letterSpacing: "-0.02em" }],
        "body-3":     ["0.889rem", { lineHeight: "1.6", letterSpacing: "-0.02em" }],
        "body-4":     ["0.778rem", { lineHeight: "1.6", letterSpacing: "-0.02em" }],
      },

      fontWeight: {
        base: "600",
      },

      letterSpacing: {
        brand: "-0.02em",
        "brand-tight": "-0.03em",
      },

      // ─── Layout ─────────────────────────────────────────────────────
      maxWidth: {
        "boxed":    "2086px",
        "boxed-lg": "87rem",   // ~1390px
        "boxed-md": "74rem",   // ~1180px
        "boxed-sm": "56rem",   // ~890px
      },

      borderRadius: {
        pill:      "3em",
        "card-lg": "1.778rem",
        "card-md": "1.333rem",
      },

      // ─── Header ─────────────────────────────────────────────────────
      height: {
        header:        "6.111rem",  // ~98px desktop
        "header-mobile": "62px",
      },

      zIndex: {
        header: "9999",
      },

      // ─── Transitions ────────────────────────────────────────────────
      transitionDuration: {
        fast:   "100ms",
        base:   "200ms",
        smooth: "300ms",
        slow:   "500ms",
      },
    },
  },
  plugins: [],
} satisfies Config;
