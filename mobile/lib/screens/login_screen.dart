import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import 'recuperar_password_screen.dart';

/// Portal desde el que se entra. El backend NO distingue: el login es el
/// mismo para todos y el rol lo decide la BD (GET /usuarios/me). Esto solo
/// cambia el titular y el color del encabezado, como en los dos diseños
/// entregados ("Login Aprendices" / "Login Instructores").
enum Portal {
  aprendices(
    etiqueta: 'PORTAL DE APRENDICES',
    titulo: 'Acceso Aprendices',
    subtitulo: 'Ingresa tus credenciales para consultar tus horarios de formación.',
    icono: Icons.school_rounded,
  ),
  instructores(
    etiqueta: 'PORTAL DE INSTRUCTORES',
    titulo: 'Acceso Instructores',
    subtitulo: 'Ingresa tus credenciales institucionales para continuar.',
    icono: Icons.cast_for_education_rounded,
  );

  const Portal({
    required this.etiqueta,
    required this.titulo,
    required this.subtitulo,
    required this.icono,
  });

  final String etiqueta;
  final String titulo;
  final String subtitulo;
  final IconData icono;

  Portal get otro =>
      this == Portal.aprendices ? Portal.instructores : Portal.aprendices;
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _ocultarPassword = true;
  bool _mantenerSesion = true;
  Portal _portal = Portal.aprendices;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _iniciarSesion() async {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) return;

    final auth = context.read<AuthProvider>();
    final entro = await auth.signIn(
      _emailController.text,
      _passwordController.text,
      mantenerSesion: _mantenerSesion,
    );

