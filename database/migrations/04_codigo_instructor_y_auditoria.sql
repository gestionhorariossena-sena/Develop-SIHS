-- Aplica dos cambios de esquema que llegaron por PR (SCRUM-14/19 y
-- SCRUM-15/20) pero nunca se corrieron contra el proyecto compartido de
-- Supabase — el código en `develop` ya los asume, causando 500 en
-- cualquier endpoint que toque "usuarios" o "auditoria" (visto en local
-- como error de CORS en el navegador, que es solo el síntoma: la
-- respuesta 500 no lleva headers CORS).

ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS "codigoInstructor" VARCHAR(20) UNIQUE;

CREATE TABLE IF NOT EXISTS auditoria (
    "idAuditoria"   SERIAL PRIMARY KEY,
    "idUsuario"     UUID REFERENCES usuarios("idUsuario") ON DELETE SET NULL,
    "identificador" VARCHAR(150),
    "accion"        VARCHAR(50) NOT NULL,
    "entidad"       VARCHAR(50) NOT NULL,
    "idEntidad"     VARCHAR(50),
    "detalle"       TEXT,
    "fecha"         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idxAuditoriaUsuario" ON auditoria ("idUsuario");
CREATE INDEX IF NOT EXISTS "idxAuditoriaIdentificadorAccion" ON auditoria ("identificador", "accion", "fecha");
