const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const auth = require('./auth');
const { setupSocketHandlers } = require('./socketHandler');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true
    },
    path: '/socket.io/',
    transports: ['websocket', 'polling'], // Permitir ambos para compatibilidad con proxies
    maxHttpBufferSize: 5e6, // 5MB for large screenshots
    pingTimeout: 60000,
    pingInterval: 25000
});

const PORT = process.env.PORT || 3050; // Fallback to 3050 to match Dockerfile

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (dashboard)
app.use(express.static(path.join(__dirname, 'dashboard')));

// Setup WebSocket handlers
const socketUtils = setupSocketHandlers(io);

// ========== REST API ENDPOINTS ==========

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        activeClients: socketUtils.getActiveClients().length,
        activeAdmins: socketUtils.getAdminCount()
    });
});

// Admin login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    const token = auth.authenticateAdmin(username, password);

    if (token) {
        res.json({
            success: true,
            token,
            message: 'Login exitoso'
        });
    } else {
        res.status(401).json({
            success: false,
            message: 'Credenciales inválidas'
        });
    }
});

// Generate API key for new client
app.post('/api/clients/register', (req, res) => {
    const { clientName, metadata } = req.body;

    if (!clientName) {
        return res.status(400).json({
            success: false,
            message: 'Nombre de cliente requerido'
        });
    }

    const apiKey = auth.generateApiKey(clientName, metadata || {});

    res.json({
        success: true,
        apiKey,
        clientName,
        message: 'API Key generada exitosamente'
    });
});

// Get all registered clients
app.get('/api/clients', (req, res) => {
    const clients = auth.getAllClients();
    res.json({
        success: true,
        clients
    });
});

// Deactivate a client
app.post('/api/clients/deactivate', (req, res) => {
    const { apiKey } = req.body;

    const result = auth.deactivateClient(apiKey);

    if (result) {
        res.json({
            success: true,
            message: 'Cliente desactivado'
        });
    } else {
        res.status(404).json({
            success: false,
            message: 'Cliente no encontrado'
        });
    }
});

// Get active connections
app.get('/api/connections/active', (req, res) => {
    const activeClients = socketUtils.getActiveClients();
    res.json({
        success: true,
        activeClients,
        count: activeClients.length
    });
});

// Serve dashboard
const serveDashboard = (req, res) => {
    const indexPath = path.join(__dirname, 'dashboard/index.html');
    const fs = require('fs');

    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        // Listamos archivos para debugear en el log de Easypanel
        const filesInApp = fs.readdirSync(__dirname);
        const dashboardExists = fs.existsSync(path.join(__dirname, 'dashboard'));
        let dashboardFiles = [];
        if (dashboardExists) {
            dashboardFiles = fs.readdirSync(path.join(__dirname, 'dashboard'));
        }

        console.error('--- DEBUG DASHBOARD ---');
        console.error('Directorio actual:', __dirname);
        console.error('Archivos en /app:', filesInApp);
        console.error('¿Existe carpeta dashboard?:', dashboardExists);
        if (dashboardExists) console.error('Archivos en /dashboard:', dashboardFiles);
        console.error('-----------------------');

        res.status(404).send(`
            <div style="font-family: sans-serif; padding: 50px; text-align: center; background: #1a1a1a; color: white; min-height: 100vh;">
                <h1 style="color: #ff4444; font-size: 3rem;">🚨 Dashboard no encontrado</h1>
                <p style="font-size: 1.2rem;">El archivo <code>dashboard/index.html</code> no existe en el contenedor.</p>
                
                <div style="background: #333; padding: 20px; border-radius: 8px; display: inline-block; text-align: left; margin: 20px 0;">
                    <p><strong>Estado del sistema:</strong></p>
                    <ul>
                        <li>Ruta actual: <code>${__dirname}</code></li>
                        <li>Carpeta dashboard: <code>${dashboardExists ? '✅ Existe' : '❌ NO existe'}</code></li>
                        <li>Archivos en dashboard: <code>${dashboardFiles.length > 0 ? dashboardFiles.join(', ') : 'Ninguno'}</code></li>
                    </ul>
                </div>

                <p>Asegúrate de haber ejecutado <code>npm run build</code> localmente y haber hecho <code>git push</code> de la carpeta <code>server/dashboard</code>.</p>
                <hr style="border: 0; border-top: 1px solid #444; margin: 40px 0;">
                <p style="color: #777;">Monitox Pro Server v1.0.1 | Debug Mode</p>
            </div>
        `);
    }
};

app.get('/', serveDashboard);
app.get('/dashboard', serveDashboard);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint no encontrado'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🟢 SISTEMA DE MONITOREO EN TIEMPO REAL                 ║
║                                                           ║
║   Servidor corriendo en: http://localhost:${PORT}         ║
║   Dashboard: http://localhost:${PORT}/dashboard           ║
║                                                           ║
║   Estado: ACTIVO ✓                                       ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);

    // Generate a default API key for testing
    const defaultApiKey = auth.generateApiKey('Cliente-Demo', {
        location: 'Test',
        description: 'Cliente de prueba generado automáticamente'
    });

    console.log('\n📋 API Key de prueba generada:');
    console.log(`   ${defaultApiKey}`);
    console.log('\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM recibido, cerrando servidor...');
    server.close(() => {
        console.log('Servidor cerrado');
        process.exit(0);
    });
});
