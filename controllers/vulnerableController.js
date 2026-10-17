const { db, auditSecurityEvent } = require('../database');

/**
 * ====================================================================
 * VULNERABLE CONTROLLER
 * Intentionally insecure implementations for educational demonstration.
 * ====================================================================
 */

// 1. HOME & CATALOG
exports.getHome = (req, res) => {
    db.all("SELECT * FROM products LIMIT 6", (err, products) => {
        res.render('index', {
            title: 'CyberMart - Healthcare & Pharmacy',
            products: products || [],
            user: req.session.user || null,
            mode: 'vulnerable'
        });
    });
};

// 2. PRODUCT CATALOG & ADVANCED SQL INJECTION (Level 3 Target)
// Vulnerability: Concatenating category parameter directly into SQL string
exports.getProducts = (req, res) => {
    const category = req.query.category || '';
    let sql;

    if (category) {
        // VULNERABLE: Direct string concatenation permits ORDER BY and UNION SELECT exploitation
        sql = "SELECT id, name, category, price, description FROM products WHERE category = '" + category + "'";
    } else {
        sql = "SELECT id, name, category, price, description FROM products";
    }

    console.log('[VULNERABLE SQL QUERY]:', sql);

    db.all(sql, (err, products) => {
        if (err) {
            // Raw error displayed to client aiding injection enumeration
            return res.render('products', {
                title: 'Products Catalog [VULNERABLE]',
                products: [],
                category: category,
                sqlError: err.message,
                rawQuery: sql,
                user: req.session.user || null,
                mode: 'vulnerable'
            });
        }
        res.render('products', {
            title: 'Products Catalog [VULNERABLE]',
            products: products || [],
            category: category,
            sqlError: null,
            rawQuery: sql,
            user: req.session.user || null,
            mode: 'vulnerable'
        });
    });
};

// 3. PRODUCT DETAIL & STORED XSS (Stored XSS Target)
exports.getProductDetail = (req, res) => {
    const id = req.params.id;
    const query = "SELECT * FROM products WHERE id = " + id;

    db.get(query, (err, product) => {
        if (err || !product) {
            return res.status(404).send('Product not found');
        }

        db.all("SELECT * FROM reviews WHERE product_id = " + id + " ORDER BY created_at DESC", (err, reviews) => {
            res.render('product-detail', {
                title: product.name,
                product: product,
                reviews: reviews || [],
                user: req.session.user || null,
                mode: 'vulnerable'
            });
        });
    });
};

// Post Review - VULNERABLE: Stores raw unsanitized user comment directly into DB
exports.postProductReview = (req, res) => {
    const productId = req.params.id;
    const username = req.session.user ? req.session.user.username : (req.body.author || 'Anonymous');
    const comment = req.body.comment || '';
    const rating = parseInt(req.body.rating) || 5;

    // Direct insertion of raw comment without HTML escaping or sanitization
    const insertSql = "INSERT INTO reviews (product_id, username, comment, rating) VALUES (" +
        productId + ", '" + username.replace(/'/g, "''") + "', '" + comment.replace(/'/g, "''") + "', " + rating + ")";

    db.run(insertSql, function (err) {
        if (err) {
            console.error('[DB Error in Review]:', err.message);
        }
        res.redirect('/products/' + productId);
    });
};

// 4. SEARCH & REFLECTED XSS (Reflected XSS Target)
// Vulnerability: Query parameter directly reflected back without escaping into response
exports.getSearch = (req, res) => {
    const q = req.query.q || '';
    const searchSql = "SELECT * FROM products WHERE name LIKE '%" + q.replace(/'/g, "''") + "%' OR description LIKE '%" + q.replace(/'/g, "''") + "%'";

    db.all(searchSql, (err, products) => {
        // Query string 'q' passed directly to be rendered with unescaped HTML tag <%- query %>
        res.render('search', {
            title: 'Search Results',
            query: q,
            products: products || [],
            user: req.session.user || null,
            mode: 'vulnerable'
        });
    });
};

// 5. PROMO / PRESCRIPTION & DOM XSS / INTERMEDIATE BLIND SQLi
exports.getPromoPage = (req, res) => {
    res.render('promo', {
        title: 'Coupon & Prescription Claim',
        user: req.session.user || null,
        mode: 'vulnerable'
    });
};

