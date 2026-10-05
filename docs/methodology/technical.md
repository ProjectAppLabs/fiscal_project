# Technical — Fiscal.

> Memory Bank · actualizado 2026-10-04 (planeación técnica). Stack heredado de la plantilla Base Django React Next;
> lo propio de Fiscal. está marcado como **(Fiscal.)**.

## Stack

| Capa | Tecnología | Versión |
|---|---|---|
| Runtime backend | Python | 3.14.7 (`.python-version`). **No está instalado en el equipo local** (hay 3.12.3): instalarlo con `uv` o `pyenv` antes de implementar |
| Backend | Django / DRF / simplejwt | 6.1 / 3.18.0 / 5.5.1 (plantilla) |
| Tareas | Huey + Redis | 3.3.4 / 8.1.0 (plantilla) |
| Base de datos | **MySQL 8.4** en dev, test de concurrencia y prod **(Fiscal.)** | Estándar de ProjectApp; contenedor `fiscal-mysql` en 127.0.0.1:3308 |
| XML **(Fiscal.)** | lxml | UBL 2.1, validación contra los XSD de la DIAN, canonicalización C14N |
| Criptografía **(Fiscal.)** | cryptography | `.p12`, firma RSA-SHA256, Fernet para secretos en reposo |
| Firma XAdES **(Fiscal.)** | Propia sobre lxml y cryptography; `signxml` solo si produce exactamente lo que la DIAN valida | Se decide en la fase F2 con la caja de herramientas de la DIAN |
| SOAP **(Fiscal.)** | Cliente propio (requests + WS-Security firmado) o `zeep` | Se decide en F2; TLS mutuo con el certificado del comercio |
| PDF **(Fiscal.)** | Por decidir (WeasyPrint o ReportLab) | Representación gráfica con QR de al menos 2 cm |
| Runtime frontend | Node.js / npm | 24.20.0 / 11.19.0 (plantilla) |
| Frontend | Next.js / React / TypeScript / Tailwind | 16 / 19 / 7 / 4 (plantilla) |
| Testing | pytest, freezegun, factory-boy; Jest; Playwright | Plantilla |

Cada dependencia nueva entra por `backend/requirements.in`, se compila con hashes y pasa `pip-audit`, como exige la
plantilla.

## Convenciones

- **Plantilla:** código e identificadores en inglés; **commits en inglés** (Conventional Commits); documentación en
  español; mensajes al usuario final en español.
- **Plantilla:** FBV delgadas, serializers por operación, URLs como paquete y lógica en `services/`.
- **Git (plantilla):** nunca commit en `master`; una sesión = una rama = un PR.
- **Fiscal.:** mensajes de error de la API con forma estable `{"error": {"code", "message"}}`. El `message` va en
  español y listo para mostrar.
- **Fiscal.:** nunca escribir en registros, errores ni respuestas certificados, contraseñas, PIN, claves técnicas ni
  secretos de clientes.
- **Fiscal. (MySQL):** «solo uno a la vez» sin `UniqueConstraint(condition=…)`, que MySQL ignora. Claves y tokens con
  colación binaria (`utf8mb4_bin`).

## Reglas técnicas de la DIAN que el código debe respetar

Detalle y fuentes en `docs/fiscal/inventario/01-requisitos-dian.md`:

1. **Hora:** `IssueDate` y `SigningTime` en `America/Bogota` (−05:00) y sincronizados por NTP. La fecha de emisión es
   igual a la de firma.
2. **CUFE:** SHA-384 de número, fecha, hora, subtotal, 01 e IVA, 04 e INC, 03 e ICA, total, NIT del emisor, documento
   del comprador, **clave técnica** y ambiente. **CUDE** (notas, tipo 03 y POS): lo mismo con el **PIN del software**.
   Los montos se **truncan** a 2 decimales en la cadena; en el XML se redondea half-even.
