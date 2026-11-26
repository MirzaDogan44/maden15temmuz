// Fare ve dokunmatik için tek giriş katmanı (Pointer Events).
// Klavye kullanılmaz.
//
// Oyun yalnızca "dokunuş" (tap) olaylarıyla ilgilenir: parmak/fare basılıp
// fazla kaydırılmadan bırakılınca bir tap oluşur. Basma anı da ayrıca
// bildirilir (ses sistemini ilk dokunuşta başlatmak için gerekli).

const TAP_MAX_MOVE = 12; // CSS piksel

export class Input {
  constructor(screen) {
    this.screen = screen;
    /** Bu karede işlenecek tap'ler (oyun pikseli). */
    this.taps = [];
    /** Her pointerdown'da çağrılır. */
    this.onPointerDown = null;
    /**
     * Tarayıcının "kullanıcı jesti" saydığı her olayda çağrılır. Ses sistemi
     * bunun içinde başlatılmalı. Dikkat: dokunmatikte pointerdown jest
     * sayılmaz; pointerup/touchend sayılır. Bu yüzden hepsini dinliyoruz.
     */
    this.onGesture = null;
    /** Fare imlecinin son konumu (oyun pikseli) veya null. */
    this.hover = null;

    this._downs = new Map();
    const c = screen.canvas;
    const gesture = () => {
      if (this.onGesture) this.onGesture();
    };
    // Pointer Events yoksa (eski iOS Safari ve eski tarayıcılar) dokunma + fare olayları
    onPointer(c, {
      down: (e) => this._down(e),
      move: (e) => this._move(e),
      up: (e) => this._up(e),
      cancel: (e) => this._downs.delete(e.pointerId),
      leave: (e) => {
        if (e.pointerType === 'mouse') this.hover = null;
      },
    });
    for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'mouseup', 'click']) c.addEventListener(ev, gesture);
    // Sağ tık menüsü ve uzun basınca çıkan menü olmasın.
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _down(e) {
    e.preventDefault();
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this._downs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.onPointerDown) this.onPointerDown(e);
  }

  _move(e) {
    if (e.pointerType === 'mouse') this.hover = this.screen.toGame(e.clientX, e.clientY);
  }

  _up(e) {
    const d = this._downs.get(e.pointerId);
    if (!d) return;
    this._downs.delete(e.pointerId);
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > TAP_MAX_MOVE) return;
    const p = this.screen.toGame(e.clientX, e.clientY);
    this.taps.push({ x: p.x, y: p.y, type: e.pointerType });
  }

  /** Biriken tap'leri alır ve listeyi boşaltır. */
  consumeTaps() {
    const t = this.taps;
    this.taps = [];
    return t;
  }
}

/**
 * Pointer Events'i olan tarayıcılarda onları, olmayanlarda dokunma ve fare
 * olaylarını dinler. İşleyicilere hep aynı biçimde bir olay gelir:
 * { pointerId, pointerType, clientX, clientY, button, target, preventDefault() }
 */
export function onPointer(el, { down, move, up, cancel, leave }) {
  if (window.PointerEvent) {
    if (down) el.addEventListener('pointerdown', down);
    if (move) el.addEventListener('pointermove', move);
    if (up) el.addEventListener('pointerup', up);
    if (cancel) el.addEventListener('pointercancel', cancel);
    if (leave) el.addEventListener('pointerleave', leave);
    return;
  }
  const opts = { passive: false };
  const wrapTouch = (fn) => (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      fn({
        pointerId: t.identifier, pointerType: 'touch', clientX: t.clientX, clientY: t.clientY, button: 0, target: e.target,
        preventDefault: () => e.preventDefault(),
      });
    }
  };
  const wrapMouse = (fn) => (e) => {
    // dokunmatikte tarayıcının ardından ürettiği sahte fare olaylarını yok say
    if (Date.now() - lastTouch < 800) return;
    fn({
      pointerId: 'mouse', pointerType: 'mouse', clientX: e.clientX, clientY: e.clientY, button: e.button, target: e.target,
      preventDefault: () => e.preventDefault(),
    });
  };
  let lastTouch = 0;
  const touched = (fn) => (e) => {
    lastTouch = Date.now();
    if (e.cancelable) e.preventDefault(); // kaydırma ve yakınlaştırma olmasın
    fn(e);
  };
  if (down) {
    el.addEventListener('touchstart', touched(wrapTouch(down)), opts);
    el.addEventListener('mousedown', wrapMouse(down));
  }
  if (move) {
    el.addEventListener('touchmove', touched(wrapTouch(move)), opts);
    el.addEventListener('mousemove', wrapMouse(move));
  }
  if (up) {
    el.addEventListener('touchend', touched(wrapTouch(up)), opts);
    el.addEventListener('mouseup', wrapMouse(up));
  }
  if (cancel) el.addEventListener('touchcancel', wrapTouch(cancel), opts);
  if (leave) el.addEventListener('mouseleave', wrapMouse(leave));
}
