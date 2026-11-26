// Gazete görüntüleyici (hikâye girişi).
//
// assets/gazete.png pixel art değil: keskin ve okunaklı görünsün diye oyunun
// düşük çözünürlüklü canvas'ına değil, üstüne açılan bir HTML katmanına
// cihazın kendi çözünürlüğünde ve yumuşak ölçeklemeyle çizilir.
//   - Açılış: aşağıdan kayarak gelir, hafif dönerek düzelir.
//   - Gazeteye dokununca dokunulan yere 2 kat yakınlaşır; yakınken parmakla
//     kaydırılır; tekrar dokununca uzaklaşır.
//   - Köşede "Kapat" butonu; gazete dışındaki karanlığa dokunmak da kapatır.
// Görsel yoksa (henüz yüklenmediyse) kibar bir uyarı gösterilir.

import { onPointer } from './input.js';

export const NEWSPAPER_SRC = 'assets/gazete.png';

const ZOOM = 2;

export class NewspaperViewer {
  constructor() {
    this.isOpen = false;
    this.root = null;
    this.onClose = null;
  }

  build() {
    const root = document.createElement('div');
    Object.assign(root.style, {
      position: 'fixed', top: '0', left: '0', right: '0', bottom: '0', zIndex: '10', background: 'rgba(0,0,0,0)', transition: 'background 0.35s',
      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none',
    });
    const frame = document.createElement('div');
    Object.assign(frame.style, {
      position: 'relative', transition: 'transform 0.55s cubic-bezier(.2,.9,.3,1.15), opacity 0.35s',
      transform: 'translateY(70%) rotate(-7deg)', opacity: '0', willChange: 'transform',
    });
    const img = document.createElement('img');
    img.alt = 'Gazete';
    img.draggable = false;
    Object.assign(img.style, {
      display: 'block', imageRendering: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
      transformOrigin: '0 0', transition: 'transform 0.25s ease-out', userSelect: 'none', touchAction: 'none',
    });
    const missing = document.createElement('div');
    missing.textContent = 'Gazete görseli bulunamadı (assets/gazete.png).';
    Object.assign(missing.style, {
      display: 'none', padding: '28px 22px', maxWidth: '70vw', background: '#e8dcb8', color: '#3a3020',
      font: '16px monospace', textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,0.8)', transform: 'rotate(-1deg)',
    });
    const close = document.createElement('button');
    close.textContent = 'KAPAT';
    Object.assign(close.style, {
      position: 'fixed', top: '12px', right: '12px',
      minWidth: '96px', minHeight: '52px', padding: '0 18px', zIndex: '11', cursor: 'pointer',
      font: 'bold 18px monospace', letterSpacing: '2px', color: '#ffe0a0', background: '#4a2e14',
      border: '3px solid #a8743a', boxShadow: '0 0 0 3px #0d0a09', imageRendering: 'pixelated',
    });
    // çentikli ekranlarda güvenli alan (eski tarayıcılar bu değerleri yok sayar)
    close.style.top = 'max(12px, env(safe-area-inset-top))';
    close.style.right = 'max(12px, env(safe-area-inset-right))';
    if (!close.style.top) close.style.top = '12px';
    if (!close.style.right) close.style.right = '12px';
    frame.appendChild(img);
    frame.appendChild(missing);
    root.appendChild(frame);
    root.appendChild(close);
    this.root = root;
    this.frame = frame;
    this.img = img;
    this.missing = missing;
    this.closeBtn = close;

    img.addEventListener('load', () => this.fit());
    img.addEventListener('error', () => {
      img.style.display = 'none';
      missing.style.display = 'block';
    });
    onPointer(close, {
      down: (e) => e.preventDefault(),
      up: () => this.close(),
    });
    window.addEventListener('resize', () => this.isOpen && this.fit());

