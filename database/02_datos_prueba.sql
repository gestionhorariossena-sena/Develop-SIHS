-- Datos de prueba — Base de datos sistema_sihs (PostgreSQL / Supabase)
--
-- Ejecutar después de 01_creacion.sql, contra el proyecto de Supabase del
-- equipo (SQL Editor, o psql con el connection string del proyecto):
--   psql "<connection string de Supabase>" -f 02_datos_prueba.sql
--
-- AUTENTICACIÓN: este proyecto usa Supabase Auth, no una contraseña propia
-- en "usuarios" (ver AUDITORIA_TECNICA.md sección 6). Por eso los 4 usuarios
-- de prueba de más abajo NO se insertan con un INSERT normal a "usuarios":
-- primero se crean en auth.users (la tabla de Supabase Auth) y recién ahí se
-- crea su fila de perfil en "usuarios" con el mismo UUID — es exactamente lo
-- que hace un signup real, solo que aquí lo hacemos por SQL directo para no
-- depender de tener el backend corriendo. La contraseña de los 4 (real, no
-- un hash de mentira) es "Prueba123!" — sirve para iniciar sesión de verdad
-- contra Supabase Auth y probar el backend con un token válido.

-- =========================
-- ROLES
-- =========================
-- ON CONFLICT DO NOTHING: por si ya se sembraron los roles antes (p. ej. a
-- mano, al configurar el primer Administrador) — así este script se puede
-- volver a correr sin que falle en el primer INSERT.
INSERT INTO roles ("nombre") VALUES
('Administrador'),
('Coordinador'),
('Instructor'),
('Aprendiz')
ON CONFLICT ("nombre") DO NOTHING;

-- =========================
-- ESTRUCTURA ACADÉMICA BASE
-- =========================
INSERT INTO coordinaciones ("nombreCoordinacion") VALUES
('Teleinformática'),
('Logística'),
('Artes');

INSERT INTO programas ("codigoPrograma", "nombrePrograma", "nivelFormacion", "idCoordinacion")
SELECT '228106', 'Análisis y Desarrollo de Software', 'Tecnólogo', "idCoordinacion"
FROM coordinaciones WHERE "nombreCoordinacion" = 'Teleinformática';

INSERT INTO programas ("codigoPrograma", "nombrePrograma", "nivelFormacion", "idCoordinacion")
SELECT '221101', 'Mantenimiento Industrial', 'Técnico', "idCoordinacion"
FROM coordinaciones WHERE "nombreCoordinacion" = 'Logística';

INSERT INTO trimestres ("nombre", "fechaInicio", "fechaFin", "estado") VALUES
('Trimestre 1 - 2026', '2026-01-01', '2026-03-31', 'activo'),
('Trimestre 2 - 2026', '2026-04-01', '2026-06-30', 'planeado');

INSERT INTO fichas ("codigoFicha", "idPrograma", "idTrimestre")
SELECT '2874521', p."idPrograma", t."idTrimestre"
FROM programas p, trimestres t
WHERE p."codigoPrograma" = '228106' AND t."nombre" = 'Trimestre 1 - 2026';

INSERT INTO fichas ("codigoFicha", "idPrograma", "idTrimestre")
SELECT '2874522', p."idPrograma", t."idTrimestre"
FROM programas p, trimestres t
WHERE p."codigoPrograma" = '221101' AND t."nombre" = 'Trimestre 1 - 2026';

-- =========================
-- SEDES, AMBIENTES, JORNADAS, DÍAS
-- =========================
INSERT INTO sedes ("nombreSede", "direccion", "tipoSede") VALUES
('Sede Principal', 'Calle 10 # 5-51', 'principal'),
('Sede Norte', 'Carrera 20 # 30-10', 'secundaria');

INSERT INTO ambientes ("nombreAmbiente", "idSede")
SELECT 'Lab Sistemas 1', "idSede" FROM sedes WHERE "nombreSede" = 'Sede Principal';

INSERT INTO ambientes ("nombreAmbiente", "idSede")
SELECT 'Taller Industrial', "idSede" FROM sedes WHERE "nombreSede" = 'Sede Norte';

