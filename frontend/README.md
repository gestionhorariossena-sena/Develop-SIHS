# Frontend SIHS

Cliente web construido con React + Vite + TypeScript + Tailwind.

## Ejecutar

```bash
cd frontend
pnpm install
cp .env.example .env
pnpm dev
```

Corre en `http://localhost:5173` (o el siguiente puerto libre si ese está
ocupado). Necesita el backend corriendo en paralelo para que el Dashboard
cargue datos reales — ver [`../backend/README.md`](../backend/README.md).

Las variables de `.env` (Supabase + URL del backend) se explican en
[`../database/README.md`](../database/README.md).

## Para seguir programando

- [`ESTRUCTURA.md`](./ESTRUCTURA.md) — qué es cada carpeta/archivo, y cómo
  una pantalla consume el backend (con ejemplo copiable).
- [`OBJETIVO_Y_SERVICIOS_FALTANTES.md`](./OBJETIVO_Y_SERVICIOS_FALTANTES.md) —
  qué pantallas faltan y de qué módulo del backend dependen.
