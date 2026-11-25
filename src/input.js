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
    /** Her pointerdown'da çağrılır (tarayıcı kullanıcı jesti içinde). */
    this.onPointerDown = null;
    /** Fare imlecinin son konumu (oyun pikseli) veya null. */
    this.hover = null;

    this._downs = new Map();
    const c = screen.canvas;
    c.addEventListener('pointerdown', (e) => this._down(e));
    c.addEventListener('pointermove', (e) => this._move(e));
    c.addEventListener('pointerup', (e) => this._up(e));
    c.addEventListener('pointercancel', (e) => this._downs.delete(e.pointerId));
    c.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') this.hover = null;
    });
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
