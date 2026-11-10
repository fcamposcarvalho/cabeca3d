// Modelo 3D da cabeça: pineal, hipófise e o circuito da melatonina (three.js 0.160)
// Coordenadas anatômicas (cm): x frente→trás (0 na raiz do nariz), y baixo→cima, z lateral (+ = esquerda da pessoa).
// Na cena: X = z, Y = y, Z = -(x - 9)  (o rosto olha para +Z).
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const $ = (id) => document.getElementById(id);
const stage = $("stage");
// idioma: "pt" (padrão) ou "en"; L(pt, en) escolhe o texto, NUM formata decimais (vírgula ou ponto)
let idioma = (() => { try { return localStorage.getItem("idioma") === "en" ? "en" : "pt"; } catch (e) { return "pt"; } })();
const L = (pt, en) => (idioma === "en" ? en : pt);
const NUM = (x, d = 1) => (idioma === "en" ? x.toFixed(d) : x.toFixed(d).replace(".", ","));
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
} catch (e) {
  if (idioma === "en") $("erro").innerHTML = "<div><p>Your browser could not open the 3D model (WebGL unavailable).</p><p>In Edge or Chrome: turn on “Use graphics acceleration when available” in the System settings, restart the browser and check at edge://gpu (or chrome://gpu) that WebGL shows as “Hardware accelerated”.</p></div>";
  $("erro").style.display = "flex";
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.localClippingEnabled = true;
stage.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 600);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 4;
controls.maxDistance = 160;
const ALVO_PADRAO = new THREE.Vector3(0, -1, 0);
controls.target.copy(ALVO_PADRAO);

scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x1a2030, 1.15));
const luz1 = new THREE.DirectionalLight(0xffffff, 1.5); luz1.position.set(30, 40, 50); scene.add(luz1);
const luz2 = new THREE.DirectionalLight(0x9fb4ff, 0.6); luz2.position.set(-30, 10, -40); scene.add(luz2);

const P = (x, y, z = 0) => new THREE.Vector3(z, y, -(x - 9));
const reduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const grupos = {};
for (const g of ["pele", "cerebro", "vent", "vasos", "planos", "circ", "liquor", "porta", "simbolo", "fixo", "embriao", "regua", "cortex", "visao", "limbico", "papez", "cranio"]) {
  grupos[g] = new THREE.Group(); scene.add(grupos[g]);
}
grupos.liquor.visible = false;
grupos.porta.visible = false;
grupos.embriao.visible = false;
for (const g of ["cortex", "visao", "limbico", "papez", "cranio"]) grupos[g].visible = false; // camadas opcionais, desligadas no início

const forma = { atual: "esq" }; // forma das estruturas: "esq" (sólidos geométricos) ou "anat" (malhas reais)
const pickables = [];
const clipaveis = [];
const porId = new Map();

function mat(color, o = {}) {
  const op = o.opacity ?? 1;
  return new THREE.MeshStandardMaterial({
    color, roughness: 0.55, metalness: 0.04, transparent: op < 1, opacity: op,
    depthWrite: op >= 0.6, side: o.side ?? THREE.FrontSide,
    emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 0,
  });
}
function registrar(mesh, id, grupo, opts = {}) {
  mesh.userData.id = id;
  grupos[grupo].add(mesh);
  if (id) {
    pickables.push(mesh);
    if (!porId.has(id)) porId.set(id, []);
    porId.get(id).push(mesh);
  }
  if (opts.clip) clipaveis.push(mesh);
  return mesh;
}
function elipsoide(c, r, color, o = {}) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), mat(color, o));
  m.position.copy(P(...c));
  m.scale.set(r[2], r[1], r[0]); // r = [frente-trás, altura, lateral]
  m.userData.centro = m.position.clone();
  return m;
}
function curva(pts) { return new THREE.CatmullRomCurve3(pts.map((p) => P(...p))); }
function tubo(pts, r, color, o = {}) {
  const c = curva(pts);
  const m = new THREE.Mesh(new THREE.TubeGeometry(c, 80, r, 12, false), mat(color, o));
  m.userData.curve = c;
  m.userData.raio = r;
  return m;
}
function extrudado(pts2d, prof, color, o = {}) {
  const s = new THREE.Shape(pts2d.map(([x, y]) => new THREE.Vector2(x - 9, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: prof, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2, curveSegments: 24 });
  g.translate(0, 0, -prof / 2);
  const m = new THREE.Mesh(g, mat(color, o));
  m.rotation.y = Math.PI / 2;
  return m;
}
function interp(tab, y) {
  if (y <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) {
    if (y <= tab[i][0]) {
      const [y0, v0] = tab[i - 1], [y1, v1] = tab[i];
      const t = (y - y0) / (y1 - y0);
      const s = t * t * (3 - 2 * t);
      return v0 + (v1 - v0) * (0.5 * t + 0.5 * s);
    }
  }
  return tab[tab.length - 1][1];
}

// =====================================================================  RÓTULOS (sem sobreposição)
const SVGNS = "http://www.w3.org/2000/svg";
const rotulosEl = $("rotulos");
const guiasEl = $("guias");
const ROT = [];
const ID_DO_ROTULO = { "Pineal": "pineal", "Hipófise": "adeno", "Hipotálamo": "hipotalamo", "3º ventrículo": "vent3", "Tálamo": "talamo",
  "Glabela": "glabela", "Raiz do nariz": "nasio", "Quiasma óptico": "quiasma", "Pirâmide nasal": "piramide", "Corpo caloso": "caloso",
  "Cerebelo": "cerebelo", "Tronco encefálico": "tronco", "Gânglio cervical superior": "gcs", "Seio cavernoso": "cavernoso",
  "Ventrículo lateral": "ventlat", "Olho": "olho", "Ajna (simbólico)": "ajna", "Coroa (simbólico)": "coroa", "Sistema porta": "porta",
  "Topo da cabeça": "vertice", "Parte de trás da cabeça": "occipital",
  "Lobo frontal": "lobo_frontal", "Lobo parietal": "lobo_parietal", "Lobo temporal": "lobo_temporal", "Lobo occipital": "lobo_occipital",
  "Sulco central": "sulco_central", "Fissura lateral": "fissura_lateral", "Corpo geniculado lateral": "cgl", "Radiação óptica": "radiacao",
  "Córtex visual (V1)": "v1", "Hipocampo": "hipocampo", "Amígdala": "amigdala", "Fórnix": "fornix", "Corpos mamilares": "mamilares",
  "Giro do cíngulo": "cingulo", "Habênula": "habenula", "Núcleo anterior do tálamo": "tal_anterior",
  "Ínsula": "insula", "Giro para-hipocampal": "parahipocampal", "Núcleos da base": "nucleos_base", "Osso frontal": "osso_frontal",
  "Ossos parietais": "osso_parietal", "Osso occipital": "osso_occipital", "Ossos temporais": "osso_temporal", "Osso esfenoide": "osso_esfenoide",
  "Osso etmoide": "osso_etmoide", "Ossos da face": "face_ossos", "Mandíbula": "mandibula" };
const ROT_EN = { "Pineal": "Pineal", "Hipófise": "Pituitary", "Hipotálamo": "Hypothalamus", "3º ventrículo": "3rd ventricle", "Tálamo": "Thalamus",
  "Glabela": "Glabella", "Raiz do nariz": "Root of the nose", "Topo da cabeça": "Top of the head", "Parte de trás da cabeça": "Back of the head",
  "Quiasma óptico": "Optic chiasm", "Pirâmide nasal": "Nasal pyramid", "Corpo caloso": "Corpus callosum", "Cerebelo": "Cerebellum",
  "Tronco encefálico": "Brainstem", "Gânglio cervical superior": "Superior cervical ganglion", "Seio cavernoso": "Cavernous sinus",
  "Ventrículo lateral": "Lateral ventricle", "Olho": "Eye", "Ajna (simbólico)": "Ajna (symbolic)", "Coroa (simbólico)": "Crown (symbolic)",
  "Sistema porta": "Portal system", "Vesícula do diencéfalo": "Diencephalic vesicle", "Vesícula óptica → retina": "Optic vesicle → retina",
  "Broto da pineal": "Pineal bud", "Infundíbulo → neuro-hipófise": "Infundibulum → posterior pituitary",
  "Bolsa de Rathke → adeno-hipófise": "Rathke's pouch → anterior pituitary", "Boca primitiva": "Primitive mouth",
  "Lobo frontal": "Frontal lobe", "Lobo parietal": "Parietal lobe", "Lobo temporal": "Temporal lobe", "Lobo occipital": "Occipital lobe",
  "Sulco central": "Central sulcus", "Fissura lateral": "Lateral fissure", "Corpo geniculado lateral": "Lateral geniculate nucleus",
  "Radiação óptica": "Optic radiation", "Córtex visual (V1)": "Visual cortex (V1)", "Hipocampo": "Hippocampus", "Amígdala": "Amygdala",
  "Fórnix": "Fornix", "Corpos mamilares": "Mammillary bodies", "Giro do cíngulo": "Cingulate gyrus", "Habênula": "Habenula",
  "Núcleo anterior do tálamo": "Anterior thalamic nucleus", "Ínsula": "Insula", "Giro para-hipocampal": "Parahippocampal gyrus",
  "Núcleos da base": "Basal ganglia", "Osso frontal": "Frontal bone", "Ossos parietais": "Parietal bones", "Osso occipital": "Occipital bone",
  "Ossos temporais": "Temporal bones", "Osso esfenoide": "Sphenoid bone", "Osso etmoide": "Ethmoid bone", "Ossos da face": "Facial bones", "Mandíbula": "Mandible" };
const rotTexto = (t) => (idioma === "en" && ROT_EN[t]) || t;
function textoRotulo(r) {
  r.el.innerHTML = `<i style="background:${r.cor}"></i>${rotTexto(r.texto)}`;
  if (r.id) r.el.title = L(`Selecionar ${r.texto}`, `Select ${rotTexto(r.texto)}`);
  r.w = 0;
}
function rotulo(texto, pos, cor, grupo = "fixo", prio = 5, extra = "") {
  const el = document.createElement("div");
  el.className = `lbl ${extra}`;
  el.innerHTML = `<i style="background:${cor}"></i>${rotTexto(texto)}`;
  rotulosEl.appendChild(el);
  const linha = document.createElementNS(SVGNS, "line");
  linha.setAttribute("stroke", cor); linha.setAttribute("stroke-width", "1"); linha.setAttribute("stroke-opacity", "0.75");
  const ponto = document.createElementNS(SVGNS, "circle");
  ponto.setAttribute("r", "2.6"); ponto.setAttribute("fill", cor);
  guiasEl.append(linha, ponto);
  const id = ID_DO_ROTULO[texto];
  if (id) {
    // o nome e a bolinha selecionam a estrutura (área de clique maior que a bolinha)
    el.classList.add("clicavel"); el.title = L(`Selecionar ${texto}`, `Select ${rotTexto(texto)}`);
    ponto.setAttribute("stroke", "transparent"); ponto.setAttribute("stroke-width", "14"); ponto.classList.add("clicavel");
    const aoClicar = (e) => { e.stopPropagation(); selecionarId(id); };
    el.addEventListener("click", aoClicar); ponto.addEventListener("click", aoClicar);
    const aoDuplo = (e) => { e.stopPropagation(); voarParaId(id); };
    el.addEventListener("dblclick", aoDuplo); ponto.addEventListener("dblclick", aoDuplo);
  }
  const r = { el, linha, ponto, pos: Array.isArray(pos) ? P(...pos) : pos, grupo, prio, w: 0, h: 0, ativo: true, id, cor, texto };
  ROT.push(r);
  return r;
}
function esconder(r) {
  r.el.style.display = "none"; r.linha.style.display = "none"; r.ponto.style.display = "none";
}
function grupoVisivel(g) { return grupos[g] ? grupos[g].visible : true; }
const sobrepoe = (a, b) => a.x < b.x + b.w + 3 && a.x + a.w + 3 > b.x && a.y < b.y + b.h + 2 && a.y + a.h + 2 > b.y;
const tmpV = new THREE.Vector3();
function layoutRotulos() {
  const W = stage.clientWidth, H = stage.clientHeight;
  const mostrar = $("c-rot").checked && !estado.quiz;
  const lista = [];
  for (const r of ROT) {
    let ok = r.ativo && grupoVisivel(r.grupo);
    if (estado.embriao) ok = ok && r.grupo === "embriao";
    else ok = ok && r.grupo !== "embriao";
    if (r.grupo !== "regua" && !mostrar) ok = false;
    if (estado.isolar && !mantidosNoIsolar(estado.isolar).has(r.grupo)) ok = false;
    if (r.soAnat && !(forma.atual === "anat" && r.posAnat)) ok = false;
    if (ok && forma.atual === "anat" && r.id && !(porId.get(r.id) || []).some((m) => m.visible)) ok = false;
    if (!ok) { esconder(r); continue; }
    if (r.posFn) r.posFn(r.pos);
    tmpV.copy(forma.atual === "anat" && r.posAnat ? r.posAnat : r.pos).project(camera);
    if (tmpV.z > 1 || Math.abs(tmpV.x) > 1.2 || Math.abs(tmpV.y) > 1.2) { esconder(r); continue; }
    r.ax = (tmpV.x * 0.5 + 0.5) * W;
    r.ay = (-tmpV.y * 0.5 + 0.5) * H;
    lista.push(r);
  }
  lista.sort((a, b) => a.prio - b.prio);
  const ocupados = [];
  for (const r of lista) {
    if (r.el.style.display !== "flex") r.el.style.display = "flex";
    if (!r.w) { r.w = r.el.offsetWidth; r.h = r.el.offsetHeight; }
    let escolhido = null;
    for (const lado of [1, -1]) {
      for (let k = 0; k < 11 && !escolhido; k++) {
        const passo = Math.ceil(k / 2) * (r.h + 3) * (k % 2 ? -1 : 1);
        const x = lado > 0 ? r.ax + 16 : r.ax - 16 - r.w;
        const rect = { x, y: r.ay - r.h / 2 + passo, w: r.w, h: r.h };
        if (rect.x < 4 || rect.y < 4 || rect.x + rect.w > W - 4 || rect.y + rect.h > H - 4) continue;
        if (!ocupados.some((o) => sobrepoe(o, rect))) escolhido = rect;
      }
      if (escolhido) break;
    }
    if (!escolhido) { esconder(r); continue; }
    ocupados.push(escolhido);
    r.el.style.transform = `translate(${escolhido.x.toFixed(1)}px, ${escolhido.y.toFixed(1)}px)`;
    const ex = escolhido.x > r.ax ? escolhido.x : escolhido.x + escolhido.w;
    const ey = escolhido.y + escolhido.h / 2;
    r.linha.setAttribute("x1", r.ax.toFixed(1)); r.linha.setAttribute("y1", r.ay.toFixed(1));
    r.linha.setAttribute("x2", ex.toFixed(1)); r.linha.setAttribute("y2", ey.toFixed(1));
    r.ponto.setAttribute("cx", r.ax.toFixed(1)); r.ponto.setAttribute("cy", r.ay.toFixed(1));
    r.linha.style.display = ""; r.ponto.style.display = "";
  }
}

// =====================================================================  ANATOMIA
const FRENTE = [[-18, 7.2], [-14.5, 6.8], [-12.8, 5.0], [-12.3, 2.0], [-11.9, 0.2], [-10.6, -1.0], [-9.4, -0.7],
  [-8.6, -1.1], [-7.9, -0.6], [-7.1, -1.2], [-5.8, -0.9], [-4.0, -0.5], [-1.4, -0.2], [0, 0], [1.3, -0.45],
  [3.5, -0.3], [6.5, 0.3], [9.3, 2.0], [11.3, 5.0], [12.05, 8.8]];
const TRAS = [[-18, 15.6], [-8.5, 15.8], [-5.5, 16.8], [-2.0, 18.6], [1.5, 19.5], [4.0, 19.3], [8.0, 17.5],
  [11.0, 14.0], [12.05, 10.2]];
const LARG = [[-18, 5.6], [-12, 5.5], [-9.6, 5.8], [-7, 6.1], [-4.5, 6.7], [-2, 7.2], [1, 7.7], [4.5, 7.8],
  [8.3, 7.0], [11.2, 4.4], [12.05, 1.2]];
(function pele() {
  const N = 110, M = 72, pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const y = -18 + (30.05 * i) / N;
    const xf = interp(FRENTE, y), xb = interp(TRAS, y), w = interp(LARG, y);
    const cx = (xf + xb) / 2, a = (xb - xf) / 2;
    for (let j = 0; j < M; j++) {
      const t = (2 * Math.PI * j) / M;
      const v = P(cx - a * Math.cos(t), y, w * Math.sin(t));
      pos.push(v.x, v.y, v.z);
    }
  }
  const topo = P(9.5, 12.15, 0);
  pos.push(topo.x, topo.y, topo.z);
  const it = (N + 1) * M;
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
    const a = i * M + j, b = i * M + ((j + 1) % M), c = a + M, d = b + M;
    idx.push(a, c, b, b, c, d);
  }
  for (let j = 0; j < M; j++) idx.push(N * M + j, it, N * M + ((j + 1) % M));
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xc9d5ea, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide, roughness: 0.4 }));
  m.renderOrder = 10; m.userData.esq = "cabeca";
  registrar(m, null, "pele", { clip: true });
  const lm = new THREE.LineBasicMaterial({ color: 0x9fb2d6, transparent: true, opacity: 0.22 });
  for (let y = -16.5; y < 12; y += 1.5) {
    const xf = interp(FRENTE, y), xb = interp(TRAS, y), w = interp(LARG, y);
    const cx = (xf + xb) / 2, a = (xb - xf) / 2, pts = [];
    for (let j = 0; j <= 96; j++) { const t = (2 * Math.PI * j) / 96; pts.push(P(cx - a * Math.cos(t), y, w * Math.sin(t))); }
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lm); l.userData.esq = "cabeca";
    grupos.pele.add(l); clipaveis.push(l);
  }
  for (const s of [1, -1]) registrar(elipsoide([10.6, -1.4, s * 7.9], [0.9, 2.7, 0.45], 0xc9d5ea, { opacity: 0.18 }), null, "pele", { clip: true }).userData.esq = "cabeca";
})();

// rosto
for (const s of [1, -1]) {
  registrar(elipsoide([1.9, -0.7, s * 3.2], [1.2, 1.2, 1.2], 0xe8edf4), "olho", "fixo", { clip: true });
  const iris = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), new THREE.MeshStandardMaterial({ color: 0x6b7f99 }));
  iris.position.copy(P(0.69, -0.7, s * 3.2)); grupos.fixo.add(iris);
  const pup = new THREE.Mesh(new THREE.CircleGeometry(0.22, 24), new THREE.MeshBasicMaterial({ color: 0x0c121d }));
  pup.position.copy(P(0.67, -0.7, s * 3.2)); grupos.fixo.add(pup);
}
{
  const N = P(0, 0), T = P(-3.05, -4.6), AR = P(-0.6, -5.4, -1.7), AL = P(-0.6, -5.4, 1.7);
  const g = new THREE.BufferGeometry().setFromPoints([N, T, AL, N, AR, T, N, AL, AR, T, AR, AL]);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat(0xf0997b, { opacity: 0.55, side: THREE.DoubleSide }));
  m.renderOrder = 5;
  m.userData.centro = P(-1.2, -3.3, 0);
  registrar(m, "piramide", "fixo");
  const arestas = new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: 0xf07f5a, transparent: true, opacity: 0.8 }));
  arestas.userData.esq = "cabeca"; grupos.fixo.add(arestas);
}
registrar(elipsoide([-0.45, 1.3, 0], [0.22, 0.22, 0.22], 0xffffff, { emissive: 0xffffff, ei: 0.4 }), "glabela", "fixo");
registrar(elipsoide([0, 0, 0], [0.2, 0.2, 0.2], 0xffffff, { emissive: 0xffffff, ei: 0.4 }), "nasio", "fixo");
// pontos de referência na superfície para medir: topo da cabeça (vértice) e ponto mais posterior (opistocrânio)
for (const [id, pos] of [["vertice", [9.5, 12.15, 0]], ["occipital", [19.5, 1.5, 0]]]) {
  registrar(elipsoide(pos, [0.32, 0.32, 0.32], 0xffffff, { emissive: 0xffffff, ei: 0.6 }), id, "fixo");
  const anel = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
  anel.position.copy(P(...pos)); anel.userData.marca = id; grupos.fixo.add(anel);
}
for (const s of [1, -1]) registrar(elipsoide([0.85, 2.3, s * 0.75], [0.45, 0.85, 0.6], 0x85b7eb, { opacity: 0.28 }), "seiofrontal", "fixo", { clip: true });
registrar(elipsoide([6.5, -2.85, 0], [1.5, 0.9, 1.6], 0x85b7eb, { opacity: 0.22 }), "esfenoidal", "fixo", { clip: true });

// cérebro e tronco
{
  const env = elipsoide([9.6, 4.4, 0], [8.3, 6.0, 6.7], 0xf0c6bd, { opacity: 0.08, side: THREE.DoubleSide });
  env.renderOrder = 9; env.userData.encefalo = true; env.userData.esq = "cortex";
  registrar(env, null, "cerebro", { clip: true });
}
registrar(elipsoide([14.3, -2.4, 0], [2.8, 2.0, 4.8], 0xd9b8a8, { opacity: 0.38 }), "cerebelo", "cerebro", { clip: true });
registrar(tubo([[9.4, 0.5], [9.7, -1.5], [10.3, -3.5], [11.4, -5.6], [11.9, -6.6]], 0.95, 0xe2c9bb, { opacity: 0.5 }), "tronco", "cerebro", { clip: true });
registrar(tubo([[11.9, -6.4], [12.3, -10], [12.55, -14], [12.6, -18]], 0.5, 0xe2c9bb, { opacity: 0.45 }), "medula", "cerebro", { clip: true });
const CALOSO = [[5.8, 2.6], [4.5, 3.2], [4.6, 4.5], [6.0, 5.5], [8.5, 5.9], [10.9, 5.4], [12.1, 4.1], [11.9, 3.0],
  [11.1, 3.15], [10.6, 4.3], [8.5, 4.95], [6.3, 4.6], [5.35, 3.9], [5.4, 3.2]];
registrar(extrudado(CALOSO, 7, 0xf3ead8, { opacity: 0.32 }), "caloso", "cerebro", { clip: true });
// o fórnix agora faz parte da camada "Sistema límbico"

// diencéfalo
for (const s of [1, -1]) {
  registrar(elipsoide([8.7, 2.05, s * 1.3], [1.6, 1.05, 1.0], 0xb3adf2, { opacity: 0.88 }), "talamo", "fixo");
  registrar(elipsoide([7.7, 0.5, s * 0.55], [0.85, 0.48, 0.42], 0x5fd3b0, { opacity: 0.9 }), "hipotalamo", "fixo");
  registrar(elipsoide([6.98, 0.33, s * 0.16], [0.13, 0.13, 0.13], 0x0f6e56, { emissive: 0x3cc4a2, ei: 0.6 }), "nsq", "fixo");
  registrar(elipsoide([7.55, 0.95, s * 0.28], [0.13, 0.13, 0.13], 0x0f6e56, { emissive: 0x3cc4a2, ei: 0.4 }), "npv", "fixo");
}
registrar(elipsoide([8.45, 1.7, 0], [0.35, 0.2, 0.4], 0xb3adf2), "talamo", "fixo");
const VENT3 = [[7.45, 2.45], [8.6, 2.55], [9.45, 2.25], [9.75, 1.75], [9.72, 1.45], [9.5, 1.05], [9.35, 0.7], [8.8, 0.35],
  [8.1, 0.15], [7.6, 0.05], [7.4, -0.45], [7.15, 0.02], [6.97, -0.12], [6.85, 0.2], [6.85, 1.1], [7.05, 1.85]];
{
  const v3 = extrudado(VENT3, 0.38, 0x5ea6f2, { opacity: 0.55 });
  v3.userData.centro = P(8.3, 1.2, 0);
  registrar(v3, "vent3", "vent");
}
for (const s of [1, -1]) {
  registrar(tubo([[3.4, 3.6, s * 1.0], [5.5, 4.05, s * 1.35], [8.5, 4.25, s * 1.6], [11.5, 3.8, s * 2.2], [12.8, 2.6, s * 3.1], [15.6, 2.4, s * 2.4]], 0.4, 0x5ea6f2, { opacity: 0.42 }), "ventlat", "vent", { clip: true });
  registrar(tubo([[12.8, 2.6, s * 3.1], [12.3, 0.4, s * 3.6], [10.6, -1.0, s * 3.8], [8.9, -1.5, s * 3.6]], 0.32, 0x5ea6f2, { opacity: 0.42 }), "ventlat", "vent", { clip: true });
  grupos.vent.add(tubo([[7.3, 3.3, s * 1.2], [7.4, 2.8, s * 0.6], [7.45, 2.45, 0]], 0.12, 0x5ea6f2, { opacity: 0.6 })).userData.esq = "profundo";
}
registrar(tubo([[9.38, 0.72], [10.1, -0.2], [10.55, -1.15], [11.1, -2.1]], 0.11, 0x5ea6f2, { opacity: 0.85 }), "aqueduto", "vent");
registrar(elipsoide([11.3, -2.6, 0], [0.5, 0.65, 0.7], 0x5ea6f2, { opacity: 0.5 }), "aqueduto", "vent");

// pineal
const pinealMat = mat(0xf6c164, { emissive: 0xf2b24a, ei: 0.2 });
const pineal = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.02, 40), pinealMat);
pineal.rotation.x = -Math.PI / 2 - 0.12;
pineal.position.copy(P(10.24, 1.42, 0));
pineal.userData.centro = P(10.1, 1.42, 0);
registrar(pineal, "pineal", "fixo");
const halo = new THREE.Mesh(new THREE.SphereGeometry(0.9, 32, 20), new THREE.MeshBasicMaterial({ color: 0xf2b24a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
halo.position.copy(P(10.2, 1.42, 0)); grupos.fixo.add(halo);

// hipófise, quiasma, nervos e tratos ópticos
registrar(elipsoide([6.95, -1.47, 0], [0.52, 0.36, 0.6], 0x3cc4a2), "adeno", "fixo");
registrar(elipsoide([7.52, -1.42, 0], [0.29, 0.3, 0.35], 0xd6f3ea), "neuro", "fixo");
registrar(tubo([[7.4, -0.35], [7.36, -0.7], [7.33, -1.05]], 0.12, 0xd6f3ea), "neuro", "fixo");
registrar(elipsoide([6.7, 0.02, 0], [0.3, 0.13, 0.62], 0xc8cbd2), "quiasma", "fixo");
for (const s of [1, -1]) {
  registrar(tubo([[6.6, 0, s * 0.45], [4.8, -0.4, s * 1.7], [3.1, -0.68, s * 2.85]], 0.16, 0xb9bec8), "quiasma", "fixo");
  registrar(tubo([[6.85, 0.05, s * 0.45], [8.0, 0.6, s * 1.6], [9.5, 1.2, s * 2.3]], 0.14, 0xb9bec8, { opacity: 0.8 }), "quiasma", "fixo");
}

// vasos
for (const s of [1, -1]) {
  registrar(elipsoide([7.1, -1.45, s * 1.5], [0.9, 0.62, 0.48], 0xa39bf2, { opacity: 0.45 }), "cavernoso", "vasos", { clip: true });
  registrar(tubo([[9.5, -10, s * 2.2], [8.4, -4.5, s * 1.9], [7.6, -2.4, s * 1.6], [6.6, -1.6, s * 1.5], [6.9, -0.6, s * 1.45], [6.5, 0.0, s * 1.8]], 0.2, 0xe24b4a), "carotida", "vasos", { clip: true });
  registrar(tubo([[0.7, -0.3, s * 1.95], [-0.2, -2.5, s * 2.25], [-0.3, -4.8, s * 2.7], [0.8, -7.3, s * 3.6], [2.5, -9.6, s * 4.4]], 0.11, 0x378add), "veia", "vasos", { clip: true });
  registrar(tubo([[0.7, -0.3, s * 1.95], [2.5, 0.2, s * 2.3], [4.6, -0.3, s * 2.0], [6.3, -1.2, s * 1.6]], 0.11, 0x378add), "veia", "vasos", { clip: true });
  registrar(elipsoide([10.3, -9.0, s * 2.4], [0.25, 0.55, 0.25], 0xf0997b), "gcs", "circ");
}

// planos horizontais
function plano(x0, x1, y, cor) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(5, x1 - x0), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.copy(P((x0 + x1) / 2, y, 0));
  m.renderOrder = 8;
  grupos.planos.add(m);
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([P(x1, y), P(x0, y)]), new THREE.LineDashedMaterial({ color: cor, dashSize: 0.5, gapSize: 0.3 }));
  l.computeLineDistances();
  grupos.planos.add(l);
}
plano(-0.5, 10.1, 1.42, 0xf2b24a);
plano(-1.15, 7.0, -1.45, 0x3cc4a2);

// camada simbólica: eixo vertical, ajna, coroa e o eixo pineal → glabela
{
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([P(10.15, 13.0), P(10.15, 1.95)]), new THREE.LineDashedMaterial({ color: 0xa39bf2, dashSize: 0.35, gapSize: 0.35 }));
  l.computeLineDistances(); grupos.simbolo.add(l);
  const seta = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 20), new THREE.MeshBasicMaterial({ color: 0xa39bf2 }));
  seta.rotation.x = Math.PI; seta.position.copy(P(10.15, 2.2)); grupos.simbolo.add(seta);
  const ajna = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 12, 48), new THREE.MeshBasicMaterial({ color: 0x8f86ff }));
  ajna.position.copy(P(-1.0, 1.3)); ajna.userData.centro = ajna.position.clone();
  registrar(ajna, "ajna", "simbolo");
  const ajnaG = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), new THREE.MeshBasicMaterial({ color: 0x8f86ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
  ajnaG.position.copy(ajna.position); grupos.simbolo.add(ajnaG);
  const coroa = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.07, 12, 64), new THREE.MeshBasicMaterial({ color: 0xc7a6ff }));
  coroa.rotation.x = Math.PI / 2; coroa.position.copy(P(9.7, 13.1)); coroa.userData.centro = coroa.position.clone();
  registrar(coroa, "coroa", "simbolo");
  const feixe = new THREE.Line(new THREE.BufferGeometry().setFromPoints([P(9.72, 1.45), P(-0.9, 1.3)]), new THREE.LineDashedMaterial({ color: 0x8f86ff, dashSize: 0.2, gapSize: 0.25 }));
  feixe.computeLineDistances(); grupos.simbolo.add(feixe);
}

// =====================================================================  PARTÍCULAS (pulsos, melatonina, líquor, sistema porta)
const CURVA_LUZ = [1, -1].map((s) => curva([[3.1, -0.68, s * 2.85], [4.8, -0.4, s * 1.7], [6.5, 0.0, s * 0.5], [6.98, 0.33, s * 0.16]]));
const CURVA_NERVO = curva([[7.55, 0.95, 0.3], [8.55, -0.4, 0.4], [9.55, -2.6, 0.5], [10.9, -5.2, 0.5], [12.0, -8.5, 0.5],
  [12.5, -12.5, 0.5], [12.6, -16.6, 0.5], [12.2, -17.2, 1.5], [11.0, -13.0, 2.4], [10.3, -9.6, 2.4], [10.45, -8.3, 2.3],
  [12.6, -6.4, 1.6], [13.8, -4.0, 1.0], [13.4, -0.6, 0.5], [11.9, 0.75, 0.2], [10.85, 1.2, 0]]);
grupos.circ.add(new THREE.Mesh(new THREE.TubeGeometry(CURVA_NERVO, 300, 0.06, 8, false), new THREE.MeshBasicMaterial({ color: 0xf07f5a, transparent: true, opacity: 0.45 })));
const CURVAS_MEL = [
  curva([[9.7, 1.45], [8.8, 1.0], [7.8, 0.5], [7.0, 0.35]]),
  curva([[9.7, 1.4], [8.6, 0.7], [7.6, 0.1], [7.38, -0.3], [7.2, -0.95]]),
  curva([[10.3, 1.6, 0], [10.9, 2.7, 1.3], [11.6, 3.9, 2.6]]),
  curva([[10.3, 1.6, 0], [10.9, 2.7, -1.3], [11.6, 3.9, -2.6]]),
];
const CURVAS_LIQUOR = [1, -1].map((s) => curva([[15.4, 2.4, s * 2.4], [12.8, 2.6, s * 3.1], [11.5, 3.8, s * 2.2], [8.5, 4.25, s * 1.6],
  [7.4, 3.1, s * 0.8], [7.45, 2.4, 0], [8.2, 1.6, 0], [9.1, 1.0, 0], [9.38, 0.72, 0], [10.1, -0.2, 0], [10.55, -1.15, 0],
  [11.1, -2.1, 0], [11.3, -2.8, 0], [11.7, -3.7, 0], [12.4, -4.6, 0]]));

