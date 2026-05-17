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
        ps.setUniform('u_noiseStrength', 0.8);
        ps.setUniform('u_noiseSpeed', 0.2);
      },
    });
    tl.to({}, { duration: 2.0 });
    return tl;
  }

  _stageConverge(ps) {
    const tl = gsap.timeline();
    const stateObj = { value: 1.0 };
    const noiseObj = { strength: 0.8 };
    tl.to(stateObj, {
      value: 0.0,
      duration: 4.0,
      ease: 'power2.inOut',
      onStart: () => {
        this.stage = STAGES.CONVERGE;
      },
      onUpdate: () => ps.setUniform('u_state', stateObj.value),
    });
    tl.to(noiseObj, {
      strength: 0.15,
      duration: 4.0,
      ease: 'power2.inOut',
      onUpdate: () => ps.setUniform('u_noiseStrength', noiseObj.strength),
    }, '<');
    return tl;
  }

  _stageDisplay(ps) {
    const tl = gsap.timeline();
    tl.to({}, {
      duration: 0.01,
      onStart: () => {
        this.stage = STAGES.DISPLAY;
        ps.setUniform('u_state', 0.0);
        ps.setUniform('u_noiseStrength', 0.1);
        ps.setUniform('u_noiseSpeed', 0.05);
      },
    });
    tl.to({}, { duration: 5.0 });
    return tl;
  }

  _stageVortex(ps) {
    const tl = gsap.timeline();
    const stateObj = { value: 0.0 };
    const noiseObj = { strength: 0.1 };
    tl.to(stateObj, {
      value: 0.2,
      duration: 3.0,
      ease: 'power2.in',
      onStart: () => {
        this.stage = STAGES.VORTEX;
      },
      onUpdate: () => ps.setUniform('u_state', stateObj.value),
    });
    tl.to(noiseObj, {
      strength: 0.6,
      duration: 3.0,
      ease: 'power2.in',
      onUpdate: () => ps.setUniform('u_noiseStrength', noiseObj.strength),
    }, '<');
    tl.to(stateObj, {
      value: 0.0,
      duration: 2.0,
      ease: 'power2.out',
      onUpdate: () => ps.setUniform('u_state', stateObj.value),
    });
    tl.to(noiseObj, {
      strength: 0.1,
      duration: 2.0,
      ease: 'power2.out',
      onUpdate: () => ps.setUniform('u_noiseStrength', noiseObj.strength),
    }, '<');
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
      },
      onUpdate: () => ps.setUniform('u_state', stateObj.value),
    });
    tl.to({}, {
      duration: 0.01,
      onStart: () => {
        ps.setUniform('u_noiseStrength', 1.0);
        ps.setUniform('u_noiseSpeed', 0.25);
      },
    }, '<');
    return tl;
  }

  setStage(stageName) {
    const ps = this.particleRef.current;
    if (!ps) return;

    this.kill();

    switch (stageName) {
      case 'scatter':
        ps.setUniform('u_state', 1.0);
        ps.setUniform('u_noiseStrength', 0.8);
        ps.setUniform('u_noiseSpeed', 0.2);
        break;
      case 'converge': {
        const stateObj = { value: 1.0 };
        const noiseObj = { strength: 0.8 };
        const tw1 = gsap.to(stateObj, {
          value: 0.0,
          duration: 3.0,
          ease: 'power2.inOut',
          onUpdate: () => ps.setUniform('u_state', stateObj.value),
        });
        const tw2 = gsap.to(noiseObj, {
          strength: 0.15,
          duration: 3.0,
          ease: 'power2.inOut',
          onUpdate: () => ps.setUniform('u_noiseStrength', noiseObj.strength),
        });
        this.activeTweens.push(tw1, tw2);
        break;
      }
      case 'display':
        ps.setUniform('u_state', 0.0);
        ps.setUniform('u_noiseStrength', 0.1);
        ps.setUniform('u_noiseSpeed', 0.05);
        break;
      case 'vortex': {
        const vObj = { s: 0.0 };
        const tw = gsap.to(vObj, {
          s: 0.2,
          duration: 2.0,
          ease: 'power2.in',
          onUpdate: () => {
            ps.setUniform('u_state', vObj.s);
            ps.setUniform('u_noiseStrength', 0.1 + vObj.s * 2.5);
          },
        });
        this.activeTweens.push(tw);
        break;
      }
    }
  }
}

export { STAGES };
