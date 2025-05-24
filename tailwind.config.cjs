// tailwind.config.cjs
/** @type {import('tailwindcss').Config} */
module.exports = {
  // Importante: le dice a Tailwind dónde buscar tus clases en tus archivos.
  content: [
    './src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}',
  ],
  theme: {
    extend: {
      colors: {
        'ts-primary': '#A7D9D3',       // Celeste Suave/Aqua Pastel
        'ts-background': '#F8F9F8',    // Blanco Roto/Crema Pastel
        'ts-accent': '#6A7C8C',        // Gris Azulado Suave
        'ts-text': '#4A5B6B',          // Un gris azulado un poco más oscuro
      },
    },
  },
  plugins: [],
};

