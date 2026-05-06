import React, { memo, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import * as THREE from 'three';

// 10 chars: ' .:-=+*#%@' — each is 8 rows of 8-bit bitmaps (MSB = left col)
const FONT: number[][] = [
  [0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00], // ' '
  [0x00,0x00,0x00,0x00,0x00,0x00,0x18,0x18], // '.'
  [0x00,0x18,0x18,0x00,0x00,0x18,0x18,0x00], // ':'
  [0x00,0x00,0x00,0x7E,0x7E,0x00,0x00,0x00], // '-'
  [0x00,0x00,0x7E,0x00,0x00,0x7E,0x00,0x00], // '='
  [0x00,0x18,0x18,0x7E,0x7E,0x18,0x18,0x00], // '+'
  [0x00,0x42,0x24,0x18,0x18,0x24,0x42,0x00], // '*'
  [0x24,0x24,0xFF,0x24,0x24,0xFF,0x24,0x00], // '#'
  [0x00,0x62,0x64,0x08,0x10,0x26,0x46,0x00], // '%'
  [0x3C,0x66,0x6E,0x6A,0x6C,0x60,0x3E,0x00], // '@'
];

function buildFontTexture(): THREE.DataTexture {
  const N = FONT.length, SZ = 8;
  const data = new Uint8Array(N * SZ * SZ * 4);
  for (let c = 0; c < N; c++) {
    for (let row = 0; row < SZ; row++) {
      const pattern = FONT[c][row];
      for (let col = 0; col < SZ; col++) {
        const bit = (pattern >> (7 - col)) & 1;
        const i   = (row * N * SZ + c * SZ + col) * 4;
        data[i] = data[i+1] = data[i+2] = bit * 255;
        data[i+3] = 255;
      }
    }
  }
  const t = new THREE.DataTexture(data, N * SZ, SZ, THREE.RGBAFormat);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

export const AsciiBackground = memo(function AsciiBackground() {
  const onContextCreate = useCallback((gl: ExpoWebGLRenderingContext) => {
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;

    const renderer = new THREE.WebGLRenderer({
      canvas: {
        width: W, height: H,
        style: {} as CSSStyleDeclaration,
        addEventListener:    (() => {}) as typeof HTMLCanvasElement.prototype.addEventListener,
        removeEventListener: (() => {}) as typeof HTMLCanvasElement.prototype.removeEventListener,
        clientHeight: H,
        getContext: () => gl as unknown as RenderingContext,
      } as unknown as HTMLCanvasElement,
      context: gl as unknown as WebGLRenderingContext,
      antialias: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(W, H);
    renderer.setClearColor(0x00080c, 1);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, W / H, 0.1, 1000);
    camera.position.set(0, 0, 18);
    camera.lookAt(0, 0, 0);

    const ribbonCount     = 4;
    const pointsPerRibbon = 2000;
    const count           = ribbonCount * pointsPerRibbon;
    const base            = new Float32Array(count * 3);
    const colors          = new Float32Array(count * 3);

    for (let r = 0; r < ribbonCount; r++) {
      const zOff = (r - (ribbonCount - 1) / 2) * 3.5;
      for (let i = 0; i < pointsPerRibbon; i++) {
        const idx = r * pointsPerRibbon + i;
        base[idx*3]   = (i / pointsPerRibbon) * 44 - 22;
        base[idx*3+1] = (Math.random() - 0.5) * 2;
        base[idx*3+2] = zOff + (Math.random() - 0.5) * 1.5;
        const b = 0.5 + 0.5 * (r / (ribbonCount - 1));
        const br = 0.75 + Math.random() * 0.25;
        colors[idx*3]   = 0;
        colors[idx*3+1] = b * br * 0.898; // #00e5ff G channel ratio
        colors[idx*3+2] = b * br;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(base.slice(), 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aBase',    new THREE.BufferAttribute(base, 3));

    const ribbonMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        uniform float uTime;
        attribute vec3 aBase;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec3 p = aBase;
          p.y += sin(p.x * 0.18 + uTime * 0.9) * 2.8
               + sin(p.x * 0.42 - uTime * 1.7) * 0.6;
          p.x += sin(uTime * 0.4 + p.z) * 0.6;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = 3.0 * (220.0 / -mv.z);
          gl_Position  = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          gl_FragColor = vec4(vColor, 0.9 * (1.0 - d * 1.4));
        }
      `,
      transparent: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    scene.add(new THREE.Points(geo, ribbonMat));

    const rt = new THREE.WebGLRenderTarget(W, H, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format:    THREE.RGBAFormat,
    });

    const fontTex    = buildFontTexture();
    const asciiScene  = new THREE.Scene();
    const asciiCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const asciiMat = new THREE.ShaderMaterial({
      uniforms: {
        tScene:      { value: rt.texture },
        tFont:       { value: fontTex },
        uResolution: { value: new THREE.Vector2(W, H) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      fragmentShader: `
        uniform sampler2D tScene;
        uniform sampler2D tFont;
        uniform vec2 uResolution;
        void main() {
          const float CELL = 8.0;
          const float CHARS = 10.0;
          vec2 fragCoord = gl_FragCoord.xy;
          vec2 cellIdx   = floor(fragCoord / CELL);
          vec2 pixInCell = mod(fragCoord, CELL);
          vec2 sUV = (cellIdx * CELL + CELL * 0.5) / uResolution;
          sUV.y = 1.0 - sUV.y;
          vec4 s = texture2D(tScene, sUV);
          float lum     = dot(s.rgb, vec3(0.299, 0.587, 0.114));
          float charIdx = floor(clamp(lum, 0.0, 0.9999) * CHARS);
          vec2 fUV = vec2(
            (charIdx * CELL + pixInCell.x + 0.5) / (CHARS * CELL),
            (pixInCell.y + 0.5) / CELL
          );
          float bit = texture2D(tFont, fUV).r;
          if (bit < 0.5) discard;
          vec3 col = mix(vec3(0.0, 0.898, 1.0), s.rgb * 1.4, 0.25);
          gl_FragColor = vec4(col, 0.60 * lum * 1.8);
        }
      `,
      transparent: true,
      depthWrite: false,
    });

    asciiScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), asciiMat));

    let time = 0;
    let raf: ReturnType<typeof requestAnimationFrame>;
    let last = performance.now();

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const now = performance.now();
      if (now - last < 1000 / 30) return;
      last = now;
      time += 0.016;
      ribbonMat.uniforms.uTime.value = time;
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.clear();
      renderer.render(asciiScene, asciiCamera);
      gl.endFrameEXP();
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      geo.dispose();
      ribbonMat.dispose();
      rt.dispose();
      fontTex.dispose();
      asciiMat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <GLView style={{ flex: 1 }} onContextCreate={onContextCreate} />
    </View>
  );
});
