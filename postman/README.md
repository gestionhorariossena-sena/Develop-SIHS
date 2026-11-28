# Colección Postman de SIHS

Importa `SIHS.postman_collection.json` en Postman y ejecútala con **Run** (Collection Runner, tipo *Functional*, ejecución *Local*). Inicia antes la demo con `make demo-up` o configura la API de pruebas.

Variables de la colección:

| Variable | Valor inicial | Uso |
| --- | --- | --- |
| `baseUrl` | `http://127.0.0.1:8000` | API de la demo local |
| `accessToken` | vacío | JWT válido para `/api/v1/usuarios/me` |
| `studentToken` | vacío | JWT válido de Aprendiz para comprobar `403` en `/api/v1/roles/` |
| `adminToken` | vacío | JWT válido de Administrador para comprobar `200` en `/api/v1/roles/` |

Con los tokens vacíos, la ejecución básica comprueba los `401` esperados. Para demostrar JWT y roles, configura los tokens de cuentas de **la demo local** en el valor local de Postman y vuelve a ejecutar. Nunca guardes tokens en el archivo exportado ni ejecutes esta colección contra producción.

Incluye salud, OpenAPI, errores `404`/`422`, validación de entrada, autenticación y autorización. Ninguna petición envía datos válidos para crear solicitudes de acceso. Ten presente que el primer `GET /usuarios/me` con un JWT válido puede crear automáticamente el perfil de ese usuario, según la implementación del backend; usa solo cuentas de prueba.

La colección no demuestra por sí sola el flujo de navegador completo.
