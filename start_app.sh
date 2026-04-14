#!/bin/bash

set -e

PROJECT_DIR="$HOME/cardcontrol-devops"

echo "Iniciando aplicación CardControl..."
cd "$PROJECT_DIR"
docker compose up -d
echo "Aplicación iniciada."