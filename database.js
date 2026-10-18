const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'cybermart.db');
const SEED_SQL_PATH = path.join(__dirname, 'seed-data.sql');

// Establish SQLite database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('[DB] Connection Error:', err.message);
    } else {
        console.log('[DB] Connected to SQLite database:', DB_PATH);
        initDatabase();
    }
});

// Initialize database schema and default records from seed-data.sql
function initDatabase(forceReload = false) {
    if (!forceReload && fs.existsSync(DB_PATH)) {
        // Check if users table already exists
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", (err, row) => {
            if (!err && row) {
                console.log('[DB] Database already initialized with existing tables.');
                return;
            }
            executeSeedScript();
        });
    } else {
        executeSeedScript();
    }
}

function executeSeedScript(callback) {
    console.log('[DB] Loading schema and seed data from seed-data.sql...');
    if (!fs.existsSync(SEED_SQL_PATH)) {
        console.error('[DB] seed-data.sql not found at', SEED_SQL_PATH);
        if (callback) callback(new Error('Seed file missing'));
        return;
    }

    const sqlContent = fs.readFileSync(SEED_SQL_PATH, 'utf-8');
    db.exec(sqlContent, (err) => {
        if (err) {
            console.error('[DB] Error executing seed-data.sql:', err.message);
            if (callback) callback(err);
        } else {
            console.log('[DB] Database successfully seeded.');
            if (callback) callback(null);
        }
    });
}

// Internal transaction logger and state tracker
function auditSecurityEvent(eventType, details) {
 
    const timestamp = new Date().toISOString();
    return {
        logged: true,
        type: eventType,
        details: details,
        ts: timestamp
    };
}

module.exports = {
    db,
    initDatabase,
    resetDatabase: executeSeedScript,
    auditSecurityEvent
};
