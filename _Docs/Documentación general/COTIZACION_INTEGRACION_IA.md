# Cotización de integración de IA

Resumen de una revisión hecha con IA sobre el costo estimado de incorporar
IA a SIHS más adelante, y qué proveedor/modelo tendría mejor relación
costo/beneficio. Cotización de referencia: $3.116 COP/USD, 2026-09-09.
Complementa [Arquitectura IA del motor de horarios](../Arquitectura/Arquitectura_IA_Motor_Horarios.md).

## Supuesto de llamada

Se cotiza asumiendo una llamada pequeña típica de las tareas planteadas
(clasificar campo, interpretar instrucción, explicar conflicto):
**1.000 tokens de entrada + 300 tokens de salida**.

## Comparativa de modelos

| Modelo | Entrada / 1M tok | Salida / 1M tok | Aprox. por llamada | 1.000 llamadas/mes |
|---|---|---|---|---|
| Gemini 2.5 Flash-Lite | $0.10 | $0.40 | $0.85 COP | $850 COP |
| Gemini 2.5 Flash | $0.30 | $2.50 | $3.29 COP | $3.290 COP |
| Kimi K2 0711 | $0.57 | $2.30 | $2.89 COP | $2.890 COP |
| Kimi K2.6 | ~$0.58* | ~$3.40* | ~$5.10 COP | ~$5.100 COP |
| Modelo local (Ollama) | $0 | $0 | $0 | $0 |

\* El precio de Kimi K2.6 puede variar según proveedor/ruta; OpenRouter
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
