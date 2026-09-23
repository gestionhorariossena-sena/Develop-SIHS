import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/horario.dart';
import '../providers/auth_provider.dart';
import '../providers/horario_provider.dart';
import '../widgets/horario_card.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({Key? key}) : super(key: key);

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final authProvider = context.read<AuthProvider>();
      final horarioProvider = context.read<HorarioProvider>();
      horarioProvider.cargarHorarios(authProvider.usuarioActual);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Mi Horario'),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              final authProvider = context.read<AuthProvider>();
              final horarioProvider = context.read<HorarioProvider>();
              horarioProvider.cargarHorarios(authProvider.usuarioActual);
            },
          ),
          PopupMenuButton(
            itemBuilder: (context) => [
              PopupMenuItem(
                onTap: () {
                  context.read<AuthProvider>().signOut();
                },
                child: const Row(
                  children: [
                    Icon(Icons.logout),
                    SizedBox(width: 8),
                    Text('Cerrar sesión'),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: Consumer2<AuthProvider, HorarioProvider>(
        builder: (context, authProvider, horarioProvider, _) {
          // Mostrar usuario actual
          final usuario = authProvider.usuarioActual;
          if (usuario == null) {
            return const Center(
              child: Text('Usuario no cargado'),
            );
          }

          // Mostrar estado de carga
          if (horarioProvider.isLoading && horarioProvider.horarios.isEmpty) {
            return const Center(
              child: CircularProgressIndicator(),
            );
          }

          // Mostrar error
          if (horarioProvider.error != null && horarioProvider.horarios.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, size: 48),
                  const SizedBox(height: 16),
                  Text(horarioProvider.error!),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: () {
                      horarioProvider.cargarHorarios(usuario);
                    },
                    child: const Text('Reintentar'),
                  ),
                ],
              ),
            );
          }

          // Mostrar horarios
          final horarios = horarioProvider.horarios;
          if (horarios.isEmpty) {
            return const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.calendar_today_outlined, size: 48),
                  SizedBox(height: 16),
                  Text('No hay horarios disponibles'),
                ],
              ),
            );
          }

          return CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Bienvenido, ${usuario.nombre}',
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        usuario.esInstructor
                            ? 'Instructor'
                            : usuario.esAprendiz
                                ? 'Aprendiz'
                                : 'Usuario',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: Colors.grey,
                            ),
                      ),
                    ],
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      final horario = horarios[index];
                      return HorarioCard(horario: horario);
                    },
                    childCount: horarios.length,
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
