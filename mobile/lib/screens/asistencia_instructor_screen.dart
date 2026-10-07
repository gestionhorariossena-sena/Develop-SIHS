import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/asistencia.dart';
import '../models/horario.dart';
import '../providers/horario_provider.dart';
import '../services/api_client.dart';
import '../services/asistencia_service.dart';

const _diasAbreviados = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

const _meses = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/// "Asistencia" del Instructor en el móvil.
///
/// Contraparte de `frontend/src/pages/AsistenciaInstructor.tsx`: consulta la
/// nómina con `GET /asistencias/sesion` y permite registrar/corregir la lista
/// con el mismo `POST /asistencias/sesion` que usa la web.
///
/// El backend solo devuelve bloques de quien pregunta (404 si son de otro
/// instructor), así que acá no hay filtro de propiedad que reimplementar:
/// las clases salen del mismo `HorarioProvider` que ya cargó "Mi horario".
class AsistenciaInstructorScreen extends StatefulWidget {
  const AsistenciaInstructorScreen({super.key, this.gateway});

  /// Inyectable para los tests; en producción usa el servicio real.
  final AsistenciaGateway? gateway;

  @override
  State<AsistenciaInstructorScreen> createState() => _AsistenciaInstructorScreenState();
}

class _AsistenciaInstructorScreenState extends State<AsistenciaInstructorScreen> {
  late final AsistenciaGateway _gateway = widget.gateway ?? AsistenciaService();

  /// Arranca en hoy. No se puede avanzar más allá: una clase que todavía no
  /// ocurrió no tiene lista que consultar (el backend tampoco deja
  /// registrarla, ver `_validar_fecha`).
  late DateTime _fecha = _hoy;

  final Map<int, SesionAsistencia> _sesiones = {};
  final Map<int, String> _errores = {};
  bool _cargando = false;

  /// Qué combinación de bloques+fecha se pidió ya, para no repetir la
  /// carga en cada rebuild del provider.
  String? _cargado;

  static DateTime get _hoy {
    final ahora = DateTime.now();
    return DateTime(ahora.year, ahora.month, ahora.day);
  }

  bool get _esHoy => _fecha == _hoy;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();

    final bloques = _bloquesDelDia(context.watch<HorarioProvider>().sesiones);
    final clave = '${AsistenciaService.soloFecha(_fecha)}'
        '|${bloques.map((b) => b.horario.idHorario).join(',')}';

    if (clave == _cargado) return;
    _cargado = clave;
    // Microtask y no llamada directa: didChangeDependencies corre durante
    // el build y _cargar hace setState.
    unawaited(Future.microtask(() => _cargar(bloques)));
  }

  /// Los bloques del instructor que caen en el día de la semana de [_fecha].
  /// Domingo (7) nunca tiene clases: `dias` solo llega hasta el sábado.
  List<SesionHorario> _bloquesDelDia(List<SesionHorario> todas) =>
      todas.where((s) => s.idDia == _fecha.weekday).toList();

  Future<void> _cargar(List<SesionHorario> bloques) async {
    if (!mounted) return;

    setState(() {
      _cargando = true;
      _sesiones.clear();
      _errores.clear();
    });

    // En paralelo: son dos o tres bloques en un día normal, y en serie la
    // pantalla tardaría la suma de todos.
    await Future.wait(bloques.map((bloque) async {
      final id = bloque.horario.idHorario;
      try {
        final sesion = await _gateway.obtenerSesion(idHorario: id, fecha: _fecha);
        if (mounted) _sesiones[id] = sesion;
      } on ApiException catch (e) {
        if (mounted) _errores[id] = e.mensaje;
      } catch (_) {
        if (mounted) _errores[id] = 'No se pudo cargar la lista de esta clase.';
      }
    }));

    if (mounted) setState(() => _cargando = false);
  }

  void _moverFecha(int dias) {
    final nueva = _fecha.add(Duration(days: dias));
    if (nueva.isAfter(_hoy)) return;
    setState(() => _fecha = nueva);
  }

  Future<void> _recargar() async {
    final bloques = _bloquesDelDia(context.read<HorarioProvider>().sesiones);
    await _cargar(bloques);
  }

  @override
  Widget build(BuildContext context) {
    final horarios = context.watch<HorarioProvider>();
    final bloques = _bloquesDelDia(horarios.sesiones);

    return SafeArea(
      child: RefreshIndicator(
        onRefresh: _recargar,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          children: [
            _SelectorDeFecha(
              fecha: _fecha,
              esHoy: _esHoy,
              onMover: _moverFecha,
              onHoy: () => setState(() => _fecha = _hoy),
            ),
            const SizedBox(height: 12),
            const _NotaRegistroMovil(),
            const SizedBox(height: 16),
            if (horarios.isLoading || _cargando)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 48),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (bloques.isEmpty)
              _SinClases(fecha: _fecha)
            else
              for (final bloque in bloques)
                _TarjetaClase(
                  key: Key('clase-${bloque.horario.idHorario}'),
                  bloque: bloque,
                  sesion: _sesiones[bloque.horario.idHorario],
                  error: _errores[bloque.horario.idHorario],
                  fecha: _fecha,
                  gateway: _gateway,
                  onGuardada: _recargar,
                ),
          ],
        ),
      ),
    );
  }
}

