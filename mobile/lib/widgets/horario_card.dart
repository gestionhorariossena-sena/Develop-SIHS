import 'package:flutter/material.dart';
import '../models/horario.dart';

class HorarioCard extends StatelessWidget {
  final Horario horario;

  const HorarioCard({
    Key? key,
    required this.horario,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () {
          // Por ahora solo muestra más detalles
          _mostrarDetalles(context);
        },
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          horario.diaTexto,
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.bold,
                              ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          horario.horaTexto,
                          style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                                color: Theme.of(context).colorScheme.primary,
                                fontWeight: FontWeight.w600,
                              ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primaryContainer,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      horario.publicado ? 'Publicado' : 'Borrador',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: Theme.of(context).colorScheme.onPrimaryContainer,
                          ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Container(
                height: 1,
                color: Colors.grey[300],
              ),
              const SizedBox(height: 12),
              _BuildDetailRow(
                icon: Icons.book_outlined,
                label: 'Ficha',
                value: horario.fichaTexto,
              ),
              const SizedBox(height: 8),
              _BuildDetailRow(
                icon: Icons.location_on_outlined,
                label: 'Ambiente',
                value: horario.ambienteTexto,
              ),
              if (horario.instructor != null) ...[
                const SizedBox(height: 8),
                _BuildDetailRow(
                  icon: Icons.person_outlined,
                  label: 'Instructor',
                  value: horario.instructor!.nombre,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  void _mostrarDetalles(BuildContext context) {
    showModalBottomSheet(
      context: context,
      builder: (context) => Container(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Detalles del Horario',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 24),
            _DetailItem(label: 'Día', value: horario.diaTexto),
            _DetailItem(label: 'Hora', value: horario.horaTexto),
            _DetailItem(label: 'Ficha', value: horario.fichaTexto),
            _DetailItem(label: 'Ambiente', value: horario.ambienteTexto),
            if (horario.instructor != null)
              _DetailItem(label: 'Instructor', value: horario.instructor!.nombre),
            if (horario.observaciones != null)
              _DetailItem(label: 'Observaciones', value: horario.observaciones!),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cerrar'),
            ),
          ],
        ),
      ),
    );
  }
}

class _BuildDetailRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _BuildDetailRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 18, color: Colors.grey[600]),
        const SizedBox(width: 8),
        Text(
          label,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Colors.grey[600],
              ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            value,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}

class _DetailItem extends StatelessWidget {
  final String label;
  final String value;

  const _DetailItem({
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: Colors.grey[600],
                ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
          ),
        ],
      ),
    );
  }
}
