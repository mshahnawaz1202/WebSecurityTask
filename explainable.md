# Web Security Project: Blue Team Focus - Step-by-Step Implementation & Theory Guide

This document provides a comprehensive, step-by-step operational walkthrough of the CyberMart Web Security application. It covers environment setup, code architecture, vulnerability testing workflows, mitigation verification, screenshot evidence guidance, and detailed answers to the theoretical security principles.

---

## Part 1: Environment Setup & Architecture Walkthrough

### 1.1 Prerequisites

- **Node.js**: Version 18.0.0 or higher (compatible with Node 20+ and Node 24).
- **npm**: Version 9.0.0 or higher.
- **Operating System**: Platform-agnostic (Windows, macOS, Linux).

### 1.2 Step-by-Step Installation

1. Open a terminal in the project directory:

   ```bash
   cd "d:\Semester 07\Information Security\A_02"
   ```
2. Install the required runtime dependencies:

   ```bash
   npm install
   ```

   Dependencies installed:

   - `express`: Fast, minimalist web framework for routing and middleware.
   - `sqlite3`: Self-contained, serverless database engine providing genuine SQL query execution.
   - `ejs`: Embedded JavaScript templating engine supporting both raw (`<%- %>`) and HTML-escaped (`<%= %>`) output.
   - `express-session`: Server-side session management for authenticated users and CSRF token storage.
   - `cookie-parser`: Cookie parsing middleware for session tracking.
3. Start the live application:

   ```bash
   npm start
   ```

   The application will listen on `http://localhost:3000`.

### 1.3 Database Architecture & Auto-Seeding

- The database configuration is managed in `database.js`.
- On startup, the application checks for `cybermart.db`. If the database is new or empty, it automatically executes `seed-data.sql`.
- The database defines five core tables:
  1. `users`: Stores user credentials, emails, roles, and balances.
  2. `products`: Stores medical equipment and pharmaceutical inventory items.
  3. `reviews`: Stores customer feedback and comments (target for Stored XSS).
  4. `coupons`: Stores prescription and promotional discounts (target for Blind SQLi).
  5. `transfers`: Stores transaction logs for credit transfers (state-changing action for CSRF).
- A reset route is available at `GET /api/reset-db` to restore baseline seed data at any time.

### 1.4 Dual-Mode Switching Mechanism

The application supports seamless toggling between the **Vulnerable Version** and the **Safe Version**:

- **Session State**: `req.session.securityMode` holds either `'vulnerable'` or `'safe'`.
- **UI Switcher**: The persistent top banner contains a toggle link calling `/toggle-mode`.
- **Dispatcher**: `routes/index.js` inspects the active session mode and delegates incoming HTTP requests to either `controllers/vulnerableController.js` or `controllers/safeController.js`.
- **Direct Side-by-Side Endpoints**:
  - `/vulnerable/products` vs `/safe/products`
  - `/vulnerable/search` vs `/safe/search`
  - `/vulnerable/api/verify-coupon` vs `/safe/api/verify-coupon`

---

## Part 2: Step-by-Step Vulnerability Exploitation & Mitigation Guide

### 1. Cross-Site Scripting (XSS)

#### A. Reflected XSS

- **Target URL**: `http://localhost:3000/search?q=`
- **Vulnerable Code Location**: `controllers/vulnerableController.js` (`getSearch`), rendered in `views/search.ejs` via `<%- query %>`.
- **Payload**:
  ```html
  <script>alert('Reflected-XSS-Execution')</script>
  ```
- **Alternative Non-Script Payload**:
  ```html
  <img src=x onerror="alert('Reflected-IMG-XSS')">
  ```
- **Execution Workflow**:
  1. Set the application mode to Vulnerable.
  2. Enter the payload into the header search bar or open:
     `http://localhost:3000/search?q=%3Cscript%3Ealert('Reflected-XSS-Execution')%3C%2Fscript%3E`
  3. The JavaScript dialog immediately pops up because the server reflected the unescaped payload directly into the browser DOM.
- **Safe Version Mitigation**:
  1. Switch to Safe Mode.
  2. Re-run the same URL.
  3. The script does not execute. The characters are encoded into safe HTML entities (`&lt;script&gt;...`) rendered via `<%= query %>`, and the HTTP `Content-Security-Policy` header blocks inline script execution.

#### B. Stored XSS

