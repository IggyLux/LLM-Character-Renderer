import { STAGE, ev, evc, buildGrad, rRect, hex2rgb, imgCache, executionBridge } from './helpers.js';

export const pState = {};

export function drawShape(ctx, canvas, s, t) {
  ctx.save();
  ctx.translate(ev(s.x, t) || 0, ev(s.y, t) || 0);
  ctx.rotate((ev(s.rotation, t) || 0) * Math.PI / 180);
  const sx = ev(s.scale_x, t) || ev(s.scale, t) || 1, sy = ev(s.scale_y, t) || ev(s.scale, t) || 1;
  ctx.scale(sx, sy);
  const alpha = ev(s.alpha, t); ctx.globalAlpha = alpha !== undefined ? alpha : 1;
  if (s.composite) ctx.globalCompositeOperation = s.composite;
  if (s.shadow) {
    ctx.shadowColor = s.shadow.color || 'transparent';
    ctx.shadowBlur = s.shadow.blur || 0;
    ctx.shadowOffsetX = s.shadow.offsetX || 0;
    ctx.shadowOffsetY = s.shadow.offsetY || 0;
  }
  const fill = evc(s.fill, t), stroke = evc(s.stroke, t);
  if (fill) ctx.fillStyle = fill;
  if (stroke) ctx.strokeStyle = stroke;
  if (s.line_width) ctx.lineWidth = ev(s.line_width, t);
  if (s.line_cap) ctx.lineCap = s.line_cap;
  if (s.line_join) ctx.lineJoin = s.line_join;
  if (s.gradient) ctx.fillStyle = buildGrad(ctx, s.gradient) || fill;
  
  switch (s.type) {
    case 'circle':
      ctx.beginPath(); ctx.arc(0, 0, ev(s.radius, t), 0, Math.PI * 2);
      if (fill || s.gradient) ctx.fill(); if (stroke) ctx.stroke();
      break;
    case 'ellipse':
      ctx.beginPath(); ctx.ellipse(0, 0, ev(s.rx, t), ev(s.ry, t), 0, 0, Math.PI * 2);
      if (fill || s.gradient) ctx.fill(); if (stroke) ctx.stroke();
      break;
    case 'rect': {
      const w = ev(s.width, t), h = ev(s.height, t), r = s.radius || 0;
      if (r) rRect(ctx, -w / 2, -h / 2, w, h, r);
      else { ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); }
      if (fill || s.gradient) ctx.fill(); if (stroke) ctx.stroke();
      break;
    }
    case 'polygon':
      ctx.beginPath(); (s.points || []).forEach(([px, py], i) => i === 0 ? ctx.moveTo(ev(px, t), ev(py, t)) : ctx.lineTo(ev(px, t), ev(py, t)));
      if (s.closed !== false) ctx.closePath();
      if (fill || s.gradient) ctx.fill(); if (stroke) ctx.stroke();
      break;
    case 'arc':
      ctx.beginPath(); ctx.arc(0, 0, ev(s.radius, t), (ev(s.start_angle, t) || 0) * Math.PI / 180, (ev(s.end_angle, t) || 360) * Math.PI / 180, s.counter_clockwise || false);
      if (s.close) ctx.closePath();
      if (fill || s.gradient) ctx.fill(); if (stroke) ctx.stroke();
      break;
    case 'line':
      ctx.beginPath(); ctx.moveTo(ev(s.x1, t), ev(s.y1, t)); ctx.lineTo(ev(s.x2, t), ev(s.y2, t));
      if (stroke) ctx.stroke();
      break;
    case 'bezier':
      ctx.beginPath(); ctx.moveTo(ev(s.x1, t), ev(s.y1, t));
      ctx.bezierCurveTo(ev(s.cp1x, t), ev(s.cp1y, t), ev(s.cp2x, t), ev(s.cp2y, t), ev(s.x2, t), ev(s.y2, t));
      if (fill !== undefined) ctx.fill(); if (stroke) ctx.stroke();
      break;
    case 'text': {
      const fs = ev(s.font_size, t) || 24;
      ctx.font = `${s.font_style || ''} ${fs}px ${s.font_family || 'monospace'}`;
      ctx.textAlign = s.align || 'center'; ctx.textBaseline = s.baseline || 'middle';
      if (fill) ctx.fillText(s.text || '', 0, 0); if (stroke) ctx.strokeText(s.text || '', 0, 0);
      break;
    }
    case 'path': {
      const p2 = new Path2D(s.d || '');
      if (fill || s.gradient) ctx.fill(p2); if (stroke) ctx.stroke(p2);
      break;
    }
    case 'image':
      if (!imgCache[s.src]) { imgCache[s.src] = new Image(); imgCache[s.src].src = s.src; }
      if (imgCache[s.src].complete) {
        const w = ev(s.width, t) || imgCache[s.src].naturalWidth, h = ev(s.height, t) || imgCache[s.src].naturalHeight;
        ctx.drawImage(imgCache[s.src], -w / 2, -h / 2, w, h);
      }
      break;
    case 'particle_system':
      drawParticles(ctx, s);
      break;
    case 'noise_rect': {
      const w = s.width || 100, h = s.height || 100, img = ctx.createImageData(w, h), c = hex2rgb(s.color || '#fff');
      for (let i = 0; i < img.data.length; i += 4) {
        img.data[i] = c.r; img.data[i + 1] = c.g; img.data[i + 2] = c.b; img.data[i + 3] = Math.random() * 255 * (s.alpha || .5);
      }
      ctx.putImageData(img, -w / 2, -h / 2);
      break;
    }
  }
  ctx.restore();
}

function drawParticles(ctx, s) {
  const id = s.id || 'ps';
  if (!pState[id]) {
    pState[id] = Array.from({ length: s.count || 20 }, () => ({
      x: (Math.random() - .5) * (s.spread_x || 80),
      y: (Math.random() - .5) * (s.spread_y || 80),
      vx: (Math.random() - .5) * (s.velocity || 1),
      vy: (Math.random() - .5) * (s.velocity || 1) - (s.rise || 0),
      life: Math.random(),
      maxLife: .5 + Math.random() * .5,
      size: (s.min_size || 2) + Math.random() * ((s.max_size || 5) - (s.min_size || 2)),
      color: Array.isArray(s.colors) ? s.colors[Math.floor(Math.random() * s.colors.length)] : (s.color || '#fff')
    }));
  }
  pState[id].forEach(p => {
    p.x += p.vx; p.y += p.vy; p.life += .016;
    if (p.life > p.maxLife) {
      p.x = (Math.random() - .5) * (s.spread_x || 80);
      p.y = (Math.random() - .5) * (s.spread_y || 80);
      p.life = 0;
    }
    ctx.save();
    ctx.globalAlpha = 1 - (p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });
}

export function renderMiniCharacter(data, targetCanvas) {
  const mCtx = targetCanvas.getContext('2d');
  const scale = 120 / STAGE;
  mCtx.clearRect(0, 0, 120, 120);
  
  // Save base clean state to prevent leakage across card draws
  mCtx.save();
  mCtx.scale(scale, scale);
  (data.canvas_shapes || []).forEach(s => drawShape(mCtx, targetCanvas, s, 0));
  if (data.canvas_code) {
    try { 
      // Executing inside scope bridge mapping context functions cleanly
      new Function('ctx', 'canvas', 't', 'size', 'data', 'helpers', 
        'with(helpers){' + data.canvas_code + '}'
      )(mCtx, targetCanvas, 0, STAGE, data, executionBridge); 
    } catch (e) {}
  }
  mCtx.restore();
}
