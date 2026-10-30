// Router + render de las 5 páginas (Architecture Explorer, Flow Simulator,
// Python Lab, Testing Bootcamp, Team & Roadmap) + Hallazgos de auditoría.
// Todo el contenido viene de data.js (evidencia real de SIHS).

const NAV = [
  { id: "resumen", label: "Resumen", dot: "var(--accent-cyan)" },
  { group: "A — Arquitectura" },
  { id: "arquitectura", label: "Explorador de arquitectura", dot: "var(--accent-blue)" },
  { id: "basedatos", label: "Base de datos", dot: "var(--accent-blue)" },
  { group: "B — Simulador de flujos" },
  { id: "simulador", label: "Simulador de flujos", dot: "var(--accent-violet)" },
  { group: "C — Python Lab" },
  { id: "python", label: "Python Engineering Lab", dot: "var(--accent-cyan)" },
  { group: "D — Testing" },
  { id: "testing", label: "Testing Bootcamp", dot: "var(--accent-green)" },
  { group: "E — Equipo" },
  { id: "equipo", label: "Equipo y hoja de ruta", dot: "var(--accent-amber)" },
  { group: "F — Auditoría" },
  { id: "auditoria", label: "Hallazgos completos", dot: "var(--accent-red)" },
];

const state = {
  route: "resumen",
  reduceMotion: false,
  docente: "simple", // simple | tecnica
  visited: new Set(),
  sim: { flow: "publicar", step: 0, playing: false, timer: null },
};

function $(sel, root) { return (root || document).querySelector(sel); }
function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

// ---------------------------------------------------------------------
// Nav + router
// ---------------------------------------------------------------------
function buildNav() {
  const nav = $("#nav");
  nav.innerHTML = "";
  NAV.forEach(item => {
    if (item.group) {
      const el = document.createElement("div");
      el.className = "nav-group-label";
      el.textContent = item.group;
      nav.appendChild(el);
      return;
    }
    const el = document.createElement("div");
    el.className = "nav-item" + (state.route === item.id ? " active" : "");
    el.innerHTML = `<span class="dot" style="background:${item.dot}"></span><span>${item.label}</span>`;
    el.addEventListener("click", () => navigate(item.id));
    nav.appendChild(el);
  });
}

function navigate(route) {
  state.route = route;
  state.visited.add(route);
  buildNav();
  render();
  updateProgress();
  $("#content").scrollTop = 0;
}

function updateProgress() {
  const total = NAV.filter(n => n.id).length;
  $("#progressIndicator").textContent = `${state.visited.size} / ${total} secciones vistas`;
}

const TITLES = {
  resumen: "Resumen", arquitectura: "A — Explorador de arquitectura", basedatos: "A — Base de datos",
  simulador: "B — Simulador de flujos", python: "C — Python Engineering Lab",
  testing: "D — Testing Bootcamp", equipo: "E — Equipo y hoja de ruta", auditoria: "F — Hallazgos de auditoría",
};

function render() {
  $("#topbarTitle").textContent = TITLES[state.route] || "";
  const c = $("#content");
  c.innerHTML = "";
  const fns = {
    resumen: pageResumen, arquitectura: pageArquitectura, basedatos: pageBaseDatos,
    simulador: pageSimulador, python: pagePython, testing: pageTesting,
    equipo: pageEquipo, auditoria: pageAuditoria,
  };
  (fns[state.route] || pageResumen)(c);
}

// ---------------------------------------------------------------------
// RESUMEN
// ---------------------------------------------------------------------
function pageResumen(c) {
  c.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">SIHS — de la auditoría real a la presentación</h1>
      <p class="page-sub">Cada dato en esta plataforma viene de inspeccionar el repositorio de SIHS (FastAPI + React + Flutter + PostgreSQL/Supabase), no de una arquitectura imaginada. El informe completo está en <span class="filepath">docs/presentacion-interactiva/AUDITORIA_SIHS.md</span>.</p>
    </div>
    <div class="grid grid-4" style="margin-bottom:18px">
      <div class="card"><h3>154</h3><p>endpoints REST, 34 routers (backend/app/api/v1)</p></div>
      <div class="card"><h3>23</h3><p>tablas reales en PostgreSQL/Supabase (database/01_creacion.sql)</p></div>
      <div class="card"><h3>315 / 7 / 0</h3><p>tests backend: pasaron / saltados / fallaron — corrida en vivo el 2026-10-09</p></div>
      <div class="card"><h3>0</h3><p>archivos C# encontrados en SIHS — backend 100% Python</p></div>
    </div>
    <div class="grid grid-2">
      <div class="card">
        <h3>El problema que resuelve SIHS</h3>
        <p>"Detectar y evitar que un instructor, un ambiente o una ficha queden <b>cruzados</b> en el mismo horario." — cita literal de <span class="filepath">backend/OBJETIVO_Y_SERVICIOS_FALTANTES.md</span>. Todo lo demás (usuarios, roles, catálogos) existe para que esto se pueda resolver.</p>
      </div>
      <div class="card">
        <h3>El hallazgo más importante para hoy</h3>
        <p>El equipo todavía no adoptó ninguna disciplina formal de testing (sin cobertura medida, sin E2E) pese a tener 315 tests reales. Existe un bootcamp externo (<i>bc-testing-adso</i>) que parece ser justo el currículo esperado por el instructor — ver <b>D. Testing Bootcamp</b>.</p>
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <h3>Navegación</h3>
      <p>Usa el menú lateral. <b>A</b> explica la arquitectura y la base de datos reales. <b>B</b> anima los 3 flujos de negocio + el camino inverso al cliente. <b>C</b> enseña SQLAlchemy/Pydantic/librerías reales. <b>D</b> es el bootcamp de testing. <b>E</b> es para la reunión de hoy y la hoja de ruta. <b>F</b> lista los 12 hallazgos con severidad.</p>
    </div>
  `;
}

// ---------------------------------------------------------------------
// A — ARQUITECTURA
// ---------------------------------------------------------------------
function pageArquitectura(c) {
  c.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Explorador de arquitectura</h1>
      <p class="page-sub">Haz clic en un nodo. Cada uno corresponde a una capa real del backend/frontend de SIHS, con sus archivos y funciones.</p>
    </div>
    <div class="grid" style="grid-template-columns: 2.2fr 1fr; gap:16px;">
      <div class="diagram-wrap" id="archDiagram"></div>
      <div class="detail-panel" id="archDetail">
        <h3>Selecciona un nodo</h3>
        <p class="muted">Frontend Web/Móvil → API FastAPI → Validación (Pydantic) → Servicios → IA/Solver → Repositorios (SQLAlchemy) → PostgreSQL.</p>
      </div>
    </div>
  `;
  const wrap = $("#archDiagram", c);
  const diagram = renderArchitectureDiagram(wrap, SIHS.arquitectura.nodos, SIHS.arquitectura.edges, (n) => {
    $("#archDetail", c).innerHTML = `
      <h3>${n.nombre}</h3>
      <div class="flex-row" style="margin-bottom:8px">${tag("impl", "IMPLEMENTADO")}</div>
      <p>${n.responsabilidad}</p>
      <dl class="detail-kv">
        <dt>Tecnología</dt><dd>${n.tech}</dd>
        <dt>Archivos</dt><dd>${n.archivos.map(a => `<div class="filepath">${a}</div>`).join("")}</dd>
        <dt>Funciones</dt><dd>${n.funciones.join(", ")}</dd>
        <dt>Entrada</dt><dd>${n.entrada}</dd>
        <dt>Salida</dt><dd>${n.salida}</dd>
        <dt>Depende de</dt><dd>${n.deps.join(", ") || "—"}</dd>
      </dl>
    `;
  }, { reduceMotion: state.reduceMotion });

  const btnDemo = document.createElement("button");
  btnDemo.className = "btn btn-sm";
  btnDemo.style.margin = "0 0 10px";
  btnDemo.textContent = "▶ Simular una petición de publicación";
  wrap.insertBefore(btnDemo, wrap.firstChild);
  btnDemo.addEventListener("click", () => {
    diagram.highlightPath(["web", "api", "validacion", "servicios", "repos", "db"]);
    diagram.sendParticle(["web", "api", "validacion", "servicios", "repos", "db"], "var(--accent-cyan)");
  });
}