- **Target URL**: `http://localhost:3000/products/1`
- **Vulnerable Code Location**: `controllers/vulnerableController.js` (`postProductReview`), rendered in `views/product-detail.ejs` via `<%- review.comment %>`.
- **Payload**:
  ```html
  <img src=x onerror="alert('STORED-XSS-IN-REVIEWS')">
  ```
- **Execution Workflow**:
  1. Ensure the application is in Vulnerable Mode.
  2. Navigate to product detail page (`/products/1`).
  3. In the review comment box, enter the payload and click "Submit Review".
  4. The comment is saved into the SQLite database.
  5. Upon page reload, or whenever any other user visits `/products/1`, the payload executes automatically from the database.
- **Safe Version Mitigation**:
  1. Switch to Safe Mode.
  2. Submit a review containing the same payload.
  3. The input is sanitized and encoded using `escapeHtml()`. The template renders through `<%= review.comment %>`, outputting the literal text `<img src=x...>` without execution.

#### C. DOM-Based XSS

- **Target URL**: `http://localhost:3000/promo` (or the homepage promotion banner).
- **Vulnerable Code Location**: `public/js/app.js` (`renderDomPromo`).
- **Payload**:
  ```
  #promo=<img src=x onerror="alert('DOM-XSS-TRIGGERED')">
  ```
- **Execution Workflow**:
  1. Ensure the application is in Vulnerable Mode.
  2. Navigate to:
     `http://localhost:3000/promo#promo=%3Cimg%20src=x%20onerror=%22alert('DOM-XSS-TRIGGERED')%22%3E`
  3. `public/js/app.js` reads `window.location.hash`, parses the `promo` fragment, and executes:
     `document.getElementById('dom-target').innerHTML = promoValue;`
  4. The payload executes client-side without reaching the backend server.
- **Safe Version Mitigation**:
  1. Switch to Safe Mode.
  2. Navigate to the same URL or click "Inject via DOM Sink".
  3. In Safe Mode, `public/js/app.js` assigns input using `element.textContent = promoValue`. The browser treats the input strictly as plain string characters, preventing tag parsing.

---

### 2. Cross-Site Request Forgery (CSRF)

- **Target Action**: POST `/transfer` (transferring store balance credits).
- **Vulnerable Code Location**: `controllers/vulnerableController.js` (`postTransfer`).
- **Attacker Page**: `attacker/csrf-attack.html` (served at `http://localhost:3000/attacker-demo`).
- **Execution Workflow**:
  1. Log into CyberMart in Vulnerable Mode as the victim account:
     - Username: `Ali Abbas`
     - Password: `Password123`
     - Initial Balance: $1,200.00
  2. Keep this tab open. Open a new tab and navigate to the external attacker page:
     `http://localhost:3000/attacker-demo`
     (Or open the local file `attacker/csrf-attack.html`).
  3. The attacker page contains a hidden form that automatically submits:
     - Target: `http://localhost:3000/transfer`
     - Recipient: `Shah Nawaz`
     - Amount: `150.00`
  4. Because the browser automatically attaches the victim's session cookie with ambient authority, the transfer succeeds.
  5. Return to the victim dashboard (`/dashboard`) and refresh: the balance has decreased from $1,200.00 to $1,050.00, and a new unauthorized transfer record appears in the audit table.
- **Safe Version Mitigation**:
  1. Switch to Safe Mode.
  2. Log into the victim account (`Ali Abbas`).
  3. Open `http://localhost:3000/attacker-demo`.
  4. The safe controller verifies the `_csrf` token (`req.body._csrf === req.session.csrfToken`).
  5. Because the cross-origin request lacks the valid cryptographic token, the server terminates the request with HTTP `403 Forbidden` (`SECURITY ERROR: Invalid or missing anti-CSRF token`).
  6. No funds are transferred.

---

### 3. SQL Injection (Three Complexity Levels)

#### A. Level 1: Easy (Authentication Bypass)

- **Target URL**: `http://localhost:3000/login`
- **Vulnerable Query**:
  ```sql
  SELECT * FROM users WHERE username = 'Shah Nawaz' --' AND password = '...'
  ```
- **Payload**:
  - Username: `Shah Nawaz' --`
  - Password: `(any password)`
  - Alternative Username: `' OR '1'='1' --`
