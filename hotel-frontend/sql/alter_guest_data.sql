-- Ejecutar sobre hotel_db: datos del huésped que pide el formulario del frontend
ALTER TABLE reservations
  ADD COLUMN guest_name VARCHAR(100) NOT NULL,
  ADD COLUMN guest_document VARCHAR(30) NOT NULL,
  ADD COLUMN guest_email VARCHAR(100) NOT NULL,
  ADD COLUMN guest_phone VARCHAR(30);
