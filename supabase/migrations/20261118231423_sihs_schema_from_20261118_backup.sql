--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--



--
-- Name: estado_trimestre; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_trimestre AS ENUM (
    'planeado',
    'activo',
    'finalizado'
);


--
-- Name: estado_usuario; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_usuario AS ENUM (
    'activo',
    'inactivo'
);


--
-- Name: tipo_sede; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_sede AS ENUM (
    'principal',
    'secundaria',
    'alterna'
);


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: actividades_aprendizaje; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.actividades_aprendizaje (
    "idActividad" integer NOT NULL,
    codigo character varying(50),
    descripcion text NOT NULL,
    "tipoActividad" character varying(80),
    "duracionMinutos" integer,
    "idResultado" integer NOT NULL
);


--
-- Name: actividades_aprendizaje_idActividad_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."actividades_aprendizaje_idActividad_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: actividades_aprendizaje_idActividad_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."actividades_aprendizaje_idActividad_seq" OWNED BY public.actividades_aprendizaje."idActividad";


--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


--
-- Name: ambientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ambientes (
    "idAmbiente" integer NOT NULL,
    "nombreAmbiente" character varying(100) NOT NULL,
    "idSede" integer NOT NULL,
    "numeroAmbiente" integer NOT NULL,
    "tipoAmbiente" character varying(20) NOT NULL,
    "estadoAmbiente" character varying(30) DEFAULT 'disponible'::character varying NOT NULL,
    piso character varying(30),
    capacidad integer,
    "especialidadSala" character varying(100),
    "responsableLlaves" character varying(100),
    CONSTRAINT "ckEstadoAmbiente" CHECK ((("estadoAmbiente")::text = ANY ((ARRAY['disponible'::character varying, 'mantenimiento'::character varying, 'inactivo'::character varying])::text[]))),
    CONSTRAINT "ckTipoAmbiente" CHECK ((("tipoAmbiente")::text = ANY ((ARRAY['regular'::character varying, 'especial'::character varying])::text[]))),
    CONSTRAINT "nombreAmbienteRegular" CHECK (((("tipoAmbiente")::text = 'especial'::text) OR (("nombreAmbiente")::text = 'Ambiente'::text)))
);


--
-- Name: ambientes_idAmbiente_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."ambientes_idAmbiente_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ambientes_idAmbiente_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."ambientes_idAmbiente_seq" OWNED BY public.ambientes."idAmbiente";