// sistema porta: estruturas
{
  const vermelho = 0xe24b4a;
  for (const s of [1, -1]) {
    registrar(tubo([[6.85, -0.5, s * 1.4], [7.1, -0.3, s * 0.8], [7.38, -0.32, s * 0.15]], 0.05, vermelho), "porta", "porta");
    registrar(tubo([[6.9, -1.5, s * 0.45], [7.0, -1.5, s * 0.8], [7.05, -1.45, s * 1.15]], 0.06, 0x8f86ff), "porta", "porta");
    registrar(tubo([[7.33, -0.42, s * 0.08], [7.26, -0.8, s * 0.1], [7.06, -1.22, s * 0.12]], 0.035, 0xc04a8a), "porta", "porta");
    registrar(tubo([[7.55, 0.95, s * 0.28], [7.5, 0.2, s * 0.1], [7.45, -0.35, s * 0.04], [7.4, -0.9, s * 0.03], [7.5, -1.3, 0]], 0.025, 0x9fe1cb), "porta", "porta");
  }
  const t1 = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 8, 32), mat(vermelho));
  t1.rotation.x = Math.PI / 2; t1.position.copy(P(7.38, -0.38)); registrar(t1, "porta", "porta");
  const t2 = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 8, 40), mat(0xc04a8a));
  t2.rotation.x = Math.PI / 2; t2.position.copy(P(6.95, -1.45)); registrar(t2, "porta", "porta");
}
const CURVA_LIBERACAO = curva([[7.6, 0.25], [7.45, -0.1], [7.38, -0.38], [7.26, -0.8], [7.06, -1.22], [6.95, -1.42]]);
const CURVAS_HIPOFISE = [1, -1].map((s) => curva([[6.95, -1.47, 0], [6.95, -1.5, s * 0.6], [7.05, -1.45, s * 1.25], [7.0, -2.3, s * 1.7], [7.4, -3.6, s * 2.0]]));
const CURVAS_AXONIO = [1, -1].map((s) => curva([[7.55, 0.95, s * 0.28], [7.5, 0.2, s * 0.1], [7.45, -0.35, s * 0.04], [7.4, -0.9, s * 0.03], [7.5, -1.3, 0]]));

const particulas = [];
const geoP = new THREE.SphereGeometry(1, 12, 10);
const matsP = {};
function matsDe(cor) {
  if (!matsP[cor]) matsP[cor] = [new THREE.MeshBasicMaterial({ color: cor }),
    new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false })];
  return matsP[cor];
}
function particula(curve, cor, vel, grupo = "circ", tam = 0.14) {
  const g = new THREE.Group();
  const [m1, m2] = matsDe(cor);
  const a = new THREE.Mesh(geoP, m1); a.scale.setScalar(tam);
  const b = new THREE.Mesh(geoP, m2); b.scale.setScalar(tam * 2.4);
  g.add(a, b);
  grupos[grupo].add(g);
  if (estado.isolar && !mantidosNoIsolar(estado.isolar).has(grupo)) { esmaecerMat(m1, true); esmaecerMat(m2, true); }
  particulas.push({ g, curve, t: 0, vel, grupo });
}

// =====================================================================  EMBRIÃO
const emb = {};
{
  const G = grupos.embriao;
  emb.vesicula = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), mat(0xf0c6bd, { opacity: 0.55 }));
  emb.vesicula.position.copy(P(8.6, 1.6)); emb.vesicula.scale.set(1.5, 1.6, 2.0); G.add(emb.vesicula);
  emb.opticas = [1, -1].map((s) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), mat(0xe8edf4, { opacity: 0.95 }));
    m.userData.s = s; G.add(m); return m;
  });
  const cil = () => new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 16), mat(0xf0c6bd, { opacity: 0.75 }));
  emb.hastes = [cil(), cil()]; emb.hastes.forEach((h) => G.add(h));
  emb.pineal = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.02, 32), mat(0xf6c164, { emissive: 0xf2b24a, ei: 0.4 }));
  emb.pineal.rotation.x = -Math.PI / 2 + 0.6; G.add(emb.pineal);
  emb.infund = cil(); G.add(emb.infund);
  emb.neuro = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), mat(0xd6f3ea)); G.add(emb.neuro);
  emb.rathke = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), mat(0x3cc4a2)); G.add(emb.rathke);
  emb.rathkeHaste = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 12), mat(0x3cc4a2, { opacity: 0.6 })); G.add(emb.rathkeHaste);
  emb.boca = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.12, 10, 40), mat(0xf07f5a));
  emb.boca.rotation.x = Math.PI / 2; emb.boca.position.copy(P(5.6, -6.4)); G.add(emb.boca);
  emb.u = 0;
}
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), eixoY = new THREE.Vector3(0, 1, 0);
function cilindroEntre(m, a, b, raio) {
  const d = tmpB.copy(b).sub(a);
  const len = Math.max(d.length(), 0.001);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(eixoY, d.normalize());
  m.scale.set(raio, len, raio);
}
const lerpV = (a, b, t) => a.clone().lerp(b, t);
const faixa = (u, a, b) => THREE.MathUtils.clamp((u - a) / (b - a), 0, 1);
const suave = (t) => t * t * (3 - 2 * t);
function atualizarEmbriao(u) {
  emb.u = u;
  const centro = emb.vesicula.position;
  const go = suave(faixa(u, 0.05, 0.9));
  for (const m of emb.opticas) {
    const s = m.userData.s;
    const ini = P(8.2, 1.1, s * 1.9), fim = P(2.4, -0.6, s * 3.2);
    m.position.copy(lerpV(ini, fim, go));
    m.scale.setScalar(0.35 + 0.85 * suave(faixa(u, 0.02, 0.7)));
  }
  emb.hastes.forEach((h, i) => cilindroEntre(h, tmpA.copy(centro).add(new THREE.Vector3(emb.opticas[i].userData.s * 1.2, -0.4, 0.3)), emb.opticas[i].position, 0.2));
  const gp = suave(faixa(u, 0.1, 0.6));
  emb.pineal.position.copy(P(9.9 + 0.3 * gp, 2.9 - 0.2 * gp));
  emb.pineal.scale.setScalar(0.15 + 0.85 * gp);
  const gi = suave(faixa(u, 0.1, 0.6));
  const topoI = P(7.7, 0.15), fundoI = P(7.55, 0.05 - 1.5 * gi);
  cilindroEntre(emb.infund, topoI, fundoI, 0.22);
  emb.neuro.position.copy(fundoI); emb.neuro.scale.setScalar(0.12 + 0.2 * gi);
  const gr = suave(faixa(u, 0.12, 0.62));
  const posR = lerpV(P(5.7, -5.9), P(7.05, -1.7), gr);
  emb.rathke.position.copy(posR);
  emb.rathke.scale.set(0.35 + 0.2 * gr, 0.3 + 0.12 * gr, 0.4 + 0.25 * gr);
  const corte = faixa(u, 0.7, 0.85);
  emb.rathkeHaste.visible = corte < 1;
  cilindroEntre(emb.rathkeHaste, P(5.6, -6.3), posR, 0.14 * (1 - corte) + 0.001);
  emb.boca.material.opacity = 1;
}
atualizarEmbriao(0);
const ETAPAS_EMB = [
  [0.0, "3ª–4ª semana", "O diencéfalo é uma vesícula do tubo neural. Surgem quatro brotos: dois para os lados (vesículas ópticas), um para cima e para trás (pineal) e um para baixo (infundíbulo)."],
  [0.25, "4ª–5ª semana", "As vesículas ópticas crescem para os lados presas por hastes; do teto da boca primitiva sobe a bolsa de Rathke."],
  [0.55, "6ª semana", "A bolsa de Rathke encosta no infundíbulo: a parte da boca vira a adeno-hipófise, a parte do cérebro vira a neuro-hipófise."],
  [0.75, "7ª–8ª semana", "A bolsa perde a ligação com a boca (o osso esfenoide se forma no meio). Os olhos avançam para a face."],
  [0.92, "Depois", "Resultado: retinas, pineal e neuro-hipófise são irmãs, todas brotos do diencéfalo; a adeno-hipófise veio da boca."],
];
rotulo("Vesícula do diencéfalo", P(8.6, 3.3), "#F0C6BD", "embriao", 1);
for (const m of emb.opticas) { const r = rotulo("Vesícula óptica → retina", new THREE.Vector3(), "#E8EDF4", "embriao", 2); r.posFn = (v) => v.copy(m.position); if (m.userData.s < 0) r.ativo = false; }
{ const r = rotulo("Broto da pineal", new THREE.Vector3(), "#F2B24A", "embriao", 1); r.posFn = (v) => v.copy(emb.pineal.position); }
{ const r = rotulo("Infundíbulo → neuro-hipófise", new THREE.Vector3(), "#D6F3EA", "embriao", 2); r.posFn = (v) => v.copy(emb.neuro.position); }
{ const r = rotulo("Bolsa de Rathke → adeno-hipófise", new THREE.Vector3(), "#3CC4A2", "embriao", 1); r.posFn = (v) => v.copy(emb.rathke.position); }
rotulo("Boca primitiva", P(5.6, -6.6), "#F07F5A", "embriao", 3);

// =====================================================================  CÓRTEX, VIA DA VISÃO E SISTEMA LÍMBICO (camadas opcionais)
// córtex: os quatro lobos como "cascas" sobre o envoltório do cérebro (centro 9,6; 4,4; 0 e semieixos 8,3 × 6,0 × 6,7 cm)
const ENV_C = [9.6, 4.4], ENV_R = [8.3, 6.0, 6.7];
const supZ = (x, y) => { const q = 1 - ((x - ENV_C[0]) / ENV_R[0]) ** 2 - ((y - ENV_C[1]) / ENV_R[1]) ** 2; return q > 0 ? ENV_R[2] * Math.sqrt(q) : NaN; };
const sylvius = (x) => 1.0 + 0.42 * (x - 3.5);   // fissura lateral: sobe de frente para trás
const centralX = (y) => 7.2 + 0.27 * (y - 2.5);  // sulco central: inclinado para a frente embaixo
function loboDe(x, y, z) {
  const az = Math.abs(z);
  if (y < 0.4 && az < 3.4) return null; // base, escondida pelo diencéfalo e pelo tronco
  if (x > 14.6 - 0.12 * (y - 4)) return "lobo_occipital";
  if (az > 2.6 && y < sylvius(x) && x > 3.6 && x < 14.8) return "lobo_temporal";
  return x < centralX(y) ? "lobo_frontal" : "lobo_parietal";
}
const CORES_LOBO = { lobo_frontal: 0x7fa7e8, lobo_parietal: 0xe8c77f, lobo_temporal: 0x8fd19e, lobo_occipital: 0xe89a9a };
{
  const base = new THREE.SphereGeometry(1, 120, 80), pos = base.attributes.position, idx = base.index;
  const cena = [], anat = [];
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
    const x = 9.6 - ENV_R[0] * vz, y = ENV_C[1] + ENV_R[1] * vy, z = ENV_R[2] * vx;
    anat.push([x, y, z]);
    cena.push(P(x, y, z).sub(P(9.6, 4.4)).multiplyScalar(1.012).add(P(9.6, 4.4)));
  }
  const tris = {};
  for (let t = 0; t < idx.count; t += 3) {
    const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2);
    const m = [0, 1, 2].map((k) => (anat[a][k] + anat[b][k] + anat[c][k]) / 3);
    const l = loboDe(...m);
    if (l) (tris[l] ||= []).push(a, b, c);
  }
  for (const [id, lista] of Object.entries(tris)) {
    const g = new THREE.BufferGeometry().setFromPoints(cena);
    g.setIndex(lista); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat(CORES_LOBO[id], { opacity: 0.3, side: THREE.DoubleSide }));
    m.renderOrder = 8;
    registrar(m, id, "cortex", { clip: true });
  }
  // o envoltório é um elipsoide simples e não desce o bastante dos lados: cada lobo temporal ganha um volume próprio
  // (só a parte que fica fora do envoltório é desenhada; a de dentro já é a casca verde acima)
  const foraEnv = (x, y, z) => ((x - 9.6) / 8.3) ** 2 + ((y - 4.4) / 6.0) ** 2 + (z / 6.7) ** 2 > 0.985;
  for (const s of [1, -1]) {
    const gt = new THREE.SphereGeometry(1, 72, 44), pt = gt.attributes.position, it = gt.index;
    const an = [], ce = [];
    for (let i = 0; i < pt.count; i++) {
      const x = 9.6 - 4.6 * pt.getZ(i), y = -0.3 + 2.3 * pt.getY(i), z = s * 4.3 + 2.2 * pt.getX(i);
      an.push([x, y, z]); ce.push(P(x, y, z));
    }
    const lista = [];
    for (let t = 0; t < it.count; t += 3) {
      const a = it.getX(t), b = it.getX(t + 1), c = it.getX(t + 2);
      const m = [0, 1, 2].map((k) => (an[a][k] + an[b][k] + an[c][k]) / 3);
      if (foraEnv(...m)) lista.push(a, b, c);
    }
    const g = new THREE.BufferGeometry().setFromPoints(ce);
    g.setIndex(lista); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat(CORES_LOBO.lobo_temporal, { opacity: 0.3, side: THREE.DoubleSide }));
    m.renderOrder = 8; m.userData.centro = P(9.6, -0.3, s * 4.3);
    registrar(m, "lobo_temporal", "cortex", { clip: true });
  }
  // sulco central (cruza o alto da cabeça) e fissura lateral (um de cada lado)
  const pc = [];
  for (const s of [1, -1]) {
    const lado = [];
    for (let y = 2.9; y <= 10.4; y += 0.25) { const x = centralX(y), z = supZ(x, y); if (z > 0.05) lado.push(P(x, y, s * z * 1.014)); }
    pc.push(...(s === 1 ? lado : lado.reverse()));
  }
  const sulco = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pc), 200, 0.06, 6, false), mat(0xe8edf4, { opacity: 0.75 }));
  registrar(sulco, "sulco_central", "cortex", { clip: true });
  for (const s of [1, -1]) {
    const pf = [];
    for (let x = 3.8; x <= 12.4; x += 0.3) { const y = sylvius(x), z = supZ(x, y); if (z > 0) pf.push(P(x, y, s * z * 1.014)); }
    registrar(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pf), 120, 0.06, 6, false), mat(0xe8edf4, { opacity: 0.75 })), "fissura_lateral", "cortex", { clip: true });
  }
}
// via da visão consciente: trato óptico (já desenhado) → corpo geniculado lateral → radiação óptica → córtex visual (V1)
for (const s of [1, -1]) {
  registrar(elipsoide([9.75, 1.1, s * 2.42], [0.32, 0.22, 0.22], 0x9fb7ff, { emissive: 0x5e7fe0, ei: 0.25 }), "cgl", "visao");
  registrar(tubo([[9.85, 1.1, s * 2.5], [11.2, 1.6, s * 3.3], [13.4, 2.5, s * 3.2], [15.6, 3.2, s * 2.0], [16.8, 3.6, s * 0.95]], 0.09, 0x9fb7ff, { opacity: 0.85 }), "radiacao", "visao");
  registrar(elipsoide([17.1, 3.6, s * 0.75], [0.55, 0.95, 0.35], 0x7fa0ff, { emissive: 0x5e7fe0, ei: 0.3 }), "v1", "visao", { clip: true });
}
const CURVAS_VISAO = [];
for (const s of [1, -1]) for (const cruza of [true, false]) {
  const t = cruza ? -s : s; // as fibras nasais cruzam no quiasma; as temporais seguem do mesmo lado
  CURVAS_VISAO.push(curva([[3.1, -0.68, s * 2.85], [4.8, -0.4, s * 1.7], [6.6, 0, s * 0.45], [6.75, 0.03, cruza ? 0 : s * 0.35],
    [6.85, 0.05, t * 0.45], [8.0, 0.6, t * 1.6], [9.5, 1.2, t * 2.3], [9.85, 1.1, t * 2.5], [11.2, 1.6, t * 3.3], [13.4, 2.5, t * 3.2], [15.6, 3.2, t * 2.0], [16.8, 3.6, t * 0.95]]));
}
// sistema límbico
for (const s of [1, -1]) {
  registrar(tubo([[9.0, -1.7, s * 3.2], [10.3, -1.3, s * 3.35], [11.5, -0.3, s * 3.1], [12.2, 0.9, s * 2.6]], 0.5, 0xf2a7c8, { opacity: 0.75 }), "hipocampo", "limbico", { clip: true });
  registrar(elipsoide([8.0, -1.15, s * 3.15], [0.78, 0.62, 0.62], 0xff8a8a, { opacity: 0.85 }), "amigdala", "limbico", { clip: true });
  registrar(tubo([[11.0, 3.15, s * 0.4], [9.6, 3.55, s * 0.4], [8.0, 3.4, s * 0.35], [7.2, 2.6, s * 0.3], [6.95, 1.75, s * 0.2]], 0.12, 0xe8d3a8, { opacity: 0.85 }), "fornix", "limbico");
  registrar(tubo([[11.0, 3.15, s * 0.4], [12.0, 2.9, s * 1.3], [12.4, 1.8, s * 2.2], [12.2, 0.9, s * 2.6]], 0.11, 0xe8d3a8, { opacity: 0.85 }), "fornix", "limbico");
  registrar(tubo([[6.95, 1.75, s * 0.2], [7.2, 0.9, s * 0.28], [7.95, 0.05, s * 0.3]], 0.1, 0xe8d3a8, { opacity: 0.85 }), "fornix", "limbico");
  registrar(elipsoide([8.05, -0.12, s * 0.32], [0.25, 0.25, 0.25], 0xffb3d1, { emissive: 0xff7ad9, ei: 0.2 }), "mamilares", "limbico");
  registrar(tubo([[8.05, 0.0, s * 0.33], [7.85, 1.2, s * 0.6], [7.55, 2.45, s * 0.85]], 0.06, 0xffb3d1, { opacity: 0.9 }), "mamilotalamico", "limbico");
  registrar(elipsoide([7.45, 2.65, s * 0.9], [0.32, 0.28, 0.28], 0xb3adf2, { emissive: 0x8f86ff, ei: 0.25 }), "tal_anterior", "limbico");
  registrar(tubo([[4.7, 2.9, s * 0.6], [4.4, 4.5, s * 0.6], [5.7, 6.2, s * 0.6], [8.5, 6.75, s * 0.6], [11.1, 6.2, s * 0.6], [12.7, 4.6, s * 0.6], [12.7, 3.0, s * 0.6]], 0.42, 0xd8a6ff, { opacity: 0.55 }), "cingulo", "limbico", { clip: true });
  registrar(tubo([[7.45, 2.9, s * 0.85], [7.3, 4.3, s * 0.7], [7.6, 5.9, s * 0.62]], 0.05, 0xff7ad9, { opacity: 0.8 }), "papez", "limbico");
  registrar(tubo([[12.7, 3.0, s * 0.6], [13.1, 1.6, s * 1.6], [12.3, -0.6, s * 2.7], [10.0, -1.7, s * 3.05]], 0.07, 0xff7ad9, { opacity: 0.8 }), "papez", "limbico", { clip: true });
  registrar(elipsoide([9.55, 1.75, s * 0.33], [0.17, 0.17, 0.17], 0x9ef0d0, { emissive: 0x3cc4a2, ei: 0.4 }), "habenula", "limbico");
}
// circuito de Papez: um laço fechado por lado, percorrido pelos pulsos
const CURVAS_PAPEZ = [1, -1].map((s) => new THREE.CatmullRomCurve3([[12.2, 0.9, 2.6], [12.4, 1.8, 2.2], [12.0, 2.9, 1.3], [11.0, 3.15, 0.4], [9.6, 3.55, 0.4], [8.0, 3.4, 0.35],
  [7.2, 2.6, 0.3], [6.95, 1.75, 0.2], [7.2, 0.9, 0.28], [7.95, 0.05, 0.3], [7.85, 1.2, 0.6], [7.5, 2.6, 0.88], [7.3, 4.3, 0.7], [7.6, 5.9, 0.62], [8.5, 6.75, 0.6],
  [11.1, 6.2, 0.6], [12.7, 4.6, 0.6], [12.7, 3.0, 0.6], [13.1, 1.6, 1.6], [12.3, -0.6, 2.7], [10.0, -1.7, 3.05], [9.0, -1.7, 3.2], [10.3, -1.3, 3.35], [11.5, -0.3, 3.1]]
  .map(([x, y, z]) => P(x, y, s * z)), true));

// =====================================================================  RÓTULOS ANATÔMICOS
rotulo("Pineal", [10.15, 1.42], "#F2B24A", "fixo", 0);
rotulo("Hipófise", [6.95, -1.6], "#3CC4A2", "fixo", 1);
rotulo("Hipotálamo", [7.5, 0.5, 0.75], "#3CC4A2", "fixo", 1);
rotulo("3º ventrículo", [8.3, 1.4], "#5EA6F2", "vent", 2);
rotulo("Tálamo", [8.9, 2.6, 1.9], "#A39BF2", "fixo", 2);
rotulo("Glabela", [-0.45, 1.3], "#FFFFFF", "fixo", 1);
rotulo("Raiz do nariz", [0, 0], "#FFFFFF", "fixo", 2);
rotulo("Topo da cabeça", [9.5, 12.15], "#FFFFFF", "fixo", 1);
rotulo("Parte de trás da cabeça", [19.5, 1.5], "#FFFFFF", "fixo", 1);
rotulo("Quiasma óptico", [6.7, 0.02, -0.5], "#C8CBD2", "fixo", 3);
rotulo("Pirâmide nasal", [-1.6, -3.4], "#F07F5A", "fixo", 4);
rotulo("Corpo caloso", [8.5, 5.9], "#F3EAD8", "cerebro", 4);
rotulo("Cerebelo", [15.0, -2.6], "#D9B8A8", "cerebro", 5);
rotulo("Tronco encefálico", [10.3, -3.5], "#E2C9BB", "cerebro", 5);
rotulo("Gânglio cervical superior", [10.3, -9.0, 2.4], "#F0997B", "circ", 5);
rotulo("Seio cavernoso", [7.1, -1.45, 1.9], "#A39BF2", "vasos", 4);
rotulo("Ventrículo lateral", [12.8, 2.6, 3.1], "#5EA6F2", "vent", 6);
rotulo("Olho", [1.9, -0.7, 3.2], "#E8EDF4", "fixo", 6);
rotulo("Ajna (simbólico)", [-1.0, 1.3], "#8F86FF", "simbolo", 3, "simb");
rotulo("Coroa (simbólico)", [9.7, 13.1, 1.2], "#C7A6FF", "simbolo", 3, "simb");
rotulo("Sistema porta", [7.2, -0.8, 0.3], "#E24B4A", "porta", 2);
rotulo("Lobo frontal", [4.2, 7.5, supZ(4.2, 7.5)], "#7FA7E8", "cortex", 2);
rotulo("Lobo parietal", [12.2, 9.0, supZ(12.2, 9.0)], "#E8C77F", "cortex", 2);
rotulo("Lobo temporal", [9.6, -0.3, 6.5], "#8FD19E", "cortex", 2);
rotulo("Lobo occipital", [16.8, 4.0, supZ(16.8, 4.0)], "#E89A9A", "cortex", 2);
rotulo("Sulco central", [centralX(8.5), 8.5, supZ(centralX(8.5), 8.5)], "#E8EDF4", "cortex", 4);
rotulo("Fissura lateral", [7.5, sylvius(7.5), supZ(7.5, sylvius(7.5))], "#E8EDF4", "cortex", 4);
rotulo("Corpo geniculado lateral", [9.75, 1.1, 2.42], "#9FB7FF", "visao", 2);
rotulo("Radiação óptica", [13.4, 2.5, 3.2], "#9FB7FF", "visao", 3);
rotulo("Córtex visual (V1)", [17.1, 3.6, 0.75], "#7FA0FF", "visao", 1);
rotulo("Hipocampo", [10.8, -0.9, 3.4], "#F2A7C8", "limbico", 1);
rotulo("Amígdala", [8.0, -1.15, 3.6], "#FF8A8A", "limbico", 2);
rotulo("Fórnix", [9.6, 3.6, 0.45], "#E8D3A8", "limbico", 2);
rotulo("Corpos mamilares", [8.05, -0.15, 0.35], "#FFB3D1", "limbico", 2);
rotulo("Giro do cíngulo", [8.5, 6.8, 0.6], "#D8A6FF", "limbico", 2);
rotulo("Habênula", [9.55, 1.75, 0.35], "#9EF0D0", "limbico", 2);
rotulo("Núcleo anterior do tálamo", [7.45, 2.65, 0.9], "#B3ADF2", "limbico", 5);
// rótulos que só existem na forma anatômica (a posição vem da malha real)
for (const [t, cor, g, pr] of [["Ínsula", "#C9A0E0", "cortex", 3], ["Giro para-hipocampal", "#E6B8F0", "limbico", 4], ["Núcleos da base", "#8FB4D9", "cerebro", 4],
  ["Osso frontal", "#EEE3CF", "cranio", 3], ["Ossos parietais", "#EEE3CF", "cranio", 3], ["Osso occipital", "#EEE3CF", "cranio", 3], ["Ossos temporais", "#E6D8BF", "cranio", 4],
  ["Osso esfenoide", "#F2C98F", "cranio", 2], ["Osso etmoide", "#E6D8BF", "cranio", 5], ["Ossos da face", "#E6D8BF", "cranio", 5], ["Mandíbula", "#EEE3CF", "cranio", 4]]) rotulo(t, [9, 0, 0], cor, g, pr).soAnat = true;

