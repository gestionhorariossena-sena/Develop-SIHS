import 'package:flutter_test/flutter_test.dart';
import 'package:sihs_mobile/providers/horario_provider.dart';
import 'package:sihs_mobile/services/api_client.dart';

import '../ayudas.dart';

void main() {
  test('un aprendiz pide el horario de SU ficha', () async {
    final servicio = HorariosFalsos(deFicha: [horarioDePrueba()]);
    final provider = HorarioProvider(servicio: servicio);

    await provider.cargar(usuarioDePrueba(roles: const ['Aprendiz']));

    // Pide también la ficha: alimenta el encabezado del diseño.
    expect(servicio.llamadas, containsAll(['ficha', 'mi-ficha']));
    expect(provider.estado, EstadoHorario.listo);
    expect(provider.sesiones.length, 1);
  });

  test('un instructor pide SUS clases', () async {
    final servicio = HorariosFalsos(deInstructor: [horarioDePrueba()]);
    final provider = HorarioProvider(servicio: servicio);

    await provider.cargar(usuarioDePrueba(roles: const ['Instructor']));

    expect(servicio.llamadas, ['instructor']);
    expect(provider.estado, EstadoHorario.listo);
  });

  test('los borradores no se muestran: no son horario para quien lo cursa', () async {
    final servicio = HorariosFalsos(deFicha: [
      horarioDePrueba(idHorario: 1, publicado: false),
      horarioDePrueba(idHorario: 2, activo: false),
    ]);
    final provider = HorarioProvider(servicio: servicio);

    await provider.cargar(usuarioDePrueba());

    expect(provider.sesiones, isEmpty);
    expect(provider.estado, EstadoHorario.vacio);
  });

  test('un aprendiz sin ficha vinculada no es un error, es otro estado', () async {
    // El backend responde 404 "No tienes una ficha vinculada".
    final servicio = HorariosFalsos(
      error: ApiException('No tienes una ficha vinculada', statusCode: 404),
    );
    final provider = HorarioProvider(servicio: servicio);

    await provider.cargar(usuarioDePrueba(roles: const ['Aprendiz']));

    expect(provider.estado, EstadoHorario.sinFicha);
    expect(provider.error, isNull);
  });

  test('un fallo del servidor conserva el mensaje que escribió el backend', () async {
    final servicio = HorariosFalsos(
      error: ApiException('No autorizado', statusCode: 403),
    );
    final provider = HorarioProvider(servicio: servicio);

    await provider.cargar(usuarioDePrueba());

    expect(provider.estado, EstadoHorario.error);
    expect(provider.error, 'No autorizado');
  });

  test('sin usuario no se pide nada', () async {
    final servicio = HorariosFalsos();
    final provider = HorarioProvider(servicio: servicio);

    await provider.cargar(null);

    expect(servicio.llamadas, isEmpty);
    expect(provider.estado, EstadoHorario.inicial);
  });

  test('las sesiones llegan ordenadas como una agenda', () async {
    final servicio = HorariosFalsos(deInstructor: [
      horarioDePrueba(idHorario: 1, dias: const [3], horaInicio: '15:00:00'),
      horarioDePrueba(idHorario: 2, dias: const [1, 3], horaInicio: '06:15:00'),
    ]);
    final provider = HorarioProvider(servicio: servicio);

    await provider.cargar(usuarioDePrueba(roles: const ['Instructor']));

    expect(
      provider.sesiones.map((s) => '${s.diaTexto} ${s.horaInicioTexto}'),
      ['Lunes 6:15 a. m.', 'Miércoles 6:15 a. m.', 'Miércoles 3:00 p. m.'],
    );
  });

  test('una cuenta sin rol no golpea un endpoint que le dará 403', () async {
    final servicio = HorariosFalsos();
    final provider = HorarioProvider(servicio: servicio);

    await provider.cargar(usuarioDePrueba(roles: const []));

    expect(servicio.llamadas, isEmpty);
    expect(provider.estado, EstadoHorario.sinRol);
  });
}
