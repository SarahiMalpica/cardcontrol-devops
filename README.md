# CardControl DevOps

CardControl es una aplicación web para registrar y consultar información de tarjetas de crédito, incluyendo banco, nombre de tarjeta,limite y saldo actual

## Arquitectura
La solución está compuesta por:
- Frontend en HTML, CSS y JavaScript servido con Nginx
- Backend en Flask
- Base de datos MongoDB
- Docker Compose para orquestación
- Logs en el servidor
- AWS EC2 para despliegue
- AWS S3 para almacenamiento de logs
- CloudFormation para infraestructura como código

## Tecnologías utilizadas
- HTML
- CSS
- JavaScript
- Flask
- MongoDB
- Docker
- Docker Compose
- Bash
- AWS EC2
- AWS S3
- AWS CloudFormation

## Instrucciones de ejecución local
1. Tener Docker Desktop instalado.
2. Abrir una terminal en la raíz del proyecto.
3. Ejecutar:

```bash
docker compose up --build -d