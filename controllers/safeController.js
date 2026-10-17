const { db, auditSecurityEvent } = require('../database');
const crypto = require('crypto');

/**
 * ====================================================================
 * SAFE / HARDENED CONTROLLER
 * Comprehensive Blue Team defenses against XSS, CSRF, and SQL Injection.
 * ====================================================================
 */

// Defensive Helper: Robust HTML entity encoder to neutralize XSS
function escapeHtml(str) {
    if (!str || typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// 1. HOME & CATALOG (Safe Mode)
exports.getHome = (req, res) => {
    db.all("SELECT * FROM products LIMIT 6", [], (err, products) => {
        res.render('index', {
            title: 'CyberMart - Healthcare & Pharmacy [SECURE]',
            products: products || [],
            user: req.session.user || null,
            mode: 'safe'
        });
    });
};

// 2. PRODUCT CATALOG - DEFENSE AGAINST ADVANCED SQL INJECTION (Level 3 Defense)
// Defense: Parameterized Queries (Prepared Statements) completely separates code from data
exports.getProducts = (req, res) => {
    const category = req.query.category || '';
    let sql;
    let params = [];

    if (category) {
        // SECURE: Parameterized query using placeholder (?)
        sql = "SELECT id, name, category, price, description FROM products WHERE category = ?";
        params.push(category);
    } else {
        sql = "SELECT id, name, category, price, description FROM products";
    }

    console.log('[SAFE PARAMETERIZED SQL]:', sql, 'Params:', params);

    db.all(sql, params, (err, products) => {
        if (err) {
            // SECURE: Generic safe error message. No internal SQL/schema leaked.
            return res.render('products', {
                title: 'Products Catalog [SECURE]',
                products: [],
                category: escapeHtml(category),
                sqlError: 'Unable to retrieve catalog data due to an internal query issue.',
                rawQuery: null,
                user: req.session.user || null,
                mode: 'safe'
            });
        }
        res.render('products', {
            title: 'Products Catalog [SECURE]',
            products: products || [],
            category: escapeHtml(category),
            sqlError: null,
            rawQuery: null,
            user: req.session.user || null,
            mode: 'safe'
        });
    });
};

// 3. PRODUCT DETAIL & DEFENSE AGAINST STORED XSS
exports.getProductDetail = (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
        return res.status(400).send('Invalid product identifier.');
    }

    // SECURE: Parameterized query for product retrieval
    db.get("SELECT * FROM products WHERE id = ?", [id], (err, product) => {
        if (err || !product) {
            return res.status(404).send('Product not found');
        }

        db.all("SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC", [id], (err, reviews) => {
            // SECURE: EJS template renders <%= review.comment %>, which escapes HTML entities.
            // Furthermore, we ensure all strings are safely handled.
            res.render('product-detail', {
                title: product.name + ' [SECURE]',
                product: product,
                reviews: reviews || [],
                user: req.session.user || null,
                mode: 'safe'
            });
        });
    });
};

// Post Review - DEFENSE: Strict input validation and parameterized insertion
exports.postProductReview = (req, res) => {
    const productId = parseInt(req.params.id, 10);
    const username = req.session.user ? req.session.user.username : (req.body.author || 'Anonymous');
    const comment = req.body.comment ? req.body.comment.trim() : '';
    const rating = Math.min(5, Math.max(1, parseInt(req.body.rating) || 5));

    if (isNaN(productId) || !comment) {
        return res.redirect('/products/' + productId);
    }

    // SECURE: Input sanitization + parameterized SQL insertion
    const sanitizedComment = escapeHtml(comment);

    db.run(
        "INSERT INTO reviews (product_id, username, comment, rating) VALUES (?, ?, ?, ?)",
        [productId, escapeHtml(username), sanitizedComment, rating],
        function (err) {
            if (err) {
                console.error('[Safe Review Error]:', err.message);
            }
            res.redirect('/products/' + productId);
        }
    );
};

// 4. SEARCH & DEFENSE AGAINST REFLECTED XSS
// Defense: Context-aware output encoding (HTML entities) & Parameterized SQL search
exports.getSearch = (req, res) => {
    const rawQ = req.query.q || '';
    const safeQ = escapeHtml(rawQ);
    const searchTerm = `%${rawQ}%`;

    // SECURE: Parameterized search query prevents SQL injection
    db.all(
        "SELECT * FROM products WHERE name LIKE ? OR description LIKE ?",
        [searchTerm, searchTerm],
        (err, products) => {
            // Query is passed with HTML-encoding and rendered using <%= %> safe context
            res.render('search', {
                title: 'Search Results [SECURE]',
                query: safeQ,
                products: products || [],
                user: req.session.user || null,
                mode: 'safe'
            });
        }
    );
};

// 5. PROMO / PRESCRIPTION & DEFENSE AGAINST INTERMEDIATE BLIND SQLi
exports.getPromoPage = (req, res) => {
    res.render('promo', {
        title: 'Coupon & Prescription Claim [SECURE]',
        user: req.session.user || null,
        mode: 'safe'
    });
};

// INTERMEDIATE SQL INJECTION DEFENSE:
// Parameterized query blocks boolean and error-based blind SQLi completely
exports.verifyCoupon = (req, res) => {
    const code = req.query.code || '';

    // SECURE: Parameterized query eliminates SQL injection vectors
    db.get("SELECT code, discount_percent FROM coupons WHERE code = ? AND status = 'active'", [code], (err, row) => {
        if (err) {
            // Generic message; no database errors or stack traces leaked
            return res.json({
                valid: false,
                message: 'Error verifying coupon. Please try again later.'
            });
        }
        if (row) {
            return res.json({
                valid: true,
                message: `Valid coupon! ${row.discount_percent}% discount verified.`,
                coupon: { code: row.code, discount_percent: row.discount_percent }
            });
        } else {
            return res.json({
                valid: false,
                message: 'Invalid or expired coupon code.'
            });
        }
    });
};

// 6. LOGIN & DEFENSE AGAINST EASY SQL INJECTION (Authentication Bypass)
exports.getLogin = (req, res) => {
    res.render('login', {
        title: 'User Login [SECURE]',
        error: null,
        user: req.session.user || null,
        mode: 'safe'
    });
};

exports.postLogin = (req, res) => {
    const username = req.body.username || '';
    const password = req.body.password || '';

    // SECURE: Parameterized prepared statement ensures quotes and operators are treated strictly as literals
    const sql = "SELECT * FROM users WHERE username = ? AND password = ?";

    db.get(sql, [username, password], (err, user) => {
        if (err) {
            return res.render('login', {
                title: 'User Login [SECURE]',
                error: 'An unexpected system error occurred. Please try again.',
                user: null,
                mode: 'safe'
            });
        }
        if (user) {
            req.session.user = {
                id: user.id,
                username: user.username,
                role: user.role,
                email: user.email,
                balance: user.balance
            };
            return res.redirect('/dashboard');
        } else {
            return res.render('login', {
                title: 'User Login [SECURE]',
                error: 'Invalid username or password. Authentication failed.',
                user: null,
                mode: 'safe'
            });
        }
    });
};

// 7. USER DASHBOARD & DEFENSE AGAINST CSRF
exports.getDashboard = (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    // Ensure session CSRF token exists
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }

    db.get("SELECT * FROM users WHERE id = ?", [req.session.user.id], (err, user) => {
        if (user) {
            req.session.user.balance = user.balance;
        }

        db.all("SELECT * FROM transfers WHERE sender_username = ? OR recipient_username = ? ORDER BY timestamp DESC LIMIT 10",
            [req.session.user.username, req.session.user.username],
            (err, transfers) => {
                res.render('dashboard', {
                    title: 'Customer Dashboard [SECURE]',
                    user: req.session.user,
                    transfers: transfers || [],
                    csrfToken: req.session.csrfToken, // Anti-CSRF token supplied to form
                    statusMessage: req.query.msg ? escapeHtml(req.query.msg) : null,
                    mode: 'safe'
                });
            }
        );
    });
};

