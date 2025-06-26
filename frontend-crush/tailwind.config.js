/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./*.html", "./src/**/*.{html,js}"],
  theme: {
    extend: {
      colors: {
        // Custom color palette - Warm & Cozy
        cream: {
          50: "#fdfcfb",
          100: "#faf8f5",
          200: "#f5f0e8",
          300: "#ede4d3",
          400: "#e0d0b7",
          500: "#d4a574",
          600: "#c8956a",
          700: "#b8845c",
          800: "#a67c5a",
          900: "#8b7355",
        },
        sage: {
          50: "#f6f7f6",
          100: "#e3e7e3",
          200: "#c7d0c7",
          300: "#a3b2a3",
          400: "#7d917d",
          500: "#5f7a5f",
          600: "#4a604a",
          700: "#3d4f3d",
          800: "#334133",
          900: "#2a352a",
        },
        warm: {
          50: "#fefdfb",
          100: "#fef7ed",
          200: "#fdecd4",
          300: "#fbdbb0",
          400: "#f8c584",
          500: "#f4a855",
          600: "#ec8b2f",
          700: "#d97121",
          800: "#b5591e",
          900: "#92481d",
        },
      },
      fontFamily: {
        serif: ["Crimson Text", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Crimson Text", "Georgia", "serif"],
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "fade-in": "fadeIn 2s ease-in-out",
        "slide-up": "slideUp 1s ease-out",
        twinkle: "twinkle 2s ease-in-out infinite alternate",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(30px)", opacity: "0" },
          "100%": { transform: "translateY(0px)", opacity: "1" },
        },
        twinkle: {
          "0%": { opacity: "0.3" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
