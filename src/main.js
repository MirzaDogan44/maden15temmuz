// Giriş noktası: ekran, giriş, oyun döngüsü ve sahneler.

import { STEP, MAX_FRAME_TIME, DEBUG } from './config.js';
import { Screen } from './screen.js';
import { Input } from './input.js';
import { Hud } from './ui.js';
import { collectImagePaths, loadImages } from './assets.js';
import { drawText } from './font.js';
import * as audio from './audio.js';
import { StartScene } from './scenes/start.js';
import { PlayScene } from './scenes/play.js';

class Game {
  constructor(canvas) {
    this.screen = new Screen(canvas);
    this.input = new Input(this.screen);
    this.hud = new Hud(this.screen);
    this.screen.onResize = () => this.hud.layout();

    this.shakeAmount = 0;
    this.shakeTime = 0;
    this.shakeX = 0;
    this.shakeY = 0;

    this.fps = 0;
    this._fpsFrames = 0;
    this._fpsTime = 0;

    this.scene = new StartScene(this);
    // Ses sistemi ilk kullanıcı jestinde başlar (sonrakilerde askıdaysa devam eder).
    this.input.onGesture = () => audio.init();
    this.input.onPointerDown = (e) => {
      if (this.scene.onPointerDown) this.scene.onPointerDown(e);
    };
  }

  async load() {
    const start = this.scene;
    await loadImages(collectImagePaths(), (d, t) => start.setProgress(d, t));
    start.ready = true;
  }

  startPlay(levelIndex = 0) {
    this.scene = new PlayScene(this, levelIndex);
  }

  /** Ekranı sarsar. amount: piksel, time: saniye. */
  shake(amount, time) {
    this.shakeAmount = Math.max(this.shakeAmount, amount);
    this.shakeTime = Math.max(this.shakeTime, time);
  }

  update(dt) {
    // Önce arayüz butonları ve ayarlar paneli; panel açıkken oyun duraklar.
    const taps = this.input.consumeTaps().filter((t) => !this.hud.handleTap(t));
    if (!this.hud.panelOpen) this.scene.update(dt, taps);
    this.hud.update(dt);

    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const a = this.shakeAmount * Math.min(1, this.shakeTime * 4);
      this.shakeX = Math.round((Math.random() * 2 - 1) * a);
      this.shakeY = Math.round((Math.random() * 2 - 1) * a);
      if (this.shakeTime <= 0) {
        this.shakeAmount = 0;
        this.shakeX = this.shakeY = 0;
      }
    }
  }

  render() {
    const { ctx, width: w, height: h } = this.screen;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    // Sahneler sarsıntıyı (shakeX/Y) kendileri uygular; oyun sahnesinde
    // kamera kayar, böylece ışık da aynı hizada kalır. Arayüz sarsılmaz.
    this.scene.draw(ctx, w, h);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!this.scene.hideHud) this.hud.draw(ctx);

    if (DEBUG) {
      const s = this.screen;
      drawText(ctx, `${this.fps} FPS  ${s.width}X${s.height}  X${s.scale}`, 4, h - 14, { color: '#7f7', shadow: '#000' });
    }
  }

  /**
   * Oyun sahnesinde FPS 3 saniye boyunca 45'in altında kalırsa çözünürlüğü
   * bir kademe düşür (bir kere). Sekme arka plandayken ölçüm yapılmaz.
   */
  checkPerformance() {
    if (this.screen.downscale > 0 || document.hidden || !(this.scene instanceof PlayScene)) return;
    if (this.scene.t < 2) return;
    this._slow = this.fps < 45 ? (this._slow || 0) + 1 : 0;
    if (this._slow >= 6) {
      this.screen.downscale = 1;
      this.screen.resize();
      console.info('Performans için çözünürlük düşürüldü.');
    }
  }

  run() {
    let last = performance.now();
    let acc = 0;
    const frame = (now) => {
      const dt = Math.min(MAX_FRAME_TIME, (now - last) / 1000);
      last = now;
      acc += dt;
      while (acc >= STEP) {
        this.update(STEP);
        acc -= STEP;
      }
      this.render();

      this._fpsFrames++;
      this._fpsTime += dt;
      if (this._fpsTime >= 0.5) {
        this.fps = Math.round(this._fpsFrames / this._fpsTime);
        this._fpsFrames = 0;
        this._fpsTime = 0;
        this.checkPerformance();
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}

const game = new Game(document.getElementById('game'));
game.run();
game.load();

if (DEBUG) window.game = game;