// =====================================================================  INFORMAÇÕES
const INFO = {
  pineal: ["Pineal", "#F2B24A", "Glândula de 5 a 8 mm em forma de cone (pinha), no epitálamo.",
    ["Base presa à frente, no teto do 3º ventrículo; ápice para trás, entre os pulvinares.", "Produz melatonina no escuro; a luz na retina freia o circuito.", "Seu plano horizontal sai na glabela; o vértice da cabeça fica quase em cima dela."]],
  adeno: ["Adeno-hipófise", "#3CC4A2", "Parte da frente da hipófise, na sela túrcica. Veio do teto da boca do embrião (bolsa de Rathke).",
    ["Produz GH, prolactina, TSH, ACTH, FSH e LH.", "Recebe ordens do hipotálamo pelo sistema porta.", "A pars tuberalis, em volta da haste, lê a melatonina."]],
  neuro: ["Neuro-hipófise e haste", "#3CC4A2", "Parte de trás da hipófise: uma extensão do próprio hipotálamo.",
    ["Libera ocitocina e vasopressina, feitas no hipotálamo.", "A haste desce do assoalho do 3º ventrículo."]],
  hipotalamo: ["Hipotálamo", "#3CC4A2", "Par: forma o assoalho e as paredes de baixo do 3º ventrículo.",
    ["Comanda a hipófise por axônios e pelo sistema porta.", "Contém o NSQ (relógio) e o NPV, que inicia a via até a pineal."]],
  nsq: ["Núcleo supraquiasmático (NSQ)", "#3CC4A2", "O relógio central, logo acima do quiasma óptico.",
    ["Recebe a luz direto da retina.", "De dia freia o circuito; à noite libera o sinal para a pineal."]],
  npv: ["Núcleo paraventricular (NPV)", "#3CC4A2", "Núcleo do hipotálamo que recebe o NSQ.",
    ["Daqui o sinal desce pela medula até T1–T2, sobe pelo gânglio do pescoço e chega à pineal.", "Também manda ocitocina e vasopressina para a neuro-hipófise."]],
  talamo: ["Tálamos", "#A39BF2", "Dois ovos de substância cinzenta que formam as paredes de cima do 3º ventrículo.",
    ["Estação de passagem das sensações para o córtex.", "Unidos pela aderência intertalâmica; o pulvinar emoldura a pineal.", "Não transportam hormônios."]],
  vent3: ["Terceiro ventrículo", "#5EA6F2", "Fenda estreita de líquor na linha média do diencéfalo.",
    ["Pineal no teto, atrás e em cima; hipófise no assoalho, na frente e embaixo.", "A pineal solta melatonina direto nesse líquor.", "Entra pelos forames de Monro e sai pelo aqueduto."]],
  ventlat: ["Ventrículos laterais", "#5EA6F2", "Duas cavidades em forma de C, uma em cada hemisfério.",
    ["Produzem boa parte do líquor (plexo coroide).", "Desembocam no 3º ventrículo pelos forames de Monro."]],
  aqueduto: ["Aqueduto e 4º ventrículo", "#5EA6F2", "Saída do líquor logo abaixo da pineal, rumo ao 4º ventrículo e ao espaço em volta do cérebro.",
    ["Um tumor de pineal pode apertar o aqueduto e causar hidrocefalia."]],
  quiasma: ["Quiasma, nervos e tratos ópticos", "#C8CBD2", "Os nervos ópticos se cruzam em X acima da hipófise.",
    ["Um tumor de hipófise costuma afetar primeiro a visão lateral.", "Do quiasma sai a via direta da luz até o NSQ."]],
  olho: ["Olhos", "#E8EDF4", "Irmãos da pineal: as retinas e a pineal nascem do mesmo tecido do diencéfalo no embrião.",
    ["Nos mamíferos, é por eles que a pineal sabe se é dia ou noite."]],
  piramide: ["Pirâmide nasal", "#F07F5A", "O nariz externo tem a forma de uma pirâmide de três faces.", ["Vértice na raiz do nariz; base nas narinas."]],
  glabela: ["Glabela", "#FFFFFF", "Ponto entre as sobrancelhas, 1 a 1,5 cm acima da raiz do nariz.",
    ["O plano horizontal da pineal sai aqui.", "Na vista de frente, fica bem na frente da pineal.", "Região de maior risco para preenchedores (anastomose com a artéria oftálmica)."]],
  nasio: ["Raiz do nariz (násio)", "#FFFFFF", "Encontro do osso frontal com os ossos nasais.",
    ["O plano da hipófise sai um pouco abaixo dela.", "Ali perto passa a veia angular, ligada ao seio cavernoso."]],
  vertice: ["Topo da cabeça (vértice)", "#FFFFFF", "O ponto mais alto da cabeça, no couro cabeludo.",
    ["Fica quase em cima da pineal: cerca de 10,7 cm acima dela.", "Use a régua para medir até a pineal, a glabela ou a parte de trás da cabeça."]],
  occipital: ["Parte de trás da cabeça (opistocrânio)", "#FFFFFF", "O ponto mais para trás da cabeça, sobre o osso occipital.",
    ["Da glabela até aqui é o comprimento da cabeça: cerca de 20 cm.", "A pineal fica uns 9,4 cm à frente dele."]],
  seiofrontal: ["Seio frontal", "#85B7EB", "Cavidade de ar atrás da glabela; drena para o nariz.", []],
  esfenoidal: ["Seio esfenoidal", "#85B7EB", "Cavidade de ar logo abaixo da sela túrcica.", ["É por ele que se opera a hipófise pelo nariz."]],
  caloso: ["Corpo caloso", "#F3EAD8", "Grande ponte de fibras entre os dois hemisférios, acima do diencéfalo.", ["A pineal fica logo abaixo da sua ponta de trás (esplênio)."]],
  cerebelo: ["Cerebelo", "#D9B8A8", "Atrás do tronco encefálico; coordena movimento e equilíbrio.", []],
  tronco: ["Tronco encefálico", "#E2C9BB", "Mesencéfalo, ponte e bulbo, ligando o cérebro à medula.", ["Os colículos superiores ficam logo abaixo da pineal."]],
  medula: ["Medula espinhal", "#E2C9BB", "Continua o tronco pelo pescoço.", ["A via até a pineal desce por ela até T1–T2, no tórax."]],
  gcs: ["Gânglio cervical superior", "#F0997B", "Gânglio simpático no pescoço.", ["Suas fibras sobem com as artérias e entram na pineal por trás."]],
  cavernoso: ["Seios cavernosos", "#A39BF2", "Veias de cada lado da hipófise, com a carótida interna por dentro.", ["Recebem a veia oftálmica superior, que vem da raiz do nariz."]],
  carotida: ["Carótida interna", "#E24B4A", "Atravessa o seio cavernoso e dá ramos para a hipófise e para o olho (artéria oftálmica).", []],
  veia: ["Veias angular e oftálmica superior", "#378ADD", "Ligam o canto interno do olho ao seio cavernoso.", ["É o caminho do “triângulo do perigo” da face."]],
  porta: ["Sistema porta hipofisário", "#E24B4A", "Duas redes de capilares em sequência ligadas por veias na haste.",
    ["Verde: hormônios de liberação do hipotálamo descendo até a adeno-hipófise.", "Roxo: GH, TSH, ACTH, FSH, LH e prolactina saindo para o seio cavernoso.", "Verde-claro: ocitocina e vasopressina descendo por dentro dos axônios até a neuro-hipófise."]],
  liquor: ["Fluxo do líquor", "#5EA6F2", "O líquor nasce nos ventrículos laterais, passa pelos forames de Monro e atravessa o 3º ventrículo.",
    ["Sai pelo aqueduto, logo abaixo da pineal, rumo ao 4º ventrículo.", "No caminho, recebe melatonina da pineal."]],
  ajna: ["Ajna (simbólico)", "#8F86FF", "O “terceiro olho” das tradições hindus, colocado entre as sobrancelhas.",
    ["Fica na glabela, onde sai o plano horizontal da pineal.", "A ligação com a pineal vem da Teosofia; é uma leitura simbólica, sem comprovação fisiológica."]],
  coroa: ["Coroa (simbólico)", "#C7A6FF", "O chakra do topo da cabeça.",
    ["O vértice da cabeça fica quase em cima da pineal: daí o eixo vertical desenhado aqui.", "Leitura simbólica, sem comprovação fisiológica."]],
  lobo_frontal: ["Lobo frontal", "#7FA7E8", "A parte da frente de cada hemisfério, até o sulco central. É o maior dos lobos.",
    ["Planejamento, decisão, atenção e controle dos impulsos (córtex pré-frontal).", "Logo à frente do sulco central fica o córtex motor, que comanda os movimentos voluntários.", "No hemisfério esquerdo, a área de Broca ajuda a produzir a fala.", "Substância cinzenta: ≈ 166 cm³ somando os dois lados (adultos, ressonância)."]],
  lobo_parietal: ["Lobo parietal", "#E8C77F", "Entre o sulco central e o lobo occipital, no alto e atrás.",
    ["Logo atrás do sulco central fica o córtex somatossensorial: tato, dor, temperatura e posição do corpo.", "Junta visão e tato para saber onde as coisas estão no espaço.", "Substância cinzenta: ≈ 104 cm³ somando os dois lados."]],
  lobo_temporal: ["Lobo temporal", "#8FD19E", "Abaixo da fissura lateral, dos lados da cabeça, na altura das orelhas.",
    ["Audição: o córtex auditivo fica na margem de cima, dentro da fissura.", "Compreensão da linguagem (área de Wernicke, em geral à esquerda) e reconhecimento de rostos.", "Por dentro abriga o hipocampo e a amígdala, do sistema límbico.", "Substância cinzenta: ≈ 92 cm³ somando os dois lados."]],
  lobo_occipital: ["Lobo occipital", "#E89A9A", "A parte de trás do cérebro, na nuca.",
    ["É o centro da visão: o córtex visual primário (V1) fica na face interna, em volta do sulco calcarino.", "Substância cinzenta: ≈ 43 cm³ somando os dois lados, o menor dos quatro lobos."]],
  sulco_central: ["Sulco central (de Rolando)", "#E8EDF4", "Separa o lobo frontal do parietal, descendo do alto da cabeça até perto da fissura lateral.",
    ["À frente dele, o córtex motor (mexer); atrás, o córtex sensitivo (sentir).", "Nos dois giros o corpo está mapeado de cabeça para baixo: é o homúnculo."]],
  fissura_lateral: ["Fissura lateral (de Sylvius)", "#E8EDF4", "O sulco profundo que separa o lobo temporal dos lobos frontal e parietal.",
    ["No fundo dela fica escondida a ínsula, um quinto lobo ligado às sensações de dentro do corpo.", "A artéria cerebral média corre por dentro dela."]],
  cgl: ["Corpo geniculado lateral", "#9FB7FF", "Núcleo do tálamo, um de cada lado, onde terminam os tratos ópticos.",
    ["É a estação da visão consciente: cerca de 90% das fibras da retina param aqui.", "Tem 6 camadas, que separam o olho direito do esquerdo e o movimento do detalhe e da cor.", "Um ramo pequeno da retina segue outro caminho: vai ao NSQ, o relógio, e não forma imagem."]],
  radiacao: ["Radiação óptica", "#9FB7FF", "Leque de fibras que leva a imagem do corpo geniculado lateral até o córtex visual.",
    ["Uma parte faz uma volta para a frente, dentro do lobo temporal (alça de Meyer).", "Uma lesão aqui apaga a mesma metade do campo visual nos dois olhos."]],
  v1: ["Córtex visual primário (V1)", "#7FA0FF", "Na face interna do lobo occipital, em volta do sulco calcarino.",
    ["Aqui começam a ser montados bordas, orientação, movimento e cor: a imagem que vemos.", "Cada lado vê a metade oposta do mundo: o V1 esquerdo vê o lado direito.", "O centro da visão (fóvea) ocupa uma área enorme, na ponta de trás."]],
  hipocampo: ["Hipocampo", "#F2A7C8", "Faixa curva em forma de cavalo-marinho no assoalho do corno temporal do ventrículo lateral, uma de cada lado.",
    ["Transforma experiências em memórias de longo prazo e ajuda a se orientar no espaço.", "É uma das primeiras regiões afetadas na doença de Alzheimer."]],
  amigdala: ["Amígdala", "#FF8A8A", "Núcleo em forma de amêndoa logo à frente do hipocampo, perto da ponta do lobo temporal.",
    ["Detecta ameaças e dá cor emocional às memórias, sobretudo ao medo.", "Conversa com o hipotálamo para disparar a resposta ao estresse."]],
  fornix: ["Fórnix", "#E8D3A8", "Feixe arqueado de fibras que sai do hipocampo, passa embaixo do corpo caloso e desce até os corpos mamilares.",
    ["É a principal saída do hipocampo.", "Suas colunas formam a borda da frente do forame de Monro, por onde o líquor passa ao 3º ventrículo."]],
  mamilares: ["Corpos mamilares", "#FFB3D1", "Duas bolinhas na base do hipotálamo, logo atrás da haste da hipófise.",
    ["Recebem o fórnix e mandam o sinal ao núcleo anterior do tálamo.", "Encolhem na falta grave de vitamina B1 (tiamina), como na síndrome de Wernicke-Korsakoff."]],
  mamilotalamico: ["Trato mamilotalâmico", "#FFB3D1", "Feixe curto que sobe dos corpos mamilares até o núcleo anterior do tálamo.",
    ["Um dos elos do circuito de Papez."]],
  tal_anterior: ["Núcleo anterior do tálamo", "#B3ADF2", "Núcleo na ponta da frente de cada tálamo.",
    ["Recebe os corpos mamilares e projeta para o giro do cíngulo.", "Faz parte do sistema límbico, ao contrário da maior parte do tálamo, que é sensitiva."]],
  cingulo: ["Giro do cíngulo", "#D8A6FF", "Faixa de córtex que abraça o corpo caloso por cima, na face interna de cada hemisfério.",
    ["Junta emoção, dor e atenção; ajuda a perceber erros e conflitos.", "Por baixo dele corre o cíngulo, um feixe que leva o sinal de volta ao lobo temporal.", "Substância cinzenta: ≈ 19 cm³ somando os dois lados."]],
  papez: ["Circuito de Papez", "#FF7AD9", "Laço descrito por James Papez em 1937: hipocampo → fórnix → corpos mamilares → trato mamilotalâmico → núcleo anterior do tálamo → giro do cíngulo → cíngulo → córtex entorrinal → hipocampo.",
    ["Papez achava que era o circuito das emoções; hoje se sabe que é sobretudo um circuito da memória.", "Uma lesão em qualquer elo, como nos corpos mamilares, atrapalha a formação de memórias novas.", "Os pulsos rosa mostram o sentido do sinal."]],
  habenula: ["Habênula", "#9EF0D0", "Pequeno núcleo par na base da haste da pineal: junto com ela, forma o epitálamo.",
    ["Funciona como um centro de \"antirrecompensa\": fica ativa quando algo sai pior do que o esperado.", "Vizinha da pineal desde o embrião; às vezes calcifica junto com ela."]],
  insula: ["Ínsula", "#C9A0E0", "O \"quinto lobo\", escondido no fundo da fissura lateral, coberto pelos lobos frontal, parietal e temporal.",
    ["Sente o estado de dentro do corpo: batimentos, respiração, fome, dor, nojo.", "Só aparece na forma anatômica: no esquema ela não foi desenhada."]],
  parahipocampal: ["Giro para-hipocampal", "#E6B8F0", "Faixa de córtex na face de baixo do lobo temporal, logo por fora do hipocampo.",
    ["Na frente fica o córtex entorrinal, a porta de entrada do hipocampo no circuito de Papez.", "Ajuda a reconhecer lugares e cenas."]],
  nucleos_base: ["Núcleos da base (caudado, putâmen e globo pálido)", "#8FB4D9", "Massas de substância cinzenta no fundo de cada hemisfério, ao lado do tálamo.",
    ["Escolhem e afinam os movimentos e os hábitos: é aqui que a doença de Parkinson age.", "O caudado contorna o ventrículo lateral; putâmen e globo pálido ficam por fora da cápsula interna.", "Só aparecem na forma anatômica."]],
  osso_frontal: ["Osso frontal", "#EEE3CF", "A testa e o teto das órbitas.", ["Por dentro dele, atrás da glabela, fica o seio frontal.", "Encontra os ossos nasais na raiz do nariz (násio)."]],
  osso_parietal: ["Ossos parietais", "#EEE3CF", "As duas grandes placas do alto e dos lados do crânio.", ["Encontram-se na linha do meio pela sutura sagital, no topo da cabeça."]],
  osso_occipital: ["Osso occipital", "#EEE3CF", "A parte de trás e de baixo do crânio.", ["Tem o forame magno, por onde o tronco encefálico continua como medula.", "Abriga o cerebelo."]],
  osso_temporal: ["Ossos temporais", "#E6D8BF", "Dos lados do crânio, na altura das orelhas.", ["Guardam a orelha média e a interna (audição e equilíbrio).", "Sua parte petrosa separa o lobo temporal do cerebelo."]],
  osso_esfenoide: ["Osso esfenoide", "#F2C98F", "O osso em forma de borboleta no meio da base do crânio.", ["Em cima dele fica a sela túrcica, o \"berço\" da hipófise.", "Por dentro, o seio esfenoidal: o caminho do cirurgião até a hipófise pelo nariz."]],
  osso_etmoide: ["Osso etmoide", "#E6D8BF", "Osso leve e cheio de cavidades entre as órbitas, no teto do nariz.", ["Sua placa crivosa deixa passar os nervos do olfato."]],
  face_ossos: ["Ossos da face", "#E6D8BF", "Maxilas, zigomáticos, nasais, lacrimais, palatinos, vômer e conchas nasais.", ["Os ossos nasais formam o alto da pirâmide nasal; o resto do nariz é cartilagem."]],
  mandibula: ["Mandíbula", "#EEE3CF", "O osso do queixo, o único do crânio que se move.", ["Articula-se com os ossos temporais, logo à frente das orelhas."]],
};
// ---------- versão em inglês: dados (o português continua sendo a fonte principal)
const INFO_EN = {
  pineal: ["Pineal", "A 5–8 mm cone-shaped (pine-cone) gland in the epithalamus.",
    ["Its base is attached at the front, on the roof of the 3rd ventricle; its apex points backward, between the pulvinars.", "It makes melatonin in the dark; light on the retina brakes the circuit.", "Its horizontal plane exits at the glabella; the top of the head sits almost directly above it."]],
  adeno: ["Anterior pituitary", "Front part of the pituitary, in the sella turcica. It came from the roof of the embryo's mouth (Rathke's pouch).",
    ["Makes GH, prolactin, TSH, ACTH, FSH and LH.", "Takes orders from the hypothalamus through the portal system.", "The pars tuberalis, around the stalk, reads melatonin."]],
  neuro: ["Posterior pituitary and stalk", "Back part of the pituitary: an extension of the hypothalamus itself.",
    ["Releases oxytocin and vasopressin, made in the hypothalamus.", "The stalk comes down from the floor of the 3rd ventricle."]],
  hipotalamo: ["Hypothalamus", "Paired: it forms the floor and the lower walls of the 3rd ventricle.",
    ["Controls the pituitary through axons and the portal system.", "Contains the SCN (the clock) and the PVN, which starts the pathway to the pineal."]],
  nsq: ["Suprachiasmatic nucleus (SCN)", "The master clock, just above the optic chiasm.",
    ["Receives light directly from the retina.", "By day it brakes the circuit; at night it releases the signal to the pineal."]],
  npv: ["Paraventricular nucleus (PVN)", "Hypothalamic nucleus that receives input from the SCN.",
    ["From here the signal runs down the spinal cord to T1–T2, up through the neck ganglion and on to the pineal.", "It also sends oxytocin and vasopressin to the posterior pituitary."]],
  talamo: ["Thalami", "Two egg-shaped masses of gray matter that form the upper walls of the 3rd ventricle.",
    ["Relay station for sensations on their way to the cortex.", "Joined by the interthalamic adhesion; the pulvinar frames the pineal.", "They do not carry hormones."]],
  vent3: ["Third ventricle", "A narrow slit of cerebrospinal fluid (CSF) in the midline of the diencephalon.",
    ["Pineal on the roof, at the back and top; pituitary on the floor, at the front and bottom.", "The pineal releases melatonin straight into this CSF.", "CSF enters through the foramina of Monro and leaves through the aqueduct."]],
  ventlat: ["Lateral ventricles", "Two C-shaped cavities, one in each hemisphere.",
    ["They make much of the CSF (choroid plexus).", "They open into the 3rd ventricle through the foramina of Monro."]],
  aqueduto: ["Aqueduct and 4th ventricle", "CSF exit just below the pineal, toward the 4th ventricle and the space around the brain.",
    ["A pineal tumor can squeeze the aqueduct and cause hydrocephalus."]],
  quiasma: ["Optic chiasm, nerves and tracts", "The optic nerves cross in an X above the pituitary.",
    ["A pituitary tumor usually affects side vision first.", "The direct light pathway to the SCN leaves from the chiasm."]],
  olho: ["Eyes", "Siblings of the pineal: in the embryo, the retinas and the pineal grow from the same diencephalic tissue.",
    ["In mammals, they are how the pineal knows whether it is day or night."]],
  piramide: ["Nasal pyramid", "The external nose has the shape of a three-sided pyramid.", ["Apex at the root of the nose; base at the nostrils."]],
  glabela: ["Glabella", "The point between the eyebrows, 1 to 1.5 cm above the root of the nose.",
    ["The pineal's horizontal plane exits here.", "In the front view, it lies right in front of the pineal.", "The highest-risk area for fillers (anastomosis with the ophthalmic artery)."]],
  nasio: ["Root of the nose (nasion)", "Where the frontal bone meets the nasal bones.",
    ["The pituitary's plane exits a little below it.", "The angular vein, linked to the cavernous sinus, runs close by."]],
  vertice: ["Top of the head (vertex)", "The highest point of the head, on the scalp.",
    ["It sits almost directly above the pineal: about 10.7 cm above it.", "Use the ruler to measure to the pineal, the glabella or the back of the head."]],
  occipital: ["Back of the head (opisthocranion)", "The rearmost point of the head, over the occipital bone.",
    ["From the glabella to here is the head length: about 20 cm.", "The pineal lies about 9.4 cm in front of it."]],
  seiofrontal: ["Frontal sinus", "Air cavity behind the glabella; drains into the nose.", []],
  esfenoidal: ["Sphenoid sinus", "Air cavity just below the sella turcica.", ["Surgeons reach the pituitary through it, via the nose."]],
  caloso: ["Corpus callosum", "Large bridge of fibers between the two hemispheres, above the diencephalon.", ["The pineal lies just below its back end (splenium)."]],
  cerebelo: ["Cerebellum", "Behind the brainstem; coordinates movement and balance.", []],
  tronco: ["Brainstem", "Midbrain, pons and medulla, linking the brain to the spinal cord.", ["The superior colliculi lie just below the pineal."]],
  medula: ["Spinal cord", "Continues the brainstem down the neck.", ["The pathway to the pineal runs down it to T1–T2, in the chest."]],
  gcs: ["Superior cervical ganglion", "Sympathetic ganglion in the neck.", ["Its fibers travel up with the arteries and enter the pineal from behind."]],
  cavernoso: ["Cavernous sinuses", "Veins on each side of the pituitary, with the internal carotid running inside.", ["They receive the superior ophthalmic vein, which comes from the root of the nose."]],
  carotida: ["Internal carotid", "Crosses the cavernous sinus and gives branches to the pituitary and the eye (ophthalmic artery).", []],
  veia: ["Angular and superior ophthalmic veins", "They link the inner corner of the eye to the cavernous sinus.", ["This is the route of the face's “danger triangle”."]],
  porta: ["Hypophyseal portal system", "Two capillary beds in sequence, linked by veins in the stalk.",
    ["Green: hypothalamic releasing hormones flowing down to the anterior pituitary.", "Purple: GH, TSH, ACTH, FSH, LH and prolactin leaving toward the cavernous sinus.", "Light green: oxytocin and vasopressin traveling down inside the axons to the posterior pituitary."]],
  liquor: ["CSF flow", "CSF is made in the lateral ventricles, passes through the foramina of Monro and crosses the 3rd ventricle.",
    ["It leaves through the aqueduct, just below the pineal, toward the 4th ventricle.", "Along the way it picks up melatonin from the pineal."]],
  ajna: ["Ajna (symbolic)", "The “third eye” of Hindu traditions, placed between the eyebrows.",
    ["It sits at the glabella, where the pineal's horizontal plane exits.", "The link with the pineal comes from Theosophy; it is a symbolic reading, with no physiological evidence."]],
  coroa: ["Crown (symbolic)", "The chakra at the top of the head.",
    ["The top of the head sits almost directly above the pineal: hence the vertical axis drawn here.", "Symbolic reading, with no physiological evidence."]],
  lobo_frontal: ["Frontal lobe", "The front part of each hemisphere, up to the central sulcus. It is the largest lobe.",
    ["Planning, decisions, attention and impulse control (prefrontal cortex).", "Just in front of the central sulcus lies the motor cortex, which drives voluntary movement.", "In the left hemisphere, Broca's area helps produce speech.", "Gray matter: ≈ 166 cm³, both sides together (adults, MRI)."]],
  lobo_parietal: ["Parietal lobe", "Between the central sulcus and the occipital lobe, at the top and back.",
    ["Just behind the central sulcus lies the somatosensory cortex: touch, pain, temperature and body position.", "It combines vision and touch to know where things are in space.", "Gray matter: ≈ 104 cm³, both sides together."]],
  lobo_temporal: ["Temporal lobe", "Below the lateral fissure, on the sides of the head, at ear level.",
    ["Hearing: the auditory cortex sits on its upper edge, inside the fissure.", "Language comprehension (Wernicke's area, usually on the left) and face recognition.", "Inside it lie the hippocampus and the amygdala, part of the limbic system.", "Gray matter: ≈ 92 cm³, both sides together."]],
  lobo_occipital: ["Occipital lobe", "The back of the brain.",
    ["It is the center of vision: the primary visual cortex (V1) lies on its inner face, around the calcarine sulcus.", "Gray matter: ≈ 43 cm³, both sides together, the smallest of the four lobes."]],
  sulco_central: ["Central sulcus (of Rolando)", "Separates the frontal lobe from the parietal, running down from the top of the head to near the lateral fissure.",
    ["In front of it, the motor cortex (moving); behind it, the sensory cortex (feeling).", "In both gyri the body is mapped upside down: the homunculus."]],
  fissura_lateral: ["Lateral fissure (of Sylvius)", "The deep groove that separates the temporal lobe from the frontal and parietal lobes.",
    ["Hidden at its bottom lies the insula, a fifth lobe tied to sensations from inside the body.", "The middle cerebral artery runs inside it."]],
  cgl: ["Lateral geniculate nucleus", "A thalamic nucleus, one on each side, where the optic tracts end.",
    ["It is the relay of conscious vision: about 90% of retinal fibers stop here.", "It has 6 layers, which keep the right and left eyes apart and separate motion from detail and color.", "A small branch from the retina takes another path: it goes to the SCN, the clock, and forms no image."]],
  radiacao: ["Optic radiation", "A fan of fibers that carries the image from the lateral geniculate nucleus to the visual cortex.",
    ["Part of it loops forward inside the temporal lobe (Meyer's loop).", "A lesion here blanks the same half of the visual field in both eyes."]],
  v1: ["Primary visual cortex (V1)", "On the inner face of the occipital lobe, around the calcarine sulcus.",
    ["Edges, orientation, motion and color start being assembled here: the image we see.", "Each side sees the opposite half of the world: the left V1 sees the right side.", "The center of vision (fovea) takes up a huge area at the very back."]],
  hipocampo: ["Hippocampus", "A curved, seahorse-shaped band on the floor of the temporal horn of the lateral ventricle, one on each side.",
    ["It turns experiences into long-term memories and helps with spatial navigation.", "It is one of the first regions affected in Alzheimer's disease."]],
  amigdala: ["Amygdala", "An almond-shaped nucleus just in front of the hippocampus, near the tip of the temporal lobe.",
    ["It detects threats and gives memories their emotional color, especially fear.", "It talks to the hypothalamus to trigger the stress response."]],
  fornix: ["Fornix", "An arched bundle of fibers that leaves the hippocampus, runs under the corpus callosum and descends to the mammillary bodies.",
    ["It is the main output of the hippocampus.", "Its columns form the front edge of the foramen of Monro, where CSF passes into the 3rd ventricle."]],
  mamilares: ["Mammillary bodies", "Two small round bumps at the base of the hypothalamus, just behind the pituitary stalk.",
    ["They receive the fornix and send the signal on to the anterior thalamic nucleus.", "They shrink with severe vitamin B1 (thiamine) deficiency, as in Wernicke-Korsakoff syndrome."]],
  mamilotalamico: ["Mammillothalamic tract", "A short bundle rising from the mammillary bodies to the anterior thalamic nucleus.",
    ["One of the links of the Papez circuit."]],
  tal_anterior: ["Anterior thalamic nucleus", "A nucleus at the front tip of each thalamus.",
    ["It receives the mammillary bodies and projects to the cingulate gyrus.", "It belongs to the limbic system, unlike most of the thalamus, which is sensory."]],
  cingulo: ["Cingulate gyrus", "A band of cortex that hugs the corpus callosum from above, on the inner face of each hemisphere.",
    ["It combines emotion, pain and attention, and helps notice errors and conflicts.", "Beneath it runs the cingulum, a bundle that carries the signal back to the temporal lobe.", "Gray matter: ≈ 19 cm³, both sides together."]],
  papez: ["Papez circuit", "A loop described by James Papez in 1937: hippocampus → fornix → mammillary bodies → mammillothalamic tract → anterior thalamic nucleus → cingulate gyrus → cingulum → entorhinal cortex → hippocampus.",
    ["Papez thought it was the circuit of emotion; today it is known to be mainly a memory circuit.", "A lesion in any link, such as the mammillary bodies, impairs forming new memories.", "The pink pulses show the direction of the signal."]],
  habenula: ["Habenula", "A small paired nucleus at the base of the pineal stalk: together with the pineal it forms the epithalamus.",
    ["It works as an \"anti-reward\" center: it becomes active when something turns out worse than expected.", "A neighbor of the pineal since the embryo; it sometimes calcifies along with it."]],
  insula: ["Insula", "The \"fifth lobe\", hidden at the bottom of the lateral fissure, covered by the frontal, parietal and temporal lobes.",
    ["It senses the body's inner state: heartbeat, breathing, hunger, pain, disgust.", "It only appears in the anatomical form: the schematic one does not draw it."]],
  parahipocampal: ["Parahippocampal gyrus", "A band of cortex on the underside of the temporal lobe, just outside the hippocampus.",
    ["At its front lies the entorhinal cortex, the hippocampus's gateway in the Papez circuit.", "It helps recognize places and scenes."]],
  nucleos_base: ["Basal ganglia (caudate, putamen and globus pallidus)", "Masses of gray matter deep in each hemisphere, beside the thalamus.",
    ["They select and fine-tune movements and habits: this is where Parkinson's disease acts.", "The caudate curves around the lateral ventricle; putamen and globus pallidus lie outside the internal capsule.", "They only appear in the anatomical form."]],
  osso_frontal: ["Frontal bone", "The forehead and the roof of the orbits.", ["Inside it, behind the glabella, lies the frontal sinus.", "It meets the nasal bones at the root of the nose (nasion)."]],
  osso_parietal: ["Parietal bones", "The two large plates at the top and sides of the skull.", ["They meet in the midline at the sagittal suture, on top of the head."]],
  osso_occipital: ["Occipital bone", "The back and lower part of the skull.", ["It has the foramen magnum, where the brainstem continues as the spinal cord.", "It houses the cerebellum."]],
  osso_temporal: ["Temporal bones", "On the sides of the skull, at ear level.", ["They hold the middle and inner ear (hearing and balance).", "Their petrous part separates the temporal lobe from the cerebellum."]],
  osso_esfenoide: ["Sphenoid bone", "The butterfly-shaped bone in the middle of the skull base.", ["On top of it sits the sella turcica, the pituitary's \"cradle\".", "Inside it is the sphenoid sinus: the surgeon's route to the pituitary through the nose."]],
  osso_etmoide: ["Ethmoid bone", "A light, hollow bone between the orbits, at the roof of the nose.", ["Its cribriform plate lets the olfactory nerves through."]],
  face_ossos: ["Facial bones", "Maxillae, zygomatic, nasal, lacrimal and palatine bones, vomer and nasal conchae.", ["The nasal bones form the top of the nasal pyramid; the rest of the nose is cartilage."]],
  mandibula: ["Mandible", "The jaw bone, the only bone of the skull that moves.", ["It articulates with the temporal bones, just in front of the ears."]],
};
const TOUR_EN = [
  ["The center of the head", "Let's follow the path that takes daylight to nighttime melatonin, through the structures we saw on the posters."],
  ["1. Light enters through the eyes", "By day, bright light reaches the retina. The blue pulses show the signal leaving the eyes along the optic nerves."],
  ["2. Chiasm and master clock", "The optic nerves cross at the chiasm. Just above sits the SCN, the master clock, which gets light directly from the retina."],
  ["3. Same light, two destinations", "From the chiasm, almost all fibers continue along the optic tracts to the thalamus's lateral geniculate nucleus and, through the optic radiation, to the visual cortex (V1) at the back of the head: this is conscious, image-forming vision. Only a small branch turns off to the SCN, which doesn't want to see anything, only to know whether it is day or night."],
  ["4. Night falls and the brake is released", "Without light, the SCN lets the paraventricular nucleus (PVN) pass the signal on. The red pulses start here."],
  ["5. The signal goes down the spinal cord", "Instead of going straight to the pineal, the signal travels down the brainstem and the spinal cord to the upper chest (T1–T2)."],
  ["6. Superior cervical ganglion", "From the chest, the signal climbs the sympathetic chain to this ganglion in the neck."],
  ["7. The fibers enter the pineal from behind", "Sympathetic fibers travel up along the arteries and reach the pineal from the back, next to the cerebellum."],
  ["8. The pineal releases melatonin", "Norepinephrine from these fibers activates the pineal. It glows and releases melatonin (orange dots) into the blood and the CSF."],
  ["9. The third ventricle and the CSF", "CSF flows down from the lateral ventricles, crosses the 3rd ventricle and leaves through the aqueduct, carrying melatonin to the floor, where the hypothalamus and the pituitary stalk are."],
  ["10. Pituitary and portal system", "The hypothalamus sends releasing hormones through the portal veins (green) to the anterior pituitary, which releases its own hormones into the blood (purple). Oxytocin and vasopressin travel down inside the axons (light green)."],
  ["11. Glabella, root of the nose and the two planes", "The pineal's horizontal plane exits at the glabella; the pituitary's exits a little below the root of the nose."],
  ["12. From the root of the nose to the cavernous sinus", "The angular vein, at the corner of the eye, joins the superior ophthalmic vein, which ends in the cavernous sinus, next to the pituitary."],
  ["13. View from above", "From above, the pineal appears between the two thalami, and the highest point of the head sits almost directly above it. In the symbolic layer, that is where the vertical axis runs."],
  ["End of the tour", "Try embryo mode to see where the pineal, the eyes and the pituitary come from, or test what you learned in the quiz."],
];
const ETAPAS_EMB_EN = [
  ["Weeks 3–4", "The diencephalon is a vesicle of the neural tube. Four buds appear: two to the sides (optic vesicles), one up and back (pineal) and one down (infundibulum)."],
  ["Weeks 4–5", "The optic vesicles grow sideways on stalks; Rathke's pouch rises from the roof of the primitive mouth."],
  ["Week 6", "Rathke's pouch meets the infundibulum: the mouth part becomes the anterior pituitary, the brain part becomes the posterior pituitary."],
  ["Weeks 7–8", "The pouch loses its link to the mouth (the sphenoid bone forms in between). The eyes move forward onto the face."],
  ["Later", "Result: retinas, pineal and posterior pituitary are siblings, all buds of the diencephalon; the anterior pituitary came from the mouth."],
];
// =====================================================================  VOLUMES (modelo × valores reais de referência)
// Volume de uma malha fechada pelo teorema da divergência: soma, sobre os triângulos, do volume
// com sinal do tetraedro (origem, a, b, c) = a·(b×c)/6. Tubos usam π·r²·comprimento da curva.
const _va = new THREE.Vector3(), _vb = new THREE.Vector3(), _vc = new THREE.Vector3();
function volumeMalha(m) {
  if (m.userData.v0 !== undefined) return m.userData.v0; // malha real: volume da malha original, antes do encaixe
  if (m.userData.curve) return Math.PI * m.userData.raio ** 2 * m.userData.curve.getLength();
  m.updateWorldMatrix(true, false);
  const pos = m.geometry.attributes.position, idx = m.geometry.index, M = m.matrixWorld;
  const n = idx ? idx.count : pos.count;
  let v = 0;
  for (let i = 0; i + 2 < n; i += 3) {
    const [i0, i1, i2] = idx ? [idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)] : [i, i + 1, i + 2];
    _va.fromBufferAttribute(pos, i0).applyMatrix4(M);
    _vb.fromBufferAttribute(pos, i1).applyMatrix4(M);
    _vc.fromBufferAttribute(pos, i2).applyMatrix4(M);
    v += _va.dot(_vb.cross(_vc)) / 6;
  }
  return Math.abs(v);
}
const PARES = new Set(["olho", "talamo", "hipotalamo", "nsq", "npv", "ventlat", "seiofrontal", "cavernoso", "gcs",
  "cgl", "v1", "hipocampo", "amigdala", "mamilares", "tal_anterior", "habenula", "insula", "parahipocampal", "nucleos_base", "osso_parietal", "osso_temporal", "cingulo"]);
const SEM_VOLUME = new Set(["glabela", "nasio", "vertice", "occipital", "ajna", "coroa", "porta", "carotida", "veia",
  "lobo_frontal", "lobo_parietal", "lobo_temporal", "lobo_occipital", "sulco_central", "fissura_lateral", "radiacao", "papez", "fornix", "mamilotalamico"]);