- **Execution Workflow**:
  1. Ensure the application is in Vulnerable Mode.
  2. On the login form, enter `Shah Nawaz' --` as the username and any arbitrary password.
  3. Submit the form.
  4. The query evaluates to `SELECT * FROM users WHERE username = 'Shah Nawaz'`, ignoring the password check completely.
  5. The application immediately logs in as `Shah Nawaz` (Administrator) and redirects to `/dashboard`.
- **Safe Version Mitigation**:
  1. Switch to Safe Mode.
  2. Submit `Shah Nawaz' --` on the login form.
  3. The safe controller executes a parameterized query:
     `SELECT * FROM users WHERE username = ? AND password = ?`
  4. The entire string `Shah Nawaz' --` is evaluated as a literal username. The lookup fails and returns "Invalid username or password. Authentication failed."

#### B. Level 2: Intermediate (Blind Boolean-Based & Error-Based)

- **Target URL**: `http://localhost:3000/promo` calling `/api/verify-coupon?code=`
- **Vulnerable Query**:
  ```sql
  SELECT * FROM coupons WHERE code = 'HEALTH10' AND ...' AND status = 'active'
  ```
- **Mechanisms**:
  - **Boolean Blind Inference**:
    - Query TRUE condition:
      `HEALTH10' AND (SELECT SUBSTR(password,1,1) FROM users WHERE username='Shah Nawaz')='A' --`
      Response: `{"valid": true, "message": "Coupon is valid! ..."}`
    - Query FALSE condition:
      `HEALTH10' AND (SELECT SUBSTR(password,1,1) FROM users WHERE username='Shah Nawaz')='Z' --`
      Response: `{"valid": false, "message": "Invalid or expired coupon code."}`
      An attacker can deduce each character of the administrator password character by character based on whether the API returns valid or invalid.
  - **Error-Based Leakage**:
    Injecting a syntax error such as `HEALTH10' AND 1=load_extension(1) --` causes SQLite to return raw database errors in the response body.
- **Safe Version Mitigation**:
  1. Switch to Safe Mode.
  2. Submit the boolean blind payload.
  3. The query is parameterized:
     `SELECT code, discount_percent FROM coupons WHERE code = ? AND status = 'active'`
  4. The injection string is evaluated as an exact literal coupon code. It returns `{"valid": false}` without executing subordinate boolean queries or leaking errors.

#### C. Level 3: Advanced (Structured Attack Chain: Columns -> Tables -> Data)

- **Target URL**: `http://localhost:3000/products?category=`
- **Vulnerable Query**:
  ```sql
  SELECT id, name, category, price, description FROM products WHERE category = '...'
  ```
- **Structured Attack Steps**:
  1. **Stage 1: Enumerate Column Count via ORDER BY**:
     - Test 5 columns:
       `Equipment' ORDER BY 5 --` -> Query executes successfully.
     - Test 6 columns:
       `Equipment' ORDER BY 6 --` -> Throws SQLite error: `1st ORDER BY term out of range - should be between 1 and 5`.
     - Conclusion: The target table query selects exactly **5 columns**.
  2. **Stage 2: Enumerate Database Schema and Tables**:
     - Inject UNION SELECT against the `sqlite_master` catalog table:
       `Equipment' UNION SELECT 1, tbl_name, sql, 4, 5 FROM sqlite_master WHERE type='table' --`
     - Result: The catalog page renders the names and SQL DDL statements of all database tables: `users`, `products`, `reviews`, `coupons`, and `transfers`.
  3. **Stage 3: Extract Sensitive User Credentials & Balances**:
     - Extract usernames, passwords, emails, and balances from the `users` table:
       `Equipment' UNION SELECT 1, username, password || ' | ' || email, balance, role FROM users --`
     - Result: The product catalog displays all administrative and customer accounts (`Shah Nawaz`, `Aamish Alvi`, `Ali Abbas`), plaintext passwords, email addresses, and account balances directly on the webpage cards.
- **Safe Version Mitigation**:
  1. Switch to Safe Mode.
  2. Execute the Stage 3 UNION payload:
     `http://localhost:3000/products?category=Equipment'%20UNION%20SELECT%201,username,password%20||%20'%20|%20'%20||%20email,balance,role%20FROM%20users%20--`
  3. The safe controller uses parameterized prepared statements:
     `SELECT id, name, category, price, description FROM products WHERE category = ?`
  4. The input is treated as a literal category name. SQLite searches for products where `category` equals the injection string, returning zero rows safely without query restructuring.

