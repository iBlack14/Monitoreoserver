const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { adminOps, deviceOps } = require('./database');
require('dotenv').config();

// In-memory storage (can be replaced with database)
const apiKeys = new Map();
const clients = new Map();

/**
 * Generate a unique API key for a client
 */
function generateApiKey(clientName, metadata = {}) {
  const apiKey = uuidv4();
  const clientData = {
    apiKey,
    name: clientName,
    createdAt: new Date(),
    metadata,
    active: true
  };

  apiKeys.set(apiKey, clientData);
  clients.set(clientName, clientData);

  return apiKey;
}

/**
 * Validate API key
 */
function validateApiKey(apiKey) {
  // Para simplificar ahora, cualquier equipo que se identifique se registra en DB
  // En una fase más avanzada, aquí filtraríamos por llaves permitidas
  return !!apiKey;
}

/**
 * Get client info by API key
 */
function getClientByApiKey(apiKey) {
  // Si no existe en DB, lo creamos dinámicamente o devolvemos datos básicos
  const dbDevice = deviceOps.getById(apiKey);
  if (dbDevice) return dbDevice;
  return { id: apiKey, name: "Dispositivo Nuevo" };
}

/**
 * Generate JWT token for admin dashboard
 */
function generateToken(username) {
  return jwt.sign(
    { username, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Authenticate admin credentials
 */
function authenticateAdmin(username, password) {
  const admin = adminOps.getByUsername(username);
  if (admin && bcrypt.compareSync(password, admin.password)) {
    return generateToken(username);
  }
  return null;
}

/**
 * Change admin password
 */
function changeAdminPassword(username, oldPassword, newPassword) {
  const admin = adminOps.getByUsername(username);
  if (admin && bcrypt.compareSync(oldPassword, admin.password)) {
    adminOps.updatePassword(username, newPassword);
    return true;
  }
  return false;
}

/**
 * Get all registered clients
 */
function getAllClients() {
  return Array.from(clients.values());
}

/**
 * Deactivate a client
 */
function deactivateClient(apiKey) {
  if (apiKeys.has(apiKey)) {
    apiKeys.get(apiKey).active = false;
    return true;
  }
  return false;
}

/**
 * Remove a client completely
 */
function removeClient(apiKey) {
  const client = apiKeys.get(apiKey);
  if (client) {
    clients.delete(client.name);
    apiKeys.delete(apiKey);
    return true;
  }
  return false;
}

module.exports = {
  generateApiKey,
  validateApiKey,
  getClientByApiKey,
  generateToken,
  verifyToken,
  authenticateAdmin,
  changeAdminPassword,
  getAllClients,
  deactivateClient,
  removeClient
};
