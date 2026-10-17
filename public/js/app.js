/**
 * ====================================================================
 * CyberMart Client-Side Application Script
 * Demonstrates DOM-based XSS Vulnerability vs Safe Text Sinks
 * ====================================================================
 */

document.addEventListener('DOMContentLoaded', function () {
    renderDomPromo();

    // Re-render whenever the URL hash changes
    window.addEventListener('hashchange', function () {
        renderDomPromo();
    });
});

/**
 * Reads user-controlled input from the client URL fragment (#promo=...)
 * and writes to target elements in the DOM.
 */
function renderDomPromo() {
    const bannerElem = document.getElementById('promo-banner');
    const targetElem = document.getElementById('dom-target');
    const currentMode = document.body.getAttribute('data-mode') || 'vulnerable';

    let promoValue = null;

    // Check URL Hash first
    if (window.location.hash) {
        const hashStr = window.location.hash.substring(1); // remove '#'
        const params = new URLSearchParams(hashStr);
        if (params.has('promo')) {
            promoValue = decodeURIComponent(params.get('promo'));
        } else if (hashStr.startsWith('promo=')) {
            promoValue = decodeURIComponent(hashStr.replace('promo=', ''));
        }
    }

    // Fallback: check query parameter ?promo=...
    if (!promoValue) {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('promo')) {
            promoValue = urlParams.get('promo');
        }
    }

    if (!promoValue) {
        return; // No promo parameter provided
    }

    console.log(`[DOM XSS SINK TRIGGERED] Mode: ${currentMode}, Payload:`, promoValue);

    if (currentMode === 'vulnerable') {
        // ============================================================
        // VULNERABLE DOM SINK: innerHTML allows script execution
        // Sinks like innerHTML, document.write, or eval() execute tags
        // ============================================================
        if (bannerElem) {
            bannerElem.innerHTML = `<strong>[PROMOTION]:</strong> ${promoValue}`;
        }
        if (targetElem) {
            targetElem.innerHTML = promoValue;
        }
    } else {
        // ============================================================
        // SAFE DOM SINK: textContent treats input strictly as raw text
        // Browsers will never parse or execute HTML tags inside textContent
        // ============================================================
        if (bannerElem) {
            bannerElem.textContent = `[PROMOTION]: ${promoValue}`;
        }
        if (targetElem) {
            targetElem.textContent = promoValue;
        }
    }
}

window.renderDomPromo = renderDomPromo;
