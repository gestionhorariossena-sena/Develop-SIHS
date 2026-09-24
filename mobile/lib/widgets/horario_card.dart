import 'package:flutter/material.dart';

import '../models/horario.dart';

/// Tarjeta de un bloque de clase — PROMPT_HOME_SCREEN.md §3.
///
/// Encabezado (día + hora + estado), divisor y hasta tres filas de detalle.
/// [mostrarInstructor] se apaga cuando quien mira ES el instructor de la
/// clase: repetir su propio nombre en cada tarjeta no aporta nada.
class HorarioCard extends StatelessWidget {
  final SesionHorario sesion;
  final bool mostrarInstructor;
  final VoidCallback? onTap;

  const HorarioCard({
    super.key,
    required this.sesion,
    this.mostrarInstructor = true,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colores = Theme.of(context).colorScheme;
    final textos = Theme.of(context).textTheme;
    final horario = sesion.horario;

    return Card(
      child: InkWell(
        onTap: onTap ?? () => mostrarDetalles(context, sesion, mostrarInstructor),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          sesion.diaTexto,
                          style: textos.titleMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          sesion.rangoHorarioTexto,
                          style: textos.bodyLarge?.copyWith(
                            color: colores.primary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _Insignia(publicado: horario.publicado),
                ],
              ),
              const SizedBox(height: 12),
              const Divider(),
              const SizedBox(height: 12),
              _FilaDetalle(
                icono: Icons.menu_book_outlined,
                etiqueta: 'Tema',
                valor: horario.temaTexto,
              ),
              const SizedBox(height: 8),
              _FilaDetalle(
                icono: Icons.badge_outlined,
                etiqueta: 'Ficha',
                valor: horario.fichaTexto,
              ),
              const SizedBox(height: 8),
              _FilaDetalle(
                icono: Icons.location_on_outlined,
                etiqueta: 'Ambiente',
                valor: horario.ambienteTexto,
              ),
              if (mostrarInstructor) ...[
                const SizedBox(height: 8),
                _FilaDetalle(
                  icono: Icons.person_outline,
                  etiqueta: 'Instructor',
                  valor: horario.instructorTexto,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Bottom sheet con el detalle completo del bloque.
void mostrarDetalles(
  BuildContext context,
  SesionHorario sesion,
  bool mostrarInstructor,
) {
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (context) {
      final horario = sesion.horario;
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Detalle de la clase',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 20),
              _ItemDetalle(etiqueta: 'Día', valor: sesion.diaTexto),
              _ItemDetalle(etiqueta: 'Hora', valor: sesion.rangoHorarioTexto),
              _ItemDetalle(etiqueta: 'Tema', valor: horario.temaTexto),
              _ItemDetalle(etiqueta: 'Ficha', valor: horario.fichaTexto),
              _ItemDetalle(etiqueta: 'Ambiente', valor: horario.ambienteTexto),
              if (mostrarInstructor)
                _ItemDetalle(
                  etiqueta: 'Instructor',
                  valor: horario.instructorTexto,
                ),
              _ItemDetalle(
                etiqueta: 'Estado',
                valor: horario.publicado ? 'Publicado' : 'Borrador',
              ),
              const SizedBox(height: 8),
              FilledButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cerrar'),
              ),
            ],
          ),
        ),
      );
    },
  );
}

class _Insignia extends StatelessWidget {
  final bool publicado;

  const _Insignia({required this.publicado});

  @override
  Widget build(BuildContext context) {
    final colores = Theme.of(context).colorScheme;
    final esVerde = publicado;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: esVerde ? colores.secondaryContainer : colores.surfaceContainerHigh,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        publicado ? 'Publicado' : 'Borrador',
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              fontWeight: FontWeight.w600,
              color: esVerde
                  ? colores.onSecondaryContainer
                  : colores.onSurfaceVariant,
            ),
      ),
    );
  }
}

class _FilaDetalle extends StatelessWidget {
  final IconData icono;
  final String etiqueta;
  final String valor;

  const _FilaDetalle({
    required this.icono,
    required this.etiqueta,
    required this.valor,
  });

  @override
  Widget build(BuildContext context) {
    final colores = Theme.of(context).colorScheme;
    final textos = Theme.of(context).textTheme;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icono, size: 18, color: colores.onSurfaceVariant),
        const SizedBox(width: 8),
        Text(
          '$etiqueta:',
          style: textos.bodySmall?.copyWith(color: colores.onSurfaceVariant),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            valor,
            style: textos.bodySmall?.copyWith(fontWeight: FontWeight.w600),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}

class _ItemDetalle extends StatelessWidget {
  final String etiqueta;
  final String valor;

  const _ItemDetalle({required this.etiqueta, required this.valor});

  @override
  Widget build(BuildContext context) {
    final colores = Theme.of(context).colorScheme;
    final textos = Theme.of(context).textTheme;

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            etiqueta,
            style: textos.labelSmall?.copyWith(color: colores.onSurfaceVariant),
          ),
          const SizedBox(height: 4),
          Text(valor, style: textos.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
