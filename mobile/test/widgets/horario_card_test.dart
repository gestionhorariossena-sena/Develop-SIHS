import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sihs_mobile/models/horario.dart';
import 'package:sihs_mobile/widgets/horario_card.dart';

import '../ayudas.dart';

void main() {
  setUpAll(usarFuentesDelSistema);

  testWidgets('muestra día, hora y los datos de la clase', (tester) async {
    final sesion = SesionHorario(horario: horarioDePrueba(), idDia: 1);

    await tester.pumpWidget(envolver(Scaffold(body: HorarioCard(sesion: sesion))));

    expect(find.text('Lunes'), findsOneWidget);
    expect(find.text('6:15 a. m. a 9:00 a. m.'), findsOneWidget);
    expect(find.text('Programar aplicaciones móviles'), findsOneWidget);
    expect(find.text('2758392'), findsOneWidget);
    expect(find.text('Ambiente 201'), findsOneWidget);
    expect(find.text('Carlos Ruiz'), findsOneWidget);
    expect(find.text('Publicado'), findsOneWidget);
  });

  testWidgets('oculta el instructor cuando quien mira es el instructor', (tester) async {
    final sesion = SesionHorario(horario: horarioDePrueba(), idDia: 2);

    await tester.pumpWidget(envolver(
      Scaffold(body: HorarioCard(sesion: sesion, mostrarInstructor: false)),
    ));

    expect(find.text('Martes'), findsOneWidget);
    expect(find.text('Carlos Ruiz'), findsNothing);
  });

  testWidgets('un borrador se distingue de una clase publicada', (tester) async {
    final sesion = SesionHorario(
      horario: horarioDePrueba(publicado: false),
      idDia: 1,
    );

    await tester.pumpWidget(envolver(Scaffold(body: HorarioCard(sesion: sesion))));

    expect(find.text('Borrador'), findsOneWidget);
  });

  testWidgets('al tocar la tarjeta se abre el detalle completo', (tester) async {
    final sesion = SesionHorario(horario: horarioDePrueba(), idDia: 1);

    await tester.pumpWidget(envolver(Scaffold(body: HorarioCard(sesion: sesion))));
    await tester.tap(find.byType(HorarioCard));
    await tester.pumpAndSettle();

    expect(find.text('Detalle de la clase'), findsOneWidget);
    expect(find.text('Cerrar'), findsOneWidget);
  });
}
