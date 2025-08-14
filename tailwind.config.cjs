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
        'ts-primary-dark': '#8BC4BC',  // Versión más oscura para mejor contraste
        'ts-background': '#F8F9F8',    // Blanco Roto/Crema Pastel
        'ts-background-dark': '#E8E9E8', // Fondo alternativo más oscuro
        'ts-accent': '#6A7C8C',        // Gris Azulado Suave
        'ts-accent-dark': '#4A5B6B',   // Versión más oscura del accent
        'ts-text': '#2C3E50',          // Texto principal más oscuro para mejor contraste
        'ts-text-light': '#4A5B6B',   // Texto secundario
        'ts-text-muted': '#6B7280',   // Texto atenuado
      },
    },
  },
  plugins: [],
};

