import { gsap } from 'gsap';
import * as THREE from 'three';

export function setupInteraction(particleRef, camera, renderer) {
  const state = { value: 0 };
  const mouseState = { strength: 0 };
  const raycaster = new THREE.Raycaster();
  const mouseNDC = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const intersectPoint = new THREE.Vector3();

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

  const onMouseMove = (e) => {
    const ps = particleRef.current;
    if (!ps) return;

    mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouseNDC, camera);
    const hit = raycaster.ray.intersectPlane(plane, intersectPoint);
    if (hit) {
      ps.setUniform('u_mousePos', intersectPoint.clone());
    }
  };

  const onMouseDown = () => {
    gsap.to(mouseState, {
      strength: 80.0,
      duration: 0.3,
      ease: 'power2.out',
      onUpdate: () => {
        const ps = particleRef.current;
        if (ps) ps.setUniform('u_mouseStrength', mouseState.strength);
      },
    });
  };

  const onMouseUp = () => {
    gsap.to(mouseState, {
      strength: 0.0,
      duration: 0.5,
      ease: 'power2.out',
      onUpdate: () => {
        const ps = particleRef.current;
        if (ps) ps.setUniform('u_mouseStrength', mouseState.strength);
      },
    });
  };

  const onTouchMove = (e) => {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
    }
  };

  const onTouchStart = (e) => {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
    }
    onMouseDown();
  };

  const onTouchEnd = () => {
    onMouseUp();
  };

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('touchmove', onTouchMove, { passive: true });
  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchend', onTouchEnd);

  return () => {
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchstart', onTouchStart);
    document.removeEventListener('touchend', onTouchEnd);
    gsap.killTweensOf(state);
    gsap.killTweensOf(mouseState);
  };
}
