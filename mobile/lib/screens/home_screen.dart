import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/horario.dart';
import '../models/jornada_dia.dart';
import '../models/usuario.dart';
import '../providers/auth_provider.dart';
import '../providers/horario_provider.dart';
import '../widgets/estados_horario.dart';
import '../widgets/horario_card.dart';
import '../widgets/sesion_card.dart';
import 'perfil_screen.dart';

/// "Mi horario" — implementa los diseños "Vista movil Aprendiz" y "Vista
/// Instructor Movil". Misma pantalla para los dos roles: lo que cambia es
/// el encabezado (el aprendiz ve su ficha, el instructor no) y de dónde
/// salen los horarios, no la forma de leerlos.
///
/// Lo que el diseño muestra y NO existe en el backend (asistencias,
/// nº de aprendices por sesión, "Ver lista", sincronización con SOFIA) se
/// omite en vez de dibujarse con datos inventados.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  /// Día de la semana seleccionado (1=Lunes..6=Sábado). Arranca en hoy, o
  /// en lunes si hoy es domingo (no hay formación).
  late int _diaElegido = DateTime.now().weekday.clamp(1, 6);
  Jornada? _jornadaElegida;
  int _pestana = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _cargar());
  }

  Future<void> _cargar() async {
    if (!mounted) return;
    final usuario = context.read<AuthProvider>().usuarioActual;
    await context.read<HorarioProvider>().cargar(usuario);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final horarios = context.watch<HorarioProvider>();
    final usuario = auth.usuarioActual;

    if (usuario == null && auth.cargandoPerfil) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      body: _pestana == 0
          ? _VistaHorario(
              usuario: usuario,
              diaElegido: _diaElegido,
              jornadaElegida: _jornadaElegida,
              onElegirDia: (d) => setState(() => _diaElegido = d),
              onElegirJornada: (j) => setState(() => _jornadaElegida = j),
              onRecargar: _cargar,
            )
          : const PerfilScreen(),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _pestana,
        onDestinationSelected: (i) => setState(() => _pestana = i),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.calendar_month_outlined),
            selectedIcon: Icon(Icons.calendar_month_rounded),
            label: 'Mi horario',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline_rounded),
            selectedIcon: Icon(Icons.person_rounded),
            label: 'Perfil',
          ),
        ],
      ),
      floatingActionButton: _pestana == 0 && horarios.isLoading
          ? null
          : (_pestana == 0
              ? FloatingActionButton.small(
                  key: const Key('boton-refrescar'),
                  onPressed: _cargar,
                  tooltip: 'Actualizar',
                  child: const Icon(Icons.refresh_rounded),
                )
              : null),
    );
  }
}

class _VistaHorario extends StatelessWidget {
  final Usuario? usuario;
  final int diaElegido;
  final Jornada? jornadaElegida;
  final void Function(int) onElegirDia;
  final void Function(Jornada?) onElegirJornada;
  final Future<void> Function() onRecargar;

  const _VistaHorario({
    required this.usuario,
    required this.diaElegido,
    required this.jornadaElegida,
    required this.onElegirDia,
    required this.onElegirJornada,
    required this.onRecargar,
  });

  @override
  Widget build(BuildContext context) {
    final horarios = context.watch<HorarioProvider>();
    final ahora = DateTime.now();

    final delDia = horarios.sesiones.where((s) => s.idDia == diaElegido);
    final visibles = jornadaElegida == null
        ? delDia.toList()
        : delDia.where((s) => s.jornada == jornadaElegida).toList();

    return RefreshIndicator(
      onRefresh: onRecargar,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverToBoxAdapter(child: _Encabezado(usuario: usuario)),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _SelectorDeDias(
                    diaElegido: diaElegido,
                    onElegir: onElegirDia,
                    diasConClase: horarios.sesiones.map((s) => s.idDia).toSet(),
                  ),
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          diaElegido == ahora.weekday
                              ? 'Mi cronograma de hoy'
                              : 'Cronograma del ${SesionHorario.nombresDia[diaElegido]}',
                          style: Theme.of(context)
                              .textTheme
                              .titleLarge
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _FiltroJornada(
                    elegida: jornadaElegida,
                    onElegir: onElegirJornada,
                  ),
                  const SizedBox(height: 16),
                ],
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 96),
            sliver: _Contenido(
              estado: horarios.estado,
              sesiones: visibles,
              error: horarios.error,
              usuario: usuario,
              ahora: ahora,
              hayEnOtroDia: horarios.sesiones.isNotEmpty,
              onReintentar: onRecargar,
            ),
          ),
        ],
      ),
    );
  }
}

