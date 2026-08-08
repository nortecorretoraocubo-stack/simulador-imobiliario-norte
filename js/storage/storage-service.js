export const storageService = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      console.error('Falha ao ler o armazenamento local.', error);
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Falha ao salvar no armazenamento local.', error);
      return false;
    }
  },
  remove(key) { localStorage.removeItem(key); }
};