class _SelectorDeFecha extends StatelessWidget {
  const _SelectorDeFecha({
    required this.fecha,
    required this.esHoy,
    required this.onMover,
    required this.onHoy,
  });

  final DateTime fecha;
  final bool esHoy;
  final void Function(int) onMover;
  final VoidCallback onHoy;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final texto = esHoy
        ? 'Hoy, ${fecha.day} de ${_meses[fecha.month - 1]}'
        : '${_diasAbreviados[fecha.weekday - 1]} ${fecha.day} de ${_meses[fecha.month - 1]}';

    return Row(
      children: [
        IconButton(
          key: const Key('fecha-anterior'),
          onPressed: () => onMover(-1),
          icon: const Icon(Icons.chevron_left_rounded),
          tooltip: 'Día anterior',
        ),
        Expanded(
          child: Text(
            texto,
            textAlign: TextAlign.center,
            style: tema.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
        ),
        IconButton(
          key: const Key('fecha-siguiente'),
          // Sin futuro: de una clase que no ha ocurrido no hay lista.
          onPressed: esHoy ? null : () => onMover(1),
          icon: const Icon(Icons.chevron_right_rounded),
          tooltip: 'Día siguiente',
        ),
        if (!esHoy)
          TextButton(
            key: const Key('volver-a-hoy'),
            onPressed: onHoy,
            child: const Text('Hoy'),
          ),
      ],
    );
  }
}

class _NotaRegistroMovil extends StatelessWidget {
  const _NotaRegistroMovil();

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: tema.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(Icons.fact_check_outlined, size: 18, color: tema.colorScheme.onSurfaceVariant),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Abre una clase para iniciar o corregir la lista desde el celular. '
              'Solo puedes registrar asistencia en tus propias clases.',
              style: tema.textTheme.bodySmall
                  ?.copyWith(color: tema.colorScheme.onSurfaceVariant),
            ),
          ),
        ],
      ),
    );
  }
}

class _SinClases extends StatelessWidget {
  const _SinClases({required this.fecha});

