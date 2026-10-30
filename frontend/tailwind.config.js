/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkNavy: '#0B1E36',
        deepSlate: '#0F172A',
        navy: {
          800: '#15294A',
          850: '#0E223D',
          900: '#0B1E36',
          950: '#071526',
        },
        brand: {
          primary: '#0B1E36',
          secondary: '#0F172A',
          accent: '#2563EB',
        },
        risk: {
          low: '#16A34A',
          moderate: '#D97706',
          high: '#EA580C',
          critical: '#DC2626',
        }
      },
    },
  },
  plugins: [],
}
