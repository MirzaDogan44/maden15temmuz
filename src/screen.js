// Düşük çözünürlüklü canvas ve tam sayı ölçekleme.
//
// Canvas'ın iç çözünürlüğü küçük tutulur (ör. 480x270) ve CSS ile tam sayı
// katıyla büyütülür. Ekranın en-boy oranına göre görünen alan genişler,
// böylece telefonda dikey ve yatay, bilgisayarda her pencere boyutunda
// siyah bant olmadan tam ekran oynanır.

import { TARGET_SHORT_SIDE, MIN_BUTTON_CSS } from './config.js';

export class Screen {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    /** Oyun pikseli cinsinden görünen alan. */
    this.width = 0;
    this.height = 0;
    /** Bir oyun pikseli kaç cihaz pikseline denk geliyor. */
    this.scale = 1;
    /** Bir oyun pikseli kaç CSS pikseline denk geliyor. */
    this.cssPerPixel = 1;
    this.onResize = null;
    this.downscale = 0;

    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    window.addEventListener('orientationchange', this.resize);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', this.resize);
    this.resize();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    const devW = Math.round(cssW * dpr);
    const devH = Math.round(cssH * dpr);

    // downscale: yavaş cihazlarda piksel boyutu bir kademe büyütülür.
    const scale = Math.max(1, Math.round(Math.min(devW, devH) / TARGET_SHORT_SIDE)) + this.downscale;
    const w = Math.ceil(devW / scale);
    const h = Math.ceil(devH / scale);

    if (w === this.width && h === this.height && scale === this.scale) return;

    this.width = w;
    this.height = h;
    this.scale = scale;
    this.cssPerPixel = scale / dpr;

    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.width = `${(w * scale) / dpr}px`;
    this.canvas.style.height = `${(h * scale) / dpr}px`;

    // Canvas boyutu değişince bağlam ayarları sıfırlanır, tekrar kapat.
    this.ctx.imageSmoothingEnabled = false;

    if (this.onResize) this.onResize(this);
  }

  /** Telefonda başparmakla rahat basılabilecek buton boyutu (oyun pikseli). */
  get buttonSize() {
    return Math.max(16, Math.ceil(MIN_BUTTON_CSS / this.cssPerPixel));
  }

  /** Pointer olayının ekran koordinatını oyun pikseline çevirir. */
  toGame(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - r.left) / r.width) * this.width,
      y: ((clientY - r.top) / r.height) * this.height,
    };
  }
}