  final DateTime fecha;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final domingo = fecha.weekday == DateTime.sunday;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 24),
      child: Column(
        children: [
          Icon(Icons.event_available_outlined,
              size: 48, color: tema.colorScheme.onSurfaceVariant),
          const SizedBox(height: 12),
          Text(
            domingo ? 'Domingo sin formación' : 'No tienes clases este día',
            style: tema.textTheme.titleMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),
          Text(
            'Solo aparecen acá las clases publicadas donde figuras como instructor.',
            style: tema.textTheme.bodySmall,
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

class _TarjetaClase extends StatelessWidget {
  const _TarjetaClase({
    super.key,
    required this.bloque,
    required this.fecha,
    this.sesion,
    this.error,
    required this.gateway,
    required this.onGuardada,
  });

  final SesionHorario bloque;
  final DateTime fecha;
  final SesionAsistencia? sesion;
  final String? error;
  final AsistenciaGateway gateway;
  final Future<void> Function() onGuardada;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final horario = bloque.horario;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: sesion == null
            ? null
            : () async {
                final guardada = await Navigator.of(context).push<bool>(
                  MaterialPageRoute(
                    builder: (_) => NominaSesionScreen(
                      sesion: sesion!,
                      gateway: gateway,
                    ),
                  ),
                );
                if (guardada == true) await onGuardada();
              },
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      horario.fichaTexto,
                      style: tema.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                    ),
                  ),
                  _PildoraRegistro(sesion: sesion, error: error),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                horario.temaTexto,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: tema.textTheme.bodySmall,
              ),
              const SizedBox(height: 8),
              // Wrap y no Row: en un teléfono angosto (320 px) o con letra
              // grande, la hora y el ambiente no caben en una línea; el
              // ambiente baja a la siguiente en vez de desbordar.
              Wrap(
                spacing: 12,
                runSpacing: 4,
                children: [
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.schedule_rounded, size: 14, color: tema.colorScheme.onSurfaceVariant),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(bloque.rangoHorarioTexto, style: tema.textTheme.labelMedium),
                      ),
                    ],
                  ),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.meeting_room_outlined,
                          size: 14, color: tema.colorScheme.onSurfaceVariant),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          horario.ambienteTexto,
                          overflow: TextOverflow.ellipsis,
                          style: tema.textTheme.labelMedium,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              if (error != null) ...[
                const SizedBox(height: 8),
                Text(error!,
                    style: tema.textTheme.bodySmall?.copyWith(color: tema.colorScheme.error)),
              ] else if (sesion != null) ...[
                const SizedBox(height: 12),
                _ResumenMarcas(sesion: sesion!),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _PildoraRegistro extends StatelessWidget {
  const _PildoraRegistro({required this.sesion, required this.error});

  final SesionAsistencia? sesion;
  final String? error;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);

    final (texto, color) = switch ((error, sesion)) {
      (final String _, _) => ('Sin cargar', tema.colorScheme.error),
      (_, null) => ('—', tema.colorScheme.onSurfaceVariant),
      (_, final SesionAsistencia s) when s.registrada =>
        ('Lista registrada', tema.colorScheme.primary),
      _ => ('Sin registrar', tema.colorScheme.tertiary),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        texto,
        style: tema.textTheme.labelSmall?.copyWith(color: color, fontWeight: FontWeight.bold),
      ),
    );
  }
}

class _ResumenMarcas extends StatelessWidget {
  const _ResumenMarcas({required this.sesion});

  final SesionAsistencia sesion;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);

    if (sesion.aprendices.isEmpty) {
      return Text(
        'Ningún aprendiz vinculado a esta ficha todavía.',
        style: tema.textTheme.bodySmall?.copyWith(color: tema.colorScheme.onSurfaceVariant),
      );
    }

    if (!sesion.registrada) {
      return Text(
        '${sesion.aprendices.length} aprendices · nadie ha pasado lista',
        style: tema.textTheme.bodySmall?.copyWith(color: tema.colorScheme.onSurfaceVariant),
      );
    }

    return Wrap(
      spacing: 12,
      runSpacing: 4,
      children: [
        for (final estado in EstadoAsistencia.values)
          if (sesion.contar(estado) > 0)
            Text(
              '${estado.etiqueta}: ${sesion.contar(estado)}',
              style: tema.textTheme.labelMedium,
            ),
        if (sesion.sinMarcar > 0)
          Text('Sin marcar: ${sesion.sinMarcar}', style: tema.textTheme.labelMedium),
      ],
    );
  }
}

