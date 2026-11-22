.PHONY: test-up test-run test-down test-reset test-logs demo-up demo-reset demo-down demo-urls demo-info

# PostgreSQL exclusivo para pruebas de integración. No usa Supabase ni la
# configuración local del desarrollador.
TEST_COMPOSE := docker compose -f backend/tests/docker-compose.postgres.yml
TEST_DATABASE_URL := postgresql+psycopg://sihs_test:sihs_test_only@127.0.0.1:55440/sihs_test
BACKEND_PYTHON ?= $(abspath backend/.venv/bin/python)

test-up:
	$(TEST_COMPOSE) up -d --wait

test-run: test-up
	cd backend && SIHS_TEST_DATABASE_URL="$(TEST_DATABASE_URL)" $(BACKEND_PYTHON) -m pytest tests/test_real_postgres.py -v

test-down:
	$(TEST_COMPOSE) down -v --remove-orphans

test-reset:
	$(TEST_COMPOSE) down -v --remove-orphans
	$(TEST_COMPOSE) up -d --wait

test-logs:
	$(TEST_COMPOSE) logs --tail=150 postgres-test

demo-up:
	bash scripts/demo-up.sh

demo-reset:
	bash scripts/demo-reset.sh

demo-down:
	bash scripts/demo-down.sh

demo-urls:
	@printf '%s\n' \
	  'Aplicación:       http://127.0.0.1:5173' \
	  'API (salud):      http://127.0.0.1:8000/api/v1/health' \
	  'Supabase API:     http://127.0.0.1:54321' \
	  'Supabase Studio:  http://127.0.0.1:54323' \
	  'Mailpit:          http://127.0.0.1:54324'

demo-info: demo-urls
	@printf '%s\n' \
	  '' \
	  'Cuentas demo (contraseña para todas: Demo123!):' \
	  '  Administrador: admin.demo@sihs.local' \
	  '  Coordinador:   coordinador.demo@sihs.local' \
	  '  Instructor:    instructor.demo@sihs.local' \
	  '  Aprendiz:      aprendiz.demo@sihs.local'
