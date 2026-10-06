import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sihs_mobile/models/asistencia.dart';
import 'package:sihs_mobile/providers/horario_provider.dart';
import 'package:sihs_mobile/screens/asistencia_instructor_screen.dart';
import 'package:sihs_mobile/services/api_client.dart';
import 'package:sihs_mobile/services/asistencia_service.dart';

import '../ayudas.dart';

/// Doble del gateway por el lado del instructor. Guarda lo que se pidió:
/// que la fecha consultada sea la correcta es parte de lo que importa.
class SesionesFalsas implements AsistenciaGateway {
  SesionesFalsas({this.respuesta, this.error});

  SesionAsistencia? respuesta;
  Object? error;
  final List<String> pedidos = [];
  final List<Map<String, EstadoAsistencia>> registros = [];

  @override
  Future<MiAsistencia> obtenerMiAsistencia() async =>
      throw UnimplementedError('la pantalla del instructor no pide /mias');

  @override
  Future<SesionAsistencia> obtenerSesion({
    required int idHorario,
    required DateTime fecha,
  }) async {
    pedidos.add('$idHorario@${AsistenciaService.soloFecha(fecha)}');
    if (error != null) throw error!;
    return respuesta ?? _sesion();
  }

  @override
  Future<void> registrarSesion({
    required int idHorario,
    required DateTime fecha,
    required Map<String, EstadoAsistencia> marcas,
    Map<String, String?> referenciasExcusa = const {},
  }) async {
    if (error != null) throw error!;
    registros.add(Map<String, EstadoAsistencia>.from(marcas));
  }
}

/// El día de la semana de hoy: la pantalla arranca en hoy, así que el
/// horario de prueba tiene que caer hoy o no habría clase que mostrar —
/// y un test atado a un día fijo falla según cuándo se corra.
int get _hoyEnLaSemana => DateTime.now().weekday;

DateTime get _hoy {
  final ahora = DateTime.now();
  return DateTime(ahora.year, ahora.month, ahora.day);
}

SesionAsistencia _sesion({
  List<AprendizDeSesion>? aprendices,
  DateTime? registradaEn,
  String? registradaPor,
}) {
  return SesionAsistencia(
    idHorario: 1,
    fechaSesion: _hoy,
    fichaCodigo: '2758392',
    resultadoDescripcion: 'Programar aplicaciones móviles',
    ambienteNombre: 'Ambiente 201',
    horaInicio: '06:15:00',
    horaFin: '09:00:00',
    registradaEn: registradaEn,
    registradaPor: registradaPor,
    aprendices: aprendices ??
        const [
          AprendizDeSesion(
            idUsuario: 'a1',
            nombre: 'Laura Peña',
            numeroDocumento: '1002003001',
          ),
        ],
  );
}

/// Monta la pantalla con el horario del instructor ya cargado.
Future<HorarioProvider> montar(
  WidgetTester tester, {
  required AsistenciaGateway gateway,
  List<int>? dias,
  int idHorario = 1,
}) async {
  final horarios = HorarioProvider(
    servicio: HorariosFalsos(
      deInstructor: [horarioDePrueba(idHorario: idHorario, dias: dias ?? [_hoyEnLaSemana])],
    ),
  );
  await horarios.cargar(usuarioDePrueba(roles: const ['Instructor']));

  await tester.pumpWidget(envolver(
    Scaffold(body: AsistenciaInstructorScreen(gateway: gateway)),
    horarios: horarios,
  ));
  await tester.pumpAndSettle();
  return horarios;
}

