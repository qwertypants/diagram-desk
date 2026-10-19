// Runs inside the opaque reader. The pinned native viewer remains the camera owner.
export function installReaderTouch() {
  const container = document.querySelector('.diagram-container');
  const camera = globalThis.Archify?.view;
  if (!container || !camera) return;
  const pointers = new Map();
  let pinch = null;
  const distance = touches => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
  container.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch') pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }, true);
  container.addEventListener('pointermove', event => {
    if (pointers.has(event.pointerId)) pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch) event.stopImmediatePropagation();
  }, true);
  container.addEventListener('pointerup', event => pointers.delete(event.pointerId), true);
  container.addEventListener('pointercancel', event => { if (event.isTrusted) pointers.delete(event.pointerId); }, true);
  container.addEventListener('touchstart', event => {
    if (event.touches.length !== 2) return;
    event.preventDefault();
    pinch = { distance: Math.max(1, distance(event.touches)), scale: camera.state().scale };
    for (const pointerId of pointers.keys()) {
      // Release an in-progress one-finger drag before the native camera zooms.
      container.dispatchEvent(new PointerEvent('pointercancel', { pointerId }));
    }
  }, { passive: false, capture: true });
  container.addEventListener('touchmove', event => {
    if (!pinch || event.touches.length !== 2) return;
    event.preventDefault();
    const target = pinch.scale * distance(event.touches) / pinch.distance;
    for (let i = 0; i < 24; i++) {
      const current = camera.state().scale;
      if (Math.abs(target - current) < 0.14) break;
      if (target > current) camera.zoomIn();
      else camera.zoomOut();
      if (camera.state().scale === current) break;
    }
  }, { passive: false, capture: true });
  const finish = event => {
    if (!pinch || event.touches.length >= 2) return;
    pinch = null;
    const remaining = pointers.entries().next().value;
    if (event.touches.length === 1 && remaining) {
      const [pointerId, point] = remaining;
      container.dispatchEvent(new PointerEvent('pointerdown', {
        pointerId, pointerType: 'touch', button: 0, buttons: 1,
        clientX: point.x, clientY: point.y, bubbles: true,
      }));
    }
  };
  container.addEventListener('touchend', finish);
  container.addEventListener('touchcancel', finish);
}
