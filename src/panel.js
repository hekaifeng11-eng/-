import GUI from 'lil-gui';
import { appState } from './state.js';

export function setupPanel(particleRef, camera, camState, postProcessing, sequencer) {
  const gui = new GUI({ title: '粒子引擎 v7' });

  const pf = gui.addFolder('粒子');
  pf.add({ get v() { return particleRef.current?.getUniform('u_pointSize') ?? 4; }, set v(val) { particleRef.current?.setUniform('u_pointSize', val); } }, 'v', 1, 20)
    .name('大小');
  pf.add({ get v() { return particleRef.current?.getUniform('u_opacity') ?? 0.85; }, set v(val) { particleRef.current?.setUniform('u_opacity', val); } }, 'v', 0.1, 1.0)
    .name('透明度');
  pf.add({ get v() { return particleRef.current?.getUniform('u_stretch') ?? 1.0; }, set v(val) { particleRef.current?.setUniform('u_stretch', val); } }, 'v', 0, 5.0)
    .name('拉伸强度');
  pf.open();

  const df = gui.addFolder('动态');
  df.add({ get v() { return particleRef.current?.getUniform('u_springK') ?? 0.15; }, set v(val) { particleRef.current?.setUniform('u_springK', val); } }, 'v', 0.01, 0.5)
    .name('弹簧刚度');
  df.add({ get v() { return particleRef.current?.getUniform('u_damping') ?? 0.96; }, set v(val) { particleRef.current?.setUniform('u_damping', val); } }, 'v', 0.9, 1.0, 0.001)
    .name('阻尼');
  df.add({ get v() { return particleRef.current?.getUniform('u_curlStrength') ?? 0.3; }, set v(val) { particleRef.current?.setUniform('u_curlStrength', val); } }, 'v', 0, 2.0)
    .name('curl强度');
  df.add({ get v() { return particleRef.current?.getUniform('u_life') ?? 0.0; }, set v(val) { particleRef.current?.setUniform('u_life', val); } }, 'v', 0, 0.5, 0.01)
    .name('生命衰减');
  df.add({ get v() { return particleRef.current?.getUniform('u_vortexStrength') ?? 0; }, set v(val) { particleRef.current?.setUniform('u_vortexStrength', val); } }, 'v', 0, 30)
    .name('涡旋强度');
  df.open();

  const sf = gui.addFolder('阶段');
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
