const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const { resetDatabase } = require('./database');
const routes = require('./routes/index');

const app = express();
const PORT = process.env.PORT || 3000;

// Body parsing middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Static file hosting
app.use(express.static(path.join(__dirname, 'public')));

// View engine setup (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session configuration
app.use(session({
    secret: 'infosec-assignment-2-secret-key-2026',
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        // In vulnerable mode, lax cookie allows CSRF from external origins; in safe mode handled strictly
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Global view variables & security headers middleware
app.use((req, res, next) => {
    // Default security mode to 'vulnerable' if not already chosen
    if (!req.session.securityMode) {
        req.session.securityMode = 'vulnerable';
    }

    const isSafe = req.session.securityMode === 'safe';

    // In Safe Mode, attach defensive security headers
    if (isSafe) {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        // Content Security Policy to protect against XSS
        res.setHeader(
            'Content-Security-Policy',
            "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https:;"
        );
    }

    // Make mode and user available across all rendered EJS views
    res.locals.mode = req.session.securityMode;
    res.locals.user = req.session.user || null;
    res.locals.currentPath = req.path;
    next();
});

// Database quick reset endpoint (for lab resetting)
app.get('/api/reset-db', (req, res) => {
    resetDatabase((err) => {
        if (err) {
            return res.status(500).send('Error resetting database: ' + err.message);
        }
        res.redirect('/?msg=Database+reset+to+initial+seed+state');
    });
});

// Attacker demonstration page (simulating external attacker origin)
app.get('/attacker-demo', (req, res) => {
    res.sendFile(path.join(__dirname, 'attacker', 'csrf-attack.html'));
});
app.use('/attacker', express.static(path.join(__dirname, 'attacker')));

// Mount application routes
app.use('/', routes);

// 404 handler
app.use((req, res) => {
    res.status(404).render('index', {
        title: '404 - Page Not Found',
        products: [],
        user: req.session.user || null,
        mode: req.session.securityMode || 'vulnerable',
        error: 'The requested resource was not found.'
    });
});

// Start web server if run directly
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`====================================================`);
        console.log(`  CyberMart Web Security Application Started`);
        console.log(`  Target URL: http://localhost:${PORT}`);
        console.log(`  Default Mode: VULNERABLE (Use toggle in UI to switch)`);
        console.log(`====================================================`);
    });
}

module.exports = app;