-- SCRUM-82: idSede/fechas de las fichas de prueba (columnas agregadas en
-- SCRUM-77/78/79 — UPDATE porque las fichas ya se insertaron arriba, antes
-- de que existieran las sedes).
UPDATE fichas SET
    "idSede" = (SELECT "idSede" FROM sedes WHERE "nombreSede" = 'Sede Principal'),
    "fechaInicioLectiva" = '2026-01-15',
    "fechaFinLectiva" = '2026-03-20',
    "fechaInicioProductiva" = '2026-03-21',
    "fechaFinProductiva" = '2026-06-30'
WHERE "codigoFicha" = '2874521';

UPDATE fichas SET
    "idSede" = (SELECT "idSede" FROM sedes WHERE "nombreSede" = 'Sede Norte'),
    "fechaInicioLectiva" = '2026-01-15',
    "fechaFinLectiva" = '2026-03-20',
    "fechaInicioProductiva" = '2026-03-21',
    "fechaFinProductiva" = '2026-06-30'
WHERE "codigoFicha" = '2874522';

INSERT INTO jornadas ("nombreJornada") VALUES
('Mañana'), ('Tarde'), ('Noche');

INSERT INTO "diasDeLaSemana" ("nombreDia") VALUES
('Lunes'), ('Martes'), ('Miércoles'), ('Jueves'), ('Viernes'), ('Sábado');

-- =========================
-- ESPECIALIDADES
-- =========================
INSERT INTO especialidades ("nombre", "descripcion") VALUES
('Programación', 'Desarrollo de software y bases de datos'),
('Mecánica Industrial', 'Mantenimiento de maquinaria y equipos');

-- =========================
-- USUARIOS (vía Supabase Auth)
-- =========================
-- Paso 1: crear los usuarios en auth.users (Supabase Auth). pgcrypto es la
-- extensión que da crypt()/gen_salt() para generar un hash de contraseña
-- real, igual que lo haría Supabase al hacer signup. Ya viene disponible en
-- todo proyecto Supabase, esto solo la activa si hiciera falta.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- (sin ON CONFLICT: auth.users no tiene un unique constraint simple sobre
-- email que se pueda usar ahí — el WHERE NOT EXISTS de abajo cumple la
-- misma función de "no duplicar si ya corrí esto antes")
INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    raw_app_meta_data, raw_user_meta_data, is_super_admin
)
SELECT '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', datos.email, crypt('Prueba123!', gen_salt('bf')), now(), now(), now(), '', '', '', '', '{"provider":"email","providers":["email"]}', '{}', false
FROM (VALUES
    ('juan@mail.com'),
    ('maria@mail.com'),
    ('carlos@mail.com'),
    ('ana@mail.com'),
    ('admin@mail.com')
) AS datos(email)
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.email = datos.email);

-- Paso 2: auth.identities — sin esto Supabase Auth no deja iniciar sesión
-- con estos usuarios (busca ahí el proveedor "email" antes de validar).
INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now(), now()
FROM auth.users u
WHERE u.email IN ('juan@mail.com', 'maria@mail.com', 'carlos@mail.com', 'ana@mail.com', 'admin@mail.com')
  AND NOT EXISTS (
      SELECT 1 FROM auth.identities i WHERE i.user_id = u.id AND i.provider = 'email'
  );

-- Paso 3: la fila de perfil en "usuarios" — mismo UUID que en auth.users.
INSERT INTO usuarios ("idUsuario", "nombre", "email")
SELECT id, 'Juan Perez', email FROM auth.users WHERE email = 'juan@mail.com'
UNION ALL
SELECT id, 'Maria Gomez', email FROM auth.users WHERE email = 'maria@mail.com'
UNION ALL
SELECT id, 'Carlos Lopez', email FROM auth.users WHERE email = 'carlos@mail.com'
UNION ALL
SELECT id, 'Ana Martinez', email FROM auth.users WHERE email = 'ana@mail.com'
UNION ALL
SELECT id, 'Admin de Pruebas', email FROM auth.users WHERE email = 'admin@mail.com'
ON CONFLICT ("idUsuario") DO NOTHING;

