import AOS from 'aos';
import 'aos/dist/aos.css';

export function initAOS() {
  AOS.init({
    duration: 800,
    easing: 'ease-in-out',
    once: false,
  });

  // Re-inicializar en cambios de página
  document.addEventListener('astro:page-load', () => {
    AOS.refreshHard();
  });
}
