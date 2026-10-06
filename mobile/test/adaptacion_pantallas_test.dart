import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sihs_mobile/models/asistencia.dart';
import 'package:sihs_mobile/providers/auth_provider.dart';
import 'package:sihs_mobile/providers/horario_provider.dart';
import 'package:sihs_mobile/screens/asistencia_instructor_screen.dart';
import 'package:sihs_mobile/screens/asistencia_screen.dart';
import 'package:sihs_mobile/screens/avisos_screen.dart';
import 'package:sihs_mobile/screens/home_screen.dart';
import 'package:sihs_mobile/screens/login_screen.dart';
import 'package:sihs_mobile/screens/recuperar_password_screen.dart';
import 'package:sihs_mobile/services/asistencia_service.dart';

import 'ayudas.dart';

/// T-32 / T-33: cada flujo principal se monta en los tamaños de pantalla
/// que de verdad usan aprendices e instructores, con la letra normal y
/// agrandada al 130 % (accesibilidad del sistema). Falla si cualquier
/// pantalla desborda ("RenderFlex overflowed") o lanza un error de
/// Flutter.
///
/// Ojo: la fuente de `flutter test` dibuja cada letra como un cuadrado
/// del ancho de su tamaño, más ancha que Hanken o Geist. Si algo cabe
/// acá, sobra espacio en un teléfono real.
const _tamanos = {
  'teléfono pequeño 320x568': Size(320, 568),
  'teléfono 360x740': Size(360, 740),
  'teléfono horizontal 740x360': Size(740, 360),
  'tablet vertical 800x1280': Size(800, 1280),
  'tablet horizontal 1280x800': Size(1280, 800),
};

class _AsistenciaDePrueba implements AsistenciaGateway {
  @override
  Future<MiAsistencia> obtenerMiAsistencia() async => MiAsistencia(
        resumen: const ResumenAsistencia(
          registradas: 1,
          presente: 0,
          tardanza: 1,
          excusa: 0,
          ausente: 0,
          porcentaje: 80,
        ),
        sesiones: [
          SesionAsistida(
            idAsistencia: 1,
            fechaSesion: DateTime(2026, 9, 22),
            estado: EstadoAsistencia.tardanza,
            horaInicio: '11:00:00',
            horaFin: '13:00:00',
            resultadoDescripcion:
                'Implementar la arquitectura de software de acuerdo con el diseño',
            instructorNombre: 'Carlos Alberto Díaz Rodríguez',
            ambienteNombre: 'Laboratorio de software 302',
          ),
        ],
      );

  @override
  Future<SesionAsistencia> obtenerSesion({
    required int idHorario,
    required DateTime fecha,
  }) async =>
      SesionAsistencia(
        idHorario: idHorario,
        fechaSesion: fecha,
        horaInicio: '06:15:00',
        horaFin: '09:00:00',
        fichaCodigo: '2758392',
        resultadoDescripcion:
            'Implementar la arquitectura de software de acuerdo con el diseño',
        ambienteNombre: 'Laboratorio de software 302',
        aprendices: const [
          AprendizDeSesion(
            idUsuario: 'a',
            nombre: 'María Fernanda López Castañeda',
            rolEnFicha: 'vocero',
            numeroDocumento: '1012345678',
          ),
        ],
      );
}

void main() {
  setUpAll(usarFuentesDelSistema);

  /// Ajusta la pantalla y junta los errores de Flutter en vez de dejar
  /// que el primero corte el test: así el fallo lista todo lo que se rompió.
  List<String> prepararPantalla(WidgetTester tester, Size tamano, double escala) {
    tester.view.physicalSize = tamano;
    tester.view.devicePixelRatio = 1;
    tester.platformDispatcher.textScaleFactorTestValue = escala;
    addTearDown(tester.view.reset);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

    final errores = <String>[];
    final anterior = FlutterError.onError;
    FlutterError.onError = (detalle) =>
        errores.add(detalle.exceptionAsString().split('\n').first);
    addTearDown(() => FlutterError.onError = anterior);
    return errores;
  }

  Future<(AuthProvider, HorarioProvider)> providers(String rol) async {
    final auth = AuthFalso(
      autenticado: true,
      perfil: usuarioDePrueba(roles: [rol], nombre: 'Ana María Gómez Restrepo'),
    );
    addTearDown(auth.cerrar);
    final authProvider = AuthProvider(auth: auth);
    await authProvider.cargarPerfil();

    final hoy = DateTime.now().weekday;
    final horarios = HorarioProvider(
      servicio: HorariosFalsos(
        deFicha: [horarioDePrueba(dias: [1, 2, 3, 4, 5, 6])],
        deInstructor: [horarioDePrueba(dias: [1, 2, 3, 4, 5, 6, hoy])],
      ),
    );
    return (authProvider, horarios);
  }

  for (final escala in [1.0, 1.3]) {
    for (final MapEntry(key: nombre, value: tamano) in _tamanos.entries) {
      group('$nombre, letra al ${(escala * 100).round()} %', () {
        testWidgets('login y recuperación de contraseña', (tester) async {
          final errores = prepararPantalla(tester, tamano, escala);

          await tester.pumpWidget(envolver(const LoginScreen()));
          await tester.pumpAndSettle();
          await tester.pumpWidget(envolver(const RecuperarPasswordScreen()));
          await tester.pumpAndSettle();

          expect(errores, isEmpty);
        });

        for (final rol in ['Aprendiz', 'Instructor']) {
          testWidgets('$rol: horario, asistencia, avisos y perfil', (tester) async {
            final errores = prepararPantalla(tester, tamano, escala);
            final (auth, horarios) = await providers(rol);

            await tester.pumpWidget(
              envolver(const HomeScreen(), auth: auth, horarios: horarios),
            );
            await tester.pumpAndSettle();

            // Riel lateral desde 600 px de ancho; barra inferior por debajo.
            final conRiel = tamano.width >= anchoParaRiel;
            expect(find.byKey(const Key('riel-navegacion')),
                conRiel ? findsOneWidget : findsNothing);
            expect(find.byKey(const Key('barra-navegacion')),
                conRiel ? findsNothing : findsOneWidget);

            await tester.tap(find.text('Perfil'));
            await tester.pumpAndSettle();
            expect(find.byKey(const Key('boton-cerrar-sesion')), findsOneWidget);

            await tester.pumpWidget(envolver(
              Scaffold(
                body: rol == 'Aprendiz'
                    ? AsistenciaScreen(gateway: _AsistenciaDePrueba())
                    : AsistenciaInstructorScreen(gateway: _AsistenciaDePrueba()),
              ),
              auth: auth,
              horarios: horarios,
            ));
            await tester.pumpAndSettle();

            await tester.pumpWidget(envolver(
              Scaffold(
                body: AvisosScreen(
                  gateway: AvisosFalsos(
                    avisos: [avisoDePrueba()],
                    notificaciones: [notificacionDePrueba()],
                  ),
                ),
              ),
            ));
            await tester.pumpAndSettle();
            await tester.tap(find.byKey(const Key('tab-notificaciones')));
            await tester.pumpAndSettle();

            expect(errores, isEmpty);
          });
        }
      });
    }
  }
}
