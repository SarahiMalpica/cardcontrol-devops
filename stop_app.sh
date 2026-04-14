#!/bin/bash

set -e

PROJECT_DIR="$HOME/cardcontrol-devops"

echo "Deteniendo aplicación CardControl..."
cd "$PROJECT_DIR"
docker compose down
echo "Aplicación detenida."