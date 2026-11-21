-- Batloung Farm Distribution System — MySQL 8 schema
CREATE DATABASE IF NOT EXISTS batloung_farm_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;
USE batloung_farm_db;

CREATE TABLE IF NOT EXISTS suppliers (
  supplier_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  business_name VARCHAR(140) NOT NULL,
  contact_person VARCHAR(120) NOT NULL,
  phone VARCHAR(24) NOT NULL,
  province ENUM('Gauteng', 'Free State', 'KwaZulu-Natal', 'Western Cape', 'Eastern Cape', 'Limpopo', 'Mpumalanga', 'North West') NOT NULL,
  address VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (supplier_id),
  UNIQUE KEY uq_suppliers_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS fruits (
  fruit_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  fruit_name VARCHAR(80) NOT NULL,
  description VARCHAR(500) NULL,
  status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  PRIMARY KEY (fruit_id),
  UNIQUE KEY uq_fruits_name (fruit_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS vendors (
  vendor_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  vendor_name VARCHAR(140) NOT NULL,
  phone_number VARCHAR(24) NOT NULL,
  location VARCHAR(180) NULL,
  registration_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  PRIMARY KEY (vendor_id),
  UNIQUE KEY uq_vendors_phone (phone_number),
  KEY idx_vendors_name (vendor_name),
  KEY idx_vendors_phone (phone_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS purchases (
  purchase_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  supplier_id INT UNSIGNED NOT NULL,
  purchase_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (purchase_id),
  KEY idx_purchases_supplier (supplier_id),
  KEY idx_purchases_date (purchase_date),
  CONSTRAINT fk_purchases_supplier FOREIGN KEY (supplier_id)
    REFERENCES suppliers (supplier_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_purchases_total CHECK (total_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS purchase_details (
  purchase_detail_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  purchase_id INT UNSIGNED NOT NULL,
  fruit_id INT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  unit_cost DECIMAL(10,2) NOT NULL,
  packaging_size ENUM('SMALL', 'MEDIUM', 'LARGE') NOT NULL,
  PRIMARY KEY (purchase_detail_id),
  KEY idx_purchase_details_purchase (purchase_id),
  KEY idx_purchase_details_fruit (fruit_id),
  CONSTRAINT fk_purchase_details_purchase FOREIGN KEY (purchase_id)
    REFERENCES purchases (purchase_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_purchase_details_fruit FOREIGN KEY (fruit_id)
    REFERENCES fruits (fruit_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_purchase_details_quantity CHECK (quantity > 0),
  CONSTRAINT chk_purchase_details_unit_cost CHECK (unit_cost >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS sales (
  sale_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  vendor_id INT UNSIGNED NOT NULL,
  sale_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payment_status ENUM('PAID', 'PARTIALLY_PAID', 'UNPAID') NOT NULL DEFAULT 'UNPAID',
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (sale_id),
  KEY idx_sales_vendor (vendor_id),
  KEY idx_sales_date (sale_date),
  KEY idx_sales_payment_status (payment_status),
  CONSTRAINT fk_sales_vendor FOREIGN KEY (vendor_id)
    REFERENCES vendors (vendor_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_sales_total CHECK (total_amount >= 0),
  CONSTRAINT chk_sales_amount_paid CHECK (amount_paid >= 0 AND amount_paid <= total_amount)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS sales_details (
  sales_detail_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  sale_id INT UNSIGNED NOT NULL,
  fruit_id INT UNSIGNED NOT NULL,
  packaging_size ENUM('SMALL', 'MEDIUM', 'LARGE') NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (sales_detail_id),
  KEY idx_sales_details_sale (sale_id),
  KEY idx_sales_details_fruit (fruit_id),
  CONSTRAINT fk_sales_details_sale FOREIGN KEY (sale_id)
    REFERENCES sales (sale_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_sales_details_fruit FOREIGN KEY (fruit_id)
    REFERENCES fruits (fruit_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_sales_details_quantity CHECK (quantity > 0),
  CONSTRAINT chk_sales_details_unit_price CHECK (unit_price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS stock (
  stock_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  fruit_id INT UNSIGNED NOT NULL,
  packaging_size ENUM('SMALL', 'MEDIUM', 'LARGE') NOT NULL,
  available_quantity INT UNSIGNED NOT NULL DEFAULT 0,
  selling_price DECIMAL(10,2) NOT NULL,
  low_stock_threshold INT UNSIGNED NOT NULL DEFAULT 10,
  PRIMARY KEY (stock_id),
  UNIQUE KEY uq_stock_fruit_size (fruit_id, packaging_size),
  KEY idx_stock_fruit (fruit_id),
  KEY idx_stock_quantity (available_quantity),
  CONSTRAINT fk_stock_fruit FOREIGN KEY (fruit_id)
    REFERENCES fruits (fruit_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_stock_available_quantity CHECK (available_quantity >= 0),
  CONSTRAINT chk_stock_selling_price CHECK (selling_price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS payments (
  payment_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  sale_id INT UNSIGNED NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_method ENUM('CASH', 'MOBILE_MONEY', 'CREDIT') NOT NULL,
  payment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reference VARCHAR(120) NULL,
  PRIMARY KEY (payment_id),
  KEY idx_payments_sale (sale_id),
  KEY idx_payments_date (payment_date),
  CONSTRAINT fk_payments_sale FOREIGN KEY (sale_id)
    REFERENCES sales (sale_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_payments_amount CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Staff and administrator accounts. The first person to register becomes the
-- administrator; everyone after that is read-only staff until an admin upgrades them.
CREATE TABLE IF NOT EXISTS users (
  user_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(40) NOT NULL,
  full_name VARCHAR(120) NULL,
  password_hash VARCHAR(100) NOT NULL,
  role ENUM('admin', 'staff') NOT NULL DEFAULT 'staff',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Vendor portal accounts (a vendor signs in with the phone number registered for them).
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