// ---------------------------------------------------------------------
// A — BASE DE DATOS
// ---------------------------------------------------------------------
const CONCEPTOS = [
  { t: "Tabla", d: "Una colección de filas con la misma estructura. En SIHS, `horarios` es la tabla más importante: cada fila es un bloque de clase." },
  { t: "Registro (fila)", d: "Una instancia concreta. Un registro de `horarios` = un bloque: un instructor, un ambiente, una ficha, un día y una hora." },
  { t: "Columna", d: "Un atributo de la tabla con un tipo. `horarios.horaInicio` es de tipo TIME." },
  { t: "Clave primaria (PK)", d: "Identifica de forma única cada fila. `horarios.idHorario` es SERIAL — un entero autoincremental." },
  { t: "Clave foránea (FK)", d: "Una columna que referencia la PK de otra tabla, garantizando que el dato referenciado exista. `horarios.idInstructor` → `usuarios.idUsuario`." },
  { t: "Integridad referencial", d: "La base de datos impide borrar un `usuario` que todavía tiene `horarios` asignados, salvo que la FK diga ON DELETE CASCADE o SET NULL. En `auditoria.idUsuario` es SET NULL: si se borra el usuario, el registro de auditoría queda pero sin dueño." },
  { t: "Normalización", d: "Separar datos para no repetirlos. `ficha_usuario` existe en vez de guardar una lista de aprendices dentro de `fichas` — así una ficha puede tener N usuarios sin duplicar filas." },
  { t: "Transacción", d: "Un conjunto de cambios que se aplican todos o ninguno. SQLAlchemy hace rollback automático de la sesión si algo falla a mitad de camino." },
  { t: "Índice", d: "Estructura que acelera búsquedas. `horarios` tiene 4 índices sobre instructor/ambiente/ficha/trimestre — exactamente las columnas que se filtran al buscar cruces." },
  { t: "SQL", d: "El lenguaje que ejecuta las operaciones. SQLAlchemy lo genera automáticamente a partir de objetos Python." },
  { t: "ORM", d: "Object-Relational Mapper — convierte filas de tabla en objetos Python y viceversa. SQLAlchemy es el ORM de SIHS." },
  { t: "Políticas RLS", d: "Row Level Security de PostgreSQL — reglas que filtran filas según quién consulta. En SIHS están documentadas pero NO activas (comentadas en el script SQL) — la autorización hoy vive solo en la API." },
];

