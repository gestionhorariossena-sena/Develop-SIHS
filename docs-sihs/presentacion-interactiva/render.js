// Utilidades de dibujo SVG compartidas: diagrama de arquitectura con nodos
// interactivos + partículas animadas, y un ERD simplificado en grilla.

function svgEl(tag, attrs) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

function centerOf(n) { return { x: n.x + n.w / 2, y: n.y + n.h / 2 }; }

// -------------------------------------------------------------------
// Diagrama de arquitectura (nodos reales de data.js SIHS.arquitectura)
// -------------------------------------------------------------------
function renderArchitectureDiagram(container, nodos, edges, onSelect, opts) {
  opts = opts || {};
  const maxX = Math.max(...nodos.map(n => n.x + n.w)) + 40;
  const maxY = Math.max(...nodos.map(n => n.y + n.h)) + 40;
  const svg = svgEl("svg", { viewBox: `0 0 ${maxX} ${maxY}`, width: "100%", height: Math.max(260, maxY) });
  container.innerHTML = "";
  container.appendChild(svg);

  const byId = {};
  nodos.forEach(n => byId[n.id] = n);

  const edgeEls = {};
  edges.forEach(([a, b]) => {
    const na = byId[a], nb = byId[b];
    if (!na || !nb) return;
    const ca = centerOf(na), cb = centerOf(nb);
    const path = svgEl("path", {
      d: `M ${na.x + na.w} ${ca.y} C ${na.x + na.w + 40} ${ca.y}, ${nb.x - 40} ${cb.y}, ${nb.x} ${cb.y}`,
      class: "diagram-edge",
    });
    svg.appendChild(path);
    edgeEls[a + "->" + b] = path;
  });

  nodos.forEach(n => {
    const g = svgEl("g", { class: "diagram-node", "data-id": n.id });
    const rect = svgEl("rect", {
      x: n.x, y: n.y, width: n.w, height: n.h, rx: 12,
      class: "node-box",
      fill: "rgba(20,27,45,0.9)", stroke: n.color, "stroke-width": 1.6,
    });
    g.appendChild(rect);
    const title = svgEl("text", { x: n.x + 14, y: n.y + 24, fill: "var(--text-0)", "font-size": 13, "font-weight": 700 });
    title.textContent = n.nombre;
    g.appendChild(title);
    const sub = svgEl("text", { x: n.x + 14, y: n.y + 42, fill: "var(--text-2)", "font-size": 10.5 });
    sub.textContent = n.tech.length > 32 ? n.tech.slice(0, 32) + "…" : n.tech;
    g.appendChild(sub);
    g.addEventListener("click", () => {
      svg.querySelectorAll(".diagram-node").forEach(x => x.classList.remove("selected"));
      g.classList.add("selected");
      onSelect(n);
    });
    svg.appendChild(g);
  });

  return {
    svg, edgeEls,
    highlightPath(ids) {
      Object.values(edgeEls).forEach(p => p.classList.remove("active"));
      for (let i = 0; i < ids.length - 1; i++) {
        const e = edgeEls[ids[i] + "->" + ids[i + 1]];
        if (e) e.classList.add("active");
      }
    },
    sendParticle(ids, color, onDone) {
      if (opts.reduceMotion) { if (onDone) onDone(); return; }
      const points = ids.map(id => centerOf(byId[id]));
      const dot = svgEl("circle", { r: 6, class: "particle", fill: color || "var(--accent-cyan)" });
      svg.appendChild(dot);
      let i = 0;
      const stepMs = 420;
      function moveNext() {
        if (i >= points.length - 1) { dot.remove(); if (onDone) onDone(); return; }
        const p0 = points[i], p1 = points[i + 1];
        dot.setAttribute("cx", p0.x); dot.setAttribute("cy", p0.y);
        const start = performance.now();
        function frame(t) {
          const k = Math.min(1, (t - start) / stepMs);
          dot.setAttribute("cx", p0.x + (p1.x - p0.x) * k);
          dot.setAttribute("cy", p0.y + (p1.y - p0.y) * k);
          if (k < 1) requestAnimationFrame(frame);
          else { i++; moveNext(); }
        }
        requestAnimationFrame(frame);
      }
      moveNext();
    },
  };
}

