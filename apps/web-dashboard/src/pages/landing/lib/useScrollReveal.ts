import { useEffect } from 'react';

export function useScrollReveal(rootSelector = '.landing-page') {
  useEffect(() => {
    const root = document.querySelector(rootSelector) ?? document;
    const els = Array.from(root.querySelectorAll<HTMLElement>('.reveal'));

    if (!('IntersectionObserver' in window)) {
      els.forEach(el => el.classList.add('in'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('in');
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );

    els.forEach(el => io.observe(el));

    return () => io.disconnect();
  }, [rootSelector]);
}
