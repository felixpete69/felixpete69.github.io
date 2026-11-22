(() => {
  'use strict';

  const byId = id => document.getElementById(id);
  const all = selector => [...document.querySelectorAll(selector)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  function select(buttons, active) {
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button === active)));
  }

  function setupSandbox() {
    const canvas = byId('map');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const locations = [];
    const descriptions = {
      points: 'Each point is a synthetic location. Drag to pan or select a point to read its coordinates.',
      heat: 'Overlapping points make brighter patches. The colour shows visual concentration across the sample.',
      network: 'Each point connects to its nearest neighbour. Change the sample size to see how the connections shift.'
    };
    const legends = { points: 'Sample locations', heat: 'Visual concentration', network: 'Nearest-neighbour links' };
    let seed = 2026;
    let layer = 'points';
    let width = 0, height = 0, zoom = 1, panX = 0, panY = 0;
    let count = Number(byId('density').value), selected = null, links = [];
    let drag = null, frame = 0, visible = !('IntersectionObserver' in window), playing = true, time = 0, previousTime = 0;
    const angle = -.15;

    function random() {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    }

    function makeLinks() {
      const sample = locations.slice(0, count);
      links = sample.map(point => {
        let nearest = null, minDistance = Infinity;
        for (const other of sample) {
          if (point === other) continue;
          const distance = (point.x - other.x) ** 2 + (point.y - other.y) ** 2;
          if (distance < minDistance) {
            minDistance = distance;
            nearest = other;
          }
        }
        return [point, nearest];
      });
    }

    function generate() {
      const centres = [[-160, -75], [130, 80], [50, -120]];
      locations.length = 0;
      for (let i = 0; i < Number(byId('density').max); i++) {
        const [cx, cy] = centres[i % centres.length];
        const a = random() * Math.PI * 2;
        const r = Math.sqrt(random()) * 155;
        locations.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, phase: random() });
      }
      selected = null;
      byId('selectedPoint').textContent = 'Select a point';
      byId('pointCoordinates').textContent = 'Synthetic coordinates';
      byId('pointTooltip').hidden = true;
      makeLinks();
      draw();
    }

    function dot(x, y, radius, colour) {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = colour;
      ctx.fill();
    }

    function baseMap() {
      ctx.fillStyle = '#111813';
      ctx.fillRect(0, 0, width, height);
      ctx.save();
      ctx.translate(width / 2 + panX, height / 2 + panY);
      ctx.scale(zoom, zoom);
      ctx.rotate(angle);
      const cosine = Math.cos(angle), sine = Math.sin(angle);
      const centreX = (-panX * cosine - panY * sine) / zoom;
      const centreY = (panX * sine - panY * cosine) / zoom;
      const halfWidth = (width * Math.abs(cosine) + height * Math.abs(sine)) / (2 * zoom);
      const halfHeight = (width * Math.abs(sine) + height * Math.abs(cosine)) / (2 * zoom);
      const xStart = Math.floor((centreX - halfWidth) / 55) * 55;
      const yStart = Math.floor((centreY - halfHeight) / 48) * 48;
      ctx.fillStyle = '#19281d';
      ctx.strokeStyle = '#354b38';
      ctx.lineWidth = .6;
      for (let x = xStart; x <= centreX + halfWidth; x += 55) {
        for (let y = yStart; y <= centreY + halfHeight; y += 48) {
          ctx.fillRect(x + 5, y + 5, 43, 35);
          ctx.strokeRect(x + 5, y + 5, 43, 35);
        }
      }
      ctx.beginPath();
      ctx.moveTo(-1400, -85);
      ctx.bezierCurveTo(-450, -220, -210, 180, 30, 85);
      ctx.bezierCurveTo(280, -20, 490, -180, 1400, 140);
      ctx.lineWidth = 40;
      ctx.strokeStyle = '#334c40';
      ctx.stroke();
      ctx.lineWidth = 31;
      ctx.strokeStyle = '#223c31';
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-1000, -570);
      ctx.lineTo(1000, 500);
      ctx.moveTo(-1000, 620);
      ctx.lineTo(1000, -580);
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#4e6051';
      ctx.stroke();
    }

    function draw() {
      if (!width || !height) return;
      baseMap();
      const sample = locations.slice(0, count);
      if (layer === 'heat') {
        for (const p of sample) {
          const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 56);
          gradient.addColorStop(0, 'rgba(138,210,142,.36)');
          gradient.addColorStop(.5, 'rgba(69,155,97,.16)');
          gradient.addColorStop(1, 'rgba(64,145,96,0)');
          ctx.fillStyle = gradient;
          ctx.fillRect(p.x - 56, p.y - 56, 112, 112);
        }
      }
      if (layer === 'network') {
        ctx.strokeStyle = '#9bbf9e';
        ctx.lineWidth = 1;
        for (const [p, q] of links) {
          if (!q) continue;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
          if (playing) {
            const phase = (time * .45 + p.phase) % 1;
            dot(p.x + (q.x - p.x) * phase, p.y + (q.y - p.y) * phase, 2, '#e2f2df');
          }
        }
      }
      for (const p of sample) {
        if (layer !== 'heat') {
          const pulse = playing ? 2 * Math.sin(time * 2 + p.phase * Math.PI * 2) : 0;
          dot(p.x, p.y, 6 + pulse, '#80b98c28');
        }
        dot(p.x, p.y, layer === 'heat' ? 1.6 : 3.2, '#b8e2b6');
      }
      if (selected !== null) {
        const p = locations[selected];
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10 / zoom, 0, Math.PI * 2);
        ctx.strokeStyle = '#edf2e2';
        ctx.lineWidth = 1.5 / zoom;
        ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = '#d3e4d2';
      ctx.font = '13px monospace';
      ctx.fillText('N ↑', width - 45, 34);
    }

    function resize() {
      const bounds = canvas.getBoundingClientRect();
      width = bounds.width;
      height = bounds.height;
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      draw();
    }

    const globalPause = () => document.documentElement.dataset.motion === 'paused';
    function shouldAnimate() {
      return playing && layer !== 'heat' && !reduceMotion.matches && !globalPause() && visible && !document.hidden;
    }
    function frameLoop(timestamp) {
      frame = 0;
      if (!shouldAnimate()) return;
      if (timestamp - previousTime >= 50) {
        time += Math.min(timestamp - previousTime, 100) / 1000;
        previousTime = timestamp;
        draw();
      }
      frame = requestAnimationFrame(frameLoop);
    }

    function schedule() {
      if (!shouldAnimate()) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else if (!frame) {
        previousTime = performance.now();
        frame = requestAnimationFrame(frameLoop);
      }
    }

    function syncMotion() {
      const button = byId('motion');
      const blocked = reduceMotion.matches || globalPause() || layer === 'heat';
      button.disabled = blocked;
      button.textContent = layer === 'heat' ? 'Static layer' : blocked ? 'Motion paused' : playing ? 'Pause motion' : 'Play motion';
      button.setAttribute('aria-pressed', String(playing && !blocked));
      button.title = layer === 'heat' ? 'Density is a static layer' : reduceMotion.matches ? 'Reduced motion is enabled in system settings' : globalPause() ? 'Page motion is paused' : '';
      schedule();
      draw();
    }

    function changeView(factor = 1) {
      zoom = Math.min(3, Math.max(.6, zoom * factor));
      panX = Math.max(-width, Math.min(width, panX));
      panY = Math.max(-height, Math.min(height, panY));
      byId('zoomValue').textContent = zoom.toFixed(1) + '×';
      byId('pointTooltip').hidden = true;
      draw();
    }

    function reset() {
      zoom = 1;
      panX = panY = 0;
      changeView();
    }

    function label(index) {
      return 'Location ' + String(index + 1).padStart(3, '0');
    }

    function inspect(index) {
      selected = index;
      const p = locations[index];
      const coordinates = 'x ' + p.x.toFixed(1) + ' / y ' + p.y.toFixed(1) + ' · synthetic units';
      byId('selectedPoint').textContent = label(index);
      byId('pointCoordinates').textContent = coordinates;
      byId('mapStatus').textContent = label(index) + ', ' + coordinates;
      draw();
    }

    function nearest(e) {
      const bounds = canvas.getBoundingClientRect();
      const dx = (e.clientX - bounds.left - width / 2 - panX) / zoom;
      const dy = (e.clientY - bounds.top - height / 2 - panY) / zoom;
      const x = dx * Math.cos(angle) + dy * Math.sin(angle);
      const y = -dx * Math.sin(angle) + dy * Math.cos(angle);
      let best = 16 / zoom, match = null;
      for (let i = 0; i < count; i++) {
        const d = Math.hypot(locations[i].x - x, locations[i].y - y);
        if (d < best) {
          best = d;
          match = i;
        }
      }
      return match;
    }

    canvas.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      canvas.focus({ preventScroll: true });
      drag = { originX: e.clientX, originY: e.clientY, x: e.clientX, y: e.clientY };
      byId('pointTooltip').hidden = true;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', e => {
      if (drag) {
        panX += e.clientX - drag.x;
        panY += e.clientY - drag.y;
        drag.x = e.clientX;
        drag.y = e.clientY;
        changeView();
        return;
      }
      if (e.pointerType === 'touch') return;
      const index = nearest(e), tip = byId('pointTooltip');
      tip.hidden = index === null;
      canvas.style.cursor = index === null ? 'grab' : 'pointer';
      if (index !== null) {
        tip.textContent = label(index);
        const rect = canvas.getBoundingClientRect();
        tip.style.left = Math.max(4, Math.min(width - 128, e.clientX - rect.left + 12)) + 'px';
        tip.style.top = Math.max(4, e.clientY - rect.top - 44) + 'px';
      }
    });
    canvas.addEventListener('pointerup', e => {
      if (drag && Math.hypot(e.clientX - drag.originX, e.clientY - drag.originY) < 8) {
        const index = nearest(e);
        if (index !== null) inspect(index);
      }
      drag = null;
    });
    canvas.addEventListener('lostpointercapture', () => { drag = null; });
    canvas.addEventListener('pointerleave', () => { byId('pointTooltip').hidden = true; });
    canvas.addEventListener('keydown', e => {
      switch (e.key) {
        case 'ArrowLeft': panX += 25; break;
        case 'ArrowRight': panX -= 25; break;
        case 'ArrowUp': panY += 25; break;
        case 'ArrowDown': panY -= 25; break;
        case '+':
        case '=': e.preventDefault(); changeView(1.2); return;
        case '-': e.preventDefault(); changeView(1 / 1.2); return;
        case '0': e.preventDefault(); reset(); return;
        default: return;
      }
      e.preventDefault();
      changeView();
    });

    const layers = all('[data-layer]');
    for (const button of layers) {
      button.onclick = () => {
        layer = button.dataset.layer;
        select(layers, button);
        byId('legendText').textContent = legends[layer];
        byId('layerDescription').textContent = descriptions[layer];
        syncMotion();
      };
    }
    byId('density').oninput = e => {
      count = Number(e.target.value);
      if (selected !== null && selected >= count) inspect(count - 1);
      byId('densityValue').value = count;
      byId('pointTooltip').hidden = true;
      makeLinks();
      draw();
    };
    byId('previousPoint').onclick = () => inspect(selected === null ? count - 1 : (selected + count - 1) % count);
    byId('nextPoint').onclick = () => inspect(selected === null ? 0 : (selected + 1) % count);
    byId('zoomIn').onclick = () => changeView(1.2);
    byId('zoomOut').onclick = () => changeView(1 / 1.2);
    byId('reset').onclick = reset;
    byId('regenerate').onclick = () => {
      generate();
      byId('mapStatus').textContent = 'Generated a new pattern with ' + count + ' locations.';
    };
    byId('motion').onclick = () => {
      playing = !playing;
      syncMotion();
    };
    byId('exportMap').onclick = () => {
      draw();
      const filename = 'spatial-sandbox-' + layer + '.png';
      canvas.toBlob(blob => {
        if (!blob) {
          byId('mapStatus').textContent = 'The map image could not be saved. Please try again.';
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.hidden = true;
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      }, 'image/png');
    };
    document.addEventListener('visibilitychange', schedule);
    reduceMotion.addEventListener('change', syncMotion);
    new MutationObserver(syncMotion).observe(document.documentElement, {attributes: true, attributeFilter: ['data-motion']});
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        schedule();
      }).observe(canvas);
    }
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
    else window.addEventListener('resize', resize);
    generate();
    resize();
    syncMotion();
  }

  function setupProjects() {
    const projects = {
      quant: {
        name: 'Quantitative Methods', category: 'Course notebook',
        description: 'My statistics notebooks from the Quantitative Methods course at UCL CASA.',
        details: ['Plot probability distributions in JupyterLab.', 'Use exploratory analysis to choose a hypothesis test.', 'Keep the Python code, figures and interpretation together.'],
        access: 'Private course repository. A GitHub account with access is required.',
        href: 'https://github.com/felixpete69/Quantitative-Methods', link: 'View course repository'
      },
      reuse: {
        name: 'Efficient Code', category: 'Practical 04',
        description: 'A practical on reading remote files and choosing Python data structures for spatial analysis.',
        details: ['Download and decode a remote CSV file.', 'Handle quoted fields with Python’s csv module.', 'Use dictionaries and NumPy to locate records and calculate summaries.'],
        access: 'Notebook in a private course repository. A GitHub account with access is required.',
        href: 'https://github.com/felixpete69/Quantitative-Methods/blob/main/practicals3/Practical-04-Reuse.ipynb', link: 'Open notebook'
      },
      map: {
        name: 'Spatial Sandbox', category: 'Browser experiment',
        description: 'An interactive map of an imagined city. Each location is generated in the browser.',
        details: ['Compare points, visual concentration and nearest-neighbour links.', 'Pan, zoom and inspect locations individually.', 'Change the sample size, generate a pattern or export a PNG.'],
        access: 'Open browser experiment.', href: '#lab', link: 'Open playground'
      }
    };
    const filters = all('[data-filter]'), rows = all('[data-project]');
    filters.forEach(button => {
      button.onclick = () => {
        select(filters, button);
        let visible = 0;
        for (const row of rows) {
          row.hidden = button.dataset.filter !== 'all' && button.dataset.filter !== row.dataset.category;
          if (!row.hidden) visible++;
        }
        byId('filterStatus').textContent = 'Showing ' + visible + (visible === 1 ? ' project.' : ' projects.');
      };
    });
    const dialog = byId('projectDialog');
    for (const row of rows) {
      row.onclick = () => {
        const project = projects[row.dataset.project];
        byId('dialogCategory').textContent = project.category;
        byId('dialogTitle').textContent = project.name;
        byId('dialogDescription').textContent = project.description;
        byId('dialogDetails').replaceChildren(...project.details.map(detail => {
          const li = document.createElement('li');
          li.textContent = detail;
          return li;
        }));
        byId('dialogAccess').textContent = project.access;
        const link = byId('dialogLink');
        link.href = project.href;
        link.target = project.href.startsWith('#') ? '_self' : '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = project.link;
        dialog.showModal();
      };
    }
    byId('closeDialog').onclick = () => dialog.close();
    byId('dialogLink').onclick = () => {
      if (byId('dialogLink').getAttribute('href').startsWith('#')) dialog.close();
    };
  }

  function setupGallery() {
    const items = [
      {"src":"assets/nanjing/nanjing-relief.jpg","title":"Nanjing · the whole city","group":"city","caption":"Figure 15 · A citywide 3D map combining terrain and remote-sensing imagery."},
      {"src":"assets/nanjing/nanjing-topography.jpg","title":"A landscape in relief","group":"city","caption":"Figure 26 · Nanjing 3D Topographic Landscape Map."},
      {"src":"assets/nanjing/urban-artistic.jpg","title":"Urban form · cartographic base","group":"city","caption":"Figure 27 · Nanjing 3D Urban Morphology & Landscape Map, with an artistically processed base."},
      {"src":"assets/nanjing/urban-imagery.jpg","title":"Urban form · imagery base","group":"city","caption":"Figure 28 · A complementary view of Nanjing’s urban form using a remote-sensing base."},
      {"src":"assets/nanjing/pukou.jpg","title":"Pukou · district study","group":"district","caption":"Figure 16 · District-scale 3D remote-sensing map from the Nanjing series."},
      {"src":"assets/nanjing/gaochun.jpg","title":"Gaochun · district study","group":"district","caption":"Figure 17 · District-scale 3D remote-sensing map from the Nanjing series."},
      {"src":"assets/nanjing/gulou.jpg","title":"Gulou · district study","group":"district","caption":"Figure 18 · District-scale 3D remote-sensing map from the Nanjing series."},
      {"src":"assets/nanjing/jianye.jpg","title":"Jianye · district study","group":"district","caption":"Figure 19 · District-scale 3D remote-sensing map from the Nanjing series."},
      {"src":"assets/nanjing/jiangning.jpg","title":"Jiangning · district study","group":"district","caption":"Figure 20 · District-scale 3D remote-sensing map from the Nanjing series."},
      {"src":"assets/nanjing/lishui.jpg","title":"Lishui · district study","group":"district","caption":"Figure 21 · District-scale 3D remote-sensing map from the Nanjing series."},
      {"src":"assets/nanjing/liuhe.jpg","title":"Liuhe · district study","group":"district","caption":"Figure 22 · District-scale 3D remote-sensing map from the Nanjing series."},
      {"src":"assets/nanjing/qixia.jpg","title":"Qixia · district study","group":"district","caption":"Figure 23 · District-scale 3D remote-sensing map from the Nanjing series."},
      {"src":"assets/nanjing/qinhuai.jpg","title":"Qinhuai · district study","group":"district","caption":"Figure 24 · District-scale 3D remote-sensing map from the Nanjing series."},
      {"src":"assets/nanjing/xuanwu.jpg","title":"Xuanwu · district study","group":"district","caption":"Figure 25 · District-scale 3D remote-sensing map from the Nanjing series."},
      {"src":"assets/nanjing/printed-terrain.jpg","title":"Terrain you can touch","group":"print","caption":"Figure 31, left · Close-up of the physical 3D-printed terrain model."},
      {"src":"assets/nanjing/printed-buildings.jpg","title":"Built form, made physical","group":"print","caption":"Figure 31, right · Close-up of the printed building model."},
      {"src":"assets/nanjing/digital-and-physical.jpg","title":"From screen to physical model","group":"print","caption":"Figure 32 · The digital modelling environment alongside the printed terrain output."}
    ];
    const collections = all('[data-gallery]'), thumbs = byId('galleryThumbs'), dialog = byId('imageDialog');
    let group = 'city', index = 0, collection = [];
    const current = () => collection[index];
    function lightbox() {
      const image = current();
      byId('lightboxImage').src = image.src;
      byId('lightboxImage').alt = image.title + ' — Feng Qi';
      byId('lightboxTitle').textContent = image.title;
      byId('lightboxCaption').textContent = image.caption;
    }
    function choose(newIndex) {
      index = (newIndex + collection.length) % collection.length;
      const image = current();
      byId('galleryMain').src = image.src;
      byId('galleryMain').alt = image.title + ' — graduation project by Feng Qi';
      byId('galleryTitle').textContent = image.title;
      byId('galleryCaption').textContent = image.caption;
      byId('galleryCounter').textContent = String(index + 1).padStart(2, '0') + ' / ' + String(collection.length).padStart(2, '0');
      select([...thumbs.children], thumbs.children[index]);
      if (dialog.open) lightbox();
    }
    function loadGroup() {
      collection = items.filter(item => item.group === group);
      thumbs.replaceChildren(...collection.map((image, i) => {
        const button = document.createElement('button');
        button.setAttribute('aria-label', 'View ' + image.title);
        const thumb = document.createElement('img');
        thumb.src = image.src;
        thumb.alt = '';
        thumb.loading = 'lazy';
        button.append(thumb);
        button.onclick = () => choose(i);
        return button;
      }));
      choose(0);
    }
    for (const button of collections) {
      button.onclick = () => {
        group = button.dataset.gallery;
        select(collections, button);
        loadGroup();
      };
    }
    byId('galleryPrev').onclick = () => choose(index - 1);
    byId('galleryNext').onclick = () => choose(index + 1);
    byId('openGallery').onclick = () => { lightbox(); dialog.showModal(); };
    byId('closeImage').onclick = () => dialog.close();
    byId('lightboxPrev').onclick = () => choose(index - 1);
    byId('lightboxNext').onclick = () => choose(index + 1);
    dialog.addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      choose(index + (e.key === 'ArrowLeft' ? -1 : 1));
    });
    for (const surface of [byId('openGallery'), byId('lightboxImage')]) {
      let touch = null;
      let swiped = false;
      surface.addEventListener('touchstart', e => {
        const point = e.changedTouches[0];
        touch = [point.clientX, point.clientY];
        swiped = false;
      }, { passive: true });
      surface.addEventListener('touchend', e => {
        if (!touch) return;
        const point = e.changedTouches[0];
        const dx = point.clientX - touch[0], dy = point.clientY - touch[1];
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          choose(index + (dx < 0 ? 1 : -1));
          swiped = true;
        }
        touch = null;
      }, { passive: true });
      surface.addEventListener('click', e => {
        if (swiped) {
          e.stopImmediatePropagation();
          e.preventDefault();
          swiped = false;
        }
      }, true);
    }
    loadGroup();
  }

  for (const dialog of all('.folio-dialog')) {
    dialog.addEventListener('click', e => {
      if (e.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) dialog.close();
    });
  }
  setupProjects();
  setupGallery();
  setupSandbox();
})();