--
-- Name: anotaciones_horario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.anotaciones_horario (
    "idAnotacion" integer NOT NULL,
    "idUsuario" uuid NOT NULL,
    "idHorario" integer NOT NULL,
    nota character varying(500) NOT NULL,
    etiqueta character varying(20) NOT NULL,
    "recordatorioActivo" boolean DEFAULT false NOT NULL,
    "fechaCreacion" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: anotaciones_horario_idAnotacion_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."anotaciones_horario_idAnotacion_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: anotaciones_horario_idAnotacion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."anotaciones_horario_idAnotacion_seq" OWNED BY public.anotaciones_horario."idAnotacion";


--
-- Name: asistencias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asistencias (
    "idAsistencia" integer NOT NULL,
    "idHorario" integer NOT NULL,
    "idUsuarioAprendiz" uuid NOT NULL,
    estado character varying(20) NOT NULL,
    "horaMarcacion" timestamp with time zone,
    "referenciaExcusa" character varying(200),
    "fechaCreacion" timestamp with time zone DEFAULT now() NOT NULL,
    "fechaSesion" date NOT NULL
);


--
-- Name: asistencias_idAsistencia_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."asistencias_idAsistencia_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: asistencias_idAsistencia_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."asistencias_idAsistencia_seq" OWNED BY public.asistencias."idAsistencia";


--
-- Name: auditoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditoria (
    "idAuditoria" integer NOT NULL,
    "idUsuario" uuid,
    identificador character varying(150),
    accion character varying(50) NOT NULL,
    entidad character varying(50) NOT NULL,
    "idEntidad" character varying(50),
    detalle text,
    fecha timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: auditoria_idAuditoria_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."auditoria_idAuditoria_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auditoria_idAuditoria_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."auditoria_idAuditoria_seq" OWNED BY public.auditoria."idAuditoria";


--
-- Name: avisos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.avisos (
    "idAviso" integer NOT NULL,
    "idUsuarioPublicador" uuid NOT NULL,
    titulo character varying(200) NOT NULL,
    cuerpo text NOT NULL,
    categoria character varying(20) NOT NULL,
    "idFicha" integer,
    "idSede" integer,
    "adjuntoUrl" character varying(500),
    "fechaPublicacion" timestamp with time zone DEFAULT now() NOT NULL,
    "vigenteHasta" date
);


--
-- Name: avisos_idAviso_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."avisos_idAviso_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: avisos_idAviso_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."avisos_idAviso_seq" OWNED BY public.avisos."idAviso";


--
-- Name: competencias_formacion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.competencias_formacion (
    "idCompetencia" integer NOT NULL,
    codigo character varying(50),
    descripcion text NOT NULL,
    "idPrograma" integer NOT NULL
);


--
-- Name: competencias_formacion_idCompetencia_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."competencias_formacion_idCompetencia_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: competencias_formacion_idCompetencia_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."competencias_formacion_idCompetencia_seq" OWNED BY public.competencias_formacion."idCompetencia";


--
-- Name: conversaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversaciones (
    "idConversacion" integer NOT NULL,
    "idAprendiz" uuid NOT NULL,
    "idInstructor" uuid NOT NULL,
    "fechaCreacion" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: conversaciones_idConversacion_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."conversaciones_idConversacion_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: conversaciones_idConversacion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."conversaciones_idConversacion_seq" OWNED BY public.conversaciones."idConversacion";


--
-- Name: coordinaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coordinaciones (
    "idCoordinacion" integer NOT NULL,
    "nombreCoordinacion" character varying(150) NOT NULL
);


--
-- Name: coordinaciones_idCoordinacion_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."coordinaciones_idCoordinacion_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: coordinaciones_idCoordinacion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."coordinaciones_idCoordinacion_seq" OWNED BY public.coordinaciones."idCoordinacion";


--
-- Name: diasDeLaSemana; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."diasDeLaSemana" (
    "idDia" integer NOT NULL,
    "nombreDia" character varying(10) NOT NULL
);


--
-- Name: diasDeLaSemana_idDia_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."diasDeLaSemana_idDia_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: diasDeLaSemana_idDia_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."diasDeLaSemana_idDia_seq" OWNED BY public."diasDeLaSemana"."idDia";


--
-- Name: especialidad_competencia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.especialidad_competencia (
    "idEspecialidad" integer NOT NULL,
    "idCompetencia" integer NOT NULL
);


--
-- Name: especialidades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.especialidades (
    "idEspecialidad" integer NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion character varying(255),
    activo boolean DEFAULT true NOT NULL
);


--
-- Name: especialidades_idEspecialidad_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."especialidades_idEspecialidad_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: especialidades_idEspecialidad_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."especialidades_idEspecialidad_seq" OWNED BY public.especialidades."idEspecialidad";


--
-- Name: ficha_usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ficha_usuario (
    "idFicha" integer NOT NULL,
    "idUsuario" uuid NOT NULL,
    "rolEnFicha" character varying(20)
);


--
-- Name: fichas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fichas (
    "idFicha" integer NOT NULL,
    "codigoFicha" character varying(50) NOT NULL,
    "idPrograma" integer NOT NULL,
    "idTrimestre" integer NOT NULL,
    "idSede" integer,
    "fechaInicioLectiva" date,
    "fechaFinLectiva" date,
    "fechaInicioProductiva" date,
    "fechaFinProductiva" date,
    "faseActual" integer
);


--
-- Name: fichas_idFicha_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."fichas_idFicha_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fichas_idFicha_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."fichas_idFicha_seq" OWNED BY public.fichas."idFicha";


--
-- Name: guias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guias (
    "idGuia" integer NOT NULL,
    codigo character varying(50) NOT NULL,
    "idPrograma" integer NOT NULL,
    "idTrimestre" integer NOT NULL
);


--
-- Name: guias_idGuia_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."guias_idGuia_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: guias_idGuia_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."guias_idGuia_seq" OWNED BY public.guias."idGuia";


--
-- Name: horario_dia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.horario_dia (
    "idHorario" integer NOT NULL,
    "idDia" integer NOT NULL
);


--
-- Name: horarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.horarios (
    "idHorario" integer NOT NULL,
    "horaInicio" time without time zone NOT NULL,
    "horaFin" time without time zone NOT NULL,
    "idJornada" integer NOT NULL,
    "idTrimestre" integer NOT NULL,
    "idAmbiente" integer NOT NULL,
    "idInstructor" uuid NOT NULL,
    "idFicha" integer NOT NULL,
    "idResultado" integer NOT NULL,
    "fechaCreacion" timestamp with time zone DEFAULT now() NOT NULL,
    "fechaModificacion" timestamp with time zone DEFAULT now() NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    publicado boolean DEFAULT true NOT NULL,
    CONSTRAINT "horaFinDespuesDeInicio" CHECK (("horaFin" > "horaInicio"))
);


--
-- Name: horarios_guardados; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.horarios_guardados (
    "idHorarioGuardado" integer NOT NULL,
    "idUsuario" uuid NOT NULL,
    ficha character varying(100) NOT NULL,
    aprendices character varying(20),
    "horasTrimestre" character varying(20),
    "fechaInicio" date,
    "fechaFin" date,
    bloques jsonb NOT NULL,
    grid jsonb NOT NULL,
    "fechaCreacion" timestamp with time zone DEFAULT now() NOT NULL,
    "idsHorarios" jsonb
);


--
-- Name: horarios_guardados_idHorarioGuardado_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."horarios_guardados_idHorarioGuardado_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: horarios_guardados_idHorarioGuardado_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."horarios_guardados_idHorarioGuardado_seq" OWNED BY public.horarios_guardados."idHorarioGuardado";


--
-- Name: horarios_idHorario_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."horarios_idHorario_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: horarios_idHorario_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."horarios_idHorario_seq" OWNED BY public.horarios."idHorario";


--
-- Name: jornadas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jornadas (
    "idJornada" integer NOT NULL,
    "nombreJornada" character varying(50) NOT NULL
);


--
-- Name: jornadas_idJornada_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."jornadas_idJornada_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: jornadas_idJornada_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."jornadas_idJornada_seq" OWNED BY public.jornadas."idJornada";


--
-- Name: mensajes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mensajes (
    "idMensaje" integer NOT NULL,
    "idConversacion" integer NOT NULL,
    "idRemitente" uuid NOT NULL,
    contenido text NOT NULL,
    "adjuntoUrl" character varying(500),
    leido boolean DEFAULT false NOT NULL,
    "fechaEnvio" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mensajes_idMensaje_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."mensajes_idMensaje_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mensajes_idMensaje_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."mensajes_idMensaje_seq" OWNED BY public.mensajes."idMensaje";


--
-- Name: notificaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notificaciones (
    "idNotificacion" integer NOT NULL,
    "idUsuario" uuid NOT NULL,
    tipo character varying(30) NOT NULL,
    mensaje character varying(500) NOT NULL,
    leida boolean DEFAULT false NOT NULL,
    "fechaCreacion" timestamp with time zone DEFAULT now() NOT NULL,
    "entidadRelacionada" character varying(50),
    "idEntidadRelacionada" character varying(50)
);


--
-- Name: notificaciones_idNotificacion_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."notificaciones_idNotificacion_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notificaciones_idNotificacion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."notificaciones_idNotificacion_seq" OWNED BY public.notificaciones."idNotificacion";


--
-- Name: programas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.programas (
    "idPrograma" integer NOT NULL,
    "codigoPrograma" character varying(20) NOT NULL,
    "nombrePrograma" character varying(150) NOT NULL,
    "nivelFormacion" character varying(30),
    activo boolean DEFAULT true NOT NULL,
    "idCoordinacion" integer NOT NULL
);


--
-- Name: programas_idPrograma_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."programas_idPrograma_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: programas_idPrograma_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."programas_idPrograma_seq" OWNED BY public.programas."idPrograma";


--
-- Name: publicacion_programada_horarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.publicacion_programada_horarios (
    "idPublicacionHorario" integer NOT NULL,
    "idPublicacion" integer NOT NULL,
    "idHorario" integer,
    "idHorarioReferencia" integer NOT NULL,
    revision integer NOT NULL,
    "huellaRevision" character varying(64) NOT NULL
);


--
-- Name: publicacion_programada_horarios_idPublicacionHorario_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."publicacion_programada_horarios_idPublicacionHorario_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: publicacion_programada_horarios_idPublicacionHorario_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."publicacion_programada_horarios_idPublicacionHorario_seq" OWNED BY public.publicacion_programada_horarios."idPublicacionHorario";


--
-- Name: publicaciones_programadas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.publicaciones_programadas (
    "idPublicacion" integer NOT NULL,
    "idTrimestre" integer NOT NULL,
    "idCoordinador" uuid NOT NULL,
    "fechaEjecucion" timestamp with time zone NOT NULL,
    estado character varying(30) DEFAULT 'pendiente'::character varying NOT NULL,
    "fechaCreacion" timestamp with time zone DEFAULT now() NOT NULL,
    "fechaEjecucionReal" timestamp with time zone,
    resultado text,
    revision integer DEFAULT 1 NOT NULL,
    CONSTRAINT ck_publicaciones_programadas_estado CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'ejecutando'::character varying, 'publicada'::character varying, 'fallida'::character varying, 'cancelada'::character varying, 'revision_requerida'::character varying])::text[])))
);


