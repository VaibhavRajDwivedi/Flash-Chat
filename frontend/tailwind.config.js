import daisyui from 'daisyui';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
        extend: {
            animation: {
                'border': 'border 4s linear infinite',
            },
            keyframes: {
                'border': {
                    to: { '--border-angle': '360deg' },
                }
            }                      
        },
    },
  plugins: [
    require('daisyui'),
  ],
  daisyui: {
    themes: [
      {
        business: {
          ...require("daisyui/src/theming/themes")["business"],
          primary: "#6366f1",
          "base-100": "#09090b",
        },
      },
    ],
  },
}