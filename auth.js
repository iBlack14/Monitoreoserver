const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
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
  return apiKeys.has(apiKey) && apiKeys.get(apiKey).active;
}

/**
 * Get client info by API key
 */
function getClientByApiKey(apiKey) {
  return apiKeys.get(apiKey);
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
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    return generateToken(username);
  }
  return null;
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
  getAllClients,
  deactivateClient,
  removeClient
};
