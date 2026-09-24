import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sihs_mobile/providers/auth_provider.dart';
import 'package:sihs_mobile/providers/horario_provider.dart';
import 'package:sihs_mobile/screens/home_screen.dart';
import 'package:sihs_mobile/services/api_client.dart';
import 'package:sihs_mobile/widgets/sesion_card.dart';

import '../ayudas.dart';

void main() {
  setUpAll(usarFuentesDelSistema);

  /// Monta el Home con el perfil ya cargado y el día lunes seleccionado:
  /// la pantalla arranca en el día de hoy, y un test que dependa del día en
  /// que se ejecuta falla solos los fines de semana.
  Future<HorariosFalsos> montar(
    WidgetTester tester, {
    required HorariosFalsos servicio,
    List<String> roles = const ['Aprendiz'],
    bool elegirLunes = true,
  }) async {
    final auth = AuthFalso(autenticado: true, perfil: usuarioDePrueba(roles: roles));
    addTearDown(auth.cerrar);
    final authProvider = AuthProvider(auth: auth);
    await authProvider.cargarPerfil();

    await tester.pumpWidget(envolver(
      const HomeScreen(),
      auth: authProvider,
      horarios: HorarioProvider(servicio: servicio),
    ));
    await tester.pumpAndSettle();

    if (elegirLunes) {
      await tester.tap(find.byKey(const Key('dia-1')));
      await tester.pumpAndSettle();
    }
    return servicio;
  }

  testWidgets('saluda por el primer nombre y muestra el rol', (tester) async {
    await montar(tester, servicio: HorariosFalsos(deFicha: [horarioDePrueba()]));

    expect(find.textContaining('Hola, Ana'), findsOneWidget);
    expect(find.text('Aprendiz'), findsOneWidget);
  });

  testWidgets('muestra las clases del día elegido y no las de otro día',
      (tester) async {
    await montar(
      tester,
      servicio: HorariosFalsos(deFicha: [
        horarioDePrueba(idHorario: 1, dias: const [1]),
        horarioDePrueba(idHorario: 2, dias: const [3], horaInicio: '14:00:00'),
      ]),
    );

    expect(find.byType(SesionCard), findsOneWidget);

    await tester.tap(find.byKey(const Key('dia-3')));
    await tester.pumpAndSettle();
    expect(find.byType(SesionCard), findsOneWidget);
    expect(find.textContaining('2:00 p. m.'), findsOneWidget);
  });

  testWidgets('el filtro de jornada deja solo las de esa franja', (tester) async {
    await montar(
      tester,
      servicio: HorariosFalsos(deFicha: [
        horarioDePrueba(idHorario: 1, dias: const [1], horaInicio: '07:00:00', horaFin: '09:00:00'),
        horarioDePrueba(idHorario: 2, dias: const [1], horaInicio: '14:00:00', horaFin: '16:00:00'),
      ]),
    );

    // La lista es perezosa (SliverList): se comprueba por contenido, no por
    // contar widgets construidos.
    expect(find.textContaining('7:00 a. m.'), findsOneWidget);

    await tester.tap(find.byKey(const Key('jornada-tarde')));
    await tester.pumpAndSettle();

    expect(find.byType(SesionCard), findsOneWidget);
    expect(find.textContaining('2:00 p. m.'), findsOneWidget);
    expect(find.textContaining('7:00 a. m.'), findsNothing);
  });

  testWidgets('sin clases publicadas explica por qué está vacío', (tester) async {
    await montar(tester, servicio: HorariosFalsos(deFicha: const []));

    expect(find.text('No hay clases publicadas'), findsOneWidget);
    expect(find.byType(SesionCard), findsNothing);
  });

  testWidgets('un aprendiz sin ficha recibe una instrucción, no un error',
      (tester) async {
    await montar(
      tester,
      elegirLunes: false,
      servicio: HorariosFalsos(
        error: ApiException('No tienes una ficha vinculada', statusCode: 404),
      ),
    );

    expect(find.text('Todavía no tienes una ficha vinculada'), findsOneWidget);
    expect(find.textContaining('versión web'), findsOneWidget);
  });

  testWidgets('un fallo del servidor ofrece reintentar', (tester) async {
    final servicio = await montar(
      tester,
      elegirLunes: false,
      servicio: HorariosFalsos(
        error: ApiException('El servidor tuvo un problema', statusCode: 500),
      ),
    );

    expect(find.text('No se pudo cargar tu horario'), findsOneWidget);

    await tester.ensureVisible(find.text('Reintentar'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Reintentar'));
    await tester.pumpAndSettle();

    expect(servicio.llamadas.where((l) => l == 'ficha').length, 2);
  });

  testWidgets('el botón de actualizar vuelve a pedir el horario', (tester) async {
    final servicio = await montar(
      tester,
      elegirLunes: false,
      servicio: HorariosFalsos(deFicha: [horarioDePrueba()]),
    );

    await tester.tap(find.byKey(const Key('boton-refrescar')));
    await tester.pumpAndSettle();

    expect(servicio.llamadas.where((l) => l == 'ficha').length, 2);
  });

  testWidgets('a un instructor se le piden SUS clases y no se repite su nombre',
      (tester) async {
    final servicio = await montar(
      tester,
      roles: const ['Instructor'],
      servicio: HorariosFalsos(deInstructor: [horarioDePrueba(dias: const [1])]),
    );

    expect(servicio.llamadas, ['instructor']);
    expect(find.text('Carlos Ruiz'), findsNothing);
  });

  testWidgets('el perfil muestra los datos y ofrece cerrar sesión', (tester) async {
    await montar(
      tester,
      elegirLunes: false,
      servicio: HorariosFalsos(deFicha: [horarioDePrueba()]),
    );

    await tester.tap(find.text('Perfil'));
    await tester.pumpAndSettle();

    expect(find.text('Ana María Gómez'), findsOneWidget);
    expect(find.text('ana@sena.edu.co'), findsOneWidget);

    await tester.tap(find.byKey(const Key('boton-cerrar-sesion')));
    await tester.pumpAndSettle();

    expect(find.text('¿Seguro que quieres salir de tu cuenta?'), findsOneWidget);
  });
}