const cacheVol = new Map();
// volume do modelo: total (todas as partes) e de um lado só (para estruturas em par)
function volumeModelo(id) {
  if (cacheVol.has(id)) return cacheVol.get(id);
  const ms = (porId.get(id) || []).filter((m) => m.visible);
  let total = 0, lado = 0;
  const caixa = new THREE.Box3(), caixaLado = new THREE.Box3();
  for (const m of ms) {
    const v = volumeMalha(m);
    total += v;
    m.updateWorldMatrix(true, false);
    const b = new THREE.Box3().setFromObject(m);
    caixa.union(b);
    if (centroDe(m).x > 0.01) { lado += v; caixaLado.union(b); }
  }
  const par = PARES.has(id);
  if (par && lado === 0 && total > 0) { lado = total / 2; caixaLado.copy(caixa); caixaLado.min.x = Math.max(caixa.min.x, 0); } // malha única cruzando a linha do meio
  const tam = (par ? caixaLado : caixa).getSize(new THREE.Vector3());
  // eixos anatômicos: comprimento (frente-trás) = Z da cena, altura = Y, largura = X
  const r = { total, um: par ? lado : total, par, dims: [tam.z, tam.y, tam.x] };
  cacheVol.set(id, r);
  return r;
}
// valores reais de adultos (faixas típicas da literatura; ver LEIAME). cada = valor de um lado só
const VOL_REF = {
  pineal: { lo: 0.05, hi: 0.2, nota: ["≈ uma ervilha pequena; varia muito entre pessoas, sobretudo por causa de cistos.", "≈ a small pea; it varies a lot between people, mostly because of cysts."] },
  hipofise: { lo: 0.3, hi: 0.6, nota: ["≈ um grão-de-bico; costuma ser maior nas mulheres e cresce na gravidez.", "≈ a chickpea; usually larger in women, and it grows during pregnancy."] },
  vent3: { lo: 0.5, hi: 1.0, nota: ["Menos de 1 mL de líquor: umas 10 a 20 gotas.", "Less than 1 mL of CSF: about 10 to 20 drops."] },
  aqueduto: { lo: 0.9, hi: 1.6, nota: ["Valor do 4º ventrículo.", "Value for the 4th ventricle."] },
  ventlat: { lo: 7, hi: 10, cada: true, nota: ["Cada um comporta uns 7 a 10 mL. Crescem com a idade: os dois juntos ganham cerca de 0,5 mL por ano no adulto.", "Each holds about 7 to 10 mL. They grow with age: together they gain about 0.5 mL per year in adults."] },
  olho: { lo: 6.5, hi: 7.0, cada: true, nota: ["Cada olho é quase uma esfera de 2,4 cm.", "Each eye is almost a sphere 2.4 cm across."] },
  talamo: { lo: 5, hi: 7, cada: true, nota: ["Cada tálamo ≈ uma uva grande.", "Each thalamus ≈ a large grape."] },
  cerebelo: { lo: 105, hi: 150, nota: ["≈ uma laranja pequena; costuma ser maior nos homens.", "≈ a small orange; usually larger in men."] },
  hipocampo: { lo: 3, hi: 4.5, cada: true, nota: ["Cada hipocampo ≈ 3 a 4,5 cm³, conforme o método de medida; diminui com a idade.", "Each hippocampus ≈ 3 to 4.5 cm³, depending on how it is measured; it shrinks with age."] },
  amigdala: { lo: 1.1, hi: 1.5, cada: true, nota: ["Cada amígdala ≈ 1,1 a 1,5 cm³: uma amêndoa grande.", "Each amygdala ≈ 1.1 to 1.5 cm³: a large almond."] },
  mamilares: { lo: 0.045, hi: 0.085, cada: true, nota: ["Cada corpo mamilar ≈ 45 a 85 mm³ (média perto de 60): o tamanho de uma lentilha.", "Each mammillary body ≈ 45 to 85 mm³ (average near 60): the size of a lentil."] },
  habenula: { lo: 0.015, hi: 0.03, cada: true, nota: ["Cada habênula ≈ 15 a 30 mm³: bem menor que a pineal ao lado.", "Each habenula ≈ 15 to 30 mm³: much smaller than the pineal next to it."] },
  nsq: { lo: 0.00025, hi: 0.00025, cada: true, nota: ["Cada NSQ tem uns 0,25 mm³, menos que um grão de areia grosso: no modelo ele foi ampliado para aparecer.", "Each SCN is about 0.25 mm³, smaller than a coarse grain of sand: the model enlarges it so you can see it."] },
};
const refDe = (id) => VOL_REF[id === "adeno" || id === "neuro" ? "hipofise" : id];
function numVol(v) {
  const d = v >= 10 ? (v >= 100 ? 0 : 1) : v >= 1 ? 1 : v >= 0.1 ? 2 : 3;
  let s = v.toLocaleString(idioma === "en" ? "en-US" : "pt-BR", { maximumFractionDigits: d, minimumFractionDigits: 0 });
  return s;
}
function fmtVol(v, ref = v) {
  return ref < 0.01 ? `${numVol(v * 1000)} mm³` : `${numVol(v)} cm³`;
}
function fmtFaixa(lo, hi) {
  if (lo === hi) return `≈ ${fmtVol(lo)}`;
  return hi < 0.01 ? `${numVol(lo * 1000)}–${numVol(hi * 1000)} mm³` : `${numVol(lo)}–${numVol(hi)} cm³`;
}
const fmtCm = (x) => NUM(x, x < 1 ? 2 : 1).replace(/([.,]\d*?)0+$/, "$1").replace(/[.,]$/, "");
// volume do modelo para comparar com a referência (hipófise = adeno + neuro)
function volumeComparavel(id) {
  if (id === "adeno" || id === "neuro") return volumeModelo("adeno").total + volumeModelo("neuro").total;
  const vm = volumeModelo(id), ref = refDe(id);
  return ref?.cada ? vm.um : vm.total;
}
function blocoVolume(id) {
  if (SEM_VOLUME.has(id) || !porId.get(id)) return "";
  const vm = volumeModelo(id), ref = refDe(id), hip = id === "adeno" || id === "neuro";
  const linhas = [], real = forma.atual === "anat" && (porId.get(id) || []).some((m) => m.visible && m.userData.v0);
  if (real) {
    if (vm.par) { linhas.push([L("Malha real, cada um", "Real mesh, each"), fmtVol(vm.um)]); linhas.push([L("Malha real, os dois", "Real mesh, both"), fmtVol(vm.total)]); }
    else linhas.push([L("Malha real", "Real mesh"), fmtVol(vm.total)]);
  } else if (hip) {
    linhas.push([L("Esta parte, no modelo", "This part, in the model"), fmtVol(vm.total)]);
    linhas.push([L("Hipófise inteira, no modelo", "Whole pituitary, in the model"), fmtVol(volumeComparavel(id))]);
  } else if (vm.par) {
    linhas.push([L("Modelo, cada um", "Model, each"), fmtVol(vm.um)]);
    linhas.push([L("Modelo, os dois", "Model, both"), fmtVol(vm.total)]);
  } else linhas.push([L("Modelo", "Model"), fmtVol(vm.total)]);
  if (ref) linhas.push([hip ? L("Hipófise real (adulto)", "Real pituitary (adult)") : ref.cada ? L("Real (adulto), cada um", "Real (adult), each")
    : vm.par ? L("Real (adulto), os dois", "Real (adult), both") : L("Real (adulto)", "Real (adult)"), fmtFaixa(ref.lo, ref.hi)]);
  const [c, a, w] = vm.dims;
  linhas.push([vm.par ? L("Tamanho no modelo, cada", "Model size, each") : L("Tamanho no modelo", "Model size"),
    `${fmtCm(c)} × ${fmtCm(a)} × ${fmtCm(w)} cm`]);
  // o modelo é esquemático: diz quanto ele se afasta do valor real típico
  let desvio = "";
  if (ref) {
    const vc = volumeComparavel(id), tip = Math.sqrt(ref.lo * ref.hi);
    if (forma.atual === "anat" && (porId.get(id) || []).some((m) => m.visible && m.userData.v0)) desvio = vc >= ref.lo * 0.95 && vc <= ref.hi * 1.05
      ? L("A malha real (de uma só pessoa) fica dentro da faixa típica.", "The real mesh (from a single person) falls within the typical range.")
      : vc > tip ? L(`A malha real é de uma só pessoa: ela tem cerca de ${fmtRazao(vc / tip)} vezes o volume típico, uma variação entre pessoas ou do método de reconstrução.`, `The real mesh is from a single person: it has about ${fmtRazao(vc / tip)} times the typical volume, a variation between people or of the reconstruction method.`)
      : L(`A malha real é de uma só pessoa: ela tem cerca de ${Math.round((100 * vc) / tip)}% do volume típico, uma variação entre pessoas ou do método de reconstrução.`, `The real mesh is from a single person: it has about ${Math.round((100 * vc) / tip)}% of the typical volume, a variation between people or of the reconstruction method.`);
    else if (vc >= ref.lo * 0.95 && vc <= ref.hi * 1.05) desvio = L("No modelo, o volume fica dentro da faixa real.", "In the model, the volume falls within the real range.");
    else if (vc > tip) desvio = L(`O modelo é esquemático: aqui ele ficou cerca de ${fmtRazao(vc / tip)} vezes maior que o típico.`, `The model is schematic: here it came out about ${fmtRazao(vc / tip)} times larger than typical.`);
    else desvio = L(`O modelo é esquemático: aqui ele ficou com cerca de ${Math.round((100 * vc) / tip)}% do volume típico.`, `The model is schematic: here it came out at about ${Math.round((100 * vc) / tip)}% of the typical volume.`);
  }
  return `<div class="vol"><div class="vol-tit">${L("Volume", "Volume")}</div>` +
    linhas.map(([k, v]) => `<div class="vol-lin"><span>${k}</span><b>${v}</b></div>`).join("") +
    (ref ? `<p class="vol-nota">${L(...ref.nota)} ${desvio}</p>` : "") +
    `<p class="vol-nota">${L("Tamanho: comprimento (frente-trás) × altura × largura.", "Size: length (front-back) × height × width.")}${forma.atual === "anat" && (porId.get(id) || []).some((m) => m.visible && m.userData.v0) ? L(" Forma anatômica: volume medido na malha original do BodyParts3D, antes do encaixe nas coordenadas do modelo.", " Anatomical form: volume measured on the original BodyParts3D mesh, before fitting it to the model's coordinates.") : ""}</p>` +
    `<button type="button" class="b-esfera" data-esfera="${id}">${esfera.id === id ? L("Esconder esfera de mesmo volume", "Hide equal-volume sphere") : L("Mostrar esfera de mesmo volume", "Show equal-volume sphere")}</button></div>`;
}

// ---------- esfera equivalente: mesmo volume, d = ∛(6V/π), posta ao lado da estrutura
const esfera = { id: null, malha: null, rot: null, rotFn: null };
esfera.rot = rotulo("", new THREE.Vector3(), "#F2B24A", "regua", -1, "medida");
esfera.rot.ativo = false;
function removerEsfera() {
  if (esfera.malha) { grupos.regua.remove(esfera.malha); esfera.malha.geometry.dispose(); esfera.malha = null; }
  esfera.id = null; esfera.rot.ativo = false; esfera.rotFn = null;
}
function mostrarEsfera(id) {
  removerEsfera();
  const vm = volumeModelo(id);
  const V = id === "adeno" || id === "neuro" ? vm.total : vm.um;
  const d = Math.cbrt((6 * V) / Math.PI), r = d / 2;
  const ms = (porId.get(id) || []).filter((m) => m.visible && (!vm.par || centroDe(m).x > 0.01));
  const caixa = new THREE.Box3();
  for (const m of ms) caixa.union(new THREE.Box3().setFromObject(m));
  const centro = caixa.getCenter(new THREE.Vector3()), raioEst = caixa.getSize(new THREE.Vector3()).length() / 2;
  const direita = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  const g = new THREE.Group();
  const bola = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 24), new THREE.MeshStandardMaterial({ color: 0xf2b24a, transparent: true, opacity: 0.35, emissive: 0xf2b24a, emissiveIntensity: 0.25, depthWrite: false }));
  const fio = new THREE.Mesh(bola.geometry, new THREE.MeshBasicMaterial({ color: 0xffd27a, wireframe: true, transparent: true, opacity: 0.25 }));
  g.add(bola, fio);
  g.position.copy(centro).addScaledVector(direita, raioEst + r + 0.3);
  g.geometry = bola.geometry; // para removerEsfera
  g.renderOrder = 40;
  grupos.regua.add(g);
  esfera.malha = g; esfera.id = id;
  esfera.rotFn = () => `${L("mesmo volume", "same volume")} · d = ${fmtCm(d)} cm`;
  esfera.rot.pos.copy(g.position).add(new THREE.Vector3(0, r + 0.15, 0));
  esfera.rot.el.innerHTML = `<i style="background:#F2B24A"></i>${esfera.rotFn()}`; esfera.rot.w = 0; esfera.rot.ativo = true;
  const alvo = centro.clone().lerp(g.position, 0.5), dist = Math.min(Math.max((raioEst * 2 + d) * 3.2, 5), 45);
  const dir = camera.position.clone().sub(controls.target).normalize();
  if (!card.hidden) alvo.y += folgaCartao(dist);
  voar(alvo.clone().addScaledVector(dir, dist), alvo);
}
function infoDe(id) {
  const d = INFO[id];
  if (!d) return null;
  const e = idioma === "en" && INFO_EN[id];
  return e ? [e[0], d[1], e[1], e[2]] : d;
}
const infoEl = $("info");
let infoRender = null; // função que redesenha o painel (para trocar de idioma sem perder o conteúdo)
function setInfo(fn) { infoRender = fn; fn(); }
function mostrar(id, extraHTML = "") {
  if (!INFO[id]) return;
  setInfo(() => {
    const [t, cor, p, itens] = infoDe(id);
    infoEl.innerHTML = `<h3><i style="background:${cor}"></i>${t}</h3><p>${p}</p>` +
      (itens.length ? `<ul>${itens.map((x) => `<li>${x}</li>`).join("")}</ul>` : "") + extraHTML + blocoVolume(id);
  });
}
infoEl.addEventListener("click", (e) => {
  const b = e.target.closest("[data-esfera]");
  if (!b) return;
  const id = b.dataset.esfera;
  if (esfera.id === id) removerEsfera(); else mostrarEsfera(id);
  if (infoRender) infoRender();
});
mostrar("pineal");

// =====================================================================  DESTAQUE
const destaque = { ids: new Set(), pulsar: false };
const matHalo = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
const halos = [];
function criarHalo(m) {
  if (!m.geometry) return;
  let h;
  if (m.userData.curve) {
    h = new THREE.Mesh(new THREE.TubeGeometry(m.userData.curve, 80, m.userData.raio * 1.9 + 0.08, 12, false), matHalo);
  } else {
    m.geometry.computeBoundingSphere();
    const s = m.userData.id === "pineal" || m.geometry.boundingSphere.radius * Math.max(m.scale.x, m.scale.y, m.scale.z) < 0.5 ? 1.8 : 1.18;
    h = new THREE.Mesh(m.geometry, matHalo);
    h.scale.setScalar(s);
    h.position.copy(m.geometry.boundingSphere.center).multiplyScalar(1 - s);
  }
  h.renderOrder = 60;
  m.add(h);
  halos.push(h);
}
function limparHalos() {
  for (const h of halos) { h.parent?.remove(h); if (h.geometry.type === "TubeGeometry") h.geometry.dispose(); }
  halos.length = 0;
}
const marcadores = [];
function marcador(i) {
  if (!marcadores[i]) {
    const el = document.createElement("div");
    el.className = "alvo"; el.innerHTML = "<span></span><span></span>";
    stage.appendChild(el); marcadores[i] = el;
  }
  return marcadores[i];
}
function centroDe(m) {
  if (m.userData.centro) return m.userData.centro.clone();
  m.geometry.computeBoundingSphere();
  return m.geometry.boundingSphere.center.clone().applyMatrix4(m.matrixWorld);
}
function posicionarMarcadores() {
  const W = stage.clientWidth, H = stage.clientHeight;
  let i = 0;
  if (destaque.pulsar) {
    for (const id of destaque.ids) {
      const m = (porId.get(id) || []).find((x) => { let o = x; while (o) { if (!o.visible) return false; o = o.parent; } return true; });
      if (!m) continue;
      tmpV.copy(centroDe(m)).project(camera);
      if (tmpV.z > 1) continue;
      const el = marcador(i++);
      el.style.display = "block";
      el.style.transform = `translate(${((tmpV.x * 0.5 + 0.5) * W).toFixed(1)}px, ${((-tmpV.y * 0.5 + 0.5) * H).toFixed(1)}px)`;
    }
  }
  for (; i < marcadores.length; i++) marcadores[i].style.display = "none";
}
function guardar(m) {
  if (!m.userData.em0) { m.userData.em0 = m.material.emissive.clone(); m.userData.ei0 = m.material.emissiveIntensity; }
}
function restaurarDestaque() {
  for (const id of destaque.ids) for (const m of porId.get(id) || []) {
    if (m === pineal || !m.material.emissive || !m.userData.em0) continue;
    m.material.emissive.copy(m.userData.em0); m.material.emissiveIntensity = m.userData.ei0;
  }
  destaque.ids.clear();
  limparHalos();
}
function destacar(ids, pulsar = false) {
  restaurarDestaque();
  destaque.pulsar = pulsar;
  for (const id of ids) {
    destaque.ids.add(id);
    for (const m of porId.get(id) || []) {
      if (m === pineal || !m.material.emissive) continue;
      guardar(m);
      m.material.emissive.set(pulsar ? 0xffc46b : 0xffffff);
      m.material.emissiveIntensity = 0.35;
    }
    if (pulsar) for (const m of porId.get(id) || []) criarHalo(m);
  }
}

// =====================================================================  RELÓGIO
const k = Math.log(2) / 0.75;
const ROTINAS = { escura: { telas: false, atraso: 0 }, telas1: { telas: true, atraso: 0 }, telas14: { telas: true, atraso: 2.8 } };
function lux(h, telas) {
  if (h >= 7 && h < 18) return 1000;
  if (telas && (h >= 18 || h < 1)) return 150;
  if (h >= 18 && h < 23) return 30;
  return 0;
}
function janela(h, atraso = 0) {
  const x = (h < 12 ? h + 24 : h) - atraso;
  return 1 / (1 + Math.exp(-(x - 21.2) / 0.5)) / (1 + Math.exp((x - 31.4) / 0.5));
}
function supressao(L) { return Math.pow(L, 1.2) / (Math.pow(L, 1.2) + Math.pow(100, 1.2)); }
function curvaMel(r) {
  const dt = 1 / 60, n = 48 * 60, out = new Float32Array(24 * 60);
  let m = 0;
  for (let i = 0; i < n; i++) {
    const h = (12 + i * dt) % 24;
    m += dt * (60 * janela(h, r.atraso) * (1 - supressao(lux(h, r.telas))) - k * m);
    if (i >= 24 * 60) out[i - 24 * 60] = m;
  }
  return out;
}
const MEL = Object.fromEntries(Object.entries(ROTINAS).map(([n, r]) => [n, curvaMel(r)]));
const MAXM = Math.max(...MEL.escura);
const idxHora = (h) => Math.round(((h - 12 + 24) % 24) * 60) % (24 * 60);

const estado = { hora: 23, tocando: !reduz, rotina: "escura", tour: -1, quiz: false, embriao: false, regua: false, corte: "nenhum", kura: false, jet: false, tam: false };
const slider = $("slider"), horaEl = $("hora"), faseEl = $("fase"), statusEl = $("status"), playBtn = $("play"), rotinaEl = $("rotina");
function setTocando(v) {
  estado.tocando = v;
  playBtn.setAttribute("aria-pressed", String(v));
  playBtn.textContent = v ? L("Pausar", "Pause") : L("Reproduzir", "Play");
}
setTocando(estado.tocando);
playBtn.addEventListener("click", () => setTocando(!estado.tocando));
slider.addEventListener("input", () => { estado.hora = parseFloat(slider.value); atualizarTexto(); });
rotinaEl.addEventListener("change", () => { estado.rotina = rotinaEl.value; atualizarTexto(); });
function setHora(h) { estado.hora = h; slider.value = h.toFixed(2); atualizarTexto(); }

function atualizarTexto() {
  const h = estado.hora % 24;
  const hh = Math.floor(h), mm = Math.floor((h % 1) * 60);
  horaEl.textContent = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  const r = ROTINAS[estado.rotina];
  const lx = lux(h, r.telas), j = janela(h, r.atraso);
  let fase, cls, txt;
  if (lx >= 1000) {
    fase = L("Dia", "Day"); cls = "dia";
    txt = j > 0.5 ? L("O despertador tocou com o relógio atrasado: a luz forte corta a melatonina que ainda estava alta.", "The alarm went off with the clock running late: bright light cuts the melatonin that was still high.")
      : L("Luz forte na retina. O NSQ mantém o circuito freado e a pineal quase parada.", "Bright light on the retina. The SCN keeps the circuit braked and the pineal almost idle.");
  } else if (j < 0.5 && lx > 0) { fase = L("Entardecer", "Evening"); cls = "tarde"; txt = L("Ainda há luz e o relógio não abriu a janela da melatonina.", "There is still light and the clock has not opened the melatonin window yet."); }
  else if (j < 0.5) { fase = L("Madrugada", "Small hours"); cls = "noite"; txt = L("Fora da noite interna: a janela da melatonina está fechada.", "Outside the internal night: the melatonin window is closed."); }
  else if (lx >= 150) { fase = L("Noite com telas", "Night with screens"); cls = "tarde"; txt = L("A luz das telas chega ao NSQ e corta boa parte da melatonina, mesmo com a janela aberta.", "Screen light reaches the SCN and cuts much of the melatonin, even with the window open."); }
  else if (lx > 0) { fase = L("Noite", "Night"); cls = "noite"; txt = L("Luz baixa: a janela abriu e a melatonina começa a subir.", "Dim light: the window has opened and melatonin starts to rise."); }
  else { fase = L("Noite", "Night"); cls = "noite"; txt = L("Escuro: o sinal desce pela medula, sobe pelo pescoço e a pineal libera melatonina.", "Darkness: the signal runs down the spinal cord, up through the neck, and the pineal releases melatonin."); }
  if (estado.rotina === "telas14") txt += L(" Após 2 semanas assim, o relógio atrasou cerca de 2,8 h.", " After 2 weeks like this, the clock has shifted about 2.8 h later.");
  faseEl.textContent = fase;
  faseEl.className = `pill ${cls}`;
  statusEl.textContent = txt;
  desenharSpark();
}
// O gráfico separado só da melatonina foi retirado: a mesma curva está no painel de ritmos, que também mostra o valor.
function desenharSpark() { if (ritmosPronto) desenharRitmos(); }
let ritmosPronto = false;

// ---------- painel: ritmos do dia inteiro (todos deslocados pelo atraso da rotina)
const SONO = { escura: [23, 7], telas1: [1, 7], telas14: [1, 7] };
function relPico(h, pico) { return ((h - pico + 36) % 24) - 12; }
function cortisol(h, a) { // µg/dL: mínimo perto da meia-noite, pico logo depois de acordar
  const x = relPico(h - a, 8.2);
  return x < 0 ? 3 + 17 * Math.exp(-((x / 2.3) ** 2)) : 3 + 17 * (Math.exp(-x / 5.5) - (Math.exp(-12 / 5.5) * x) / 12);
}
function temperatura(h, a) { // °C: mínimo de madrugada (~5h), máximo no fim da tarde (~17h)
  const f = (2 * Math.PI * (h - 17 - a)) / 24;
  return 36.8 + 0.42 * Math.cos(f) + 0.07 * Math.cos(2 * f + 0.6);
}
function curvaSono(rotina) { // pressão do sono: sobe acordado, cai dormindo, menos o alerta circadiano
  const [dorme, acorda] = SONO[rotina], a = ROTINAS[rotina].atraso;
  const dormindo = (h) => (dorme > acorda ? h >= dorme || h < acorda : h >= dorme && h < acorda);
  const out = new Float32Array(24 * 60);
  let S = 0.3;
  for (let i = 0; i < 72 * 60; i++) {
    const h = (12 + i / 60) % 24;
    S += (dormindo(h) ? -S / 4.2 : (1 - S) / 18) / 60;
    if (i >= 48 * 60) out[i - 48 * 60] = S - 0.3 * Math.cos((2 * Math.PI * (h - 17 - a)) / 24);
  }
  let mn = Infinity, mx = -Infinity;
  for (const v of out) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - mn) / (mx - mn);
  return out;
}
const SONOC = Object.fromEntries(Object.keys(ROTINAS).map((r) => [r, curvaSono(r)]));
const RITMOS = [
  { nome: ["Melatonina", "Melatonin"], cor: "#F2B24A", norm: (h) => MEL[estado.rotina][idxHora(h)] / MAXM, txt: (h) => `${Math.round((MEL[estado.rotina][idxHora(h)] / MAXM) * 100)}%` },
  { nome: ["Cortisol", "Cortisol"], cor: "#F07F5A", norm: (h) => (cortisol(h, ROTINAS[estado.rotina].atraso) - 2) / 18, txt: (h) => `${cortisol(h, ROTINAS[estado.rotina].atraso).toFixed(0)} µg/dL` },
  { nome: ["Temperatura", "Temperature"], cor: "#5EA6F2", norm: (h) => (temperatura(h, ROTINAS[estado.rotina].atraso) - 36.25) / 1.1, txt: (h) => `${NUM(temperatura(h, ROTINAS[estado.rotina].atraso), 1)} °C` },
  { nome: ["Pressão do sono", "Sleep pressure"], cor: "#A39BF2", norm: (h) => SONOC[estado.rotina][idxHora(h)], txt: (h) => `${Math.round(SONOC[estado.rotina][idxHora(h)] * 100)}%` },
];
const ritmosEl = $("ritmos"), ritmosLeg = $("ritmos-leg");
ritmosPronto = true;
function desenharRitmos() {
  const dpr = Math.min(window.devicePixelRatio, 2);
  const w = ritmosEl.clientWidth, h = ritmosEl.clientHeight;
  if (!w) return;
  if (ritmosEl.width !== Math.round(w * dpr)) { ritmosEl.width = Math.round(w * dpr); ritmosEl.height = Math.round(h * dpr); }
  const c = ritmosEl.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
  const pad = 6, base = h - 18, X = (hr) => pad + (((hr - 12 + 24) % 24) / 24) * (w - 2 * pad), Y = (v) => base - Math.min(Math.max(v, 0), 1) * (base - 8);
  const [dorme, acorda] = SONO[estado.rotina];
  c.fillStyle = "rgba(163,155,242,0.10)";
  c.fillRect(X(dorme), 0, X(acorda) - X(dorme), base);
  c.fillStyle = "#98A4B8"; c.font = "11px 'IBM Plex Sans', sans-serif"; c.textAlign = "center";
  ["12h", "18h", "0h", "6h", "12h"].forEach((t, i) => c.fillText(t, Math.min(Math.max(pad + (i / 4) * (w - 2 * pad), 12), w - 12), h - 4));
  if (estado.rotina !== "escura") { // tracejado: melatonina na noite escura, para comparar com a rotina escolhida
    c.beginPath();
    for (let i = 0; i <= 288; i++) { const hr = (12 + i / 12) % 24, x = pad + (i / 288) * (w - 2 * pad), y = Y(MEL.escura[idxHora(hr)] / MAXM); i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.strokeStyle = "rgba(242,178,74,0.55)"; c.lineWidth = 1.5; c.setLineDash([5, 4]); c.stroke(); c.setLineDash([]);
  }
  for (const r of RITMOS) {
    c.beginPath();
    for (let i = 0; i <= 288; i++) { const hr = (12 + i / 12) % 24, x = pad + (i / 288) * (w - 2 * pad), y = Y(r.norm(hr)); i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.strokeStyle = r.cor; c.lineWidth = 1.8; c.stroke();
  }
  const hx = X(estado.hora % 24);
  c.strokeStyle = "#E6EBF2"; c.lineWidth = 1.1; c.beginPath(); c.moveTo(hx, 2); c.lineTo(hx, base); c.stroke();
  for (const r of RITMOS) { c.fillStyle = r.cor; c.beginPath(); c.arc(hx, Y(r.norm(estado.hora % 24)), 3, 0, Math.PI * 2); c.fill(); }
  ritmosLeg.innerHTML = RITMOS.map((r) => `<span><i style="background:${r.cor}"></i>${L(...r.nome)}<b>${r.txt(estado.hora % 24)}</b></span>`).join("");
}

// =====================================================================  SOM (Web Audio + voz pt-BR; nada de arquivos)
const som = { ctx: null, master: null, ligado: false, limites: {}, vozes: new Set(), seqFala: 0, proxBatida: 0, proxEmb: 0, proxNota: 0, proxGrilo: 0, proxPassaro: 0, sequencia: 0 };
const volEl = $("som-vol"), botaoSom = $("b-som"), somTxt = $("som-txt");
const opc = {};
const OPCOES = { "s-clique": ["g-efeitos", "clique"], "s-circ": ["g-efeitos", "circ"], "s-emb": ["g-efeitos", "emb"],
  "s-nomes": ["g-voz", "nomes"], "s-tour": ["g-voz", "tour"], "s-auto": ["g-voz", "auto"],
  "s-dia": ["g-amb", "dia"], "s-liq": ["g-amb", "liq"], "s-mel": ["g-amb", "mel"] };
const CATEGORIA = { clique: "clique", circ: "circ", emb: "emb", dia: "amb", liq: "liq", mel: "mel" };
function lerOpcoes() {
  const antes = { ...opc };
  for (const [id, [grupo, chave]] of Object.entries(OPCOES)) opc[chave] = $(grupo).checked && $(id).checked;
  for (const [chave, cat] of Object.entries(CATEGORIA)) if (antes[chave] && !opc[chave]) cortar(cat);
  for (const g of ["g-efeitos", "g-voz", "g-amb"]) $(g).closest("fieldset").classList.toggle("desligado", !$(g).checked);
  if (!(opc.nomes || opc.tour)) calar();
}
for (const id of [...Object.keys(OPCOES), "g-efeitos", "g-voz", "g-amb"]) {
  $(id).addEventListener("change", (e) => {
    lerOpcoes();
    // marcar uma opção de som com o som desligado já liga o som (o clique conta como gesto do usuário)
    if (e.target.checked && !som.ligado) setSom(true);
  });
}
lerOpcoes();

function iniciarAudio() {
  if (som.ctx) { som.ctx.resume(); return true; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { somTxt.textContent = L("Este navegador não tem Web Audio; só a voz pode funcionar.", "This browser has no Web Audio; only the voice may work."); return false; }
  const ctx = som.ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 4;
  som.master = ctx.createGain();
  som.master.gain.value = parseFloat(volEl.value);
  som.master.connect(comp); comp.connect(ctx.destination);
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  som.ruido = buf;
  som.brisa = loopRuido("lowpass", 500, 0.7);
  som.fluxo = loopRuido("bandpass", 320, 1.4);
  som.zumbido = osciladorContinuo("sawtooth", 120, ["lowpass", 380]);
  // reverberação curta (resposta ao impulso gerada: ruído que decai em ~2,4 s)
  som.reverb = ctx.createConvolver();
  const dur = 2.4, n = Math.floor(ctx.sampleRate * dur), ir = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const ch = ir.getChannelData(c); for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3); }
  som.reverb.buffer = ir;
  som.envioRev = ctx.createGain(); som.envioRev.gain.value = 0.45;
  som.saidaRev = ctx.createGain(); som.saidaRev.gain.value = 1;
  som.envioRev.connect(som.reverb); som.reverb.connect(som.saidaRev); som.saidaRev.connect(som.master);
  // fundo da melodia: ré e lá graves, bem baixos e abafados
  som.fundoA = osciladorContinuo("sine", 146.83, ["lowpass", 500]);
  som.fundoB = osciladorContinuo("sine", 220.0, ["lowpass", 500]);
  som.pad = osciladorContinuo("sine", 196, ["lowpass", 1200]);
  som.pad2 = osciladorContinuo("sine", 294, ["lowpass", 1200]);
  return true;
}
function loopRuido(tipo, freq, q) {
  const ctx = som.ctx, src = ctx.createBufferSource();
  src.buffer = som.ruido; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = tipo; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.value = 0;
  src.connect(f).connect(g).connect(som.master); src.start();
  return { g, f };
}
function osciladorContinuo(tipo, freq, filtro) {
  const ctx = som.ctx, o = ctx.createOscillator();
  o.type = tipo; o.frequency.value = freq;
  const f = ctx.createBiquadFilter(); f.type = filtro[0]; f.frequency.value = filtro[1];
  const g = ctx.createGain(); g.gain.value = 0;
  o.connect(f).connect(g).connect(som.master); o.start();
  return { o, g, f };
}
const podeTocar = () => som.ligado && som.ctx && som.ctx.state === "running";
function limite(chave, porSeg) {
  const t = performance.now();
  if (som.limites[chave] && t - som.limites[chave] < 1000 / porSeg) return false;
  som.limites[chave] = t; return true;
}
function alvo(param, valor, tempo = 0.4) { if (som.ctx) param.setTargetAtTime(valor, som.ctx.currentTime, valor === 0 ? Math.min(tempo, 0.08) : tempo); }
function registrarVoz(fonte, g, cat) {
  const v = { fonte, g, cat };
  som.vozes.add(v);
  fonte.onended = () => som.vozes.delete(v);
}
function cortar(cat) {
  if (!som.ctx) return;
  const t = som.ctx.currentTime;
  for (const v of som.vozes) {
    if (cat !== "tudo" && v.cat !== cat) continue;
    try { v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0, t, 0.02); v.fonte.stop(t + 0.12); } catch (e) { /* já parou */ }
    som.vozes.delete(v);
  }
  if ((cat === "mel" || cat === "tudo") && som.saidaRev) {
    som.saidaRev.gain.cancelScheduledValues(t);
    som.saidaRev.gain.setTargetAtTime(0, t, 0.03);
    som.saidaRev.gain.setTargetAtTime(1, t + 2.6, 0.05);
  }
}
function tom(f, { tipo = "sine", vol = 0.15, ataque = 0.005, queda = 0.25, quando = 0, f2 = null, filtro = null, rev = false, cat = "clique" } = {}) {
  if (!podeTocar()) return;
  const ctx = som.ctx, t = ctx.currentTime + quando;
  const o = ctx.createOscillator(); o.type = tipo; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + ataque + queda);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + ataque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + ataque + queda);
  let n = o;
  if (filtro) { const fl = ctx.createBiquadFilter(); fl.type = filtro[0]; fl.frequency.value = filtro[1]; fl.Q.value = filtro[2] ?? 1; o.connect(fl); n = fl; }
  n.connect(g).connect(som.master);
  if (rev && som.envioRev) g.connect(som.envioRev);
  o.start(t); o.stop(t + ataque + queda + 0.05);
  registrarVoz(o, g, cat);
}
function estalo(freq = 1200, vol = 0.1, dur = 0.01, quando = 0, cat = "clique") {
  if (!podeTocar()) return;
  const ctx = som.ctx, t = ctx.currentTime + quando, src = ctx.createBufferSource();
  src.buffer = som.ruido;
  const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq; f.Q.value = 2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(som.master);
  src.start(t, Math.random() * 1.5, dur + 0.02);
  registrarVoz(src, g, cat);
}

