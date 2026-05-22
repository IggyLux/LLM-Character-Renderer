export const STAGE = 480;
export const VAULT_SIZE = 120;
export const imgCache = {};

export function showError(msg) {
  const errBar = document.getElementById('err-bar');
  errBar.textContent = '⚠ ' + msg;
  errBar.style.display = 'block';
  setTimeout(() => errBar.style.display = 'none', 7000);
}

export function ev(v, t) {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    try {
      return Function('t', 'Math', 'sin', 'cos', 'PI', '"use strict";return(' + v + ')')(t, Math, Math.sin, Math.cos, Math.PI);
    } catch (e) {
      return 0;
    }
  }
  return v;
}

export function evc(v, t) {
  if (!v) return undefined;
  if (typeof v === 'string' && !v.includes('t')) return v;
  if (typeof v === 'string') {
    try {
      return Function('t', 'Math', '"use strict";return(' + v + ')')(t, Math);
    } catch (e) {
      return v;
    }
  }
  return v;
}

export function buildGrad(ctx, g) {
  try {
    let gr;
    if (g.type === 'linear') gr = ctx.createLinearGradient(g.x1 || 0, g.y1 || 0, g.x2 || 0, g.y2 || 100);
    else if (g.type === 'radial') gr = ctx.createRadialGradient(0, 0, g.r1 || 0, 0, 0, g.r2 || 50);
    else return null;
    (g.stops || []).forEach(([o, c]) => gr.addColorStop(o, c));
    return gr;
  } catch (e) {
    return null;
  }
}

export function rRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function hex2rgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) } : { r: 255, g: 255, b: 255 };
}

export function rgba(hex, a) {
  const c = hex2rgb(hex);
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}

export function darken(hex, amt) {
  const c = hex2rgb(hex);
  return `rgb(${Math.round(c.r * (1 - amt))},${Math.round(c.g * (1 - amt))},${Math.round(c.b * (1 - amt))})`;
}