-- Roles: Juan y Maria -> Aprendiz, Carlos -> Instructor, Ana -> Coordinador,
-- admin@mail.com -> Administrador (para poder probar /roles y /usuario-rol
-- sin tener que hacer el bootstrap manual descrito en PENDIENTE_MVP.md)
INSERT INTO usuario_rol ("idUsuario", "idRol")
SELECT u."idUsuario", r."idRol" FROM usuarios u, roles r
WHERE u."email" = 'admin@mail.com' AND r."nombre" = 'Administrador';

INSERT INTO usuario_rol ("idUsuario", "idRol")
SELECT u."idUsuario", r."idRol" FROM usuarios u, roles r
WHERE u."email" = 'juan@mail.com' AND r."nombre" = 'Aprendiz';

INSERT INTO usuario_rol ("idUsuario", "idRol")
SELECT u."idUsuario", r."idRol" FROM usuarios u, roles r
WHERE u."email" = 'maria@mail.com' AND r."nombre" = 'Aprendiz';

INSERT INTO usuario_rol ("idUsuario", "idRol")
SELECT u."idUsuario", r."idRol" FROM usuarios u, roles r
WHERE u."email" = 'carlos@mail.com' AND r."nombre" = 'Instructor';

INSERT INTO usuario_rol ("idUsuario", "idRol")
SELECT u."idUsuario", r."idRol" FROM usuarios u, roles r
WHERE u."email" = 'ana@mail.com' AND r."nombre" = 'Coordinador';

-- Especialidad de Carlos (instructor)
INSERT INTO usuario_especialidad ("idUsuario", "idEspecialidad")
SELECT u."idUsuario", e."idEspecialidad" FROM usuarios u, especialidades e
WHERE u."email" = 'carlos@mail.com' AND e."nombre" = 'Programación';

-- SCRUM-82: sigla del instructor de prueba (columna agregada en SCRUM-80)
UPDATE usuarios SET "sigla" = 'CL' WHERE "email" = 'carlos@mail.com';

-- Juan y Maria matriculados en la ficha de ADSO
INSERT INTO ficha_usuario ("idFicha", "idUsuario")
SELECT f."idFicha", u."idUsuario" FROM fichas f, usuarios u
WHERE f."codigoFicha" = '2874521' AND u."email" = 'juan@mail.com';

INSERT INTO ficha_usuario ("idFicha", "idUsuario")
SELECT f."idFicha", u."idUsuario" FROM fichas f, usuarios u
WHERE f."codigoFicha" = '2874521' AND u."email" = 'maria@mail.com';

-- =========================
-- COMPETENCIAS / RESULTADOS / ACTIVIDADES
-- =========================
INSERT INTO competencias_formacion ("codigo", "descripcion", "idPrograma")
SELECT '220501093', 'Desarrollar componentes de software', "idPrograma"
FROM programas WHERE "codigoPrograma" = '228106';

INSERT INTO resultados_aprendizaje ("codigo", "descripcion", "idCompetencia")
SELECT '24020101', 'Diseñar el modelo de datos del proyecto', "idCompetencia"
FROM competencias_formacion WHERE "codigo" = '220501093';

INSERT INTO actividades_aprendizaje ("codigo", "descripcion", "tipoActividad", "duracionMinutos", "idResultado")
SELECT 'ACT001', 'Modelar entidad-relación y crear el script SQL', 'Práctica', 240, "idResultado"
FROM resultados_aprendizaje WHERE "codigo" = '24020101';

-- =========================
-- HORARIO (con las FK completas: instructor, ambiente, ficha, resultado)
-- =========================
INSERT INTO horarios ("horaInicio", "horaFin", "idJornada", "idTrimestre", "idAmbiente", "idInstructor", "idFicha", "idResultado")
SELECT
    '07:00', '09:00',
    j."idJornada",
    t."idTrimestre",
    a."idAmbiente",
    i."idUsuario",
    f."idFicha",
    r."idResultado"