--
-- Name: publicaciones_programadas_idPublicacion_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."publicaciones_programadas_idPublicacion_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: publicaciones_programadas_idPublicacion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."publicaciones_programadas_idPublicacion_seq" OWNED BY public.publicaciones_programadas."idPublicacion";


--
-- Name: resultados_aprendizaje; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resultados_aprendizaje (
    "idResultado" integer NOT NULL,
    codigo character varying(50),
    descripcion text NOT NULL,
    "idCompetencia" integer NOT NULL,
    "idGuia" integer,
    "horasAsignadas" integer,
    "numeroFase" integer
);


--
-- Name: resultados_aprendizaje_idResultado_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."resultados_aprendizaje_idResultado_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: resultados_aprendizaje_idResultado_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."resultados_aprendizaje_idResultado_seq" OWNED BY public.resultados_aprendizaje."idResultado";


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    "idRol" integer NOT NULL,
    nombre character varying(50) NOT NULL
);


--
-- Name: roles_idRol_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."roles_idRol_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roles_idRol_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."roles_idRol_seq" OWNED BY public.roles."idRol";


--
-- Name: sedes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sedes (
    "idSede" integer NOT NULL,
    "nombreSede" character varying(150) NOT NULL,
    direccion character varying(255),
    "tipoSede" public.tipo_sede
);


--
-- Name: sedes_idSede_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."sedes_idSede_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sedes_idSede_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."sedes_idSede_seq" OWNED BY public.sedes."idSede";


--
-- Name: solicitud_cambio_horario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.solicitud_cambio_horario (
    "idSolicitud" integer NOT NULL,
    "idInstructor" uuid NOT NULL,
    "idHorarioOrigen" integer NOT NULL,
    tipo character varying(20) NOT NULL,
    motivo character varying(1000) NOT NULL,
    estado character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    "fechaSolicitud" timestamp with time zone DEFAULT now() NOT NULL,
    "fechaResolucion" timestamp with time zone,
    "idAdminResolvio" uuid
);


--
-- Name: solicitud_cambio_horario_idSolicitud_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."solicitud_cambio_horario_idSolicitud_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: solicitud_cambio_horario_idSolicitud_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."solicitud_cambio_horario_idSolicitud_seq" OWNED BY public.solicitud_cambio_horario."idSolicitud";


--
-- Name: solicitudes_acceso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.solicitudes_acceso (
    "idSolicitud" integer NOT NULL,
    nombre character varying(150) NOT NULL,
    email character varying(150) NOT NULL,
    "numeroDocumento" character varying(30),
    "idRolSolicitado" integer NOT NULL,
    motivo text NOT NULL,
    estado character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    "motivoRechazo" text,
    "fechaSolicitud" timestamp with time zone DEFAULT now() NOT NULL,
    "fechaResolucion" timestamp with time zone,
    "idAdminResolvio" uuid
);


--
-- Name: solicitudes_acceso_idSolicitud_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."solicitudes_acceso_idSolicitud_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: solicitudes_acceso_idSolicitud_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."solicitudes_acceso_idSolicitud_seq" OWNED BY public.solicitudes_acceso."idSolicitud";


--
-- Name: trimestres; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trimestres (
    "idTrimestre" integer NOT NULL,
    nombre character varying(20) NOT NULL,
    "fechaInicio" date NOT NULL,
    "fechaFin" date NOT NULL,
    estado public.estado_trimestre DEFAULT 'planeado'::public.estado_trimestre
);


--
-- Name: trimestres_idTrimestre_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."trimestres_idTrimestre_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: trimestres_idTrimestre_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."trimestres_idTrimestre_seq" OWNED BY public.trimestres."idTrimestre";


--
-- Name: usuario_especialidad; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuario_especialidad (
    "idUsuario" uuid NOT NULL,
    "idEspecialidad" integer NOT NULL
);


--
-- Name: usuario_rol; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuario_rol (
    "idUsuario" uuid NOT NULL,
    "idRol" integer NOT NULL
);


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios (
    "idUsuario" uuid NOT NULL,
    nombre character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    estado public.estado_usuario DEFAULT 'activo'::public.estado_usuario,
    "fechaRegistro" timestamp with time zone DEFAULT now(),
    "tipoContrato" character varying(20),
    "horasContratadasSemana" integer,
    "codigoInstructor" character varying(20),
    sigla character varying(10),
    "numeroDocumento" character varying(30),
    "idTrimestre" integer,
    "debeCambiarClave" boolean DEFAULT false NOT NULL,
    "preferenciaTema" character varying(10),
    CONSTRAINT ck_usuarios_preferencia_tema CHECK ((("preferenciaTema" IS NULL) OR (("preferenciaTema")::text = ANY ((ARRAY['claro'::character varying, 'oscuro'::character varying, 'sistema'::character varying])::text[]))))
);


--
-- Name: worker_publicacion_estado; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.worker_publicacion_estado (
    id integer NOT NULL,
    "ultimaSenal" timestamp with time zone NOT NULL,
    CONSTRAINT ck_worker_publicacion_estado_singleton CHECK ((id = 1))
);


--
-- Name: worker_publicacion_estado_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.worker_publicacion_estado_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: worker_publicacion_estado_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.worker_publicacion_estado_id_seq OWNED BY public.worker_publicacion_estado.id;


--
-- Name: actividades_aprendizaje idActividad; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.actividades_aprendizaje ALTER COLUMN "idActividad" SET DEFAULT nextval('public."actividades_aprendizaje_idActividad_seq"'::regclass);


--
-- Name: ambientes idAmbiente; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambientes ALTER COLUMN "idAmbiente" SET DEFAULT nextval('public."ambientes_idAmbiente_seq"'::regclass);


