import GUI from 'lil-gui';
import { appState } from './state.js';
import { THEMES } from './param-mapper.js';
import { TRANSITION_MODES } from './animation-sequencer.js';

function descDiv(text) {
  const el = document.createElement('div');
  el.style.cssText = 'color:rgba(255,255,255,0.35);font:9px monospace;padding:2px 0 6px 0;';
  el.textContent = text;
  return el;
}

export function setupPanel(particleRef, camera, camState, postProcessing, sequencer, setTheme = null) {
  const gui = new GUI({ title: '粒子引擎 v10', width: 300 });

  if (setTheme) {
    const tf = gui.addFolder('主题风格');
    tf.add({
      get theme() { return 'digital_art'; },
      set theme(v) { setTheme(v); },
    }, 'theme', Object.keys(THEMES).reduce((acc, k) => { acc[k] = k; return acc; }, {}))
      .name('切换主题');
    tf.open();
  }

  const pf = gui.addFolder('粒子');
  pf.add({ get v() { return particleRef.current?.getUniform('u_pointSize') ?? 1.8; }, set v(val) { particleRef.current?.setUniform('u_pointSize', val); } }, 'v', 0.5, 8)
    .name('大小');
  pf.add({ get v() { return particleRef.current?.getUniform('u_opacity') ?? 0.7; }, set v(val) { particleRef.current?.setUniform('u_opacity', val); } }, 'v', 0.1, 1.0)
    .name('透明度');
  pf.add({ get v() { return particleRef.current?.getUniform('u_stretch') ?? 1.0; }, set v(val) { particleRef.current?.setUniform('u_stretch', val); } }, 'v', 0, 5.0)
    .name('拉伸强度');
  pf.open();

  const df = gui.addFolder('动态');
  df.add({ get v() { return particleRef.current?.getUniform('u_noiseStrength') ?? 0.3; }, set v(val) { particleRef.current?.setUniform('u_noiseStrength', val); } }, 'v', 0, 1.5)
    .name('噪声强度');
  df.add({ get v() { return particleRef.current?.getUniform('u_noiseSpeed') ?? 0.15; }, set v(val) { particleRef.current?.setUniform('u_noiseSpeed', val); } }, 'v', 0.01, 0.5)
    .name('噪声速度');
  df.add({ get v() { return particleRef.current?.getUniform('u_state') ?? 0.0; }, set v(val) { particleRef.current?.setUniform('u_state', val); } }, 'v', 0, 1)
    .name('散射/汇聚');
  df.open();

  // 过渡模式 + 描述
  const modeFolder = gui.addFolder('过渡模式');
  const modeNames = TRANSITION_MODES.reduce((acc, m) => {
    acc[`${m.label}  ·  ${m.name}`] = m.id;
    return acc;
  }, {});
  const modeObj = { mode: `${TRANSITION_MODES[0].label}  ·  ${TRANSITION_MODES[0].name}` };

  let descEl = null;
  modeFolder.add(modeObj, 'mode', modeNames)
    .name('效果')
    .onChange(v => {
      const m = TRANSITION_MODES.find(t => t.id === v);
      sequencer.setMode(v);
      if (descEl) descEl.textContent = m ? m.desc : '';
    });

  // 添加描述文字
  const m0 = TRANSITION_MODES[0];
  descEl = descDiv(m0.desc);
  modeFolder.domElement.appendChild(descEl);

  modeFolder.add({ get v() { return sequencer.speed; }, set v(val) { sequencer.speed = val; } }, 'v', 0.25, 3.0, 0.05)
    .name('过渡速度');
  modeFolder.add({ get v() { return sequencer._autoCycle; }, set v(val) { sequencer._autoCycle = val; } }, 'v')
    .name('自动轮换');
  modeFolder.open();

  const sf = gui.addFolder('阶段触发');
  sf.add({ scatter() { sequencer.setStage('scatter'); } }, 'scatter').name('散射');
  sf.add({ converge() { sequencer.setStage('converge'); } }, 'converge').name('汇聚');
  sf.add({ display() { sequencer.setStage('display'); } }, 'display').name('展示');
  sf.add({ vortex() { sequencer.setStage('vortex'); } }, 'vortex').name('涡旋');
  sf.add({ play() { sequencer.playFullSequence(); } }, 'play').name('自动播放');
  sf.open();

  if (postProcessing) {
    const bf = gui.addFolder('辉光');
    bf.add(appState, 'bloomEnabled').name('启用').onChange(v => {
      postProcessing.enabled = v;
    });
    bf.add(appState, 'bloomStrength', 0, 3, 0.01).name('强度').onChange(v => {
      postProcessing.setBloomParams(v, appState.bloomRadius, appState.bloomThreshold);
    });
    bf.add(appState, 'bloomRadius', 0, 1, 0.01).name('半径').onChange(v => {
      postProcessing.setBloomParams(appState.bloomStrength, v, appState.bloomThreshold);
    });
    bf.add(appState, 'bloomThreshold', 0, 1, 0.01).name('阈值').onChange(v => {
      postProcessing.setBloomParams(appState.bloomStrength, appState.bloomRadius, v);
    });
    bf.open();
  }

  const cf = gui.addFolder('摄像机');
  cf.add(camera, 'fov', 30, 90)
    .name('视场角')
    .onChange(() => camera.updateProjectionMatrix());
  cf.add(camState, 'orbitSpeed', 0.01, 0.5)
    .name('轨道速度');
  cf.add(camState, 'distance', 100, 1500)
    .name('摄像机距离');
  cf.open();

  return gui;
}