3. **Un número se transmite una vez.** Antes de reenviar tras una respuesta perdida, consultar `GetStatus` con el CUFE.
4. **Firma:** XAdES-EPES con la política de firma v2 de la DIAN y RSA-SHA256 o superior. No se reformatea el XML
   después de firmar. El `AttachedDocument` se firma aparte.
5. **Transporte:** SOAP 1.2, TLS mutuo y WS-Security X.509. ZIP con exactamente un XML para `SendBillSync`. Las
   direcciones de los servicios se toman del catálogo de la DIAN (inventario: «sin confirmar»).
6. **Ambiente coherente** en `ProfileExecutionID`, el `schemeID` del UUID y la URL del QR (1 = producción,
   2 = habilitación).
7. **Contingencia 04:** reintentos de 5 s ×3 ante error y de 2 min ×5 ante una demora de más de 1 min. Se vuelve a
   firmar el mismo número como tipo 04 y se conservan los dos XML. Las notas no tienen contingencia.
8. **Notas:** `BillingReference` con prefijo, número, CUFE y fecha del original. La anulación es una nota crédito con
   concepto 2. No hay notas sobre notas.
9. **Restaurantes:** propina como cargo, nunca en la base ni en `TaxTotal`. Sin líneas negativas. Dirección de entrega
   en domicilios con consumidor final o cédula. Consumidor final `222222222222` con tipo 13.
10. **Conservación:** 10 años del XML original, la respuesta, el contenedor y las evidencias.

## Setup dev local (objetivo)

```bash
# Backend (requiere Python 3.14.7)
cd backend && python3.14 -m venv venv
venv/bin/python -m pip install --require-hashes -r requirements.txt
cp .env.example .env    # DJANGO_DB_ENGINE=mysql contra fiscal-mysql, FISCAL_ENCRYPTION_KEY, DIAN_GATEWAY=simulated
venv/bin/python manage.py migrate
venv/bin/python manage.py runserver 127.0.0.1:8002
venv/bin/python manage.py run_huey

# Frontend
cd frontend && npm ci && npm run dev -- -p 3002
```

`mysqlclient` 2.2.8 no tiene rueda en PyPI y sin `libmysqlclient-dev` no compila: hay que construir la rueda en
Docker, como se hizo en Waiter (`~/.cache/waiter-wheels/`), ahora para Python 3.14.

## Estrategia de testing

| Capa | Qué se prueba | Dónde |
|---|---|---|
| `dian/` (pura) | CUFE y CUDE contra los ejemplos del anexo; XML contra los XSD; firma que verifica y se rompe con un byte cambiado; truncado frente a redondeo; hora −05:00 | pytest, sin red ni base |
| Servicios | Idempotencia, numeración, máquina de estados, contingencias 03 y 04, plazos de 48 h, alertas, aislamiento entre clientes y comercios, secretos que no salen | pytest con freezegun; concurrencia en MySQL |
| API | Firma HMAC (ausente, vieja, cuerpo cambiado, cliente inactivo, secreto rotado), errores en español, contrato | pytest |
| Integración DIAN | Set de pruebas real en habilitación con el certificado de ProjectApp | Manual y repetible; fuera de CI |
| Consola | Flujos del operador | Jest y Playwright con el gateway simulado |

Cada prueba dice en un comentario qué falla atrapa, y se respeta el quality gate de la plantilla (`.testquality.yml`).

## Constraints técnicos

- La plantilla corre las pruebas en SQLite por omisión; **Fiscal. necesita MySQL** para `select_for_update(skip_locked)`
  y la concurrencia de la numeración. Las pruebas puras pueden seguir en SQLite; las de concurrencia van en MySQL con un
  marcador.
- Puntos «sin confirmar» del inventario que el código debe tolerar hasta verificarlos en habilitación:
  - direcciones de los servicios web;
  - tamaño del set de pruebas;
  - campo del código de contingencia del POS;
  - tope de 5 UVT del POS (no aplica en la etapa 1, que solo emite factura).
