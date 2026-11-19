-- Datos exclusivamente ficticios para el entorno local de SIHS.
-- Nunca copiar aquí registros, correos, UUIDs ni hashes de Supabase remoto.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO public.roles ("nombre") VALUES
  ('Administrador'),
  ('Coordinador'),
  ('Instructor'),
  ('Aprendiz');

INSERT INTO public.coordinaciones ("nombreCoordinacion") VALUES
  ('Tecnología y Desarrollo de Software');

INSERT INTO public.programas ("codigoPrograma", "nombrePrograma", "nivelFormacion", "idCoordinacion")
SELECT 'DEMO-ADSO', 'Análisis y Desarrollo de Software', 'Tecnólogo', "idCoordinacion"
FROM public.coordinaciones
WHERE "nombreCoordinacion" = 'Tecnología y Desarrollo de Software';

INSERT INTO public.trimestres ("nombre", "fechaInicio", "fechaFin", "estado") VALUES
  ('Demo vigente', current_date - 30, current_date + 120, 'activo');

INSERT INTO public.sedes ("nombreSede", "direccion", "tipoSede") VALUES
  ('Sede Demo SIHS', 'Calle 100 # 10-20', 'principal');

INSERT INTO public.ambientes (
  "nombreAmbiente", "idSede", "numeroAmbiente", "tipoAmbiente", "estadoAmbiente", capacidad
)
SELECT 'Ambiente', "idSede", 101, 'regular', 'disponible', 30
FROM public.sedes WHERE "nombreSede" = 'Sede Demo SIHS';

INSERT INTO public.ambientes (
  "nombreAmbiente", "idSede", "numeroAmbiente", "tipoAmbiente", "estadoAmbiente", capacidad, "especialidadSala"
)
SELECT 'Laboratorio de Software', "idSede", 201, 'especial', 'disponible', 28, 'Programación'
FROM public.sedes WHERE "nombreSede" = 'Sede Demo SIHS';

INSERT INTO public.jornadas ("nombreJornada") VALUES ('Mañana'), ('Tarde');
INSERT INTO public."diasDeLaSemana" ("nombreDia") VALUES
  ('Lunes'), ('Martes'), ('Miércoles'), ('Jueves'), ('Viernes');

INSERT INTO public.especialidades ("nombre", descripcion) VALUES
  ('Programación', 'Diseño y desarrollo de software');

-- Cuentas locales de demostración. La contraseña de todas es Demo123!.
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, is_super_admin
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated', 'authenticated', demo.email,
  extensions.crypt('Demo123!', extensions.gen_salt('bf')), now(), now(), now(),
  '', '', '', '',
  '{"provider":"email","providers":["email"]}', '{}', false
FROM (VALUES
  ('admin.demo@sihs.local'),
  ('coordinador.demo@sihs.local'),
  ('instructor.demo@sihs.local'),
  ('aprendiz.demo@sihs.local')
) AS demo(email);

INSERT INTO auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
SELECT
  gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', now(), now(), now()
FROM auth.users AS u
WHERE u.email LIKE '%.demo@sihs.local';

INSERT INTO public.usuarios ("idUsuario", nombre, email, "numeroDocumento", "tipoContrato", "horasContratadasSemana")
SELECT u.id, demo.nombre, u.email, demo.documento, demo.tipo_contrato, demo.horas
FROM (VALUES
  ('admin.demo@sihs.local', 'Admin Demo', '10000001', NULL::varchar, NULL::integer),
  ('coordinador.demo@sihs.local', 'Coordinadora Demo', '10000002', NULL::varchar, NULL::integer),
  ('instructor.demo@sihs.local', 'Instructor Demo', '10000003', 'planta'::varchar, 32),
  ('aprendiz.demo@sihs.local', 'Aprendiz Demo', '10000004', NULL::varchar, NULL::integer)
) AS demo(email, nombre, documento, tipo_contrato, horas)
JOIN auth.users u ON u.email = demo.email;

INSERT INTO public.usuario_rol ("idUsuario", "idRol")
SELECT u."idUsuario", r."idRol"
FROM public.usuarios u
JOIN public.roles r ON r.nombre = CASE u.email
  WHEN 'admin.demo@sihs.local' THEN 'Administrador'
  WHEN 'coordinador.demo@sihs.local' THEN 'Coordinador'
  WHEN 'instructor.demo@sihs.local' THEN 'Instructor'
  WHEN 'aprendiz.demo@sihs.local' THEN 'Aprendiz'
END;

INSERT INTO public.usuario_especialidad ("idUsuario", "idEspecialidad")
SELECT u."idUsuario", e."idEspecialidad"
FROM public.usuarios u
CROSS JOIN public.especialidades e
WHERE u.email = 'instructor.demo@sihs.local' AND e.nombre = 'Programación';