function pageBaseDatos(c) {
  c.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Base de datos — 23 tablas reales</h1>
      <p class="page-sub">Fuente: <span class="filepath">database/01_creacion.sql</span> + 23 migraciones Alembic. Esquema visto en código; verificación en vivo contra Supabase pendiente (ver auditoría §9).</p>
    </div>
    <div class="explain-toggle" id="dbModeToggle">
      <button data-m="erd" class="active">Diagrama ERD</button>
      <button data-m="lista">Lista + detalle</button>
      <button data-m="docente">Modo docente</button>
    </div>
    <div id="dbBody"></div>
  `;
  let mode = "erd";
  $all("#dbModeToggle button", c).forEach(b => b.addEventListener("click", () => {
    $all("#dbModeToggle button", c).forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    mode = b.dataset.m;
    renderDbBody();
  }));

  function renderDbBody() {
    const body = $("#dbBody", c);
    if (mode === "docente") {
      body.innerHTML = `<div class="grid grid-2">` + CONCEPTOS.map(k =>
        `<div class="card"><h3>${k.t}</h3><p>${k.d}</p></div>`).join("") + `</div>`;
      return;
    }
    if (mode === "erd") {
      body.innerHTML = `<div class="grid" style="grid-template-columns:2.2fr 1fr; gap:16px;">
        <div class="diagram-wrap" id="erdWrap"></div>
        <div class="detail-panel" id="erdDetail"><h3>Selecciona una tabla</h3><p class="muted">La tabla <b>horarios</b> (resaltada) es el centro del dominio.</p></div>
      </div>`;
      renderERD($("#erdWrap", c), SIHS.tablas, (t) => showTableDetail($("#erdDetail", c), t));
      return;
    }
    // lista + detalle
    body.innerHTML = `<div class="grid" style="grid-template-columns:260px 1fr; gap:16px;">
      <div class="table-list" id="tableList"></div>
      <div class="detail-panel" id="listDetail"><h3>Selecciona una tabla</h3></div>
    </div>`;
    const list = $("#tableList", c);
    SIHS.tablas.forEach(t => {
      const item = document.createElement("div");
      item.className = "table-item";
      item.textContent = t.nombre;
      item.addEventListener("click", () => {
        $all(".table-item", list).forEach(x => x.classList.remove("active"));
        item.classList.add("active");
        showTableDetail($("#listDetail", c), t);
      });
      list.appendChild(item);
    });
  }

  function showTableDetail(panel, t) {
    panel.innerHTML = `
      <h3>${t.nombre}</h3>
      <p>${t.desc}</p>
      <div style="margin-top:10px">
        ${t.columnas.map(([name, type, note]) => `
          <div class="col-row">
            <div><span class="col-name">${name}</span> <span class="muted">${type}</span></div>
            <div class="col-badges">${note.includes("PK") ? '<span class="badge-pk">PK</span>' : ""}${note.includes("FK") ? '<span class="badge-fk">FK</span>' : ""}</div>
          </div>`).join("")}
      </div>
      <dl class="detail-kv" style="margin-top:12px">
        <dt>Relaciones</dt><dd>${(t.relaciones || []).join(", ") || "—"}</dd>
        <dt>Servicios</dt><dd>${(t.servicios || []).join(", ") || "—"}</dd>
      </dl>
    `;
  }

  renderDbBody();
}

// ---------------------------------------------------------------------
// B — SIMULADOR
// ---------------------------------------------------------------------
const FLOW_TABS = [
  { k: "publicar", label: "Publicar horario", data: () => SIHS.simulaciones.publicar },
  { k: "manual", label: "Constructor manual", data: () => SIHS.simulaciones.manual },
  { k: "ia", label: "Carga con IA", data: () => SIHS.simulaciones.ia },
  { k: "cliente", label: "Backend → cliente", data: () => SIHS.simulaciones.cliente },
];

function pageSimulador(c) {
  c.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Simulador de flujos</h1>
      <p class="page-sub">Pasos reales trazados en el código (archivo + función citados en cada paso). Datos de ejemplo ficticios.</p>
    </div>
    <div class="explain-toggle" id="flowTabs"></div>
    <div id="flowBody"></div>
  `;
  const tabsEl = $("#flowTabs", c);
  FLOW_TABS.forEach((f, i) => {
    const b = document.createElement("button");
    b.textContent = f.label;
    b.className = i === 0 ? "active" : "";
    b.addEventListener("click", () => {
      $all("#flowTabs button", c).forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      state.sim.flow = f.k; state.sim.step = 0;
      renderFlowBody();
    });
    tabsEl.appendChild(b);
  });

  function renderFlowBody() {
    const flow = FLOW_TABS.find(f => f.k === state.sim.flow).data();
    const body = $("#flowBody", c);
    body.innerHTML = `
      <div class="card" style="margin-bottom:14px"><h3>${flow.titulo}</h3><p>${flow.descripcion}</p></div>
      <div class="grid" style="grid-template-columns: 1fr 1.4fr; gap:16px;">
        <div>
          <div class="sim-controls">
            <button class="btn btn-sm" id="simPrev">◀ Atrás</button>
            <button class="btn btn-sm" id="simPlay">▶ Reproducir</button>
            <button class="btn btn-sm" id="simNext">Siguiente ▶</button>
            <button class="btn btn-sm" id="simReset">⟲ Reiniciar</button>
          </div>
          <div class="sim-steplist" id="stepList"></div>
        </div>
        <div>
          <div class="explain-toggle" id="explainToggle">
            <button data-m="simple" class="${state.docente === 'simple' ? 'active' : ''}">Explicación sencilla</button>
            <button data-m="tecnica" class="${state.docente === 'tecnica' ? 'active' : ''}">Explicación técnica</button>
          </div>
          <div class="detail-panel" id="stepDetail"></div>
          ${flow.alternativos ? `<div class="card" style="margin-top:14px"><h3>Escenarios alternativos</h3>${flow.alternativos.map(a => `<p><span class="tag tag-risk">${a.nombre}</span> ${a.detalle}</p>`).join("")}</div>` : ""}
          ${flow.ejemploValido ? `<div class="card" style="margin-top:14px"><h3>Ejemplo válido</h3><div class="code">${esc(flow.ejemploValido)}</div><h3 style="margin-top:12px">Ejemplo inválido</h3><div class="code">${esc(flow.ejemploInvalido)}</div></div>` : ""}
          ${flow.porque ? `<div class="card" style="margin-top:14px"><h3>¿Por qué así?</h3><p>${flow.porque}</p></div>` : ""}
        </div>
      </div>
    `;
    $all("#explainToggle button", body).forEach(b => b.addEventListener("click", () => {
      state.docente = b.dataset.m;
      $all("#explainToggle button", body).forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      showStep(flow);
    }));
    $("#simPrev", body).addEventListener("click", () => { state.sim.step = Math.max(0, state.sim.step - 1); showStep(flow); });
    $("#simNext", body).addEventListener("click", () => { state.sim.step = Math.min(flow.pasos.length - 1, state.sim.step + 1); showStep(flow); });
    $("#simReset", body).addEventListener("click", () => { stopPlay(); state.sim.step = 0; showStep(flow); });
    $("#simPlay", body).addEventListener("click", () => togglePlay(flow));

    buildStepList(flow);
    showStep(flow);
  }

  function buildStepList(flow) {
    const list = $("#stepList", c);
    list.innerHTML = "";
    flow.pasos.forEach((p, i) => {
      const el = document.createElement("div");
      el.className = "sim-step" + (i === state.sim.step ? " current" : i < state.sim.step ? " done" : "");
      el.innerHTML = `<span class="step-num">${i + 1}</span>${p.simple.slice(0, 54)}${p.simple.length > 54 ? "…" : ""}<span class="step-kind kind-${p.kind}">${p.kind}</span>`;
      el.addEventListener("click", () => { state.sim.step = i; showStep(flow); });
      list.appendChild(el);
    });
  }

  function showStep(flow) {
    buildStepList(flow);
    const p = flow.pasos[state.sim.step];
    const detail = $("#stepDetail", c);
    detail.innerHTML = `
      <h3>Paso ${state.sim.step + 1} de ${flow.pasos.length} <span class="tag tag-impl" style="margin-left:8px">${p.kind.toUpperCase()}</span></h3>
      <p>${state.docente === "simple" ? p.simple : p.tecnica}</p>
      <dl class="detail-kv" style="margin-top:12px">
        <dt>Archivo</dt><dd class="filepath">${p.archivo}</dd>
        <dt>Entrada</dt><dd><div class="code">${esc(p.entrada || "—")}</div></dd>
        <dt>Salida</dt><dd><div class="code">${esc(p.salida || "—")}</div></dd>
      </dl>
    `;
  }

  function togglePlay(flow) {
    if (state.sim.playing) { stopPlay(); return; }
    state.sim.playing = true;
    $("#simPlay", c).textContent = "⏸ Pausar";
    state.sim.timer = setInterval(() => {
      if (state.sim.step >= flow.pasos.length - 1) { stopPlay(); return; }
      state.sim.step++;
      showStep(flow);
    }, state.reduceMotion ? 50 : 1400);
  }
  function stopPlay() {
    state.sim.playing = false;
    clearInterval(state.sim.timer);
    const btn = $("#simPlay", c);
    if (btn) btn.textContent = "▶ Reproducir";
  }

  renderFlowBody();
}

