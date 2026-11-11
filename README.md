# 🧪 SIHS · Semana 5 — Dobles de prueba y aislamiento de dependencias

> **Rama grupal:** `semana-5` · **Equipo:** Nicol, David, Dayana y Edith · **Bootcamp:** [Reto oficial, Semana 5 — Dobles de prueba](https://github.com/ergrato-dev/bc-testing-adso/blob/main/bootcamp/week-05-dobles_de_prueba/3-reto/README.md) · **Piso:** 60 % de cobertura en ambas capas, **sin disminuir los umbrales existentes**.

> Esta rama se creó desde `semana-4` como inicio del reto S5. **No se presupone que los cuatro PR de S4 ya estén integrados.** Incorporar el cierre de S4 por PR, evitando sobrescribir los aportes concurrentes. No editar `develop` ni `main` durante las entregas individuales.

## 1. Rotación S4 → S5 y revisiones cruzadas

| Integrante | Ángulo S4 | Ángulo S5 (diferente) | Dependencia / ejercicio real de SIHS | Rama individual | Revisor de otra capa |
|---|---|---|---|---|---|
| **Nicol** | Front (contrato HTTP) | **API — SMTP/correo externo** | `backend/app/services/email_service.py`: interfaz propia `TransporteCorreo`, doble de envío, error SMTP y ausencia de configuración | `test/s5-api-correo-nicol` | Dayana (E2E) |
| **David** | E2E (seguridad) | **BD — repositorio como dependencia** | Servicio de horarios o solicitudes de acceso con fake/mock de repositorio: no guardar inválidos y guardar correctamente válidos | `test/s5-bd-repositorios-david` | Nicol (API) |
| **Dayana** | API (CRUD horarios) | **E2E — red simulada** | Pantallas React con Playwright `page.route`: API caída, lista vacía, error de validación; **≥2 E2E** | `test/s5-e2e-red-dayana` | Edith (Front) |
| **Edith** | BD (solicitudes de acceso) | **Front — cliente HTTP/MSW** | `frontend/src/services/api.ts` (o consumidor real): HTTP feliz, `500`, `422`, respuesta no JSON; integrar MSW con Vitest | `test/s5-front-msw-edith` | David (BD) |

Cada persona realiza **al menos 3 tests nuevos con dobles**, usando los recursos reales y sin duplicar casos existentes. **Nicol revisa el PR de David; Dayana revisa el PR de Nicol**, etc.

## 2. Inventario de dependencias fuera del control del proyecto

| Dependencia | Código consumidor SIHS | Cómo aislarla en S5 |
|---|---|---|
| SMTP / correo | `backend/app/services/email_service.py` | Puerto propio `TransporteCorreo`, mock/spy y adaptador SMTP productivo |
| Supabase Auth | `backend/app/core/supabase_auth.py`, React | `fake_supabase` del `conftest.py` o MSW en tests frontend |
| Supabase/PostgreSQL | Servicios y repositorios SQLAlchemy | Repositorio fake, `unittest.mock`, SQLite sólo donde interesa integración |
| API REST desde React | `frontend/src/services/api.ts` | MSW `setupServer` con respuestas HTTP sin red real |
| Red de navegador | `e2e/tests/` | `page.route` de Playwright sobre peticiones del flujo |
| Gemini / LLM | `backend/app/ai/` | Stub de respuesta determinista; nunca llamar APIs externas |
| Reloj/fechas | Reglas temporales de horario/credenciales | Reloj fijo o inyección de tiempo para evitar pruebas no deterministas |

**Regla de selección:** los dobles evitan una dependencia externa; no simular el propio código que se desea comprobar.

## 3. Reto individual: pruebas con dobles (≥3 por persona)

- **Nicol (API/correo):** aislar el proveedor SMTP detrás de una interfaz pequeña; probar que el correo contiene destinatario y contenido correctos (estado + comportamiento), que *no* envía sin SMTP configurado y que los errores del transporte no se pierden. Anotar explícitamente el tipo de doble (mock, spy, fake, stub) en cada test. Mutación: quitar la llamada al transporte o la validación SMTP; capturar rojo/verde.
- **David (BD/repositorios):** elegir un servicio con validaciones reales; fake con memoria para demostrar estado guardado; `assert_not_called` del repositorio ante entrada inválida; mutar la validación y obtener rojo/verde.
- **Dayana (E2E):** mínimo **dos** pruebas Playwright que usen `page.route`; abordar API caída y lista vacía o `422` en un flujo real; tercer test con doble de red o stub de reloj; comprobar mensajes visibles, no solo intercepciones.
- **Edith (Front/MSW):** al menos 3 tests con MSW, preferiblemente cuatro escenarios HTTP: `200`, `500`, `422` y respuesta no JSON. Probar el cliente HTTP real y su contrato; no mockearlo en los tests que buscan validarlo. Si existe exclusión de cobertura, retirarla al añadir las pruebas.

**Cada test debe documentar el tipo de doble y por qué se eligió.** Al menos un test comprueba **comportamiento** (llamada o no llamada) y otro **estado/resultado**. Registrar mutante, ejecución que falle, restauración y CI verde; **no subir un mutante activo al PR entregable**.

## 4. Ramas, PR y revisión cruzada

```bash
git fetch origin
git switch semana-5
git pull --ff-only origin semana-5
git switch -c test/s5-<capa>-<nombre>
# implementar + ejecutar pruebas, mutación roja/verde y documentación
git add backend frontend e2e docs-testing docs
git commit -m "test(s5): cubrir dependencia con dobles"
git push -u origin test/s5-<capa>-<nombre>
```

Cada PR individual usa como **base `semana-5`**; debe incluir tipos de dobles, evidencia roja/verde, hallazgos y revisión de otro integrante. **No aprobar por cuenta de otra persona.** Los commits individuales se hacen con su propia cuenta. La integración grupal hacia `develop` se hará cuando el equipo cierre el reto y la CI integrada esté verde.

## 5. Revisión de exceso de mocks (obligatoria en grupo)

Revisar **un test por integrante** y registrar en el PR: ¿se prueba un resultado observable o sólo la llamada al mock?, ¿el doble está en la frontera externa?, ¿un fake sustituye comportamiento que debería ser real? Reescribir cualquier test que únicamente afirme `mock.called` sin estado/resultado útil. Guardar conclusión en cada PR y en la matriz.

## 6. Cobertura, umbrales y CI

Una vez integrados los **4 PR personales** a `semana-5`, medir cobertura real. Abrir **quinto PR exclusivo de umbrales** desde `chore/s5-umbrales-cobertura` a `semana-5`. Cada nuevo umbral debe ser el mayor entre 60 %, cobertura real redondeada hacia abajo y umbral heredado vigente; **nunca disminuir un umbral existente**.

| Métrica | Umbral heredado mínimo (verificar valor vigente) |
|---|---:|
| Frontend sentencias | 76,73 % |
| Frontend ramas | 64,85 % |
| Frontend funciones | 73,89 % |
| Frontend líneas | 79,59 % |
| Backend global | 84 % |

```bash
cd backend && python -m pytest -v --cov=app --cov-report=term --cov-fail-under=84
cd ../frontend && pnpm install --frozen-lockfile && pnpm test:coverage && pnpm lint && pnpm build
cd ../e2e && pnpm install --frozen-lockfile && pnpm exec playwright test
```

No ejecutar E2E contra producción ni requerir credenciales reales. No modificar umbrales dentro de los PR individuales.

## 7. Estado y checklist de Semana 5

- [x] Rama grupal `semana-5` y reparto con capas rotadas.
- [x] Inventario inicial de dependencias externas.
- [ ] PR de Nicol: ≥3 tests con dobles, mutación roja/verde y revisión de Dayana.
- [ ] PR de David: ≥3 tests con dobles, mutación roja/verde y revisión de Nicol.
- [ ] PR de Dayana: ≥2 E2E con `page.route` y tercer test, mutación, revisión de Edith.
- [ ] PR de Edith: cliente HTTP con MSW, casos de error y revisión de David.
- [ ] Revisión grupal de exceso de mocks registrada.
- [ ] Cobertura real frontend/backend consolidada en matriz.
- [ ] PR separado de umbrales, con CI verde.
- [ ] Integración final `semana-5` → `develop`.

### Vocero aleatorio

Cada persona debe poder explicar **un test que no escribió**: tipo de doble, qué pasaría con la dependencia real, diferencia entre estado/comportamiento, y una mutación que escaparía a ese test.

---

**Referencia oficial:** https://github.com/ergrato-dev/bc-testing-adso/blob/main/bootcamp/week-05-dobles_de_prueba/3-reto/README.md
