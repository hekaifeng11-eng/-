import { gsap } from 'gsap';

const TRANSITION_MODES = [
  { id: 0, name: 'Uniform', label: '统一', desc: '所有粒子同步移动' },
  { id: 1, name: 'Wave', label: '波浪', desc: '底部→顶部波浪式推进' },
  { id: 2, name: 'Implode', label: '塌缩', desc: '外围→中心引力塌缩' },
  { id: 3, name: 'Radiate', label: '辐射', desc: '核心→外围光芒放射' },
  { id: 4, name: 'Spiral', label: '螺旋', desc: '绕Y轴旋转飞入轨道' },
  { id: 5, name: 'Glitch', label: '闪烁', desc: '随机顺序+噪波脉冲' },
  { id: 6, name: 'Shatter', label: '碎裂', desc: '6簇碎片分组爆裂重组' },
];

export class AnimationSequencer {
  constructor(particleRef, camState) {
    this.particleRef = particleRef;
    this.camState = camState;
    this.masterTL = null;
    this.activeTweens = [];
    this.currentMode = 0;
    this._autoCycle = true;
    this.speed = 1.0; // 0.25 ~ 3.0, 1.0 = default
  }

  kill() {
    if (this.masterTL) {
      this.masterTL.kill();
      this.masterTL = null;
    }
    this.activeTweens.forEach(t => t.kill());
    this.activeTweens = [];
  }

  setMode(mode) {
    this.currentMode = Math.max(0, Math.min(6, mode));
    const ps = this.particleRef.current;
    if (ps) ps.setUniform('u_transitionMode', parseFloat(this.currentMode));
  }

  nextMode() {
    this.setMode((this.currentMode + 1) % 7);
  }

  _td(t) { return t / Math.max(0.25, this.speed); }

  playFullSequence() {
    this.kill();
    const ps = this.particleRef.current;
    if (!ps) return;

    ps.setUniform('u_transitionMode', parseFloat(this.currentMode));

    this.masterTL = gsap.timeline({
      repeat: -1,
      onRepeat: () => {
        if (this._autoCycle) this.nextMode();
        ps.setUniform('u_transitionMode', parseFloat(this.currentMode));
      },
    });

    this.masterTL.add(this._stageScatter(ps));
    this.masterTL.add(this._stageConverge(ps));
    this.masterTL.add(this._stageDisplay(ps));
    this.masterTL.add(this._stageVortex(ps));
    this.masterTL.add(this._stageBurst(ps));
  }

  _stageScatter(ps) {
    const tl = gsap.timeline();
    const stateObj = { value: 0.0 };
    tl.to(stateObj, {
      value: 1.0,
      duration: this._td(3.0),
      ease: 'power2.out',
      onStart: () => {
        ps.setUniform('u_noiseStrength', 0.8);
        ps.setUniform('u_noiseSpeed', 0.2);
      },
      onUpdate: () => ps.setUniform('u_state', stateObj.value),
    });
    tl.to({}, { duration: this._td(1.0) });
    return tl;
  }

  _stageConverge(ps) {
    const tl = gsap.timeline();
    const stateObj = { value: 1.0 };
    const noiseObj = { strength: 0.8 };
    const dur = this._td(6.0);
    tl.to(stateObj, {
      value: 0.0,
      duration: dur,
      ease: 'power2.inOut',
      onUpdate: () => ps.setUniform('u_state', stateObj.value),
    });
    tl.to(noiseObj, {
      strength: 0.15,
      duration: dur,
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
        ps.setUniform('u_state', 0.0);
        ps.setUniform('u_noiseStrength', 0.1);
        ps.setUniform('u_noiseSpeed', 0.05);
      },
    });
    tl.to({}, { duration: this._td(6.0) });
    return tl;
  }

  _stageVortex(ps) {
    const tl = gsap.timeline();
    const stateObj = { value: 0.0 };
    const noiseObj = { strength: 0.1 };
    const durUp = this._td(3.0);
    const durDown = this._td(2.0);
    tl.to(stateObj, {
      value: 0.2,
      duration: durUp,
      ease: 'power2.in',
      onUpdate: () => ps.setUniform('u_state', stateObj.value),
    });
    tl.to(noiseObj, {
      strength: 0.6,
      duration: durUp,
      ease: 'power2.in',
      onUpdate: () => ps.setUniform('u_noiseStrength', noiseObj.strength),
    }, '<');
    tl.to(stateObj, {
      value: 0.0,
      duration: durDown,
      ease: 'power2.out',
      onUpdate: () => ps.setUniform('u_state', stateObj.value),
    });
    tl.to(noiseObj, {
      strength: 0.1,
      duration: durDown,
      ease: 'power2.out',
      onUpdate: () => ps.setUniform('u_noiseStrength', noiseObj.strength),
    }, '<');
    return tl;
  }

  _stageBurst(ps) {
    const tl = gsap.timeline();
    const stateObj = { value: 0.0 };
    const dur = this._td(3.0);
    tl.to(stateObj, {
      value: 1.0,
      duration: dur,
      ease: 'power3.out',
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
    ps.setUniform('u_transitionMode', parseFloat(this.currentMode));

    switch (stageName) {
      case 'scatter': {
        const stateObj = { value: ps.getUniform('u_state') ?? 0.0 };
        ps.setUniform('u_noiseStrength', 0.8);
        ps.setUniform('u_noiseSpeed', 0.2);
        const tw = gsap.to(stateObj, {
          value: 1.0,
          duration: this._td(3.0),
          ease: 'power2.out',
          onUpdate: () => ps.setUniform('u_state', stateObj.value),
        });
        this.activeTweens.push(tw);
        break;
      }
      case 'converge': {
        const stateObj = { value: ps.getUniform('u_state') ?? 1.0 };
        const noiseObj = { strength: 0.8 };
        const dur = this._td(5.0);
        const tw1 = gsap.to(stateObj, {
          value: 0.0,
          duration: dur,
          ease: 'power2.inOut',
          onUpdate: () => ps.setUniform('u_state', stateObj.value),
        });
        const tw2 = gsap.to(noiseObj, {
          strength: 0.15,
          duration: dur,
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
          duration: this._td(2.0),
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

export { TRANSITION_MODES };
