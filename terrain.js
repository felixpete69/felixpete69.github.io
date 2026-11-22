/* Local orthographic relief renderer. The same DEM drives all three views. */
(() => {
  'use strict';
  const frame = document.querySelector('.relief-frame');
  const image = frame?.querySelector('.relief-image');
  const grid = window.zijinTerrainGrid;
  if (!image || !grid) return;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.className = 'terrain-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;touch-action:pan-y;cursor:grab;visibility:hidden';
  frame.append(canvas);

  const { columns, rows, step, minX, minY } = grid;
  const elevation = Uint8Array.from(atob(grid.heights), c => c.charCodeAt(0));
  const light = new Uint8Array(elevation.length);
  const clamp = (x, a, b) => Math.max(a, Math.min(x, b));
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < columns - 1; x++) {
      const i = y * columns + x;
      const east = (elevation[i + 1] - elevation[i - 1]) / step;
      const front = (elevation[i + columns] - elevation[i - columns]) / step;
      light[i] = clamp(92 + 448 * east - 128 * front, 9, 244);
    }
  }

  function heightAt(x, y) {
    const gx = clamp((x - minX) / step, 0, columns - 1.01);
    const gy = clamp((y - minY) / step, 0, rows - 1.01);
    const i = Math.floor(gy) * columns + Math.floor(gx);
    const sx = gx % 1, sy = gy % 1;
    return 2 * ((elevation[i] * (1-sx) + elevation[i+1] * sx) * (1-sy)
      + (elevation[i+columns] * (1-sx) + elevation[i+columns+1] * sx) * sy);
  }

  let seed = 3179;
  function random() {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const onSurface = (x, y) => ({ x, y, h: heightAt(x, y) });

  // Survey nodes and surface-following ties. Every tie samples local relief.
  const nodes = [];
  for (let y = -1600; y <= 1800; y += 730) {
    for (let x = -2700; x <= 2800; x += 800) {
      const p = onSurface(x + 275 * (random() - .5), y + 230 * (random() - .5));
      if (p.h > 45 && (p.x / 3300)**2 + (p.y / 2380)**2 < .92) nodes.push(p);
    }
  }
  const ties = [];
  nodes.forEach((start, i) => {
    nodes.slice(i + 1).forEach(end => {
      const distance = Math.hypot(start.x - end.x, start.y - end.y);
      if (distance > 1110) return;
      const points = [];
      for (let j = 0; j <= 18; j++) {
        const t = j / 18;
        points.push(onSurface(start.x + t*(end.x-start.x), start.y + t*(end.y-start.y)));
      }
      ties.push({ points, offset: random() });
    });
  });

  // Downhill traces follow the local DEM gradient, terminating at flats and
  // the footprint boundary. A small inertial component smooths the raster steps.
  const streams = [];
  for (let i = 0; i < 240 && streams.length < 76; i++) {
    let x = (random() - .5) * 5500, y = (random() - .5) * 3300;
    if (heightAt(x, y) < 110) continue;
    const points = [onSurface(x,y)];
    let dx = 0, dy = 0;
    for (let j = 0; j < 92; j++) {
      const gx = heightAt(x-30,y) - heightAt(x+30,y);
      const gy = heightAt(x,y-30) - heightAt(x,y+30);
      const length = Math.hypot(gx,gy);
      if (length < .65) break;
      dx = .55*dx + .45*gx/length;
      dy = .55*dy + .45*gy/length;
      x += 36*dx; y += 36*dy;
      const p = onSurface(x,y);
      if (p.h > points[points.length-1].h + .32 || (x/3350)**2 + (y/2430)**2 > .95) break;
      points.push(p);
    }
    if (points.length >= 13) streams.push({ points, offset: random(), speed: .16 + .13*random() });
  }

  const peak = new Float32Array(128);
  const pigment = new Uint32Array(256);
  for (let i = 0; i < 128; i++) {
    const d = Math.min(i, 128-i) / 14;
    peak[i] = Math.exp(-.5*d*d);
  }
  for (let i = 0; i < 256; i++) pigment[i] = (i << 24) | (132 << 16) | (181 << 8) | 154;

  let pixels, raster, frontDepth, grain;
  let width = 0, height = 0, scale = 1, left = 0, bottom = 0;
  function resize() {
    const rect = frame.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    width = Math.max(100, Math.min(880, Math.round(rect.width*Math.min(devicePixelRatio || 1, 1.45))));
    height = Math.round(width*rect.height/rect.width);
    canvas.width = width; canvas.height = height;
    scale = Math.min(width/1420,height/938);
    left = width*.5;
    bottom = height*.5 + (746-469)*scale;
    pixels = ctx.createImageData(width,height);
    raster = new Uint32Array(pixels.data.buffer);
    frontDepth = new Int16Array(width*height);
    grain = new Float32Array(width*height);
    for (let i=0; i<grain.length; i++) grain[i] = random();
  }

  let mode = 'orbit', time = 0;
  let yaw = 0, cos = 1, sin = 0, depthScale = .08;
  let cursorX = 0, cursorY = 0, pitch = 0, drag = 0, dragStart = null;
  let accumulator = 0;

  function drawSurface() {
    raster.fill(0);
    frontDepth.fill(-12000);
    const cameraStep = width > 650 ? 20 : 27;
    const sceneGain = mode === 'orbit' ? 1.08 : .83;
    // Each screen column is a ray through the height field. Marching from
    // near to far produces a silhouette and a depth buffer for the overlays.
    for (let px=0; px<width; px++) {
      const across = (px-left)*5.03/scale;
      let horizon = height, lastHeight = 0, lastD = 0, lastY = 0;
      for (let d=3400; d>=-3400; d-=cameraStep) {
        const x = across*cos - d*sin, y = across*sin + d*cos;
        const ex=x/3430, ey=y/2510, extent=ex*ex+ey*ey;
        if (extent >= 1) continue;
        const gx=(x-minX)/step, gy=(y-minY)/step;
        const ix=Math.floor(gx), iy=Math.floor(gy), i=iy*columns+ix;
        const fx=gx-ix, fy=gy-iy;
        const h=2*((elevation[i]+fx*(elevation[i+1]-elevation[i]))*(1-fy)
          +(elevation[i+columns]+fx*(elevation[i+columns+1]-elevation[i+columns]))*fy);
        const screen=Math.floor(bottom+(d*depthScale-h*1.53)*scale);
        if (screen >= horizon || screen >= height) continue;
        if (screen < 0) break;
        const boundary = horizon === height;
        const end = boundary ? screen+1 : horizon;
        const span = end-screen;
        const sun = light[i]/255;
        const edge = Math.min(1,(1-extent)*6.7) * clamp((h-18)/64,.13,1);
        const ink = sceneGain*edge;
        const shade = 11 + 74*sun;
        const screenStipple = px%3 === 0;
        for (let row=screen, n=row*width+px; row<end; row++, n+=width) {
          const t = boundary ? 0 : (row-screen)/span;
          const surfaceHeight = h+(lastHeight-h)*t;
          const surveyY = y+(lastY-y)*t;
          const stripe = peak[(Math.floor(surveyY*(128/43))) & 127];
          const contour = peak[(Math.floor(surfaceHeight*(128/18))) & 127];
          const stipple = screenStipple && (row+Math.floor(px/3))%3===0 ? 47 : 0;
          const alpha = ink*(shade + (46+96*sun)*stripe + 28*contour + stipple)
            * (.73 + .32*grain[n]);
          raster[n] = pigment[Math.min(255,alpha|0)];
          frontDepth[n] = d+(lastD-d)*t;
        }
        horizon=screen; lastHeight=h; lastD=d; lastY=y;
      }
    }
    ctx.putImageData(pixels,0,0);
  }

  function project(p) {
    const d = -p.x*sin + p.y*cos;
    const x = left + (p.x*cos+p.y*sin)*scale/5.03;
    const y = bottom + (d*depthScale-p.h*1.53)*scale;
    const px = Math.round(x), py = Math.round(y);
    const visible = px >= 0 && px < width && py >= 0 && py < height
      && d >= frontDepth[py*width+px]-155;
    return { x, y, visible };
  }
  function trace(path, points, start=0, end=points.length) {
    let penDown=false;
    for (let i=start; i<end; i++) {
      const p = points[i];
      if (!p.visible) { penDown=false; continue; }
      if (penDown) path.lineTo(p.x,p.y);
      else path.moveTo(p.x,p.y);
      penDown=true;
    }
  }
  const tau = 2*Math.PI;
  function drawConnections() {
    const wires = new Path2D(), pulses = new Path2D(), marks = new Path2D();
    for (const tie of ties) {
      const points = tie.points.map(project);
      trace(wires, points);
      const phase = ((time*.26+tie.offset)%1)*(points.length-1);
      const i=Math.floor(phase), a=points[i], b=points[i+1];
      if (a.visible && b.visible) {
        const t=phase-i, x=a.x+(b.x-a.x)*t, y=a.y+(b.y-a.y)*t, radius=2.4*scale+1;
        pulses.moveTo(x+radius,y); pulses.arc(x,y,radius,0,tau);
      }
    }
    for (const p of nodes.map(project)) {
      if (!p.visible) continue;
      const radius = 4*scale+1.3;
      marks.moveTo(p.x+radius,p.y); marks.arc(p.x,p.y,radius,0,tau);
    }
    ctx.lineWidth=Math.max(.75,2*scale);
    ctx.strokeStyle='rgba(163,211,153,.88)'; ctx.stroke(wires);
    ctx.lineWidth=Math.max(1,2.6*scale);
    ctx.strokeStyle='#d1e5b9'; ctx.stroke(marks);
    ctx.fillStyle='#edf5d6'; ctx.fill(pulses);
  }
  function drawFlow() {
    const beds = new Path2D(), tails = new Path2D(), heads = new Path2D();
    for (const stream of streams) {
      const points=stream.points.map(project);
      trace(beds,points);
      const head=Math.floor(((time*stream.speed+stream.offset)%1.12)*points.length);
      if (head < points.length) {
        trace(tails,points,Math.max(0,head-9),head+1);
        trace(heads,points,Math.max(0,head-3),head+1);
      }
    }
    ctx.lineCap='round';
    ctx.lineWidth=Math.max(.7,1.9*scale); ctx.strokeStyle='rgba(137,196,165,.52)'; ctx.stroke(beds);
    ctx.lineWidth=Math.max(1,3.1*scale); ctx.strokeStyle='#86ccb0'; ctx.stroke(tails);
    ctx.lineWidth=Math.max(1.1,3.8*scale); ctx.strokeStyle='#d3f4ce'; ctx.stroke(heads);
  }

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let intersecting=true, request=0, previous=0;
  const stopped = () => reduced.matches || document.documentElement.dataset.motion==='paused';
  function tick(now) {
    if (stopped() || !intersecting || document.hidden) { request=0; return; }
    const elapsed = previous ? Math.min(.09,(now-previous)/1000) : 0;
    previous=now; accumulator+=elapsed;
    if (accumulator >= 1/32 || canvas.style.visibility==='hidden') {
      time+=accumulator;
      const target = (mode==='orbit' ? .45*Math.sin(time*.43) : .095*Math.sin(time*.32))
        + cursorX*.17+drag;
      const ease = Math.max(.18,1-Math.exp(-accumulator*7));
      yaw+=(target-yaw)*ease; pitch+=(cursorY-pitch)*ease;
      cos=Math.cos(yaw); sin=Math.sin(yaw); depthScale=.08+.025*pitch;
      accumulator=0;
      if (width && height) {
        drawSurface();
        if (mode==='connect') drawConnections();
        if (mode==='flow') drawFlow();
        canvas.style.visibility='visible'; image.style.visibility='hidden';
      }
    }
    request=requestAnimationFrame(tick);
  }
  function sync() {
    if (request) cancelAnimationFrame(request);
    request=0; previous=0; accumulator=0;
    if (stopped()) {
      canvas.style.visibility='hidden'; image.style.visibility='';
    } else if (intersecting && !document.hidden) request=requestAnimationFrame(tick);
  }
  window.addEventListener('terrain:mode',event => {
    const name=event.detail?.mode;
    if (!['orbit','connect','flow'].includes(name)) return;
    mode=name; sync();
  });
  frame.addEventListener('pointermove',event => {
    if (stopped()) return;
    const r=frame.getBoundingClientRect();
    if (event.pointerType !== 'touch') {
      cursorX=clamp((event.clientX-r.left)/r.width*2-1,-1,1);
      cursorY=clamp((event.clientY-r.top)/r.height*2-1,-1,1);
    }
    if (dragStart && dragStart.id===event.pointerId)
      drag=dragStart.yaw+(event.clientX-dragStart.x)/r.width*2.8;
  });
  frame.addEventListener('pointerdown',event => {
    if (stopped() || event.button!==0) return;
    dragStart={ id:event.pointerId,x:event.clientX,yaw:drag };
    canvas.style.cursor='grabbing';
    frame.setPointerCapture(event.pointerId);
  });
  frame.addEventListener('lostpointercapture',() => { dragStart=null; canvas.style.cursor='grab'; });
  frame.addEventListener('pointerleave',() => { cursorX=0; cursorY=0; });
  document.addEventListener('visibilitychange',sync);
  reduced.addEventListener('change',sync);
  new MutationObserver(sync).observe(document.documentElement,{ attributes:true,attributeFilter:['data-motion'] });
  new ResizeObserver(() => { resize(); sync(); }).observe(frame);
  new IntersectionObserver(([entry]) => { intersecting=entry.isIntersecting; sync(); }).observe(frame);
  resize(); sync();
})();
