import 'package:flutter/material.dart';

import '../models/horario.dart';
import '../models/jornada_dia.dart';

/// Tarjeta de una clase, según los diseños "Vista movil Aprendiz" y "Vista
/// Instructor Movil": franja izquierda de color, hora en píldora, estado,
/// título del resultado de aprendizaje y pie con ambiente y ficha.
class SesionCard extends StatelessWidget {
  final SesionHorario sesion;
  final EstadoSesion estado;
  final bool mostrarInstructor;
  final VoidCallback? onTap;

  const SesionCard({
    super.key,
    required this.sesion,
    required this.estado,
    this.mostrarInstructor = true,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colores = Theme.of(context).colorScheme;
    final textos = Theme.of(context).textTheme;
    final horario = sesion.horario;
    final destacada = estado == EstadoSesion.enCurso;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: colores.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: destacada ? colores.primary : colores.outlineVariant,
          width: destacada ? 1.5 : 1,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // La franja de color es lo que hace legible la lista de un
            // vistazo: verde = ahora, gris = ya pasó.
            Container(
              width: 5,
              color: switch (estado) {
                EstadoSesion.enCurso => colores.primary,
                EstadoSesion.finalizado => colores.outlineVariant,
                _ => colores.primary.withValues(alpha: 0.45),
              },
            ),
            Expanded(
              child: InkWell(
                onTap: onTap,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.schedule_rounded,
                              size: 16, color: colores.onSurfaceVariant),
                          const SizedBox(width: 6),
                          Text(
                            '${sesion.horaInicioTexto} - ${sesion.horaFinTexto}',
                            style: textos.labelLarge
                                ?.copyWith(fontWeight: FontWeight.w700),
                          ),
                          const Spacer(),
                          _PildoraEstado(estado: estado),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(
                        horario.temaTexto,
                        style: textos.titleMedium
                            ?.copyWith(fontWeight: FontWeight.w700),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          _Etiqueta(texto: 'Ficha ${horario.fichaTexto}'),
                          const SizedBox(width: 8),
                          Flexible(
                            child: Text(
                              sesion.diaTexto,
                              style: textos.bodySmall
                                  ?.copyWith(color: colores.onSurfaceVariant),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                          color: colores.surfaceContainerLow,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _FilaPie(
                              icono: Icons.location_on_outlined,
                              texto: horario.ambienteTexto,
                            ),
                            if (mostrarInstructor) ...[
                              const SizedBox(height: 6),
                              _FilaPie(
                                icono: Icons.person_outline_rounded,
                                texto: horario.instructorTexto,
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PildoraEstado extends StatelessWidget {
  final EstadoSesion estado;

  const _PildoraEstado({required this.estado});

  @override
  Widget build(BuildContext context) {
    final colores = Theme.of(context).colorScheme;

    final (fondo, texto) = switch (estado) {
      EstadoSesion.enCurso => (colores.primary, colores.onPrimary),
      EstadoSesion.porIniciar => (
          colores.tertiaryContainer,
          colores.onTertiaryContainer
        ),
      EstadoSesion.finalizado => (
          colores.surfaceContainerHigh,
          colores.onSurfaceVariant
        ),
      EstadoSesion.otroDia => (
          colores.surfaceContainerHigh,
          colores.onSurfaceVariant
        ),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: fondo,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (estado == EstadoSesion.enCurso) ...[
            Icon(Icons.circle, size: 7, color: texto),
            const SizedBox(width: 5),
          ],
          Text(
            estado.etiqueta,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: texto,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ],
      ),
    );
  }
}

class _Etiqueta extends StatelessWidget {
  final String texto;

  const _Etiqueta({required this.texto});

  @override
  Widget build(BuildContext context) {
    final colores = Theme.of(context).colorScheme;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: colores.primary.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        texto,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: colores.primary,
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }
}

class _FilaPie extends StatelessWidget {
  final IconData icono;
  final String texto;

  const _FilaPie({required this.icono, required this.texto});

  @override
  Widget build(BuildContext context) {
    final colores = Theme.of(context).colorScheme;

    return Row(
      children: [
        Icon(icono, size: 16, color: colores.primary),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            texto,
            style: Theme.of(context).textTheme.bodySmall,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}
