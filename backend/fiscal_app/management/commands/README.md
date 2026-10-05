# Comandos de datos de prueba

| Comando | Qué hace |
|---|---|
| `python manage.py create_fake_data [n]` | Crea datos de prueba para desarrollo y E2E. Hoy: `n` operadores. En F1 PR 2 se agregan emisores, rangos y documentos en cada estado |
| `python manage.py create_users [n]` | Crea `n` operadores con contraseña `password` (roles operador o admin) |
| `python manage.py delete_fake_data --confirm` | Borra los datos de prueba. Nunca borra superusuarios ni cuentas staff |
