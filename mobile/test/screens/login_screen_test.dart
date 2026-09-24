import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sihs_mobile/providers/auth_provider.dart';
import 'package:sihs_mobile/screens/login_screen.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../ayudas.dart';

void main() {
  setUpAll(usarFuentesDelSistema);

  testWidgets('no manda nada al servidor si el formulario está vacío', (tester) async {
    final auth = AuthFalso();
    addTearDown(auth.cerrar);

    await tester.pumpWidget(
      envolver(const LoginScreen(), auth: AuthProvider(auth: auth)),
    );
    await tester.ensureVisible(find.byKey(const Key('boton-iniciar-sesion')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('boton-iniciar-sesion')));
    await tester.pump();

    expect(find.text('Escribe tu correo institucional.'), findsOneWidget);
    expect(find.text('Escribe tu contraseña.'), findsOneWidget);
    expect(auth.credencialesRecibidas, isEmpty);
  });

  testWidgets('rechaza un correo con forma inválida', (tester) async {
    final auth = AuthFalso();
    addTearDown(auth.cerrar);

    await tester.pumpWidget(
      envolver(const LoginScreen(), auth: AuthProvider(auth: auth)),
    );
    await tester.enterText(find.byKey(const Key('campo-email')), 'ana');
    await tester.enterText(find.byKey(const Key('campo-password')), 'secreta');
    await tester.ensureVisible(find.byKey(const Key('boton-iniciar-sesion')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('boton-iniciar-sesion')));
    await tester.pump();

    expect(find.text('Ese correo no parece válido.'), findsOneWidget);
    expect(auth.credencialesRecibidas, isEmpty);
  });

  testWidgets('con datos válidos entra', (tester) async {
    final auth = AuthFalso(perfil: usuarioDePrueba());
    addTearDown(auth.cerrar);

    await tester.pumpWidget(
      envolver(const LoginScreen(), auth: AuthProvider(auth: auth)),
    );
    await tester.enterText(find.byKey(const Key('campo-email')), 'ana@sena.edu.co');
    await tester.enterText(find.byKey(const Key('campo-password')), 'secreta');
    await tester.ensureVisible(find.byKey(const Key('boton-iniciar-sesion')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('boton-iniciar-sesion')));
    await tester.pumpAndSettle();

    expect(auth.credencialesRecibidas, ['ana@sena.edu.co', 'secreta']);
  });

  testWidgets('un error de credenciales se ve en pantalla, no solo en el log',
      (tester) async {
    final auth = AuthFalso()
      ..errorAlEntrar = const AuthException('Invalid login credentials');
    addTearDown(auth.cerrar);

    await tester.pumpWidget(
      envolver(const LoginScreen(), auth: AuthProvider(auth: auth)),
    );
    await tester.enterText(find.byKey(const Key('campo-email')), 'ana@sena.edu.co');
    await tester.enterText(find.byKey(const Key('campo-password')), 'mala');
    await tester.ensureVisible(find.byKey(const Key('boton-iniciar-sesion')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('boton-iniciar-sesion')));
    await tester.pumpAndSettle();

    expect(find.text('Correo o contraseña incorrectos.'), findsOneWidget);
  });

  testWidgets('la contraseña se puede mostrar y volver a ocultar', (tester) async {
    final auth = AuthFalso();
    addTearDown(auth.cerrar);

    await tester.pumpWidget(
      envolver(const LoginScreen(), auth: AuthProvider(auth: auth)),
    );

    TextField campo() => tester.widget<TextField>(
          find.descendant(
            of: find.byKey(const Key('campo-password')),
            matching: find.byType(TextField),
          ),
        );

    expect(campo().obscureText, isTrue);
    await tester.ensureVisible(find.byKey(const Key('boton-ver-password')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('boton-ver-password')));
    await tester.pump();
    expect(campo().obscureText, isFalse);
  });

  testWidgets('el chip alterna entre el portal de aprendices e instructores',
      (tester) async {
    final auth = AuthFalso();
    addTearDown(auth.cerrar);

    await tester.pumpWidget(
      envolver(const LoginScreen(), auth: AuthProvider(auth: auth)),
    );

    expect(find.text('Acceso Aprendices'), findsOneWidget);
    await tester.tap(find.byKey(const Key('chip-portal')));
    await tester.pumpAndSettle();
    expect(find.text('Acceso Instructores'), findsOneWidget);
  });

  testWidgets('desde el login se llega a recuperar contraseña', (tester) async {
    final auth = AuthFalso();
    addTearDown(auth.cerrar);

    await tester.pumpWidget(
      envolver(const LoginScreen(), auth: AuthProvider(auth: auth)),
    );
    await tester.ensureVisible(find.byKey(const Key('boton-olvide-password')));
    await tester.tap(find.byKey(const Key('boton-olvide-password')));
    await tester.pumpAndSettle();

    expect(find.text('Recuperar contraseña'), findsOneWidget);

    await tester.enterText(
        find.byKey(const Key('campo-email-recuperar')), 'ana@sena.edu.co');
    await tester.tap(find.byKey(const Key('boton-enviar-instrucciones')));
    await tester.pumpAndSettle();

    expect(auth.correoDeRecuperacion, 'ana@sena.edu.co');
    expect(find.text('Revisa tu correo'), findsOneWidget);
  });
}
