const HeroLinkState = {
  config: {
    projectPath: null,
    port: 8866,
    host: "127.0.0.1",
    autoStartServer: true,
    confirmBeforeApply: true,
    lastView: "dashboard",
  },
  serverStatus: { running: false, port: 8866 },
  currentView: "dashboard",
  pendingChanges: [],
  pendingChangesCount: 0,
  logs: [],
  projectSummary: null,
  listeners: {},

  get(key) {
    return this[key];
  },

  set(key, value) {
    this[key] = value;
    this.notify(key, value);
  },

  on(key, callback) {
    if (!this.listeners[key]) this.listeners[key] = [];
    this.listeners[key].push(callback);
    return () => {
      this.listeners[key] = this.listeners[key].filter((cb) => cb !== callback);
    };
  },

  notify(key, value) {
    const cbs = this.listeners[key] || [];
    for (const cb of cbs) cb(value);
  },
};
