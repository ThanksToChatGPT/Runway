# Outfit Builder — MVP (Release 1)

Plataforma para descubrir prendas, comparar productos, armar outfits
completos (top, bottom, calzado) con cálculo en COP y alerta de
sobrepresupuesto, y gestionar tiendas y scraping desde un panel
administrativo básico.

## Arquitectura

- Frontend: Next.js, React y Tailwind CSS.
- Backend: Node.js, Express, OpenAPI, JWT y arquitectura hexagonal.
- Scraper Service: Python, FastAPI y BeautifulSoup4.
- Base de datos: PostgreSQL administrado mediante Supabase.
- Infraestructura: Docker y Docker Compose.

## Requisitos

- Git.
- Docker Desktop o Docker Engine con Docker Compose.
- Acceso a un proyecto de Supabase.

## Configuración de Supabase

Para configurar una nueva base de datos:

1. Crear un proyecto en Supabase.
2. Ejecutar backend/db/init.sql desde SQL Editor.
3. Ejecutar backend/db/supabase-security.sql.
4. Obtener la cadena de conexión mediante Session pooler.
5. Descargar el certificado SSL del proyecto.
6. Guardar el certificado en backend/certs/supabase-ca.crt.

Si se utiliza el proyecto compartido por el equipo, no es necesario
crear nuevamente las tablas.

## Variables de entorno

Copiar .env.example a un archivo llamado .env.

Configurar las siguientes variables:

- DATABASE_URL: cadena de conexión PostgreSQL de Supabase.
- DB_SSL: true.
- DB_POOL_MAX: 5.
- JWT_SECRET: clave aleatoria y segura para firmar tokens.

Las credenciales reales no deben incluirse en el repositorio.

## Ejecución

Iniciar Docker y ejecutar:

    docker compose up --build -d

Consultar el estado de los contenedores:

    docker compose ps

Detener los servicios:

    docker compose down

## Servicios disponibles

- Frontend: http://localhost:3000
- Backend: http://localhost:4000
- Backend Health: http://localhost:4000/api/health
- Swagger: http://localhost:4000/api/docs
- Scraper: http://localhost:8000/health

## Seguridad

La conexión con Supabase se realiza mediante TLS, utilizando
el certificado CA para validar la identidad del servidor.

Las tablas cuentan con Row Level Security (RLS) habilitado.
Los roles anon y authenticated no tienen permisos directos
sobre las tablas de la aplicación.

La autenticación continúa siendo gestionada por el backend
mediante JWT y bcrypt.

## Pruebas del backend

    cd backend
    npm install
    npm test

## Pruebas del scraper

    cd scraper
    pip install -r requirements.txt
    python -m unittest discover -s tests -t .

## Persistencia

La información se almacena de forma remota en Supabase,
por lo que permanece disponible después de detener,
reiniciar o reconstruir los contenedores de Docker.
