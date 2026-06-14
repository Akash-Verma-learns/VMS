/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#1F3864", light: "#2E4A7A", dark: "#152645" },
        teal: { DEFAULT: "#0E7490", light: "#0EA5C9" },
        upsc: { bg: "#F8FAFC", card: "#FFFFFF" },
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
}
