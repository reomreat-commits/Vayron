/** Preserve the selected vayron.html visual effects without running its demo shop script. */
export function initVisualInteractions(): () => void {
  const cleanups: Array<() => void> = [];

  let revealObserver: IntersectionObserver | null = null;
  if ('IntersectionObserver' in window) {
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          revealObserver?.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
  }
  document.querySelectorAll('.rv:not(.in)').forEach(node => {
    if (revealObserver) revealObserver.observe(node);
    else node.classList.add('in');
  });
  cleanups.push(() => revealObserver?.disconnect());

  const marquee = document.getElementById('mq');
  if (marquee) {
    const words = ['BUILT FOR THE STREETS', 'STREETWEAR DIVISION', 'VAYRON', 'НОВАЯ КОЛЛЕКЦИЯ'];
    const sequence = words.map(word => word + '<span>✦</span>').join('');
    marquee.innerHTML = sequence.repeat(8);
  }

  const themeButton = document.getElementById('themeBtn');
  try {
    if (localStorage.getItem('vayron-theme') === 'dark') document.body.classList.add('dark');
  } catch { /* Storage may be disabled. */ }
  const onThemeClick = () => {
    if (!themeButton) return;
    themeButton.style.transform = 'scale(0.85) rotate(-20deg)';
    window.setTimeout(() => { themeButton.style.transform = ''; }, 280);
    document.body.classList.toggle('dark');
    try {
      localStorage.setItem('vayron-theme', document.body.classList.contains('dark') ? 'dark' : 'light');
    } catch { /* Theme remains active for this page view. */ }
  };
  themeButton?.addEventListener('click', onThemeClick);
  cleanups.push(() => themeButton?.removeEventListener('click', onThemeClick));

  // Original WebGL particle field from the selected vayron.html splash.
  const canvas = document.getElementById('gl') as HTMLCanvasElement | null;
  const gl = canvas?.getContext('webgl', { alpha: true, antialias: true }) ?? null;
  if (canvas && !gl) canvas.style.display = 'none';
  if (canvas && gl) {
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);
    cleanups.push(() => window.removeEventListener('resize', resize));

    const vertexSource = `
      attribute vec3 aPos;
      attribute float aSize;
      attribute float aAlpha;
      uniform float uTime;
      uniform vec2 uRes;
      varying float vAlpha;
      void main(){
        vec3 p = aPos;
        p.x += sin(uTime*0.15 + aPos.z*3.0)*0.04;
        p.y += cos(uTime*0.12 + aPos.x*2.5)*0.03;
        vec2 screen = p.xy;
        float z = 0.55 + p.z*0.45;
        screen /= z;
        vec2 clip = screen;
        clip.x *= uRes.y / uRes.x;
        gl_Position = vec4(clip, 0.0, 1.0);
        gl_PointSize = aSize * (1.2/z) * (uRes.y/600.0);
        vAlpha = aAlpha * (0.5 + 0.5*sin(uTime*0.4 + aPos.z*5.0));
      }
    `;
    const fragmentSource = `
      precision mediump float;
      varying float vAlpha;
      void main(){
        float d = length(gl_PointCoord - vec2(0.5));
        if(d > 0.5) discard;
        float soft = smoothstep(0.5, 0.1, d);
        vec3 col = mix(vec3(0.35,0.5,0.85), vec3(0.7,0.82,1.0), soft);
        gl_FragColor = vec4(col, soft * vAlpha * 0.7);
      }
    `;

    const compile = (type: number, source: string): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };
    const vertexShader = compile(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compile(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (!vertexShader || !fragmentShader || !program) {
      canvas.style.display = 'none';
    } else {
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        canvas.style.display = 'none';
      } else {
        gl.useProgram(program);
        const count = 180;
        const positions = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        const alphas = new Float32Array(count);
        for (let i = 0; i < count; i++) {
          positions[i * 3] = (Math.random() * 2 - 1) * 1.3;
          positions[i * 3 + 1] = (Math.random() * 2 - 1) * 1.3;
          positions[i * 3 + 2] = Math.random();
          sizes[i] = 2 + Math.random() * 5;
          alphas[i] = 0.25 + Math.random() * 0.75;
        }
        const bindBuffer = (data: Float32Array, name: string, width: number) => {
          const buffer = gl.createBuffer();
          if (!buffer) return;
          gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
          gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
          const location = gl.getAttribLocation(program, name);
          if (location >= 0) {
            gl.enableVertexAttribArray(location);
            gl.vertexAttribPointer(location, width, gl.FLOAT, false, 0, 0);
          }
        };
        bindBuffer(positions, 'aPos', 3);
        bindBuffer(sizes, 'aSize', 1);
        bindBuffer(alphas, 'aAlpha', 1);
        const timeLocation = gl.getUniformLocation(program, 'uTime');
        const resolutionLocation = gl.getUniformLocation(program, 'uRes');
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        const start = performance.now();
        let frameId = 0;
        const draw: FrameRequestCallback = now => {
          const time = (now - start) / 1000;
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.uniform1f(timeLocation, time);
          gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
          gl.drawArrays(gl.POINTS, 0, count);
          frameId = window.requestAnimationFrame(draw);
        };
        frameId = window.requestAnimationFrame(draw);
        cleanups.push(() => window.cancelAnimationFrame(frameId));
      }
    }
  }

  return () => cleanups.reverse().forEach(cleanup => cleanup());
}