FROM jornadas j, trimestres t, ambientes a, usuarios i, fichas f, resultados_aprendizaje r
WHERE j."nombreJornada" = 'Mañana'
  AND t."nombre" = 'Trimestre 1 - 2026'
  AND a."nombreAmbiente" = 'Lab Sistemas 1'
  AND i."email" = 'carlos@mail.com'
  AND f."codigoFicha" = '2874521'
  AND r."codigo" = '24020101';

INSERT INTO horario_dia ("idHorario", "idDia")
SELECT h."idHorario", d."idDia"
FROM horarios h, "diasDeLaSemana" d
WHERE d."nombreDia" IN ('Lunes', 'Miércoles');

-- =========================
-- Cómo verificar que NO hay un cruce antes de insertar un horario nuevo
-- (esto es lo que el backend debe hacer en horarios/service.py):
-- =========================
-- SELECT * FROM horarios
-- WHERE ("idInstructor" = :idInstructor OR "idAmbiente" = :idAmbiente)
--   AND "horaInicio" < :horaFinNueva
--   AND "horaFin"    > :horaInicioNueva
--   AND "idHorario" IN (
--       SELECT "idHorario" FROM horario_dia
--       WHERE "idDia" = ANY(:diasNuevos)
--   );

-- =========================================================
-- AMPLIACIÓN 2026-08-26 — dataset sintético pequeño para poder probar el
-- módulo `horarios` real (con detección de cruces) de punta a punta
-- mientras no hay catálogos reales de la coordinación. Ver
-- _Docs/Documentación general/PLAN_INTEGRACION_LOGICA_Y_BD.md.
-- Todo lo de acá es INVENTADO — reemplazar cuando lleguen los datos reales.
-- =========================================================

-- Más ambientes (además de "Lab Sistemas 1" y "Taller Industrial")
INSERT INTO ambientes ("nombreAmbiente", "idSede")
SELECT 'Lab Sistemas 2', "idSede" FROM sedes WHERE "nombreSede" = 'Sede Principal';

INSERT INTO ambientes ("nombreAmbiente", "idSede")
SELECT 'Sala Multimedia', "idSede" FROM sedes WHERE "nombreSede" = 'Sede Principal';

INSERT INTO ambientes ("nombreAmbiente", "idSede")
SELECT 'Taller Logística', "idSede" FROM sedes WHERE "nombreSede" = 'Sede Norte';

INSERT INTO ambientes ("nombreAmbiente", "idSede")
SELECT 'Aula 307', "idSede" FROM sedes WHERE "nombreSede" = 'Sede Norte';

-- Más fichas (además de '2874521' ADSO y '2874522' Mantenimiento Industrial)
INSERT INTO fichas ("codigoFicha", "idPrograma", "idTrimestre")
SELECT '2874523', p."idPrograma", t."idTrimestre"
FROM programas p, trimestres t
WHERE p."codigoPrograma" = '228106' AND t."nombre" = 'Trimestre 2 - 2026';

INSERT INTO fichas ("codigoFicha", "idPrograma", "idTrimestre")
SELECT '2874524', p."idPrograma", t."idTrimestre"
FROM programas p, trimestres t
WHERE p."codigoPrograma" = '221101' AND t."nombre" = 'Trimestre 2 - 2026';

-- Más especialidades
INSERT INTO especialidades ("nombre", "descripcion") VALUES
('Bases de Datos', 'Modelado y administración de bases de datos'),
('Logística General', 'Cadena de suministros, almacenamiento e inventarios'),
('Comercio Exterior', 'Importación, exportación, aranceles y documentación — especializada, ver REGLAS_DE_NEGOCIO_CONOCIDAS.md')
ON CONFLICT ("nombre") DO NOTHING;

-- Más instructores (además de carlos@mail.com), mismo mecanismo vía
-- Supabase Auth que el bloque de arriba.
INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    raw_app_meta_data, raw_user_meta_data, is_super_admin
)
SELECT '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', datos.email, crypt('Prueba123!', gen_salt('bf')), now(), now(), now(), '', '', '', '', '{"provider":"email","providers":["email"]}', '{}', false
FROM (VALUES
    ('sergio@mail.com'),
    ('fredy@mail.com'),
    ('david@mail.com')
) AS datos(email)
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.email = datos.email);

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now(), now()
FROM auth.users u
WHERE u.email IN ('sergio@mail.com', 'fredy@mail.com', 'david@mail.com')
  AND NOT EXISTS (
      SELECT 1 FROM auth.identities i WHERE i.user_id = u.id AND i.provider = 'email'
  );