/// La nómina completa de una sesión. Pantalla aparte y no una hoja
/// inferior: una ficha puede tener treinta aprendices y eso es una lista
/// larga, no un vistazo.
class NominaSesionScreen extends StatefulWidget {
  const NominaSesionScreen({
    super.key,
    required this.sesion,
    required this.gateway,
  });

  final SesionAsistencia sesion;
  final AsistenciaGateway gateway;

  @override
  State<NominaSesionScreen> createState() => _NominaSesionScreenState();
}

class _NominaSesionScreenState extends State<NominaSesionScreen> {
  late final Map<String, EstadoAsistencia> _marcas = {
    for (final aprendiz in widget.sesion.aprendices)
      if (aprendiz.estado != null) aprendiz.idUsuario: aprendiz.estado!,
  };
  late final Map<String, String?> _referenciasExcusa = {
    for (final aprendiz in widget.sesion.aprendices)
      if (aprendiz.referenciaExcusa != null)
        aprendiz.idUsuario: aprendiz.referenciaExcusa,
  };

  bool _guardando = false;
  String? _error;

  void _marcarTodosPresentes() {
    setState(() {
      for (final aprendiz in widget.sesion.aprendices) {
        _marcas[aprendiz.idUsuario] = EstadoAsistencia.presente;
      }
      _error = null;
    });
  }

  Future<void> _guardar() async {
    if (_guardando || _marcas.isEmpty) return;
    setState(() {
      _guardando = true;
      _error = null;
    });
    try {
      await widget.gateway.registrarSesion(
        idHorario: widget.sesion.idHorario,
        fecha: widget.sesion.fechaSesion,
        marcas: Map.unmodifiable(_marcas),
        referenciasExcusa: Map.unmodifiable(_referenciasExcusa),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Asistencia guardada.')),
      );
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.mensaje);
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'No se pudo guardar la asistencia.');
      }
    } finally {
      if (mounted) setState(() => _guardando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final sesion = widget.sesion;
    final aprendices = sesion.aprendices;

    return Scaffold(
      appBar: AppBar(
        title: Text(sesion.fichaCodigo ?? 'Lista de clase'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(24),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              '${sesion.fechaSesion.day} de ${_meses[sesion.fechaSesion.month - 1]} · '
              '${sesion.horaInicio.length >= 5 ? sesion.horaInicio.substring(0, 5) : sesion.horaInicio}'
              ' - '
              '${sesion.horaFin.length >= 5 ? sesion.horaFin.substring(0, 5) : sesion.horaFin}',
              style: tema.textTheme.bodySmall,
            ),
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 110),
        children: [
          if (sesion.registrada)
            Text(
              'Lista registrada por ${sesion.registradaPor ?? 'ti'}. Puedes corregirla y guardar de nuevo.',
              style: tema.textTheme.bodySmall?.copyWith(color: tema.colorScheme.onSurfaceVariant),
            )
          else
            Text(
              'Esta clase todavía no tiene lista. Marca a los aprendices y guarda la asistencia.',
              style: tema.textTheme.bodySmall?.copyWith(color: tema.colorScheme.tertiary),
            ),
          const SizedBox(height: 12),
          if (_error != null)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: tema.colorScheme.errorContainer,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                _error!,
                style: tema.textTheme.bodySmall?.copyWith(
                  color: tema.colorScheme.onErrorContainer,
                ),
              ),
            ),
          if (aprendices.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 32),
              child: Text(
                'Ningún aprendiz vinculado a esta ficha. La nómina sale de quienes se '
                'registraron en SIHS y vincularon su ficha.',
                style: tema.textTheme.bodySmall,
                textAlign: TextAlign.center,
              ),
            )
          else ...[
            Align(
              alignment: Alignment.centerLeft,
              child: OutlinedButton.icon(
                key: const Key('marcar-todos-presentes'),
                onPressed: _guardando ? null : _marcarTodosPresentes,
                icon: const Icon(Icons.done_all_rounded),
                label: const Text('Marcar todos presentes'),
              ),
            ),
            const SizedBox(height: 12),
            for (final aprendiz in aprendices)
              _FilaAprendizEditable(
                aprendiz: aprendiz,
                estado: _marcas[aprendiz.idUsuario],
                referenciaExcusa: _referenciasExcusa[aprendiz.idUsuario],
                onCambiar: (estado) => setState(() {
                  _marcas[aprendiz.idUsuario] = estado;
                  if (estado != EstadoAsistencia.excusa) {
                    _referenciasExcusa.remove(aprendiz.idUsuario);
                  }
                  _error = null;
                }),
                onReferenciaExcusa: (valor) => setState(() {
                  _referenciasExcusa[aprendiz.idUsuario] =
                      valor.trim().isEmpty ? null : valor.trim();
                }),
              ),
          ],
        ],
      ),
      bottomNavigationBar: aprendices.isEmpty
          ? null
          : SafeArea(
              top: false,
              child: Container(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
                decoration: BoxDecoration(
                  color: tema.colorScheme.surface,
                  border: Border(top: BorderSide(color: tema.colorScheme.outlineVariant)),
                ),
                child: FilledButton.icon(
                  key: const Key('guardar-asistencia'),
                  onPressed: _marcas.isEmpty || _guardando ? null : _guardar,
                  icon: _guardando
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.save_outlined),
                  label: Text(_guardando ? 'Guardando…' : 'Guardar asistencia'),
                ),
              ),
            ),
    );
  }
}