// ---------- 1. timbre de cada família ao clicar
const FAMILIA = { pineal: "glandula", adeno: "glandula", neuro: "glandula", hipotalamo: "glandula", nsq: "glandula", npv: "glandula",
  vent3: "vent", ventlat: "vent", aqueduto: "vent", quiasma: "nervo", tronco: "nervo", medula: "nervo", gcs: "nervo", caloso: "nervo",
  talamo: "nervo", cerebelo: "nervo", carotida: "vaso", veia: "vaso", cavernoso: "vaso", porta: "vaso", glabela: "face", nasio: "face",
  piramide: "face", olho: "face", seiofrontal: "face", esfenoidal: "face", vertice: "face", occipital: "face", ajna: "simb", coroa: "simb",
  lobo_frontal: "nervo", lobo_parietal: "nervo", lobo_temporal: "nervo", lobo_occipital: "nervo", sulco_central: "nervo", fissura_lateral: "nervo",
  cgl: "nervo", radiacao: "nervo", v1: "nervo", hipocampo: "nervo", amigdala: "nervo", fornix: "nervo", mamilares: "nervo",
  mamilotalamico: "nervo", tal_anterior: "nervo", cingulo: "nervo", papez: "nervo", habenula: "glandula", insula: "nervo", parahipocampal: "nervo",
  nucleos_base: "nervo", osso_frontal: "face", osso_parietal: "face", osso_occipital: "face", osso_temporal: "face", osso_esfenoide: "face", osso_etmoide: "face", face_ossos: "face", mandibula: "face" };
function somEstrutura(id) {
  if (!opc.clique) return;
  switch (FAMILIA[id]) {
    case "glandula": tom(660, { queda: 0.9, vol: 0.12 }); tom(660 * 2.76, { queda: 0.35, vol: 0.035 }); tom(990, { queda: 0.7, vol: 0.05, quando: 0.06 }); break;
    case "vent": tom(420, { f2: 900, queda: 0.16, vol: 0.12, filtro: ["lowpass", 1500] }); tom(520, { f2: 1150, queda: 0.13, vol: 0.08, quando: 0.09, filtro: ["lowpass", 1600] }); break;
    case "nervo": tom(330, { tipo: "triangle", queda: 0.35, vol: 0.16 }); estalo(1800, 0.05); break;
    case "vaso": tom(140, { f2: 70, queda: 0.35, vol: 0.25 }); tom(90, { queda: 0.4, vol: 0.12, quando: 0.12 }); break;
    case "face": tom(880, { tipo: "square", queda: 0.08, vol: 0.05, filtro: ["bandpass", 1200, 4] }); tom(587, { tipo: "square", queda: 0.1, vol: 0.04, quando: 0.07, filtro: ["bandpass", 900, 4] }); break;
    case "simb": tom(784, { queda: 1.6, vol: 0.07 }); tom(1175, { queda: 1.8, vol: 0.05, quando: 0.15 }); break;
    default: tom(600, { queda: 0.2, vol: 0.08 });
  }
}

