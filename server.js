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
        methods: ['GET', 'POST']
    },
    maxHttpBufferSize: 5e6 // 5MB for large screenshots
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
    if (require('fs').existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send(`
            <div style="font-family: sans-serif; padding: 50px; text-align: center;">
                <h1 style="color: #ff4444;">🚨 Dashboard no encontrado</h1>
                <p>El archivo <code>dashboard/index.html</code> no existe en el servidor.</p>
                <p>Asegúrate de haber ejecutado <code>npm run build</code> en el frontend y copiado los archivos a la carpeta <code>server/dashboard</code>.</p>
                <hr>
                <p style="color: #777;">Monitox Pro Server v1.0.0</p>
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
