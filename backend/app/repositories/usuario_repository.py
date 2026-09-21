from uuid import UUID

from sqlalchemy.orm import Session, selectinload

from app.models.usuario import Usuario


class UsuarioRepository:
    @staticmethod
    def obtener_todos(db: Session):
        return db.query(Usuario).options(selectinload(Usuario.roles), selectinload(Usuario.especialidades)).all()

    @staticmethod
    def obtener_por_id(db: Session, id_usuario: UUID):
        return db.query(Usuario).filter(Usuario.idUsuario == id_usuario).first()

    @staticmethod
    def obtener_por_email(db: Session, email: str):
        return db.query(Usuario).filter(Usuario.email == email).first()

    @staticmethod
    def obtener_por_numero_documento(db: Session, numero: str):
        return db.query(Usuario).filter(Usuario.numeroDocumento == numero).first()

    @staticmethod
    def obtener_por_codigo_instructor(db: Session, codigo: str):
        return db.query(Usuario).filter(Usuario.codigoInstructor == codigo).first()

    @staticmethod
    def actualizar(db: Session, usuario: Usuario):
        db.commit()
        db.refresh(usuario)
        return usuario
