import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../providers/horario_provider.dart';

/// Pestaña "Perfil": quién entró, con qué rol, y la salida. Es el destino
/// del bottom nav de los diseños que sí se puede sostener con los datos que
/// da el backend hoy.
class PerfilScreen extends StatelessWidget {
  const PerfilScreen({super.key});

  Future<void> _cerrarSesion(BuildContext context) async {
    final confirmado = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cerrar sesión'),
        content: const Text('¿Seguro que quieres salir de tu cuenta?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Cerrar sesión'),
          ),
        ],
      ),
    );

    if (confirmado != true || !context.mounted) return;
    context.read<HorarioProvider>().limpiar();
    await context.read<AuthProvider>().signOut();
  }

  @override
  Widget build(BuildContext context) {
    final colores = Theme.of(context).colorScheme;
    final textos = Theme.of(context).textTheme;
    final usuario = context.watch<AuthProvider>().usuarioActual;
    final ficha = context.watch<HorarioProvider>().ficha;

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const SizedBox(height: 16),
          Center(
            child: CircleAvatar(
              radius: 40,
              backgroundColor: colores.primary,
              child: Text(
                usuario == null || usuario.nombre.isEmpty
                    ? '?'
                    : usuario.nombre.characters.first.toUpperCase(),
                style: textos.headlineMedium?.copyWith(color: colores.onPrimary),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Center(
            child: Text(
              usuario?.nombre ?? 'Cargando...',
              style: textos.headlineSmall,
              textAlign: TextAlign.center,
            ),
          ),
          Center(
            child: Text(
              usuario?.email ?? '',
              style: textos.bodyMedium?.copyWith(color: colores.onSurfaceVariant),
            ),
          ),
          const SizedBox(height: 24),
          Card(
            elevation: 0,
            color: colores.surfaceContainerLowest,
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.badge_outlined),
                  title: const Text('Rol'),
                  subtitle: Text(usuario?.rolPrincipal ?? '—'),
                ),
                if (ficha != null) ...[
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.school_outlined),
                    title: const Text('Ficha'),
                    subtitle: Text(ficha.descripcion),
                  ),
                  if (ficha.sedeNombre != null) ...[
                    const Divider(height: 1),
                    ListTile(
                      leading: const Icon(Icons.apartment_outlined),
                      title: const Text('Sede'),
                      subtitle: Text(ficha.sedeNombre!),
                    ),
                  ],
                ],
              ],
            ),
          ),
          const SizedBox(height: 24),
          FilledButton.tonal(
            key: const Key('boton-cerrar-sesion'),
            onPressed: () => _cerrarSesion(context),
            child: const Text('Cerrar sesión'),
          ),
        ],
      ),
    );
  }
}
