#!/bin/bash
echo "Создаю структуру CRM..."
mkdir -p backend/app/{models,routers,schemas} frontend/src/{components,pages} nginx data/postgres

cat > docker-compose.yml << 'COMPOSE'
version: '3.8'
services:
  db:
    image: postgres:15
    restart: always
    environment:
      POSTGRES_DB: labcrm
      POSTGRES_USER: labuser
      POSTGRES_PASSWORD: LabCRM2025secure
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build: ./backend
    restart: always
    environment:
      DATABASE_URL: postgresql://labuser:LabCRM2025secure@db:5432/labcrm
      SECRET_KEY: rutest-secret-key-2025
    ports:
      - "8000:8000"
    depends_on:
      - db

  frontend:
    build: ./frontend
    restart: always
    ports:
      - "3000:80"
    depends_on:
      - backend

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - backend
      - frontend
COMPOSE

echo "✓ docker-compose.yml создан"
