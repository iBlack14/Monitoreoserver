const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Configuración de la ruta de la base de datos
// En Docker buscamos en /app/data/monitox.db, localmente en el directorio actual
const dbPath = process.env.DB_PATH || path.join(__dirname, 'monitox.db');
const db = new Database(dbPath);

// Inicializar la base de datos
function initDb() {
    console.log('📦 Inicializando Base de Datos SQLite...');

    // Tabla de Administradores
    db.prepare(`
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    // Tabla de Dispositivos (Equipos)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS devices (
            id TEXT PRIMARY KEY, -- Esto será la API Key
            name TEXT NOT NULL,
            group_name TEXT DEFAULT 'General',
            os_info TEXT,
            last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    // Migración para añadir columna group_name si ya existe la tabla
    try {
        db.prepare('ALTER TABLE devices ADD COLUMN group_name TEXT DEFAULT "General"').run();
    } catch (error) {
        // Ignorar error si la columna ya existe
    }

    // Tabla de Registros (Logs)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT,
            type TEXT NOT NULL, -- info, warn, success, danger
            message TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (device_id) REFERENCES devices(id)
        )
    `).run();

    // Crear usuario admin por defecto si no existe
    const adminExists = db.prepare('SELECT count(*) as count FROM admins WHERE username = ?').get('admin');
    if (adminExists.count === 0) {
        const hashedPassword = bcrypt.hashSync('admin123', 10);
        db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run('admin', hashedPassword);
        console.log('✅ Usuario Admin creado por defecto (admin / admin123)');
    }

    console.log('✅ Estructura de Base de Datos lista.');
}

// Funciones para Dispositivos
const deviceOps = {
    upsert: (id, name, osInfo) => {
        const stmt = db.prepare(`
            INSERT INTO devices (id, name, os_info, last_seen) 
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET 
                name = excluded.name,
                os_info = excluded.os_info,
                last_seen = CURRENT_TIMESTAMP
        `);
        return stmt.run(id, name, osInfo);
    },
    getById: (id) => db.prepare('SELECT * FROM devices WHERE id = ?').get(id),
    getAll: () => db.prepare('SELECT * FROM devices ORDER BY last_seen DESC').all(),
    updateGroup: (id, groupName) => {
        return db.prepare('UPDATE devices SET group_name = ? WHERE id = ?').run(groupName, id);
    }
};

// Funciones para Logs
const logOps = {
    add: (deviceId, type, message) => {
        return db.prepare('INSERT INTO logs (device_id, type, message) VALUES (?, ?, ?)').run(deviceId, type, message);
    },
    getLatest: (limit = 50) => {
        return db.prepare(`
            SELECT logs.*, devices.name as device_name 
            FROM logs 
            LEFT JOIN devices ON logs.device_id = devices.id 
            ORDER BY timestamp DESC LIMIT ?
        `).all(limit);
    }
};

// Funciones para Admin
const adminOps = {
    getByUsername: (username) => db.prepare('SELECT * FROM admins WHERE username = ?').get(username),
    updatePassword: (username, newPassword) => {
        const hash = bcrypt.hashSync(newPassword, 10);
        return db.prepare('UPDATE admins SET password = ? WHERE username = ?').run(hash, username);
    }
};

module.exports = {
    initDb,
    deviceOps,
    logOps,
    adminOps,
    db // Por si necesitamos queries directas
};
