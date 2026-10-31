# MER SIHS

> Transcripción del modelo entidad-relación (MER) del archivo **MER SIHS.pdf**.
> El PDF está compuesto por una imagen, por lo que los nombres y tipos se transcribieron visualmente.

## Diagrama MER en Mermaid

```mermaid
erDiagram
    COORDINACIONES ||--o{ PROGRAMAS : "pertenece a"
    SEDES ||--o{ AMBIENTES : "dispone"
    PROGRAMAS ||--o{ FICHAS : "incluye"
    TRIMESTRES ||--o{ FICHAS : "define"
    PROGRAMAS ||--o{ COMPETENCIAS_FORMACION : "opera en"
    TRIMESTRES ||--o{ HORARIOS : "planifica"
    JORNADAS ||--o{ HORARIOS : "programa"
    HORARIOS ||--o{ HORARIO_DIA : "asocia"
    DIASDESEMANA ||--o{ HORARIO_DIA : "asocia"
    COMPETENCIAS_FORMACION ||--o{ RESULTADOS_APRENDIZAJE : "contiene"
    RESULTADOS_APRENDIZAJE ||--o{ ACTIVIDADES_APRENDIZAJE : "genera"
    USUARIOS ||--o{ USUARIO_ROL : "tiene"
    ROLES ||--o{ USUARIO_ROL : "asigna"
    USUARIOS ||--o{ FICHA_USUARIO : "asocia"
    FICHAS ||--o{ FICHA_USUARIO : "asocia"

    COORDINACIONES {
        INTEGER idCoordinacion PK
        VARCHAR_150 nombreCoordinacion
    }

    PROGRAMAS {
        INTEGER idPrograma PK
        VARCHAR_150 nombrePrograma
        INTEGER idCoordinacion FK
    }

    TRIMESTRES {
        INTEGER idTrimestre PK
        VARCHAR_100 nombre
        DATE fechaInicio
        DATE fechaFin
        VARCHAR_20 estado
    }

    FICHAS {
        INTEGER idFicha PK
        VARCHAR_50 codigoFicha
        INTEGER idPrograma FK
        INTEGER idTrimestre FK
    }

    SEDES {
        INTEGER idSede PK
        VARCHAR_150 nombreSede
        VARCHAR_255 direccion
        VARCHAR_50 tipoSede
    }

    AMBIENTES {
        INTEGER idAmbiente PK
        VARCHAR_100 nombreAmbiente
        INTEGER idSede FK
    }

    JORNADAS {
        INTEGER idJornada PK
        VARCHAR_100 nombreJornada
    }

    HORARIOS {
        INTEGER idHorario PK
        TIME horarioInicio
        TIME horarioFin
        INTEGER idJornada
        INTEGER idTrimestre FK
    }

    DIASDESEMANA {
        INTEGER idDia PK
        VARCHAR_30 nombreDia
    }

    HORARIO_DIA {
        INTEGER idHorario PK, FK
        INTEGER idDia PK, FK
    }

    USUARIOS {
        INTEGER idUsuario PK
        VARCHAR_100 nombre
        VARCHAR_150 email
        VARCHAR_255 password
        VARCHAR_20 estado
        DATETIME fechaRegistro
    }

    ROLES {
        INTEGER idRol PK
        VARCHAR_100 nombreRol
    }

    USUARIO_ROL {
        INTEGER idUsuario PK, FK
        INTEGER idRol PK, FK
    }

    FICHA_USUARIO {
        INTEGER idFicha PK, FK
        INTEGER idUsuario PK, FK
    }

    COMPETENCIAS_FORMACION {
        INTEGER idCompetencia PK
        VARCHAR_50 codigo
        TEXT descripcion
        INTEGER idPrograma FK
    }

    RESULTADOS_APRENDIZAJE {
        INTEGER idResultado PK
        VARCHAR_50 codigo
        TEXT descripcion
        INTEGER idCompetencia FK
    }

    ACTIVIDADES_APRENDIZAJE {
        INTEGER idActividad PK
        VARCHAR_50 codigo
        TEXT descripcion
        VARCHAR_50 tipoActividad
        INTEGER duracionMinutos
        INTEGER idResultado FK
    }
```

## Entidades