function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

// ---------------------------------------------------------------------
// C — PYTHON LAB
// ---------------------------------------------------------------------
function pagePython(c) {
  const py = SIHS.python;
  c.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Python Engineering Lab</h1>
      <p class="page-sub">SQLAlchemy, Pydantic y las librerías reales del backend — con ejemplo y limitación de cada una.</p>
    </div>

    <div class="card" style="margin-bottom:16px">
      <h3>1. SQLAlchemy — el traductor entre Python y la base de datos</h3>
      <p>SQLAlchemy es una herramienta que le permite al programador trabajar con <b>objetos Python normales</b> (como si fueran variables cualquiera) sin tener que escribir SQL a mano. SQLAlchemy se encarga de traducir eso a instrucciones SQL reales y de traer la respuesta de vuelta convertida otra vez en un objeto Python. Es como tener un traductor: el programador habla "Python", la base de datos solo entiende "SQL", y SQLAlchemy traduce en los dos sentidos sin que nadie tenga que aprender el otro idioma.</p>
      <p>En SIHS esto pasa en 4 pasos, siempre en el mismo orden:</p>
      <ol style="margin:10px 0 16px; padding-left:20px; font-size:13px; color:var(--text-1); line-height:1.7">
        <li><b>Se crea un objeto Python</b> — el programador escribe algo como "un horario nuevo, de 7 a 9, con tal instructor". Todavía no existe en la base de datos, solo en la memoria del programa.</li>
        <li><b>Se le pide a SQLAlchemy que lo guarde</b> — con una sola línea (<code>db.commit()</code>), sin escribir ningún SQL.</li>
        <li><b>SQLAlchemy traduce eso a SQL de verdad</b> — genera automáticamente el <code>INSERT</code> con los nombres de columna correctos y lo envía a PostgreSQL.</li>
        <li><b>PostgreSQL responde, y SQLAlchemy lo convierte de vuelta</b> — por ejemplo, le devuelve al objeto Python el número de identificación (<code>idHorario</code>) que la base de datos le asignó, para que el programa pueda seguir usándolo.</li>
      </ol>
      <div class="grid grid-2">
        <div>
          <p class="muted">1. Se crea el objeto Python (todavía no existe en la base de datos)</p><div class="code">${esc(py.sqlalchemyEjemplo.objeto)}</div>
          <p class="muted" style="margin-top:8px">2. Se le dice a SQLAlchemy "guarda esto"</p><div class="code">${esc(py.sqlalchemyEjemplo.consulta)}</div>
        </div>
        <div>
          <p class="muted">3. SQLAlchemy traduce eso al SQL real que recibe PostgreSQL</p><div class="code">${esc(py.sqlalchemyEjemplo.sql)}</div>
          <p class="muted" style="margin-top:8px">4. PostgreSQL responde y SQLAlchemy lo devuelve como objeto Python de nuevo</p><div class="code">${esc(py.sqlalchemyEjemplo.resultado)}</div>
        </div>
      </div>
      <p class="filepath" style="margin-top:8px">${py.sqlalchemyEjemplo.archivo}</p>
    </div>

    <div class="card" style="margin-bottom:16px">
      <h3>Caso real de optimización: cuando SQLAlchemy preguntaba de más (resuelto)</h3>
      <p>Al principio, por cada horario de la lista, el programa le preguntaba a la base de datos "¿y quién es el instructor?", "¿y en qué ambiente?", una por una, como enviar una carta distinta por cada pregunta. Con 130 horarios eso eran más de 130 idas y vueltas a la base de datos — tardaba 47 segundos de verdad. La solución fue pedir todo junto en una sola consulta más completa, como una sola carta con todas las preguntas adentro.</p>
      <div class="grid grid-2">
        <div><p class="muted">Antes — una pregunta por cada horario (47s medidos en vivo con 130+ horarios)</p><div class="code">${esc(py.n1Ejemplo.antes)}</div></div>
        <div><p class="muted">Después — todas las preguntas en una sola consulta, sin importar cuántos horarios haya</p><div class="code">${esc(py.n1Ejemplo.despues)}</div></div>
      </div>
      <p class="filepath" style="margin-top:8px">${py.n1Ejemplo.archivo}</p>
    </div>

    <h3 style="margin:22px 0 10px">2. Librerías reales (requirements.txt)</h3>
    <div class="grid grid-2" id="libGrid"></div>

    <div class="card" style="margin-top:18px">
      <h3>3. Pydantic — demo validación</h3>
      <div class="grid grid-2">
        <div><div class="code">${esc(py.pydanticDemo.schema)}</div></div>
        <div>
          <div class="explain-toggle" id="pydToggle"><button data-v="v" class="active">Dato válido</button><button data-v="i">Dato inválido</button></div>
          <div class="code" id="pydInput"></div>
          <div class="code" id="pydOutput" style="margin-top:8px"></div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:18px">
      <h3>4. Migración de C# a Python</h3>
      <p>${tag(py.migracionCSharp.encontrado ? "dev" : "verif", py.migracionCSharp.encontrado ? "EN DESARROLLO" : "VERIFICADO: NO ENCONTRADO")} ${py.migracionCSharp.declaracion}</p>
    </div>
  `;

  const libGrid = $("#libGrid", c);
  py.librerias.forEach(l => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h3>${l.nombre} <span class="muted" style="font-size:11px">${l.version}</span></h3>
      <p>${l.uso}</p>
      <p class="filepath" style="margin:6px 0">${l.donde}</p>
      <div class="code">${esc(l.ejemplo)}</div>
      <p class="muted" style="margin-top:6px">⚠ ${l.limitacion}</p>
    `;
    libGrid.appendChild(card);
  });

  function renderPyd(valid) {
    $("#pydInput", c).textContent = valid ? py.pydanticDemo.valido : py.pydanticDemo.invalido;
    $("#pydOutput", c).textContent = valid ? "201 Created — objeto validado y persistido" : py.pydanticDemo.errorInvalido;
  }
  $all("#pydToggle button", c).forEach(b => b.addEventListener("click", () => {
    $all("#pydToggle button", c).forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    renderPyd(b.dataset.v === "v");
  }));
  renderPyd(true);
}

