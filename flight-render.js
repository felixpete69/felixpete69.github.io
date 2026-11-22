/* Perspective flight over the same measured terrain used in the cover relief. */
(() => {
  'use strict';

  const scenes = new WeakMap();
  const exaggeration = 1.65;
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  const mix = (a, b, t) => a + (b - a) * t;

  function prepareTerrain(grid) {
    const { rows, columns, step, minX, minY } = grid;
    const heights = Uint8Array.from(atob(grid.heights), c => c.charCodeAt(0));
    if (heights.length !== rows * columns || heights.length > 65535) throw Error('Invalid terrain grid');

    function sample(x, z) {
      const col = clamp((x - minX) / step, 0, columns - 1.0001);
      const row = clamp((z - minY) / step, 0, rows - 1.0001);
      const i = Math.floor(row) * columns + Math.floor(col);
      return 2 * exaggeration * mix(
        mix(heights[i], heights[i + 1], col % 1),
        mix(heights[i + columns], heights[i + columns + 1], col % 1),
        row % 1
      );
    }

    const vertices = new Float32Array(rows * columns * 7);
    const indices = new Uint16Array((rows - 1) * (columns - 1) * 6);
    let index = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        const i = r * columns + c, x = minX + c * step, z = minY + r * step;
        const h = heights[i] * 2 * exaggeration;
        const nx = (sample(x - step, z) - sample(x + step, z)) / (2 * step);
        const nz = (sample(x, z - step) - sample(x, z + step)) / (2 * step);
        const length = Math.hypot(nx, 1, nz);
        // Bake a soft directional horizon shadow into the vertices. Valleys
        // stay in shade while exposed ridges catch the light on their crests.
        let horizon = 0;
        for (const radius of [65, 140, 280, 530, 960]) {
          horizon = Math.max(horizon, (sample(x - .94 * radius, z - .34 * radius) - h) / radius);
        }
        vertices.set([x, h, z, nx / length, 1 / length, nz / length, clamp(1.1 - horizon, .23, 1)], i * 7);
        if (c + 1 < columns && r + 1 < rows) {
          indices.set([i, i + columns, i + 1, i + 1, i + columns, i + columns + 1], index);
          index += 6;
        }
      }
    }
    return { vertices, indices, sample };
  }

  // A repeatable canopy pigment texture. Mipmaps keep the fine texture
  // quiet on distant slopes and narrow phone screens.
  function makeNoiseTexture(gl) {
    const size = 256, pixels = new Uint8Array(size * size * 4);
    let seed = 1971;
    for (let i = 0; i < pixels.length; i++) {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      pixels[i] = seed >>> 24;
    }
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return tex;
  }

  function makeCanopyTexture(gl) {
    const size = 256, mask = size - 1;
    const heights = new Float32Array(size*size);
    let seed = 47370;
    const rand = () => ((seed = (Math.imul(1664525,seed) + 1013904223) >>> 0) / 4294967296);
    const idx = (x,y) => ((y & mask) * size + (x & mask));
    for (let y = 0; y < size; y += 4) {
      for (let x = 0; x < size; x += 4) {
        const cx = x + rand()*4, cy = y + rand()*4, radius = 2.1 + 2.8*rand();
        const tilt = .8 + .4*rand(), tall = 2.4 + 2.3*rand();
        for (let iy = Math.floor(cy-radius); iy <= cy+radius; iy++) {
          for (let ix = Math.floor(cx-radius/tilt); ix <= cx+radius/tilt; ix++) {
            const q = 1 - (((ix-cx)*tilt)**2 + (iy-cy)**2)/(radius*radius);
            if (q <= 0) continue;
            const n = idx(ix,iy);
            heights[n] = Math.max(heights[n], tall*Math.sqrt(q)*(.90 + .17*rand()));
          }
        }
      }
    }
    const pixels = new Uint8Array(size*size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = idx(x,y), h = heights[i];
        const illuminate = .25*(h-heights[idx(x-1,y)]) + .12*(h-heights[idx(x,y-1)]);
        const shadow = Math.max(0,heights[idx(x-3,y-1)] - h - .8);
        pixels[i] = 255*clamp(.3+h*.075+illuminate-shadow*.14,.03,1);
      }
    }
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.LUMINANCE,size,size,0,gl.LUMINANCE,gl.UNSIGNED_BYTE,pixels);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  }

  const vertexSource = `
    precision highp float;
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute float aShade;
    uniform vec3 uCamera, uForward, uRight, uUp;
    uniform vec2 uLens;
    uniform float uSky;
    varying vec3 vWorld, vNormal;
    varying float vShade, vDepth;
    void main() {
      vNormal = aNormal; vShade = aShade;
      if (uSky > 0.5) {
        vWorld = uForward + uRight * aPosition.x / uLens.x + uUp * aPosition.y / uLens.y;
        vDepth = 0.0;
        gl_Position = vec4(aPosition.xy, 0.999, 1.0);
      } else {
        vWorld = aPosition;
        vec3 offset = aPosition - uCamera;
        vDepth = dot(offset, uForward);
        gl_Position = vec4(dot(offset, uRight) * uLens.x, dot(offset, uUp) * uLens.y,
          1.001 * vDepth - 6.003, vDepth);
      }
    }`;

  function fragmentSource(derivatives) {
    return (derivatives ? '#extension GL_OES_standard_derivatives : enable\n' : '') + `
      precision highp float;
      varying vec3 vWorld, vNormal;
      varying float vShade, vDepth;
      uniform sampler2D uNoise, uCanopy;
      uniform float uSky, uProgress, uTime, uStep;
      uniform vec2 uOrigin;
      const vec3 lightDir = vec3(-0.831, 0.47, -0.298);

      float wire(vec2 cell) {
        vec2 d = abs(fract(cell + 0.5) - 0.5);
        vec2 w = ` + (derivatives ? 'max(fwidth(cell), vec2(0.001))' : 'vec2(max(0.008, vDepth * 0.000045))') + `;
        vec2 lines = 1.0 - smoothstep(w * 0.22, w * 1.15, d);
        float diag = abs(fract(cell.x + cell.y + 0.5) - 0.5);
        float diagonal = 1.0 - smoothstep(0.12 * length(w), length(w), diag);
        float retain = 1.0 - smoothstep(0.25, 0.85, max(w.x,w.y));
        return max(max(lines.x, lines.y), 0.54 * diagonal) * retain;
      }

      void main() {
        float wirePhase = smoothstep(0.40, 0.92, uProgress);
        vec3 horizon = mix(vec3(0.53, 0.61, 0.55), vec3(0.155, 0.225, 0.192), wirePhase);
        if (uSky > 0.5) {
          vec3 ray = normalize(vWorld);
          float lift = smoothstep(-0.085, 0.47, ray.y);
          vec3 zenith = mix(vec3(0.28, 0.38, 0.335), vec3(0.038, 0.066, 0.056), wirePhase);
          vec3 sky = mix(horizon, zenith, lift);
          vec2 cloudUV = ray.xz / max(0.055, ray.y + 0.19);
          float cloud = texture2D(uNoise, cloudUV * 0.006 + uTime * 0.000009).g;
          cloud = cloud * 0.55 + texture2D(uNoise, cloudUV * 0.017).r * 0.29
                    + texture2D(uNoise, cloudUV * 0.045).b * 0.16;
          sky += (cloud - 0.5) * 0.073 * (1.0 - wirePhase) * smoothstep(-0.06, 0.19, ray.y);
          gl_FragColor = vec4(sky, 1.0);
          return;
        }

        vec2 pos = vWorld.xz;
        vec2 grainUV = pos + vWorld.y * vec2(0.16,-0.21);
        float grove = texture2D(uNoise, grainUV * 0.000057).r * 0.55
                    + texture2D(uNoise, grainUV * 0.00015).g * 0.30
                    + texture2D(uNoise, grainUV * 0.00034).b * 0.15;
        vec4 crowns = texture2D(uNoise, grainUV * 0.00091);
        vec2 micro = texture2D(uNoise, grainUV * 0.0026).rg;
        float canopy = texture2D(uCanopy, grainUV * 0.0031 + vec2(grove,1.0-grove)*0.026).r;
        vec3 normal = normalize(vNormal + vec3(crowns.g - 0.5,0.0,crowns.b - 0.5) * 0.33);
        float sun = max(0.0, dot(normal, lightDir)) * vShade;
        float shade = smoothstep(0.02, 0.90, sun);
        vec3 dark = vec3(0.031,0.073,0.058);
        vec3 leaf = mix(vec3(0.245,0.333,0.207),vec3(0.39,0.43,0.27),grove);
        vec3 land = mix(dark,leaf,shade * 0.87 + 0.06 * vShade);
        land *= (0.73 + grove * 0.38 + crowns.r * 0.30 + micro.r * 0.09) * (0.73 + canopy * 0.51);
        land += (crowns.r - crowns.g) * 0.020 + (micro.r - micro.g) * 0.011;

        vec2 cell = (pos - uOrigin) / uStep;
        float lines = wire(cell);
        float field = smoothstep(0.01, 0.95, wirePhase * 1.44 - min(vDepth/3500.0,1.0)*0.42);
        vec3 meshBase = mix(vec3(0.014,0.04,0.031),vec3(0.045,0.091,0.064),sun);
        vec3 meshInk = mix(vec3(0.38,0.61,0.375),vec3(0.66,0.85,0.52),sun);
        land = mix(land, mix(meshBase,meshInk,lines * 0.94),field);
        float distance = max(0.0, vDepth-80.0);
        float fog = 1.0 - exp(-distance * mix(0.00037,0.00047,wirePhase));
        // Fade the remote boundary of the DEM into sky, without inventing relief.
        vec2 edgeMetres = min(pos - uOrigin, -uOrigin - pos);
        float edgeFade = (1.0 - smoothstep(0.0, 490.0, min(edgeMetres.x, edgeMetres.y)))
                       * smoothstep(1400.0, 3300.0, distance);
        fog = mix(fog, 1.0, edgeFade);
        gl_FragColor = vec4(mix(land,horizon,fog),1.0);
      }`;
  }

  function makeScene(canvas, grid) {
    const gl = canvas.getContext('webgl', { alpha:false, antialias:true, depth:true, preserveDrawingBuffer:false });
    if (!gl) return null;
    const mesh = prepareTerrain(grid);
    function shader(type, source) {
      const s = gl.createShader(type);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s));
      return s;
    }
    const exec = gl.createProgram();
    const vert = shader(gl.VERTEX_SHADER, vertexSource);
    const frag = shader(gl.FRAGMENT_SHADER, fragmentSource(!!gl.getExtension('OES_standard_derivatives')));
    gl.attachShader(exec, vert);
    gl.attachShader(exec, frag);
    gl.linkProgram(exec);
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    if (!gl.getProgramParameter(exec, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(exec));
    gl.useProgram(exec);

    const u = {};
    for (const k of ['Camera','Forward','Right','Up','Lens','Sky','Progress','Time','Origin','Step','Noise','Canopy']) {
      u[k] = gl.getUniformLocation(exec, 'u' + k);
    }
    const attrs = ['aPosition','aNormal','aShade'].map(name => gl.getAttribLocation(exec, name));
    function buffer(type, data) {
      const b = gl.createBuffer();
      gl.bindBuffer(type, b);
      gl.bufferData(type, data, gl.STATIC_DRAW);
      return b;
    }
    const ground = buffer(gl.ARRAY_BUFFER, mesh.vertices);
    const faces = buffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indices);
    const sky = buffer(gl.ARRAY_BUFFER, new Float32Array([-1,-1,0, 3,-1,0, -1,3,0]));
    makeNoiseTexture(gl);
    gl.uniform1i(u.Noise,0);
    gl.activeTexture(gl.TEXTURE1);
    makeCanopyTexture(gl);
    gl.uniform1i(u.Canopy,1);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform2f(u.Origin,grid.minX,grid.minY);
    gl.uniform1f(u.Step,grid.step);
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); });
    canvas.addEventListener('webglcontextrestored', () => scenes.delete(canvas), {once:true});
    const {sample} = mesh;

    function flightPath(t) {
      return [2010 - 1530*t + 42*Math.sin(Math.PI*t), 2030 - 1700*t - 65*Math.sin(Math.PI*t)];
    }
    function eyeHeight(t) {
      // The flight follows a broad envelope and looks ahead at rising slopes.
      // The max keeps the camera clear of every measured ridge on the route.
      let envelope = -Infinity;
      for (const offset of [-.13,-.065,0,.065,.13]) {
        const [x,z] = flightPath(t + offset);
        envelope = Math.max(envelope,sample(x,z) - Math.abs(offset)*220);
      }
      return envelope + 133;
    }

    return function draw(progress,time) {
      if (gl.isContextLost()) return false;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return false;
      const quality = Math.min(window.devicePixelRatio || 1,1.35,Math.sqrt(1550000/(w*h)));
      const width = Math.max(1,Math.round(w*quality)), height = Math.max(1,Math.round(h*quality));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width; canvas.height = height;
      }
      gl.viewport(0,0,width,height);
      const [cx,cz] = flightPath(progress);
      const cy = eyeHeight(progress);
      const yaw = -.68 + .13*progress + Math.sin(time*.085)*.003;
      const pitch = -.122 - .045*progress + Math.sin(time*.09)*.0015;
      const sy = Math.sin(yaw), co = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
      const lens = 1 / Math.tan((w < h ? 62 : 53) * Math.PI/360);
      gl.uniform3f(u.Camera,cx,cy,cz);
      gl.uniform3f(u.Forward,sy*cp,sp,-co*cp);
      gl.uniform3f(u.Right,co,0,sy);
      gl.uniform3f(u.Up,-sy*sp,cp,co*sp);
      gl.uniform2f(u.Lens,lens*h/w,lens);
      gl.uniform1f(u.Progress,progress); gl.uniform1f(u.Time,time);
      gl.uniform1f(u.Sky,1);
      gl.disable(gl.DEPTH_TEST);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.bindBuffer(gl.ARRAY_BUFFER,sky);
      gl.enableVertexAttribArray(attrs[0]);
      gl.disableVertexAttribArray(attrs[1]); gl.disableVertexAttribArray(attrs[2]);
      gl.vertexAttribPointer(attrs[0],3,gl.FLOAT,false,0,0);
      gl.drawArrays(gl.TRIANGLES,0,3);

      gl.uniform1f(u.Sky,0);
      gl.enable(gl.DEPTH_TEST);
      gl.bindBuffer(gl.ARRAY_BUFFER,ground);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,faces);
      for (let a = 0; a < attrs.length; a++) {
        gl.enableVertexAttribArray(attrs[a]);
        gl.vertexAttribPointer(attrs[a],a === 2 ? 1 : 3,gl.FLOAT,false,28,a * 12);
      }
      gl.drawElements(gl.TRIANGLES,mesh.indices.length,gl.UNSIGNED_SHORT,0);
      return true;
    };
  }

  window.renderZijinFlight = (canvas, progress = 0, time = 0) => {
    if (!canvas || !window.zijinTerrainGrid) return false;
    if (!scenes.has(canvas)) {
      try { scenes.set(canvas,makeScene(canvas,window.zijinTerrainGrid)); }
      catch (e) { console.warn('Terrain flight unavailable:',e.message); scenes.set(canvas,null); }
    }
    const draw = scenes.get(canvas);
    return !!draw && draw(clamp(Number(progress) || 0,0,1),Number.isFinite(time) ? time : 0);
  };
})();
