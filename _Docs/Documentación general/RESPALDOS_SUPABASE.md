# Respaldos automáticos de Supabase (RNF-17)

**Estado: sin confirmar — necesita que alguien con acceso al dashboard de
Supabase del proyecto lo revise.** No es tarea de código, así que no hay
nada que yo (Claude) pueda activar desde el repo — esto se hace desde
`supabase.com/dashboard`, con la cuenta que administra el proyecto.

## El requisito

> **RNF-17. Respaldo de información.** La base de datos debe realizar
> copias de seguridad automáticas diarias.
>
> — `_Docs/Informes de requisitos/Requisitos No Funcionales V1.pdf`

## Lo que dice la documentación oficial de Supabase (verificado 2026-08-31)

Los respaldos automáticos dependen del **plan de facturación** del
proyecto, no es algo que se prenda/apague con un switch suelto:

| Plan | Respaldo diario automático | Retención |
|---|---|---|
| **Free** | ❌ **No incluye** — Supabase recomienda exportar a mano con `supabase db dump` y guardar la copia en otro lado | — |
| **Pro** | ✅ Sí, activado por defecto, sin configurar nada | Últimos 7 días |
| **Team** | ✅ Sí, por defecto | Últimos 14 días |
| **Enterprise** | ✅ Sí, por defecto | Hasta 30 días |

Fuente: [supabase.com/docs/guides/platform/backups](https://supabase.com/docs/guides/platform/backups).

**Punto-en-el-tiempo (PITR)** es un add-on aparte (pago extra, requiere
mínimo un compute add-on "Small") que da una granularidad de recuperación
de ~2 minutos en vez de 1 vez al día. Ojo: **si activan PITR, Supabase dice
que deja de tomar los Daily Backups** (uno reemplaza al otro, no se suman)
— para cumplir RNF-17 basta con Daily Backups normales, PITR es opcional y
más caro.

## Qué hay que revisar (checklist para quien tenga acceso al dashboard)

El proyecto de SIHS es `mbngmentykfmjwmkqhhk.supabase.co` (ver
`backend/.env` → `SUPABASE_URL`, no lo pongo completo acá por si este
archivo se comparte fuera del equipo).

1. Entrar a [supabase.com/dashboard](https://supabase.com/dashboard) →
   seleccionar el proyecto SIHS.
2. **Project Settings → Billing** (o el ícono de la organización): confirmar
   en qué plan está — Free, Pro, Team o Enterprise.
3. **Project Settings → Database → Backups** (o "Add-ons" según la versión
   del dashboard): confirmar si aparecen backups diarios listados y desde
   cuándo.
4. Según lo que se encuentre:
   - **Si está en Pro o superior:** los backups diarios ya deberían estar
     activos por defecto — solo hay que confirmarlo con una captura o
     anotando la fecha del backup más reciente, y marcar RNF-17 como
     cumplido acá abajo.
   - **Si está en Free:** RNF-17 **no se cumple hoy**. Opciones:
     a. Subir el proyecto a plan Pro (US$25/mes) para tener backups diarios
        automáticos — la opción que pide el requisito tal cual.
     b. Si el presupuesto no lo permite todavía, armar un respaldo manual
        programado como mitigación temporal (ej. un cron/GitHub Action que
        corra `supabase db dump` diario y suba el archivo a otro storage) —
        **esto no es lo que pide RNF-17 literalmente** (dice "automáticas
        diarias" en la base de datos, no un script aparte), pero es mejor
        que nada mientras se decide si se paga el plan Pro.

## Decisión pendiente

- [ ] Confirmar plan actual del proyecto Supabase
- [ ] Confirmar si los backups diarios están activos (si ya está en Pro+)
- [ ] Si está en Free: decidir con el equipo/coordinador si se sube a Pro,
      o si se arma el respaldo manual como mitigación temporal
- [ ] Actualizar este documento con el resultado y la fecha