    if (!mounted || entro) return;

    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(
        content: Text(auth.error ?? 'No se pudo iniciar sesión.'),
        backgroundColor: Theme.of(context).colorScheme.error,
      ));
  }

  @override
  Widget build(BuildContext context) {
    final colores = Theme.of(context).colorScheme;
    final textos = Theme.of(context).textTheme;
    final cargando = context.select<AuthProvider, bool>((a) => a.isLoading);

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              colores.primary.withValues(alpha: 0.14),
              colores.surface,
            ],
          ),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 32, 16, 24),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Column(
                  children: [
                    _Marca(portal: _portal),
                    const SizedBox(height: 16),
                    _ChipPortal(
                      portal: _portal,
                      onCambiar: () => setState(() => _portal = _portal.otro),
                    ),
                    const SizedBox(height: 24),
                    Card(
                      elevation: 0,
                      color: colores.surfaceContainerLowest,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Form(
                          key: _formKey,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Flexible(
                                    child: Text(
                                      _portal.titulo,
                                      style: textos.headlineSmall,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Icon(_portal.icono, color: colores.primary),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                _portal.subtitulo,
                                style: textos.bodyMedium
                                    ?.copyWith(color: colores.onSurfaceVariant),
                              ),
                              const SizedBox(height: 24),
                              _Etiqueta('Correo electrónico'),
                              const SizedBox(height: 8),
                              TextFormField(
                                key: const Key('campo-email'),
                                controller: _emailController,
                                enabled: !cargando,
                                keyboardType: TextInputType.emailAddress,
                                autocorrect: false,
                                textInputAction: TextInputAction.next,
                                decoration: const InputDecoration(
                                  hintText: 'ejemplo@correo.com',
                                  prefixIcon: Icon(Icons.mail_outline_rounded),
                                ),
                                validator: (valor) {
                                  final texto = (valor ?? '').trim();
                                  if (texto.isEmpty) {
                                    return 'Escribe tu correo institucional.';
                                  }
                                  if (!texto.contains('@') || !texto.contains('.')) {
                                    return 'Ese correo no parece válido.';
                                  }
                                  return null;
                                },
                              ),
                              const SizedBox(height: 16),
                              _Etiqueta('Contraseña'),
                              const SizedBox(height: 8),
                              TextFormField(
                                key: const Key('campo-password'),
                                controller: _passwordController,
                                enabled: !cargando,
                                obscureText: _ocultarPassword,
                                autocorrect: false,
                                enableSuggestions: false,
                                textInputAction: TextInputAction.done,
                                onFieldSubmitted: (_) =>
                                    cargando ? null : _iniciarSesion(),
                                decoration: InputDecoration(
                                  hintText: '••••••••',
                                  prefixIcon: const Icon(Icons.lock_outline_rounded),
                                  suffixIcon: IconButton(
                                    key: const Key('boton-ver-password'),
                                    onPressed: () => setState(
                                      () => _ocultarPassword = !_ocultarPassword,
                                    ),
                                    tooltip: _ocultarPassword
                                        ? 'Mostrar contraseña'
                                        : 'Ocultar contraseña',
                                    icon: Icon(
                                      _ocultarPassword
                                          ? Icons.visibility_off_outlined
                                          : Icons.visibility_outlined,
                                    ),
                                  ),
                                ),
                                validator: (valor) =>
                                    (valor ?? '').isEmpty ? 'Escribe tu contraseña.' : null,
                              ),
                              const SizedBox(height: 8),
                              Align(
                                alignment: Alignment.centerRight,
                                child: TextButton(
                                  key: const Key('boton-olvide-password'),
                                  onPressed: cargando
                                      ? null
                                      : () => Navigator.of(context).push(
                                            MaterialPageRoute<void>(
                                              builder: (_) =>
                                                  const RecuperarPasswordScreen(),
                                            ),
                                          ),
                                  child: const Text('¿Olvidaste tu contraseña?'),
                                ),
                              ),
                              CheckboxListTile(
                                key: const Key('check-mantener-sesion'),
                                value: _mantenerSesion,
                                onChanged: cargando
                                    ? null
                                    : (v) => setState(() => _mantenerSesion = v ?? true),
                                title: const Text('Mantener sesión iniciada'),
                                controlAffinity: ListTileControlAffinity.leading,
                                contentPadding: EdgeInsets.zero,
                                dense: true,
                              ),
                              const SizedBox(height: 16),
                              FilledButton(
                                key: const Key('boton-iniciar-sesion'),
                                onPressed: cargando ? null : _iniciarSesion,
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text(cargando
                                        ? 'Iniciando sesión...'
                                        : 'Iniciar sesión'),
                                    const SizedBox(width: 8),
                                    if (cargando)
                                      SizedBox(
                                        width: 18,
                                        height: 18,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          color: colores.onPrimary,
                                        ),
                                      )
                                    else
                                      const Icon(Icons.arrow_forward_rounded, size: 20),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Marca extends StatelessWidget {
  final Portal portal;

  const _Marca({required this.portal});

  @override
  Widget build(BuildContext context) {
    final colores = Theme.of(context).colorScheme;
    final textos = Theme.of(context).textTheme;

    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: colores.surfaceContainerLowest,
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: colores.primary.withValues(alpha: 0.12),
                blurRadius: 16,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: colores.primary,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(
              Icons.calendar_month_rounded,
              color: colores.onPrimary,
              size: 30,
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          'SIHS',
          style: textos.displaySmall?.copyWith(
            fontWeight: FontWeight.w800,
            color: colores.onSurface,
          ),
        ),
        Text(
          'Sistema de Horarios',
          style: textos.titleMedium?.copyWith(color: colores.onSurfaceVariant),
        ),
      ],
    );
  }
}

/// El chip del diseño, pero tocable: alterna entre los dos portales para no
/// necesitar dos pantallas de login que solo se diferencian en el titular.
class _ChipPortal extends StatelessWidget {
  final Portal portal;
  final VoidCallback onCambiar;

  const _ChipPortal({required this.portal, required this.onCambiar});

  @override
  Widget build(BuildContext context) {
    final colores = Theme.of(context).colorScheme;

    return InkWell(
      key: const Key('chip-portal'),
      onTap: onCambiar,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        decoration: BoxDecoration(
          color: colores.primary.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: colores.primary.withValues(alpha: 0.25)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.circle, size: 8, color: colores.primary),
            const SizedBox(width: 10),
            Text(
              portal.etiqueta,
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: colores.primary,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                  ),
            ),
            const SizedBox(width: 6),
            Icon(Icons.swap_horiz_rounded, size: 16, color: colores.primary),
          ],
        ),
      ),
    );
  }
}

class _Etiqueta extends StatelessWidget {
  final String texto;

  const _Etiqueta(this.texto);

  @override
  Widget build(BuildContext context) {
    return Text(
      texto,
      style: Theme.of(context).textTheme.labelLarge?.copyWith(
            fontWeight: FontWeight.w700,
          ),
    );
  }
}
