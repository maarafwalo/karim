-- 38 products from joud-lite
-- Step 1: ensure the categories we reference exist (no-op if they already do)
INSERT INTO categories (name, emoji)
VALUES
  ('الدقيق و سميدة', '🌾'),
  ('المربى و العسل', '🍯'),
  ('الشاي',          '🍵'),
  ('المعلبات',       '🥫'),
  ('بيمو',           '🍫'),
  ('حليب وفرماج',    '🧀'),
  ('شوكولاطة',       '🍫')
ON CONFLICT (name) DO NOTHING;

-- Step 2: products. category_id is looked up by name at insert time.
INSERT INTO products (name, size, sell_price, cost_price, barcode, emoji, image_url, is_active, is_hidden, category_id) VALUES
('مرسى السردين بالزيت النباتي غ 125', 'pièce', 6, 4.55, '769503575445', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='المعلبات' LIMIT 1)),
('فروماج احمر تاج', 'pièce', 13, 11.5, '8710912203292', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='حليب وفرماج' LIMIT 1)),
('شرائح التون گارسيا 125 غ', 'pièce', 14, 11.72, '769503575001', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='المعلبات' LIMIT 1)),
('فروماج مربع شيدار 24', 'pièce', 18, 14, '6111260230619', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='حليب وفرماج' LIMIT 1)),
('دقيق النور 25 ك', 'pièce', 85, 83, '260120143234', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='الدقيق و سميدة' LIMIT 1)),
('الإتقان دقيق النوارة 5 ك', 'pièce', 25, 21.75, '6111249940164', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='الدقيق و سميدة' LIMIT 1)),
('جولي إسقمري زيت', 'pièce', 10, 8.7, '6111162001218', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='المعلبات' LIMIT 1)),
('ديليسيا مربى المشمش 830غ', 'pièce', 26, 23, '6111162000723', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='المربى و العسل' LIMIT 1)),
('ديليسيا مربى التوت 430غ', 'pièce', 15, 14.3, '6111162000839', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='المربى و العسل' LIMIT 1)),
('الدحميس 200غ', 'pièce', 19, 18.3, '6111175000741', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='الدقيق و سميدة' LIMIT 1)),
('ديليسيا مربى التوت 240 غ', 'pièce', 9.5, 8.5, '6111162001164', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='المربى و العسل' LIMIT 1)),
('ديليسيا مربى المشمش 240 غ', 'pièce', 9, 8, '6111162001188', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='المربى و العسل' LIMIT 1)),
('السبع 4011 100غ', 'pièce', 10, 9.3, '6923818881323', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='الدقيق و سميدة' LIMIT 1)),
('السبع 4011 200غ', 'pièce', 19, 18.3, '6923818812082', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='الدقيق و سميدة' LIMIT 1)),
('شاي بارود 200غ', 'pièce', 14, 13.4, '6111069004794', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='الشاي' LIMIT 1)),
('شاي الدحميس 500غ', 'pièce', 47, 45.75, '6111175000772', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='الشاي' LIMIT 1)),
('جولي سندويتش طماطم', 'pièce', 12, 10, '6111162002703', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='بيمو' LIMIT 1)),
('مربى الفراوله دليسيا 830 غ', 'pièce', 28, 26.5, '6111162000822', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='المربى و العسل' LIMIT 1)),
('شرائح فروماج احمر', 'pièce', 14, 11.2, '6111242665996', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='حليب وفرماج' LIMIT 1)),
('جولي سردين حار 115 غ', 'pièce', 6.5, 5.1, '6111162000402', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='المعلبات' LIMIT 1)),
('شكلاط نوتابيلا 700غ', 'pièce', 16, 10.25, '6111265980250', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='شوكولاطة' LIMIT 1)),
('سردين المهاجر 125غ', 'pièce', 6, 5.2, '251230172718', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='المعلبات' LIMIT 1)),
('شاي الواد وادي', 'pièce', 29, 27.5, '6976308941601', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='الشاي' LIMIT 1)),
('شكلاط نوطابيلا 900 غ', 'pièce', 20, 17, '6111262860098', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='شوكولاطة' LIMIT 1)),
('شكلاط نوطابيلا 400 غ', 'pièce', 12, 9, '6111265980212', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='شوكولاطة' LIMIT 1)),
('شاي الواد وادي 200 غ', 'pièce', 12, 11, '6920321513154', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='الشاي' LIMIT 1)),
('شاي الدحميس 100 غ', 'pièce', 10, 9.5, '6111175001625', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='الشاي' LIMIT 1)),
('شكلاط ماندي', 'pièce', 0.5, 0.38, '260118111235', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='شوكولاطة' LIMIT 1)),
('دقيق المدينة 25كغ', 'pièce', 96, 93.75, '260119191657', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='الدقيق و سميدة' LIMIT 1)),
('دقيق جوهرة 25كغ', 'pièce', 90, 86.5, '260119192919', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='الدقيق و سميدة' LIMIT 1)),
('دقيق المدينة 10كغ', 'pièce', 44, 41.5, '260120131553', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='الدقيق و سميدة' LIMIT 1)),
('دقيق المدينة 5 كغ', 'pièce', 23, 21.5, '260124154843', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='الدقيق و سميدة' LIMIT 1)),
('دقيق جوهرة 10 كغ', 'pièce', 39, 38, '260124155100', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='الدقيق و سميدة' LIMIT 1)),
('دقيق تزلفين 10 كغ', 'pièce', 43, 38, '260124155153', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='الدقيق و سميدة' LIMIT 1)),
('دقيق تزلفين 5 كغ', 'pièce', 23, 21, '260124155313', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='الدقيق و سميدة' LIMIT 1)),
('دقيق تزلفين 25 كغ', 'pièce', 93, 0, '260202104942', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='الدقيق و سميدة' LIMIT 1)),
('دقيق الاتقان 10 كغ', 'pièce', 47, 0, '6111249940171', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='الدقيق و سميدة' LIMIT 1)),
('دقيق الاتقان 25', 'pièce', 105, 104, '6111249940119', '📦', NULL, true, false, (SELECT id FROM categories WHERE name='الدقيق و سميدة' LIMIT 1))
ON CONFLICT DO NOTHING;
