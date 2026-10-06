import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sihs_mobile/models/aviso.dart';
import 'package:sihs_mobile/screens/avisos_screen.dart';
import 'package:sihs_mobile/services/api_client.dart';

import '../ayudas.dart';

void main() {
  setUpAll(usarFuentesDelSistema);

  Future<void> montar(WidgetTester tester, AvisosFalsos gateway) async {
    await tester.pumpWidget(envolver(Scaffold(body: AvisosScreen(gateway: gateway))));
    await tester.pumpAndSettle();
  }

  testWidgets('muestra los avisos con su categoría y a quién van dirigidos',
      (tester) async {
    await montar(tester, AvisosFalsos(avisos: [avisoDePrueba()]));

    expect(find.text('Cambio de ambiente'), findsOneWidget);
    expect(find.text('Reprogramación'), findsOneWidget);
    expect(find.text('Ficha 2758392'), findsOneWidget);
  });

  testWidgets('no muestra los avisos vencidos', (tester) async {
    final ayer = DateTime.now().subtract(const Duration(days: 1));
    await montar(
      tester,
      AvisosFalsos(avisos: [
        avisoDePrueba(idAviso: 1, titulo: 'Vigente'),
        avisoDePrueba(idAviso: 2, titulo: 'Vencido', vigenteHasta: ayer),
      ]),
    );

    expect(find.text('Vigente'), findsOneWidget);
    expect(find.text('Vencido'), findsNothing);
  });

  testWidgets('sin avisos explica qué va a aparecer ahí', (tester) async {
    await montar(tester, AvisosFalsos());

    expect(find.text('No hay avisos vigentes'), findsOneWidget);
  });

  testWidgets('las notificaciones van en su pestaña con el conteo de no leídas',
      (tester) async {
    await montar(
      tester,
      AvisosFalsos(notificaciones: [
        notificacionDePrueba(idNotificacion: 1, mensaje: 'Tu horario cambió'),
        notificacionDePrueba(idNotificacion: 2, mensaje: 'Solicitud aprobada', leida: true),
      ]),
    );

    expect(find.text('1'), findsOneWidget);

    await tester.tap(find.byKey(const Key('tab-notificaciones')));
    await tester.pumpAndSettle();

    expect(find.text('Tu horario cambió'), findsOneWidget);
    expect(find.text('Solicitud aprobada'), findsOneWidget);
  });

  testWidgets('si fallan los avisos, las notificaciones siguen disponibles',
      (tester) async {
    await montar(
      tester,
      AvisosFalsos(
        errorAvisos: ApiException('Servidor caído', statusCode: 500),
        notificaciones: [notificacionDePrueba(mensaje: 'Tu horario cambió')],
      ),
    );

    expect(find.text('Servidor caído'), findsOneWidget);
    expect(find.text('Reintentar'), findsOneWidget);

    await tester.tap(find.byKey(const Key('tab-notificaciones')));
    await tester.pumpAndSettle();

    expect(find.text('Tu horario cambió'), findsOneWidget);
  });

  testWidgets('es de solo lectura: no ofrece publicar ni marcar como leída',
      (tester) async {
    await montar(
      tester,
      AvisosFalsos(
        avisos: [avisoDePrueba()],
        notificaciones: [notificacionDePrueba()],
      ),
    );

    expect(find.byType(FloatingActionButton), findsNothing);
    expect(find.textContaining('Marcar'), findsNothing);
    expect(find.textContaining('Publicar aviso'), findsNothing);
  });

  test('Aviso.fromJson traduce la categoría y el alcance', () {
    final aviso = Aviso.fromJson({
      'idAviso': 3,
      'titulo': 'Simulacro',
      'cuerpo': 'El jueves hay simulacro de evacuación.',
      'categoria': 'sede',
      'fechaPublicacion': '2026-10-01T14:00:00Z',
      'vigenteHasta': '2026-10-10',
      'sedeNombre': 'Fontibón',
      'idUsuarioPublicador': '11111111-1111-1111-1111-111111111111',
    });

    expect(aviso.categoria, CategoriaAviso.sede);
    expect(aviso.alcance, 'Sede Fontibón');
    expect(aviso.vigenteHasta, DateTime(2026, 10, 10));
  });
}
