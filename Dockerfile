FROM node:20-slim

# Instalar dependencias del sistema necesarias para compilar módulos nativos
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiamos solo los archivos de dependencias primero
COPY package*.json ./

# Instalamos dependencias (esto las compilará para Linux dentro del contenedor)
RUN npm install

# Ahora copiamos el resto del código (el .dockerignore evitará copiar node_modules de Windows)
COPY . .

# Crear directorio para la base de datos persistente
RUN mkdir -p data

EXPOSE 3050

ENV DB_PATH=/app/data/monitox.db
ENV NODE_ENV=production

CMD ["node", "server.js"]
