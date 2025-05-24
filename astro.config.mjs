// astro.config.mjs
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import icon from 'astro-icon';
import react from '@astrojs/react'; // <-- ¡IMPORTA LA INTEGRACIÓN DE REACT AQUÍ!

export default defineConfig({
  vite: {
    plugins: [
      // ...
    ]
  },
  integrations: [
    tailwind(),
    icon(),
    react() // <-- ¡AÑADE LA INTEGRACIÓN DE REACT AQUÍ!
  ]
});