--
-- Name: anotaciones_horario idAnotacion; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anotaciones_horario ALTER COLUMN "idAnotacion" SET DEFAULT nextval('public."anotaciones_horario_idAnotacion_seq"'::regclass);


--
-- Name: asistencias idAsistencia; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencias ALTER COLUMN "idAsistencia" SET DEFAULT nextval('public."asistencias_idAsistencia_seq"'::regclass);


--
-- Name: auditoria idAuditoria; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria ALTER COLUMN "idAuditoria" SET DEFAULT nextval('public."auditoria_idAuditoria_seq"'::regclass);


--
-- Name: avisos idAviso; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avisos ALTER COLUMN "idAviso" SET DEFAULT nextval('public."avisos_idAviso_seq"'::regclass);


--
-- Name: competencias_formacion idCompetencia; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competencias_formacion ALTER COLUMN "idCompetencia" SET DEFAULT nextval('public."competencias_formacion_idCompetencia_seq"'::regclass);


--
-- Name: conversaciones idConversacion; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversaciones ALTER COLUMN "idConversacion" SET DEFAULT nextval('public."conversaciones_idConversacion_seq"'::regclass);


--
-- Name: coordinaciones idCoordinacion; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coordinaciones ALTER COLUMN "idCoordinacion" SET DEFAULT nextval('public."coordinaciones_idCoordinacion_seq"'::regclass);


--
-- Name: diasDeLaSemana idDia; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."diasDeLaSemana" ALTER COLUMN "idDia" SET DEFAULT nextval('public."diasDeLaSemana_idDia_seq"'::regclass);


--
-- Name: especialidades idEspecialidad; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.especialidades ALTER COLUMN "idEspecialidad" SET DEFAULT nextval('public."especialidades_idEspecialidad_seq"'::regclass);


--
-- Name: fichas idFicha; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fichas ALTER COLUMN "idFicha" SET DEFAULT nextval('public."fichas_idFicha_seq"'::regclass);


--
-- Name: guias idGuia; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guias ALTER COLUMN "idGuia" SET DEFAULT nextval('public."guias_idGuia_seq"'::regclass);


--
-- Name: horarios idHorario; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horarios ALTER COLUMN "idHorario" SET DEFAULT nextval('public."horarios_idHorario_seq"'::regclass);


--
-- Name: horarios_guardados idHorarioGuardado; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horarios_guardados ALTER COLUMN "idHorarioGuardado" SET DEFAULT nextval('public."horarios_guardados_idHorarioGuardado_seq"'::regclass);


--
-- Name: jornadas idJornada; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jornadas ALTER COLUMN "idJornada" SET DEFAULT nextval('public."jornadas_idJornada_seq"'::regclass);


--
-- Name: mensajes idMensaje; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensajes ALTER COLUMN "idMensaje" SET DEFAULT nextval('public."mensajes_idMensaje_seq"'::regclass);


--
-- Name: notificaciones idNotificacion; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones ALTER COLUMN "idNotificacion" SET DEFAULT nextval('public."notificaciones_idNotificacion_seq"'::regclass);


--
-- Name: programas idPrograma; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.programas ALTER COLUMN "idPrograma" SET DEFAULT nextval('public."programas_idPrograma_seq"'::regclass);


--
-- Name: publicacion_programada_horarios idPublicacionHorario; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publicacion_programada_horarios ALTER COLUMN "idPublicacionHorario" SET DEFAULT nextval('public."publicacion_programada_horarios_idPublicacionHorario_seq"'::regclass);


--
-- Name: publicaciones_programadas idPublicacion; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publicaciones_programadas ALTER COLUMN "idPublicacion" SET DEFAULT nextval('public."publicaciones_programadas_idPublicacion_seq"'::regclass);


--
-- Name: resultados_aprendizaje idResultado; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resultados_aprendizaje ALTER COLUMN "idResultado" SET DEFAULT nextval('public."resultados_aprendizaje_idResultado_seq"'::regclass);


--
-- Name: roles idRol; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN "idRol" SET DEFAULT nextval('public."roles_idRol_seq"'::regclass);


--
-- Name: sedes idSede; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sedes ALTER COLUMN "idSede" SET DEFAULT nextval('public."sedes_idSede_seq"'::regclass);


--
-- Name: solicitud_cambio_horario idSolicitud; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitud_cambio_horario ALTER COLUMN "idSolicitud" SET DEFAULT nextval('public."solicitud_cambio_horario_idSolicitud_seq"'::regclass);


--
-- Name: solicitudes_acceso idSolicitud; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_acceso ALTER COLUMN "idSolicitud" SET DEFAULT nextval('public."solicitudes_acceso_idSolicitud_seq"'::regclass);


--
-- Name: trimestres idTrimestre; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trimestres ALTER COLUMN "idTrimestre" SET DEFAULT nextval('public."trimestres_idTrimestre_seq"'::regclass);


--
-- Name: worker_publicacion_estado id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_publicacion_estado ALTER COLUMN id SET DEFAULT nextval('public.worker_publicacion_estado_id_seq'::regclass);


--
-- Name: actividades_aprendizaje actividades_aprendizaje_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.actividades_aprendizaje
    ADD CONSTRAINT actividades_aprendizaje_pkey PRIMARY KEY ("idActividad");


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: ambientes ambientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambientes
    ADD CONSTRAINT ambientes_pkey PRIMARY KEY ("idAmbiente");


--
-- Name: anotaciones_horario anotaciones_horario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anotaciones_horario
    ADD CONSTRAINT anotaciones_horario_pkey PRIMARY KEY ("idAnotacion");


--
-- Name: asistencias asistencias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencias
    ADD CONSTRAINT asistencias_pkey PRIMARY KEY ("idAsistencia");


--
-- Name: auditoria auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_pkey PRIMARY KEY ("idAuditoria");


--
-- Name: avisos avisos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avisos
    ADD CONSTRAINT avisos_pkey PRIMARY KEY ("idAviso");


--
-- Name: competencias_formacion competencias_formacion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competencias_formacion
    ADD CONSTRAINT competencias_formacion_pkey PRIMARY KEY ("idCompetencia");


--
-- Name: conversaciones conversaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversaciones
    ADD CONSTRAINT conversaciones_pkey PRIMARY KEY ("idConversacion");


--
-- Name: coordinaciones coordinaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coordinaciones
    ADD CONSTRAINT coordinaciones_pkey PRIMARY KEY ("idCoordinacion");


