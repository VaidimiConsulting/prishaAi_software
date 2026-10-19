-- ============================================================
-- Furniture Calculator — MySQL Schema
-- 1:1 equivalent of Spring Boot JPA entities + data.sql
-- Run this ONCE to set up your database
-- ============================================================

CREATE DATABASE IF NOT EXISTS furniture_calculator
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE furniture_calculator;

-- ── customer table ──────────────────────────────────────────
-- Mirrors: Customer.java entity
CREATE TABLE IF NOT EXISTS customer (
  id            BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255),
  address       TEXT         NOT NULL,
  city          VARCHAR(255),
  phone_number  VARCHAR(20)  NOT NULL
);

-- ── furniture_order table ────────────────────────────────────
-- Mirrors: FurnitureOrder.java entity
CREATE TABLE IF NOT EXISTS furniture_order (
  id                BIGINT         NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id       BIGINT         NOT NULL,
  category          VARCHAR(50)    NOT NULL,
  kitchen_type      VARCHAR(50),
  island_type       VARCHAR(50),
  wall_a            DOUBLE,
  wall_b            DOUBLE,
  wall_c            DOUBLE,
  door_type         VARCHAR(50),
  door_material     VARCHAR(50),
  length            DOUBLE,
  width             DOUBLE,
  budget_tier       VARCHAR(50)    NOT NULL,
  unit              VARCHAR(20)    NOT NULL,
  area_sqft         DOUBLE,
  estimated_price   DOUBLE,
  pdf_path          VARCHAR(500),
  design_image      VARCHAR(500),
  sent_on_whatsapp  TINYINT(1)     DEFAULT 0,
  FOREIGN KEY (customer_id) REFERENCES customer(id)
);

-- ── price_config table ───────────────────────────────────────
-- Mirrors: PriceConfig.java entity
CREATE TABLE IF NOT EXISTS price_config (
  id            BIGINT         NOT NULL AUTO_INCREMENT PRIMARY KEY,
  category      VARCHAR(50)    NOT NULL,
  kitchen_type  VARCHAR(50),
  island_type   VARCHAR(50),
  door_type     VARCHAR(50),
  door_material VARCHAR(50),
  budget_tier   VARCHAR(50)    NOT NULL,
  rate_per_unit DOUBLE         NOT NULL
);

-- ── Seed data ────────────────────────────────────────────────
-- 1:1 copy of data.sql
INSERT IGNORE INTO price_config (category, kitchen_type, island_type, door_type, door_material, budget_tier, rate_per_unit) VALUES
  -- Wardrobe rates (per sqft)
  ('WARDROBE', NULL, NULL, 'OPENING_DOOR', 'WOODEN', 'BUDGET',  800),
  ('WARDROBE', NULL, NULL, 'OPENING_DOOR', 'WOODEN', 'PREMIUM', 1200),
  ('WARDROBE', NULL, NULL, 'OPENING_DOOR', 'WOODEN', 'LUXURY',  1800),
  ('WARDROBE', NULL, NULL, 'OPENING_DOOR', 'GLASS',  'BUDGET',  900),
  ('WARDROBE', NULL, NULL, 'OPENING_DOOR', 'GLASS',  'PREMIUM', 1350),
  ('WARDROBE', NULL, NULL, 'OPENING_DOOR', 'GLASS',  'LUXURY',  2000),
  ('WARDROBE', NULL, NULL, 'SLIDING_DOOR', 'WOODEN', 'BUDGET',  850),
  ('WARDROBE', NULL, NULL, 'SLIDING_DOOR', 'WOODEN', 'PREMIUM', 1300),
  ('WARDROBE', NULL, NULL, 'SLIDING_DOOR', 'WOODEN', 'LUXURY',  1900),
  ('WARDROBE', NULL, NULL, 'SLIDING_DOOR', 'GLASS',  'BUDGET',  950),
  ('WARDROBE', NULL, NULL, 'SLIDING_DOOR', 'GLASS',  'PREMIUM', 1400),
  ('WARDROBE', NULL, NULL, 'SLIDING_DOOR', 'GLASS',  'LUXURY',  2100),

  -- Wooden Door rates (per sqft)
  ('WOODEN_DOOR', NULL, NULL, NULL, NULL, 'BUDGET',  600),
  ('WOODEN_DOOR', NULL, NULL, NULL, NULL, 'PREMIUM', 900),
  ('WOODEN_DOOR', NULL, NULL, NULL, NULL, 'LUXURY',  1400),

  -- Kitchen rates (per running foot)
  ('KITCHEN', 'L_SHAPE',  NULL, NULL, NULL, 'BUDGET',  1000),
  ('KITCHEN', 'L_SHAPE',  NULL, NULL, NULL, 'PREMIUM', 1500),
  ('KITCHEN', 'L_SHAPE',  NULL, NULL, NULL, 'LUXURY',  2200),

  ('KITCHEN', 'U_SHAPE',  NULL, NULL, NULL, 'BUDGET',  1100),
  ('KITCHEN', 'U_SHAPE',  NULL, NULL, NULL, 'PREMIUM', 1600),
  ('KITCHEN', 'U_SHAPE',  NULL, NULL, NULL, 'LUXURY',  2400),

  ('KITCHEN', 'ISLAND',   'L_ISLAND',        NULL, NULL, 'BUDGET',  1300),
  ('KITCHEN', 'ISLAND',   'L_ISLAND',        NULL, NULL, 'PREMIUM', 1800),
  ('KITCHEN', 'ISLAND',   'L_ISLAND',        NULL, NULL, 'LUXURY',  2800),
  ('KITCHEN', 'ISLAND',   'STRAIGHT_ISLAND', NULL, NULL, 'BUDGET',  1300),
  ('KITCHEN', 'ISLAND',   'STRAIGHT_ISLAND', NULL, NULL, 'PREMIUM', 1800),
  ('KITCHEN', 'ISLAND',   'STRAIGHT_ISLAND', NULL, NULL, 'LUXURY',  2800),

  ('KITCHEN', 'PARALLEL', NULL, NULL, NULL, 'BUDGET',  1050),
  ('KITCHEN', 'PARALLEL', NULL, NULL, NULL, 'PREMIUM', 1550),
  ('KITCHEN', 'PARALLEL', NULL, NULL, NULL, 'LUXURY',  2300);