// ---------------------------------------------------------------------
// D — TESTING BOOTCAMP
// ---------------------------------------------------------------------
function pageTesting(c) {
  const t = SIHS.testing;
  c.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Testing Bootcamp</h1>
      <p class="page-sub">Estado real de SIHS + el bootcamp externo de referencia (<i>bc-testing-adso</i>, clonado solo-lectura para esta auditoría).</p>
    </div>

    <div class="grid grid-3" style="margin-bottom:16px">
      <div class="card"><h3>Backend</h3><p>${t.estadoActual.backend.archivos} archivos de test · <b style="color:var(--accent-green)">${t.estadoActual.backend.passed} passed</b> · ${t.estadoActual.backend.skipped} skipped · ${t.estadoActual.backend.failed} failed</p><p class="muted">${t.estadoActual.backend.motor}</p></div>
      <div class="card"><h3>Frontend</h3><p>${t.estadoActual.frontend.archivos} archivos de test</p><p class="muted">${t.estadoActual.frontend.motor}</p></div>
      <div class="card"><h3>Mobile</h3><p>${t.estadoActual.mobile.archivos} archivos de test</p><p class="muted">${t.estadoActual.mobile.motor}</p></div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <h3>CI actual</h3><p>${t.estadoActual.ciActual}</p>
      <h3 style="margin-top:12px">Falta para cumplir el currículo del bootcamp</h3>
      <p>${t.estadoActual.faltante.map(f => `<span class="tag tag-risk" style="margin:2px">${f}</span>`).join("")}</p>
    </div>

    <div class="card" style="margin-bottom:16px">
      <h3>Umbral de cobertura (regla de trinquete — nunca baja)</h3>
      <div class="gantt">
        ${t.bootcampReferencia.umbral.map(([s, p]) => `
          <div class="gantt-row"><div>Semana ${s}</div><div class="gantt-track"><div class="gantt-bar" style="left:0;width:${(parseInt(p) || 5) * 1.1}%;background:linear-gradient(90deg,var(--accent-blue),var(--accent-cyan))">${p}</div></div></div>
        `).join("")}
      </div>
      <p class="muted" style="margin-top:8px">Fuente: ${t.bootcampReferencia.fuente}</p>
    </div>

    <h3 style="margin:20px 0 10px">Currículo semanal</h3>
    <div class="grid grid-2" id="weekGrid"></div>

    <h3 style="margin:22px 0 10px">Matriz de casos de prueba</h3>
    <div class="diagram-wrap" style="overflow-x:auto">
      <table style="width:100%; border-collapse:collapse; font-size:12px" id="matrixTable"></table>
    </div>
  `;

  const weekGrid = $("#weekGrid", c);
  t.bootcampReferencia.semanas.forEach(s => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<h3>Semana ${s.n} — ${s.tema}</h3><p>${s.receta}</p>`;
    weekGrid.appendChild(card);
  });

  const table = $("#matrixTable", c);
  const head = ["ID", "Módulo", "Objetivo", "Estado", "Resultado", "Evidencia", "Responsable"];
  table.innerHTML = `<thead><tr>${head.map(h => `<th style="text-align:left;padding:8px;border-bottom:1px solid var(--border);color:var(--text-2);font-size:11px;text-transform:uppercase">${h}</th>`).join("")}</tr></thead>
    <tbody>${t.matrizCasos.map(r => `<tr>
      <td style="padding:8px;border-bottom:1px solid var(--border)" class="filepath">${r.id}</td>
      <td style="padding:8px;border-bottom:1px solid var(--border)">${r.modulo}</td>
      <td style="padding:8px;border-bottom:1px solid var(--border)">${r.objetivo}</td>
      <td style="padding:8px;border-bottom:1px solid var(--border)">${r.estado === "Ejecutada" ? tag("verif", "Ejecutada") : tag("prop", "Diseñada")}</td>
      <td style="padding:8px;border-bottom:1px solid var(--border)">${r.resultado}</td>
      <td style="padding:8px;border-bottom:1px solid var(--border)" class="filepath">${r.evidencia}</td>
      <td style="padding:8px;border-bottom:1px solid var(--border)">${r.responsable}</td>
    </tr>`).join("")}</tbody>`;
}

