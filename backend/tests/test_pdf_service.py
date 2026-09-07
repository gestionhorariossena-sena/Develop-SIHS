"""SCRUM-120: PdfService.generar_tabla es genérico a propósito (título +
columnas + filas), no atado a "horario" -- este test solo verifica que
produce un PDF real, sin depender de ningún dominio."""

from app.services.pdf_service import PdfService


def test_generar_tabla_devuelve_bytes_de_un_pdf_valido():
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