--
-- Name: diasDeLaSemana diasDeLaSemana_nombreDia_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."diasDeLaSemana"
    ADD CONSTRAINT "diasDeLaSemana_nombreDia_key" UNIQUE ("nombreDia");


--
-- Name: diasDeLaSemana diasDeLaSemana_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."diasDeLaSemana"
    ADD CONSTRAINT "diasDeLaSemana_pkey" PRIMARY KEY ("idDia");


--
-- Name: especialidad_competencia especialidad_competencia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.especialidad_competencia
    ADD CONSTRAINT especialidad_competencia_pkey PRIMARY KEY ("idEspecialidad", "idCompetencia");


--
-- Name: especialidades especialidades_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.especialidades
    ADD CONSTRAINT especialidades_nombre_key UNIQUE (nombre);


--
-- Name: especialidades especialidades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.especialidades
    ADD CONSTRAINT especialidades_pkey PRIMARY KEY ("idEspecialidad");


--
-- Name: ficha_usuario ficha_usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ficha_usuario
    ADD CONSTRAINT ficha_usuario_pkey PRIMARY KEY ("idFicha", "idUsuario");


--
-- Name: fichas fichas_codigoFicha_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fichas
    ADD CONSTRAINT "fichas_codigoFicha_key" UNIQUE ("codigoFicha");


--
-- Name: fichas fichas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fichas
    ADD CONSTRAINT fichas_pkey PRIMARY KEY ("idFicha");


--
-- Name: guias guias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guias
    ADD CONSTRAINT guias_pkey PRIMARY KEY ("idGuia");


--
-- Name: horario_dia horario_dia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horario_dia
    ADD CONSTRAINT horario_dia_pkey PRIMARY KEY ("idHorario", "idDia");


--
-- Name: horarios_guardados horarios_guardados_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horarios_guardados
    ADD CONSTRAINT horarios_guardados_pkey PRIMARY KEY ("idHorarioGuardado");


--
-- Name: horarios horarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horarios
    ADD CONSTRAINT horarios_pkey PRIMARY KEY ("idHorario");


--
-- Name: jornadas jornadas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jornadas
    ADD CONSTRAINT jornadas_pkey PRIMARY KEY ("idJornada");


--
-- Name: mensajes mensajes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensajes
    ADD CONSTRAINT mensajes_pkey PRIMARY KEY ("idMensaje");


--
-- Name: notificaciones notificaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones
    ADD CONSTRAINT notificaciones_pkey PRIMARY KEY ("idNotificacion");


--
-- Name: publicacion_programada_horarios pk_publicacion_programada_horarios; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publicacion_programada_horarios
    ADD CONSTRAINT pk_publicacion_programada_horarios PRIMARY KEY ("idPublicacionHorario");


--
-- Name: publicaciones_programadas pk_publicaciones_programadas; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publicaciones_programadas
    ADD CONSTRAINT pk_publicaciones_programadas PRIMARY KEY ("idPublicacion");


--
-- Name: worker_publicacion_estado pk_worker_publicacion_estado; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_publicacion_estado
    ADD CONSTRAINT pk_worker_publicacion_estado PRIMARY KEY (id);


--
-- Name: programas programas_codigoPrograma_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.programas
    ADD CONSTRAINT "programas_codigoPrograma_key" UNIQUE ("codigoPrograma");


--
-- Name: programas programas_nombrePrograma_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.programas
    ADD CONSTRAINT "programas_nombrePrograma_key" UNIQUE ("nombrePrograma");


--
-- Name: programas programas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.programas
    ADD CONSTRAINT programas_pkey PRIMARY KEY ("idPrograma");


--
-- Name: resultados_aprendizaje resultados_aprendizaje_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resultados_aprendizaje
    ADD CONSTRAINT resultados_aprendizaje_pkey PRIMARY KEY ("idResultado");


--
-- Name: roles roles_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key UNIQUE (nombre);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY ("idRol");


--
-- Name: sedes sedes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sedes
    ADD CONSTRAINT sedes_pkey PRIMARY KEY ("idSede");


--
-- Name: solicitud_cambio_horario solicitud_cambio_horario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitud_cambio_horario
    ADD CONSTRAINT solicitud_cambio_horario_pkey PRIMARY KEY ("idSolicitud");


--
-- Name: solicitudes_acceso solicitudes_acceso_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_acceso
    ADD CONSTRAINT solicitudes_acceso_pkey PRIMARY KEY ("idSolicitud");


--
-- Name: trimestres trimestres_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trimestres
    ADD CONSTRAINT trimestres_pkey PRIMARY KEY ("idTrimestre");


--
-- Name: ambientes uqAmbienteNumeroSede; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambientes
    ADD CONSTRAINT "uqAmbienteNumeroSede" UNIQUE ("numeroAmbiente", "idSede");


--
-- Name: asistencias uqAsistenciaHorarioAprendizFecha; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencias
    ADD CONSTRAINT "uqAsistenciaHorarioAprendizFecha" UNIQUE ("idHorario", "idUsuarioAprendiz", "fechaSesion");


--
-- Name: conversaciones uqConversacionAprendizInstructor; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversaciones
    ADD CONSTRAINT "uqConversacionAprendizInstructor" UNIQUE ("idAprendiz", "idInstructor");


--
-- Name: publicacion_programada_horarios uq_publicacion_revision_horario; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publicacion_programada_horarios
    ADD CONSTRAINT uq_publicacion_revision_horario UNIQUE ("idPublicacion", revision, "idHorarioReferencia");


--
-- Name: usuarios uq_usuarios_numeroDocumento; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT "uq_usuarios_numeroDocumento" UNIQUE ("numeroDocumento");


--
-- Name: usuario_especialidad usuario_especialidad_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_especialidad
    ADD CONSTRAINT usuario_especialidad_pkey PRIMARY KEY ("idUsuario", "idEspecialidad");


--
-- Name: usuario_rol usuario_rol_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_rol
    ADD CONSTRAINT usuario_rol_pkey PRIMARY KEY ("idUsuario", "idRol");


--
-- Name: usuarios usuarios_codigoInstructor_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT "usuarios_codigoInstructor_key" UNIQUE ("codigoInstructor");


--
-- Name: usuarios usuarios_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key UNIQUE (email);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY ("idUsuario");


--
-- Name: idxAuditoriaIdentificadorAccion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idxAuditoriaIdentificadorAccion" ON public.auditoria USING btree (identificador, accion, fecha);


--
-- Name: idxAuditoriaUsuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idxAuditoriaUsuario" ON public.auditoria USING btree ("idUsuario");