// ---------------------------------------------------------------------
// E — EQUIPO Y ROADMAP
// ---------------------------------------------------------------------
const BOARD_KEY = "sihs_board_v1";
function loadBoard() {
  try { return JSON.parse(localStorage.getItem(BOARD_KEY)) || defaultBoard(); } catch (e) { return defaultBoard(); }
}
function saveBoard(b) { localStorage.setItem(BOARD_KEY, JSON.stringify(b)); }
function defaultBoard() {
  const estados = SIHS.matrizMateo.estados;
  const b = {}; estados.forEach(e => b[e] = []);
  b["Pendiente"] = SIHS.responsabilidades.flatMap(r => r.entregables.map(e => ({ who: r.nombre, text: e })));
  return b;
}

function pageEquipo(c) {
  c.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Equipo y hoja de ruta</h1>
      <p class="page-sub">Reunión del ${SIHS.meta.reunion} · entrega del ${SIHS.meta.entrega} · hoja de ruta ${SIHS.meta.roadmapInicio} → ${SIHS.meta.roadmapFin}.</p>
    </div>

    <div class="card" style="margin-bottom:16px">
      <h3>Agenda (≈90 min)</h3>
      <div class="gantt">
        ${SIHS.agenda.map(a => `<div class="gantt-row"><div>${a.bloque}</div><div class="gantt-track"><div class="gantt-bar" style="left:0;width:${a.minutos}%;background:var(--accent-blue)">${a.minutos} min</div></div></div>`).join("")}
      </div>
    </div>

    <h3 style="margin:18px 0 10px">Responsabilidades</h3>
    <div class="grid grid-3" id="respGrid" style="margin-bottom:18px"></div>

    <h3 style="margin:18px 0 10px">Tablero (persistencia local en este navegador — exportable/importable, no hay sincronización real entre integrantes)</h3>
    <div class="flex-row" style="margin-bottom:10px">
      <button class="btn btn-sm" id="exportBoard">⭳ Exportar JSON</button>
      <button class="btn btn-sm" id="importBoard">⭱ Importar JSON</button>
      <input type="file" id="importFile" accept="application/json" style="display:none" />
    </div>
    <div class="board" id="board"></div>

    <h3 style="margin:22px 0 10px">Hoja de ruta — ${SIHS.roadmap.semana1.titulo}</h3>
    <div class="diagram-wrap" style="overflow-x:auto;margin-bottom:14px"><table style="width:100%;border-collapse:collapse;font-size:12px" id="s1Table"></table></div>
    <h3 style="margin:18px 0 10px">${SIHS.roadmap.semana2.titulo}</h3>
    <div class="diagram-wrap" style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px" id="s2Table"></table></div>
  `;

  const respGrid = $("#respGrid", c);
  SIHS.responsabilidades.forEach(r => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<h3 style="color:${SIHS.equipo.find(e => e.nombre === r.nombre).color}">${r.nombre}</h3><p class="muted">${r.area}</p><ul style="margin:8px 0 0;padding-left:18px;font-size:12.5px;color:var(--text-1)">${r.entregables.map(e => `<li style="margin-bottom:4px">${e}</li>`).join("")}</ul>`;
    respGrid.appendChild(card);
  });

  let board = loadBoard();
  function renderBoard() {
    const el = $("#board", c);
    el.innerHTML = "";
    SIHS.matrizMateo.estados.forEach(estado => {
      const col = document.createElement("div");
      col.className = "board-col";
      col.innerHTML = `<h4>${estado}</h4>`;
      (board[estado] || []).forEach((card, idx) => {
        const cardEl = document.createElement("div");
        cardEl.className = "board-card";
        cardEl.draggable = true;
        cardEl.innerHTML = `<div class="who">${card.who}</div>${card.text}`;
        cardEl.addEventListener("dragstart", e => { e.dataTransfer.setData("text/plain", JSON.stringify({ estado, idx })); });
        col.appendChild(cardEl);
      });
      col.addEventListener("dragover", e => e.preventDefault());
      col.addEventListener("drop", e => {
        e.preventDefault();
        const { estado: from, idx } = JSON.parse(e.dataTransfer.getData("text/plain"));
        const [item] = board[from].splice(idx, 1);
        board[estado].push(item);
        saveBoard(board);
        renderBoard();
      });
      el.appendChild(col);
    });
  }
  renderBoard();

  $("#exportBoard", c).addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(board, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "sihs_tablero.json"; a.click();
  });
  $("#importBoard", c).addEventListener("click", () => $("#importFile", c).click());
  $("#importFile", c).addEventListener("change", (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { try { board = JSON.parse(reader.result); saveBoard(board); renderBoard(); } catch (err) { alert("JSON inválido"); } };
    reader.readAsText(file);
  });

  function fillTable(sel, items) {
    const head = ["ID", "Resp.", "Prioridad", "Días", "Duración", "Depende", "Resultado esperado", "Riesgo"];
    $(sel, c).innerHTML = `<thead><tr>${head.map(h => `<th style="text-align:left;padding:7px;border-bottom:1px solid var(--border);color:var(--text-2);font-size:10.5px;text-transform:uppercase">${h}</th>`).join("")}</tr></thead>
    <tbody>${items.map(i => `<tr>
      <td style="padding:7px;border-bottom:1px solid var(--border)" class="filepath">${i.id}</td>
      <td style="padding:7px;border-bottom:1px solid var(--border)">${i.resp}</td>
      <td style="padding:7px;border-bottom:1px solid var(--border)">${i.prioridad}</td>
      <td style="padding:7px;border-bottom:1px solid var(--border)">${i.dias}</td>
      <td style="padding:7px;border-bottom:1px solid var(--border)">${i.duracion}</td>
      <td style="padding:7px;border-bottom:1px solid var(--border)">${i.dependeDe}</td>
      <td style="padding:7px;border-bottom:1px solid var(--border)">${i.resultado}</td>
      <td style="padding:7px;border-bottom:1px solid var(--border)">${i.riesgo}</td>
    </tr>`).join("")}</tbody>`;
  }
  fillTable("#s1Table", SIHS.roadmap.semana1.items);
  fillTable("#s2Table", SIHS.roadmap.semana2.items);
}

