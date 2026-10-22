import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#0d9668", foreground: "#ffffff" },
      },
    },
  },
  plugins: [],
};
export default config;