---

## Part 3: Payload & Screenshot Evidence Reference Guide

All 14 screenshots have been generated and saved directly in the `screenshots/` directory in `.png` format for your report submission:

| Test Case                   | Payload String                                                                                   | Vulnerable Output & PNG File                                                                                        | Safe Output & PNG File                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **XSS Reflected**     | `<script>alert('Reflected-XSS')</script>`                                                      | Alert dialog executes; unescaped in source`screenshots/01_xss_reflected_vulnerable.png`                           | Harmless literal text; encoded as `&lt;script&gt;screenshots/02_xss_reflected_safe.png`             |
| **XSS Stored**        | `<img src=x onerror=alert('Stored-XSS')>`                                                      | Stored in DB; executes on every page reload`screenshots/03_xss_stored_vulnerable.png`                             | Harmless literal text; encoded safely via `<%= %>screenshots/04_xss_stored_safe.png`                |
| **XSS DOM-Based**     | `#promo=<img src=x onerror=alert('DOM-XSS')>`                                                  | Client script executes via `innerHTML` sink`screenshots/05_xss_dom_vulnerable.png`                              | Input treated as text via `textContent` sink`screenshots/06_xss_dom_safe.png`                     |
| **CSRF**              | POST to `/transfer` with `recipient=Shah Nawaz&amount=150.00`                                | Balance drops from $1,200 to $1,050; transfer logged`screenshots/07_csrf_vulnerable_attack.png`                   | Request rejected with `403 Forbidden` (CSRF token missing)`screenshots/08_csrf_safe_blocked.png`  |
| **SQLi Easy**         | `Shah Nawaz' --` (in login username field)                                                     | Authentication bypassed; redirected to admin dashboard`screenshots/09_sqli_easy_vulnerable_bypass.png`            | Access denied: "Invalid username or password"`screenshots/10_sqli_easy_safe_blocked.png`            |
| **SQLi Intermediate** | `HEALTH10' AND (SELECT SUBSTR(password,1,1) FROM users WHERE username='Shah Nawaz')='A' --`    | Returns `{"valid": true}` confirming character guess`screenshots/11_sqli_intermediate_vulnerable_blind.png`     | Parameterized query treats input as literal code`screenshots/12_sqli_intermediate_safe_blocked.png` |
| **SQLi Advanced**     | `Equipment' UNION SELECT 1, username, password \|\| ' \| ' \|\| email, balance, role FROM users --` | Product cards display dumped usernames, passwords, and balances`screenshots/13_sqli_advanced_vulnerable_dump.png` | Parameterized query returns zero items safely`screenshots/14_sqli_advanced_safe_blocked.png`        |

---

## Part 4: Theoretical Cybersecurity Concepts & Analysis

### 1. Principle of Least Privilege (PoLP)

- **Impact on Account Compromise**: Restricts accounts and processes to the bare minimum set of resources, privileges, and system permissions necessary to perform their legitimate function. If an account is breached, the attacker's blast radius is strictly bounded by those minimal entitlements. An attacker cannot escalate privilege to access unrelated databases, deploy persistence, or modify kernel configurations.
- **Enterprise Challenges**: In large environments, organizations face permission creep (accumulated legacy permissions when employees change roles), administrative overhead in defining fine-grained access control policies across microservices, and operational friction where restrictive policies can break legacy inter-system workflows.

### 2. Authentication vs. Authorization

- **Authentication (AuthN)**: The process of verifying *who* a user or entity is (e.g., verifying a username and password, evaluating an MFA token, or validating a cryptographic certificate).
- **Authorization (AuthZ)**: The process of verifying *what* an authenticated identity is permitted to do (e.g., Role-Based Access Control enforcing whether user `alice` has read/write privileges over medical record `1042`).
- **Separation of Concerns**: Conflating AuthN and AuthZ leads to severe authorization flaws, such as Broken Object Level Authorization (BOLA) and Insecure Direct Object References (IDOR), where an attacker proves their identity (authenticates) and the application fails to verify whether they own or have rights to the requested resource.

### 3. Multi-Factor Authentication (MFA)