void main() {
  setUpAll(usarFuentesDelSistema);

  testWidgets('pide la lista de la clase de hoy y la muestra', (tester) async {
    final gateway = SesionesFalsas(
      respuesta: _sesion(
        registradaEn: _hoy,
        registradaPor: 'Carlos Ruiz',
        aprendices: const [
          AprendizDeSesion(
            idUsuario: 'a1',
            nombre: 'Laura Peña',
            estado: EstadoAsistencia.presente,
          ),
          AprendizDeSesion(
            idUsuario: 'a2',
            nombre: 'Juan Gómez',
            estado: EstadoAsistencia.ausente,
          ),
        ],
      ),
    );
    await montar(tester, gateway: gateway);

    expect(gateway.pedidos, ['1@${AsistenciaService.soloFecha(_hoy)}']);
    expect(find.text('2758392'), findsOneWidget);
    expect(find.text('Lista registrada'), findsOneWidget);
    expect(find.text('Presente: 1'), findsOneWidget);
    expect(find.text('Ausente: 1'), findsOneWidget);
  });

  testWidgets('una clase sin lista se marca como sin registrar, no como faltas',
      (tester) async {
    await montar(tester, gateway: SesionesFalsas(respuesta: _sesion()));

    expect(find.text('Sin registrar'), findsOneWidget);
    expect(find.textContaining('nadie ha pasado lista'), findsOneWidget);
    expect(find.text('Ausente: 1'), findsNothing);
  });

  testWidgets('deja claro que desde el móvil se puede iniciar la lista', (tester) async {
    await montar(tester, gateway: SesionesFalsas());

    expect(find.textContaining('iniciar o corregir la lista'), findsOneWidget);
  });

  testWidgets('al tocar la clase se abre la nómina con cada aprendiz',
      (tester) async {
    final gateway = SesionesFalsas(
      respuesta: _sesion(
        registradaEn: _hoy,
        registradaPor: 'Carlos Ruiz',
        aprendices: const [
          AprendizDeSesion(
            idUsuario: 'a1',
            nombre: 'Laura Peña',
            estado: EstadoAsistencia.tardanza,
          ),
          AprendizDeSesion(idUsuario: 'a2', nombre: 'Juan Gómez'),
        ],
      ),
    );
    await montar(tester, gateway: gateway);

    await tester.tap(find.byKey(const Key('clase-1')));
    await tester.pumpAndSettle();

    expect(find.text('Laura Peña'), findsOneWidget);
    expect(find.text('Tarde'), findsOneWidget);
    expect(find.text('Juan Gómez'), findsOneWidget);
    expect(find.byKey(const Key('guardar-asistencia')), findsOneWidget);
    expect(find.textContaining('Lista registrada por Carlos Ruiz'), findsOneWidget);
  });

  testWidgets('puede marcar y guardar asistencia desde el móvil', (tester) async {
    final gateway = SesionesFalsas(
      respuesta: _sesion(
        aprendices: const [
          AprendizDeSesion(idUsuario: 'a1', nombre: 'Laura Peña'),
          AprendizDeSesion(idUsuario: 'a2', nombre: 'Juan Gómez'),
        ],
      ),
    );
    await montar(tester, gateway: gateway);

    await tester.tap(find.byKey(const Key('clase-1')));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('marcar-todos-presentes')));
    await tester.pump();
    await tester.tap(find.byKey(const Key('guardar-asistencia')));
    await tester.pumpAndSettle();

    expect(gateway.registros, hasLength(1));
    expect(gateway.registros.single['a1'], EstadoAsistencia.presente);
    expect(gateway.registros.single['a2'], EstadoAsistencia.presente);
  });

  testWidgets('no ofrece avanzar a mañana, y sí retroceder', (tester) async {
    final gateway = SesionesFalsas();
    await montar(tester, gateway: gateway);

    final siguiente = tester.widget<IconButton>(find.byKey(const Key('fecha-siguiente')));
    expect(siguiente.onPressed, isNull);

    await tester.tap(find.byKey(const Key('fecha-anterior')));
    await tester.pumpAndSettle();

    // Ayer es otro día de la semana: ya no hay clase que pedir, y aparece
    // el atajo para volver.
    expect(find.byKey(const Key('volver-a-hoy')), findsOneWidget);
    // El copy del vacío cambia si ayer fue domingo, así que se afirma
    // sobre la línea que sale en los dos casos.
    expect(find.textContaining('Solo aparecen acá las clases publicadas'), findsOneWidget);
  });

  testWidgets('si el backend falla lo dice en la clase afectada', (tester) async {
    await montar(
      tester,
      gateway: SesionesFalsas(error: ApiException('Esa clase no existe o no es tuya')),
    );

    expect(find.text('Sin cargar'), findsOneWidget);
    expect(find.text('Esa clase no existe o no es tuya'), findsOneWidget);
  });
}
