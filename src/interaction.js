import { gsap } from 'gsap';

export function setupInteraction(particleRef, camera, renderer) {
  const state = { value: 0 };
  const noiseState = { value: 0.1 };

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
        onUpdate: () => {
          ps.setUniform('u_state', state.value);
          ps.setUniform('u_noiseStrength', 0.1 + (1.0 - state.value) * 0.7);
        },
      });
    }

    if (key === 'b') {
      e.preventDefault();
      gsap.killTweensOf(state);
      gsap.to(state, {
        value: 1,
        duration: 2.5,
        ease: 'power2.out',
        onUpdate: () => {
          ps.setUniform('u_state', state.value);
          ps.setUniform('u_noiseStrength', 0.1 + state.value * 0.9);
        },
      });
    }
  };

  const onMouseDown = () => {
    const ps = particleRef.current;
    if (!ps) return;
    gsap.killTweensOf(noiseState);
    gsap.to(noiseState, {
      value: 0.8,
      duration: 0.3,
      ease: 'power2.out',
      onUpdate: () => ps.setUniform('u_noiseStrength', noiseState.value),
    });
  };

  const onMouseUp = () => {
    const ps = particleRef.current;
    if (!ps) return;
    gsap.killTweensOf(noiseState);
    gsap.to(noiseState, {
      value: 0.1,
      duration: 0.5,
      ease: 'power2.out',
      onUpdate: () => ps.setUniform('u_noiseStrength', noiseState.value),
    });
  };

  const onTouchStart = () => onMouseDown();
  const onTouchEnd = () => onMouseUp();

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchend', onTouchEnd);

  return () => {
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('touchstart', onTouchStart);
    document.removeEventListener('touchend', onTouchEnd);
    gsap.killTweensOf(state);
    gsap.killTweensOf(noiseState);
  };
}
