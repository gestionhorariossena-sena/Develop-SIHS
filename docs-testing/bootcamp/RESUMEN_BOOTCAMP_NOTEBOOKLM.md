# El relevo de testing — guion fuente para NotebookLM

## Qué es esto y por qué existe

El equipo de SIHS (David, Dayana, Edith y Nicol) necesita adoptar un bootcamp de testing para su proyecto formativo. El bootcamp de referencia se llama bc-testing-adso y dura 9 semanas núcleo más 1 semana opcional, pensado para equipos de Análisis y Desarrollo de Software del SENA. El problema es que el equipo no tiene 9 semanas de calendario, así que este plan adapta el mismo contenido a un ritmo más corto, sin saltarse ningún tema importante.

El motivo de fondo: SIHS ya tiene 315 pruebas automáticas en su backend y pasan en cada entrega de código, pero le falta la disciplina formal que el bootcamp exige: una cobertura de pruebas medida y exigida automáticamente, pruebas que corran contra una base de datos real en vez de una simulada, pruebas de extremo a extremo que abran un navegador de verdad, y la certeza de que cada persona del equipo —no solo una— sabe explicar cualquier parte del testing.

## Las cuatro reglas que se aplican todas las semanas

Primera regla: rotación de capas. Hay cuatro capas de trabajo —interfaz visual, API del backend, base de datos, y pruebas de extremo a extremo— y cada semana cada persona cambia de capa, de modo que nadie se queda encasillado en una sola parte del sistema.

Segunda regla: evidencia por commits. Cada integrante debe hacer al menos un commit de pruebas por semana con su propio usuario de Git, para que quede registro individual de quién trabajó qué.

Tercera regla: el vocero aleatorio. En cada revisión semanal se elige al azar a una persona del equipo, y esa persona debe explicar por escrito una capa que no trabajó esa semana. Esto cuenta para la nota de todo el grupo, así que conviene que el equipo se enseñe entre sí.

Cuarta regla: revisión cruzada de pull requests. Quien revisa el código de pruebas de un compañero debe haber trabajado en una capa distinta esa semana, así nadie aprueba su propio trabajo disfrazado de otra persona.

## El truco central: trabajar con una semana de ventaja

Como el equipo no puede hacer una reunión por cada una de las nueve semanas del bootcamp, el plan usa una idea de relevo deportivo: cada domingo hay dos cosas sobre la mesa al mismo tiempo. Por un lado se entrega la semana que ya se cerró, con todo probado y funcionando. Por otro lado, ese mismo domingo ya se empieza a adelantar la semana siguiente, antes de que llegue su turno oficial. El domingo que sigue, lo que era adelanto se convierte en la entrega, y ya hay un nuevo adelanto en marcha. Gracias a esto nadie llega a una reunión con una semana completamente en blanco; siempre hay trabajo ya empezado.

## Las semanas uno y dos se hacen todos juntos

Antes de repartir responsabilidades, las primeras dos semanas las resuelve el equipo completo, sin dividir trabajo, para que el lenguaje básico quede parejo entre los cuatro.

En la semana uno el objetivo es entender para qué sirve una prueba automática y ver una funcionando de inmediato. Se entrega una prueba de extremo a extremo hecha con la herramienta Playwright sobre un flujo real de SIHS, por ejemplo el inicio de sesión o la publicación de un horario, además de crear el documento donde se registrará la rotación de capas y anotar cuánta cobertura de pruebas tiene hoy el proyecto, tanto en el frontend como en el backend.

En la semana dos el objetivo es escribir pruebas unitarias que verifiquen reglas de negocio de forma aislada y rápida. Se entrega al menos tres pruebas unitarias por integrante sobre reglas reales del proyecto, un umbral mínimo de cobertura del treinta por ciento configurado en el sistema de integración continua, y que ese sistema bloquee automáticamente cualquier cambio que no lo cumpla. Este es exactamente el punto donde SIHS está hoy en blanco: tiene muchas pruebas pero ningún umbral que las obligue a mantenerse.

## El relevo: de la semana tres a la diez, una persona por semana

A partir de la semana tres, cada semana tiene un responsable que la lidera: prepara el tema primero y es quien más debe poder explicarlo el domingo, aunque esto no exime a nadie más de seguir rotando de capa ni de que les pueda tocar el vocero aleatorio.

El orden de responsables se decidió por sorteo aleatorio, con la única regla de que nadie repitiera dos semanas consecutivas. Quedó así: semana tres, Edith; semana cuatro, Nicol; semana cinco, David; semana seis, Dayana; semana siete, David; semana ocho, Edith; semana nueve, Nicol; y la semana diez, que es opcional, Dayana.

Semana tres, a cargo de Edith, tema componentes de React. Se prueban formularios reales de SIHS verificando que se muestren en pantalla, que la validación sea visible para quien los usa, y que el envío funcione, probando la interfaz como lo haría una persona real y no sus detalles internos. Esto aplica directamente sobre el constructor de horarios del proyecto.

Semana cuatro, a cargo de Nicol, tema pruebas de API. Se prueban los distintos códigos de respuesta HTTP, la forma exacta del dato que devuelve el servidor, y la validación de los datos que entran. El contrato entre el backend y sus clientes —la aplicación web y la aplicación móvil— es justamente lo que se protege aquí, usando como ejemplo los endpoints de asistencias que el equipo modificó recientemente.

