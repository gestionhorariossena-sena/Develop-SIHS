import pytest
from pydantic import ValidationError

from app.schemas.demo_reset import ResetDemoRequest


def test_requiere_frase_literal_y_clave_de_idempotencia():
    datos = ResetDemoRequest(confirmacionExacta="RESETEAR DEMO", idempotencyKey="reset-demo-000001")
    assert datos.confirmacionExacta == "RESETEAR DEMO"

    with pytest.raises(ValidationError):
        ResetDemoRequest(confirmacionExacta="confirmar", idempotencyKey="reset-demo-000001")
    with pytest.raises(ValidationError):
        ResetDemoRequest(confirmacionExacta="RESETEAR DEMO", idempotencyKey="corta")