- **Protection**: MFA enforces verification across two or more distinct factors: something you know (password), something you have (hardware token, authenticator app, smartcard), and something you are (biometrics). Even if passwords are exposed through phishing, credential stuffing, or database breaches, the attacker cannot complete authentication without the secondary independent factor.
- **Limitations**:
  - SMS and voice-based MFA are vulnerable to SIM swapping, SS7 signaling attacks, and interception.
  - Push-notification MFA is subject to MFA fatigue attacks (bombarding the user with prompts until they approve).
  - Reverse-proxy phishing frameworks (e.g., Evilginx) can proxy MFA prompts in real time to capture authenticated session tokens.
  - FIDO2 / WebAuthn hardware security keys provide the strongest mitigation by cryptographically binding authentication to the origin URL.

### 4. Symmetric vs. Asymmetric Encryption

- **Symmetric Encryption (e.g., AES-GCM, ChaCha20)**: Uses a single shared secret key for both encryption and decryption.
  - *Strengths*: Highly efficient, minimal computational overhead, capable of gigabit-per-second throughput in hardware.
  - *Use Cases*: Bulk data at rest (database storage, disk encryption) and bulk data in transit.
- **Asymmetric Encryption (e.g., RSA, ECC / ECDH, Ed25519)**: Uses mathematically linked key pairs: a public key for encryption/verification and a private key for decryption/signing.
  - *Strengths*: Solves the key-distribution problem; public keys can be distributed over open networks.
  - *Use Cases*: Key exchange, digital certificates, code signing, and digital signatures.
- **Hybrid Cryptography**: TLS combines both paradigms: asymmetric cryptography negotiates a shared secret and authenticates the host, after which symmetric cryptography encrypts the high-speed payload stream.

### 5. Transport Layer Security (TLS) & Certificate Validation

- **Protection**: TLS provides confidentiality (encryption), integrity (cryptographic MAC / AEAD), and authenticity (X.509 digital certificates issued by trusted Certificate Authorities).
- **Improper Validation Risks**: If a client fails to validate the certificate chain, ignores expired/revoked certificates, or omits hostname verification, an attacker on the local network (or routing path) can execute a Man-in-the-Middle (MitM) attack using a forged or self-signed certificate, inspecting and modifying all plaintext communications.

### 6. Cryptographic Hashes & Password Storage

- **Cryptographic Hash Functions (e.g., SHA-256, SHA-3)**: One-way, deterministic functions designed for high performance and collision resistance. They are intended for data integrity verification and digital signatures.
- **Password-Specific Hashing (e.g., Argon2id, bcrypt, PBKDF2, scrypt)**: Passwords must never be stored using standard cryptographic hashes. Because SHA-256 is designed to be fast, modern GPUs can compute billions of guesses per second, rendering brute-force and rainbow table attacks trivial. Password hashing algorithms incorporate:
  - Cryptographic salts to defeat rainbow tables.
  - Configurable work factors (computational, memory, and parallelism hardness) that deliberately slow down verification to make offline brute-force attacks computationally infeasible.

### 7. SQL Injection Mechanics & Prevention

- **Root Cause**: Occurs when untrusted user input is directly concatenated or interpolated into a database command string, causing the database query parser to interpret data characters as control syntax.
- **Prevention**:
  - Parameterized Queries (Prepared Statements): The query structure is compiled first; parameters are sent separately and treated strictly as literal data by the database engine.
  - Object-Relational Mappers (ORMs) configured to avoid raw string concatenation.
  - Enforcing database user least privilege (e.g., disabling `load_file` or administrative procedures).
- **Safe Verification**: Use boolean-safe logic (e.g., inputting benign numeric evaluations) or non-destructive database timing functions in dedicated staging environments without impacting production integrity.

### 8. Cross-Site Scripting (XSS) Types & Defenses

- **Reflected XSS**: Malicious input from an HTTP request (URL query parameter, form input) is immediately reflected in the server response without sanitization.
- **Stored XSS**: The payload is permanently stored in the application backend (database, file system, message queue) and served to users whenever they access that resource.
- **DOM-Based XSS**: The vulnerability exists entirely client-side; client JavaScript reads untrusted data from a source (`location.hash`, `location.search`, `document.referrer`) and executes it through an unsafe sink (`innerHTML`, `document.write`, `eval`).
- **Defenses**:
  - Context-aware output encoding (converting `<`, `>`, `"`, `'`, `&` to HTML/JavaScript entities).
  - Safe client sinks (e.g., using `element.textContent` instead of `element.innerHTML`).
  - Content Security Policy (CSP) headers restricting script execution sources and disallowing unsafe inline scripts.
  - Setting `HttpOnly` flags on session cookies to prevent JavaScript exfiltration.

