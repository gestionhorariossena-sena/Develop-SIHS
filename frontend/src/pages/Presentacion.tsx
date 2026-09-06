import { Link } from 'react-router-dom'
import senaLogo from '../assets/sena-logo.jpeg'

/**
 * Página pública de presentación (pre-login) — primera pantalla en "/".
 * Réplica del mockup Stitch en
 * _Docs/Diseño/mockups-stitch/presentacion_pre_login_sihs_sena/.
 * Solo contenido institucional/de mercadeo + navegación real a
 * /login y /registro — nada de esto pide datos al backend.
 */

interface Funcionalidad {
  icono: string
  titulo: string
  descripcion: string
  etiqueta: string
}

const FUNCIONALIDADES: Funcionalidad[] = [
  {
    icono: 'tune',
    titulo: 'Constructor de Horarios',
    descripcion:
      'Arma la programación semanal con detección automática de cruces de ficha, instructor y ambiente, con validación estricta del tope de horas según tipo de contrato (RF-011: 32h contratista / 40h planta).',
    etiqueta: 'Norma RF-011',
  },
  {
    icono: 'verified_user',
    titulo: 'Auditoría de Cruces',
    descripcion:
      'Barrido continuo de conflictos ya guardados, clasificados por tipología (cruce_ambiente, cruce_instructor, cruce_ficha), con acceso directo a resolverlos en el Constructor Ágil.',
    etiqueta: '5 Tipologías',
  },
  {
    icono: 'view_column',
    titulo: 'Vistas de Horarios Multi-perspectiva',
    descripcion:
      'Consulta integral desde cualquier ángulo: matriz general de la sede, filtro directo por docente, agenda de ficha formativa o mapa de ocupación física por laboratorio y taller.',
    etiqueta: '4 Perspectivas',
  },
  {
    icono: 'badge',
    titulo: 'Mi Horario (Portal Docente)',
    descripcion:
      'Autoservicio para que cada instructor consulte su programación semanal consolidada, descargue su horario en PDF, y radique solicitudes formales de cambio o novedad con trazabilidad.',
    etiqueta: 'Autoservicio',
  },
]

