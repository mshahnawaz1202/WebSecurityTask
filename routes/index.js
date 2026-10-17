const express = require('express');
const router = express.Router();
const vulnCtrl = require('../controllers/vulnerableController');
const safeCtrl = require('../controllers/safeController');

// Helper to choose active controller based on active security mode
function getActiveCtrl(req) {
    const mode = req.session.securityMode || 'vulnerable';
    return mode === 'safe' ? safeCtrl : vulnCtrl;
}

// TOGGLE SECURITY MODE ENDPOINT
router.all('/toggle-mode', (req, res) => {
    const currentMode = req.session.securityMode || 'vulnerable';
    const targetMode = req.query.to || (currentMode === 'vulnerable' ? 'safe' : 'vulnerable');
    req.session.securityMode = targetMode;
    console.log(`[MODE SWITCH]: Active mode is now => ${targetMode.toUpperCase()}`);

    const referer = req.headers.referer || '/';
    res.redirect(referer);
});

// CORE APPLICATION ROUTES (Switchable by Active Mode)
router.get('/', (req, res) => getActiveCtrl(req).getHome(req, res));
router.get('/products', (req, res) => getActiveCtrl(req).getProducts(req, res));
router.get('/products/:id', (req, res) => getActiveCtrl(req).getProductDetail(req, res));
router.post('/products/:id/review', (req, res) => getActiveCtrl(req).postProductReview(req, res));
router.get('/search', (req, res) => getActiveCtrl(req).getSearch(req, res));
router.get('/promo', (req, res) => getActiveCtrl(req).getPromoPage(req, res));
router.get('/api/verify-coupon', (req, res) => getActiveCtrl(req).verifyCoupon(req, res));

// AUTHENTICATION ROUTES
router.get('/login', (req, res) => getActiveCtrl(req).getLogin(req, res));
router.post('/login', (req, res) => getActiveCtrl(req).postLogin(req, res));
router.get('/logout', (req, res) => getActiveCtrl(req).logout(req, res));

// USER DASHBOARD & STATE-CHANGING ACTIONS (CSRF)
router.get('/dashboard', (req, res) => getActiveCtrl(req).getDashboard(req, res));
router.post('/transfer', (req, res) => getActiveCtrl(req).postTransfer(req, res));
router.post('/change-email', (req, res) => getActiveCtrl(req).postChangeEmail(req, res));

// DIRECT COMPARATIVE DEMO ENDPOINTS (For explicit side-by-side verification)
router.get('/vulnerable/products', vulnCtrl.getProducts);
router.get('/safe/products', safeCtrl.getProducts);
router.get('/vulnerable/search', vulnCtrl.getSearch);
router.get('/safe/search', safeCtrl.getSearch);
router.get('/vulnerable/api/verify-coupon', vulnCtrl.verifyCoupon);
router.get('/safe/api/verify-coupon', safeCtrl.verifyCoupon);

module.exports = router;