class _FilaAprendizEditable extends StatelessWidget {
  const _FilaAprendizEditable({
    required this.aprendiz,
    required this.estado,
    required this.referenciaExcusa,
    required this.onCambiar,
    required this.onReferenciaExcusa,
  });

  final AprendizDeSesion aprendiz;
  final EstadoAsistencia? estado;
  final String? referenciaExcusa;
  final ValueChanged<EstadoAsistencia> onCambiar;
  final ValueChanged<String> onReferenciaExcusa;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  child: Text(_iniciales(aprendiz.nombre)),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(aprendiz.nombre, style: tema.textTheme.bodyMedium),
                      Text(
                        [
                          if (aprendiz.rolEnFicha != null) aprendiz.rolEnFicha!,
                          if (aprendiz.numeroDocumento != null) 'Doc. ${aprendiz.numeroDocumento}',
                        ].join(' · '),
                        style: tema.textTheme.labelSmall,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final opcion in EstadoAsistencia.values)
                  ChoiceChip(
                    key: Key('estado-${aprendiz.idUsuario}-${opcion.valorApi}'),
                    label: Text(opcion.etiqueta),
                    selected: estado == opcion,
                    onSelected: (_) => onCambiar(opcion),
                  ),
              ],
            ),
            if (estado == EstadoAsistencia.excusa) ...[
              const SizedBox(height: 8),
              TextFormField(
                key: Key('excusa-${aprendiz.idUsuario}'),
                initialValue: referenciaExcusa ?? '',
                onChanged: onReferenciaExcusa,
                decoration: const InputDecoration(
                  labelText: 'Referencia o radicado de la excusa',
                  hintText: 'Opcional',
                  isDense: true,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  static String _iniciales(String nombre) {
    final palabras = nombre.trim().split(RegExp(r'\s+'));
    final primera = palabras.isNotEmpty && palabras[0].isNotEmpty ? palabras[0][0] : '';
    final segunda = palabras.length > 1 && palabras[1].isNotEmpty ? palabras[1][0] : '';
    return (primera + segunda).toUpperCase();
  }
}
