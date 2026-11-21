-- Vendor portal migration. Safe to run on an existing database (and more than once).
-- Run:  mysql -u root -p < database/vendor_portal.sql
USE batloung_farm_db;

CREATE TABLE IF NOT EXISTS vendor_accounts (
  vendor_account_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  vendor_id INT UNSIGNED NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (vendor_account_id),
  UNIQUE KEY uq_vendor_accounts_vendor (vendor_id),
  CONSTRAINT fk_vendor_accounts_vendor FOREIGN KEY (vendor_id)
    REFERENCES vendors (vendor_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