INSERT INTO usuarios ("idUsuario", "nombre", "email")
SELECT id, 'Sergio Garzón', email FROM auth.users WHERE email = 'sergio@mail.com'
UNION ALL
SELECT id, 'Fredy Ardila', email FROM auth.users WHERE email = 'fredy@mail.com'
UNION ALL
SELECT id, 'David Camelo', email FROM auth.users WHERE email = 'david@mail.com'
ON CONFLICT ("idUsuario") DO NOTHING;

INSERT INTO usuario_rol ("idUsuario", "idRol")
SELECT u."idUsuario", r."idRol" FROM usuarios u, roles r
WHERE u."email" IN ('sergio@mail.com', 'fredy@mail.com', 'david@mail.com') AND r."nombre" = 'Instructor'
ON CONFLICT DO NOTHING;

INSERT INTO usuario_especialidad ("idUsuario", "idEspecialidad")
SELECT u."idUsuario", e."idEspecialidad" FROM usuarios u, especialidades e
WHERE u."email" = 'sergio@mail.com' AND e."nombre" = 'Programación'
ON CONFLICT DO NOTHING;

INSERT INTO usuario_especialidad ("idUsuario", "idEspecialidad")
SELECT u."idUsuario", e."idEspecialidad" FROM usuarios u, especialidades e
WHERE u."email" = 'fredy@mail.com' AND e."nombre" = 'Bases de Datos'
ON CONFLICT DO NOTHING;

INSERT INTO usuario_especialidad ("idUsuario", "idEspecialidad")
SELECT u."idUsuario", e."idEspecialidad" FROM usuarios u, especialidades e
WHERE u."email" = 'david@mail.com' AND e."nombre" = 'Logística General'
ON CONFLICT DO NOTHING;

-- tipoContrato / horasContratadasSemana — ver REGLAS_DE_NEGOCIO_CONOCIDAS.md
-- ("planta se programa primero, debe llegar a 32h/semana").
UPDATE usuarios SET "tipoContrato" = 'contratista' WHERE "email" = 'carlos@mail.com';
UPDATE usuarios SET "tipoContrato" = 'planta', "horasContratadasSemana" = 32 WHERE "email" = 'sergio@mail.com';
UPDATE usuarios SET "tipoContrato" = 'contratista' WHERE "email" = 'fredy@mail.com';
UPDATE usuarios SET "tipoContrato" = 'planta', "horasContratadasSemana" = 32 WHERE "email" = 'david@mail.com';

-- Guías (capa nueva que reveló la entrevista de Logística — ver
-- PLAN_INTEGRACION_LOGICA_Y_BD.md §2.1)
INSERT INTO guias ("codigo", "idPrograma", "idTrimestre")
SELECT 'Guía 1', p."idPrograma", t."idTrimestre"
FROM programas p, trimestres t
WHERE p."codigoPrograma" = '228106' AND t."nombre" = 'Trimestre 1 - 2026';

INSERT INTO guias ("codigo", "idPrograma", "idTrimestre")
SELECT 'Guía 2', p."idPrograma", t."idTrimestre"
FROM programas p, trimestres t
WHERE p."codigoPrograma" = '228106' AND t."nombre" = 'Trimestre 2 - 2026';

INSERT INTO guias ("codigo", "idPrograma", "idTrimestre")
SELECT 'Guía 1', p."idPrograma", t."idTrimestre"
FROM programas p, trimestres t
WHERE p."codigoPrograma" = '221101' AND t."nombre" = 'Trimestre 1 - 2026';

-- Más competencias / resultados (además de '220501093'/'24020101')
INSERT INTO competencias_formacion ("codigo", "descripcion", "idPrograma")
SELECT '220501094', 'Construir la base de datos del proyecto', "idPrograma"
FROM programas WHERE "codigoPrograma" = '228106';

