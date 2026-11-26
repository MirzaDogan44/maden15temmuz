// Eski tarayıcılar için küçük tamamlayıcılar (polyfill). main.js'in ilk
// import'u olmalı: diğer modüller yüklenirken bunlar hazır olur.
// Modern tarayıcılarda hiçbir şey yapmaz.

if (!Object.values) Object.values = (o) => Object.keys(o).map((k) => o[k]);
if (!Object.entries) Object.entries = (o) => Object.keys(o).map((k) => [k, o[k]]);
if (!String.prototype.padStart) {
  String.prototype.padStart = function (n, ch = ' ') {
    let s = String(this);
    while (s.length < n) s = ch + s;
    return s.slice(-Math.max(n, String(this).length));
  };
}
if (!Array.prototype.includes) {
  Array.prototype.includes = function (v) {
    return this.indexOf(v) >= 0;
  };
}
if (!window.URLSearchParams) {
  // sadece oyunun kullandığı kadarı: has / get
  window.URLSearchParams = class {
    constructor(q) {
      this.m = {};
      String(q || '')
        .replace(/^\?/, '')
        .split('&')
        .forEach((part) => {
          if (!part) return;
          const i = part.indexOf('=');
          const k = decodeURIComponent(i < 0 ? part : part.slice(0, i));
          this.m[k] = i < 0 ? '' : decodeURIComponent(part.slice(i + 1).replace(/\+/g, ' '));
        });
    }
    has(k) {
      return Object.prototype.hasOwnProperty.call(this.m, k);
    }
    get(k) {
      return this.has(k) ? this.m[k] : null;
    }
  };
}
if (!window.requestAnimationFrame) {
  window.requestAnimationFrame = window.webkitRequestAnimationFrame || ((cb) => setTimeout(() => cb(performance.now()), 16));
}