// ---------- voz
let vozPt = null, vozEn = null;
const vozAtual = () => (idioma === "en" ? vozEn : vozPt);
function escolherVoz() {
  if (!("speechSynthesis" in window)) return;
  const vs = speechSynthesis.getVoices();
  const br = vs.filter((v) => /^pt[-_]BR/i.test(v.lang));
  vozPt = br.find((v) => /natural|online/i.test(v.name)) || br.find((v) => /francisca|antonio|thalita|google/i.test(v.name)) || br[0] || vs.find((v) => /^pt/i.test(v.lang)) || null;
  const us = vs.filter((v) => /^en[-_](US|GB)/i.test(v.lang));
  vozEn = us.find((v) => /natural|online/i.test(v.name)) || us.find((v) => /aria|jenny|guy|google/i.test(v.name)) || us[0] || vs.find((v) => /^en/i.test(v.lang)) || null;
  atualizarTextoSom();
}
if ("speechSynthesis" in window) { escolherVoz(); speechSynthesis.addEventListener?.("voiceschanged", escolherVoz); }
function paraFala(txt) {
  if (idioma === "en") {
    return txt.replace(/<[^>]+>/g, "").replace(/→/g, " to ").replace(/\bSCN\b/g, "S C N").replace(/\bPVN\b/g, "P V N").replace(/\bCSF\b/g, "C S F")
      .replace(/T1–T2/g, "T1 to T2").replace(/(\d)\s?cm\b/g, "$1 centimeters").replace(/~/g, "about ").replace(/^\d+\.\s*/, "")
      .replace(/[“”"]/g, "");
  }
  return txt.replace(/<[^>]+>/g, "").replace(/→/g, " para ").replace(/\bNSQ\b/g, "N S Q").replace(/\bNPV\b/g, "N P V")
    .replace(/T1–T2/g, "T1 a T2").replace(/(\d)\s?cm\b/g, "$1 centímetros").replace(/~/g, "cerca de ").replace(/^\d+\.\s*/, "")
    .replace(/[“”"]/g, "");
}
function falar(txt, aoTerminar) {
  if (!som.ligado || !("speechSynthesis" in window)) return false;
  speechSynthesis.cancel();
  const seq = ++som.seqFala;
  const partes = paraFala(txt).split(/(?<=[.!?:])\s+/).filter((p) => p.trim());
  partes.forEach((p, i) => {
    const u = new SpeechSynthesisUtterance(p);
    u.lang = idioma === "en" ? "en-US" : "pt-BR"; if (vozAtual()) u.voice = vozAtual();
    u.rate = 1.02; u.volume = Math.min(1, parseFloat(volEl.value) * 1.4 + 0.1);
    if (i === partes.length - 1 && aoTerminar) {
      u.onend = () => { if (seq === som.seqFala) aoTerminar(false); };
      u.onerror = (e) => { if (seq === som.seqFala && e.error !== "interrupted" && e.error !== "canceled") { som.seqFala++; aoTerminar(true); } };
    }
    speechSynthesis.speak(u);
  });
  return true;
}
function calar() { som.seqFala++; if ("speechSynthesis" in window) speechSynthesis.cancel(); }
function atualizarTextoSom() {
  if (!som.ligado) { somTxt.textContent = L("O som começa desligado: os navegadores só tocam áudio depois de um clique.", "Sound starts off: browsers only play audio after a click."); return; }
  const vz = vozAtual();
  const v = !("speechSynthesis" in window) ? L("este navegador não tem síntese de voz", "this browser has no speech synthesis")
    : vz ? `${L("voz", "voice")}: ${vz.name}` : L("nenhuma voz em português instalada; a fala usa a voz padrão", "no English voice installed; speech uses the default voice");
  somTxt.textContent = `${L("Som ligado", "Sound on")} (${v}).`;
}

// ---------- 3. quiz
function somAcerto() { if (!opc.clique) return; [523, 659, 784].forEach((f, i) => tom(f, { queda: 0.25, vol: 0.11, quando: i * 0.08 })); }
function somErro() { if (!opc.clique) return; tom(330, { tipo: "triangle", queda: 0.2, vol: 0.12 }); tom(247, { tipo: "triangle", queda: 0.35, vol: 0.12, quando: 0.16 }); }
function fanfarra() { if (!opc.clique) return; [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tom(f, { tipo: i > 3 ? "triangle" : "sine", queda: i === 5 ? 0.6 : 0.16, vol: 0.1, quando: 0.35 + i * 0.1 })); }

// ---------- 4. circuito audível
function pingLuz() { if (opc.circ && limite("luz", 5)) tom(2000 + Math.random() * 600, { queda: 0.08, vol: 0.02, cat: "circ" }); }
function espiga() { if (opc.circ && limite("nervo", 7)) { estalo(1300, 0.09, 0.008, 0, "circ"); tom(160, { queda: 0.05, vol: 0.05, cat: "circ" }); } }
function gota() {
  if (!opc.circ || !limite("gota", 4)) return;
  const f = 1500 + Math.random() * 500;
  tom(f, { f2: f * 0.3, queda: 0.045, vol: 0.03, filtro: ["bandpass", 1200, 2], cat: "circ" });
  estalo(2500, 0.02, 0.006, 0, "circ");
}

// ---------- 8. régua sonora (escala maior: perto = agudo, longe = grave)
const MAIOR = [0, 2, 4, 5, 7, 9, 11];
function notaDaDistancia(d) {
  const passos = Math.round(14 - 21 * Math.log(Math.max(d, 0.3) / 0.3) / Math.log(100));
  const oit = Math.floor(passos / 7), grau = ((passos % 7) + 7) % 7;
  return 440 * Math.pow(2, (12 * oit + MAIOR[grau]) / 12);
}
function somRegua(d) {
  if (!opc.clique) return;
  if (d === undefined) { tom(1400, { queda: 0.06, vol: 0.06 }); return; }
  const f = notaDaDistancia(d);
  tom(f, { queda: 1.2, vol: 0.12 }); tom(f * 2, { queda: 0.5, vol: 0.03 }); tom(f * 1.5, { queda: 0.9, vol: 0.04, quando: 0.18 });
}

// ---------- 5, 6, 7, 9: sons contínuos, atualizados a cada quadro
function atualizarSom(L, m) {
  if (!som.ctx) return;
  const ctx = som.ctx, agora = ctx.currentTime;
  if (agora - (som.ultimaAtualizacao || 0) < 0.08) return;
  som.ultimaAtualizacao = agora;
  const ativo = podeTocar();
  // 5. ambiente dia/noite
  const dia = ativo && opc.dia && !estado.embriao;
  alvo(som.brisa.g.gain, dia ? (L >= 1000 ? 0.05 : L > 0 ? 0.022 : 0.006) : 0, 0.8);
  som.brisa.f.frequency.setTargetAtTime(420 + 220 * Math.sin(agora / 3), agora, 0.5);
  alvo(som.zumbido.g.gain, dia && L > 100 && L < 1000 ? 0.012 : 0, 0.6);
  if (dia && L === 0 && agora > som.proxGrilo) {
    const f0 = 4300 + Math.random() * 400;
    for (let i = 0; i < 3; i++) tom(f0, { queda: 0.025, vol: 0.016, quando: i * 0.055, cat: "amb" });
    som.proxGrilo = agora + 0.55 + Math.random() * 0.6;
  }
  if (dia && L >= 1000 && agora > som.proxPassaro) {
    const n = 2 + Math.floor(Math.random() * 3), base = 2300 + Math.random() * 900;
    for (let i = 0; i < n; i++) tom(base, { f2: base * 1.5, queda: 0.09, vol: 0.022, quando: i * 0.13, cat: "amb" });
    som.proxPassaro = agora + 2.5 + Math.random() * 4.5;
  }
  // 6. líquor pulsando no ritmo do coração (72 bpm)
  const liq = ativo && opc.liq && grupos.liquor.visible && !estado.embriao;
  if (!liq) { if (som.proxBatida) { som.fluxo.g.gain.cancelScheduledValues(agora); cortar("liq"); } alvo(som.fluxo.g.gain, 0, 0.08); som.proxBatida = 0; }
  else {
    if (som.proxBatida < agora) som.proxBatida = agora + 0.05;
    while (som.proxBatida < agora + 0.25) {
      const t = som.proxBatida, g = som.fluxo.g.gain;
      g.setTargetAtTime(0.07, t, 0.03); g.setTargetAtTime(0.018, t + 0.12, 0.12);
      g.setTargetAtTime(0.045, t + 0.3, 0.03); g.setTargetAtTime(0.018, t + 0.42, 0.15);
      tom(58, { queda: 0.18, vol: 0.16, quando: t - agora, cat: "liq" }); tom(48, { queda: 0.15, vol: 0.09, quando: t - agora + 0.3, cat: "liq" });
      som.proxBatida += 60 / 72;
    }
  }
  // 7. melodia da melatonina: notas soltas de caixinha de música (pentatônica de ré),
  //    mais frequentes e um pouco mais agudas quanto mais melatonina; quase silêncio de dia
  const mel = ativo && opc.mel && !estado.embriao;
  alvo(som.fundoA.g.gain, mel ? 0.006 * m : 0, 1.5);
  alvo(som.fundoB.g.gain, mel ? 0.004 * m : 0, 1.5);
  if (mel && m > 0.04) {
    if (som.proxNota < agora) som.proxNota = agora + 0.3;
    while (som.proxNota < agora + 0.25) {
      notaMelodia(som.proxNota - agora, m);
      som.proxNota += 3.2 - 1.8 * m + Math.random() * 0.9;
    }
  } else som.proxNota = 0;
  // 9. embrião: tom que sobe com as semanas e o coração que começa a bater (~4ª semana)
  const embr = ativo && opc.emb && estado.embriao;
  const fp = 196 * Math.pow(2, emb.u * 1.2);
  som.pad.o.frequency.setTargetAtTime(fp, agora, 0.2);
  som.pad2.o.frequency.setTargetAtTime(fp * 1.5, agora, 0.2);
  alvo(som.pad.g.gain, embr ? 0.035 : 0, 0.4);
  alvo(som.pad2.g.gain, embr ? 0.018 : 0, 0.4);
  if (embr && emb.u > 0.18) {
    if (som.proxEmb < agora) som.proxEmb = agora + 0.05;
    const bpm = 95 + 75 * faixa(emb.u, 0.18, 1);
    while (som.proxEmb < agora + 0.2) {
      tom(70, { queda: 0.11, vol: 0.18, quando: som.proxEmb - agora, cat: "emb" }); tom(110, { queda: 0.05, vol: 0.05, quando: som.proxEmb - agora, cat: "emb" });
      som.proxEmb += 60 / bpm;
    }
  } else som.proxEmb = 0;
}

const ESCALA_RE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
som.grau = 4;
function notaMelodia(quando, m) {
  const passo = [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)];
  const teto = 5 + Math.round(4 * m);
  som.grau = Math.min(Math.max(som.grau + passo, 0), teto);
  const f = 293.66 * Math.pow(2, ESCALA_RE[som.grau] / 12);
  const v = 0.018 + 0.022 * m;
  tom(f, { queda: 2.4, ataque: 0.02, vol: v, quando, filtro: ["lowpass", 2400], rev: true, cat: "mel" });
  tom(f * 2, { queda: 0.9, ataque: 0.01, vol: v * 0.22, quando, filtro: ["lowpass", 3000], rev: true, cat: "mel" });
  if (Math.random() < 0.25 && som.grau >= 2) {
    const f2 = 293.66 * Math.pow(2, ESCALA_RE[som.grau - 2] / 12);
    tom(f2, { queda: 2.0, ataque: 0.03, vol: v * 0.5, quando: quando + 0.04, filtro: ["lowpass", 2000], rev: true, cat: "mel" });
  }
}

// ---------- controles
function setSom(v) {
  som.ligado = v;
  botaoSom.setAttribute("aria-pressed", String(v));
  botaoSom.textContent = v ? L("Desligar som", "Turn sound off") : L("Ligar som", "Turn sound on");
  if (v) {
    iniciarAudio();
    if (som.ctx && som.ctx.state !== "running") som.ctx.resume();
    if (som.master) alvo(som.master.gain, parseFloat(volEl.value), 0.05);
    setTimeout(() => { tom(523, { queda: 0.3, vol: 0.08 }); tom(784, { queda: 0.5, vol: 0.06, quando: 0.1 }); }, 60);
  } else {
    if (som.master) alvo(som.master.gain, 0, 0.05);
    cortar("tudo");
    calar();
  }
  atualizarTextoSom();
}
botaoSom.addEventListener("click", () => setSom(!som.ligado));
volEl.addEventListener("input", () => {
  if (!som.ligado) { setSom(true); return; }
  if (som.master) alvo(som.master.gain, parseFloat(volEl.value), 0.05);
});
$("b-testar")?.addEventListener("click", () => {
  if (!som.ligado) setSom(true);
  setTimeout(() => {
    [523, 659, 784, 1047].forEach((f, i) => tom(f, { queda: 0.35, vol: 0.14, quando: i * 0.12 }));
    falar(L("Teste de som. Se você ouviu as notas e esta voz, está tudo funcionando.", "Sound test. If you heard the notes and this voice, everything is working."));
    const est = som.ctx ? som.ctx.state : L("sem Web Audio", "no Web Audio"), vz = vozAtual();
    somTxt.textContent = L(`Teste enviado (áudio: ${est === "running" ? "ativo" : est}; ${vz ? "voz: " + vz.name : "voz padrão"}). Sem som? Veja se a aba não está silenciada e o volume do Windows.`,
      `Test sent (audio: ${est === "running" ? "active" : est}; ${vz ? "voice: " + vz.name : "default voice"}). No sound? Check that the tab is not muted and the Windows volume.`);
  }, 150);
});
document.addEventListener("visibilitychange", () => {
  if (!som.ctx) return;
  if (document.hidden) som.ctx.suspend(); else if (som.ligado) som.ctx.resume();
});

// =====================================================================  CAMADAS
const mapa = { "c-pele": "pele", "c-cerebro": "cerebro", "c-vent": "vent", "c-vasos": "vasos", "c-planos": "planos", "c-circ": "circ", "c-liquor": "liquor", "c-porta": "porta", "c-simbolo": "simbolo",
  "c-cortex": "cortex", "c-visao": "visao", "c-limbico": "limbico", "c-papez": "papez", "c-cranio": "cranio" };
const AO_LIGAR = { porta: "porta", liquor: "liquor", simbolo: "ajna", cortex: "lobo_frontal", visao: "cgl", limbico: "hipocampo", papez: "papez", cranio: "osso_esfenoide" };
for (const [id, g] of Object.entries(mapa)) {
  $(id).addEventListener("change", (e) => {
    grupos[g].visible = e.target.checked && !estado.embriao;
    if (g === "liquor" && e.target.checked) liq.horas = 0;
    if (e.target.checked && AO_LIGAR[g]) mostrar(AO_LIGAR[g]);
    if (g === "papez" && e.target.checked) setCamada("c-limbico", true); // o circuito corre por dentro do sistema límbico
    if (g === "limbico" && !e.target.checked) setCamada("c-papez", false);
    if (!e.target.checked && estado.isolar === g) setIsolar("");
    if (g === "cortex") atualizarGemeos();
    if (g === "cranio" && e.target.checked && !ANAT.ok.cabeca) carregarPacote("cabeca").then(() => { aplicarForma(); if (AO_LIGAR.cranio) mostrar(AO_LIGAR.cranio); }).catch(() => {});
  });
}
function setCamada(id, v) { const el = $(id); if (el.checked !== v) { el.checked = v; el.dispatchEvent(new Event("change")); } }
const CAMADA_DO_GRUPO = Object.fromEntries(Object.entries(mapa).map(([id, g]) => [g, id]));
function grupoDe(o) { while (o && o.parent && o.parent !== scene) o = o.parent; for (const [n, g] of Object.entries(grupos)) if (g === o) return n; return null; }
// liga a camada de uma estrutura que está escondida (ex.: ao ir até ela pelo cartão de tamanhos)
function ligarCamadaDe(id) {
  const m = (porId.get(id) || [])[0], g = m && grupoDe(m);
  if (g && CAMADA_DO_GRUPO[g] && !grupos[g].visible) setCamada(CAMADA_DO_GRUPO[g], true);
}

// ---------- ISOLAR CAMADA: a camada escolhida fica normal e todo o resto fica bem apagado
const ISOLAVEIS = { cortex: "c-cortex", visao: "c-visao", limbico: "c-limbico", porta: "c-porta", vent: "c-vent", vasos: "c-vasos", circ: "c-circ", cranio: "c-cranio" };
estado.isolar = "";
const mantidosNoIsolar = (g) => new Set([g, "regua", ...(g === "limbico" ? ["papez"] : []), ...(g === "visao" ? ["circ"] : [])]);
function esmaecerMat(mt, on) {
  const u = mt.userData;
  if (on) {
    if (u.iso || mt === matHalo) return;
    u.iso = { op: mt.opacity, tr: mt.transparent, dw: mt.depthWrite };
    mt.opacity = mt.opacity * 0.12; mt.transparent = true; mt.depthWrite = false; mt.needsUpdate = true;
  } else if (u.iso) {
    mt.opacity = u.iso.op; mt.transparent = u.iso.tr; mt.depthWrite = u.iso.dw; delete u.iso; mt.needsUpdate = true;
  }
}
function aplicarIsolar() {
  const g = estado.isolar, manter = mantidosNoIsolar(g);
  const vistos = new Set();
  // 1º devolve tudo; depois apaga o que não pertence à camada isolada (materiais compartilhados ficam coerentes)
  for (const grp of Object.values(grupos)) grp.traverse((o) => { if (o.material) for (const mt of [].concat(o.material)) esmaecerMat(mt, false); });
  if (!g) return;
  for (const [n, grp] of Object.entries(grupos)) if (manter.has(n)) grp.traverse((o) => { if (o.material) for (const mt of [].concat(o.material)) vistos.add(mt); });
  for (const [n, grp] of Object.entries(grupos)) if (!manter.has(n)) grp.traverse((o) => { if (o.material) for (const mt of [].concat(o.material)) if (!vistos.has(mt)) esmaecerMat(mt, true); });
}
function setIsolar(g) {
  estado.isolar = g || "";
  const sel = $("isolar"); if (sel && sel.value !== estado.isolar) sel.value = estado.isolar;
  if (g && ISOLAVEIS[g]) setCamada(ISOLAVEIS[g], true);
  aplicarIsolar();
}
$("isolar").addEventListener("change", (e) => setIsolar(e.target.value));
const noIsolar = (o) => { if (!estado.isolar) return true; const g = grupoDe(o); return mantidosNoIsolar(estado.isolar).has(g); };

// =====================================================================  FORMA ANATÔMICA (malhas reais, carregadas sob demanda)
// Malhas do BodyParts3D (© The Database Center for Life Science, CC BY 4.0), de um homem adulto japonês, reduzidas e
// encaixadas nas coordenadas do modelo por uma rotação + uma deformação suave (thin-plate spline) que leva pineal,
// hipófise, quiasma, olhos, tálamos, násio e glabela às posições dos pôsteres. Ver malhas_build/ e o manual.

const ANAT = { ok: {}, prom: {}, subst: new Set(), gemeos: [], marcas: {} };
const PACOTES_ANAT = ["cortex", "profundo", "cabeca"];
const EXTRA_SUBST = { cortex: ["sulco_central", "fissura_lateral"], profundo: ["neuro"], cabeca: [] };
const formaTxt = $("forma-txt");
function carregarPacote(nome) {
  if (ANAT.ok[nome]) return Promise.resolve();
  if (ANAT.prom[nome]) return ANAT.prom[nome];
  ANAT.prom[nome] = (async () => {
    const r = await fetch(`anatomia/anat_${nome}.glb`);
    if (!r.ok) throw new Error(`anat_${nome}.glb: ${r.status}`);
    const buf = await r.arrayBuffer(), dv = new DataView(buf);
    // GLB: cabeçalho de 12 bytes, bloco JSON e bloco BIN (glTF 2.0 com KHR_mesh_quantization)
    const nj = dv.getUint32(12, true);
    const gl = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, nj)));
    const base = 20 + nj + 8;
    const vista = (a) => { const v = gl.bufferViews[gl.accessors[a].bufferView]; return base + (v.byteOffset || 0); };
    for (const no of gl.nodes) {
      const malha = gl.meshes[no.mesh], e = malha.extras, pr = malha.primitives[0];
      const ap = gl.accessors[pr.attributes.POSITION], ai = gl.accessors[pr.indices];
      const q = new Int16Array(buf, vista(pr.attributes.POSITION), ap.count * 3), pos = new Float32Array(ap.count * 3);
      const [tx, ty, tz] = no.translation, [sx, sy, sz] = no.scale;
      for (let k = 0; k < ap.count; k++) {
        pos[3 * k] = tx + sx * Math.max(q[3 * k] / 32767, -1);
        pos[3 * k + 1] = ty + sy * Math.max(q[3 * k + 1] / 32767, -1);
        pos[3 * k + 2] = tz + sz * Math.max(q[3 * k + 2] / 32767, -1);
      }
      const idx = ai.componentType === 5125 ? new Uint32Array(buf, vista(pr.indices), ai.count) : new Uint16Array(buf, vista(pr.indices), ai.count);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setIndex(new THREE.BufferAttribute(idx.slice(), 1));
      g.computeVertexNormals(); g.computeBoundingSphere();
      const material = e.id === "pineal" ? pinealMat : mat(e.cor, { opacity: e.op, side: THREE.DoubleSide });
      if (e.grupo === "cranio") material.roughness = 0.75;
      const m = new THREE.Mesh(g, material);
      if (e.op < 0.6) m.renderOrder = e.grupo === "pele" ? 10 : e.grupo === "cortex" ? 8 : 5;
      if (e.grupo !== "cranio") m.userData.forma = "anat";
      if (e.arq === "SKIN") ANAT.pele = m;
      if (e.v0 > 0) m.userData.v0 = e.v0;
      registrar(m, e.id, e.grupo, { clip: true });
      if (estado.corte !== "nenhum") { m.material.clippingPlanes = [planoCorte]; m.material.needsUpdate = true; }
      if (e.id && e.grupo !== "cranio") ANAT.subst.add(e.id);
      if (e.grupo === "cortex" && e.id && e.id.startsWith("lobo_")) {
        // gêmeo neutro na camada Cérebro (mesma geometria): o cérebro real aparece mesmo com o Córtex desligado
        const gm = new THREE.Mesh(g, mat(0xf0c6bd, { opacity: 0.14, side: THREE.DoubleSide }));
        gm.renderOrder = 9; gm.userData.forma = "anat"; gm.userData.gemeo = true;
        registrar(gm, null, "cerebro", { clip: true });
        if (estado.corte !== "nenhum") { gm.material.clippingPlanes = [planoCorte]; gm.material.needsUpdate = true; }
        ANAT.gemeos.push(gm);
      }
    }
    for (const id of EXTRA_SUBST[nome]) ANAT.subst.add(id);
    if (nome === "cabeca") marcasDaPele();
    ANAT.ok[nome] = true;
    cacheVol.clear();
    posicoesAnat();
  })();
  ANAT.prom[nome].catch(() => { delete ANAT.prom[nome]; });
  return ANAT.prom[nome];
}
// topo da cabeça e ponto mais posterior, achados na pele real
function marcasDaPele() {
  const pele = ANAT.pele;
  if (!pele) return;
  const p = pele.geometry.attributes.position, v = new THREE.Vector3();
  let top = null, tras = null;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    if (Math.abs(v.x) > 0.6) continue;
    if (!top || v.y > top.y) top = v.clone();
    if (v.y > -1 && v.y < 6 && (!tras || v.z < tras.z)) tras = v.clone();
  }
  ANAT.marcas = { vertice: top, occipital: tras };
}
// ponto da superfície de cada estrutura real, para ancorar o rótulo (o lado esquerdo da pessoa, nas pares)
const CENTRO_ENC = P(9.6, 3, 0);
function pontoRotulo(id) {
  let ms = (porId.get(id) || []).filter((m) => m.userData.forma === "anat" || (ANAT.ok.cabeca && m.parent === grupos.cranio));
  if (!ms.length) return null;
  const esq = ms.filter((m) => m.geometry.boundingSphere.center.x > 0.3);
  if (esq.length) ms = esq;
  const c = new THREE.Vector3(); let n = 0;
  for (const m of ms) { const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i += 7) { c.x += p.getX(i); c.y += p.getY(i); c.z += p.getZ(i); n++; } }
  c.divideScalar(n);
  const dir = c.clone().sub(CENTRO_ENC); if (dir.lengthSq() < 0.01) dir.set(0, 1, 0); dir.normalize();
  let melhor = null, mv = -Infinity; const v = new THREE.Vector3();
  for (const m of ms) { const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i += 3) { v.fromBufferAttribute(p, i); const s = v.clone().sub(c).dot(dir); if (s > mv) { mv = s; melhor = v.clone(); } } }
  return melhor;
}
function posicoesAnat() {
  for (const r of ROT) if (r.id) { const p = pontoRotulo(r.id); if (p) r.posAnat = p; }
  if (ANAT.marcas.vertice) for (const r of ROT) if (r.id === "vertice") r.posAnat = ANAT.marcas.vertice;
  if (ANAT.marcas.occipital) for (const r of ROT) if (r.id === "occipital") r.posAnat = ANAT.marcas.occipital;
}
function emUso(o) { // o objeto pertence à forma ativa?
  const u = o.userData;
  if (u.forma === "anat") return forma.atual === "anat" && (!u.gemeo || !grupos.cortex.visible);
  if (forma.atual !== "anat") return true;
  if (u.esq) return !ANAT.ok[u.esq];
  if (u.id && ANAT.subst.has(u.id)) return false;
  return true;
}
function aplicarForma() {
  for (const g of Object.values(grupos)) for (const o of g.children) {
    const u = o.userData;
    if (u.forma || u.esq || u.id) o.visible = emUso(o);
  }
  // marcas do topo e de trás da cabeça vão para a pele real
  for (const id of ["vertice", "occipital"]) {
    for (const o of [...(porId.get(id) || []), ...grupos.fixo.children.filter((x) => x.userData.marca === id)]) {
      o.userData.pos0 ||= o.position.clone();
      const alvo = forma.atual === "anat" && ANAT.marcas[id] ? ANAT.marcas[id] : o.userData.pos0;
      o.position.copy(alvo); if (o.userData.centro) o.userData.centro.copy(alvo);
    }
  }
  cacheVol.clear();
  if (estado.isolar) aplicarIsolar();
  if (esfera.id) removerEsfera();
  if (infoRender) infoRender();
}
function atualizarGemeos() { for (const g of ANAT.gemeos) g.visible = emUso(g); }
async function setForma(f) {
  document.querySelectorAll("#forma button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.f === f)));
  if (f === "anat") {
    try {
      for (let i = 0; i < PACOTES_ANAT.length; i++) {
        if (!ANAT.ok[PACOTES_ANAT[i]]) formaTxt.textContent = L(`Carregando as malhas reais (${i + 1} de 3)…`, `Loading the real meshes (${i + 1} of 3)…`);
        await carregarPacote(PACOTES_ANAT[i]);
      }
    } catch (e) {
      formaTxt.textContent = L("Não consegui carregar as malhas reais (pasta anatomia/). A forma esquemática continua.", "Could not load the real meshes (anatomia/ folder). The schematic form stays on.");
      document.querySelectorAll("#forma button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.f === "esq")));
      return;
    }
  }
  forma.atual = f;
  aplicarForma();
  textoForma();
}
function textoForma() {
  formaTxt.textContent = forma.atual === "anat"
    ? L("Formas reais do BodyParts3D (um homem adulto), encaixadas nas coordenadas do modelo. Os pulsos, planos e vasos continuam esquemáticos.",
      "Real shapes from BodyParts3D (one adult man), fitted to the model's coordinates. Pulses, planes and vessels stay schematic.")
    : L("Sólidos geométricos com as medidas dos pôsteres.", "Geometric solids with the posters' measurements.");
}
document.querySelectorAll("#forma button").forEach((b) => b.addEventListener("click", () => setForma(b.dataset.f)));
textoForma();

// =====================================================================  CÂMERA
const VISTAS = {
  perfil: [new THREE.Vector3(56, -1, 0), ALVO_PADRAO], frente: [new THREE.Vector3(0, -1, 56), ALVO_PADRAO],
  topo: [new THREE.Vector3(0, 56, -0.5), ALVO_PADRAO], tres: [new THREE.Vector3(38, 15, 38), ALVO_PADRAO],
};
const voo = { pos: null, alvo: null };
function voar(pos, alvo) {
  if (reduz) { camera.position.copy(pos); controls.target.copy(alvo); voo.pos = null; return; }
  voo.pos = pos.clone(); voo.alvo = alvo.clone();
}
// Desloca o ponto de mira para a estrutura não ficar atrás do cartão (que pode ter sido arrastado)
function folgaCartao(dist) {
  if (posCard.y === null) return -dist * 0.16;
  const meio = posCard.y + card.offsetHeight / 2;
  return meio < stage.clientHeight / 2 ? dist * 0.16 : -dist * 0.16;
}
function voarPara(alvoAnat, dir, dist, acimaDoCartao = true) {
  const alvo = P(...alvoAnat);
  if (acimaDoCartao) alvo.y += folgaCartao(dist);
  const pos = alvo.clone().add(new THREE.Vector3(...dir).normalize().multiplyScalar(dist));
  voar(pos, alvo);
}
function marcarVista(v) { document.querySelectorAll("#vistas button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.v === v))); }
document.querySelectorAll("#vistas button").forEach((b) => b.addEventListener("click", () => {
  marcarVista(b.dataset.v);
  const [p, a] = VISTAS[b.dataset.v];
  voar(p, a);
}));
camera.position.copy(VISTAS.tres[0]);
controls.addEventListener("start", () => { voo.pos = null; });

// =====================================================================  CORTE
const planoCorte = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
const corteSlider = $("corte-pos"), corteTxt = $("corte-txt");
const CORTES = {
  nenhum: null,
  sagital: { min: -8, max: 8, ini: 0, vista: "perfil", txt: () => L("Corte de perfil: remove o lado esquerdo da pessoa até a posição escolhida (0 = linha média).", "Side cut: removes the person's left side up to the chosen position (0 = midline).") },
  coronal: { min: -11, max: 12, ini: 0.3, vista: "frente", txt: () => L("Corte de frente: remove a parte da frente da cabeça até a posição escolhida.", "Front cut: removes the front of the head up to the chosen position.") },
  axial: { min: -18, max: 12.5, ini: 1.6, vista: "topo", txt: () => L("Corte de cima: remove o topo da cabeça até a altura escolhida (1,6 = logo acima da pineal).", "Top cut: removes the top of the head down to the chosen height (1.6 = just above the pineal).") },
};
function textoCorte() {
  const cfg = CORTES[estado.corte];
  corteTxt.textContent = cfg ? cfg.txt() : L("Escolha um plano para fatiar a pele, o cérebro e os vasos e ver o interior.", "Choose a plane to slice the skin, brain and vessels and see inside.");
}
function atualizarPlano() {
  const c = parseFloat(corteSlider.value);
  if (estado.corte === "sagital") planoCorte.set(new THREE.Vector3(-1, 0, 0), c);
  else if (estado.corte === "coronal") planoCorte.set(new THREE.Vector3(0, 0, -1), c);
  else if (estado.corte === "axial") planoCorte.set(new THREE.Vector3(0, -1, 0), c);
}
function setCorte(modo) {
  estado.corte = modo;
  document.querySelectorAll("#cortes button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.c === modo)));
  const cfg = CORTES[modo];
  const planos = cfg ? [planoCorte] : [];
  for (const m of clipaveis) { m.material.clippingPlanes = planos; m.material.needsUpdate = true; }
  if (cfg) {
    corteSlider.min = cfg.min; corteSlider.max = cfg.max; corteSlider.value = cfg.ini;
    marcarVista(cfg.vista);
    voar(...VISTAS[cfg.vista]);
  }
  textoCorte();
  atualizarPlano();
}
document.querySelectorAll("#cortes button").forEach((b) => b.addEventListener("click", () => setCorte(b.dataset.c)));
corteSlider.addEventListener("input", atualizarPlano);

// =====================================================================  CARTÃO (tour, quiz, embrião, régua)
const card = $("card");
const posCard = { x: null, y: null };
function aplicarPosCard() {
  if (posCard.x === null) { card.style.left = ""; card.style.top = ""; card.style.bottom = ""; card.style.transform = ""; return; }
  const W = stage.clientWidth, H = stage.clientHeight;
  const x = Math.min(Math.max(posCard.x, 8), W - card.offsetWidth - 8);
  const y = Math.min(Math.max(posCard.y, 8), H - card.offsetHeight - 8);
  card.style.left = `${x}px`; card.style.top = `${y}px`; card.style.bottom = "auto"; card.style.transform = "none";
}
function abrirCard(html) {
  card.innerHTML = html.replace('<div class="kicker">', `<div class="kicker" title="${L("Arraste para mover; duplo clique volta ao lugar", "Drag to move; double-click to put it back")}"><span class="alca" aria-hidden="true">⠿</span>`);
  card.hidden = false;
  aplicarPosCard();
}
{
  let arr = null;
  card.addEventListener("pointerdown", (e) => {
    if (!e.target.closest(".kicker")) return;
    const r = card.getBoundingClientRect(), s = stage.getBoundingClientRect();
    arr = { dx: e.clientX - r.left, dy: e.clientY - r.top, sx: s.left, sy: s.top };
    card.setPointerCapture(e.pointerId);
    card.classList.add("arrastando");
  });
  card.addEventListener("pointermove", (e) => {
    if (!arr) return;
    posCard.x = e.clientX - arr.sx - arr.dx; posCard.y = e.clientY - arr.sy - arr.dy;
    aplicarPosCard();
  });
  const soltar = () => { arr = null; card.classList.remove("arrastando"); };
  card.addEventListener("pointerup", soltar);
  card.addEventListener("pointercancel", soltar);
  card.addEventListener("dblclick", (e) => { if (e.target.closest(".kicker")) { posCard.x = posCard.y = null; aplicarPosCard(); } });
}
function fecharCard() { card.hidden = true; card.innerHTML = ""; }
const acoes = {};
card.addEventListener("click", (e) => { const a = e.target.closest("[data-acao]"); if (a && acoes[a.dataset.acao]) acoes[a.dataset.acao](a); });
card.addEventListener("input", (e) => { if (e.target.id === "emb-u") { atualizarEmbriao(parseFloat(e.target.value)); estado.embPlay = false; textoEmbriao(); } });
function marcarFerramenta(id) { for (const b of ["b-tour", "b-quiz", "b-embriao", "b-regua", "b-tam", "b-kura", "b-jet"]) $(b).setAttribute("aria-pressed", String(b === id)); }
function sairModos() {
  clearTimeout(som.timerTour);
  calar();
  if (estado.tour >= 0) estado.tour = -1;
  if (estado.quiz) estado.quiz = false;
  if (estado.embriao) sairEmbriao();
  if (estado.regua) limparRegua(true);
  if (estado.kura) { estado.kura = false; brilhoNSQ(false); }
  estado.jet = false; estado.tam = false;
  removerEsfera();
  restaurarDestaque();
  marcarFerramenta(null);
  fecharCard();
}

// ---------- TOUR
const TOUR = [
  { t: "O centro da cabeça", txt: "Vamos seguir o caminho que leva a luz do dia até a melatonina da noite, passando pelas estruturas que vimos nos pôsteres.", alvo: [9, -1, 0], dir: [1, 0.4, 1], dist: 52, ids: [] },
  { t: "1. A luz entra pelos olhos", txt: "De dia, a luz forte chega à retina. Os pulsos azuis mostram o sinal saindo dos olhos pelos nervos ópticos.", alvo: [3.2, -0.5, 2.2], dir: [0.55, 0.25, 1], dist: 16, ids: ["olho"], hora: 12 },
  { t: "2. Quiasma e relógio central", txt: "Os nervos ópticos se cruzam no quiasma. Logo acima fica o NSQ, o relógio central, que recebe a luz direto da retina.", alvo: [6.8, 0.15, 0], dir: [0.8, 0.35, 1], dist: 8, ids: ["quiasma", "nsq"], hora: 12.5 },
  { t: "3. Mesma luz, dois destinos", txt: "Do quiasma, quase todas as fibras seguem pelos tratos ópticos até o corpo geniculado lateral do tálamo e, pela radiação óptica, até o córtex visual (V1), na nuca: é a visão consciente, a que forma imagem. Só um ramo pequeno desvia para o NSQ, que não quer ver nada, só saber se é dia ou noite.", alvo: [12.6, 1.6, 0.8], dir: [0.8, 1, -0.35], dist: 34, ids: ["cgl", "v1"], hora: 12.6, camadas: { "c-visao": true } },
  { t: "4. Anoitece e o freio se solta", txt: "Sem luz, o NSQ deixa o núcleo paraventricular (NPV) mandar o sinal adiante. Os pulsos vermelhos começam aqui.", alvo: [7.5, 0.7, 0], dir: [1, 0.35, 0.7], dist: 8, ids: ["hipotalamo", "npv"], hora: 22.6, camadas: { "c-visao": false } },
  { t: "5. O sinal desce pela medula", txt: "Em vez de ir direto até a pineal, o sinal desce pelo tronco e pela medula até o alto do tórax (T1–T2).", alvo: [12, -10, 0.5], dir: [1, 0.1, 0.35], dist: 30, ids: ["medula", "tronco"], hora: 23 },
  { t: "6. Gânglio cervical superior", txt: "Do tórax, o sinal sobe pela cadeia simpática até este gânglio no pescoço.", alvo: [10.3, -9, 2.4], dir: [1, 0.1, 0.7], dist: 12, ids: ["gcs"], hora: 23.4 },
  { t: "7. As fibras entram na pineal por trás", txt: "Fibras simpáticas sobem acompanhando as artérias e chegam à pineal pela parte de trás, junto ao cerebelo.", alvo: [12.5, -2, 0.8], dir: [0.9, 0.3, 0.5], dist: 20, ids: ["pineal"], hora: 23.8 },
  { t: "8. A pineal libera melatonina", txt: "A noradrenalina dessas fibras ativa a pineal. Ela brilha e solta melatonina (pontos laranja) no sangue e no líquor.", alvo: [10.1, 1.4, 0], dir: [1, 0.45, 0.55], dist: 12, ids: ["pineal"], hora: 1 },
  { t: "9. O terceiro ventrículo e o líquor", txt: "O líquor desce dos ventrículos laterais, atravessa o 3º ventrículo e sai pelo aqueduto, levando melatonina até o assoalho, onde estão o hipotálamo e a haste da hipófise.", alvo: [8.6, 1.3, 0], dir: [1, 0.25, 0.25], dist: 10, ids: ["vent3"], hora: 2, camadas: { "c-liquor": true } },
  { t: "10. Hipófise e sistema porta", txt: "O hipotálamo manda hormônios de liberação pelas veias porta (verde) até a adeno-hipófise, que solta seus hormônios no sangue (roxo). Ocitocina e vasopressina descem por dentro dos axônios (verde-claro).", alvo: [7.2, -0.9, 0], dir: [0.9, -0.05, 1], dist: 9.5, ids: ["adeno", "neuro"], camadas: { "c-porta": true, "c-liquor": false } },
  { t: "11. Glabela, raiz do nariz e os dois planos", txt: "O plano horizontal da pineal sai na glabela; o da hipófise sai um pouco abaixo da raiz do nariz.", alvo: [4, 0, 0], dir: [1, 0.15, 0.2], dist: 30, ids: ["glabela", "nasio"], camadas: { "c-planos": true, "c-porta": false } },
  { t: "12. Da raiz do nariz ao seio cavernoso", txt: "A veia angular, no canto do olho, liga-se à veia oftálmica superior, que termina no seio cavernoso, ao lado da hipófise.", alvo: [3.6, -0.8, 1.9], dir: [0.6, 0.45, 0.8], dist: 16, ids: ["veia", "cavernoso"], camadas: { "c-vasos": true } },
  { t: "13. Vista de cima", txt: "De cima, a pineal aparece entre os dois tálamos, e o ponto mais alto da cabeça fica quase em cima dela. Na camada simbólica, é por aí que passa o eixo vertical.", alvo: [9.5, 2, 0], dir: [0, 1, -0.02], dist: 48, ids: ["pineal", "talamo"], camadas: { "c-simbolo": true } },
  { t: "Fim do tour", txt: "Experimente o modo embrião para ver de onde vêm a pineal, os olhos e a hipófise, ou teste o que aprendeu no quiz.", alvo: [9, -1, 0], dir: [1, 0.4, 1], dist: 52, ids: [] },
];
function cardTour(i) {
  const p = TOUR[i], [titulo, texto] = idioma === "en" ? TOUR_EN[i] : [p.t, p.txt];
  abrirCard(`<div class="kicker"><span>${L("Tour guiado", "Guided tour")}</span><span>${i + 1} ${L("de", "of")} ${TOUR.length}</span></div>
    <h3>${titulo}</h3><p>${texto}</p>
    <div class="acoes"><button type="button" class="esq" data-acao="fecharTour">${L("Sair", "Exit")}</button>
    <button type="button" data-acao="antTour">${L("Anterior", "Previous")}</button>
    <button type="button" class="primario" data-acao="proxTour">${i === TOUR.length - 1 ? L("Concluir", "Finish") : L("Próximo", "Next")}</button></div>`);
  return [titulo, texto];
}
function passoTour(i) {
  estado.tour = i;
  const p = TOUR[i];
  if (p.hora !== undefined) { setTocando(false); setHora(p.hora); }
  if (p.camadas) for (const [id, v] of Object.entries(p.camadas)) setCamada(id, v);
  destacar(p.ids, true);
  if (p.ids[0]) mostrar(p.ids[0]);
  voarPara(p.alvo, p.dir, p.dist);
  const [titulo, texto] = cardTour(i);
  clearTimeout(som.timerTour);
  const tempoLeitura = Math.max(6000, texto.length * 65);
  const avancar = (falhou) => { if (opc.auto && estado.tour === i && i < TOUR.length - 1) som.timerTour = setTimeout(() => { if (estado.tour === i) passoTour(i + 1); }, falhou ? tempoLeitura : 1100); };
  if (opc.tour && falar(`${titulo}. ${texto}`, avancar)) return;
  if (opc.auto && estado.tour === i && i < TOUR.length - 1) som.timerTour = setTimeout(() => { if (estado.tour === i) passoTour(i + 1); }, tempoLeitura);
}
acoes.proxTour = () => { if (estado.tour < TOUR.length - 1) passoTour(estado.tour + 1); else { sairModos(); setTocando(!reduz); } };
acoes.antTour = () => { if (estado.tour > 0) passoTour(estado.tour - 1); };
acoes.fecharTour = () => { sairModos(); };
$("b-tour").addEventListener("click", () => {
  if (estado.tour >= 0) { sairModos(); return; }
  sairModos(); marcarFerramenta("b-tour"); setCorte("nenhum"); passoTour(0);
});

// ---------- QUIZ
const QUIZ_IDS = ["pineal", "adeno", "neuro", "hipotalamo", "nsq", "talamo", "vent3", "ventlat", "aqueduto", "quiasma", "olho", "piramide",
  "glabela", "nasio", "vertice", "occipital", "caloso", "cerebelo", "tronco", "medula", "gcs", "cavernoso", "carotida", "veia", "esfenoidal", "seiofrontal",
  "lobo_frontal", "lobo_parietal", "lobo_temporal", "lobo_occipital", "sulco_central", "fissura_lateral", "cgl", "radiacao", "v1",
  "hipocampo", "amigdala", "fornix", "mamilares", "cingulo", "habenula", "tal_anterior", "insula", "parahipocampal", "nucleos_base",
  "osso_frontal", "osso_parietal", "osso_occipital", "osso_temporal", "osso_esfenoide", "mandibula"];
const quiz = { alvo: null, acertos: 0, total: 0, respondido: false };
function visivel(m) { let o = m; while (o) { if (!o.visible) return false; o = o.parent; } return true; }
const embaralhar = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function novaPergunta() {
  calar();
  const disponiveis = QUIZ_IDS.filter((id) => (porId.get(id) || []).some(visivel) && id !== quiz.alvo);
  const alvo = disponiveis[Math.floor(Math.random() * disponiveis.length)];
  quiz.alvo = alvo; quiz.respondido = false;
  quiz.opcoes = embaralhar([alvo, ...embaralhar(QUIZ_IDS.filter((x) => x !== alvo)).slice(0, 3)]); quiz.escolha = null;
  destacar([alvo], true);
  const m = (porId.get(alvo) || []).find(visivel);
  const centro = centroDe(m);
  const dir = camera.position.clone().sub(controls.target).normalize();
  const dist = Math.min(Math.max(camera.position.distanceTo(controls.target), 18), 34);
  const olhar = centro.clone(); olhar.y += folgaCartao(dist);
  voar(olhar.clone().addScaledVector(dir, dist), olhar);
  renderQuiz();
}
function renderQuiz() {
  abrirCard(`<div class="kicker"><span>Quiz</span><span class="placar">${quiz.acertos}/${quiz.total}</span></div>
    <h3>${L("Que estrutura está piscando?", "Which structure is blinking?")}</h3>
    <div class="opcoes">${quiz.opcoes.map((id) => `<button type="button" data-acao="resp" data-id="${id}">${infoDe(id)[0]}</button>`).join("")}</div>
    <p id="quiz-exp"></p>
    <div class="acoes"><button type="button" class="esq" data-acao="sairQuiz">${L("Sair", "Exit")}</button><button type="button" class="primario" data-acao="proxQuiz">${L("Próxima", "Next")}</button></div>`);
  if (quiz.respondido) marcarRespostaQuiz();
}
function marcarRespostaQuiz() {
  const certo = quiz.escolha === quiz.alvo, d = infoDe(quiz.alvo);
  card.querySelectorAll("[data-acao=resp]").forEach((x) => { if (x.dataset.id === quiz.alvo) x.classList.add("certo"); else if (x.dataset.id === quiz.escolha) x.classList.add("errado"); });
  card.querySelector(".placar").textContent = `${quiz.acertos}/${quiz.total}`;
  card.querySelector("#quiz-exp").textContent = `${certo ? L("Isso mesmo!", "Right!") : L(`Era: ${d[0]}.`, `It was: ${d[0]}.`)} ${d[2]}`;
}
acoes.resp = (b) => {
  if (quiz.respondido) return;
  quiz.respondido = true; quiz.total++; quiz.escolha = b.dataset.id;
  const certo = b.dataset.id === quiz.alvo;
  if (certo) { quiz.acertos++; som.sequencia++; somAcerto(); if (som.sequencia % 3 === 0) fanfarra(); }
  else { som.sequencia = 0; somErro(); }
  if (opc.nomes) {
    const [nome, , frase] = infoDe(quiz.alvo);
    falar(`${certo ? L("Isso mesmo!", "Right!") : L("Não foi dessa vez. Era", "Not this time. It was")} ${nome}. ${frase}`);
  }
  marcarRespostaQuiz();
  mostrar(quiz.alvo);
};
acoes.proxQuiz = () => novaPergunta();
acoes.sairQuiz = () => sairModos();
$("b-quiz").addEventListener("click", () => {
  if (estado.quiz) { sairModos(); return; }
  sairModos(); marcarFerramenta("b-quiz"); estado.quiz = true; quiz.acertos = 0; quiz.total = 0; quiz.alvo = null; som.sequencia = 0; novaPergunta();
});

// ---------- EMBRIÃO
function textoEmbriao() {
  const u = emb.u;
  let et = ETAPAS_EMB[0];
  for (const e of ETAPAS_EMB) if (u >= e[0]) et = e;
  const t = card.querySelector("#emb-t"), p = card.querySelector("#emb-p");
  const en = idioma === "en" ? ETAPAS_EMB_EN[ETAPAS_EMB.indexOf(et)] : null;
  if (t) { t.textContent = en ? en[0] : et[1]; p.textContent = en ? en[1] : et[2]; }
  const s = card.querySelector("#emb-u"); if (s && document.activeElement !== s) s.value = u.toFixed(3);
  const b = card.querySelector("[data-acao=playEmb]"); if (b) b.textContent = estado.embPlay ? L("Pausar", "Pause") : L("Reproduzir", "Play");
}
function entrarEmbriao() {
  setIsolar("");
  estado.embriao = true;
  for (const g of Object.keys(grupos)) if (g !== "embriao" && g !== "regua") grupos[g].visible = false;
  grupos.embriao.visible = true;
  atualizarEmbriao(0); estado.embPlay = !reduz;
  voarPara([7.0, -3.4, 0], [1, 0.25, 0.6], 32);
  cardEmbriao();
  mostrar("olho");
}
function cardEmbriao() {
  abrirCard(`<div class="kicker"><span>${L("Modo embrião", "Embryo mode")}</span><span>${L("esquema fora de escala", "schematic, not to scale")}</span></div>
    <h3 id="emb-t"></h3><p id="emb-p"></p>
    <input type="range" id="emb-u" min="0" max="1" step="0.005" value="${emb.u}" aria-label="${L("Desenvolvimento", "Development")}">
    <div class="etapas"><span>${L("3ª semana", "Week 3")}</span><span>${L("6ª semana", "Week 6")}</span><span>${L("8ª semana", "Week 8")}</span></div>
    <div class="acoes"><button type="button" class="esq" data-acao="sairEmb">${L("Voltar ao adulto", "Back to adult")}</button><button type="button" class="primario" data-acao="playEmb">${L("Reproduzir", "Play")}</button></div>`);
  textoEmbriao();
}
function sairEmbriao() {
  estado.embriao = false;
  for (const [id, g] of Object.entries(mapa)) grupos[g].visible = $(id).checked;
  grupos.fixo.visible = true; grupos.regua.visible = true;
  grupos.embriao.visible = false;
  voar(...VISTAS.tres);
}
acoes.playEmb = () => { if (emb.u >= 0.999) atualizarEmbriao(0); estado.embPlay = !estado.embPlay; textoEmbriao(); };
acoes.sairEmb = () => sairModos();
$("b-embriao").addEventListener("click", () => {
  if (estado.embriao) { sairModos(); return; }
  sairModos(); marcarFerramenta("b-embriao"); setCorte("nenhum"); entrarEmbriao();
});

// ---------- RÉGUA (distância entre 2 pontos ou ângulo entre 3)
const regua = { modo: "dist", pontos: [], marcas: [], linhas: [], rot: null, ultimaMsg: null, rotFn: null };
regua.rot = rotulo("", new THREE.Vector3(), "#F2B24A", "regua", -1, "medida");
regua.rot.ativo = false;
const matMarca = new THREE.MeshBasicMaterial({ color: 0xffd27a, depthTest: false });
const matLinhaRegua = () => new THREE.LineDashedMaterial({ color: 0xffd27a, dashSize: 0.3, gapSize: 0.2, depthTest: false });
function limparRegua(sair = false) {
  for (const m of regua.marcas) grupos.regua.remove(m);
  for (const l of regua.linhas) { grupos.regua.remove(l); l.geometry.dispose(); }
  regua.pontos = []; regua.marcas = []; regua.linhas = []; regua.rot.ativo = false; regua.rotFn = null;
  if (sair) estado.regua = false;
}
function linhaRegua(pts, tracejada = true) {
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), tracejada ? matLinhaRegua() : new THREE.LineBasicMaterial({ color: 0xffd27a, depthTest: false }));
  if (tracejada) l.computeLineDistances();
  l.renderOrder = 50; grupos.regua.add(l); regua.linhas.push(l);
}
function msgInicialRegua() {
  return {
    dist: L("Clique em duas estruturas (no 3D, no nome ou na bolinha) para ver a distância. Experimente a glabela e a pineal.",
      "Click two structures (in 3D, on the name or on the dot) to see the distance. Try the glabella and the pineal."),
    ang: L("Clique em três estruturas: o ângulo é medido no ponto do meio. Experimente glabela, pineal e topo da cabeça.",
      "Click three structures: the angle is measured at the middle one. Try glabella, pineal and top of the head."),
    vol: L("Clique numa estrutura para ver o volume dela; clique numa segunda para comparar. Experimente a pineal e a hipófise.",
      "Click a structure to see its volume; click a second one to compare. Try the pineal and the pituitary."),
    tetra: L("Clique em quatro estruturas: o modelo desenha o tetraedro entre elas e calcula o volume pelo produto misto. Experimente glabela, pineal, hipófise e um olho (quatro pontos no plano do meio dariam volume zero).",
      "Click four structures: the model draws the tetrahedron between them and computes its volume with the scalar triple product. Try glabella, pineal, pituitary and an eye (four points on the midline plane would give zero volume)."),
  }[regua.modo];
}
// msg é uma função (para o texto ser refeito ao trocar de idioma) ou null para a instrução inicial
function cardRegua(msg) {
  regua.ultimaMsg = msg;
  abrirCard(`<div class="kicker"><span>${L("Régua", "Ruler")}</span><span>${L("1 unidade = 1 cm (aprox.)", "1 unit = 1 cm (approx.)")}</span></div>
    <div class="seg seg4" role="group" aria-label="${L("Tipo de medida", "Measurement type")}">${[["dist", L("Distância", "Distance")], ["ang", L("Ângulo", "Angle")], ["vol", L("Volume", "Volume")], ["tetra", L("Tetraedro", "Tetrahedron")]]
      .map(([m, t]) => `<button type="button" data-acao="reguaModo" data-m="${m}" aria-pressed="${regua.modo === m}">${t}</button>`).join("")}</div>
    <p>${msg ? msg() : msgInicialRegua()}</p>
    <div class="acoes"><button type="button" class="esq" data-acao="sairRegua">${L("Sair", "Exit")}</button><button type="button" data-acao="limparRegua">${L("Limpar", "Clear")}</button></div>`);
}
acoes.sairRegua = () => sairModos();
acoes.limparRegua = () => { limparRegua(); cardRegua(null); };
acoes.reguaModo = (b) => { regua.modo = b.dataset.m; limparRegua(); cardRegua(null); };
function somAngulo(graus) {
  if (!opc.clique) return;
  const passos = Math.round(14 - (graus / 180) * 14), oit = Math.floor(passos / 7), grau = ((passos % 7) + 7) % 7;
  const f = 440 * Math.pow(2, (12 * oit + MAIOR[grau]) / 12);
  tom(f, { queda: 1.1, vol: 0.12 }); tom(f * 1.5, { queda: 0.8, vol: 0.04, quando: 0.15 });
}
const nomeP = (pt) => infoDe(pt.id)?.[0] || L("ponto", "point");
function rotuloMedida(fn) {
  regua.rotFn = fn;
  regua.rot.el.innerHTML = `<i style="background:#F2B24A"></i>${fn()}`; regua.rot.w = 0; regua.rot.ativo = true;
}
function medir(hit) {
  const necessarios = { dist: 2, ang: 3, vol: 2, tetra: 4 }[regua.modo];
  if (regua.pontos.length >= necessarios) limparRegua();
  const obj = hit.object, agora = performance.now(), ult = regua.pontos.at(-1);
  if (ult && ult.id === obj.userData.id && agora - ult.t < 450) return;
  const p = (obj.userData.centro || hit.point).clone();
  const pt = { p, id: obj.userData.id, t: agora };
  regua.pontos.push(pt);
  const marca = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), matMarca);
  marca.renderOrder = 50; marca.position.copy(p); grupos.regua.add(marca); regua.marcas.push(marca);
  somRegua();
  if (regua.modo === "vol") { medirVolume(); return; }
  if (regua.modo === "tetra") { medirTetra(); return; }
  const n = regua.pontos.length;
  if (n < necessarios) {
    const ang = regua.modo === "ang" && n === 2;
    cardRegua(() => `${L("Ponto", "Point")} ${n}: <b>${nomeP(pt)}</b>${ang ? L(" (o ângulo será medido aqui)", " (the angle will be measured here)") : ""}. ` +
      (n === 1 ? L("Agora clique na segunda estrutura.", "Now click the second structure.") : L("Agora clique na terceira estrutura.", "Now click the third structure.")));
    if (ang) linhaRegua([regua.pontos[0].p, p]);
    return;
  }
  const novaMedida = () => L("Clique de novo para uma nova medida.", "Click again for a new measurement.");
  if (regua.modo === "dist") {
    const [a, b] = regua.pontos;
    linhaRegua([a.p, b.p]);
    const d = a.p.distanceTo(b.p), txt = () => `${NUM(d)} cm`;
    rotuloMedida(txt);
    regua.rot.pos.copy(a.p).lerp(b.p, 0.5);
    cardRegua(() => `<b>${nomeP(a)}</b> ${L("até", "to")} <b>${nomeP(b)}</b>: <b>${txt()}</b>. ${novaMedida()}`);
    somRegua(d);
    if (opc.nomes) falar(`${nomeP(a)} ${L("até", "to")} ${nomeP(b)}: ${txt()}.`);
    setInfo(() => { infoEl.innerHTML = `<h3><i style="background:#F2B24A"></i>${L("Medida", "Measurement")}</h3><p>${nomeP(a)} → ${nomeP(b)}</p><div class="medida">${txt()}</div><p>${L("Distância entre os centros (ou os pontos clicados), em linha reta.", "Straight-line distance between the centers (or the clicked points).")}</p>`; });
    return;
  }
  // ângulo no ponto do meio: θ = arccos( (A−B)·(C−B) / (|A−B| |C−B|) )
  const [a, b, c] = regua.pontos;
  linhaRegua([b.p, c.p]);
  const u = a.p.clone().sub(b.p), v = c.p.clone().sub(b.p);
  const graus = THREE.MathUtils.radToDeg(u.angleTo(v));
  const raio = Math.min(u.length(), v.length()) * 0.28;
  const un = u.clone().normalize(), vn = v.clone().normalize(), arco = [];
  for (let i = 0; i <= 32; i++) { const t = i / 32; arco.push(b.p.clone().add(un.clone().lerp(vn, t).normalize().multiplyScalar(raio))); }
  linhaRegua(arco, false);
  const bissetriz = un.clone().add(vn).normalize();
  const txt = () => `${NUM(graus)}°`;
  rotuloMedida(txt);
  regua.rot.pos.copy(b.p).addScaledVector(bissetriz, raio * 1.25);
  cardRegua(() => `${L("Ângulo em", "Angle at")} <b>${nomeP(b)}</b>, ${L("entre", "between")} <b>${nomeP(a)}</b> ${L("e", "and")} <b>${nomeP(c)}</b>: <b>${txt()}</b>. ${novaMedida()}`);
  somAngulo(graus);
  if (opc.nomes) falar(`${L("Ângulo em", "Angle at")} ${nomeP(b)}: ${NUM(graus)} ${L("graus", "degrees")}.`);
  setInfo(() => {
    infoEl.innerHTML = `<h3><i style="background:#F2B24A"></i>${L("Ângulo", "Angle")}</h3><p>${nomeP(a)} → <b>${nomeP(b)}</b> → ${nomeP(c)}</p><div class="medida">${txt()}</div>` +
      `<p class="formula">θ = arccos( (A−B)·(C−B) / (|A−B|·|C−B|) )</p><p>${L("Medido no ponto do meio, entre as duas retas.", "Measured at the middle point, between the two lines.")}</p>`;
  });
}
// ---------- régua: modos Volume (1 ou 2 estruturas) e Tetraedro (4 pontos)
const volRegua = (id) => { const vm = volumeModelo(id); return vm.par ? vm.um : vm.total; };
const temVolume = (id) => id && !SEM_VOLUME.has(id) && (porId.get(id) || []).length > 0;
const nomeVol = (pt) => nomeP(pt) + (PARES.has(pt.id) ? L(" (um lado)", " (one side)") : "");
function fmtRazao(x) { return x >= 100 ? Math.round(x).toLocaleString(idioma === "en" ? "en-US" : "pt-BR") : NUM(x, x < 10 ? 1 : 0); }
function desfazerPonto() {
  regua.pontos.pop();
  const m = regua.marcas.pop(); if (m) grupos.regua.remove(m);
}
function medirVolume() {
  const n = regua.pontos.length, pt = regua.pontos[n - 1];
  if (!temVolume(pt.id)) {
    desfazerPonto();
    cardRegua(() => `<b>${nomeP(pt)}</b> ${L("é um ponto de referência (ou um vaso), sem volume próprio. Escolha uma estrutura.", "is a landmark (or a vessel) with no volume of its own. Pick a structure.")}`);
    return;
  }
  if (n === 1) {
    const v = volRegua(pt.id), ref = refDe(pt.id);
    rotuloMedida(() => fmtVol(v)); regua.rot.pos.copy(pt.p);
    cardRegua(() => `${L("Volume de", "Volume of")} <b>${nomeVol(pt)}</b> ${L("no modelo", "in the model")}: <b>${fmtVol(v)}</b>` +
      (ref && pt.id !== "adeno" && pt.id !== "neuro" ? ` (${L("real", "real")}: ${fmtFaixa(ref.lo, ref.hi)})` : "") +
      `. ${L("Clique numa segunda estrutura para comparar.", "Click a second structure to compare.")}`);
    somRegua(Math.cbrt(v) * 3);
    mostrar(pt.id);
    if (opc.nomes) falar(`${nomeP(pt)}: ${fmtVol(v).replace("cm³", L("centímetros cúbicos", "cubic centimeters")).replace("mm³", L("milímetros cúbicos", "cubic millimeters"))}.`);
    return;
  }
  const [a, b] = regua.pontos, va = volRegua(a.id), vb = volRegua(b.id);
  const maior = vb >= va ? [b, vb] : [a, va], menor = vb >= va ? [a, va] : [b, vb], razao = maior[1] / menor[1];
  rotuloMedida(() => fmtVol(vb)); regua.rot.pos.copy(b.p);
  const frase = () => a.id === b.id ? L("É a mesma estrutura.", "It is the same structure.")
    : `<b>${nomeVol(maior[0])}</b> ${L("tem o volume de", "has the volume of")} <b>${fmtRazao(razao)}</b> × <b>${nomeVol(menor[0])}</b>`;
  cardRegua(() => `${frase()} (${fmtVol(maior[1])} ${L("contra", "versus")} ${fmtVol(menor[1])}, ${L("no modelo", "in the model")}). ${L("Clique de novo para uma nova medida.", "Click again for a new measurement.")}`);
  somRegua(Math.min(razao, 100));
  if (opc.nomes && a.id !== b.id) falar(`${nomeVol(maior[0])} ${L("tem o volume de", "has the volume of")} ${fmtRazao(razao)} ${nomeVol(menor[0])}.`);
  setInfo(() => {
    infoEl.innerHTML = `<h3><i style="background:#F2B24A"></i>${L("Comparar volumes", "Compare volumes")}</h3>` +
      `<div class="vol-lin"><span>${nomeVol(a)}</span><b>${fmtVol(va)}</b></div><div class="vol-lin"><span>${nomeVol(b)}</span><b>${fmtVol(vb)}</b></div>` +
      `<div class="medida">× ${fmtRazao(razao)}</div><p>${L("Volumes do modelo, calculados da própria forma 3D. Os valores reais aparecem na ficha de cada estrutura.", "Model volumes, computed from the 3D shapes themselves. Real values are in each structure's panel.")}</p>`;
  });
}
function medirTetra() {
  const n = regua.pontos.length, pt = regua.pontos[n - 1];
  for (let i = 0; i < n - 1; i++) linhaRegua([regua.pontos[i].p, pt.p]);
  if (n < 4) {
    cardRegua(() => `${L("Ponto", "Point")} ${n}: <b>${nomeP(pt)}</b>. ${n === 3 ? L("Falta 1 ponto.", "1 point to go.") : L(`Faltam ${4 - n} pontos.`, `${4 - n} points to go.`)}`);
    return;
  }
  const [A, B, C, D] = regua.pontos.map((q) => q.p);
  const u = B.clone().sub(A), v = C.clone().sub(A), w = D.clone().sub(A);
  const triplo = u.dot(v.clone().cross(w)), V = Math.abs(triplo) / 6;
  const g = new THREE.BufferGeometry().setFromPoints([A, B, C, A, B, D, A, C, D, B, C, D]);
  g.computeVertexNormals();
  const faces = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, depthTest: false }));
  faces.renderOrder = 45; grupos.regua.add(faces); regua.linhas.push(faces);
  rotuloMedida(() => fmtVol(V)); regua.rot.pos.copy(A).add(B).add(C).add(D).multiplyScalar(0.25);
  const nomes = () => regua.pontos.map((q) => nomeP(q)).join(", ");
  cardRegua(() => `${L("Tetraedro", "Tetrahedron")} (${nomes()}): <b>${fmtVol(V)}</b>. ` +
    (V < 0.05 ? L("Os pontos estão quase num mesmo plano, por isso o volume é tão pequeno. ", "The points are almost on one plane, so the volume is tiny. ") : "") +
    L("Clique de novo para uma nova medida.", "Click again for a new measurement."));
  somRegua(Math.cbrt(V) * 3);
  if (opc.nomes) falar(`${L("Volume do tetraedro", "Tetrahedron volume")}: ${fmtVol(V).replace("cm³", L("centímetros cúbicos", "cubic centimeters")).replace("mm³", L("milímetros cúbicos", "cubic millimeters"))}.`);
  setInfo(() => {
    infoEl.innerHTML = `<h3><i style="background:#F2B24A"></i>${L("Volume do tetraedro", "Tetrahedron volume")}</h3><p>${nomes()}</p><div class="medida">${fmtVol(V)}</div>` +
      `<p class="formula">V = |u · (v × w)| / 6</p><p class="formula">u = B−A, v = C−A, w = D−A</p>` +
      `<p>${L(`O produto misto u·(v×w) = ${NUM(triplo, 2)} cm³ é o determinante da matriz com u, v e w nas linhas: o volume do paralelepípedo formado por eles. O tetraedro ocupa 1/6 desse paralelepípedo. Somando tetraedros assim, um para cada triângulo da superfície, o modelo calcula o volume das estruturas.`,
        `The scalar triple product u·(v×w) = ${NUM(triplo, 2)} cm³ is the determinant of the matrix with u, v and w as rows: the volume of the parallelepiped they span. The tetrahedron fills 1/6 of it. Adding up tetrahedra like this, one per surface triangle, is how the model computes the volume of each structure.`)}</p>`;
  });
}

