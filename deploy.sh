#!/bin/bash

set -e

REPO_URL="https://github.com/SarahiMalpica/cardcontrol-devops.git"
PROJECT_DIR="$HOME/cardcontrol-devops"
BRANCH="main"

echo "Iniciando despliegue de CardControl..."

if ! command -v git >/dev/null 2>&1; then
  echo "Error: Git no está instalado."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: Docker no está instalado."
  exit 1
fi

if [ ! -d "$PROJECT_DIR" ]; then
  echo "El proyecto no existe en $PROJECT_DIR"
  echo "Clonando repositorio..."
  git clone -b "$BRANCH" "$REPO_URL" "$PROJECT_DIR"
else
  echo "El proyecto ya existe. Actualizando cambios..."
  cd "$PROJECT_DIR"
  git pull origin "$BRANCH" || true
fi

cd "$PROJECT_DIR"

echo "Deteniendo contenedores anteriores..."
docker compose down || true

echo "Construyendo y levantando contenedores..."
docker compose up --build -d

echo "Despliegue completado."
docker ps