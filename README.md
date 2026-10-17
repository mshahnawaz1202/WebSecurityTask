# CyberMart: Full-Stack Web Security Project (Blue Team Focus)

A real-world healthcare and pharmacy e-commerce web application demonstrating common web vulnerabilities (OWASP Top 10), practical end-to-end exploits, and hardened Blue Team defenses in two switchable versions.

---

## 1. Use Case Overview

- **Portal Domain**: CyberMart Healthcare & Pharmacy Web Application.
- **Core Functionality**:
  - Medical Device Catalog: Search and filter pharmaceuticals and medical devices.
  - Customer Reviews: Submit and render clinical product ratings.
  - Prescription Validator: Redeem active discount coupons and verify clinical prescriptions.
  - Patient Wallet: View store balances and execute credit transfers between accounts.
- **System Accounts**:
  - `Shah Nawaz` / `AdminPass2026!` (Administrator, $25,000.00 Balance) - Primary SQLi target.
  - `Aamish Alvi` / `RxSecure99` (Staff / Doctor, $4,500.00 Balance) - Clinical account.
  - `Ali Abbas` / `Password123` (Customer, $1,200.00 Balance) - Victim for CSRF transfer.

---

## 2. Technology Stack

| Architecture Layer            | Components & Badges                                                                                                                                                                                                                                                                                                                                                                                                 | Purpose                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Runtime & Server**    | ![Node.js](https://img.shields.io/badge/Node.js_v18+-339933?style=flat-square&logo=nodedotjs&logoColor=white) ![Express.js](https://img.shields.io/badge/Express.js_v5-000000?style=flat-square&logo=express&logoColor=white)                                                                                                                                                                                       | Application server, request routing, security middleware            |
| **Database**            | ![SQLite](https://img.shields.io/badge/SQLite3-003B57?style=flat-square&logo=sqlite&logoColor=white)                                                                                                                                                                                                                                                                                                                | Self-contained SQL engine running live queries via `cybermart.db` |
| **Frontend**            | ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black) ![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white) ![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white) ![EJS](https://img.shields.io/badge/EJS_Templates-B4CA65?style=flat-square&logo=ejs&logoColor=black) | Dynamic templating demonstrating unescaped vs escaped rendering     |
| **Sessions & Security** | ![Express-Session](https://img.shields.io/badge/Express--Session-000000?style=flat-square) ![Cookie-Parser](https://img.shields.io/badge/Cookie--Parser-4A90E2?style=flat-square) ![Node Crypto](https://img.shields.io/badge/Node--Crypto-1E293B?style=flat-square)                                                                                                                                                | State management, session cookies, and anti-CSRF token hashing      |

---

## 3. How to Run Both Versions

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Start the Web Server

```bash
npm start
```

The server binds to `http://localhost:3000`. On first run, `seed-data.sql` auto-seeds all tables in `cybermart.db`.

### Step 3: Access the Application

Open: `http://localhost:3000`

### Step 4: Toggle Between Vulnerable and Safe Versions

- **Method 1 (UI Switcher)**: Click the **Switch to Safe Version / Switch to Vulnerable Version** button in the top navigation banner.
- **Method 2 (URL Switcher)**:
  - Enable Safe Mode: `http://localhost:3000/toggle-mode?to=safe`
  - Enable Vulnerable Mode: `http://localhost:3000/toggle-mode?to=vulnerable`
- **Method 3 (Side-by-Side Comparison Endpoints)**:
  - Vulnerable Catalog: `/vulnerable/products`
  - Safe Catalog: `/safe/products`
  - Vulnerable Search: `/vulnerable/search`
  - Safe Search: `/safe/search`
  - Vulnerable Coupon API: `/vulnerable/api/verify-coupon`
  - Safe Coupon API: `/safe/api/verify-coupon`

---

## 4. Implemented Vulnerabilities & Blue Team Defenses Matrix

| Vulnerability                          | Vulnerable Flaw                                                                | Exploit Payload                                                                                  | Safe Blue Team Fix                                                                              | Evidence Screenshots                                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **1. Reflected XSS**             | Direct unescaped query reflection in template `<%- query %>`                 | `<script>alert('Reflected-XSS')</script>` on `/search?q=...`                                 | Context-aware HTML entity encoding `escapeHtml()`, `<%= query %>`, and CSP headers          | **Vuln**: `01_xss_reflected_vulnerable.png`**Safe**: `02_xss_reflected_safe.png`                       |
| **2. Stored XSS**                | Review stored raw into SQLite and rendered unescaped on `/products/1`        | `<img src=x onerror=alert('Stored-XSS')>`                                                      | Input sanitization before DB insert and safe template output `<%= review.comment %>`          | **Vuln**: `03_xss_stored_vulnerable.png`**Safe**: `04_xss_stored_safe.png`                             |
| **3. DOM-Based XSS**             | Unsafe DOM sink `innerHTML` directly consumes URL hash `location.hash`     | `#promo=<img src=x onerror=alert('DOM-XSS')>` on `/promo`                                    | Safe text sink `element.textContent = hashValue` neutralizes executable tags                  | **Vuln**: `05_xss_dom_vulnerable.png`**Safe**: `06_xss_dom_safe.png`                                   |
| **4. CSRF**                      | State-changing `POST /transfer` relies on ambient cookie without CSRF token  | Hidden form on `http://localhost:3000/attacker-demo` transfers $150 to `Shah Nawaz`          | Synchronizer Token Pattern (`_csrf` token) + `SameSite: 'Strict'` cookies; rejects with 403 | **Vuln**: `07_csrf_vulnerable_attack.png`**Safe**: `08_csrf_safe_blocked.png`                          |
| **5. Easy SQLi (Auth Bypass)**   | Raw string concatenation in login query: `... WHERE username = '...'`        | Username: `Shah Nawaz' --`Password: `any`                                                    | Parameterized prepared statement: `SELECT * FROM users WHERE username = ? AND password = ?`   | **Vuln**: `09_sqli_easy_vulnerable_bypass.png`**Safe**: `10_sqli_easy_safe_blocked.png`                |
| **6. Intermediate SQLi (Blind)** | Concatenation in coupon lookup allows subordinate boolean evaluation           | `HEALTH10' AND (SELECT SUBSTR(password,1,1) FROM users WHERE username='Shah Nawaz')='A' --`    | Parameterized query: `SELECT * FROM coupons WHERE code = ? AND status = 'active'`             | **Vuln**: `11_sqli_intermediate_vulnerable_blind.png`**Safe**: `12_sqli_intermediate_safe_blocked.png` |
| **7. Advanced SQLi (UNION)**     | Category filter concatenated directly into SQL: `... WHERE category = '...'` | `Equipment' UNION SELECT 1, username, password \|\| ' \| ' \|\| email, balance, role FROM users --` | Parameterized query: `SELECT ... WHERE category = ?`; evaluates payload as literal category   | **Vuln**: `13_sqli_advanced_vulnerable_dump.png`**Safe**: `14_sqli_advanced_safe_blocked.png`          |

---

## 5. Submission Deliverables

- **Database Seed File**: [seed-data.sql](<file:///d:/Semester%2007/Information%20Security/A_02/seed-data.sql>) (SQLite schema and pre-seeded accounts for Shah Nawaz, Aamish Alvi, and Ali Abbas).
- **Technical Q&A Guide**: [explainable.md](<file:///d:/Semester%2007/Information%20Security/A_02/explainable.md>) (Complete theoretical answers to all cybersecurity questions).
- **Hidden Code Comment**: Preserved on line 56 of `database.js`.
