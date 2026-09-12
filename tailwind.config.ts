import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        cocoa: {
          50: "#FAF6F3",
          100: "#F3EAE5",
          200: "#E6DAD5",
          300: "#C8B5AD",
          400: "#806A64",
          500: "#75625C",
          600: "#68544F",
          700: "#583F39",
          800: "#49312C",
          900: "#3D2926",
          950: "#281E1C",
        },
        azalea: {
          DEFAULT: "#F578B0",
          50: "#FFF0F6",
          100: "#FDE0ED",
          200: "#FBC4DD",
          300: "#F9A0C7",
          400: "#F578B0",
          500: "#DC4F8D",
          600: "#B32C68",
          700: "#922452",
          800: "#751F44",
          900: "#5F1F3A",
        },
        ink: {
          DEFAULT: "#281E1C",
          soft: "#583F39",
        },
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