// =====================================================================  COMPARAR TAMANHOS (escala logarítmica)
const TAM = () => {
  const enc = grupos.cerebro.children.find((m) => m.userData.encefalo);
  return [
    { id: "nsq", nome: L("NSQ (cada)", "SCN (each)"), lo: 0.00025, hi: 0.00025, mod: volumeModelo("nsq").um },
    { id: "habenula", nome: L("Habênula (cada)", "Habenula (each)"), lo: 0.015, hi: 0.03, mod: volumeModelo("habenula").um },
    { id: "mamilares", nome: L("Corpo mamilar (cada)", "Mammillary body (each)"), lo: 0.045, hi: 0.085, mod: volumeModelo("mamilares").um },
    { id: "pineal", nome: "Pineal", lo: 0.05, hi: 0.2, mod: volumeModelo("pineal").total },
    { id: "adeno", nome: L("Hipófise", "Pituitary"), lo: 0.3, hi: 0.6, mod: volumeComparavel("adeno") },
    { id: "vent3", nome: L("3º ventrículo", "3rd ventricle"), lo: 0.5, hi: 1.0, mod: volumeModelo("vent3").total },
    { id: "aqueduto", nome: L("4º ventrículo", "4th ventricle"), lo: 0.9, hi: 1.6, mod: volumeModelo("aqueduto").total },
    { id: "amigdala", nome: L("Amígdala (cada)", "Amygdala (each)"), lo: 1.1, hi: 1.5, mod: volumeModelo("amigdala").um },
    { id: "hipocampo", nome: L("Hipocampo (cada)", "Hippocampus (each)"), lo: 3, hi: 4.5, mod: volumeModelo("hipocampo").um },
    { id: "talamo", nome: L("Tálamo (cada)", "Thalamus (each)"), lo: 5, hi: 7, mod: volumeModelo("talamo").um },
    { id: "olho", nome: L("Olho (cada)", "Eye (each)"), lo: 6.5, hi: 7.0, mod: volumeModelo("olho").um },
    { id: "ventlat", nome: L("Ventrículo lateral (cada)", "Lateral ventricle (each)"), lo: 7, hi: 10, mod: volumeModelo("ventlat").um },
    { id: "liquor", nome: L("Líquor total", "Total CSF"), lo: 125, hi: 150, mod: null },
    { id: "cerebelo", nome: L("Cerebelo", "Cerebellum"), lo: 105, hi: 150, mod: volumeModelo("cerebelo").total },
    { id: null, nome: L("Encéfalo", "Brain"), lo: 1130, hi: 1260, mod: enc && forma.atual !== "anat" ? volumeMalha(enc) + volumeModelo("cerebelo").total + volumeModelo("tronco").total : null },
  ];
};
const LOG0 = -4, LOG1 = 3.4, xLog = (v) => ((Math.log10(v) - LOG0) / (LOG1 - LOG0)) * 100;
function cardTam() {
  const itens = TAM();
  const marcas = [[0.001, "1 mm³"], [0.1, L("0,1 cm³", "0.1 cm³")], [10, "10 cm³"], [1000, L("1 litro", "1 liter")]];
  abrirCard(`<div class="kicker"><span>${L("Comparar tamanhos", "Compare sizes")}</span><span>${L("valores reais de adultos", "real adult values")}</span></div>
    <h3>${L("Do NSQ ao encéfalo: quase 7 ordens de grandeza", "From the SCN to the brain: almost 7 orders of magnitude")}</h3>
    <div class="tam">
      ${itens.map((it, i) => `<button type="button" class="tam-lin" data-acao="tamIr" data-i="${i}" ${it.id ? "" : "disabled"}>
        <span class="tam-nome">${it.nome}</span>
        <span class="tam-barra"><i class="tipico" style="width:${xLog(Math.sqrt(it.lo * it.hi)).toFixed(1)}%"></i>${it.hi > it.lo ? `<i class="faixa" style="left:${xLog(it.lo).toFixed(1)}%;width:${Math.max(xLog(it.hi) - xLog(it.lo), 0.8).toFixed(1)}%"></i>` : ""}${it.mod ? `<i class="mod" style="left:${xLog(it.mod).toFixed(1)}%" title="${L("modelo", "model")}: ${fmtVol(it.mod)}"></i>` : ""}</span>
        <span class="tam-val">${fmtFaixa(it.lo, it.hi)}</span></button>`).join("")}
      <div class="tam-eixo"><span></span><span class="tam-escala">${marcas.map(([v, t]) => `<em style="left:${xLog(v).toFixed(1)}%">${t}</em>`).join("")}</span><span></span></div>
    </div>
    <p class="tam-leg">${L("Escala logarítmica: de uma marca à seguinte, o volume cresce 100 vezes. Barra: valor típico; trecho claro: variação entre adultos; ◆: volume no modelo. Clique numa linha para ver a estrutura.",
      "Log scale: from one tick to the next, volume grows 100 times. Bar: typical value; bright part: range among adults; ◆: volume in the model. Click a row to see the structure.")}</p>
    <div class="acoes"><button type="button" class="esq" data-acao="sairTam">${L("Sair", "Exit")}</button></div>`);
}
acoes.tamIr = (b) => {
  const it = TAM()[+b.dataset.i];
  if (!it?.id) return;
  if (it.id === "liquor") { setCamada("c-liquor", true); mostrar("liquor"); voarParaId("vent3"); return; }
  ligarCamadaDe(it.id); destacar([it.id], true); mostrar(it.id); voarParaId(it.id);
};
acoes.sairTam = () => sairModos();

// =====================================================================  LÍQUOR EM MILILITROS
const liqBox = $("liq-box"), liq = { horas: 0, ultimo: 0 };
function textoLiq() {
  const mlProd = liq.horas * 20.8, renov = mlProd / 140;
  const vModelo = volumeModelo("ventlat").total + volumeModelo("vent3").total + volumeModelo("aqueduto").total;
  liqBox.innerHTML = `<b class="liq-tit">${L("Líquor (LCR) em mililitros", "CSF in milliliters")}</b>
    <span>${L("Ventrículos laterais", "Lateral ventricles")} ≈ ${L("7–10 mL cada", "7–10 mL each")} · 3º ≈ 0,5–1 · 4º ≈ 0,9–1,6</span>
    <span>${L("No corpo todo: ≈ 125–150 mL, quase tudo em volta do cérebro e da medula.", "Whole body: ≈ 125–150 mL, mostly around the brain and spinal cord.")}</span>
    <span>${L("Produção ≈ 20 mL por hora (≈ 500 mL por dia): o líquor se renova 3 a 4 vezes por dia.", "Production ≈ 20 mL per hour (≈ 500 mL per day): CSF is renewed 3 to 4 times a day.")}</span>
    <span class="liq-cont">${L("Desde que a camada foi ligada", "Since the layer was turned on")} (${NUM(liq.horas, 1)} h ${L("no relógio", "on the clock")}): <b>${numVol(mlProd)} mL</b> ${L("produzidos", "produced")} ≈ <b>${NUM(renov, 2)}</b> ${L("renovações", "renewals")}</span>
    <span class="liq-mut">${L("Ventrículos no modelo", "Ventricles in the model")}: ${numVol(vModelo)} mL</span>`.replace("0,5–1 · 4º ≈ 0,9–1,6", idioma === "en" ? "0.5–1 · 4th ≈ 0.9–1.6" : "0,5–1 · 4º ≈ 0,9–1,6").replace("3º ≈", idioma === "en" ? "3rd ≈" : "3º ≈");
}
function atualizarLiq(dt) {
  const ver = grupos.liquor.visible && !estado.embriao;
  liqBox.hidden = !ver;
  if (!ver) return;
  if (estado.tocando) liq.horas += dt * 1.1;
  const agora = performance.now();
  if (agora - liq.ultimo > 250) { liq.ultimo = agora; textoLiq(); }
}

$("b-regua").addEventListener("click", () => {
  if (estado.regua) { sairModos(); return; }
  sairModos(); marcarFerramenta("b-regua"); estado.regua = true;
  cardRegua(null);
});

// =====================================================================  JET LAG E TURNOS (mesmo modelo de fase do script em Python)
const JET = { DT: 1 / 30, TAU: 24.2, K: 0.3, f0: null, modo: "viagem", fusos: 6, oculos: false, folgas: false };
const prcJet = (fi) => Math.sin((2 * Math.PI * (fi - 2.3)) / 24);
const luzNormal = (h) => (h >= 7 && h < 18 ? 1000 : h >= 18 && h < 23 ? 30 : 0);
function luzTurno(h, dia) {
  if (JET.folgas && (dia % 7 === 5 || dia % 7 === 6)) return luzNormal(h); // sábado e domingo de folga
  if (h >= 23 || h < 7) return 300;                    // trabalho de madrugada
  if (h >= 7 && h < 8) return JET.oculos ? 50 : 1000;  // volta para casa de manhã
  if (h >= 8 && h < 15) return 0;                      // dorme de dia
  return 150;                                          // tarde e noite em casa
}
function simularDias(f, dias, luzFn) {
  const passos = Math.round(24 / JET.DT), out = [];
  for (let d = 0; d < dias; d++) {
    for (let i = 0; i < passos; i++) {
      const h = i * JET.DT, L = luzFn(h, d), fi = (((h + f) % 24) + 24) % 24;
      f += JET.DT * ((24 - JET.TAU) / JET.TAU + JET.K * (L / (L + 100)) * prcJet(fi));
    }
    out.push(f);
  }
  return out;
}
const envolver = (x) => ((((x + 12) % 24) + 24) % 24) - 12;
const dlmoLocal = (f) => { const v = (((20.2 - f) % 24) + 24) % 24; return v < 12 ? v + 24 : v; }; // eixo de 12h a 36h
const EXEMPLOS = { 2: "São Paulo → Nova York (inverno)", 3: "São Paulo → Lisboa", 4: "São Paulo → Paris", 7: "São Paulo → Dubai",
  11: "São Paulo → Pequim", 12: "São Paulo → Tóquio", "-2": "Nova York → São Paulo", "-3": "Lisboa → São Paulo", "-4": "Paris → São Paulo",
  "-5": "São Paulo → Los Angeles", "-12": "Tóquio → São Paulo" };
const EXEMPLOS_EN = { 2: "São Paulo → New York (winter)", 3: "São Paulo → Lisbon", 4: "São Paulo → Paris", 7: "São Paulo → Dubai",
  11: "São Paulo → Beijing", 12: "São Paulo → Tokyo", "-2": "New York → São Paulo", "-3": "Lisbon → São Paulo", "-4": "Paris → São Paulo",
  "-5": "São Paulo → Los Angeles", "-12": "Tokyo → São Paulo" };
function textoFusos(n) {
  if (n === 0) return L("Sem mudança de fuso", "No time-zone change");
  const a = Math.abs(n);
  if (idioma === "en") {
    const ex = EXEMPLOS_EN[n] ? ` (e.g. ${EXEMPLOS_EN[n]})` : "";
    return `${a} time ${a === 1 ? "zone" : "zones"} ${n > 0 ? "east" : "west"}${ex}`;
  }
  const dir = n > 0 ? "leste" : "oeste", ex = EXEMPLOS[n] ? ` (ex.: ${EXEMPLOS[n]})` : "";
  return `${a} ${a === 1 ? "fuso" : "fusos"} para ${dir}${ex}`;
}
function rodarJet() {
  if (JET.f0 === null) JET.f0 = simularDias(0, 40, luzNormal).at(-1);
  const res = card.querySelector("#jet-res");
  let serie, fantasma = null, alvo, rotuloAlvo, texto;
  if (JET.modo === "viagem") {
    const n = JET.fusos, dias = 16;
    serie = [JET.f0 - n, ...simularDias(JET.f0 - n, dias, luzNormal)];
    if (n !== 0) fantasma = [JET.f0 + n, ...simularDias(JET.f0 + n, dias, luzNormal)];
    alvo = dlmoLocal(JET.f0); rotuloAlvo = L("ajustado ao novo horário", "adjusted to the new time");
    const diasAte = (s) => { const i = s.findIndex((f) => Math.abs(envolver(f - JET.f0)) < 1); return i < 0 ? L("mais de 16", "more than 16") : String(i); };
    texto = n === 0 ? L("Sem mudança de fuso, o relógio já está ajustado.", "With no time-zone change, the clock is already adjusted.")
      : L(`<b>${textoFusos(n)}:</b> o relógio leva <b>${diasAte(serie)} dias</b> para ficar a menos de 1 h do novo horário. ` +
        `No sentido contrário (${n > 0 ? "oeste" : "leste"}, linha tracejada) seriam ${diasAte(fantasma)} dias: viajar para leste costuma ser mais difícil.`,
        `<b>${textoFusos(n)}:</b> the clock takes <b>${diasAte(serie)} days</b> to get within 1 h of the new time. ` +
        `In the opposite direction (${n > 0 ? "west" : "east"}, dashed line) it would take ${diasAte(fantasma)} days: flying east is usually harder.`);
  } else {
    const dias = 21;
    serie = [JET.f0, ...simularDias(JET.f0, dias, luzTurno)];
    alvo = 32.5; rotuloAlvo = L("ideal para quem dorme de dia", "ideal for daytime sleepers");
    const fim = dlmoLocal(serie.at(-1)), hh = String(Math.floor(fim % 24)).padStart(2, "0"), mm = String(Math.round((fim % 1) * 60)).padStart(2, "0");
    texto = idioma === "en"
      ? `Shift from 11 pm to 7 am, sleeping from 8 am to 3 pm${JET.oculos ? ", wearing sunglasses on the way home" : ", getting sun on the way home"}${JET.folgas ? " and taking weekends off" : ""}. ` +
        `After 3 weeks, melatonin starts at about <b>${hh}:${mm}</b>. ` +
        (JET.folgas ? "Days off pull the clock back every week: it never fully adjusts." : "Without days off, the clock almost flips over; in real life, days off and morning sun get in the way.")
      : `Turno de 23h às 7h, dormindo das 8h às 15h${JET.oculos ? ", com óculos escuros na volta" : ", pegando sol na volta"}${JET.folgas ? " e folgando no fim de semana" : ""}. ` +
        `Depois de 3 semanas, a melatonina começa por volta das <b>${hh}h${mm}</b>. ` +
        (JET.folgas ? "As folgas puxam o relógio de volta toda semana: ele nunca se acerta de vez." : "Sem folgas, o relógio quase se inverte; na vida real, as folgas e o sol da manhã atrapalham.");
  }
  res.innerHTML = texto;
  desenharJet(serie.map(dlmoLocal), fantasma && fantasma.map(dlmoLocal), alvo, rotuloAlvo);
}
function desenharJet(pts, fant, alvo, rotuloAlvo) {
  const cv = card.querySelector("#jet-cv"); if (!cv) return;
  const dpr = Math.min(window.devicePixelRatio, 2), w = cv.clientWidth, h = cv.clientHeight;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
  const ME = 38, R = 10, T = 10, B = 24, n = pts.length - 1;
  const X = (d) => ME + (d / n) * (w - ME - R), Y = (v) => T + ((36 - v) / 24) * (h - T - B);
  c.fillStyle = "rgba(60,196,162,0.14)"; c.fillRect(ME, Y(alvo + 1), w - ME - R, Y(alvo - 1) - Y(alvo + 1));
  c.fillStyle = "#3CC4A2"; c.font = "11px 'IBM Plex Sans', sans-serif"; c.textAlign = "right";
  c.fillText(rotuloAlvo, w - R - 4, Y(alvo + 1) - 4);
  c.fillStyle = "#98A4B8"; c.textAlign = "right";
  for (const v of [12, 18, 24, 30, 36]) {
    c.fillText(`${v % 24}h`, ME - 6, Y(v) + 4);
    c.strokeStyle = "rgba(255,255,255,0.06)"; c.beginPath(); c.moveTo(ME, Y(v)); c.lineTo(w - R, Y(v)); c.stroke();
  }
  c.textAlign = "center";
  for (let d = 0; d <= n; d += n > 16 ? 3 : 2) c.fillText(`${d}`, X(d), h - 8);
  c.fillText(L("dias", "days"), ME - 18, h - 8);
  const linha = (arr, cor, trac) => {
    c.strokeStyle = cor; c.lineWidth = 2; c.setLineDash(trac ? [5, 4] : []); c.beginPath();
    arr.forEach((v, d) => { const x = X(d), y = Y(v); d && Math.abs(v - arr[d - 1]) < 12 ? c.lineTo(x, y) : c.moveTo(x, y); });
    c.stroke(); c.setLineDash([]);
    if (!trac) { c.fillStyle = cor; arr.forEach((v, d) => { c.beginPath(); c.arc(X(d), Y(v), 2.6, 0, Math.PI * 2); c.fill(); }); }
  };
  if (fant) linha(fant, "rgba(163,155,242,0.75)", true);
  linha(pts, "#F2B24A", false);
  c.save(); c.translate(11, T + (h - T - B) / 2); c.rotate(-Math.PI / 2); c.fillStyle = "#98A4B8"; c.fillText(L("início da melatonina", "melatonin onset"), 0, 0); c.restore();
}
function cardJet() {
  abrirCard(`<div class="kicker"><span>${L("Jet lag e turnos", "Jet lag and shifts")}</span><span>${L("modelo didático", "teaching model")}</span></div>
    <h3>${L("Quantos dias o relógio leva para se acertar?", "How many days does the clock take to adjust?")}</h3>
    <div class="seg" role="group" aria-label="${L("Cenário", "Scenario")}"><button type="button" data-acao="jetModo" data-m="viagem" aria-pressed="${JET.modo === "viagem"}">${L("Viagem", "Trip")}</button><button type="button" data-acao="jetModo" data-m="turno" aria-pressed="${JET.modo === "turno"}">${L("Turno noturno", "Night shift")}</button></div>
    <div class="controles">${JET.modo === "viagem"
      ? `<label for="jet-fusos">${L("Fusos", "Time zones")} <input type="range" id="jet-fusos" min="-12" max="12" step="1" value="${JET.fusos}"></label><span id="jet-fusos-txt">${textoFusos(JET.fusos)}</span>`
      : `<label for="jet-oculos"><input type="checkbox" id="jet-oculos" ${JET.oculos ? "checked" : ""}> ${L("Óculos escuros na volta para casa", "Sunglasses on the way home")}</label><label for="jet-folgas"><input type="checkbox" id="jet-folgas" ${JET.folgas ? "checked" : ""}> ${L("Folgas no fim de semana", "Weekends off")}</label>`}</div>
    <canvas id="jet-cv" style="height:190px"></canvas>
    <p class="resultado" id="jet-res"></p>
    <div class="acoes"><button type="button" class="esq" data-acao="sairJet">${L("Sair", "Exit")}</button></div>`);
  rodarJet();
}
acoes.jetModo = (b) => { JET.modo = b.dataset.m; cardJet(); };
acoes.sairJet = () => sairModos();
card.addEventListener("input", (e) => {
  if (e.target.id === "jet-fusos") { JET.fusos = parseInt(e.target.value, 10); card.querySelector("#jet-fusos-txt").textContent = textoFusos(JET.fusos); rodarJet(); }
});
card.addEventListener("change", (e) => {
  if (e.target.id === "jet-oculos") { JET.oculos = e.target.checked; rodarJet(); }
  if (e.target.id === "jet-folgas") { JET.folgas = e.target.checked; rodarJet(); }
});
$("b-tam").addEventListener("click", () => {
  if (estado.tam) { sairModos(); return; }
  sairModos(); marcarFerramenta("b-tam"); estado.tam = true; cardTam();
});
$("b-jet").addEventListener("click", () => {
  if (estado.jet) { sairModos(); return; }
  sairModos(); marcarFerramenta("b-jet"); estado.jet = true; cardJet();
  mostrar("nsq");
});

