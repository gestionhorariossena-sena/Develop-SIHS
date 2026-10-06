import 'package:flutter/material.dart';

import '../models/aviso.dart';
import '../services/api_client.dart';
import '../services/aviso_service.dart';
import '../widgets/estados_horario.dart';

/// Nombres en español a mano, por el mismo motivo que en
/// asistencia_screen.dart: `DateFormat(..., 'es')` exige inicializar el
/// locale en el arranque y sin eso tumba la pantalla.
const _mesesCortos = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

String _fechaCorta(DateTime fecha) =>
    '${fecha.day} ${_mesesCortos[fecha.month - 1]} ${fecha.year}';

/// Pestaña "Avisos": la campana de los diseños "Vista movil Aprendiz" y
/// "Vista Instructor Movil". Junta en un solo lugar las dos fuentes que
/// el backend ya expone a cualquier rol:
///
/// - **Avisos** (`GET /avisos/`): el tablón que publica la coordinación,
///   ya filtrado por el backend a la ficha o sede de quien pregunta.
/// - **Notificaciones** (`GET /notificaciones/`): las personales.
///
/// **Solo lectura**, como el resto del móvil (ARQUITECTURA_MOBILE.md):
/// no se publican avisos ni se marcan notificaciones como leídas acá.
class AvisosScreen extends StatefulWidget {
  const AvisosScreen({super.key, this.gateway});

  /// Inyectable para los tests; en producción usa el servicio real.
  final AvisoGateway? gateway;

  @override
  State<AvisosScreen> createState() => _AvisosScreenState();
}

class _AvisosScreenState extends State<AvisosScreen> {
  late final AvisoGateway _gateway = widget.gateway ?? AvisoService();

  List<Aviso> _avisos = const [];
  List<Notificacion> _notificaciones = const [];
  String? _errorAvisos;
  String? _errorNotificaciones;
  bool _cargando = true;

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  /// Las dos fuentes se piden a la vez y fallan por separado: que una se
  /// caiga no puede dejar en blanco la otra pestaña.
  Future<void> _cargar() async {
    setState(() => _cargando = true);

    // Las dos arrancan antes del primer await: van en paralelo.
    final pedidoAvisos = _intentar(_gateway.obtenerAvisos);
    final pedidoNotificaciones = _intentar(_gateway.obtenerNotificaciones);
    final (avisos, errorAvisos) = await pedidoAvisos;
    final (notificaciones, errorNotificaciones) = await pedidoNotificaciones;
    if (!mounted) return;

    final hoy = DateUtils.dateOnly(DateTime.now());
    setState(() {
      // El backend no descarta los vencidos: un aviso con `vigenteHasta`
      // en el pasado ya no le dice nada a quien lo lee.
      _avisos = [
        for (final a in avisos ?? const <Aviso>[])
          if (a.vigenteHasta == null || !a.vigenteHasta!.isBefore(hoy)) a,
      ]..sort((a, b) => b.fechaPublicacion.compareTo(a.fechaPublicacion));
      _notificaciones = [...?notificaciones]
        ..sort((a, b) => b.fechaCreacion.compareTo(a.fechaCreacion));
      _errorAvisos = errorAvisos;
      _errorNotificaciones = errorNotificaciones;
      _cargando = false;
    });
  }