// -------------------------------------------------------------------
// ERD simplificado — grilla automática + líneas de relación
// -------------------------------------------------------------------
function renderERD(container, tablas, onSelect) {
  const cols = 5;
  const cellW = 210, cellH = 70, gapX = 36, gapY = 26;
  const pos = {};
  tablas.forEach((t, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    pos[t.nombre] = { x: col * (cellW + gapX) + 20, y: row * (cellH + gapY) + 20, w: cellW, h: cellH };
  });
  const maxX = cols * (cellW + gapX) + 20;
  const maxY = (Math.ceil(tablas.length / cols)) * (cellH + gapY) + 20;

  const svg = svgEl("svg", { viewBox: `0 0 ${maxX} ${maxY}`, width: "100%", height: Math.max(300, maxY) });
  container.innerHTML = "";
  container.appendChild(svg);

  const edgeEls = {};
  tablas.forEach(t => {
    (t.relaciones || []).forEach(rel => {
      if (!pos[rel]) return;
      const key = [t.nombre, rel].sort().join("~");
      if (edgeEls[key]) return;
      const a = pos[t.nombre], b = pos[rel];
      const ca = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
      const cb = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
      const path = svgEl("path", { d: `M ${ca.x} ${ca.y} L ${cb.x} ${cb.y}`, class: "diagram-edge" });
      svg.insertBefore(path, svg.firstChild);
      edgeEls[key] = { path, a: t.nombre, b: rel };
    });
  });

  const nodeEls = {};
  tablas.forEach(t => {
    const p = pos[t.nombre];
    const g = svgEl("g", { class: "diagram-node", "data-id": t.nombre });
    const isCentral = t.nombre === "horarios";
    const rect = svgEl("rect", {
      x: p.x, y: p.y, width: p.w, height: p.h, rx: 10, class: "node-box",
      fill: isCentral ? "rgba(79,140,255,0.14)" : "rgba(20,27,45,0.9)",
      stroke: isCentral ? "var(--accent-blue)" : "var(--border)", "stroke-width": isCentral ? 2 : 1.2,
    });
    g.appendChild(rect);
    const title = svgEl("text", { x: p.x + 10, y: p.y + 24, fill: "var(--text-0)", "font-size": 11.5, "font-weight": 700, "font-family": "var(--mono)" });
    title.textContent = t.nombre;
    g.appendChild(title);
    const pk = (t.columnas[0] || [])[0] || "";
    const sub = svgEl("text", { x: p.x + 10, y: p.y + 42, fill: "var(--accent-amber)", "font-size": 10 });
    sub.textContent = "PK " + pk;
    g.appendChild(sub);
    const n2 = svgEl("text", { x: p.x + 10, y: p.y + 58, fill: "var(--text-2)", "font-size": 9.5 });
    n2.textContent = (t.columnas.length) + " columnas";
    g.appendChild(n2);
    g.addEventListener("click", () => {
      svg.querySelectorAll(".diagram-node").forEach(x => x.classList.remove("selected"));
      g.classList.add("selected");
      Object.values(edgeEls).forEach(e => e.path.classList.toggle("active", e.a === t.nombre || e.b === t.nombre));
      onSelect(t);
    });
    svg.appendChild(g);
    nodeEls[t.nombre] = g;
  });

  return { svg, nodeEls, edgeEls };
}

function tag(kind, label) {
  const map = { impl: "tag-impl", verif: "tag-verif", dev: "tag-dev", prop: "tag-prop", risk: "tag-risk" };
  return `<span class="tag ${map[kind] || "tag-impl"}">${label}</span>`;
}
