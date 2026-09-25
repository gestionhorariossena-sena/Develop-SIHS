import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

/// Tres tarjetas fantasma mientras carga — PROMPT_HOME_SCREEN.md §Loading.
/// Un esqueleto con la forma del contenido real evita el salto de layout
/// que produce un spinner centrado cuando por fin llega la lista.
class SkeletonHorarios extends StatelessWidget {
  final int cantidad;

  const SkeletonHorarios({super.key, this.cantidad = 3});

  @override
  Widget build(BuildContext context) {
    final colores = Theme.of(context).colorScheme;

    return Shimmer.fromColors(
      baseColor: colores.surfaceContainerHigh,
      highlightColor: colores.surfaceBright,
      child: Column(
        children: List.generate(
          cantidad,
          (_) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Container(
              height: 148,
              decoration: BoxDecoration(
                color: colores.surfaceContainerHigh,
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Estado sin contenido: ícono, explicación y una acción opcional. Se usa
/// tanto para "no hay horario" como para "no tienes ficha vinculada" —
/// situaciones distintas que necesitan textos distintos, no el mismo
/// "no hay datos".
class EstadoVacio extends StatelessWidget {
  final IconData icono;
  final String titulo;
  final String mensaje;
  final String? textoAccion;
  final VoidCallback? onAccion;

  const EstadoVacio({
    super.key,
    required this.icono,
    required this.titulo,
    required this.mensaje,
    this.textoAccion,
    this.onAccion,
  });

  @override
  Widget build(BuildContext context) {
    final colores = Theme.of(context).colorScheme;
    final textos = Theme.of(context).textTheme;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icono, size: 64, color: colores.onSurfaceVariant),
          const SizedBox(height: 16),
          Text(titulo, style: textos.titleMedium, textAlign: TextAlign.center),
          const SizedBox(height: 8),
          Text(
            mensaje,
            textAlign: TextAlign.center,
            style: textos.bodySmall?.copyWith(color: colores.onSurfaceVariant),
          ),
          if (textoAccion != null) ...[
            const SizedBox(height: 24),
            FilledButton.tonal(
              onPressed: onAccion,
              child: Text(textoAccion!),
            ),
          ],
        ],
      ),
    );
  }
}
