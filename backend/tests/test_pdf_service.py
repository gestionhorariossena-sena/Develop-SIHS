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
