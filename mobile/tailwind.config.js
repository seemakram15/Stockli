/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "#8b5cf6",
          dim: "#3b2d6e",
          text: "#c4b5fd",
        },
        gain: {
          DEFAULT: "#34d399",
          dim: "#0d3328",
        },
        loss: {
          DEFAULT: "#f87171",
          dim: "#3b1212",
        },
        warn: {
          DEFAULT: "#fbbf24",
          dim: "#3b2800",
        },
        sky: {
          DEFAULT: "#38bdf8",
          dim: "#0b2a3b",
        },
        surface: {
          DEFAULT: "#17171f",
          2: "#1e1e28",
        },
        border: "#2a2a38",
        muted: "#8888a8",
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "20px",
      },
    },
  },
  plugins: [],
};
