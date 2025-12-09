-- Limpar dados antigos
DELETE FROM restaurant_settings;

-- Inserir configurações corretas do restaurante
INSERT INTO restaurant_settings (
  name,
  phone,
  address,
  openingHours,
  acceptsDelivery,
  acceptsReservation,
  deliveryFee,
  minimumOrder,
  paymentMethods,
  createdAt,
  updatedAt
) VALUES (
  'Churrascaria Estrela do Sul',
  '(17) 3322-8899',
  'Rua dos Gaúchos, 123 - Centro, Barretos-SP',
  '{"almoco": "11:00 - 15:00", "jantar": "18:00 - 22:45"}',
  1,
  1,
  800,
  3000,
  '["Dinheiro", "Cartão de Débito", "Cartão de Crédito", "PIX"]',
  NOW(),
  NOW()
);
