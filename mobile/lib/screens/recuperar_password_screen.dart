import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';

/// "Recuperar contraseña" — diseño entregado. Manda el correo de
/// restablecimiento por Supabase Auth, el mismo mecanismo que usa la web.
class RecuperarPasswordScreen extends StatefulWidget {
  const RecuperarPasswordScreen({super.key});

  @override
  State<RecuperarPasswordScreen> createState() => _RecuperarPasswordScreenState();
}

class _RecuperarPasswordScreenState extends State<RecuperarPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();

  bool _enviando = false;
  bool _enviado = false;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _enviar() async {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _enviando = true;
      _error = null;
    });

    final error = await context
        .read<AuthProvider>()
        .enviarCorreoDeRecuperacion(_emailController.text);

    if (!mounted) return;
    setState(() {
      _enviando = false;
      _enviado = error == null;
      _error = error;
    });
  }

  @override
  Widget build(BuildContext context) {
    final colores = Theme.of(context).colorScheme;
    final textos = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: colores.onSurface,
        elevation: 0,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Card(
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
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                color: colores.primary,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Icon(Icons.calendar_month_rounded,
                                  color: colores.onPrimary, size: 24),
                            ),
                            const SizedBox(width: 12),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Sistema de Horarios',
                                    style: textos.titleMedium
                                        ?.copyWith(fontWeight: FontWeight.w700)),
                                Text('SIHS · CGMLTI',
                                    style: textos.bodySmall
                                        ?.copyWith(color: colores.onSurfaceVariant)),
                              ],
                            ),
                          ],
                        ),
                        const SizedBox(height: 32),
                        Center(
                          child: Container(
                            width: 64,
                            height: 64,
                            decoration: BoxDecoration(
                              color: colores.primary.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(18),
                            ),
                            child: Icon(
                              _enviado
                                  ? Icons.mark_email_read_outlined
                                  : Icons.mail_outline_rounded,
                              color: colores.primary,
                              size: 32,
                            ),
                          ),
                        ),
                        const SizedBox(height: 20),
                        Text(
                          _enviado ? 'Revisa tu correo' : 'Recuperar contraseña',
                          textAlign: TextAlign.center,
                          style: textos.headlineSmall,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _enviado
                              ? 'Si ese correo tiene una cuenta en SIHS, le llegaron '
                                  'las instrucciones para restablecer el acceso.'
                              : 'Ingresa tu correo electrónico y te enviaremos las '
                                  'instrucciones para restablecer el acceso.',
                          textAlign: TextAlign.center,
                          style: textos.bodyMedium
                              ?.copyWith(color: colores.onSurfaceVariant),
                        ),
                        const SizedBox(height: 24),
                        if (!_enviado) ...[
                          Text('Correo',
                              style: textos.labelLarge
                                  ?.copyWith(fontWeight: FontWeight.w700)),
                          const SizedBox(height: 8),
                          TextFormField(
                            key: const Key('campo-email-recuperar'),
                            controller: _emailController,
                            enabled: !_enviando,
                            keyboardType: TextInputType.emailAddress,
                            autocorrect: false,
                            decoration: const InputDecoration(
                              hintText: 'correo@ejemplo.com',
                            ),
                            validator: (valor) {
                              final texto = (valor ?? '').trim();
                              if (texto.isEmpty) return 'Escribe tu correo.';
                              if (!texto.contains('@') || !texto.contains('.')) {
                                return 'Ese correo no parece válido.';
                              }
                              return null;
                            },
                          ),
                          if (_error != null) ...[
                            const SizedBox(height: 12),
                            Text(
                              _error!,
                              style: textos.bodySmall?.copyWith(color: colores.error),
                            ),
                          ],
                          const SizedBox(height: 20),
                          FilledButton(
                            key: const Key('boton-enviar-instrucciones'),
                            onPressed: _enviando ? null : _enviar,
                            child: Text(_enviando
                                ? 'Enviando...'
                                : 'Enviar instrucciones'),
                          ),
                        ] else
                          FilledButton(
                            onPressed: () => Navigator.of(context).pop(),
                            child: const Text('Volver al inicio de sesión'),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
