import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sihs_mobile/models/asistencia.dart';
import 'package:sihs_mobile/screens/asistencia_screen.dart';
import 'package:sihs_mobile/services/asistencia_service.dart';

import '../ayudas.dart';

/// Doble del gateway: la pantalla es de solo lectura, así que con devolver
/// datos alcanza — no hay nada que escribir.
class AsistenciaFalsa implements AsistenciaGateway {
  AsistenciaFalsa(this.respuesta);

  final MiAsistencia respuesta;
  int llamadas = 0;

  @override
  Future<MiAsistencia> obtenerMiAsistencia() async {
    llamadas++;
    return respuesta;
  }
}

MiAsistencia _datos({
  double porcentaje = 100,
  List<SesionAsistida>? sesiones,
  int ausente = 0,
}) {
  return MiAsistencia(
    resumen: ResumenAsistencia(
      registradas: sesiones?.length ?? 1,
      presente: 1,
      tardanza: 0,
      excusa: 0,
      ausente: ausente,
      porcentaje: porcentaje,
    ),
    sesiones: sesiones ??
        [
          SesionAsistida(
            idAsistencia: 1,
            fechaSesion: DateTime(2026, 9, 22),
            estado: EstadoAsistencia.presente,
            horaInicio: '11:00:00',
            horaFin: '13:00:00',
            resultadoDescripcion: 'Arquitectura de software',
            instructorNombre: 'Carlos Díaz',
            ambienteNombre: 'Laboratorio 302',
          ),
        ],
  );
}

void main() {
  setUpAll(usarFuentesDelSistema);

  testWidgets('muestra el porcentaje y la sesión registrada', (tester) async {
    await tester.pumpWidget(
      envolver(Scaffold(body: AsistenciaScreen(gateway: AsistenciaFalsa(_datos())))),
    );
    await tester.pumpAndSettle();

    expect(find.text('100%'), findsOneWidget);
    expect(find.text('Arquitectura de software'), findsOneWidget);
    expect(find.text('11:00 - 13:00'), findsOneWidget);
    expect(find.text('Presente'), findsWidgets);
  });

  // Es de solo lectura por partida doble: el móvil lo es por arquitectura,
  // y la asistencia la certifica el instructor.
  testWidgets('no ofrece ningún control para marcar ni justificar', (tester) async {
    await tester.pumpWidget(
      envolver(Scaffold(body: AsistenciaScreen(gateway: AsistenciaFalsa(_datos())))),
    );
    await tester.pumpAndSettle();

    expect(find.byType(TextField), findsNothing);
    expect(find.widgetWithText(FilledButton, 'Guardar'), findsNothing);
    expect(find.textContaining('Justificar'), findsNothing);
  });

  testWidgets('bajo el 85% avisa del umbral del reglamento', (tester) async {
    await tester.pumpWidget(
      envolver(Scaffold(
        body: AsistenciaScreen(gateway: AsistenciaFalsa(_datos(porcentaje: 70, ausente: 3))),
      )),
    );
    await tester.pumpAndSettle();

    expect(find.textContaining('por debajo del 85%'), findsOneWidget);
  });

  testWidgets('con buena asistencia no muestra la advertencia', (tester) async {
    await tester.pumpWidget(
      envolver(Scaffold(body: AsistenciaScreen(gateway: AsistenciaFalsa(_datos())))),
    );
    await tester.pumpAndSettle();

    expect(find.textContaining('por debajo del'), findsNothing);
  });

  testWidgets('sin registros explica cuándo va a aparecer', (tester) async {
    const vacia = MiAsistencia(
      resumen: ResumenAsistencia(
        registradas: 0, presente: 0, tardanza: 0, excusa: 0, ausente: 0, porcentaje: 100,
      ),
      sesiones: [],
    );

    await tester.pumpWidget(
      envolver(Scaffold(body: AsistenciaScreen(gateway: AsistenciaFalsa(vacia)))),
    );
    await tester.pumpAndSettle();

    expect(find.text('Todavía no hay asistencia registrada'), findsOneWidget);
  });
}
