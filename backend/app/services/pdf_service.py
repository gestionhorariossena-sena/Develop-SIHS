"""SCRUM-120: exportación a PDF, transversal (horario, ficha, nómina...).

Decisión de arquitectura: ReportLab, no WeasyPrint. ReportLab es pura
Python sin dependencias nativas de sistema (Cairo/Pango) -- instala sin
fricción en cualquier máquina de desarrollo del equipo (Windows incluido)
y en el despliegue de Railway, a diferencia de WeasyPrint, que exige
librerías nativas de GTK que no siempre están disponibles.

`generar_tabla` es deliberadamente genérico (título + columnas + filas de
texto) -- no está atado a "horario", así otras pantallas (ficha, nómina)
lo reusan sin duplicar la lógica de armar el documento.
"""

from __future__ import annotations

import io

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm


class PdfService:
    @staticmethod
    def generar_tabla(titulo: str, columnas: list[str], filas: list[list[str]]) -> bytes:
        buffer = io.BytesIO()
        documento = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            leftMargin=1.5 * cm,
            rightMargin=1.5 * cm,
            topMargin=1.5 * cm,
            bottomMargin=1.5 * cm,
        )

        estilos = getSampleStyleSheet()
        elementos = [Paragraph(titulo, estilos["Title"]), Spacer(1, 0.5 * cm)]

        datos_tabla = [columnas, *filas]
        tabla = Table(datos_tabla, repeatRows=1)
        tabla.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2e8600")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dbe6d2")),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f6faf3")]),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        elementos.append(tabla)

        documento.build(elementos)
        return buffer.getvalue()
