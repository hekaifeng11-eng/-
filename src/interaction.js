import { gsap } from 'gsap';

export function setupInteraction(particleRef) {
  const state = { value: 0 };

  const onKeyDown = (e) => {
    const key = e.key.toLowerCase();
    const ps = particleRef.current;
    if (!ps) return;

    if (key === 'a') {
      e.preventDefault();
      gsap.killTweensOf(state);
      gsap.to(state, {
        value: 0,
        duration: 2.0,
        ease: 'power3.in',
        onUpdate: () => ps.setUniform('u_state', state.value),
      });
    }

    if (key === 'b') {
      e.preventDefault();
      gsap.killTweensOf(state);
      gsap.to(state, {
        value: 1,
        duration: 2.5,
        ease: 'power2.out',
        onUpdate: () => ps.setUniform('u_state', state.value),
      });
    }
  };

  document.addEventListener('keydown', onKeyDown);
  return () => {
    document.removeEventListener('keydown', onKeyDown);
    gsap.killTweensOf(state);
  };
}
