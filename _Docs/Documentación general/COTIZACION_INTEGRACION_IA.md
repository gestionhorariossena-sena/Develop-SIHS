# Cotización de integración de IA

Resumen de una revisión hecha con IA sobre el costo estimado de incorporar
IA a SIHS más adelante, y qué proveedor/modelo tendría mejor relación
costo/beneficio. Cotización de referencia: $3.116 COP/USD, 2026-09-09.
Complementa [Arquitectura IA del motor de horarios](../Arquitectura/Arquitectura_IA_Motor_Horarios.md).

> **Actualización 2026-09-09 (misma noche):** `gemini-2.5-flash-lite` ya
> no está disponible para keys nuevas — Google migró al usuario a
> `gemini-3.5-flash-lite`, que subió de precio (ver tabla). Los números de
> esta sección ya reflejan el precio vigente, verificado contra el
> anuncio oficial de Google y OpenRouter, y contra una llamada real hecha
> en la [prueba de clasificación de columnas](../Arquitectura/Arquitectura_IA_Motor_Horarios.md)
> contra un Excel real de SIHS (222 tokens de entrada + 358 de salida).

## Supuesto de llamada

Se cotiza con dos referencias: el supuesto original de 1.000 tokens de
entrada + 300 de salida, y el consumo **real medido** en la prueba contra
un Excel de SIHS (222 entrada + 358 salida) — ambos dan resultados del
mismo orden de magnitud.

## Comparativa de modelos (precio vigente 2026-09-09)

| Modelo | Entrada / 1M tok | Salida / 1M tok | Aprox. por llamada* | 1.000 llamadas/mes |
|---|---|---|---|---|
| Gemini 3.5 Flash-Lite | $0.30 | $2.50 | $3.00 COP | $3.000 COP |
| Gemini 3.5 Flash | $1.50 | $9.00 | $12.90 COP | $12.900 COP |
| Kimi K2 0711 | $0.57 | $2.30 | $2.89 COP | $2.890 COP |
| Kimi K2.6 | ~$0.58** | ~$3.40** | ~$5.10 COP | ~$5.100 COP |
| Modelo local (Ollama) | $0 | $0 | $0 | $0 |

\* Calculado sobre el consumo real medido (222 in / 358 out), no el
supuesto de 1.000/300 — por eso el valor de Flash-Lite bajó de $0.85 a
$3.00 COP pese al precio por token más alto: la llamada real fue más
liviana en entrada de lo asumido, pero el precio subió ~5x, así que el
neto es más caro que la cotización anterior. ~~Gemini 2.5 Flash-Lite~~
(fila anterior, ya no disponible) costaba $0.10/$0.40 — referencia
histórica, no usable para keys nuevas.

\*\* El precio de Kimi K2.6 puede variar según proveedor/ruta; OpenRouter
muestra actualmente proveedores con precios distintos. Precios de
referencia tomados de OpenRouter al momento de la revisión.

## Proyección de uso real

Con Gemini 2.5 Flash-Lite:

- 100 llamadas/día × 30 días = 3.000 llamadas/mes → **≈ $2.550 COP/mes**.
- 10.000 llamadas/mes → **≈ $8.500 COP/mes**.

Prácticamente nada para un sistema institucional, siempre que las
llamadas se mantengan pequeñas y estructuradas (que es justo el diseño
propuesto en la arquitectura). Google además muestra actualmente nivel
gratuito para varios modelos Gemini, aunque los límites y condiciones
pueden cambiar.

## Proyección con el volumen real de SIHS

SIHS genera **210 horarios por trimestre** (≈70/mes, ≈840/año). La IA no
se llama una vez por horario — se llama en los puntos de contacto reales
(clasificar columnas al importar, explicar un conflicto, interpretar una
instrucción) — pero conviene cotizar ambos extremos:

**Escenario A — peor caso (1 llamada de IA por cada horario creado)**

| | Cantidad | Costo (Gemini 3.5 Flash-Lite) |
|---|---|---|
| Por trimestre | 210 llamadas | ≈ $630 COP |
| Por mes | 70 llamadas | ≈ $210 COP |
| Por año | 840 llamadas | ≈ $2.520 COP |

**Escenario B — realista (mapeado a los puntos de contacto reales de IA)**

| Punto de contacto | Estimado/trimestre | Costo |
|---|---|---|
| Clasificación de columnas (4 imports × ~15 columnas) | 60 llamadas | ≈ $180 COP |
| Explicación de conflictos (~15% de 210 horarios) | ~32 llamadas | ≈ $96 COP |
| Instrucciones en lenguaje natural | ~30 llamadas | ≈ $90 COP |
| **Total** | **~122 llamadas/trimestre** | **≈ $366 COP/trimestre (≈ $122 COP/mes)** |

A este volumen (70-210 llamadas/mes), lo más probable es que el costo
real sea **$0** — el nivel gratuito de Google AI Studio (el mismo que se
usó para la prueba) da cuota diaria muy por encima de esto. El gasto solo
aparece si el uso escala a miles de llamadas/mes o se necesita el SLA de
la API de pago.

## Ranking recomendado

1. 🥇 **Gemini Flash-Lite** — primera opción a probar. Para clasificar,
   extraer, convertir texto → JSON, detectar inconsistencias e
   interpretar instrucciones sencillas. Barato y orientado a alto
   volumen.
2. 🥈 **Kimi** — alternativa cuando se necesite más capacidad de
   razonamiento (ventana de contexto enorme, orientado a razonamiento,
   herramientas y código). Para algo tan simple como "¿esta columna
   probablemente representa trimestre?" es demasiado modelo.
3. 🥉 **Gemini Flash** — escalón intermedio para cuando Flash-Lite no
   pueda resolver el caso (esquema de escalamiento: Flash-Lite → no
   resuelto → Flash).

## Opción de IA local

Con 32 GB de RAM disponibles, Ollama permite correr Qwen3 en varios
tamaños (0.6B, 1.7B, 4B, 8B, 14B, 30B...). Qwen3 4B ronda 2.5 GB y Qwen3
8B ronda 5.2 GB.

Recomendación: **Qwen3 4B**, RAM razonable, costo $0, velocidad alta,
capacidad suficiente para tareas simples tipo "clasifica esta columna",
"extrae estos datos", "convierte esto a JSON". Existen versiones
*no-thinking*, útiles para respuestas rápidas sin razonamiento
prolongado.

## Esquema híbrido recomendado

```
                  SIHS
                   │
                   ↓
             ¿Necesita IA?
              /          \
            NO            SÍ
            │              │
         Python       Modelo local
                         │
                    ¿confianza alta?
                     /          \
                   SÍ            NO
                   │              │
                aceptar      API barata
                                │
                         Gemini/Kimi
```

Ejemplos de escalamiento:

- Caso sencillo ("TRM") → Qwen3 local → `trimestre` → $0.
- Caso complicado (hoja con estructura distinta a las conocidas) →
  Gemini Flash-Lite.
- Caso muy complicado (planeación con formato totalmente nuevo) →
  modelo más potente (Kimi / Gemini Flash).

## Ruta de adopción recomendada

1. **MVP**: sin IA.
2. **Primera IA experimental**: Qwen3 4B local vía Ollama — $0.
3. **Fallback económico**: Gemini 2.5 Flash-Lite — centavos de peso por
   llamada pequeña.
4. **Fallback más potente**: Kimi / Gemini Flash.

No se pagaría Kimi desde el principio. La idea es que la IA pueda estar
apagada y el sistema funcione perfectamente, y cuando esté disponible
aporte inteligencia sin convertirse en un gasto importante ni en un
punto único de fallo.
