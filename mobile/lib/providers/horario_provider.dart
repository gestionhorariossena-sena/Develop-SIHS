import 'dart:async';

import 'package:flutter/foundation.dart';

import '../models/ficha.dart';
import '../models/horario.dart';
import '../models/usuario.dart';
import '../services/api_client.dart';
import '../services/horario_service.dart';

/// Estado de la pantalla de horario. `sinFicha` no es un error: es un
/// aprendiz recién registrado que todavía no vinculó su ficha, y lo que
/// necesita ver no es "algo salió mal" sino qué hacer al respecto.
enum EstadoHorario { inicial, cargando, listo, vacio, sinFicha, sinRol, error }

class HorarioProvider extends ChangeNotifier {
  final HorarioGateway _horarios;

  HorarioProvider({HorarioGateway? servicio})
      : _horarios = servicio ?? HorarioService();

  List<SesionHorario> _sesiones = const [];
  Ficha? _ficha;
  EstadoHorario _estado = EstadoHorario.inicial;
  String? _error;

  List<SesionHorario> get sesiones => _sesiones;

  /// Ficha del aprendiz. Null para instructor o si el endpoint falló: es
  /// decoración del encabezado, nunca motivo para dejar sin horario.
  Ficha? get ficha => _ficha;
  EstadoHorario get estado => _estado;
  String? get error => _error;
  bool get isLoading => _estado == EstadoHorario.cargando;

  Future<void> cargar(Usuario? usuario) async {
    if (usuario == null) {
      _sesiones = const [];
      _estado = EstadoHorario.inicial;
      notifyListeners();
      return;
    }

    // Una cuenta sin ningún rol existe en `usuarios` pero no le sirve a
    // nadie: cualquier endpoint le responde 403 "No autorizado", un
    // mensaje que manda a revisar la contraseña cuando lo que falta es que
    // alguien le asigne el rol. Reproducido el 2026-09-24 con una cuenta
    // real de database/02_datos_prueba.sql (ver H-13 en
    // backend/scripts/crear_cuentas_prueba.py).
    if (usuario.roles.isEmpty) {
      _sesiones = const [];
      _estado = EstadoHorario.sinRol;
      notifyListeners();
      return;
    }

    _estado = EstadoHorario.cargando;
    _error = null;
    notifyListeners();

    try {
      if (usuario.esAprendiz) {
        // Aparte del horario y sin await bloqueante: que la ficha falle no
        // puede costarle al aprendiz ver sus clases.
        unawaited(_cargarFicha());
      }

      final horarios = await _pedirSegunRol(usuario);
      // Un borrador no es horario para quien lo cursa. El endpoint del
      // instructor ya filtra publicados en el backend; el de la ficha
      // devuelve todo, así que el filtro va acá también — mismo criterio
      // que MiHorarioAprendiz.tsx en la web.
      final publicados = horarios.where((h) => h.publicado && h.activo).toList();

      _sesiones = SesionHorario.desdeHorarios(publicados);
      _estado = _sesiones.isEmpty ? EstadoHorario.vacio : EstadoHorario.listo;
    } on ApiException catch (e) {
      if (e.esNoEncontrado && usuario.esAprendiz) {
        _sesiones = const [];
        _estado = EstadoHorario.sinFicha;
      } else {
        _error = e.mensaje;
        _estado = EstadoHorario.error;
      }
    } catch (e) {
      _error = 'No se pudo cargar tu horario. Inténtalo de nuevo.';
      _estado = EstadoHorario.error;
    }
    notifyListeners();
  }

  /// Aprendiz primero: alguien con los dos roles (un instructor que además
  /// estudia) ve el horario de su ficha, que es el caso de uso de la app.
  /// Coordinadores y administradores no tienen pantalla propia acá — el
  /// móvil es de consulta, la programación se hace en la web.
  Future<List<Horario>> _pedirSegunRol(Usuario usuario) {
    if (usuario.esAprendiz) return _horarios.obtenerHorarioDeMiFicha();
    if (usuario.esInstructor) return _horarios.obtenerMisHorariosComoInstructor();
    // Sirve igual para coordinador/admin: son instructores a ojos de este
    // endpoint (devuelve las clases donde figuran como instructor, que
    // normalmente serán ninguna -> estado vacío).
    return _horarios.obtenerMisHorariosComoInstructor();
  }

  Future<void> _cargarFicha() async {
    try {
      _ficha = await _horarios.obtenerMiFicha();
      notifyListeners();
    } catch (_) {
      _ficha = null;
    }
  }

  void limpiar() {
    _sesiones = const [];
    _ficha = null;
    _estado = EstadoHorario.inicial;
    _error = null;
    notifyListeners();
  }
}
