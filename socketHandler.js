const { validateApiKey, getClientByApiKey, verifyToken } = require('./auth');
const { deviceOps, logOps } = require('./database');

// Store active connections
const activeClients = new Map();
const adminSockets = new Set();

function setupSocketHandlers(io) {
    io.on('connection', (socket) => {
        console.log(`[Socket] Nueva conexión: ${socket.id}`);

        // Client authentication
        socket.on('authenticate-client', (data) => {
            const { apiKey, clientInfo } = data;

            if (!validateApiKey(apiKey)) {
                socket.emit('auth-error', { message: 'API Key inválida' });
                socket.disconnect();
                return;
            }

            const dbDevice = deviceOps.getById(apiKey);
            const group = dbDevice ? dbDevice.group_name : 'General';

            const clientData = {
                socketId: socket.id,
                apiKey,
                name: client.name,
                group: group,
                info: clientInfo || {},
                connectedAt: new Date(),
                lastScreenshot: null,
                status: 'connected'
            };

            activeClients.set(socket.id, clientData);
            socket.clientData = clientData;
            socket.join('clients');

            // Persistence: Upsert device to DB
            deviceOps.upsert(socket.id, client.name, JSON.stringify(clientInfo));
            logOps.add(socket.id, 'success', `Dispositivo conectado: ${client.name}`);

            console.log(`[Client] Autenticado: ${client.name} (${socket.id})`);

            socket.emit('auth-success', {
                message: 'Autenticado correctamente',
                clientId: socket.id
            });

            // Notify all admins about new client
            // Notify all admins about new client
            broadcastToAdmins('client-connected', {
                socketId: socket.id,
                id: apiKey, // Persistent ID
                name: client.name,
                group: group,
                info: clientInfo,
                connectedAt: clientData.connectedAt
            });
        });

        // Admin authentication
        socket.on('authenticate-admin', (data) => {
            const { token } = data;

            const decoded = verifyToken(token);
            if (!decoded) {
                socket.emit('auth-error', { message: 'Token inválido' });
                socket.disconnect();
                return;
            }

            adminSockets.add(socket.id);
            socket.isAdmin = true;
            socket.join('admins');

            console.log(`[Admin] Autenticado: ${decoded.username} (${socket.id})`);

            socket.emit('auth-success', {
                message: 'Admin autenticado',
                role: 'admin'
            });

            // Send current active clients to admin
            const clientsList = Array.from(activeClients.values()).map(c => ({
                socketId: c.socketId,
                id: c.apiKey, // Persistent ID
                name: c.name,
                group: c.group,
                info: c.info,
                connectedAt: c.connectedAt,
                status: c.status
            }));

            socket.emit('clients-list', clientsList);
        });

        // Receive screenshot from client
        socket.on('screen-data', (data) => {
            if (!socket.clientData) {
                return;
            }

            const client = activeClients.get(socket.id);
            if (client) {
                client.lastScreenshot = new Date();

                // Broadcast to all admins
                broadcastToAdmins('screen-update', {
                    socketId: socket.id,
                    name: client.name,
                    screenshot: data.screenshot,
                    stats: data.stats, // Pasar las estadísticas (CPU, RAM, Procesos)
                    timestamp: data.timestamp,
                    quality: data.quality
                });
            }
        });

        // Admin requests client info
        socket.on('request-client-info', (clientSocketId) => {
            if (!socket.isAdmin) return;

            const client = activeClients.get(clientSocketId);
            if (client) {
                socket.emit('client-info', {
                    socketId: client.socketId,
                    name: client.name,
                    info: client.info,
                    connectedAt: client.connectedAt,
                    lastScreenshot: client.lastScreenshot,
                    status: client.status
                });
            }
        });

        // Admin controls (pause, resume, disconnect)
        socket.on('control-client', (data) => {
            if (!socket.isAdmin) return;

            const { socketId, action } = data;
            const targetSocket = io.sockets.sockets.get(socketId);

            if (targetSocket) {
                targetSocket.emit('control-command', { action });
                console.log(`[Control] Admin ${socket.id} envió comando '${action}' a cliente ${socketId}`);
            }
        });

        // Terminal Remota: Proxy de Admin a Cliente
        socket.on('terminal-command', (data) => {
            if (!socket.isAdmin) return;
            const { targetSocketId, command } = data;
            const targetSocket = io.sockets.sockets.get(targetSocketId);

            if (targetSocket) {
                // Loguear el comando en la DB
                logOps.add(targetSocketId, 'info', `Terminal: ${command}`);

                targetSocket.emit('terminal-command', {
                    command,
                    adminSocketId: socket.id
                });
            }
        });

        // Terminal Remota: Proxy de Cliente a Admin
        socket.on('terminal-output', (data) => {
            const { adminSocketId, output, command } = data;
            const adminSocket = io.sockets.sockets.get(adminSocketId);

            if (adminSocket) {
                adminSocket.emit('terminal-output', {
                    output,
                    command,
                    clientSocketId: socket.id
                });
            }
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            console.log(`[Socket] Desconexión: ${socket.id}`);

            // If it was a client
            if (activeClients.has(socket.id)) {
                const client = activeClients.get(socket.id);
                activeClients.delete(socket.id);

                logOps.add(socket.id, 'warn', `Dispositivo desconectado: ${client.name}`);
                console.log(`[Client] Desconectado: ${client.name}`);

                // Notify admins
                broadcastToAdmins('client-disconnected', {
                    socketId: socket.id,
                    name: client.name
                });
            }

            // If it was an admin
            if (adminSockets.has(socket.id)) {
                adminSockets.delete(socket.id);
                console.log(`[Admin] Desconectado: ${socket.id}`);
            }
        });

        // Error handling
        socket.on('error', (error) => {
            console.error(`[Socket Error] ${socket.id}:`, error);
        });
    });

    // Helper function to broadcast to all admins
    function broadcastToAdmins(event, data) {
        io.to('admins').emit(event, data);
    }

    // Return utility functions
    return {
        getActiveClients: () => Array.from(activeClients.values()),
        getAdminCount: () => adminSockets.size,
        broadcastToAdmins
    };
}

module.exports = { setupSocketHandlers };