Semana cinco, a cargo de David, tema dobles de prueba: mocks, stubs y espías. Se hace un inventario de todas las dependencias externas del proyecto y se prueba cada una de forma aislada, simulando su comportamiento en vez de llamarlas de verdad. En SIHS esto aplica sobre todo a las llamadas al servicio de inteligencia artificial Gemini para la carga de datos, y a las llamadas a Supabase, para que las pruebas no dependan de la red ni de la latencia real.

Semana seis, a cargo de Dayana, tema integración con base de datos real usando Docker. Esta es la semana más importante desde el punto de vista de la auditoría del proyecto: hoy todas las pruebas del backend corren contra una base de datos simulada en memoria, no contra PostgreSQL, que es la base de datos real que usa SIHS en producción. Eso significa que diferencias de comportamiento que solo aparecen en PostgreSQL podrían estar pasando completamente invisibles. El reto de esta semana es levantar una base de datos PostgreSQL real dentro de un contenedor Docker y correr contra ella al menos un repositorio y un endpoint completo.

Semana siete, a cargo de David, tema Playwright a fondo. Se cubren los tres flujos más críticos del sistema con pruebas de extremo a extremo que no fallen al azar, preparando los datos de prueba por API en vez de hacerlo a mano desde la interfaz. Los candidatos naturales en SIHS son publicar un horario, usar el constructor manual, y cargar información con inteligencia artificial.

Semana ocho, a cargo de Edith, tema integración continua completa. Se junta todo en un único flujo automático que corre pruebas unitarias, de integración y de extremo a extremo, con la base de datos como un servicio más dentro de ese flujo, y exigiendo una cobertura de al menos el ochenta por ciento tanto en frontend como en backend. Hoy el flujo automático de SIHS solo corre las pruebas de backend; esta semana lo amplía para que también levante PostgreSQL y corra las pruebas de navegador.

Semana nueve, a cargo de Nicol, tema integrador y sustentación. Se entrega la suite completa de pruebas en verde, un informe breve que explica qué se prueba en cada capa y por qué, y se hace una sustentación donde, gracias al vocero aleatorio, cualquier integrante puede responder por cualquier parte del sistema. Esta semana coincide justo con la fecha de cierre de la hoja de ruta del equipo, el veinticinco de octubre, frente al instructor.

Semana diez, opcional, a cargo de Dayana, tema desarrollo guiado por pruebas, conocido como TDD. Se construye una funcionalidad nueva empezando siempre por escribir la prueba que falla antes de escribir el código que la hace pasar. Esta semana solo se hace si queda tiempo después de la sustentación; no es un requisito.

## Cómo se entrega cada semana, en la práctica

El reto de cada semana no se resuelve en un ejercicio aparte, sino directamente dentro del repositorio real de SIHS, porque esa es la evidencia que se va a sustentar. Cada entrega se hace a través de una solicitud de cambios en GitHub, usando una plantilla que obliga a declarar en qué capa trabajó quien escribió las pruebas y en qué capa trabajó quien las revisó, que deben ser distintas. Todo el trabajo de la semana queda registrado en un documento de rotación dentro del repositorio: quién trabajó qué capa, quién fue el vocero esa semana, y su respuesta escrita antes de la revisión en vivo. Y, condición final, el sistema de integración continua tiene que quedar en verde y cumplir el umbral de cobertura de esa semana: si un cambio hace bajar la cobertura por debajo del piso exigido, el sistema no permite fusionarlo, no es una sugerencia.

El umbral mínimo de cobertura exigido sube cada semana y nunca baja: empieza registrándose sin exigencia en la semana uno, sube a treinta por ciento en la semana dos, cuarenta en la tres, cincuenta en la cuatro, sesenta en la cinco, setenta en la seis, setenta y cinco en la siete, y llega a su tope de ochenta por ciento en las semanas ocho y nueve.

## Cómo se califica

La nota de cada semana tiene tres componentes. El cuarenta por ciento es desempeño individual, medido por los commits de pruebas de cada persona y si cumplió su capa asignada. El treinta por ciento es conocimiento individual, medido por la respuesta escrita del vocero aleatorio más una pregunta corta de verificación. Y el treinta por ciento restante es producto grupal: el reto de la semana resuelto, el sistema de integración continua en verde, y el umbral de cobertura cumplido. Dos tercios de la nota dependen de cada persona por separado; nadie se esconde detrás del trabajo del grupo.

## Qué pasa el domingo del arranque

La reunión de arranque tiene cuatro momentos. Primero, repasar las cuatro reglas del juego en una frase cada una. Segundo, copiar al repositorio de SIHS los dos documentos base: la plantilla de rotación y la plantilla de solicitud de cambios. Tercero, y es lo que ocupa la mayor parte del tiempo, arrancar la semana uno todos juntos: elegir el flujo a probar, instalar Playwright, grabar la primera prueba y registrar cuánta cobertura tiene hoy el proyecto. Y cuarto, cerrar confirmando el orden del relevo de las semanas tres a diez, para que cada persona sepa cuál es su semana y cuál le toca ir adelantando después de la semana dos.