    // dokunma: zoom ve kaydırma
    this.zoomed = false;
    this.tx = 0;
    this.ty = 0;
    let down = null;
    onPointer(root, {
      down: (e) => {
        if (e.target === close) return; // Kapat butonu kendi olayını alsın
        e.preventDefault();
        down = { x: e.clientX, y: e.clientY, tx: this.tx, ty: this.ty, moved: false, onImg: e.target === img, id: e.pointerId };
        if (root.setPointerCapture && typeof e.pointerId === 'number' && window.PointerEvent) {
          try {
            root.setPointerCapture(e.pointerId);
          } catch (err) {
            /* önemli değil */
          }
        }
      },
      move: (e) => {
        if (!down || e.pointerId !== down.id) return;
        const dx = e.clientX - down.x, dy = e.clientY - down.y;
        if (Math.hypot(dx, dy) > 8) down.moved = true;
        if (this.zoomed && down.moved) {
          this.img.style.transition = 'none';
          this.setPan(down.tx + dx, down.ty + dy);
        }
      },
      up: (e) => {
        const d = down;
        if (!d || e.pointerId !== d.id) return;
        down = null;
        this.img.style.transition = 'transform 0.25s ease-out';
        if (d.moved) return;
        if (!d.onImg && !this.zoomed) {
          this.close(); // gazetenin dışındaki karanlığa dokunuldu
          return;
        }
        this.toggleZoom(e.clientX, e.clientY);
      },
    });
  }

  /** Görseli oranını bozmadan ekrana sığacak en büyük boyuta getir. */
  fit() {
    const img = this.img;
    if (!img.naturalWidth) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const margin = Math.min(24, vw * 0.04);
    const k = Math.min((vw - margin * 2) / img.naturalWidth, (vh - margin * 2) / img.naturalHeight);
    this.w = Math.round(img.naturalWidth * k);
    this.h = Math.round(img.naturalHeight * k);
    img.style.width = this.w + 'px';
    img.style.height = this.h + 'px';
    this.zoomed = false;
    this.setPan(0, 0);
  }

  toggleZoom(cx, cy) {
    if (this.zoomed) {
      this.zoomed = false;
      this.setPan(0, 0);
      return;
    }
    const r = this.img.getBoundingClientRect();
    // dokunulan nokta (görsel içinde) yakınlaşınca parmağın altında kalsın
    const px = Math.max(0, Math.min(this.w, cx - r.left)), py = Math.max(0, Math.min(this.h, cy - r.top));
    this.zoomed = true;
    this.setPan(-px * (ZOOM - 1), -py * (ZOOM - 1));
  }

  setPan(tx, ty) {
    if (this.zoomed) {
      const minX = -this.w * (ZOOM - 1), minY = -this.h * (ZOOM - 1);
      tx = Math.max(minX, Math.min(0, tx));
      ty = Math.max(minY, Math.min(0, ty));
      this.img.style.transform = `translate(${tx}px, ${ty}px) scale(${ZOOM})`;
    } else {
      tx = ty = 0;
      this.img.style.transform = 'none';
    }
    this.tx = tx;
    this.ty = ty;
  }

  open(onClose) {
    if (this.isOpen) return;
    if (!this.root) this.build();
    this.onClose = onClose;
    this.isOpen = true;
    document.body.appendChild(this.root);
    if (!this.img.getAttribute('src')) this.img.src = NEWSPAPER_SRC;
    else this.fit();
    // açılış animasyonu
    requestAnimationFrame(() => {
      this.root.style.background = 'rgba(0,0,0,0.82)';
      this.frame.style.transform = 'translateY(0) rotate(0deg)';
      this.frame.style.opacity = '1';
    });
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.root.style.background = 'rgba(0,0,0,0)';
    this.frame.style.transform = 'translateY(70%) rotate(-7deg)';
    this.frame.style.opacity = '0';
    const root = this.root;
    setTimeout(() => {
      if (!this.isOpen && root.parentNode) root.parentNode.removeChild(root);
      this.zoomed = false;
      this.setPan(0, 0);
    }, 380);
    if (this.onClose) this.onClose();
  }
}

/** Tek bir görüntüleyici yeterli. */
export const newspaper = new NewspaperViewer();