### COORDINACIONES
| Campo | Tipo | Clave |
|---|---|---|
| idCoordinacion | Integer | PK |
| nombreCoordinacion | Varchar(150) | NOT NULL |

### PROGRAMAS
| Campo | Tipo | Clave |
|---|---|---|
| idPrograma | Integer | PK |
| nombrePrograma | Varchar(150) | NOT NULL |
| idCoordinacion | Integer | FK |

### TRIMESTRES
| Campo | Tipo | Clave |
|---|---|---|
| idTrimestre | Integer | PK |
| nombre | Varchar(100) | NOT NULL |
| fechaInicio | Date | NOT NULL |
| fechaFin | Date | NOT NULL |
| estado | Varchar(20) | NOT NULL |

### FICHAS
| Campo | Tipo | Clave |
|---|---|---|
| idFicha | Integer | PK |
| codigoFicha | Varchar(50) | NOT NULL |
| idPrograma | Integer | FK |
| idTrimestre | Integer | FK |

### SEDES
| Campo | Tipo | Clave |
|---|---|---|
| idSede | Integer | PK |
| nombreSede | Varchar(150) | NOT NULL |
| direccion | Varchar(255) | NOT NULL |
| tipoSede | Varchar(50) | NOT NULL |

### AMBIENTES
| Campo | Tipo | Clave |
|---|---|---|
| idAmbiente | Integer | PK |
| nombreAmbiente | Varchar(100) | NOT NULL |
| idSede | Integer | FK |

### JORNADAS
| Campo | Tipo | Clave |
|---|---|---|
| idJornada | Integer | PK |
| nombreJornada | Varchar(100) | NOT NULL |

### HORARIOS
| Campo | Tipo | Clave |
|---|---|---|
| idHorario | Integer | PK |
| horarioInicio | Time | NOT NULL |
| horarioFin | Time | NOT NULL |
| idJornada | Integer | NOT NULL |
| idTrimestre | Integer | FK |

### DIASDESEMANA
| Campo | Tipo | Clave |
|---|---|---|
| idDia | Integer | PK |
| nombreDia | Varchar(30) | NOT NULL |

### HORARIO_DIA
| Campo | Tipo | Clave |
|---|---|---|
| idHorario | Integer | PK, FK |
| idDia | Integer | PK, FK |

### USUARIOS
| Campo | Tipo | Clave |
|---|---|---|
| idUsuario | Integer | PK |
| nombre | Varchar(100) | NOT NULL |
| email | Varchar(150) | NOT NULL |
| password | Varchar(255) | NOT NULL |
| estado | Varchar(20) | NOT NULL |
| fechaRegistro | Datetime | NOT NULL |

### ROLES
| Campo | Tipo | Clave |
|---|---|---|
| idRol | Integer | PK |
| nombreRol | Varchar(100) | NOT NULL |

### USUARIO_ROL
| Campo | Tipo | Clave |
|---|---|---|
| idUsuario | Integer | PK, FK |
| idRol | Integer | PK, FK |

### FICHA_USUARIO
| Campo | Tipo | Clave |
|---|---|---|
| idFicha | Integer | PK, FK |
| idUsuario | Integer | PK, FK |

### COMPETENCIAS_FORMACION
| Campo | Tipo | Clave |
|---|---|---|
| idCompetencia | Integer | PK |
| codigo | Varchar(50) | NOT NULL |
| descripcion | Text | NOT NULL |
| idPrograma | Integer | FK |

### RESULTADOS_APRENDIZAJE
| Campo | Tipo | Clave |
|---|---|---|
| idResultado | Integer | PK |
| codigo | Varchar(50) | NOT NULL |
| descripcion | Text | NOT NULL |
| idCompetencia | Integer | FK |

### ACTIVIDADES_APRENDIZAJE
| Campo | Tipo | Clave |
|---|---|---|
| idActividad | Integer | PK |
| codigo | Varchar(50) | NOT NULL |
| descripcion | Text | NOT NULL |
| tipoActividad | Varchar(50) | NOT NULL |
| duracionMinutos | Integer | NOT NULL |
| idResultado | Integer | FK |
```

# Notas

- `PK` = clave primaria.
- `FK` = clave foránea.
- `NOT NULL` = campo obligatorio.
- El diagrama Mermaid reproduce las relaciones visibles en el PDF.
