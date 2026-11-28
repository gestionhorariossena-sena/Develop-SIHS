from typing import Literal

from pydantic import BaseModel, Field


class ResetDemoRequest(BaseModel):
    """La frase literal evita que un clic o payload genérico ejecute el reset."""

    confirmacionExacta: Literal["RESETEAR DEMO"]
    idempotencyKey: str = Field(min_length=16, max_length=128)