// =====================================================================  REDE DO NSQ (modelo de Kuramoto)
const KURA = { N: 200, theta: null, omega: null, t: 0, K: 0.06, ciclo: false, hist: [], psiAnt: null, psiAcum: 0, tAcum: 0, periodo: null, r: 0, psi: 0 };
function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function iniciarKura(embaralhar = true) {
  const w0 = (2 * Math.PI) / 24.2;
  if (!KURA.omega) { KURA.omega = new Float64Array(KURA.N); for (let i = 0; i < KURA.N; i++) KURA.omega[i] = w0 * (1 + 0.04 * gauss()); }
  if (embaralhar || !KURA.theta) { KURA.theta = new Float64Array(KURA.N); for (let i = 0; i < KURA.N; i++) KURA.theta[i] = Math.random() * 2 * Math.PI; }
  KURA.hist = []; KURA.psiAnt = null; KURA.psiAcum = 0; KURA.tAcum = 0; KURA.periodo = null;
}
function ordem() {
  let sx = 0, sy = 0;
  for (let i = 0; i < KURA.N; i++) { sx += Math.cos(KURA.theta[i]); sy += Math.sin(KURA.theta[i]); }
  KURA.r = Math.hypot(sx, sy) / KURA.N; KURA.psi = Math.atan2(sy, sx);
}
function passoKura(horas) {
  const sub = Math.max(1, Math.ceil(horas / 0.1)), dt = horas / sub, F = 0.03;
  for (let k = 0; k < sub; k++) {
    ordem();
    const diaClaro = KURA.ciclo && (((KURA.t % 24) + 24) % 24) >= 7 && (((KURA.t % 24) + 24) % 24) < 18;
    const alvoLuz = (2 * Math.PI * KURA.t) / 24;
    for (let i = 0; i < KURA.N; i++) {
      let d = KURA.omega[i] + KURA.K * KURA.r * Math.sin(KURA.psi - KURA.theta[i]);
      if (diaClaro) d += F * Math.sin(alvoLuz - KURA.theta[i]);
      KURA.theta[i] += d * dt;
    }
    KURA.t += dt;
  }
  ordem();
  if (KURA.psiAnt !== null) {
    KURA.psiAcum += envolverRad(KURA.psi - KURA.psiAnt); KURA.tAcum += horas;
    if (KURA.tAcum >= 48) { KURA.periodo = KURA.r > 0.3 ? (2 * Math.PI * KURA.tAcum) / KURA.psiAcum : null; KURA.psiAcum = 0; KURA.tAcum = 0; }
  }
  KURA.psiAnt = KURA.psi;
  KURA.hist.push([KURA.t, KURA.r]);
  while (KURA.hist.length && KURA.t - KURA.hist[0][0] > 240) KURA.hist.shift();
}
const envolverRad = (x) => Math.atan2(Math.sin(x), Math.cos(x));
function pulsoLuz() {
  const alvo = (2 * Math.PI * KURA.t) / 24 + Math.PI / 2;
  for (let i = 0; i < KURA.N; i++) KURA.theta[i] -= 0.9 * Math.sin(KURA.theta[i] - alvo);
  if (som.ligado && opc.clique) tom(1800, { queda: 0.4, vol: 0.06 });
}
function desenharKura() {
  const cv = card.querySelector("#kura-cv"); if (!cv) return;
  const dpr = Math.min(window.devicePixelRatio, 2), w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
  const R = Math.min(h / 2 - 16, 90), cx = R + 22, cy = h / 2;
  c.strokeStyle = "rgba(255,255,255,0.12)"; c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
  const w0 = (2 * Math.PI) / 24.2;
  for (let i = 0; i < KURA.N; i++) {
    const a = KURA.theta[i], dev = (KURA.omega[i] - w0) / (w0 * 0.08);
    const hue = 200 - Math.max(-1, Math.min(1, dev)) * 170;
    c.fillStyle = `hsl(${hue}, 75%, 62%)`;
    c.beginPath(); c.arc(cx + R * Math.sin(a), cy - R * Math.cos(a), 3, 0, Math.PI * 2); c.fill();
  }
  c.strokeStyle = "#F2B24A"; c.lineWidth = 3; c.beginPath(); c.moveTo(cx, cy);
  c.lineTo(cx + R * KURA.r * Math.sin(KURA.psi), cy - R * KURA.r * Math.cos(KURA.psi)); c.stroke();
  c.fillStyle = "#F2B24A"; c.beginPath(); c.arc(cx + R * KURA.r * Math.sin(KURA.psi), cy - R * KURA.r * Math.cos(KURA.psi), 4, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#98A4B8"; c.font = "11px 'IBM Plex Sans', sans-serif"; c.textAlign = "center";
  c.fillText(L("fase de cada neurônio", "phase of each neuron"), cx, h - 3);
  // r(t) nos últimos 10 dias
  const x0 = cx + R + 40, x1 = w - 10, y0 = 14, y1 = h - 22;
  c.strokeStyle = "rgba(255,255,255,0.08)";
  for (const v of [0, 0.5, 1]) { const y = y1 - v * (y1 - y0); c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke(); c.textAlign = "right"; c.fillText(L(String(v).replace(".", ","), String(v)), x0 - 4, y + 4); }
  const tF = KURA.t, tI = tF - 240, X = (t) => x0 + ((t - tI) / 240) * (x1 - x0);
  if (KURA.ciclo) {
    c.fillStyle = "rgba(246,215,122,0.10)";
    for (let d = Math.floor(tI / 24); d <= Math.ceil(tF / 24); d++) { const a = Math.max(X(d * 24 + 7), x0), b = Math.min(X(d * 24 + 18), x1); if (b > a) c.fillRect(a, y0, b - a, y1 - y0); }
  }
  c.strokeStyle = "#F2B24A"; c.lineWidth = 1.8; c.beginPath();
  KURA.hist.forEach(([t, r], i) => { const x = X(t), y = y1 - r * (y1 - y0); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke();
  c.textAlign = "center"; c.fillStyle = "#98A4B8";
  c.fillText(L("sincronia r nos últimos 10 dias", "synchrony r over the last 10 days"), (x0 + x1) / 2, h - 3);
  const txt = card.querySelector("#kura-txt");
  if (txt) txt.innerHTML = `r = <b>${NUM(KURA.r, 2)}</b> · ${KURA.r > 0.8 ? L("rede sincronizada", "network in sync") : KURA.r > 0.4 ? L("sincronizando", "syncing") : L("neurônios desencontrados", "neurons out of step")}` +
    ` · ${L("período coletivo", "collective period")} ${KURA.periodo ? `<b>${NUM(KURA.periodo, 1)} h</b>` : "—"} · ${L("dia", "day")} ${Math.floor(KURA.t / 24) + 1}`;
}
function cardKura() {
  abrirCard(`<div class="kicker"><span>${L("Rede do NSQ", "SCN network")}</span><span>${L("modelo de Kuramoto", "Kuramoto model")}</span></div>
    <h3>${L("Milhares de relógios que entram em sincronia", "Thousands of clocks falling into sync")}</h3>
    <p>${L("Cada ponto é um neurônio do NSQ com o seu próprio período (de ~23 a ~26 h; azul = mais rápido, laranja = mais lento). O acoplamento K puxa cada um para a fase média da rede; a seta mostra essa média (comprimento = sincronia r).",
      "Each dot is an SCN neuron with its own period (from ~23 to ~26 h; blue = faster, orange = slower). The coupling K pulls each one toward the network's mean phase; the arrow shows that mean (length = synchrony r).")}</p>
    <p class="formula">dθᵢ/dt = ωᵢ + K·r·sin(ψ − θᵢ)</p>
    <canvas id="kura-cv" style="height:210px"></canvas>
    <div class="controles">
      <label for="kura-k">${L("Acoplamento K", "Coupling K")} <input type="range" id="kura-k" min="0" max="0.12" step="0.001" value="${KURA.K}"></label><span id="kura-k-txt"></span>
      <label for="kura-ciclo"><input type="checkbox" id="kura-ciclo" ${KURA.ciclo ? "checked" : ""}> ${L("Ciclo de luz diário", "Daily light cycle")}</label>
    </div>
    <p class="resultado" id="kura-txt"></p>
    <div class="acoes"><button type="button" class="esq" data-acao="sairKura">${L("Sair", "Exit")}</button><button type="button" data-acao="embaralharKura">${L("Embaralhar fases", "Shuffle phases")}</button><button type="button" class="primario" data-acao="pulsoKura">${L("Pulso de luz", "Light pulse")}</button></div>`);
  atualizarTextoK();
}
function atualizarTextoK() {
  const el = card.querySelector("#kura-k-txt");
  if (el) el.textContent = `K = ${NUM(KURA.K, 3)} (${L("crítico", "critical")} ≈ ${NUM(0.017, 3)})`;
}
acoes.sairKura = () => sairModos();
acoes.embaralharKura = () => iniciarKura(true);
acoes.pulsoKura = () => pulsoLuz();
card.addEventListener("input", (e) => { if (e.target.id === "kura-k") { KURA.K = parseFloat(e.target.value); atualizarTextoK(); } });
card.addEventListener("change", (e) => { if (e.target.id === "kura-ciclo") KURA.ciclo = e.target.checked; });
$("b-kura").addEventListener("click", () => {
  if (estado.kura) { sairModos(); return; }
  sairModos(); marcarFerramenta("b-kura"); estado.kura = true;
  iniciarKura(true); cardKura(); mostrar("nsq");
  voarPara([6.98, 0.33, 0], [0.9, 0.35, 1], 17);
});
function brilhoNSQ(ativo) {
  for (const m of porId.get("nsq") || []) {
    guardar(m);
    if (ativo) { m.material.emissive.set(0x3cc4a2); m.material.emissiveIntensity = 0.2 + 1.6 * KURA.r * (0.5 + 0.5 * Math.cos(KURA.psi)); }
    else { m.material.emissive.copy(m.userData.em0); m.material.emissiveIntensity = m.userData.ei0; }
  }
}

// =====================================================================  CLIQUE
const ray = new THREE.Raycaster();
const ponteiro = new THREE.Vector2();
let baixo = null;
renderer.domElement.addEventListener("pointerdown", (e) => { baixo = [e.clientX, e.clientY]; });
const tamanho = (o) => { o.geometry.computeBoundingSphere(); return o.geometry.boundingSphere.radius * Math.max(o.scale.x, o.scale.y, o.scale.z); };
// estrutura sob o cursor, preferindo as pequenas (pineal, NSQ...) quando o centro delas está a menos de 22 px
function acharHit(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ponteiro.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ponteiro, camera);
  const hits = ray.intersectObjects(pickables.filter((m) => visivel(m) && noIsolar(m)), false).filter((h) => {
    if (estado.corte === "nenhum" || !clipaveis.includes(h.object)) return true;
    return planoCorte.distanceToPoint(h.point) >= 0;
  });
  if (!hits.length) return null;
  // 1º: estrutura pequena cujo centro está bem embaixo do cursor, mesmo atrás de outra translúcida (ex.: pineal atrás do tálamo)
  const W = r.width, H = r.height, cx = e.clientX - r.left, cy = e.clientY - r.top;
  let hit = null, melhor = 22;
  for (const h of hits) {
    if (h.object.userData.curve || tamanho(h.object) > 0.9) continue;
    tmpV.copy(centroDe(h.object)).project(camera);
    const d = Math.hypot((tmpV.x * 0.5 + 0.5) * W - cx, (-tmpV.y * 0.5 + 0.5) * H - cy);
    if (d < melhor) { melhor = d; hit = h; }
  }
  // 2º: entre o que está quase na mesma profundidade, a menor estrutura
  if (!hit) {
    const perto = hits.filter((h) => h.distance <= hits[0].distance + 2.2 && !h.object.userData.curve);
    hit = perto.length ? perto.reduce((a, b) => (tamanho(b.object) < tamanho(a.object) ? b : a)) : hits[0];
  }
  return hit;
}
renderer.domElement.addEventListener("pointerup", (e) => {
  if (!baixo || Math.hypot(e.clientX - baixo[0], e.clientY - baixo[1]) > 5) return;
  if (estado.quiz || estado.embriao) return;
  const hit = acharHit(e);
  if (!hit) return;
  if (estado.regua) { medir(hit); return; }
  selecionarId(hit.object.userData.id, true);
});
// duplo clique: a câmera voa até a estrutura e para perto dela (distância conforme o tamanho)
function voarParaObjeto(m, ponto = null) {
  const alvo = ponto && m.userData.curve ? ponto.clone() : centroDe(m);
  const dist = Math.min(Math.max(tamanho(m) * 9, 5), 40);
  const dir = camera.position.clone().sub(controls.target).normalize();
  if (!card.hidden) alvo.y += folgaCartao(dist);
  voar(alvo.clone().addScaledVector(dir, dist), alvo);
  marcarVista("");
  if (opc.clique) tom(320, { f2: 900, queda: 0.28, vol: 0.045, filtro: ["lowpass", 1800] });
}
function voarParaId(id) {
  if (estado.quiz || estado.embriao) return;
  const m = (porId.get(id) || []).find(visivel);
  if (m) voarParaObjeto(m);
}
renderer.domElement.addEventListener("dblclick", (e) => {
  if (estado.quiz || estado.embriao) return;
  const hit = acharHit(e);
  if (hit) voarParaObjeto(hit.object, hit.point);
});
function selecionarId(id, viaCena = false) {
  if (!id || estado.quiz || estado.embriao) return;
  if (estado.regua && !viaCena) {
    const m = (porId.get(id) || []).find(visivel);
    if (m) medir({ object: m, point: centroDe(m) });
    return;
  }
  if (esfera.id && esfera.id !== id) removerEsfera();
  destacar([id], false);
  mostrar(id);
  somEstrutura(id);
  const d = infoDe(id);
  if (opc.nomes && d) falar(`${d[0]}. ${d[2]}`);
}

// =====================================================================  SALVAR / COPIAR IMAGEM (cena 3D + rótulos)
const imgTxt = $("img-txt");
function pilula(c, x, y, w, h) {
  const r = h / 2;
  c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  c.lineTo(x + r, y + h); c.arc(x + r, y + r, r, Math.PI / 2, (3 * Math.PI) / 2); c.closePath();
}
function comporImagem() {
  renderer.render(scene, camera); // lê o quadro logo depois de desenhar, antes de o navegador limpá-lo
  const src = renderer.domElement, dpr = renderer.getPixelRatio(), W = src.width, H = src.height;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const c = cv.getContext("2d");
  const g = c.createRadialGradient(W * 0.55, H * 0.4, 0, W * 0.55, H * 0.4, Math.max(W, H) * 0.7);
  g.addColorStop(0, "#16213A"); g.addColorStop(1, "#0C121D");
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.drawImage(src, 0, 0);
  c.scale(dpr, dpr);
  for (const r of ROT) {
    if (r.el.style.display !== "flex") continue;
    const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(r.el.style.transform);
    if (!m) continue;
    const x = +m[1], y = +m[2], w = r.el.offsetWidth, h = r.el.offsetHeight;
    if (r.linha.style.display !== "none") {
      c.strokeStyle = r.cor; c.globalAlpha = 0.75; c.lineWidth = 1;
      c.beginPath(); c.moveTo(+r.linha.getAttribute("x1"), +r.linha.getAttribute("y1")); c.lineTo(+r.linha.getAttribute("x2"), +r.linha.getAttribute("y2")); c.stroke();
      c.globalAlpha = 1; c.fillStyle = r.cor;
      c.beginPath(); c.arc(+r.ponto.getAttribute("cx"), +r.ponto.getAttribute("cy"), 2.6, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = "rgba(12,18,29,0.88)"; c.strokeStyle = "rgba(255,255,255,0.16)"; c.lineWidth = 1;
    pilula(c, x, y, w, h); c.fill(); c.stroke();
    c.fillStyle = r.cor; c.beginPath(); c.arc(x + 12, y + h / 2, 3.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#E6EBF2"; c.font = "12px 'IBM Plex Sans', 'Segoe UI', sans-serif"; c.textBaseline = "middle";
    c.fillText(r.el.textContent.trim(), x + 21, y + h / 2 + 0.5);
  }
  c.fillStyle = "rgba(230,235,242,0.75)"; c.font = "13px 'IBM Plex Sans', 'Segoe UI', sans-serif"; c.textBaseline = "alphabetic";
  c.fillText(forma.atual === "anat" ? L("Cabeça humana · modelo 3D, forma anatômica (BodyParts3D, CC BY 4.0) · v2.1", "Human head · 3D model, anatomical form (BodyParts3D, CC BY 4.0) · v2.1") : L("Cabeça humana · modelo 3D esquemático · v2.1", "Human head · schematic 3D model · v2.1"), 16, H / dpr - 16);
  return cv;
}
// na página publicada o download passa pela confirmação do próprio Claude (capacidade "downloads");
// no seu servidor, é um download comum do navegador
let salvarCap = null;
if (window.claude?.use) window.claude.use("downloads").then((d) => { salvarCap = d; }).catch(() => {});
$("b-salvar").addEventListener("click", () => {
  comporImagem().toBlob((blob) => {
    if (!blob) return;
    const nome = `cabeca3d-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.png`;
    if (salvarCap) {
      salvarCap.save({ filename: nome, data: blob })
        .then(() => { imgTxt.textContent = L("Imagem PNG salva.", "PNG image saved."); })
        .catch((e) => { imgTxt.textContent = e?.code === "declined" ? L("Download cancelado.", "Download canceled.") : L("Não foi possível salvar aqui; use Copiar imagem.", "Could not save here; use Copy image."); });
      return;
    }
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    imgTxt.textContent = window.self !== window.top
      ? L("Aqui na página publicada o navegador pode bloquear o download; use Copiar imagem.", "On the published page the browser may block downloads; use Copy image.")
      : L("Imagem PNG salva na pasta de downloads.", "PNG image saved to your downloads folder.");
  }, "image/png");
});
$("b-copiar").addEventListener("click", () => {
  if (!window.isSecureContext || !navigator.clipboard?.write || !window.ClipboardItem) {
    imgTxt.textContent = L("Copiar imagem só funciona em https ou em localhost. No seu servidor (http), use Salvar imagem.",
      "Copying images only works on https or localhost. On your server (http), use Save image.");
    return;
  }
  const cv = comporImagem();
  navigator.clipboard.write([new ClipboardItem({ "image/png": new Promise((res) => cv.toBlob(res, "image/png")) })])
    .then(() => { imgTxt.textContent = L("Imagem copiada: cole com Ctrl+V.", "Image copied: paste with Ctrl+V."); })
    .catch(() => { imgTxt.textContent = L("O navegador não permitiu copiar a imagem.", "The browser did not allow copying the image."); });
});

// ---------- manual: a página e o PDF abrem numa aba nova (na página publicada no Claude, o PDF é baixado com confirmação)
$("b-manual").addEventListener("click", () => {
  const w = window.open("manual/manual.html", "_blank");
  if (!w) location.href = "manual/manual.html";
});
$("b-manual-pdf").addEventListener("click", async () => {
  const nome = "Manual_Cabeca3D_v2.1.pdf";
  if (salvarCap) {
    try {
      const blob = await (await fetch("manual/manual.pdf")).blob();
      await salvarCap.save({ filename: nome, data: blob });
      imgTxt.textContent = L("Manual em PDF salvo.", "PDF manual saved.");
    } catch (e) { if (e?.code !== "declined") imgTxt.textContent = L("Não foi possível baixar o PDF aqui.", "Could not download the PDF here."); }
    return;
  }
  // no servidor e no GitHub Pages: abre o PDF numa aba nova (dali dá para ler, imprimir ou salvar)
  const w = window.open("manual/manual.pdf", "_blank");
  if (!w) location.href = "manual/manual.pdf";
});

// =====================================================================  MENU RETRÁTIL
const appEl = document.querySelector(".app"), botaoMenu = $("b-menu");
function textoMenu() {
  const aberto = !appEl.classList.contains("recolhido");
  botaoMenu.querySelector(".txt").textContent = aberto ? L("Recolher", "Collapse") : "Menu";
  botaoMenu.title = aberto ? L("Recolher o menu (tecla M)", "Collapse the menu (M key)") : L("Abrir o menu (tecla M)", "Open the menu (M key)");
}
function setMenu(aberto) {
  appEl.classList.toggle("recolhido", !aberto);
  botaoMenu.setAttribute("aria-expanded", String(aberto));
  textoMenu();
  try { localStorage.setItem("menuAberto", aberto ? "1" : "0"); } catch (e) { /* sem armazenamento */ }
}
botaoMenu.addEventListener("click", () => setMenu(appEl.classList.contains("recolhido")));
document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() !== "m" || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest("input, select, textarea")) return;
  setMenu(appEl.classList.contains("recolhido"));
});
try { if (localStorage.getItem("menuAberto") === "0") setMenu(false); } catch (e) { /* sem armazenamento */ }

// =====================================================================  RESTAURAR PADRÃO
const CAMADAS_PADRAO = { "c-pele": true, "c-cerebro": true, "c-vent": true, "c-vasos": true, "c-planos": true, "c-circ": true,
  "c-liquor": false, "c-porta": false, "c-simbolo": true, "c-cortex": false, "c-visao": false, "c-limbico": false, "c-papez": false, "c-cranio": false, "c-rot": true };
const SOM_PADRAO = { "g-efeitos": true, "s-clique": true, "s-circ": true, "s-emb": true, "g-voz": true, "s-nomes": true, "s-tour": true,
  "s-auto": false, "g-amb": true, "s-dia": true, "s-liq": true, "s-mel": false };
function restaurarTudo() {
  sairModos();
  setCorte("nenhum");
  setIsolar("");
  if (forma.atual !== "esq") setForma("esq");
  atualizarEmbriao(0); estado.embPlay = false;
  for (const [id, v] of Object.entries(CAMADAS_PADRAO)) setCamada(id, v);
  rotinaEl.value = "escura"; estado.rotina = "escura";
  setHora(23); setTocando(!reduz);
  if (som.ligado) setSom(false);
  for (const [id, v] of Object.entries(SOM_PADRAO)) $(id).checked = v;
  lerOpcoes();
  volEl.value = "0.6";
  posCard.x = posCard.y = null; aplicarPosCard();
  quiz.acertos = 0; quiz.total = 0; som.sequencia = 0; regua.modo = "dist";
  restaurarDestaque(); mostrar("pineal");
  setMenu(true);
  try { localStorage.removeItem("menuAberto"); } catch (e) { /* sem armazenamento */ }
  marcarVista("tres"); voar(...VISTAS.tres);
}
{
  const b = $("b-reset"), txt = $("reset-txt");
  let timer = null;
  b.addEventListener("click", () => {
    if (!b.classList.contains("confirmar")) {
      b.classList.add("confirmar"); b.textContent = L("Clique de novo para confirmar", "Click again to confirm");
      timer = setTimeout(() => { b.classList.remove("confirmar"); textoReset(); }, 4000);
      return;
    }
    clearTimeout(timer);
    b.classList.remove("confirmar");
    restaurarTudo();
    textoReset();
    txt.textContent = L("Pronto: tudo voltou ao padrão.", "Done: everything is back to default.");
    setTimeout(() => { aplicarHTML(); }, 3000);
  });
}

// =====================================================================  IDIOMA (PT / EN)
// Textos fixos do HTML: [seletor, inglês]. O português é lido do próprio HTML na abertura.
const I18N = [
  ["#painel h1", "Human head"],
  ["#painel .lead", "3D model with the same measurements as the posters, as geometric solids or as real anatomical shapes. Drag to rotate, scroll to zoom and click a structure to see what it does."],
  ["#t-explorar", "Explore"], ["#b-tour", "Guided tour"], ["#b-quiz", "Quiz"], ["#b-embriao", "Embryo mode"], ["#b-regua", "Ruler"],
  ["#b-tam", "Sizes"], ["#b-kura", "SCN network"], ["#b-jet", "Jet lag and shifts"],
  ["#t-som", "Sound"], ["#b-testar", "Test"], ["label[for=som-vol]", "Volume"],
  ["label[for=g-efeitos]", "Effects"], ["label[for=s-clique]", "Clicks, quiz and ruler"], ["label[for=s-circ]", "Audible circuit (pings, clicks, drops)"],
  ["label[for=s-emb]", "Embryo with heartbeat"], ["label[for=g-voz]", "Voice"], ["label[for=s-nomes]", "Names on click"],
  ["label[for=s-tour]", "Tour narration"], ["label[for=s-auto]", "Tour advances by itself"], ["label[for=g-amb]", "Ambience"],
  ["label[for=s-dia]", "Day and night"], ["label[for=s-liq]", "Pulsing CSF"], ["label[for=s-mel]", "Melatonin melody"],
  ["#t-vista", "View"], ["#vistas [data-v=perfil]", "Side"], ["#vistas [data-v=frente]", "Front"], ["#vistas [data-v=topo]", "Top"],
  ["#b-salvar", "Save image"], ["#b-copiar", "Copy image"],
  ["#t-corte", "Cut"], ["#cortes [data-c=nenhum]", "None"], ["#cortes [data-c=sagital]", "Side"], ["#cortes [data-c=coronal]", "Front"], ["#cortes [data-c=axial]", "Top"],
  ["#t-relogio", "24-hour clock"], ["label[for=rotina]", "Routine"],
  ["#rotina [value=escura]", "Dark night"], ["#rotina [value=telas1]", "Light and screens until 1 am (1st night)"],
  ["#rotina [value=telas14]", "Light and screens until 1 am (after 2 weeks)"],
  ["#ritmos-leg + .cap", "Teaching model, from noon to noon, all driven by the SCN; approximate adult values. Shaded band: the routine's sleep time. Dashed line: melatonin on a dark night, for comparison."],
  ["#t-camadas", "Layers"], ["label[for=c-pele]", "Skin"], ["label[for=c-cerebro]", "Brain"], ["label[for=c-vent]", "Ventricles"],
  ["label[for=c-vasos]", "Vessels"], ["label[for=c-planos]", "Planes"], ["label[for=c-circ]", "Circuit"], ["label[for=c-liquor]", "CSF flow"],
  ["label[for=c-porta]", "Portal system"], ["label[for=c-simbolo]", "Symbolic layer"], ["label[for=c-rot]", "Labels"],
  ["label[for=c-cortex]", "Cortex (lobes)"], ["label[for=c-visao]", "Visual pathway"], ["label[for=c-limbico]", "Limbic system"], ["label[for=c-papez]", "Papez circuit"],
  ["#t-novas", "Extra layers"], ["label[for=isolar]", "Isolate layer"], ["#isolar [value='']", "None"], ["#isolar [value=cortex]", "Cortex (lobes)"],
  ["#isolar [value=visao]", "Visual pathway"], ["#isolar [value=limbico]", "Limbic system"], ["#isolar [value=porta]", "Portal system"],
  ["#isolar [value=vent]", "Ventricles"], ["#isolar [value=vasos]", "Vessels"], ["#isolar [value=circ]", "Circuit"],
  ["#isolar [value=cranio]", "Skull"], ["label[for=c-cranio]", "Skull (real bones)"], ["#t-forma", "Shape"],
  ["#forma [data-f=esq]", "Schematic"], ["#forma [data-f=anat]", "Anatomical"],
  ["#t-info", "Selected structure"], ["#t-config", "Settings"],
  ["#reset-txt", "Resets everything: view, cut, clock, layers, sound, menu and card positions."],
  ["#b-manual", "Manual"], ["#b-manual-pdf", "Manual (PDF)"],
  ["#rod-tit", "© 2026 3D Head: pineal and pituitary · v2.1. All rights reserved."],
  ["#rod-aviso", "The information in this model is for educational and study purposes only and is not a diagnosis, medical advice or recommendation. Measurements are approximate and shapes are schematic; real values come from published studies and vary between people. The symbolic layer gathers readings from spiritual traditions, with no physiological evidence."],
  ["#rod-cri", "Created by Francisco Campos de Carvalho, email:"],
  ["#rod-anat1", "Anatomical form: meshes from"], ["#rod-anat2", ", © The Database Center for Life Science, CC BY 4.0 license; reduced and fitted to this model's coordinates."],
  ["#rod-form", "Bachelor's degree in Mathematics and postgraduate degree in Information Systems and Databases."],
  [".hint", "Drag to rotate, scroll to zoom, click a structure, double-click to fly to it"],
  ["#legenda span:nth-child(1)", "light: retina → SCN"], ["#legenda span:nth-child(2)", "nerve signal to the pineal"], ["#legenda span:nth-child(3)", "melatonin"],
];
const I18N_ATTR = [
  ["#cortes", "aria-label", "Cut plane"], ["#corte-pos", "aria-label", "Cut position"], ["#slider", "aria-label", "Time of day"],
  ["#ritmos", "aria-label", "Melatonin, cortisol, temperature and sleep-pressure curves over 24 hours"],
];
// troca só o texto visível (o nó de texto), sem mexer em caixas de seleção ou ícones dentro do elemento
function noTexto(el) { for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue.trim()) return n; return null; }
const I18N_PT = I18N.map(([sel]) => { const el = document.querySelector(sel), n = el && noTexto(el); return n ? n.nodeValue.trim() : null; });
const I18N_ATTR_PT = I18N_ATTR.map(([sel, a]) => document.querySelector(sel)?.getAttribute(a) ?? null);
function aplicarHTML() {
  I18N.forEach(([sel, en], i) => {
    const el = document.querySelector(sel), n = el && noTexto(el);
    if (!n || I18N_PT[i] === null) return;
    n.nodeValue = n.nodeValue.replace(n.nodeValue.trim(), idioma === "en" ? en : I18N_PT[i]);
  });
  I18N_ATTR.forEach(([sel, a, en], i) => { const el = document.querySelector(sel); if (el && I18N_ATTR_PT[i] !== null) el.setAttribute(a, idioma === "en" ? en : I18N_ATTR_PT[i]); });
}
function textoReset() { $("b-reset").textContent = L("Restaurar padrão", "Restore defaults"); }
function aplicarIdioma(novo) {
  idioma = novo === "en" ? "en" : "pt";
  try { localStorage.setItem("idioma", idioma); } catch (e) { /* sem armazenamento */ }
  document.documentElement.lang = L("pt-BR", "en");
  document.title = L("Cabeça 3D: pineal e hipófise", "3D head: pineal and pituitary");
  document.querySelectorAll("#idioma button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.l === idioma)));
  aplicarHTML();
  for (const r of ROT) if (r.texto) textoRotulo(r);
  if (regua.rotFn) rotuloMedida(regua.rotFn);
  if (esfera.rotFn) { esfera.rot.el.innerHTML = `<i style="background:#F2B24A"></i>${esfera.rotFn()}`; esfera.rot.w = 0; }
  if (!liqBox.hidden) textoLiq();
  textoForma();
  setTocando(estado.tocando);
  botaoSom.textContent = som.ligado ? L("Desligar som", "Turn sound off") : L("Ligar som", "Turn sound on");
  textoMenu(); textoReset(); textoCorte();
  atualizarTexto(); atualizarTextoSom();
  imgTxt.textContent = "";
  if (infoRender) infoRender();
  calar(); clearTimeout(som.timerTour);
  if (!card.hidden) {
    if (estado.tour >= 0) cardTour(estado.tour);
    else if (estado.quiz) renderQuiz();
    else if (estado.embriao) cardEmbriao();
    else if (estado.regua) cardRegua(regua.ultimaMsg);
    else if (estado.jet) cardJet();
    else if (estado.kura) cardKura();
    else if (estado.tam) cardTam();
  }
}
document.querySelectorAll("#idioma button").forEach((b) => b.addEventListener("click", () => { if (b.dataset.l !== idioma) aplicarIdioma(b.dataset.l); }));
aplicarIdioma(idioma);

// =====================================================================  REDIMENSIONAR E ANIMAR
function redimensionar() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h);
  guiasEl.setAttribute("viewBox", `0 0 ${w} ${h}`);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  for (const r of ROT) r.w = 0;
  desenharSpark();
}
new ResizeObserver(redimensionar).observe(stage);
redimensionar();
atualizarTexto();

const relogio = new THREE.Clock();
const acum = { luz: 0, nervo: 0, mel: 0, liq: 0, lib: 0, hip: 0, axo: 0, visao: 0, papez: 0 };
let ultimoTexto = 0;
function emitir(chave, taxa, dt, fn) {
  acum[chave] += dt * taxa;
  while (acum[chave] >= 1) { acum[chave] -= 1; fn(); }
}
function animar() {
  const dt = Math.min(relogio.getDelta(), 0.05);
  const agora = performance.now();
  if (estado.tocando) {
    estado.hora = (estado.hora + dt * 1.1) % 24;
    slider.value = estado.hora.toFixed(2);
    if (agora - ultimoTexto > 120) { atualizarTexto(); ultimoTexto = agora; }
  }
  const r = ROTINAS[estado.rotina];
  const h = estado.hora % 24;
  const L = lux(h, r.telas);
  const m = MEL[estado.rotina][idxHora(h)] / MAXM;
  const impulso = janela(h, r.atraso) * (1 - supressao(L));
  const pulsoDestaque = destaque.ids.has("pineal") && destaque.pulsar ? 0.6 + 0.6 * Math.sin(agora / 180) : 0;
  pinealMat.emissiveIntensity = 0.15 + 1.6 * m + pulsoDestaque;
  halo.material.opacity = 0.32 * m;
  halo.scale.setScalar(0.9 + 0.25 * m + 0.05 * Math.sin(agora / 300) * m);
  if (destaque.pulsar) {
    matHalo.opacity = 0.15 + 0.45 * (0.5 + 0.5 * Math.sin(agora / 160));
    const s = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(agora / 180));
    for (const id of destaque.ids) for (const mm of porId.get(id) || []) if (mm !== pineal && mm.material.emissive) mm.material.emissiveIntensity = s;
  }

  if (!reduz && !estado.embriao) {
    if (grupos.circ.visible) {
      emitir("luz", 2.2 * Math.log10(1 + L), dt, () => { CURVA_LUZ.forEach((c) => particula(c, 0x5ea6f2, 0.55)); pingLuz(); });
      emitir("nervo", 4.0 * impulso, dt, () => { particula(CURVA_NERVO, 0xf07f5a, 0.16); espiga(); });
      emitir("mel", 10 * m, dt, () => { particula(CURVAS_MEL[Math.floor(Math.random() * CURVAS_MEL.length)], 0xf2b24a, 0.35 + Math.random() * 0.2); gota(); });
    }
    if (grupos.visao.visible) emitir("visao", 1.6 * Math.log10(1 + L), dt, () => particula(CURVAS_VISAO[Math.floor(Math.random() * CURVAS_VISAO.length)], 0xcfe0ff, 0.2, "visao", 0.09));
    if (grupos.papez.visible) emitir("papez", 2.2, dt, () => particula(CURVAS_PAPEZ[Math.floor(Math.random() * 2)], 0xff7ad9, 0.055, "papez", 0.1));
    if (grupos.liquor.visible) emitir("liq", 5, dt, () => particula(CURVAS_LIQUOR[Math.floor(Math.random() * 2)], 0x8fd0ff, 0.08 + Math.random() * 0.03, "liquor", 0.1));
    if (grupos.porta.visible) {
      emitir("lib", 3, dt, () => particula(CURVA_LIBERACAO, 0x5fd38a, 0.35, "porta", 0.06));
      emitir("hip", 3, dt, () => particula(CURVAS_HIPOFISE[Math.floor(Math.random() * 2)], 0xb58cff, 0.3, "porta", 0.07));
      emitir("axo", 2, dt, () => particula(CURVAS_AXONIO[Math.floor(Math.random() * 2)], 0xb8f5e0, 0.3, "porta", 0.05));
    }
  }
  for (let i = particulas.length - 1; i >= 0; i--) {
    const p = particulas[i];
    p.t += dt * p.vel;
    if (p.t >= 1) { grupos[p.grupo].remove(p.g); particulas.splice(i, 1); continue; }
    p.g.position.copy(p.curve.getPointAt(p.t));
    const f = p.t > 0.85 ? (1 - p.t) / 0.15 : 1;
    p.g.scale.setScalar(f);
  }
  if (estado.kura && !card.hidden) {
    passoKura(Math.min(dt, 0.05) * 24); // 1 dia simulado por segundo
    desenharKura();
    brilhoNSQ(true);
  }
  if (estado.embriao && estado.embPlay) {
    const u = Math.min(emb.u + dt * 0.07, 1);
    atualizarEmbriao(u);
    if (u >= 1) estado.embPlay = false;
    textoEmbriao();
  }
  if (voo.pos) {
    const f = 1 - Math.exp(-dt * 4.5);
    camera.position.lerp(voo.pos, f);
    controls.target.lerp(voo.alvo, f);
    if (camera.position.distanceTo(voo.pos) < 0.05) { camera.position.copy(voo.pos); controls.target.copy(voo.alvo); voo.pos = null; }
  }
  controls.update();
  renderer.render(scene, camera);
  atualizarLiq(dt);
  atualizarSom(L, m);
  layoutRotulos();
  posicionarMarcadores();
  requestAnimationFrame(animar);
}
animar();