// SECURE CSRF DEFENSE: Synchronizer Token Pattern + SameSite=Strict verification
exports.postTransfer = (req, res) => {
    if (!req.session.user) {
        return res.status(401).send('Unauthorized. Please log in.');
    }

    // Anti-CSRF Token Validation
    const submittedToken = req.body._csrf || req.headers['x-csrf-token'];
    if (!submittedToken || submittedToken !== req.session.csrfToken) {
        console.warn(`[CSRF DEFENSE TRIGGERED]: Blocked unauthorized transfer attempt from user ${req.session.user.username}`);
        return res.status(403).render('dashboard', {
            title: 'Customer Dashboard [SECURE]',
            user: req.session.user,
            transfers: [],
            csrfToken: req.session.csrfToken,
            statusMessage: 'SECURITY ERROR: Invalid or missing anti-CSRF token. Request rejected.',
            mode: 'safe'
        });
    }

    const sender = req.session.user.username;
    const recipient = (req.body.recipient || '').trim();
    const amount = parseFloat(req.body.amount);

    if (!recipient || isNaN(amount) || amount <= 0) {
        return res.redirect('/dashboard?msg=Invalid+transfer+parameters');
    }

    // Secure balance verification and transaction execution
    db.get("SELECT balance FROM users WHERE username = ?", [sender], (err, row) => {
        if (err || !row || row.balance < amount) {
            return res.redirect('/dashboard?msg=Insufficient+funds');
        }

        db.get("SELECT id FROM users WHERE username = ?", [recipient], (err, recRow) => {
            if (err || !recRow) {
                return res.redirect('/dashboard?msg=Recipient+not+found');
            }

            db.serialize(() => {
                db.run("UPDATE users SET balance = balance - ? WHERE username = ?", [amount, sender]);
                db.run("UPDATE users SET balance = balance + ? WHERE username = ?", [amount, recipient]);
                db.run("INSERT INTO transfers (sender_username, recipient_username, amount) VALUES (?, ?, ?)",
                    [sender, recipient, amount]);
                
                auditSecurityEvent('PROTECTED_TRANSFER', { sender, recipient, amount });
                res.redirect('/dashboard?msg=Successfully+transferred+$' + amount + '+to+' + encodeURIComponent(recipient));
            });
        });
    });
};

exports.postChangeEmail = (req, res) => {
    if (!req.session.user) return res.status(401).send('Unauthorized');
    
    // Anti-CSRF Token Validation
    const submittedToken = req.body._csrf || req.headers['x-csrf-token'];
    if (!submittedToken || submittedToken !== req.session.csrfToken) {
        return res.status(403).send('SECURITY ERROR: CSRF validation failed.');
    }

    const newEmail = escapeHtml(req.body.email || '');
    db.run("UPDATE users SET email = ? WHERE id = ?", [newEmail, req.session.user.id], (err) => {
        if (!err) req.session.user.email = newEmail;
        res.redirect('/dashboard?msg=Email+updated+successfully');
    });
};

exports.logout = (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
};
