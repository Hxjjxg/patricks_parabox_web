// Diagnostic only: inject on an isolated tab before application startup.
// The production controller, renderer and game logic run unchanged. This
// replaces the external frame clock, not the game's update or draw methods.
(() => {
  let clock = 0;
  let nextId = 1;
  const callbacks = new Map();
  window.requestAnimationFrame = callback => {
    const id = nextId++;
    callbacks.set(id, callback);
    return id;
  };
  window.cancelAnimationFrame = id => callbacks.delete(id);
  Object.defineProperty(performance, 'now', { value: () => clock, configurable: true });
  window.__parityFrameDriver = {
    get now() { return clock; },
    step(deltaSeconds) {
      clock += deltaSeconds * 1000;
      const pending = [...callbacks.values()];
      callbacks.clear();
      if (!pending.length) throw new Error('No application frame callback ready');
      for (const callback of pending) callback(clock);
      return clock;
    },
  };
})();
