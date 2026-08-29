// GLSL sources.
export const spriteVS = `#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aPosSize;
layout(location=2) in vec4 aUV;
layout(location=3) in vec4 aColor;
layout(location=4) in vec2 aRotMode;
uniform vec2 uRes, uCam;
out vec2 vUV; out vec4 vColor; flat out float vMode;
void main(){
  float c=cos(aRotMode.x), s=sin(aRotMode.x);
  vec2 p=aCorner*aPosSize.zw;
  p=vec2(p.x*c-p.y*s, p.x*s+p.y*c)+aPosSize.xy-uCam;
  vec2 ndc=(p/uRes)*2.0-1.0; ndc.y=-ndc.y;
  gl_Position=vec4(ndc,0.0,1.0);
  vUV=mix(aUV.xy,aUV.zw,aCorner+0.5);
  vColor=aColor; vMode=aRotMode.y;
}`;

export const spriteFS = `#version 300 es
precision mediump float;
in vec2 vUV; in vec4 vColor; flat in float vMode;
uniform sampler2D uTex; out vec4 o;
void main(){
  vec4 t=texture(uTex,vUV);
  if(vMode>0.5) o=vec4(vColor.rgb, t.a*vColor.a); else o=t*vColor;
  if(o.a<0.01) discard;
}`;

export const fsVS = `#version 300 es
layout(location=0) in vec2 aCorner;
out vec2 vUV;
void main(){ vUV=aCorner+0.5; gl_Position=vec4(aCorner*2.0,0.0,1.0); }`;

// Forest floor in world space: moss/grass, dirt roads, boulders, puddles.
export const groundFS = `#version 300 es
precision highp float;
in vec2 vUV; out vec4 o;
uniform float uTime; uniform vec2 uRes, uCam;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ return noise(p)*0.55+noise(p*2.1+5.3)*0.3+noise(p*4.3+9.1)*0.15; }
void main(){
  vec2 wp=vec2(vUV.x, 1.0-vUV.y)*uRes+uCam;
  vec2 q=floor(wp/2.0);
  float gr=hash(q)-0.5;
  float big=fbm(wp*0.012);
  float mid=fbm(wp*0.05+30.0);
  vec3 moss=vec3(0.24,0.40,0.17), grass=vec3(0.40,0.56,0.24), dark=vec3(0.15,0.27,0.12),
       dirt=vec3(0.42,0.33,0.22), rock=vec3(0.50,0.51,0.47), water=vec3(0.16,0.30,0.34);
  vec3 col=mix(dark,moss,smoothstep(0.35,0.6,big));
  col=mix(col,grass,smoothstep(0.55,0.75,mid));
  // dirt road: ridge of a low-frequency noise
  float r=abs(noise(wp*0.004+7.0)-0.5);
  float road=1.0-smoothstep(0.012,0.03,r);
  float ruts=0.85+0.15*sin(r*900.0);
  col=mix(col,dirt*ruts,road);
  // bogs
  float bog=smoothstep(0.72,0.8,fbm(wp*0.01+50.0));
  col=mix(col,water*(0.9+0.1*sin(uTime*1.5+wp.x*0.1+wp.y*0.07)),bog);
  // boulders
  float bl=step(0.93,noise(wp*0.09+20.0))*(1.0-road)*(1.0-bog);
  col=mix(col,rock*(0.8+0.4*noise(wp*0.5)),bl);
  col*=1.0+gr*0.12;
  col*=0.9+0.2*noise(wp*0.2+3.0);
  col=floor(col*28.0)/28.0;
  o=vec4(col,1.0);
}`;

export const brightFS = `#version 300 es
precision mediump float;
in vec2 vUV; out vec4 o; uniform sampler2D uTex;
void main(){ vec3 c=texture(uTex,vUV).rgb; float l=dot(c,vec3(0.3,0.59,0.11)); o=vec4(c*smoothstep(0.62,0.95,l),1.0); }`;

export const blurFS = `#version 300 es
precision mediump float;
in vec2 vUV; out vec4 o; uniform sampler2D uTex; uniform vec2 uDir;
void main(){
  float w[5]=float[](0.227,0.194,0.121,0.054,0.016);
  vec3 c=texture(uTex,vUV).rgb*w[0];
  for(int i=1;i<5;i++){ c+=texture(uTex,vUV+uDir*float(i)).rgb*w[i]; c+=texture(uTex,vUV-uDir*float(i)).rgb*w[i]; }
  o=vec4(c,1.0);
}`;

export const compFS = `#version 300 es
precision highp float;
in vec2 vUV; out vec4 o;
uniform sampler2D uScene, uBloom; uniform vec2 uShake, uSceneRes; uniform float uTime, uChroma, uFlash;
void main(){
  vec2 uv=vUV+uShake/uSceneRes;
  vec2 cc=uv-0.5; float d=dot(cc,cc); uv+=cc*d*0.05;
  if(uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0){ o=vec4(0.0,0.0,0.0,1.0); return; }
  float ca=(0.0012+uChroma*0.007)*(0.3+d*2.5);
  vec3 c;
  c.r=texture(uScene,uv+vec2(ca,0.0)).r; c.g=texture(uScene,uv).g; c.b=texture(uScene,uv-vec2(ca,0.0)).b;
  c+=texture(uBloom,uv).rgb*0.9;
  c*=0.84+0.16*(0.5+0.5*sin(uv.y*uSceneRes.y*6.2831853));
  c*=1.0-d*0.8;
  c=mix(c,vec3(1.0),uFlash);
  c+=(fract(sin(dot(uv+fract(uTime),vec2(12.9898,78.233)))*43758.5453)-0.5)*0.035;
  o=vec4(c,1.0);
}`;
