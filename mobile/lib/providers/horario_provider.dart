import 'package:flutter/material.dart';

import '../models/horario.dart';
import '../models/usuario.dart';
import '../services/horario_service.dart';

class HorarioProvider extends ChangeNotifier {
  final HorarioService _horarioService = HorarioService();

  List<Horario> _horarios = [];
  bool _isLoading = false;
  String? _error;

  List<Horario> get horarios => _horarios;
  bool get isLoading => _isLoading;
  String? get error => _error;

  Future<void> cargarHorarios(Usuario? usuario) async {
    if (usuario == null) {
      _horarios = [];
      notifyListeners();
      return;
    }

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      if (usuario.esAprendiz) {
        _horarios = await _horarioService.obtenerMiHorario();
      } else if (usuario.esInstructor) {
        _horarios = await _horarioService.obtenerHorariosInstructor();
      }
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = 'No se pudieron cargar los horarios';
      _isLoading = false;
      notifyListeners();
    }
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