INSERT INTO competencias_formacion ("codigo", "descripcion", "idPrograma")
SELECT 'CPL01', 'Identificar los elementos de la cadena de suministros', "idPrograma"
FROM programas WHERE "codigoPrograma" = '221101';

INSERT INTO resultados_aprendizaje ("codigo", "descripcion", "idCompetencia", "idGuia", "horasAsignadas")
SELECT '24020102', 'Construir la base de datos a partir del modelo de datos', c."idCompetencia", g."idGuia", 40
FROM competencias_formacion c, guias g
WHERE c."codigo" = '220501094' AND g."codigo" = 'Guía 2' AND g."idPrograma" = c."idPrograma";

INSERT INTO resultados_aprendizaje ("codigo", "descripcion", "idCompetencia", "idGuia", "horasAsignadas")
SELECT 'CPL21', 'Identificar los elementos de la cadena de suministros', c."idCompetencia", g."idGuia", 40
FROM competencias_formacion c, guias g
WHERE c."codigo" = 'CPL01' AND g."codigo" = 'Guía 1' AND g."idPrograma" = c."idPrograma";

-- Más horarios válidos (ninguno se cruza entre sí ni con el que ya existía
-- de Carlos/Lunes-Miércoles/Lab Sistemas 1/ficha 2874521)
INSERT INTO horarios ("horaInicio", "horaFin", "idJornada", "idTrimestre", "idAmbiente", "idInstructor", "idFicha", "idResultado")
SELECT '09:00', '11:00', j."idJornada", t."idTrimestre", a."idAmbiente", i."idUsuario", f."idFicha", r."idResultado"
FROM jornadas j, trimestres t, ambientes a, usuarios i, fichas f, resultados_aprendizaje r
WHERE j."nombreJornada" = 'Mañana'
  AND t."nombre" = 'Trimestre 1 - 2026'
  AND a."nombreAmbiente" = 'Lab Sistemas 2'
  AND i."email" = 'fredy@mail.com'
  AND f."codigoFicha" = '2874521'
  AND r."codigo" = '24020102';

INSERT INTO horario_dia ("idHorario", "idDia")
SELECT h."idHorario", d."idDia"
FROM horarios h
JOIN ambientes a ON a."idAmbiente" = h."idAmbiente" AND a."nombreAmbiente" = 'Lab Sistemas 2',
     "diasDeLaSemana" d
WHERE d."nombreDia" IN ('Martes', 'Jueves')
  AND h."idHorario" = (SELECT "idHorario" FROM horarios ORDER BY "idHorario" DESC LIMIT 1);

INSERT INTO horarios ("horaInicio", "horaFin", "idJornada", "idTrimestre", "idAmbiente", "idInstructor", "idFicha", "idResultado")
SELECT '13:00', '15:00', j."idJornada", t."idTrimestre", a."idAmbiente", i."idUsuario", f."idFicha", r."idResultado"
FROM jornadas j, trimestres t, ambientes a, usuarios i, fichas f, resultados_aprendizaje r
WHERE j."nombreJornada" = 'Tarde'
  AND t."nombre" = 'Trimestre 1 - 2026'
  AND a."nombreAmbiente" = 'Taller Logística'
  AND i."email" = 'david@mail.com'
  AND f."codigoFicha" = '2874522'
  AND r."codigo" = 'CPL21';

INSERT INTO horario_dia ("idHorario", "idDia")
SELECT h."idHorario", d."idDia"
FROM horarios h,
     "diasDeLaSemana" d
WHERE d."nombreDia" IN ('Lunes', 'Miércoles', 'Viernes')
  AND h."idHorario" = (SELECT "idHorario" FROM horarios ORDER BY "idHorario" DESC LIMIT 1);

-- Con esto queda armado un caso real de prueba para el cruce: intentar
-- crear (vía POST /api/v1/horarios) un horario para carlos@mail.com el
-- Lunes de 08:00 a 10:00 en cualquier ambiente debe rechazarse con 409 —
-- se solapa con su clase existente de Lunes/Miércoles 07:00-09:00.
