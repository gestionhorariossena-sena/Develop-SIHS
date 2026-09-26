import 'package:flutter/material.dart';

import '../models/asistencia.dart';
import '../services/asistencia_service.dart';
import '../services/api_client.dart';

/// Umbral del reglamento del aprendiz SENA.
const double _umbral = 85;

/// Nombres en español a mano, y no `DateFormat(..., 'es')`: esa ruta exige
/// `initializeDateFormatting('es')` en el arranque, que esta app no hace —
/// sin eso lanza LocaleDataException y tumba la pantalla entera. Para doce
/// meses y siete días, una constante es más barata que esa dependencia.
const _meses = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const _diasAbreviados = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

/// "Mi asistencia" del Aprendiz en el móvil — **solo lectura**.
/// Diseño: `mi_asistencia_aprendiz_m_vil_flutter_m3` (Stitch, 2026-09-25).
///
/// No hay ningún control para marcar, justificar ni reclamar, y no es una
/// limitación del cliente: la asistencia la certifica el instructor que
/// dictó la clase (`POST /asistencias/sesion` exige su rol y que el bloque
/// sea suyo). El móvil además es read-only por arquitectura —
/// ARQUITECTURA_MOBILE.md— así que las dos reglas coinciden.
class AsistenciaScreen extends StatefulWidget {
  const AsistenciaScreen({super.key, this.gateway});

  /// Inyectable para los tests; en producción usa el servicio real.
  final AsistenciaGateway? gateway;

  @override
  State<AsistenciaScreen> createState() => _AsistenciaScreenState();
}

class _AsistenciaScreenState extends State<AsistenciaScreen> {
  late final AsistenciaGateway _gateway = widget.gateway ?? AsistenciaService();

  MiAsistencia? _datos;
  bool _cargando = true;
  String? _error;
  EstadoAsistencia? _filtro;

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  Future<void> _cargar() async {
    setState(() {
      _cargando = true;
      _error = null;
    });

    try {
      final datos = await _gateway.obtenerMiAsistencia();
      if (!mounted) return;
      setState(() => _datos = datos);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.mensaje);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'No se pudo cargar tu asistencia.');
    } finally {
      if (mounted) setState(() => _cargando = false);
    }
  }

  List<SesionAsistida> get _visibles {
    final sesiones = _datos?.sesiones ?? const <SesionAsistida>[];
    if (_filtro == null) return sesiones;
    return sesiones.where((s) => s.estado == _filtro).toList();
  }

  @override
  Widget build(BuildContext context) {
    if (_cargando) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return _MensajeCentrado(
        icono: Icons.cloud_off_rounded,
        titulo: 'No se pudo cargar tu asistencia',
        detalle: _error!,
        onReintentar: _cargar,
      );
    }

    final datos = _datos;
    if (datos == null || datos.sesiones.isEmpty) {
      return _MensajeCentrado(
        icono: Icons.fact_check_outlined,
        titulo: 'Todavía no hay asistencia registrada',
        detalle: 'Aparece a medida que tus instructores la van registrando.',
        onReintentar: _cargar,
      );
    }

    return RefreshIndicator(
      onRefresh: _cargar,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          _TarjetaResumen(resumen: datos.resumen),
          const SizedBox(height: 16),
          _FiltroEstados(
            sesiones: datos.sesiones,
            filtro: _filtro,
            onCambiar: (valor) => setState(() => _filtro = valor),
          ),
          const SizedBox(height: 8),
          ..._porMes(_visibles),
        ],
      ),
    );
  }

  List<Widget> _porMes(List<SesionAsistida> sesiones) {
    final widgets = <Widget>[];
    String? mesAnterior;

    for (final sesion in sesiones) {
      final mes = '${_meses[sesion.fechaSesion.month - 1]} ${sesion.fechaSesion.year}';
      if (mes != mesAnterior) {
        mesAnterior = mes;
        widgets.add(Padding(
          padding: const EdgeInsets.only(top: 12, bottom: 6),
          child: Text(mes, style: Theme.of(context).textTheme.titleSmall),
        ));
      }
      widgets.add(_FilaSesion(sesion: sesion));
    }

    return widgets;
  }
}

class _TarjetaResumen extends StatelessWidget {
  const _TarjetaResumen({required this.resumen});