--
-- Name: idxHorarioAmbiente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idxHorarioAmbiente" ON public.horarios USING btree ("idAmbiente");


--
-- Name: idxHorarioFicha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idxHorarioFicha" ON public.horarios USING btree ("idFicha");


--
-- Name: idxHorarioGuardadoUsuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idxHorarioGuardadoUsuario" ON public.horarios_guardados USING btree ("idUsuario");


--
-- Name: idxHorarioInstructor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idxHorarioInstructor" ON public.horarios USING btree ("idInstructor");


--
-- Name: idxHorarioTrimestre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idxHorarioTrimestre" ON public.horarios USING btree ("idTrimestre");


--
-- Name: ixAsistenciaAprendizFecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ixAsistenciaAprendizFecha" ON public.asistencias USING btree ("idUsuarioAprendiz", "fechaSesion");


--
-- Name: ix_anotaciones_horario_idAnotacion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ix_anotaciones_horario_idAnotacion" ON public.anotaciones_horario USING btree ("idAnotacion");


--
-- Name: ix_asistencias_idAsistencia; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ix_asistencias_idAsistencia" ON public.asistencias USING btree ("idAsistencia");


--
-- Name: ix_avisos_idAviso; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ix_avisos_idAviso" ON public.avisos USING btree ("idAviso");


--
-- Name: ix_conversaciones_idConversacion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ix_conversaciones_idConversacion" ON public.conversaciones USING btree ("idConversacion");


--
-- Name: ix_especialidad_competencia_idCompetencia; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ix_especialidad_competencia_idCompetencia" ON public.especialidad_competencia USING btree ("idCompetencia");


--
-- Name: ix_mensajes_idMensaje; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ix_mensajes_idMensaje" ON public.mensajes USING btree ("idMensaje");


--
-- Name: ix_notificaciones_idNotificacion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ix_notificaciones_idNotificacion" ON public.notificaciones USING btree ("idNotificacion");


--
-- Name: ix_publicacion_programada_horarios_horario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_publicacion_programada_horarios_horario ON public.publicacion_programada_horarios USING btree ("idHorario");


--
-- Name: ix_publicaciones_programadas_estado_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_publicaciones_programadas_estado_fecha ON public.publicaciones_programadas USING btree (estado, "fechaEjecucion");


--
-- Name: ix_solicitud_cambio_horario_idSolicitud; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ix_solicitud_cambio_horario_idSolicitud" ON public.solicitud_cambio_horario USING btree ("idSolicitud");


--
-- Name: ix_solicitudes_acceso_idSolicitud; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ix_solicitudes_acceso_idSolicitud" ON public.solicitudes_acceso USING btree ("idSolicitud");


--
-- Name: actividades_aprendizaje actividades_aprendizaje_idResultado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.actividades_aprendizaje
    ADD CONSTRAINT "actividades_aprendizaje_idResultado_fkey" FOREIGN KEY ("idResultado") REFERENCES public.resultados_aprendizaje("idResultado") ON DELETE CASCADE;


--
-- Name: ambientes ambientes_idSede_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambientes
    ADD CONSTRAINT "ambientes_idSede_fkey" FOREIGN KEY ("idSede") REFERENCES public.sedes("idSede");


--
-- Name: anotaciones_horario anotaciones_horario_idHorario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anotaciones_horario
    ADD CONSTRAINT "anotaciones_horario_idHorario_fkey" FOREIGN KEY ("idHorario") REFERENCES public.horarios("idHorario") ON DELETE CASCADE;


--
-- Name: anotaciones_horario anotaciones_horario_idUsuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anotaciones_horario
    ADD CONSTRAINT "anotaciones_horario_idUsuario_fkey" FOREIGN KEY ("idUsuario") REFERENCES public.usuarios("idUsuario") ON DELETE CASCADE;


--
-- Name: asistencias asistencias_idHorario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencias
    ADD CONSTRAINT "asistencias_idHorario_fkey" FOREIGN KEY ("idHorario") REFERENCES public.horarios("idHorario");


--
-- Name: asistencias asistencias_idUsuarioAprendiz_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencias
    ADD CONSTRAINT "asistencias_idUsuarioAprendiz_fkey" FOREIGN KEY ("idUsuarioAprendiz") REFERENCES public.usuarios("idUsuario");


--
-- Name: auditoria auditoria_idUsuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT "auditoria_idUsuario_fkey" FOREIGN KEY ("idUsuario") REFERENCES public.usuarios("idUsuario") ON DELETE SET NULL;


--
-- Name: avisos avisos_idFicha_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avisos
    ADD CONSTRAINT "avisos_idFicha_fkey" FOREIGN KEY ("idFicha") REFERENCES public.fichas("idFicha");


--
-- Name: avisos avisos_idSede_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avisos
    ADD CONSTRAINT "avisos_idSede_fkey" FOREIGN KEY ("idSede") REFERENCES public.sedes("idSede");


--
-- Name: avisos avisos_idUsuarioPublicador_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avisos
    ADD CONSTRAINT "avisos_idUsuarioPublicador_fkey" FOREIGN KEY ("idUsuarioPublicador") REFERENCES public.usuarios("idUsuario");


--
-- Name: competencias_formacion competencias_formacion_idPrograma_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competencias_formacion
    ADD CONSTRAINT "competencias_formacion_idPrograma_fkey" FOREIGN KEY ("idPrograma") REFERENCES public.programas("idPrograma");


--
-- Name: conversaciones conversaciones_idAprendiz_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversaciones
    ADD CONSTRAINT "conversaciones_idAprendiz_fkey" FOREIGN KEY ("idAprendiz") REFERENCES public.usuarios("idUsuario");


--
-- Name: conversaciones conversaciones_idInstructor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversaciones
    ADD CONSTRAINT "conversaciones_idInstructor_fkey" FOREIGN KEY ("idInstructor") REFERENCES public.usuarios("idUsuario");


--
-- Name: especialidad_competencia especialidad_competencia_idCompetencia_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.especialidad_competencia
    ADD CONSTRAINT "especialidad_competencia_idCompetencia_fkey" FOREIGN KEY ("idCompetencia") REFERENCES public.competencias_formacion("idCompetencia") ON DELETE CASCADE;


--
-- Name: especialidad_competencia especialidad_competencia_idEspecialidad_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.especialidad_competencia
    ADD CONSTRAINT "especialidad_competencia_idEspecialidad_fkey" FOREIGN KEY ("idEspecialidad") REFERENCES public.especialidades("idEspecialidad") ON DELETE CASCADE;