  Future<(T?, String?)> _intentar<T>(Future<T> Function() pedir) async {
    try {
      return (await pedir(), null);
    } on ApiException catch (e) {
      return (null, e.mensaje);
    } catch (_) {
      return (null, 'No se pudo cargar. Inténtalo de nuevo.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final sinLeer = _notificaciones.where((n) => !n.leida).length;

    return DefaultTabController(
      length: 2,
      child: SafeArea(
        child: Column(
          children: [
            TabBar(
              tabs: [
                const Tab(key: Key('tab-avisos'), text: 'Avisos'),
                Tab(
                  key: const Key('tab-notificaciones'),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Flexible(
                        child: Text('Notificaciones', overflow: TextOverflow.ellipsis),
                      ),
                      if (sinLeer > 0) ...[
                        const SizedBox(width: 6),
                        Badge(label: Text('$sinLeer')),
                      ],
                    ],
                  ),
                ),
              ],
            ),
            Expanded(
              child: _cargando
                  ? const Center(child: CircularProgressIndicator())
                  : TabBarView(
                      children: [
                        _Lista(
                          onRecargar: _cargar,
                          error: _errorAvisos,
                          vacio: const EstadoVacio(
                            icono: Icons.campaign_outlined,
                            titulo: 'No hay avisos vigentes',
                            mensaje: 'Los avisos que publique tu coordinación '
                                'para tu ficha o tu sede aparecerán aquí.',
                          ),
                          hijos: [for (final a in _avisos) _TarjetaAviso(aviso: a)],
                        ),
                        _Lista(
                          onRecargar: _cargar,
                          error: _errorNotificaciones,
                          vacio: const EstadoVacio(
                            icono: Icons.notifications_none_rounded,
                            titulo: 'No tienes notificaciones',
                            mensaje: 'Aquí te avisamos de cambios en tu horario '
                                'y respuestas a tus solicitudes.',
                          ),
                          hijos: [
                            for (final n in _notificaciones) _FilaNotificacion(notificacion: n),
                          ],
                        ),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Lista con pull-to-refresh y sus estados vacío y de error. El
/// `ListView` está también en esos estados para que el gesto de refrescar
/// funcione con la pantalla vacía.
class _Lista extends StatelessWidget {
  const _Lista({
    required this.onRecargar,
    required this.error,
    required this.vacio,
    required this.hijos,
  });

  final Future<void> Function() onRecargar;
  final String? error;
  final Widget vacio;
  final List<Widget> hijos;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRecargar,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          if (error != null)
            EstadoVacio(
              icono: Icons.cloud_off_rounded,
              titulo: 'No se pudo cargar',
              mensaje: error!,
              textoAccion: 'Reintentar',
              onAccion: onRecargar,
            )
          else if (hijos.isEmpty)
            vacio
          else
            ...hijos,
        ],
      ),
    );
  }
}

class _TarjetaAviso extends StatelessWidget {
  const _TarjetaAviso({required this.aviso});

  final Aviso aviso;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final colores = tema.colorScheme;
    final extraordinario = aviso.categoria == CategoriaAviso.extraordinario;

    return Card(
      elevation: 0,
      color: colores.surfaceContainerLowest,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: extraordinario ? colores.error : colores.outlineVariant,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 8,
              runSpacing: 6,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: extraordinario
                        ? colores.errorContainer
                        : colores.primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    aviso.categoria.etiqueta,
                    style: tema.textTheme.labelSmall?.copyWith(
                      color: extraordinario ? colores.onErrorContainer : colores.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                Text(
                  aviso.alcance,
                  style: tema.textTheme.labelSmall
                      ?.copyWith(color: colores.onSurfaceVariant),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              aviso.titulo,
              style: tema.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 6),
            Text(aviso.cuerpo, style: tema.textTheme.bodyMedium),
            const SizedBox(height: 10),
            Text(
              [
                'Publicado el ${_fechaCorta(aviso.fechaPublicacion)}',
                if (aviso.publicadorNombre != null) 'por ${aviso.publicadorNombre}',
                if (aviso.vigenteHasta != null)
                  '· vigente hasta el ${_fechaCorta(aviso.vigenteHasta!)}',
              ].join(' '),
              style: tema.textTheme.bodySmall?.copyWith(color: colores.onSurfaceVariant),
            ),
          ],
        ),
      ),
    );
  }
}

class _FilaNotificacion extends StatelessWidget {
  const _FilaNotificacion({required this.notificacion});

  final Notificacion notificacion;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final colores = tema.colorScheme;
    final sinLeer = !notificacion.leida;

    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 8),
      color: sinLeer
          ? colores.primary.withValues(alpha: 0.06)
          : colores.surfaceContainerLowest,
      child: ListTile(
        leading: Icon(
          sinLeer ? Icons.notifications_active_rounded : Icons.notifications_none_rounded,
          color: sinLeer ? colores.primary : colores.onSurfaceVariant,
        ),
        title: Text(
          notificacion.mensaje,
          style: sinLeer ? const TextStyle(fontWeight: FontWeight.w600) : null,
        ),
        subtitle: Text(_fechaCorta(notificacion.fechaCreacion)),
      ),
    );
  }
}