INSERT INTO public.fichas (
  "codigoFicha", "idPrograma", "idTrimestre", "idSede",
  "fechaInicioLectiva", "fechaFinLectiva", "faseActual"
)
SELECT 'DEMO-2874521', p."idPrograma", t."idTrimestre", s."idSede", current_date - 30, current_date + 120, 1
FROM public.programas p
CROSS JOIN public.trimestres t
CROSS JOIN public.sedes s
WHERE p."codigoPrograma" = 'DEMO-ADSO' AND t.nombre = 'Demo vigente' AND s."nombreSede" = 'Sede Demo SIHS';

INSERT INTO public.ficha_usuario ("idFicha", "idUsuario", "rolEnFicha")
SELECT f."idFicha", u."idUsuario", 'aprendiz'
FROM public.fichas f
CROSS JOIN public.usuarios u
WHERE f."codigoFicha" = 'DEMO-2874521' AND u.email = 'aprendiz.demo@sihs.local';

INSERT INTO public.guias (codigo, "idPrograma", "idTrimestre")
SELECT 'Guía de demostración', p."idPrograma", t."idTrimestre"
FROM public.programas p
CROSS JOIN public.trimestres t
WHERE p."codigoPrograma" = 'DEMO-ADSO' AND t.nombre = 'Demo vigente';

INSERT INTO public.competencias_formacion (codigo, descripcion, "idPrograma")
SELECT 'DEMO-COMP-01', 'Construir componentes de software', "idPrograma"
FROM public.programas WHERE "codigoPrograma" = 'DEMO-ADSO';

INSERT INTO public.resultados_aprendizaje (codigo, descripcion, "idCompetencia", "idGuia", "horasAsignadas", "numeroFase")
SELECT 'DEMO-RA-01', 'Implementar una funcionalidad de SIHS', c."idCompetencia", g."idGuia", 48, 1
FROM public.competencias_formacion c
CROSS JOIN public.guias g
WHERE c.codigo = 'DEMO-COMP-01' AND g.codigo = 'Guía de demostración';

INSERT INTO public.actividades_aprendizaje (codigo, descripcion, "tipoActividad", "duracionMinutos", "idResultado")
SELECT 'DEMO-ACT-01', 'Construir y probar el flujo de horarios', 'Práctica', 180, "idResultado"
FROM public.resultados_aprendizaje WHERE codigo = 'DEMO-RA-01';

INSERT INTO public.horarios (
  "horaInicio", "horaFin", "idJornada", "idTrimestre", "idAmbiente", "idInstructor", "idFicha", "idResultado", activo, publicado
)
SELECT
  '08:00', '10:00', j."idJornada", t."idTrimestre", a."idAmbiente", u."idUsuario", f."idFicha", r."idResultado", true, true
FROM public.jornadas j
CROSS JOIN public.trimestres t
CROSS JOIN public.ambientes a
CROSS JOIN public.usuarios u
CROSS JOIN public.fichas f
CROSS JOIN public.resultados_aprendizaje r
WHERE j."nombreJornada" = 'Mañana'
  AND t.nombre = 'Demo vigente'
  AND a."numeroAmbiente" = 201
  AND u.email = 'instructor.demo@sihs.local'
  AND f."codigoFicha" = 'DEMO-2874521'
  AND r.codigo = 'DEMO-RA-01';

INSERT INTO public.horario_dia ("idHorario", "idDia")
SELECT h."idHorario", d."idDia"
FROM public.horarios h
CROSS JOIN public."diasDeLaSemana" d
WHERE d."nombreDia" IN ('Lunes', 'Miércoles') AND h.publicado;

INSERT INTO public.asistencias ("idHorario", "idUsuarioAprendiz", estado, "fechaSesion")
SELECT h."idHorario", u."idUsuario", 'presente', current_date
FROM public.horarios h
CROSS JOIN public.usuarios u
WHERE h.publicado AND u.email = 'aprendiz.demo@sihs.local';

INSERT INTO public.notificaciones ("idUsuario", tipo, mensaje, leida)
SELECT "idUsuario", 'horario', 'Tu horario de demostración fue publicado.', false
FROM public.usuarios WHERE email = 'aprendiz.demo@sihs.local';

INSERT INTO public.avisos ("idUsuarioPublicador", titulo, cuerpo, categoria, "idFicha")
SELECT u."idUsuario", 'Bienvenido al entorno demo', 'Estos datos son ficticios y se pueden reiniciar.', 'general', f."idFicha"
FROM public.usuarios u
CROSS JOIN public.fichas f
WHERE u.email = 'coordinador.demo@sihs.local' AND f."codigoFicha" = 'DEMO-2874521';

INSERT INTO public.worker_publicacion_estado (id, "ultimaSenal") VALUES (1, now());
INSERT INTO public.alembic_version (version_num) VALUES ('a1d4f6c2e8b9');