### 9. Cross-Site Request Forgery (CSRF) & Defenses

- **Mechanism**: Exploits the browser's ambient authority—the fact that browsers automatically attach stored session cookies with every outgoing request to a domain, regardless of which origin initiated the request. An attacker's site tricks the victim's browser into submitting an unauthorized state-changing request (e.g., fund transfer, password change) to an application where the user is currently authenticated.
- **Defenses**:
  - Anti-CSRF Tokens (Synchronizer Token Pattern): Cryptographically strong, unpredictable tokens stored in the user's session and validated on every state-changing POST/PUT/DELETE request.
  - `SameSite` Cookie Attribute: Setting `SameSite=Strict` or `SameSite=Lax` prevents cookies from being attached to cross-site requests.
  - Verifying the `Origin` and `Referer` HTTP request headers.

### 10. Unrestricted File Upload Risks & Validation

- **Risks**: An attacker uploading a file with server-executable extensions (e.g., `.php`, `.jsp`, `.aspx`) can trigger Remote Code Execution (RCE). Uploading malicious SVGs can trigger Stored XSS, while oversized files can cause Denial of Service (DoS).
- **Validation Controls**:
  - Never trust the client-provided `Content-Type` header or file extension.
  - Inspect the binary magic bytes of the file header to verify true file format.
  - Generate a random UUID filename on the server and discard the original filename.
  - Store uploaded files outside the web server document root or in an isolated object storage bucket (e.g., AWS S3).
  - Serve uploaded files with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`.

### 11. Server-Side Request Forgery (SSRF) in Cloud Environments

- **Mechanism**: Occurs when a server application fetches a remote resource based on a user-supplied URL without adequate validation.
- **Cloud Danger**: Cloud environments host internal, unauthenticated metadata services accessible via link-local addresses (e.g., AWS/GCP metadata at `http://169.254.169.254/`). An attacker exploiting SSRF can query the metadata API to dump temporary IAM security credentials, instance identity tokens, and private cloud network configurations.
- **Mitigation**: Implement strict IP allowlisting, block RFC 1918 private subnets and `169.254.169.254`, enforce IMDSv2 (requiring session tokens), and run services within isolated network namespaces.

### 12. Vulnerability, Threat, Risk, and Exploit

- **Vulnerability**: A flaw or weakness in software design, implementation, or configuration (e.g., an unescaped SQL parameter).
- **Threat**: A potential circumstance or actor capable of exploiting a vulnerability to cause harm (e.g., a cybercriminal group targeting financial databases).
- **Exploit**: A specific piece of software, payload, or technique used to take advantage of a vulnerability.
- **Risk**: The probability and operational/financial impact of a threat successfully exploiting a vulnerability ($Risk = Likelihood \times Impact$). Security teams prioritize remediation based on risk rather than raw vulnerability counts.

### 13. SIEM Systems & Correlation Rules

- **Functionality**: A Security Information and Event Management (SIEM) system ingests logs and telemetry from firewalls, servers, identity providers, and endpoints. It normalizes data formats, correlates events across disparate sources using temporal logic, and triggers security alerts based on detection rules.
- **Noisy / Poorly Configured Rules**: Yield alert fatigue, where security analysts are overwhelmed by high volumes of false positives, increasing the likelihood that genuine, sophisticated intrusions remain undetected.

### 14. Endpoint Detection and Response (EDR) vs. Antivirus

- **Traditional Antivirus (AV)**: Relies predominantly on static file signatures, file hashes, and basic heuristics to detect known malicious binaries at rest.
- **EDR**: Continuously monitors endpoint behavior, process creation, parent-child process ancestry, memory injection, API calls, and network connections. It detects fileless attacks, living-off-the-land binaries (LOLBins), and anomalous behaviors even when no known malware file is written to disk.

### 15. Network Segmentation & Lateral Movement

- **Mechanism**: Divides a computer network into isolated subnetworks (VLANs, microsegments) separated by internal firewalls and access control lists (ACLs).
- **Limiting Movement**: If an attacker compromises a perimeter workstation, network segmentation prevents them from directly communicating with database clusters, domain controllers, or payment environments without traversing monitored security boundaries.

### 16. MITRE ATT&CK Framework

