const listeners = new Map();
export const eventBus = {
  on(eventName, callback) {
    if (!listeners.has(eventName)) listeners.set(eventName, new Set());
    listeners.get(eventName).add(callback);
    return () => listeners.get(eventName)?.delete(callback);
  },
  emit(eventName, payload) {
    listeners.get(eventName)?.forEach((callback) => callback(payload));
  }
};
