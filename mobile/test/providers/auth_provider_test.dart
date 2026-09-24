import 'package:flutter_test/flutter_test.dart';
import 'package:sihs_mobile/providers/auth_provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../ayudas.dart';

void main() {
  test('al entrar no se inventa un perfil: los roles los trae el backend', () async {
    final auth = AuthFalso(perfil: usuarioDePrueba());
    addTearDown(auth.cerrar);
    final provider = AuthProvider(auth: auth);

    final entro = await provider.signIn('  ana@sena.edu.co ', 'secreta');

    expect(entro, isTrue);
    // El email se manda sin espacios: un teclado móvil los agrega solo y
    // Supabase los toma como parte del correo.
    expect(auth.credencialesRecibidas, ['ana@sena.edu.co', 'secreta']);
    expect(provider.usuarioActual, isNull);

    await provider.cargarPerfil();
    expect(provider.usuarioActual?.esAprendiz, isTrue);
  });

  test('traduce el error en inglés de Supabase', () async {
    final auth = AuthFalso()..errorAlEntrar = const AuthException('Invalid login credentials');
    addTearDown(auth.cerrar);
    final provider = AuthProvider(auth: auth);

    final entro = await provider.signIn('ana@sena.edu.co', 'mala');

    expect(entro, isFalse);
    expect(provider.error, 'Correo o contraseña incorrectos.');
  });

  test('un fallo de red no se muestra como credenciales incorrectas', () async {
    final auth = AuthFalso()..errorAlEntrar = Exception('socket');
    addTearDown(auth.cerrar);
    final provider = AuthProvider(auth: auth);

    await provider.signIn('ana@sena.edu.co', 'secreta');

    expect(provider.error, contains('conexión'));
  });

  test('cerrar sesión limpia el perfil', () async {
    final auth = AuthFalso(autenticado: true, perfil: usuarioDePrueba());
    addTearDown(auth.cerrar);
    final provider = AuthProvider(auth: auth);
    await provider.cargarPerfil();

    await provider.signOut();

    expect(auth.cerroSesion, isTrue);
    expect(provider.usuarioActual, isNull);
    expect(provider.isAuthenticated, isFalse);
  });
}