--
-- Name: ficha_usuario ficha_usuario_idFicha_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ficha_usuario
    ADD CONSTRAINT "ficha_usuario_idFicha_fkey" FOREIGN KEY ("idFicha") REFERENCES public.fichas("idFicha") ON DELETE CASCADE;


--
-- Name: ficha_usuario ficha_usuario_idUsuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ficha_usuario
    ADD CONSTRAINT "ficha_usuario_idUsuario_fkey" FOREIGN KEY ("idUsuario") REFERENCES public.usuarios("idUsuario") ON DELETE CASCADE;


--
-- Name: fichas fichas_idPrograma_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fichas
    ADD CONSTRAINT "fichas_idPrograma_fkey" FOREIGN KEY ("idPrograma") REFERENCES public.programas("idPrograma");


--
-- Name: fichas fichas_idSede_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fichas
    ADD CONSTRAINT "fichas_idSede_fkey" FOREIGN KEY ("idSede") REFERENCES public.sedes("idSede");


--
-- Name: fichas fichas_idTrimestre_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fichas
    ADD CONSTRAINT "fichas_idTrimestre_fkey" FOREIGN KEY ("idTrimestre") REFERENCES public.trimestres("idTrimestre");


--
-- Name: publicacion_programada_horarios fk_publicacion_programada_horarios_horario; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publicacion_programada_horarios
    ADD CONSTRAINT fk_publicacion_programada_horarios_horario FOREIGN KEY ("idHorario") REFERENCES public.horarios("idHorario") ON DELETE SET NULL;


--
-- Name: publicacion_programada_horarios fk_publicacion_programada_horarios_publicacion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publicacion_programada_horarios
    ADD CONSTRAINT fk_publicacion_programada_horarios_publicacion FOREIGN KEY ("idPublicacion") REFERENCES public.publicaciones_programadas("idPublicacion") ON DELETE CASCADE;


--
-- Name: publicaciones_programadas fk_publicaciones_programadas_coordinador; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publicaciones_programadas
    ADD CONSTRAINT fk_publicaciones_programadas_coordinador FOREIGN KEY ("idCoordinador") REFERENCES public.usuarios("idUsuario") ON DELETE RESTRICT;


--
-- Name: publicaciones_programadas fk_publicaciones_programadas_trimestre; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publicaciones_programadas
    ADD CONSTRAINT fk_publicaciones_programadas_trimestre FOREIGN KEY ("idTrimestre") REFERENCES public.trimestres("idTrimestre") ON DELETE RESTRICT;


--
-- Name: guias guias_idPrograma_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guias
    ADD CONSTRAINT "guias_idPrograma_fkey" FOREIGN KEY ("idPrograma") REFERENCES public.programas("idPrograma");


--
-- Name: guias guias_idTrimestre_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guias
    ADD CONSTRAINT "guias_idTrimestre_fkey" FOREIGN KEY ("idTrimestre") REFERENCES public.trimestres("idTrimestre");


--
-- Name: horario_dia horario_dia_idDia_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horario_dia
    ADD CONSTRAINT "horario_dia_idDia_fkey" FOREIGN KEY ("idDia") REFERENCES public."diasDeLaSemana"("idDia");


--
-- Name: horario_dia horario_dia_idHorario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horario_dia
    ADD CONSTRAINT "horario_dia_idHorario_fkey" FOREIGN KEY ("idHorario") REFERENCES public.horarios("idHorario") ON DELETE CASCADE;


--
-- Name: horarios_guardados horarios_guardados_idUsuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horarios_guardados
    ADD CONSTRAINT "horarios_guardados_idUsuario_fkey" FOREIGN KEY ("idUsuario") REFERENCES public.usuarios("idUsuario") ON DELETE CASCADE;


--
-- Name: horarios horarios_idAmbiente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horarios
    ADD CONSTRAINT "horarios_idAmbiente_fkey" FOREIGN KEY ("idAmbiente") REFERENCES public.ambientes("idAmbiente");


--
-- Name: horarios horarios_idFicha_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horarios
    ADD CONSTRAINT "horarios_idFicha_fkey" FOREIGN KEY ("idFicha") REFERENCES public.fichas("idFicha");


--
-- Name: horarios horarios_idInstructor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horarios
    ADD CONSTRAINT "horarios_idInstructor_fkey" FOREIGN KEY ("idInstructor") REFERENCES public.usuarios("idUsuario");


--
-- Name: horarios horarios_idJornada_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horarios
    ADD CONSTRAINT "horarios_idJornada_fkey" FOREIGN KEY ("idJornada") REFERENCES public.jornadas("idJornada");


--
-- Name: horarios horarios_idResultado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horarios
    ADD CONSTRAINT "horarios_idResultado_fkey" FOREIGN KEY ("idResultado") REFERENCES public.resultados_aprendizaje("idResultado");


--
-- Name: horarios horarios_idTrimestre_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horarios
    ADD CONSTRAINT "horarios_idTrimestre_fkey" FOREIGN KEY ("idTrimestre") REFERENCES public.trimestres("idTrimestre");


--
-- Name: mensajes mensajes_idConversacion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensajes
    ADD CONSTRAINT "mensajes_idConversacion_fkey" FOREIGN KEY ("idConversacion") REFERENCES public.conversaciones("idConversacion") ON DELETE CASCADE;


--
-- Name: mensajes mensajes_idRemitente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensajes
    ADD CONSTRAINT "mensajes_idRemitente_fkey" FOREIGN KEY ("idRemitente") REFERENCES public.usuarios("idUsuario");


--
-- Name: notificaciones notificaciones_idUsuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones
    ADD CONSTRAINT "notificaciones_idUsuario_fkey" FOREIGN KEY ("idUsuario") REFERENCES public.usuarios("idUsuario") ON DELETE CASCADE;


--
-- Name: programas programas_idCoordinacion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.programas
    ADD CONSTRAINT "programas_idCoordinacion_fkey" FOREIGN KEY ("idCoordinacion") REFERENCES public.coordinaciones("idCoordinacion");


--
-- Name: resultados_aprendizaje resultados_aprendizaje_idCompetencia_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resultados_aprendizaje
    ADD CONSTRAINT "resultados_aprendizaje_idCompetencia_fkey" FOREIGN KEY ("idCompetencia") REFERENCES public.competencias_formacion("idCompetencia") ON DELETE CASCADE;