  final ResumenAsistencia resumen;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final bajoUmbral = resumen.registradas > 0 && resumen.porcentaje < _umbral;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            SizedBox(
              height: 120,
              width: 120,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  SizedBox(
                    height: 120,
                    width: 120,
                    child: CircularProgressIndicator(
                      value: resumen.porcentaje / 100,
                      strokeWidth: 10,
                      backgroundColor: tema.colorScheme.surfaceContainerHighest,
                    ),
                  ),
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('${resumen.porcentaje.toStringAsFixed(0)}%',
                          style: tema.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold)),
                      Text('ASISTENCIA', style: tema.textTheme.labelSmall),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _Cifra(etiqueta: 'Presente', valor: resumen.presente, color: tema.colorScheme.primary),
                _Cifra(etiqueta: 'Tarde', valor: resumen.tardanza, color: tema.colorScheme.tertiary),
                _Cifra(etiqueta: 'Ausente', valor: resumen.ausente, color: tema.colorScheme.error),
              ],
            ),
            if (bajoUmbral) ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: tema.colorScheme.tertiaryContainer,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  'Tu asistencia está por debajo del ${_umbral.toInt()}% que pide el reglamento. '
                  'Habla con tu instructor o con coordinación.',
                  style: tema.textTheme.bodySmall
                      ?.copyWith(color: tema.colorScheme.onTertiaryContainer),
                ),
              ),
            ],
            const SizedBox(height: 8),
            Text(
              'Se calcula sobre las clases a las que ya te pasaron lista, no sobre el total del '
              'trimestre. Las excusas no cuentan en contra.',
              style: tema.textTheme.bodySmall?.copyWith(color: tema.colorScheme.onSurfaceVariant),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _Cifra extends StatelessWidget {
  const _Cifra({required this.etiqueta, required this.valor, required this.color});

  final String etiqueta;
  final int valor;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(etiqueta, style: Theme.of(context).textTheme.labelSmall),
        Text('$valor',
            style: Theme.of(context)
                .textTheme
                .titleLarge
                ?.copyWith(color: color, fontWeight: FontWeight.bold)),
      ],
    );
  }
}

class _FiltroEstados extends StatelessWidget {
  const _FiltroEstados({required this.sesiones, required this.filtro, required this.onCambiar});

  final List<SesionAsistida> sesiones;
  final EstadoAsistencia? filtro;
  final ValueChanged<EstadoAsistencia?> onCambiar;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          FilterChip(
            label: Text('Todas (${sesiones.length})'),
            selected: filtro == null,
            onSelected: (_) => onCambiar(null),
          ),
          for (final estado in EstadoAsistencia.values)
            Padding(
              padding: const EdgeInsets.only(left: 8),
              child: FilterChip(
                label: Text(
                  '${estado.etiqueta} (${sesiones.where((s) => s.estado == estado).length})',
                ),
                selected: filtro == estado,
                onSelected: (_) => onCambiar(estado),
              ),
            ),
        ],
      ),
    );
  }
}

class _FilaSesion extends StatelessWidget {
  const _FilaSesion({required this.sesion});

  final SesionAsistida sesion;

  Color _color(BuildContext context) => switch (sesion.estado) {
        EstadoAsistencia.presente => Theme.of(context).colorScheme.primary,
        EstadoAsistencia.tardanza => Theme.of(context).colorScheme.tertiary,
        EstadoAsistencia.excusa => Theme.of(context).colorScheme.onSurfaceVariant,
        EstadoAsistencia.ausente => Theme.of(context).colorScheme.error,
      };

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final color = _color(context);

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Column(
              children: [
                Text('${sesion.fechaSesion.day}',
                    style: tema.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
                Text(
                  _diasAbreviados[sesion.fechaSesion.weekday - 1],
                  style: tema.textTheme.labelSmall,
                ),
              ],
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    sesion.resultadoDescripcion ?? 'Clase',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: tema.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                  ),
                  Text(
                    '${sesion.horaInicio.substring(0, 5)} - ${sesion.horaFin.substring(0, 5)}',
                    style: tema.textTheme.bodySmall,
                  ),
                  if (sesion.referenciaExcusa != null)
                    Text('Ref: ${sesion.referenciaExcusa}', style: tema.textTheme.labelSmall),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                sesion.estado.etiqueta,
                style: tema.textTheme.labelSmall?.copyWith(color: color, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MensajeCentrado extends StatelessWidget {
  const _MensajeCentrado({
    required this.icono,
    required this.titulo,
    required this.detalle,
    required this.onReintentar,
  });

  final IconData icono;
  final String titulo;
  final String detalle;
  final VoidCallback onReintentar;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icono, size: 48, color: Theme.of(context).colorScheme.onSurfaceVariant),
            const SizedBox(height: 12),
            Text(titulo, style: Theme.of(context).textTheme.titleMedium, textAlign: TextAlign.center),
            const SizedBox(height: 4),
            Text(detalle,
                style: Theme.of(context).textTheme.bodySmall, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton.tonal(onPressed: onReintentar, child: const Text('Reintentar')),
          ],
        ),
      ),
    );
  }
}
