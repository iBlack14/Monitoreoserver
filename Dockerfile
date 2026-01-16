FROM node:20-slim

# Instalar dependencias del sistema necesarias para compilar módulos nativos (better-sqlite3)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

# Instalar dependencias de producción
RUN npm install

COPY . .

# Crear directorio para la base de datos si no existe
RUN mkdir -p data

EXPOSE 3050

# Variable de entorno para la ruta de la DB (opcional, pero buena práctica)
ENV DB_PATH=/app/data/monitox.db

CMD ["node", "server.js"]