--
-- Name: resultados_aprendizaje resultados_aprendizaje_idGuia_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resultados_aprendizaje
    ADD CONSTRAINT "resultados_aprendizaje_idGuia_fkey" FOREIGN KEY ("idGuia") REFERENCES public.guias("idGuia");


--
-- Name: solicitud_cambio_horario solicitud_cambio_horario_idAdminResolvio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitud_cambio_horario
    ADD CONSTRAINT "solicitud_cambio_horario_idAdminResolvio_fkey" FOREIGN KEY ("idAdminResolvio") REFERENCES public.usuarios("idUsuario");


--
-- Name: solicitud_cambio_horario solicitud_cambio_horario_idHorarioOrigen_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitud_cambio_horario
    ADD CONSTRAINT "solicitud_cambio_horario_idHorarioOrigen_fkey" FOREIGN KEY ("idHorarioOrigen") REFERENCES public.horarios("idHorario");


--
-- Name: solicitud_cambio_horario solicitud_cambio_horario_idInstructor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitud_cambio_horario
    ADD CONSTRAINT "solicitud_cambio_horario_idInstructor_fkey" FOREIGN KEY ("idInstructor") REFERENCES public.usuarios("idUsuario");


--
-- Name: solicitudes_acceso solicitudes_acceso_idAdminResolvio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_acceso
    ADD CONSTRAINT "solicitudes_acceso_idAdminResolvio_fkey" FOREIGN KEY ("idAdminResolvio") REFERENCES public.usuarios("idUsuario");


--
-- Name: solicitudes_acceso solicitudes_acceso_idRolSolicitado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_acceso
    ADD CONSTRAINT "solicitudes_acceso_idRolSolicitado_fkey" FOREIGN KEY ("idRolSolicitado") REFERENCES public.roles("idRol");


--
-- Name: usuario_especialidad usuario_especialidad_idEspecialidad_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_especialidad
    ADD CONSTRAINT "usuario_especialidad_idEspecialidad_fkey" FOREIGN KEY ("idEspecialidad") REFERENCES public.especialidades("idEspecialidad") ON DELETE CASCADE;


--
-- Name: usuario_especialidad usuario_especialidad_idUsuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_especialidad
    ADD CONSTRAINT "usuario_especialidad_idUsuario_fkey" FOREIGN KEY ("idUsuario") REFERENCES public.usuarios("idUsuario") ON DELETE CASCADE;


--
-- Name: usuario_rol usuario_rol_idRol_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_rol
    ADD CONSTRAINT "usuario_rol_idRol_fkey" FOREIGN KEY ("idRol") REFERENCES public.roles("idRol") ON DELETE CASCADE;


--
-- Name: usuario_rol usuario_rol_idUsuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_rol
    ADD CONSTRAINT "usuario_rol_idUsuario_fkey" FOREIGN KEY ("idUsuario") REFERENCES public.usuarios("idUsuario") ON DELETE CASCADE;


--
-- Name: usuarios usuarios_idTrimestre_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT "usuarios_idTrimestre_fkey" FOREIGN KEY ("idTrimestre") REFERENCES public.trimestres("idTrimestre");


--
-- Name: usuarios usuarios_idUsuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT "usuarios_idUsuario_fkey" FOREIGN KEY ("idUsuario") REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: actividades_aprendizaje; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.actividades_aprendizaje ENABLE ROW LEVEL SECURITY;

--
-- Name: alembic_version; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alembic_version ENABLE ROW LEVEL SECURITY;

--
-- Name: ambientes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ambientes ENABLE ROW LEVEL SECURITY;

--
-- Name: anotaciones_horario; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.anotaciones_horario ENABLE ROW LEVEL SECURITY;

--
-- Name: asistencias; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.asistencias ENABLE ROW LEVEL SECURITY;

--
-- Name: auditoria; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

--
-- Name: avisos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.avisos ENABLE ROW LEVEL SECURITY;

--
-- Name: competencias_formacion; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.competencias_formacion ENABLE ROW LEVEL SECURITY;

--
-- Name: conversaciones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversaciones ENABLE ROW LEVEL SECURITY;

--
-- Name: coordinaciones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coordinaciones ENABLE ROW LEVEL SECURITY;

--
-- Name: diasDeLaSemana; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."diasDeLaSemana" ENABLE ROW LEVEL SECURITY;

--
-- Name: especialidad_competencia; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.especialidad_competencia ENABLE ROW LEVEL SECURITY;

--
-- Name: especialidades; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.especialidades ENABLE ROW LEVEL SECURITY;

--
-- Name: ficha_usuario; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ficha_usuario ENABLE ROW LEVEL SECURITY;

--
-- Name: fichas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fichas ENABLE ROW LEVEL SECURITY;

--
-- Name: guias; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.guias ENABLE ROW LEVEL SECURITY;

--
-- Name: horario_dia; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.horario_dia ENABLE ROW LEVEL SECURITY;

--
-- Name: horarios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.horarios ENABLE ROW LEVEL SECURITY;

--
-- Name: horarios_guardados; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.horarios_guardados ENABLE ROW LEVEL SECURITY;

--
-- Name: jornadas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.jornadas ENABLE ROW LEVEL SECURITY;

--
-- Name: mensajes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mensajes ENABLE ROW LEVEL SECURITY;

--
-- Name: notificaciones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

--
-- Name: programas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.programas ENABLE ROW LEVEL SECURITY;

--
-- Name: publicacion_programada_horarios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.publicacion_programada_horarios ENABLE ROW LEVEL SECURITY;

--
-- Name: publicaciones_programadas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.publicaciones_programadas ENABLE ROW LEVEL SECURITY;

--
-- Name: resultados_aprendizaje; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.resultados_aprendizaje ENABLE ROW LEVEL SECURITY;

--
-- Name: roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

--
-- Name: sedes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sedes ENABLE ROW LEVEL SECURITY;

--
-- Name: solicitud_cambio_horario; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.solicitud_cambio_horario ENABLE ROW LEVEL SECURITY;

--
-- Name: solicitudes_acceso; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.solicitudes_acceso ENABLE ROW LEVEL SECURITY;

--
-- Name: trimestres; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trimestres ENABLE ROW LEVEL SECURITY;

--
-- Name: usuario_especialidad; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.usuario_especialidad ENABLE ROW LEVEL SECURITY;

--
-- Name: usuario_rol; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.usuario_rol ENABLE ROW LEVEL SECURITY;

--
-- Name: usuarios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

--
-- Name: worker_publicacion_estado; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.worker_publicacion_estado ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--
