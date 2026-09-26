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

/// "Asistencia" del Instructor en el móvil — **solo consulta**.
///
/// Contraparte de `frontend/src/pages/AsistenciaInstructor.tsx`: la misma
/// nómina (`GET /asistencias/sesion`), pero sin los controles para marcar.
/// Pasar lista es `POST /asistencias/sesion` y se hace desde la web, porque
/// el móvil es read-only por arquitectura (ARQUITECTURA_MOBILE.md). La
/// pantalla lo dice en vez de dejar al instructor buscando un botón que no
/// existe.
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
            const _NotaSoloLectura(),
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

class _NotaSoloLectura extends StatelessWidget {
  const _NotaSoloLectura();

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
          Icon(Icons.visibility_outlined, size: 18, color: tema.colorScheme.onSurfaceVariant),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Consulta de la lista de tus clases. Para pasar lista o corregirla, '
              'entra a SIHS desde el computador.',
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
  });

  final SesionHorario bloque;
  final DateTime fecha;
  final SesionAsistencia? sesion;
  final String? error;

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
            : () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => NominaSesionScreen(sesion: sesion!),
                )),
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
              Row(
                children: [
                  Icon(Icons.schedule_rounded, size: 14, color: tema.colorScheme.onSurfaceVariant),
                  const SizedBox(width: 4),
                  Text(bloque.rangoHorarioTexto, style: tema.textTheme.labelMedium),
                  const SizedBox(width: 12),
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
class NominaSesionScreen extends StatelessWidget {
  const NominaSesionScreen({super.key, required this.sesion});

  final SesionAsistencia sesion;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
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
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          if (sesion.registrada)
            Text(
              'Lista registrada por ${sesion.registradaPor ?? 'ti'}.',
              style: tema.textTheme.bodySmall?.copyWith(color: tema.colorScheme.onSurfaceVariant),
            )
          else
            Text(
              'Esta clase todavía no tiene lista. Pásala desde SIHS en el computador.',
              style: tema.textTheme.bodySmall?.copyWith(color: tema.colorScheme.tertiary),
            ),
          const SizedBox(height: 12),
          if (aprendices.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 32),
              child: Text(
                'Ningún aprendiz vinculado a esta ficha. La nómina sale de quienes se '
                'registraron en SIHS y vincularon su ficha; el centro los gestiona en '
                'Sofía Plus, así que puede estar incompleta.',
                style: tema.textTheme.bodySmall,
                textAlign: TextAlign.center,
              ),
            )
          else
            for (final aprendiz in aprendices) _FilaAprendiz(aprendiz: aprendiz),
        ],
      ),
    );
  }
}

class _FilaAprendiz extends StatelessWidget {
  const _FilaAprendiz({required this.aprendiz});

  final AprendizDeSesion aprendiz;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final estado = aprendiz.estado;

    // Sin marcar es un gris neutro: no es una falta, es una lista a medio
    // llenar, y pintarlo de rojo acusaría a alguien por error.
    final color = switch (estado) {
      EstadoAsistencia.presente => tema.colorScheme.primary,
      EstadoAsistencia.tardanza => tema.colorScheme.tertiary,
      EstadoAsistencia.excusa => tema.colorScheme.onSurfaceVariant,
      EstadoAsistencia.ausente => tema.colorScheme.error,
      null => tema.colorScheme.outline,
    };

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: color.withValues(alpha: 0.12),
          child: Text(
            _iniciales(aprendiz.nombre),
            style: tema.textTheme.labelMedium?.copyWith(color: color, fontWeight: FontWeight.bold),
          ),
        ),
        title: Text(aprendiz.nombre, style: tema.textTheme.bodyMedium),
        subtitle: Text(
          [
            if (aprendiz.rolEnFicha != null) aprendiz.rolEnFicha!,
            if (aprendiz.numeroDocumento != null) 'Doc. ${aprendiz.numeroDocumento}',
            if (aprendiz.referenciaExcusa != null) 'Ref: ${aprendiz.referenciaExcusa}',
          ].join(' · '),
          style: tema.textTheme.labelSmall,
        ),
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            estado?.etiqueta ?? 'Sin marcar',
            style: tema.textTheme.labelSmall?.copyWith(color: color, fontWeight: FontWeight.bold),
          ),
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
