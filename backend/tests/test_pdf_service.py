from app.services.pdf_service import PdfService, SeccionTabla, SeccionTexto


def test_generar_produce_bytes_de_un_pdf_valido():
    contenido = PdfService.generar(
        titulo="Título de prueba",
        subtitulo="Subtítulo de prueba",
        secciones=[
            SeccionTexto(titulo="Datos", lineas=["Línea uno", "Línea dos"]),
            SeccionTabla(titulo="Tabla", encabezados=["A", "B"], filas=[["1", "2"], ["3", "4"]]),
        ],
    )

    assert isinstance(contenido, bytes)
    assert contenido.startswith(b"%PDF")
    assert len(contenido) > 0


def test_generar_seccion_sin_filas_no_revienta():
    contenido = PdfService.generar(
        titulo="Sin datos",
        subtitulo="",
        secciones=[
            SeccionTabla(titulo="Tabla vacía", encabezados=["A"], filas=[]),
            SeccionTexto(titulo="Texto vacío", lineas=[]),
        ],
    )

    assert contenido.startswith(b"%PDF")


def test_generar_tabla_devuelve_bytes_de_un_pdf_valido():
    """SCRUM-120: PdfService.generar_tabla es genérico a propósito (título +
    columnas + filas), no atado a "horario" -- este test solo verifica que
    produce un PDF real, sin depender de ningún dominio."""
    pdf_bytes = PdfService.generar_tabla(
        "Reporte de prueba",
        ["Columna A", "Columna B"],
        [["fila1-a", "fila1-b"], ["fila2-a", "fila2-b"]],
    )

    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 0
    assert pdf_bytes.startswith(b"%PDF")


def test_generar_tabla_sin_filas_no_revienta():
    pdf_bytes = PdfService.generar_tabla("Reporte vacío", ["Columna A"], [])

    assert pdf_bytes.startswith(b"%PDF")