- **Purpose**: A globally accessible knowledge base of adversary tactics, techniques, and procedures (TTPs) based on real-world observations.
- **Defensive Utilization**: Defenders map their telemetry, detection coverage, and incident response playbooks against ATT&CK matrices to identify blind spots, prioritize detection engineering, and simulate adversarial attack paths.

### 17. Digital Forensics: Evidence Preservation & Chain of Custody

- **Evidence Preservation**: Investigators collect volatile data first (RAM, network states) before taking bit-stream disk images of affected hosts to preserve the authentic state without alteration.
- **Chain of Custody**: A meticulous chronological record documenting who collected, accessed, transferred, and analyzed forensic evidence, accompanied by cryptographic hashes (SHA-256) of the images. Any break in the chain of custody invalidates evidence in legal proceedings.

### 18. False Positives vs. Genuine Security Alerts

- **Distinction**: A false positive occurs when legitimate, benign system activity triggers a detection rule. A genuine alert represents true adversary activity or security policy violations.
- **Contextual Triage**: Analysts examine process ancestry (e.g., whether `powershell.exe` was spawned by an administrative script or by `winword.exe`), user context, network destination IPs, time of activity, and threat intelligence feeds.

### 19. Hardcoded Credentials & Secret Management

- **Risks**: Credentials, API tokens, and private keys committed to source code repositories are frequently indexed by automated scanners, leading to account hijacking, data exfiltration, and lateral movement.
- **Remediation**: Use centralized secret management solutions (e.g., HashiCorp Vault, AWS Secrets Manager), populate configurations via runtime environment variables, enforce pre-commit git hooks (e.g., `git-secrets`, `trufflehog`), and rotate compromised credentials immediately.

### 20. Container Security vs. Virtual Machines

- **Architectural Difference**: Virtual Machines (VMs) run complete guest operating systems managed by a Type-1 or Type-2 hypervisor, providing hardware-level isolation. Containers share the host kernel and use Linux namespaces and cgroups for process-level isolation.
- **Security Considerations**: A kernel vulnerability can lead to container escape, allowing an attacker root access to the entire host. Container security requires minimal base images, rootless execution, read-only file systems, vulnerability scanning of image layers, and seccomp/AppArmor security profiles.

### 21. Third-Party Dependencies & Software Composition Analysis (SCA)

- **Risks**: Modern applications consist largely of open-source packages and transitive dependencies. A single vulnerable dependency (e.g., Log4Shell) can compromise the host. Attackers also execute typosquatting and account-takeover attacks against package registries (npm, PyPI).
- **SCA**: Automated tooling that analyzes project manifests, generates Software Bills of Materials (SBOMs), cross-references dependencies against CVE databases, and enforces security policies in CI/CD pipelines.

### 22. Threat Modeling & STRIDE

- **Concept**: A proactive engineering practice of identifying potential threats, vulnerabilities, and mitigations early in the architecture design phase.
- **STRIDE Framework**:
  - **S**poofing: Impersonating identities (Mitigation: Strong authentication, digital signatures).
  - **T**ampering: Modifying data on disk or in transit (Mitigation: Hashes, TLS, integrity controls).
  - **R**epudiation: Denying an action took place (Mitigation: Cryptographic audit logging).
  - **I**nformation Disclosure: Exposing confidential data (Mitigation: Encryption, access controls).
  - **D**enial of Service: Exhausting resources (Mitigation: Rate limiting, load balancing).
  - **E**levation of Privilege: Gaining unauthorized access (Mitigation: Least privilege, authorization checks).

### 23. Zero Trust Architecture (ZTA)

- **Challenged Assumptions**: Challenges the traditional perimeter model ("castle-and-moat") which assumed that any user or system inside the corporate network is inherently trustworthy.
- **Core Principles**: "Never trust, always verify." Enforces continuous authentication, device posture checks, dynamic micro-segmentation, and explicit authorization for every request, regardless of whether it originates inside or outside the physical network.

### 24. Balancing Security and Usability

- **Security-Usability Tradeoff**: Overly restrictive or cumbersome security controls incentivize users to find workarounds (e.g., writing passwords on sticky notes, using unapproved shadow IT tools).
- **Optimal Balance**: Security controls should be seamless and integrated into user workflows. Examples include passwordless authentication (FIDO2 / biometrics), single sign-on (SSO), and contextual risk-based access policies that prompt for additional verification only when anomalous signals are detected.
