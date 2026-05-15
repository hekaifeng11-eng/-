import GUI from 'lil-gui';

export function setupPanel(particleRef, camera, camState) {
  const gui = new GUI({ title: '粒子控制' });

  const pf = gui.addFolder('粒子基础');
  pf.add({ get v() { return particleRef.current?.getUniform('u_pointSize') ?? 4; }, set v(val) { particleRef.current?.setUniform('u_pointSize', val); } }, 'v', 1, 20)
    .name('大小');
  pf.add({ get v() { return particleRef.current?.getUniform('u_opacity') ?? 0.85; }, set v(val) { particleRef.current?.setUniform('u_opacity', val); } }, 'v', 0.1, 1.0)
    .name('透明度');
  pf.open();

  const df = gui.addFolder('动态');
  df.add({ get v() { return particleRef.current?.getUniform('u_springK') ?? 0.15; }, set v(val) { particleRef.current?.setUniform('u_springK', val); } }, 'v', 0.01, 0.5)
    .name('弹簧刚度');
  df.add({ get v() { return particleRef.current?.getUniform('u_damping') ?? 0.96; }, set v(val) { particleRef.current?.setUniform('u_damping', val); } }, 'v', 0.9, 1.0, 0.001)
    .name('阻尼');
  df.add({ get v() { return particleRef.current?.getUniform('u_curlStrength') ?? 0.3; }, set v(val) { particleRef.current?.setUniform('u_curlStrength', val); } }, 'v', 0, 2.0)
    .name('curl强度');
  df.add({ click() {
    const ps = particleRef.current;
    if (!ps) return;
    const cur = ps.getUniform('u_state');
    ps.setUniform('u_state', cur > 0.5 ? 0 : 1);
  } }, 'click').name('切换聚合/弥散');
  df.open();

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
