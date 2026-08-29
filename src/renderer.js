import { makeProgram, makeTexture, makeFBO } from './gl.js';
import * as S from './shaders.js';
import { W, H } from './state.js';

const MAX = 8192, STRIDE = 14;

export class Renderer {
  constructor(gl, atlas) {
    this.gl = gl;
    this.f = atlas.frames;
    this.tex = makeTexture(gl, 0, 0, gl.NEAREST, atlas.canvas);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    this.pSprite = makeProgram(gl, S.spriteVS, S.spriteFS);
    this.pGround = makeProgram(gl, S.fsVS, S.groundFS);
    this.pBright = makeProgram(gl, S.fsVS, S.brightFS);
    this.pBlur = makeProgram(gl, S.fsVS, S.blurFS);
    this.pComp = makeProgram(gl, S.fsVS, S.compFS);

    this.quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), gl.STATIC_DRAW);

    this.data = new Float32Array(MAX * STRIDE);
    this.n = 0;
    this.inst = gl.createBuffer();
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    const B = STRIDE * 4;
    for (const [loc, size, off] of [[1, 4, 0], [2, 4, 16], [3, 4, 32], [4, 2, 48]]) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, B, off);
      gl.vertexAttribDivisor(loc, 1);
    }
    gl.bindVertexArray(null);

    this.fsvao = gl.createVertexArray();
    gl.bindVertexArray(this.fsvao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.scene = makeFBO(gl, W, H, gl.NEAREST);
    this.bloomA = makeFBO(gl, W / 2, H / 2, gl.LINEAR);
    this.bloomB = makeFBO(gl, W / 2, H / 2, gl.LINEAR);
    this.additive = false;
    this.camX = 0; this.camY = 0; // world-space camera (top-left of view)
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
  }

  // Camera: world coords of the view's top-left corner. Sprites are drawn in world space.
  setCamera(cx, cy) { this.flush(); this.camX = cx; this.camY = cy; }

  quad(f, x, y, w, h, rot, r, g, b, a, mode) {
    if (this.n >= MAX) this.flush();
    const d = this.data, i = this.n * STRIDE;
    d[i] = x; d[i + 1] = y; d[i + 2] = w; d[i + 3] = h;
    d[i + 4] = f.u0; d[i + 5] = f.v0; d[i + 6] = f.u1; d[i + 7] = f.v1;
    d[i + 8] = r; d[i + 9] = g; d[i + 10] = b; d[i + 11] = a;
    d[i + 12] = rot; d[i + 13] = mode;
    this.n++;
  }
  sprite(f, x, y, rot = 0, sx = 1, r = 1, g = 1, b = 1, a = 1, mode = 0, sy = sx) {
    this.quad(f, x, y, f.w * sx, f.h * sy, rot, r, g, b, a, mode);
  }
  rect(x, y, w, h, r, g, b, a) {
    this.quad(this.f.white, x + w / 2, y + h / 2, w, h, 0, r, g, b, a, 0);
  }
  setAdditive(v) {
    if (v !== this.additive) { this.flush(); this.additive = v; }
  }
  flush() {
    if (!this.n) return;
    const gl = this.gl, p = this.pSprite;
    gl.useProgram(p.prog);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data.subarray(0, this.n * STRIDE));
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(p.u.uTex, 0);
    gl.uniform2f(p.u.uRes, W, H);
    gl.uniform2f(p.u.uCam, this.camX, this.camY);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, this.additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.n);
    this.n = 0;
  }

  beginFrame() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene.fb);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0.1, 0.18, 0.08, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.additive = false;
  }
  drawGround(time) {
    const gl = this.gl, p = this.pGround;
    gl.disable(gl.BLEND);
    gl.useProgram(p.prog);
    gl.bindVertexArray(this.fsvao);
    gl.uniform1f(p.u.uTime, time);
    gl.uniform2f(p.u.uRes, W, H);
    gl.uniform2f(p.u.uCam, this.camX, this.camY);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  _pass(p, fbo, tex, setup) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo ? fbo.fb : null);
    gl.useProgram(p.prog);
    gl.bindVertexArray(this.fsvao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(p.u.uTex, 0);
    if (setup) setup(p.u);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  endFrame(fx, cw, ch) {
    this.flush();
    const gl = this.gl, bw = this.bloomA.w, bh = this.bloomA.h;
    gl.disable(gl.BLEND);
    gl.viewport(0, 0, bw, bh);
    this._pass(this.pBright, this.bloomA, this.scene.tex);
    this._pass(this.pBlur, this.bloomB, this.bloomA.tex, u => gl.uniform2f(u.uDir, 1 / bw, 0));
    this._pass(this.pBlur, this.bloomA, this.bloomB.tex, u => gl.uniform2f(u.uDir, 0, 1 / bh));
    this._pass(this.pBlur, this.bloomB, this.bloomA.tex, u => gl.uniform2f(u.uDir, 1.5 / bw, 0));
    this._pass(this.pBlur, this.bloomA, this.bloomB.tex, u => gl.uniform2f(u.uDir, 0, 1.5 / bh));

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, cw, ch);
    const p = this.pComp;
    gl.useProgram(p.prog);
    gl.bindVertexArray(this.fsvao);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.scene.tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.bloomA.tex);
    gl.uniform1i(p.u.uScene, 0);
    gl.uniform1i(p.u.uBloom, 1);
    gl.uniform2f(p.u.uShake, fx.shakeX, fx.shakeY);
    gl.uniform2f(p.u.uSceneRes, W, H);
    gl.uniform1f(p.u.uTime, fx.time);
    gl.uniform1f(p.u.uChroma, fx.chroma);
    gl.uniform1f(p.u.uFlash, fx.flash);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
