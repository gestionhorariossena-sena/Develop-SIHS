import 'package:flutter_test/flutter_test.dart';
import 'package:sihs_mobile/models/horario.dart';
import 'package:sihs_mobile/models/usuario.dart';

void main() {
  group('Horario.fromJson', () {
    test('lee la forma real de HorarioResponse del backend', () {
      // Copiado de la respuesta de GET /usuarios/me/horarios: ids planos,
      // `dias` como lista y los nombres ya resueltos por el servidor.
      final horario = Horario.fromJson({
        'idHorario': 42,
        'horaInicio': '06:15:00',
        'horaFin': '09:00:00',
        'idJornada': 1,
        'idTrimestre': 3,
        'idAmbiente': 7,
        'idInstructor': 'e2b1c3d4-0000-4000-8000-000000000001',
        'idFicha': 12,
        'idResultado': 88,
        'dias': [1, 3],
        'fechaCreacion': '2026-09-01T10:00:00',
        'fechaModificacion': '2026-09-01T10:00:00',
        'activo': true,
        'publicado': true,
        'instructorNombre': 'Carlos Ruiz',
        'fichaCodigo': '2758392',
        'ambienteNombre': 'Ambiente 201',
        'resultadoCodigo': 'RA-01',
        'resultadoDescripcion': 'Programar aplicaciones móviles',
      });

      expect(horario.idHorario, 42);
      expect(horario.dias, [1, 3]);
      expect(horario.idInstructor, 'e2b1c3d4-0000-4000-8000-000000000001');
      expect(horario.fichaTexto, '2758392');
      expect(horario.ambienteTexto, 'Ambiente 201');
      expect(horario.temaTexto, 'Programar aplicaciones móviles');
    });

    test('los campos que el backend puede dejar nulos tienen texto legible', () {
      final horario = Horario.fromJson({
        'idHorario': 1,
        'horaInicio': '13:00:00',
        'horaFin': '15:00:00',
        'dias': <int>[],
      });

      expect(horario.instructorTexto, 'Instructor por asignar');
      expect(horario.ambienteTexto, 'Ambiente por asignar');
      expect(horario.temaTexto, 'Sin resultado de aprendizaje');
    });
  });

  group('SesionHorario', () {
    test('una clase de tres días se abre en tres bloques', () {
      final horario = Horario(
        idHorario: 1,
        horaInicio: '07:00:00',
        horaFin: '09:00:00',
        dias: const [1, 2, 3],
      );

      expect(horario.sesiones.length, 3);
      expect(horario.sesiones.map((s) => s.diaTexto),
          ['Lunes', 'Martes', 'Miércoles']);
    });

    test('formatea la hora en 12 horas', () {
      expect(SesionHorario.formatoHora12('06:15:00'), '6:15 a. m.');
      expect(SesionHorario.formatoHora12('13:30:00'), '1:30 p. m.');
      expect(SesionHorario.formatoHora12('00:05:00'), '12:05 a. m.');
      expect(SesionHorario.formatoHora12('12:00:00'), '12:00 p. m.');
    });

    test('deja la hora intacta si no tiene el formato esperado', () {
      expect(SesionHorario.formatoHora12('sin-hora'), 'sin-hora');
    });

    test('ordena por día y, dentro del día, por hora de inicio', () {
      final sesiones = SesionHorario.desdeHorarios([
        Horario(idHorario: 1, horaInicio: '15:00:00', horaFin: '17:00:00', dias: const [2]),
        Horario(idHorario: 2, horaInicio: '06:15:00', horaFin: '09:00:00', dias: const [2]),
        Horario(idHorario: 3, horaInicio: '10:00:00', horaFin: '12:00:00', dias: const [1]),
      ]);

      expect(
        sesiones.map((s) => '${s.diaTexto} ${s.horaInicioTexto}'),
        ['Lunes 10:00 a. m.', 'Martes 6:15 a. m.', 'Martes 3:00 p. m.'],
      );
    });
  });

  group('Usuario', () {
    test('resuelve los roles que vienen de /usuarios/me', () {
      final usuario = Usuario.fromJson({
        'idUsuario': 'abc',
        'nombre': 'Ana María Gómez',
        'email': 'ana@sena.edu.co',
        'estado': 'activo',
        'roles': [
          {'idRol': 4, 'nombre': 'Aprendiz'},
        ],
      });

      expect(usuario.esAprendiz, isTrue);
      expect(usuario.esInstructor, isFalse);
      expect(usuario.rolPrincipal, 'Aprendiz');
      expect(usuario.primerNombre, 'Ana');
    });

    test('con varios roles, manda el que decide qué horario se ve', () {
      final usuario = Usuario.fromJson({
        'idUsuario': 'abc',
        'nombre': 'Luis Pérez',
        'email': 'luis@sena.edu.co',
        'roles': [
          {'idRol': 2, 'nombre': 'Coordinador'},
          {'idRol': 3, 'nombre': 'Instructor'},
        ],
      });

      expect(usuario.rolPrincipal, 'Instructor');
    });
  });
}
