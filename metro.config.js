const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const projectRoot = __dirname;

// Solo carpetas del repo (no node_modules/.../dist). Case + slash agnostic (Windows).
function ignoreProjectDir(dir) {
  const abs = path.resolve(projectRoot, dir);
  const pattern = abs
    .replace(/[a-zA-Z]:/, (drive) => `[${drive[0].toLowerCase()}${drive[0].toUpperCase()}]:`)
    .replace(/[\\/]+/g, '[\\\\/]');
  return new RegExp(`^${pattern}([\\\\/].*)?$`, 'i');
}

const CACHE_IO_CONCURRENCY = Number(process.env.METRO_CACHE_CONCURRENCY) || 32;

function createLimiter(max) {
  let active = 0;
  const queue = [];

  const drain = () => {
    while (active < max && queue.length > 0) {
      const { fn, resolve, reject } = queue.shift();
      active += 1;
      Promise.resolve()
        .then(fn)
        .then(resolve, reject)
        .finally(() => {
          active -= 1;
          drain();
        });
    }
  };

  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      drain();
    });
}

async function withRetry(fn, attempts = 6) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      const code = err && err.code;
      if ((code !== 'EMFILE' && code !== 'ENFILE') || attempt >= attempts) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 20 * 2 ** attempt));
    }
  }
}

const config = getDefaultConfig(projectRoot);

// Web transforma muchos más módulos → el FileStore del cache abre demasiados .mp a la vez (EMFILE).
const limitCacheIO = createLimiter(CACHE_IO_CONCURRENCY);
if (Array.isArray(config.cacheStores)) {
  for (const store of config.cacheStores) {
    for (const method of ['get', 'set']) {
      const original = store[method];
      if (typeof original !== 'function') continue;
      store[method] = (...args) =>
        limitCacheIO(() => withRetry(() => original.apply(store, args)));
    }
  }
}

// No setear watchFolders al project root: Metro ya lo observa; duplicarlo empeora EMFILE en Windows.
config.maxWorkers = Math.min(2, require('os').cpus().length);
config.resolver.blockList = [
  ignoreProjectDir('.git'),
  ignoreProjectDir('.agents'),
  ignoreProjectDir('.claude'),
  ignoreProjectDir('dist'),
  ignoreProjectDir('supabase/functions'),
  ignoreProjectDir('android'),
  ignoreProjectDir('ios'),
];

module.exports = withNativeWind(config, { input: './global.css' });
