/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)", card: "var(--card)", ink: "var(--ink)", acc: "var(--acc)",
        k: "#111", y: "#ffe45c", b: "#3346e0", lb: "#b8dcf5", pu: "#c8b6ff", co: "#ff7f6e",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        head: ["var(--font-head)", "var(--font-inter)", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
