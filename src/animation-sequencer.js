import { gsap } from 'gsap';

const STAGES = {
  SCATTER: 0,
  CONVERGE: 1,
  DISPLAY: 2,
  VORTEX: 3,
  BURST: 4,
};

export class AnimationSequencer {
  constructor(particleRef, camState) {
    this.particleRef = particleRef;
    this.camState = camState;
    this.masterTL = null;
    this.activeTweens = [];
    this.stage = STAGES.SCATTER;
  }

  kill() {
    if (this.masterTL) {
      this.masterTL.kill();
      this.masterTL = null;
    }
    this.activeTweens.forEach(t => t.kill());
    this.activeTweens = [];
  }

  playFullSequence() {
    this.kill();
    const ps = this.particleRef.current;
    if (!ps) return;

    this.masterTL = gsap.timeline({ repeat: -1 });

    this.masterTL.add(this._stageScatter(ps));
    this.masterTL.add(this._stageConverge(ps));
    this.masterTL.add(this._stageDisplay(ps));
    this.masterTL.add(this._stageVortex(ps));
    this.masterTL.add(this._stageBurst(ps));
  }

  _stageScatter(ps) {
    const tl = gsap.timeline();
    tl.to(ps, {
      duration: 0.01,
      onStart: () => {
        this.stage = STAGES.SCATTER;
        ps.setUniform('u_state', 1.0);
        ps.setUniform('u_springK', 0.05);
        ps.setUniform('u_damping', 0.98);
        ps.setUniform('u_curlStrength', 0.8);
        ps.setUniform('u_vortexStrength', 0.0);
        ps.setUniform('u_life', 0.15);
      },
    });
    tl.to({}, { duration: 2.0 });
    return tl;
  }

  _stageConverge(ps) {
    const tl = gsap.timeline();
    const stateObj = { value: 1.0 };
    tl.to(stateObj, {
      value: 0.0,
      duration: 4.0,
      ease: 'power2.inOut',
      onStart: () => {
        this.stage = STAGES.CONVERGE;
        ps.setUniform('u_springK', 0.15);
        ps.setUniform('u_damping', 0.96);
        ps.setUniform('u_curlStrength', 0.3);
        ps.setUniform('u_life', 0.0);
      },
      onUpdate: () => ps.setUniform('u_state', stateObj.value),
    });
    return tl;
  }

  _stageDisplay(ps) {
    const tl = gsap.timeline();
    tl.to({}, {
      duration: 0.01,
      onStart: () => {
        this.stage = STAGES.DISPLAY;
        ps.setUniform('u_state', 0.0);
        ps.setUniform('u_springK', 0.2);
        ps.setUniform('u_damping', 0.97);
        ps.setUniform('u_curlStrength', 0.15);
        ps.setUniform('u_life', 0.0);
      },
    });
    tl.to({}, { duration: 5.0 });
    return tl;
  }

  _stageVortex(ps) {
    const tl = gsap.timeline();
    const vortexObj = { strength: 0.0 };
    tl.to(vortexObj, {
      strength: 15.0,
      duration: 3.0,
      ease: 'power2.in',
      onStart: () => {
        this.stage = STAGES.VORTEX;
        ps.setUniform('u_springK', 0.08);
        ps.setUniform('u_damping', 0.94);
        ps.setUniform('u_curlStrength', 0.5);
      },
      onUpdate: () => ps.setUniform('u_vortexStrength', vortexObj.strength),
    });
    tl.to(vortexObj, {
      strength: 0.0,
      duration: 2.0,
      ease: 'power2.out',
      onUpdate: () => ps.setUniform('u_vortexStrength', vortexObj.strength),
    });
    return tl;
  }

  _stageBurst(ps) {
    const tl = gsap.timeline();
    const stateObj = { value: 0.0 };
    tl.to(stateObj, {
      value: 1.0,
      duration: 2.0,
      ease: 'power3.out',
      onStart: () => {
        this.stage = STAGES.BURST;
        ps.setUniform('u_springK', 0.03);
        ps.setUniform('u_damping', 0.99);
        ps.setUniform('u_curlStrength', 1.0);
        ps.setUniform('u_life', 0.1);
      },
      onUpdate: () => ps.setUniform('u_state', stateObj.value),
    });
    return tl;
  }

  setStage(stageName) {
    const ps = this.particleRef.current;
    if (!ps) return;

    this.kill();

    switch (stageName) {
      case 'scatter':
        ps.setUniform('u_state', 1.0);
        ps.setUniform('u_springK', 0.05);
        ps.setUniform('u_damping', 0.98);
        ps.setUniform('u_curlStrength', 0.8);
        ps.setUniform('u_vortexStrength', 0.0);
        ps.setUniform('u_life', 0.15);
        break;
      case 'converge': {
        const stateObj = { value: 1.0 };
        const tw = gsap.to(stateObj, {
          value: 0.0,
          duration: 3.0,
          ease: 'power2.inOut',
          onUpdate: () => ps.setUniform('u_state', stateObj.value),
          onStart: () => {
            ps.setUniform('u_springK', 0.15);
            ps.setUniform('u_damping', 0.96);
            ps.setUniform('u_curlStrength', 0.3);
            ps.setUniform('u_vortexStrength', 0.0);
            ps.setUniform('u_life', 0.0);
          },
        });
        this.activeTweens.push(tw);
        break;
      }
      case 'display':
        ps.setUniform('u_state', 0.0);
        ps.setUniform('u_springK', 0.2);
        ps.setUniform('u_damping', 0.97);
        ps.setUniform('u_curlStrength', 0.15);
        ps.setUniform('u_vortexStrength', 0.0);
        ps.setUniform('u_life', 0.0);
        break;
      case 'vortex': {
        const vObj = { s: 0.0 };
        const tw = gsap.to(vObj, {
          s: 15.0,
          duration: 2.0,
          ease: 'power2.in',
          onUpdate: () => ps.setUniform('u_vortexStrength', vObj.s),
          onStart: () => {
            ps.setUniform('u_springK', 0.08);
            ps.setUniform('u_damping', 0.94);
            ps.setUniform('u_curlStrength', 0.5);
            ps.setUniform('u_life', 0.0);
          },
        });
        this.activeTweens.push(tw);
        break;
      }
    }
  }
}

export { STAGES };