// ---------------------------------------------------------------------
// F — AUDITORÍA (hallazgos)
// ---------------------------------------------------------------------
const HALLAZGOS = [
  { id: "H1", h: "RLS no activo — autorización solo en capa de aplicación", sev: "risk", detalle: "Las políticas están documentadas pero comentadas en database/01_creacion.sql. Cualquier acceso directo a la BD con la service-role key no tiene barrera por fila." },
  { id: "H2", h: "Dos caminos paralelos para crear horario", sev: "risk", detalle: "horarios (real, con FK) vs horarios_guardados (JSONB, texto libre). NuevoHorario.tsx hoy usa el segundo." },
  { id: "H3", h: "N+1 queries en listado de horarios — RESUELTO", sev: "impl", detalle: "47s medidos en producción → O(1) con selectinload. Con test de regresión real (test_horarios_listado_sin_n_mas_1.py)." },
  { id: "H4", h: "Bloqueador de migración de publicación programada, sin resolver", sev: "risk", detalle: "Documentado en el commit más reciente del repo (ce68671, mismo día de esta auditoría)." },
  { id: "H5", h: "actividades_aprendizaje sin capa de código", sev: "dev", detalle: "Tabla existe, no bloquea nada según el propio equipo." },
  { id: "H6", h: "16 elementos de UI con datos hardcodeados tipo vitrina", sev: "dev", detalle: "Cada uno marcado en el código con el comentario 'Contenido de mockup (Stitch) — pendiente de conectar'." },
  { id: "H7", h: "Sin umbral de cobertura ni gate de calidad en CI", sev: "risk", detalle: "Criterio de evaluación explícito del instructor — ver Artifact D." },
  { id: "H8", h: "Sin pruebas E2E", sev: "risk", detalle: "No se encontró Playwright/Cypress en frontend, backend ni mobile." },
  { id: "H9", h: "No se encontró código C#", sev: "verif", detalle: "Búsqueda exhaustiva, 0 resultados. Cierra la sección de migración del prompt maestro." },
  { id: "H10", h: "Tabla auditoria — a revalidar si ya se aplicó a Supabase", sev: "dev", detalle: "Según el último informe interno (2026-08-31) estaba 'hecha en código, sin aplicar a Supabase'. Puede estar ya resuelto." },
  { id: "H11", h: "CORS correctamente restringido (positivo)", sev: "impl", detalle: "allow_origin_regex solo localhost + frontend_url explícito, no wildcard con credentials." },
  { id: "H12", h: "Middleware de errores diseñado para no romper CORS en el error (positivo)", sev: "impl", detalle: "Motivado por un incidente real documentado (2026-09-24) en el propio código." },
];

function pageAuditoria(c) {
  c.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Hallazgos de la auditoría</h1>
      <p class="page-sub">Informe completo en <span class="filepath">AUDITORIA_SIHS.md</span>, en esta misma carpeta. Severidad: riesgo (rojo), en desarrollo (ámbar), verificado (cian), implementado/positivo (verde).</p>
    </div>
    <div class="grid grid-2" id="hallazgosGrid"></div>
    <div class="card" style="margin-top:18px">
      <h3>Lo que esta auditoría NO pudo verificar</h3>
      <p>Conexión en vivo a Supabase (esquema real desplegado, RLS realmente activas) · si H4 ya fue resuelto tras el commit citado · si H10 ya fue aplicado · comportamiento transaccional detallado de la edición de horarios · rendimiento bajo carga real salvo el caso N+1 ya resuelto.</p>
    </div>
  `;
  const grid = $("#hallazgosGrid", c);
  HALLAZGOS.forEach(h => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<h3>${h.id} ${tag(h.sev, h.sev === "risk" ? "Riesgo" : h.sev === "dev" ? "En desarrollo" : h.sev === "verif" ? "Verificado" : "Implementado")}</h3><p><b>${h.h}</b></p><p>${h.detalle}</p>`;
    grid.appendChild(card);
  });
}

