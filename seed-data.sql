-- ====================================================================
-- CyberMart Database Schema & Seed Data
-- E-Commerce & Healthcare Security Lab Database
-- ====================================================================

-- Drop existing tables if re-initializing
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS transfers;
DROP TABLE IF EXISTS coupons;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS users;

-- 1. USERS TABLE
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer',
    email TEXT NOT NULL,
    balance REAL NOT NULL DEFAULT 500.00,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. PRODUCTS TABLE
CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price REAL NOT NULL,
    description TEXT NOT NULL,
    stock INTEGER NOT NULL DEFAULT 50,
    image_url TEXT NOT NULL
);

-- 3. REVIEWS TABLE (Target for Stored XSS)
CREATE TABLE reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    comment TEXT NOT NULL,
    rating INTEGER NOT NULL DEFAULT 5,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id)
);

-- 4. COUPONS TABLE (Target for Blind/Intermediate SQL Injection)
CREATE TABLE coupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    discount_percent INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
);

-- 5. TRANSFERS TABLE (State-changing action audit log for CSRF)
CREATE TABLE transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_username TEXT NOT NULL,
    recipient_username TEXT NOT NULL,
    amount REAL NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- SEED DATA INSERTION
-- Requested Users: Shah Nawaz, Aamish Alvi, Ali Abbas
-- ====================================================================

INSERT INTO users (username, password, role, email, balance) VALUES
('Shah Nawaz', 'AdminPass2026!', 'admin', 'shahnawaz@cybermart-health.local', 25000.00),
('Aamish Alvi', 'RxSecure99', 'staff', 'aamish@cybermart-health.local', 4500.00),
('Ali Abbas', 'Password123', 'customer', 'aliabbas@cybermart.local', 1200.00),
('shahnawaz', 'AdminPass2026!', 'admin', 'shahnawaz.alt@cybermart-health.local', 25000.00),
('aamish', 'RxSecure99', 'staff', 'aamish.alt@cybermart-health.local', 4500.00),
('aliabbas', 'Password123', 'customer', 'aliabbas.alt@cybermart.local', 1200.00);

-- Products Seed
INSERT INTO products (name, category, price, description, stock, image_url) VALUES
('Digital Smart Thermometer', 'Equipment', 29.99, 'High-precision infrared contactless medical thermometer with OLED readout.', 120, 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400'),
('Advanced Pulse Oximeter', 'Equipment', 39.50, 'Fingertip blood oxygen saturation monitor with heart rate display.', 85, 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400'),
('Organic Multivitamin Complex', 'Supplements', 19.99, 'Comprehensive daily nutritional support packed with vitamins A, C, D3, and Zinc.', 200, 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=400'),
('Sterile First Aid Trauma Kit', 'Emergency', 49.99, 'Hospital-grade tactical first aid kit including compression bandages and antiseptic wipes.', 60, 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=400'),
('N95 Medical Respirator (20-Pack)', 'Protection', 24.99, 'NIOSH-certified 5-ply filtration protective face masks.', 350, 'https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=400'),
('Ultra-Pure Omega-3 Fish Oil', 'Supplements', 27.50, 'Triple-strength EPA/DHA molecularly distilled enteric coated softgels.', 140, 'https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=400');

-- Pre-seeded Reviews (Clean starting state)
INSERT INTO reviews (product_id, username, comment, rating) VALUES
(1, 'Shah Nawaz', 'Works very fast and the digital display is easy to read at night.', 5),
(2, 'Aamish Alvi', 'Reliable readings, compares well with clinical grade equipment.', 5),
(3, 'Ali Abbas', 'Great vitamins, felt an energy boost within a week.', 4);

-- Pre-seeded Promotional & Prescription Verification Coupons
INSERT INTO coupons (code, discount_percent, status) VALUES
('HEALTH10', 10, 'active'),
('VIP25', 25, 'active'),
('RXMED50', 50, 'active'),
('EXPIRED15', 15, 'expired');
