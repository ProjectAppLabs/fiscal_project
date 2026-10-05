# Fiscal.

**Fiscal.** es el microservicio de facturación electrónica DIAN de ProjectApp. Recibe el documento comercial de un
sistema cliente (Waiter es el primero), lo convierte en el documento electrónico de la DIAN, lo firma con el
certificado del comercio, lo transmite y guarda la prueba. Cada comercio factura con su propio NIT en la modalidad
«software propio o adquirido», con ProjectApp como fabricante del software.

**Marca:** se escribe «Fiscal.», con el punto final. El logotipo es la palabra «Fiscal.» en Ubuntu Bold.

## Estado

F1, núcleo sin DIAN real. Este repositorio parte de la plantilla Base Django React Next de ProjectApp; las demos de la
plantilla se retiraron. Plan y contexto en el Memory Bank:

- [Requisitos del producto](docs/methodology/product_requirement_docs.md): alcance y decisiones D1 a D7.
- [Arquitectura](docs/methodology/architecture.md) y [técnica](docs/methodology/technical.md).
- [Plan de tareas](tasks/tasks_plan.md) y [contexto activo](tasks/active_context.md).
- [Inventario previo](docs/fiscal/inventario/README.md) y [plan de F1](docs/fiscal/planes/F1-nucleo.md).

## Estructura

| Carpeta | Qué hay |
|---|---|
| `backend/fiscal_project/` | Proyecto Django: settings (base, dev y prod), URLs, WSGI y tareas Huey. `fiscal_settings.py` valida la clave de cifrado y el gateway de la DIAN al arrancar |
| `backend/fiscal_app/` | App de dominio: modelos, serializers, vistas FBV, URLs por módulo, servicios y pruebas |
| `frontend/` | Consola de operación de ProjectApp (Next.js, React y TypeScript): inicio de sesión de operadores y tablero |
| `docs/` | Estándares de la plantilla, Memory Bank e inventario y planes de Fiscal. (`docs/fiscal/`) |
| `scripts/` | Quality gate de pruebas, cobertura y unidades systemd |

## Desarrollo local

Requisitos: Python 3.14.7, Node 24 y Docker.

```bash
# Servicios
docker run -d --name fiscal-mysql -p 127.0.0.1:3308:3306 -e MYSQL_ROOT_PASSWORD=fiscal-root \
  -e MYSQL_DATABASE=fiscal -e MYSQL_USER=fiscal -e MYSQL_PASSWORD=fiscal mysql:8.4
docker exec fiscal-mysql mysql -uroot -pfiscal-root -e "GRANT ALL ON \`test_fiscal%\`.* TO 'fiscal'@'%';"
docker run -d --name fiscal-redis -p 127.0.0.1:6380:6379 redis:7.4-alpine

# Backend
cd backend
python3.14 -m venv venv
venv/bin/pip install <rueda de mysqlclient 2.2.8 para cp314>   # ver «mysqlclient» abajo
venv/bin/pip install --require-hashes -r requirements.txt
cp .env.example .env    # y completa FISCAL_ENCRYPTION_KEY y DJANGO_SECRET_KEY
venv/bin/python manage.py migrate
venv/bin/python manage.py createsuperuser
venv/bin/python manage.py runserver

# Frontend
cd frontend && npm ci && npm run dev
```

- **`FISCAL_ENCRYPTION_KEY` es obligatoria.** Sin ella el servicio no arranca, y si se pierde no se puede descifrar
  ningún certificado ni secreto guardado. Hay que respaldarla aparte de la base de datos.
- **No hay registro público.** Los operadores de la consola los crea un administrador (`createsuperuser`, admin).
- **Pruebas:** usan SQLite, como la plantilla. Con `DJANGO_TEST_DB_ENGINE=django.db.backends.mysql` corren sobre
  MySQL, que es lo que necesitan las de concurrencia.
- **mysqlclient:** la versión 2.2.8 no tiene rueda para Python 3.14 en PyPI y compilarla exige
  `libmysqlclient-dev`. Sin sudo, se compila en un contenedor `ubuntu:24.04` con `auditwheel repair`.
- **Reglas de trabajo** (plantilla, ver `CLAUDE.md`):
  - nunca commit en `master`;
  - una rama y un PR por tarea;
  - código y commits en inglés, documentación en español;
  - pruebas por archivo, nunca la suite completa.