export function Presentacion() {
  return (
    <div className="min-h-screen bg-surface">
      <header className="flex items-center justify-between gap-4 border-b border-outline-variant bg-surface-container-lowest px-6 py-3">
        <div className="flex items-center gap-3">
          <img src={senaLogo} alt="SENA" className="h-9 w-9 rounded-xl object-cover" />
          <div className="leading-tight">
            <p className="font-display font-bold text-on-surface">SIHS</p>
            <p className="text-xs text-on-surface-variant">Sistema Institucional de Horarios</p>
          </div>
        </div>

        <div className="hidden items-center gap-2 rounded-full bg-secondary-container px-3 py-1 text-xs font-medium text-on-secondary-container sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
          CGMLTI Calle 52 · Distrito Capital
        </div>

        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm font-semibold text-on-surface-variant hover:text-on-surface">
            Iniciar sesión
          </Link>
          <Link
            to="/registro"
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-on-primary-container"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            Registrarse
          </Link>
        </div>
      </header>

      <section className="bg-[radial-gradient(ellipse_at_top,_#eaf7ec_0%,_#f8fafc_55%,_#ffffff_100%)] px-6 py-16">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-surface-container-lowest px-3 py-1 text-xs font-semibold text-on-surface-variant shadow-sm">
              OPERACIÓN TRIMESTRAL
              <span className="text-outline">|</span>
              Centro de Gestión de Mercados, Logística y TI
            </div>

            <h1 className="mb-4 text-4xl font-bold tracking-tight text-on-surface lg:text-5xl">
              Gestión de horarios académicos, <span className="text-primary">sin cruces</span> ni sorpresas.
            </h1>

            <p className="mb-8 max-w-lg text-on-surface-variant">
              Plataforma institucional de programación formativa para el <strong className="text-on-surface">CGMLTI Calle 52</strong>.
              Centraliza la asignación de fichas, disponibilidad docente, ambientes especializados y auditoría preventiva en
              tiempo real.
            </p>

            <div className="mb-8 flex flex-wrap items-center gap-3">
              <Link
                to="/login"
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-on-primary shadow-sm hover:bg-on-primary-container"
              >
                Iniciar Sesión en SIHS
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </Link>
              <a
                href="#funcionalidades"
                className="flex items-center gap-2 rounded-xl border border-outline px-5 py-3 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined text-[18px]">info</span>
                Conocer más funcionalidades
              </a>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-on-surface-variant">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-primary">verified</span>
                100% Reglas SENA RF-011
              </span>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-primary">bolt</span>
                Detección Inmediata
              </span>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-primary">visibility</span>
                Consulta Multi-perspectiva
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-3 shadow-xl shadow-slate-200/60">
            <div className="mb-3 flex items-center gap-1.5 border-b border-outline-variant pb-3">
              <span className="h-2.5 w-2.5 rounded-full bg-error/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-tertiary/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-primary/60" />
              <span className="ml-2 truncate font-mono text-xs text-on-surface-variant">sihs.sena.edu.co/cierre-matriz</span>
              <span className="ml-auto flex items-center gap-1 rounded-full bg-primary-container px-2 py-0.5 text-[10px] font-semibold text-on-primary-container">
                Sincronizado
              </span>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-surface p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Programación Académica</p>
                <p className="text-sm font-bold text-on-surface">Matriz Centralizada</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-primary">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  Optimización en línea
                </p>
              </div>
              <div className="rounded-xl bg-surface p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Auditoría Automática</p>
                <p className="text-sm font-bold text-on-surface">Validación Inmediata</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-primary">
                  <span className="material-symbols-outlined text-[14px]">bolt</span>
                  Control en tiempo real
                </p>
              </div>
            </div>

            <div className="mb-3 flex items-start justify-between gap-2 rounded-xl bg-tertiary-container p-3">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-on-tertiary-container">
                  <span className="material-symbols-outlined text-[16px]">shield</span>
                  Auditoría Preventiva SIHS
                </p>
                <p className="mt-0.5 text-xs text-on-tertiary-container">
                  Prevención activa de cruces de horario, ambientes e instructores bajo norma RF-011.
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-surface-container-lowest px-2 py-0.5 text-[10px] font-semibold text-on-tertiary-container">
                control_activo
              </span>
            </div>

            <div className="rounded-xl border border-outline-variant p-3">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-semibold text-on-surface">Malla Semanal · Ficha Demostrativa</span>
                <span className="text-on-surface-variant">Programa Formativo</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg bg-surface px-3 py-2">
                  <div>
                    <p className="text-xs font-semibold text-on-surface">Lunes 06:00 – 12:00</p>
                    <p className="text-[11px] text-on-surface-variant">Módulo Técnico · Ambiente Especializado</p>
                  </div>
                  <span className="rounded-full bg-primary-container px-2 py-0.5 text-[10px] font-semibold text-on-primary-container">
                    Verificado
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-surface px-3 py-2">
                  <div>
                    <p className="text-xs font-semibold text-on-surface">Martes 06:00 – 12:00</p>
                    <p className="text-[11px] text-on-surface-variant">Sesión Teórico-Práctica · Aula / Laboratorio</p>
                  </div>
                  <span className="rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant">
                    En cronograma
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] text-on-surface-variant">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Reglas de negocio activas
              </span>
              <span className="font-mono">CGMLTI · Calle 52</span>
            </div>
          </div>
        </div>
      </section>

      <section id="funcionalidades" className="px-6 py-16">
        <div className="mx-auto max-w-6xl text-center">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-surface-container px-3 py-1 text-xs font-semibold text-on-surface-variant">
            <span className="material-symbols-outlined text-[14px]">settings</span>
            Módulos Operativos Validados
          </div>
          <h2 className="mb-3 text-3xl font-bold text-on-surface">Diseñado para la realidad operativa del centro</h2>
          <p className="mx-auto mb-10 max-w-2xl text-on-surface-variant">
            Herramientas especializadas para coordinadores e instructores que eliminan la fricción y garantizan el
            cumplimiento de la normativa institucional.
          </p>

          <div className="grid gap-5 text-left sm:grid-cols-2 lg:grid-cols-4">
            {FUNCIONALIDADES.map((item) => (
              <div key={item.titulo} className="flex flex-col rounded-xl border border-outline-variant bg-surface-container-lowest p-5">
                <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
                  <span className="material-symbols-outlined text-[20px]">{item.icono}</span>
                </span>
                <h3 className="mb-2 font-semibold text-on-surface">{item.titulo}</h3>
                <p className="mb-4 flex-1 text-sm text-on-surface-variant">{item.descripcion}</p>
                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-surface-container px-2.5 py-1 text-[11px] font-semibold text-on-surface-variant">
                  {item.etiqueta}
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-col items-center justify-between gap-4 bg-inverse-surface px-6 py-6 text-inverse-on-surface sm:flex-row">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-sm font-bold text-on-primary">S</span>
          <div className="leading-tight">
            <p className="font-semibold">Servicio Nacional de Aprendizaje — SENA</p>
            <p className="text-sm opacity-80">
              Regional Distrito Capital · Centro de Gestión de Mercados, Logística y Tecnologías de la Información (CGMLTI)
            </p>
            <p className="text-xs opacity-70">Sede Principal Calle 52 No. 13-65 · Bogotá D.C.</p>
          </div>
        </div>
        <Link
          to="/login"
          className="flex items-center gap-2 rounded-xl bg-surface-container-lowest px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container"
        >
          <span className="material-symbols-outlined text-[18px]">login</span>
          Ingresar al Sistema
        </Link>
      </section>

      <section className="px-6 py-16 text-center">
        <div className="mx-auto max-w-2xl">
          <span className="mb-4 inline-block rounded-full bg-primary-container px-3 py-1 text-xs font-semibold text-on-primary-container">
            Acceso Autorizado
          </span>
          <h2 className="mb-3 text-2xl font-bold text-on-surface">¿Listo para ingresar a tu programación académica?</h2>
          <p className="mb-6 text-on-surface-variant">
            Si eres coordinador académico o instructor del CGMLTI Calle 52, inicia sesión con tus credenciales asignadas o
            radica tu registro para validación de especialidad.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/login"
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-on-primary hover:bg-on-primary-container"
            >
              <span className="material-symbols-outlined text-[18px]">login</span>
              Iniciar Sesión (Coordinación / Instructor)
            </Link>
            <Link
              to="/registro"
              className="flex items-center gap-2 rounded-xl border border-outline px-5 py-3 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high"
            >
              <span className="material-symbols-outlined text-[18px]">assignment_ind</span>
              Solicitar Registro Docente
            </Link>
          </div>
        </div>
      </section>

      <footer className="flex flex-col items-center justify-between gap-2 border-t border-outline-variant px-6 py-5 text-xs text-on-surface-variant sm:flex-row">
        <span className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-primary text-[10px] font-bold text-on-primary">S</span>
          CGMLTI Calle 52 · Regional Distrito Capital · Servicio Nacional de Aprendizaje SENA
        </span>
        <span className="flex items-center gap-4">
          <a href="#" className="hover:text-on-surface">Mesa de Ayuda Académica</a>
          <a href="#" className="hover:text-on-surface">Términos y Normativa</a>
        </span>
      </footer>
    </div>
  )
}
