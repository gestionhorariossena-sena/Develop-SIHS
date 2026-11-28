#!/usr/bin/env bash
set -euo pipefail

if docker info >/dev/null 2>&1; then
  exit 0
fi

# Solo administramos el daemon local. Un contexto remoto o Docker Desktop
# requiere que se inicie su propio servicio.
docker_host="${DOCKER_HOST:-$(docker context inspect --format '{{.Endpoints.docker.Host}}' 2>/dev/null || true)}"
if [[ "$(uname -s)" != Linux || ( "$docker_host" != unix:///var/run/docker.sock && "$docker_host" != unix:///run/docker.sock ) ]] \
    || ! command -v systemctl >/dev/null 2>&1 \
    || ! systemctl cat docker.service >/dev/null 2>&1; then
  echo "No se pudo conectar a Docker (${docker_host:-contexto desconocido}). Inicia el daemon de ese contexto y vuelve a ejecutar make." >&2
  exit 1
fi

if [[ ! -d "/usr/lib/modules/$(uname -r)" ]]; then
  echo "Faltan los módulos del kernel activo $(uname -r). Reinicia el equipo y vuelve a ejecutar make." >&2
  exit 1
fi

echo 'Docker está apagado. Habilitando e iniciando el servicio…' >&2
if sudo -n true 2>/dev/null; then
  sudo -n systemctl enable --now docker.service
elif command -v pkexec >/dev/null 2>&1 && [[ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]]; then
  pkexec systemctl enable --now docker.service
else
  echo 'Se necesita autorización de administrador. Ejecuta: sudo systemctl enable --now docker.service' >&2
  exit 1
fi

# systemd puede informar que el servicio arrancó antes de que el API responda.
for ((attempt = 0; attempt < 30; attempt++)); do
  if docker info >/dev/null 2>&1; then
    exit 0
  fi
  sleep 1
done

echo 'Docker arrancó, pero su API sigue sin responder. Revisa: systemctl status docker.service' >&2
exit 1