/// Barra verde con la marca y el saludo — común a los dos diseños.
class _Encabezado extends StatelessWidget {
  final Usuario? usuario;

  const _Encabezado({required this.usuario});

  @override
  Widget build(BuildContext context) {
    final colores = Theme.of(context).colorScheme;
    final textos = Theme.of(context).textTheme;
    final ficha = context.select<HorarioProvider, String?>(
      (p) => p.ficha?.descripcion,
    );

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: colores.primary,
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(24)),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: colores.onPrimary.withValues(alpha: 0.18),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(Icons.calendar_month_rounded,
                        color: colores.onPrimary, size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'SIHS',
                          style: textos.titleMedium?.copyWith(
                            color: colores.onPrimary,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        Text(
                          'Sistema de Horarios',
                          style: textos.bodySmall?.copyWith(
                            color: colores.onPrimary.withValues(alpha: 0.85),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Text(
                usuario == null
                    ? '¡Hola!'
                    : '¡Hola, ${usuario!.primerNombre}! 👋',
                style: textos.headlineSmall?.copyWith(
                  color: colores.onPrimary,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: colores.onPrimary.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      usuario?.rolPrincipal ?? 'Cargando perfil...',
                      style: textos.labelMedium?.copyWith(
                        color: colores.onPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  if (ficha != null)
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 260),
                      child: Text(
                        ficha,
                        style: textos.bodySmall?.copyWith(
                          color: colores.onPrimary.withValues(alpha: 0.9),
                        ),
                        maxLines: 2,
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Fila de días LUN-SÁB con la fecha real de esta semana, como el selector
/// del diseño del aprendiz. El horario de SIHS es semanal y se repite: la
/// fecha es orientación, el dato que manda es el día de la semana.
class _SelectorDeDias extends StatelessWidget {
  final int diaElegido;
  final Set<int> diasConClase;
  final void Function(int) onElegir;

  const _SelectorDeDias({
    required this.diaElegido,
    required this.diasConClase,
    required this.onElegir,
  });

  @override
  Widget build(BuildContext context) {
    final colores = Theme.of(context).colorScheme;
    final textos = Theme.of(context).textTheme;
    final hoy = DateTime.now();
    final lunes = hoy.subtract(Duration(days: hoy.weekday - 1));

    return SizedBox(
      height: 84,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: 6,
        separatorBuilder: (_, _) => const SizedBox(width: 10),
        itemBuilder: (context, i) {
          final idDia = i + 1;
          final fecha = lunes.add(Duration(days: i));
          final elegido = idDia == diaElegido;
          final esHoy = idDia == hoy.weekday;

          return InkWell(
            key: Key('dia-$idDia'),
            onTap: () => onElegir(idDia),
            borderRadius: BorderRadius.circular(14),
            child: Container(
              width: 62,
              decoration: BoxDecoration(
                color: elegido
                    ? colores.primary
                    : colores.surfaceContainerLowest,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: elegido ? colores.primary : colores.outlineVariant,
                ),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    SesionHorario.nombresDia[idDia]!.substring(0, 3).toUpperCase(),
                    style: textos.labelSmall?.copyWith(
                      color: elegido ? colores.onPrimary : colores.onSurfaceVariant,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${fecha.day}',
                    style: textos.titleMedium?.copyWith(
                      color: elegido ? colores.onPrimary : colores.onSurface,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  if (esHoy)
                    Text(
                      'Hoy',
                      style: textos.labelSmall?.copyWith(
                        fontSize: 9,
                        color: elegido ? colores.onPrimary : colores.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    )
                  else
                    Icon(
                      Icons.circle,
                      size: 5,
                      color: diasConClase.contains(idDia)
                          ? (elegido ? colores.onPrimary : colores.primary)
                          : Colors.transparent,
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _FiltroJornada extends StatelessWidget {
  final Jornada? elegida;
  final void Function(Jornada?) onElegir;

  const _FiltroJornada({required this.elegida, required this.onElegir});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          ChoiceChip(
            key: const Key('jornada-todas'),
            label: const Text('Todas'),
            selected: elegida == null,
            onSelected: (_) => onElegir(null),
          ),
          for (final jornada in Jornada.values) ...[
            const SizedBox(width: 8),
            ChoiceChip(
              key: Key('jornada-${jornada.name}'),
              label: Text(jornada.etiqueta),
              selected: elegida == jornada,
              onSelected: (_) => onElegir(jornada),
            ),
          ],
        ],
      ),
    );
  }
}

class _Contenido extends StatelessWidget {
  final EstadoHorario estado;
  final List<SesionHorario> sesiones;
  final String? error;
  final Usuario? usuario;
  final DateTime ahora;
  final bool hayEnOtroDia;
  final Future<void> Function() onReintentar;

  const _Contenido({
    required this.estado,
    required this.sesiones,
    required this.error,
    required this.usuario,
    required this.ahora,
    required this.hayEnOtroDia,
    required this.onReintentar,
  });

  @override
  Widget build(BuildContext context) {
    Widget caja(Widget hijo) => SliverToBoxAdapter(child: hijo);

    switch (estado) {
      case EstadoHorario.inicial:
      case EstadoHorario.cargando:
        return caja(const SkeletonHorarios());

      case EstadoHorario.sinRol:
        return caja(EstadoVacio(
          icono: Icons.person_off_outlined,
          titulo: 'Tu cuenta todavía no tiene un rol asignado',
          mensaje:
              'Sin rol de Aprendiz o Instructor no podemos saber qué horario '
              'mostrarte. Pídele a tu coordinación académica que lo asigne.',
          textoAccion: 'Reintentar',
          onAccion: onReintentar,
        ));

      case EstadoHorario.sinFicha:
        return caja(EstadoVacio(
          icono: Icons.link_off_rounded,
          titulo: 'Todavía no tienes una ficha vinculada',
          mensaje:
              'Vincula tu ficha desde "Mi horario" en la versión web de SIHS y '
              'vuelve aquí. Si no conoces tu código de ficha, pídeselo a tu '
              'coordinación académica.',
          textoAccion: 'Ya la vinculé, reintentar',
          onAccion: onReintentar,
        ));

      case EstadoHorario.error:
        return caja(EstadoVacio(
          icono: Icons.cloud_off_rounded,
          titulo: 'No se pudo cargar tu horario',
          mensaje: error ?? 'Inténtalo de nuevo en unos segundos.',
          textoAccion: 'Reintentar',
          onAccion: onReintentar,
        ));

      case EstadoHorario.vacio:
      case EstadoHorario.listo:
        if (sesiones.isEmpty) {
          return caja(EstadoVacio(
            icono: Icons.event_available_rounded,
            titulo: hayEnOtroDia
                ? 'Nada programado en este día'
                : 'No hay clases publicadas',
            mensaje: hayEnOtroDia
                ? 'Elige otro día de la semana para ver tus clases.'
                : (usuario?.esAprendiz == true
                    ? 'Tu ficha todavía no tiene horario publicado. Aparecerá '
                        'aquí en cuanto tu coordinación lo publique.'
                    : 'Todavía no tienes clases publicadas a tu nombre.'),
            textoAccion: hayEnOtroDia ? null : 'Actualizar',
            onAccion: hayEnOtroDia ? null : onReintentar,
          ));
        }

        final mostrarInstructor = usuario?.esInstructor != true;

        return SliverList.builder(
          itemCount: sesiones.length,
          itemBuilder: (context, i) => SesionCard(
            key: Key(sesiones[i].id),
            sesion: sesiones[i],
            estado: sesiones[i].estadoEn(ahora),
            mostrarInstructor: mostrarInstructor,
            onTap: () => mostrarDetalles(context, sesiones[i], mostrarInstructor),
          ),
        );
    }
  }
}