// INTERMEDIATE SQL INJECTION: Blind Boolean-based & Error-based endpoint
exports.verifyCoupon = (req, res) => {
    const code = req.query.code || '';
    
    // VULNERABLE: Raw query concatenation allows Boolean Blind inference:
    // e.g. HEALTH10' AND (SELECT SUBSTR(password,1,1) FROM users WHERE username='admin')='A' --
    const sql = "SELECT * FROM coupons WHERE code = '" + code + "' AND status = 'active'";
    console.log('[BLIND SQLi QUERY]:', sql);

    db.all(sql, (err, rows) => {
        if (err) {
            // Raw error leakage facilitates Error-based SQLi
            return res.json({
                valid: false,
                error: err.message,
                query: sql
            });
        }
        if (rows && rows.length > 0) {
            return res.json({
                valid: true,
                message: 'Coupon is valid! ' + rows[0].discount_percent + '% discount applied.',
                coupon: rows[0],
                query: sql
            });
        } else {
            return res.json({
                valid: false,
                message: 'Invalid or expired coupon code.',
                query: sql
            });
        }
    });
};

// 6. EASY SQL INJECTION (Level 1: Authentication Bypass)
exports.getLogin = (req, res) => {
    res.render('login', {
        title: 'User Login',
        error: null,
        user: req.session.user || null,
        mode: 'vulnerable'
    });
};

exports.postLogin = (req, res) => {
    const username = req.body.username || '';
    const password = req.body.password || '';

    // VULNERABLE: Direct string interpolation into authentication query
    // Attack payload: admin' -- or ' OR '1'='1' --
    const sql = "SELECT * FROM users WHERE username = '" + username + "' AND password = '" + password + "'";
    console.log('[LOGIN SQL QUERY]:', sql);

    db.get(sql, (err, user) => {
        if (err) {
            return res.render('login', {
                title: 'User Login',
                error: 'SQL Error: ' + err.message,
                user: null,
                mode: 'vulnerable'
            });
        }
        if (user) {
            // Successfully authenticated (or bypassed)
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
                title: 'User Login',
                error: 'Invalid credentials. Access Denied.',
                user: null,
                mode: 'vulnerable'
            });
        }
    });
};

// 7. USER DASHBOARD & CSRF (State-Changing Action Target)
exports.getDashboard = (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    db.get("SELECT * FROM users WHERE id = ?", [req.session.user.id], (err, user) => {
        if (user) {
            req.session.user.balance = user.balance;
        }

        db.all("SELECT * FROM transfers WHERE sender_username = ? OR recipient_username = ? ORDER BY timestamp DESC LIMIT 10",
            [req.session.user.username, req.session.user.username],
            (err, transfers) => {
                res.render('dashboard', {
                    title: 'Customer Dashboard',
                    user: req.session.user,
                    transfers: transfers || [],
                    csrfToken: null, // No CSRF token in vulnerable mode
                    statusMessage: req.query.msg || null,
                    mode: 'vulnerable'
                });
            }
        );
    });
};

// VULNERABLE CSRF ENDPOINT:
// State-changing fund transfer with NO CSRF token check and lax cookie attributes
exports.postTransfer = (req, res) => {
    if (!req.session.user) {
        return res.status(401).send('Unauthorized. Please log in.');
    }

    const sender = req.session.user.username;
    const recipient = req.body.recipient;
    const amount = parseFloat(req.body.amount);

    if (!recipient || isNaN(amount) || amount <= 0) {
        return res.redirect('/dashboard?msg=Invalid+transfer+parameters');
    }

    // Verify sender balance
    db.get("SELECT balance FROM users WHERE username = ?", [sender], (err, row) => {
        if (err || !row || row.balance < amount) {
            return res.redirect('/dashboard?msg=Insufficient+funds');
        }

        // Check if recipient exists
        db.get("SELECT id FROM users WHERE username = ?", [recipient], (err, recRow) => {
            if (err || !recRow) {
                return res.redirect('/dashboard?msg=Recipient+not+found');
            }

            // Execute transfer
            db.serialize(() => {
                db.run("UPDATE users SET balance = balance - ? WHERE username = ?", [amount, sender]);
                db.run("UPDATE users SET balance = balance + ? WHERE username = ?", [amount, recipient]);
                db.run("INSERT INTO transfers (sender_username, recipient_username, amount) VALUES (?, ?, ?)",
                    [sender, recipient, amount]);
                
                auditSecurityEvent('UNPROTECTED_TRANSFER', { sender, recipient, amount });
                console.log(`[CSRF ALERT / VULN TRANSFER]: Transferred $${amount} from ${sender} to ${recipient}`);
                res.redirect('/dashboard?msg=Successfully+transferred+$' + amount + '+to+' + encodeURIComponent(recipient));
            });
        });
    });
};

// Change Email - Also susceptible to CSRF
exports.postChangeEmail = (req, res) => {
    if (!req.session.user) return res.status(401).send('Unauthorized');
    const newEmail = req.body.email;
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
