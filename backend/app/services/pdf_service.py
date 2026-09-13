from __future__ import annotations

import io
from dataclasses import dataclass, field
from datetime import datetime, timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

_ESTILOS = getSampleStyleSheet()
_VERDE_SENA = colors.HexColor("#39a900")
_ESTILO_MARCA = ParagraphStyle("MarcaSIHS", parent=_ESTILOS["Heading2"], textColor=_VERDE_SENA)
_ESTILO_TITULO = ParagraphStyle("TituloSIHS", parent=_ESTILOS["Title"], spaceBefore=2, spaceAfter=2)
_ESTILO_SUBTITULO = ParagraphStyle("SubtituloSIHS", parent=_ESTILOS["Normal"], textColor=colors.grey)
_ESTILO_SECCION = ParagraphStyle("SeccionSIHS", parent=_ESTILOS["Heading3"], spaceBefore=14, textColor=_VERDE_SENA)
_ESTILO_TEXTO = _ESTILOS["BodyText"]
_ESTILO_PIE = ParagraphStyle("PieSIHS", parent=_ESTILOS["Normal"], fontSize=7, textColor=colors.grey)


@dataclass
class SeccionTabla:
    """Una sección de tabla — ej. la grilla semanal de horarios de una
    ficha, o el listado de aprendices matriculados."""

    titulo: str
    encabezados: list[str]
    filas: list[list[str]]


@dataclass
class SeccionTexto:
    """Una sección de texto libre en líneas — ej. los datos puntuales de
    una sesión (instructor, ambiente, resultado de aprendizaje)."""

    titulo: str
    lineas: list[str] = field(default_factory=list)


class PdfService:
    """Generador de PDF reusable — un único armador de documento
    (`generar`) en vez de un generador distinto por pantalla, para que
    GET /horarios/{id}/pdf, GET /fichas/{id}/pdf y cualquier pantalla
    futura (ej. Historial de Horarios) armen su contenido con
    SeccionTabla/SeccionTexto y llamen a la misma función.

    Librería: ReportLab, no WeasyPrint. Ambas generan PDF en Python, pero
    WeasyPrint depende de librerías de sistema (Pango/Cairo/GDK-PixBuf)
    que ni el workflow de CI (`.github/workflows/ci.yml`, backend: solo
    `pip install -r requirements.txt`, sin `apt-get`) ni el Procfile
    (`uvicorn` directo, sin buildpack de sistema) instalan hoy —
    agregarla implicaría tocar ambos pipelines. ReportLab es una librería
    pura de Python (pip-instalable, sin dependencias de sistema), así que
    no requiere ningún cambio de infraestructura. Si el equipo prefiere
    WeasyPrint por su ventaja real (maquetar con HTML/CSS en vez de la
    API de bajo nivel de ReportLab), es una migración de este único
    archivo, no de cada endpoint que lo consume."""

    @staticmethod
    def generar(*, titulo: str, subtitulo: str, secciones: list[SeccionTabla | SeccionTexto]) -> bytes:
        buffer = io.BytesIO()
        documento = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            topMargin=2 * cm,
            bottomMargin=1.5 * cm,
            leftMargin=2 * cm,
            rightMargin=2 * cm,
            title=titulo,
        )

        elementos = [
            Paragraph("SENA · Sistema Integrado de Horarios y Sedes (SIHS)", _ESTILO_MARCA),
            Paragraph(titulo, _ESTILO_TITULO),
            Paragraph(subtitulo, _ESTILO_SUBTITULO),
            Spacer(1, 0.6 * cm),
        ]

        for seccion in secciones:
            elementos.append(Paragraph(seccion.titulo, _ESTILO_SECCION))

            if isinstance(seccion, SeccionTabla):
                if seccion.filas:
                    tabla = Table([seccion.encabezados, *seccion.filas], hAlign="LEFT", repeatRows=1)
                    tabla.setStyle(
                        TableStyle(
                            [
                                ("BACKGROUND", (0, 0), (-1, 0), _VERDE_SENA),
                                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                                ("FONTSIZE", (0, 0), (-1, -1), 8),
                                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")]),
                            ]
                        )
                    )
                    elementos.append(tabla)
                else:
                    elementos.append(Paragraph("Sin información registrada.", _ESTILO_TEXTO))
            else:
                for linea in seccion.lineas or ["Sin información registrada."]:
                    elementos.append(Paragraph(linea, _ESTILO_TEXTO))

            elementos.append(Spacer(1, 0.4 * cm))

        pie = (
            f"Generado el {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} "
            "· Documento generado automáticamente por SIHS, sujeto a cambios de programación."
        )
        elementos.append(Paragraph(pie, _ESTILO_PIE))

        documento.build(elementos)
        return buffer.getvalue()