// ---------------------------------------------------------------------
// Modo expositor (guiones breves por sección)
// ---------------------------------------------------------------------
const EXPOSITOR = {
  resumen: { intro: "SIHS existe para evitar que un instructor, ambiente o ficha queden cruzados en un horario.", tecnica: "Backend FastAPI con 154 endpoints, 23 tablas en PostgreSQL/Supabase, 315 tests reales pasando.", ejemplo: "Un instructor con dos clases a la misma hora en fichas distintas — eso es un cruce que el sistema debe bloquear.", relacion: "Toda la plataforma que van a ver se construyó leyendo este código, no inventando diagramas.", conclusion: "Lo que sigue muestra arquitectura, flujos, Python, testing y el plan de dos semanas.", preguntas: ["¿Esto corre hoy en producción? — El core (detección de cruces) sí, probado en vivo contra Supabase.", "¿Por qué no está todo probado con E2E? — Es exactamente el vacío que cubre el bootcamp de testing (Artifact D)."] },
  arquitectura: { intro: "Cada nodo de este diagrama es una capa real del sistema, no una caja genérica.", tecnica: "Patrón: endpoint → Pydantic → Servicio → Repositorio (SQLAlchemy) → PostgreSQL, repetido en 23 módulos de dominio sin excepciones.", ejemplo: "Clic en 'Simular petición de publicación' para ver la partícula recorrer el camino real.", relacion: "Este es el mismo camino que toma cualquier botón de la app web.", conclusion: "La arquitectura es consistente y sin atajos — eso facilita mantenerla.", preguntas: ["¿Por qué separar Servicio de Repositorio? — El Servicio tiene las reglas de negocio (cruces); el Repositorio solo sabe hablar SQL."] },
  basedatos: { intro: "23 tablas, con horarios en el centro — la razón de ser del sistema.", tecnica: "PK/FK documentadas con comentarios que explican el porqué de cada decisión, incluyendo por qué usuarios no guarda contraseña.", ejemplo: "idUsuario es UUID porque referencia auth.users de Supabase, no un SERIAL propio.", relacion: "RLS está documentado pero no activo — la autorización hoy vive en la API.", conclusion: "Es un esquema maduro con decisiones explicadas, no improvisado.", preguntas: ["¿Por qué hay dos tablas de horario? — horarios_guardados es un puente temporal mientras se termina de conectar el editor visual al módulo real (H2)."] },
  simulador: { intro: "Cada paso de estas simulaciones viene de una función y un archivo reales.", tecnica: "Publicar es un PATCH /horarios/{id}/estado que valida permisos, revisa publicaciones programadas pendientes, actualiza, notifica y audita.", ejemplo: "Al publicar, el instructor ve el bloque en 'Mi horario' porque el móvil solo lee lo publicado.", relacion: "La carga con IA usa Gemini solo para clasificar columnas de Excel — la generación de horario es un solver matemático (CP-SAT), no un LLM.", conclusion: "Las reglas duras (no-cruce) nunca dependen de una IA que pueda alucinar.", preguntas: ["¿Qué pasa si Gemini no responde? — El endpoint responde 503 explícito, no falla silencioso (ver app/main.py)."] },
  python: { intro: "SQLAlchemy convierte objetos Python en SQL y de vuelta.", tecnica: "El caso real más ilustrativo es el N+1 resuelto: de 47s a O(1) queries con selectinload, con test de regresión que cuenta las queries ejecutadas.", ejemplo: "Pydantic valida horaFin > horaInicio antes de que el dato llegue a la base.", relacion: "No se encontró código C# en SIHS — el backend ya es 100% Python.", conclusion: "Las librerías no están puestas por moda: cada una tiene un comentario de por qué se eligió.", preguntas: ["¿Por qué OR-Tools y no un LLM para generar horarios? — Porque las restricciones duras no pueden depender de que un modelo de lenguaje 'adivine' bien."] },
  testing: { intro: "315 tests reales pasan hoy en SIHS, pero sin cobertura medida ni E2E.", tecnica: "El bootcamp externo bc-testing-adso exige un umbral de cobertura que sube cada semana (30% → 80%) y nunca baja.", ejemplo: "Semana 6 del bootcamp es exactamente lo que falta: integración contra PostgreSQL real, no SQLite.", relacion: "La matriz de casos de esta plataforma distingue lo ejecutado de lo diseñado — nada se infla.", conclusion: "Adoptar la semana 1 del bootcamp esta misma semana es la recomendación concreta.", preguntas: ["¿Por qué no se mide cobertura todavía? — No está configurado pytest-cov ni el equivalente de Vitest; es la primera tarea de la hoja de ruta."] },
  equipo: { intro: "Hoy se reparte el trabajo; el domingo se entrega documentación + un plan real de dos semanas.", tecnica: "El tablero es local a este navegador — se exporta/importa como JSON, no hay sincronización entre integrantes.", ejemplo: "El roadmap de la semana 1 prioriza el bloqueador de publicación programada (H4) porque bloquea una feature completa.", relacion: "Mateo no desarrolla las 4 áreas — audita, verifica evidencia y consolida.", conclusion: "El plan es deliberadamente acotado a 2 semanas; no se finge ejecutar nueve semanas de bootcamp de golpe.", preguntas: ["¿Por qué Mateo no tiene entregables de código? — Su rol es de auditoría e integración, según lo pedido explícitamente por el equipo."] },
  auditoria: { intro: "12 hallazgos, clasificados por severidad y con evidencia de archivo.", tecnica: "3 son positivos (buenas prácticas confirmadas), el resto son riesgos o trabajo en desarrollo, ninguno inventado.", ejemplo: "H4 viene literalmente del commit más reciente del repositorio, documentado por el propio equipo el mismo día de esta auditoría.", relacion: "Esta lista es el punto de partida real del roadmap de dos semanas.", conclusion: "Nada aquí se presenta como 'terminado' si no hay evidencia de que lo esté.", preguntas: ["¿Esta lista es exhaustiva? — No; la sección 'qué no se pudo verificar' declara explícitamente sus límites."] },
};

function openExpositor() {
  const data = EXPOSITOR[state.route] || EXPOSITOR.resumen;
  $("#expositorBody").innerHTML = `
    <section><h4>Introducción sencilla</h4><p>${data.intro}</p></section>
    <section><h4>Explicación técnica</h4><p>${data.tecnica}</p></section>
    <section><h4>Ejemplo práctico</h4><p>${data.ejemplo}</p></section>
    <section><h4>Relación con SIHS</h4><p>${data.relacion}</p></section>
    <section><h4>Conclusión</h4><p>${data.conclusion}</p></section>
    <section><h4>Preguntas probables del instructor</h4>${data.preguntas.map(q => `<p>• ${q}</p>`).join("")}</section>
  `;
  $("#expositorOverlay").classList.add("open");
}

// ---------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  buildNav();
  render();
  updateProgress();

  $("#btnExpositor").addEventListener("click", openExpositor);
  $("#closeExpositor").addEventListener("click", () => $("#expositorOverlay").classList.remove("open"));
  $("#expositorOverlay").addEventListener("click", (e) => { if (e.target.id === "expositorOverlay") e.currentTarget.classList.remove("open"); });

  $("#toggleReduceMotion").addEventListener("change", (e) => {
    state.reduceMotion = e.target.checked;
    document.body.classList.toggle("reduce-motion", state.reduceMotion);
  });

  $("#btnModoDocente").addEventListener("click", (e) => {
    state.docente = state.docente === "simple" ? "tecnica" : "simple";
    e.target.textContent = "Modo docente: " + state.docente;
    render();
  });
});
