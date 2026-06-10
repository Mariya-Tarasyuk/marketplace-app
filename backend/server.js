require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());

app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Створюємо папку для завантажень, якщо її немає
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// Дозволяємо браузеру завантажувати ці файли за посиланням
app.use('/uploads', express.static(uploadsDir));

// Налаштування Multer (де зберігати і як називати файли)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    // Створюємо унікальне ім'я файлу: timestamp + оригінальне розширення (.fbx, .zip тощо)
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'model-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// НОВИЙ МАРШРУТ: API для завантаження файлу
app.post('/api/upload', upload.single('modelFile'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  // Генеруємо посилання на завантажений файл
  const fileUrl = `http://localhost:3000/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});


const pool = new Pool({
  // user: 'postgres',
  // host: 'localhost',
  // database: 'marketplace_DB',
  // password: 'Tarasyuk1', 
  // port: 5432,
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// ====== АВТООЧИЩЕННЯ БАЗИ ДАНИХ ПРИ ЗАПУСКУ СЕРВЕРА ======
const resetDatabase = async () => {
  try {
    console.log('Очищення бази даних перед презентацією...');
    
await pool.query('TRUNCATE TABLE users, assets, reviews, audit_logs, transactions RESTART IDENTITY CASCADE');
    console.log('✅ База даних успішно очищена! Всі лічильники ID скинуто на 1. Готова до завантаження CSV.');
  } catch (err) {
    console.error('Помилка очищення БД:', err);
  }
};
//resetDatabase();

// ====== НОВІ МАРШРУТИ ДЛЯ ТАБЛИЦЬ ======
// Додай ці два маршрути ДЕСЬ ПІСЛЯ app.get('/api/admin/users', ...)

app.get('/api/admin/assets', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.id, a.title, c.name as category, u.login as author, a.price_usd as price, a.average_rating as rating
      FROM assets a
      JOIN categories c ON a.category_id = c.id
      JOIN users u ON a.author_id = u.id
      ORDER BY a.id DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/reviews', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.id, a.title as asset, u.login as client, r.rating, r.comment
      FROM reviews r
      JOIN assets a ON r.asset_id = a.id
      JOIN users u ON r.client_id = u.id
      ORDER BY r.id DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/reviews', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.id, a.title as asset, u.login as client, r.rating, r.comment
      FROM "Reviews" r
      JOIN "Assets" a ON r.asset_id = a.id
      JOIN "Users" u ON r.client_id = u.id
      ORDER BY r.id DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Статистика для адмінки
app.get('/api/admin/stats', async (req, res) => {
  try {
    const usersCount = await pool.query('SELECT COUNT(*) FROM Users');
    const assetsCount = await pool.query('SELECT COUNT(*) FROM Assets');
    const reviewsCount = await pool.query('SELECT COUNT(*) FROM Reviews');
    res.json({
      users: parseInt(usersCount.rows[0].count),
      assets: parseInt(assetsCount.rows[0].count),
      reviews: parseInt(reviewsCount.rows[0].count)
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


app.get('/api/admin/users', async (req, res) => {
  try {
      const result = await pool.query(`
      SELECT u.id, u.login, u.email, r.role_name as role, u.balance_usd as balance 
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      ORDER BY u.id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/audit', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, action_type, table_name, record_id, description, 
      TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as time 
      FROM audit_logs 
      ORDER BY id DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.get('/api/admin/transactions', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.id, u.login as buyer, a.title as asset, t.amount_usd as amount, 
      TO_CHAR(t.transaction_date, 'YYYY-MM-DD HH24:MI') as date
      FROM transactions t
      JOIN users u ON t.buyer_id = u.id
      JOIN assets a ON t.asset_id = a.id
      ORDER BY t.id DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
// ІМПОРТ 1: КОРИСТУВАЧІ
app.post('/api/import/users', async (req, res) => {
  try {
    let inserted = 0;
    for (const u of req.body) {
      if (!u.login) continue;
      await pool.query(
        'INSERT INTO Users (login, email, password_hash, first_name, last_name, role_id, balance_usd) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (login) DO NOTHING',
        [u.login, u.email, u.password_hash, u.first_name, u.last_name, u.role_id, u.balance_usd]
      );
      inserted++;
    }
    res.json({ message: `Users imported: ${inserted}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
// Автогенерація тестових транзакцій (Database Seeder)
app.post('/api/admin/generate-transactions', async (req, res) => {
  try {
    // 1. Генеруємо 100 випадкових транзакцій для масовки
    await pool.query(`
      INSERT INTO transactions (buyer_id, asset_id, amount_usd)
      SELECT u.id, a.id, a.price_usd
      FROM users u
      CROSS JOIN assets a
      WHERE u.role_id = 3
      ORDER BY RANDOM()
      LIMIT 100;
    `);

    // 2. ГАРАНТОВАНО генеруємо 8 продажів для нашого "передостаннього" автора (роль 2)
    await pool.query(`
      INSERT INTO transactions (buyer_id, asset_id, amount_usd)
      SELECT u.id, a.id, a.price_usd
      FROM users u
      CROSS JOIN assets a
      WHERE u.role_id = 3 
        AND a.author_id = (SELECT id FROM users WHERE role_id = 2 ORDER BY id DESC LIMIT 1 OFFSET 1)
      ORDER BY RANDOM()
      LIMIT 8;
    `);

    res.json({ message: 'Transactions generated successfully' });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});
// ІМПОРТ 2: АКТИВИ (МОДЕЛІ)
// ======  ІМПОРТ 1: КОРИСТУВАЧІ ======
app.post('/api/import/users', async (req, res) => {
  let inserted = 0;
  for (const u of req.body) {
    if (!u.login) continue;
    try {
      // Використовуємо ON CONFLICT DO NOTHING для ігнорування дублікатів
      await pool.query(
        'INSERT INTO users (login, email, password_hash, first_name, last_name, role_id, balance_usd) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (login) DO NOTHING',
        [u.login, u.email, u.password_hash, u.first_name, u.last_name, u.role_id, u.balance_usd]
      );
      inserted++;
    } catch (err) {
      console.error(`Пропущено користувача ${u.login}:`, err.message);
    }
  }
  res.json({ message: `Users imported successfully.` });
});

// ======  ІМПОРТ 2: АКТИВИ (МОДЕЛІ) ======
app.post('/api/import/assets', async (req, res) => {
  let inserted = 0;
  for (const a of req.body) {
    if (!a.title) continue;
    try {
      // ПЕРЕВІРКА: Чи є вже така модель у цього автора?
      const exist = await pool.query('SELECT id FROM assets WHERE title = $1 AND author_id = $2', [a.title, a.author_id]);
      
      if (exist.rows.length === 0) { // Якщо немає, тоді зберігаємо
        await pool.query(
          'INSERT INTO assets (title, file_url, polygons_count, is_rigged, price_usd, category_id, author_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [a.title, a.file_url, a.polygons_count, a.is_rigged, a.price_usd, a.category_id, a.author_id]
        );
        inserted++;
      }
    } catch (err) {
      console.error(`Пропущено модель ${a.title}:`, err.message);
    }
  }
  res.json({ message: `Assets processed. Inserted new: ${inserted}` });
});

// ======  ІМПОРТ 3: ВІДГУКИ ======
app.post('/api/import/reviews', async (req, res) => {
  let inserted = 0;
  for (const r of req.body) {
    if (!r.comment) continue;
    try {
      // ПЕРЕВІРКА: Чи залишав цей клієнт точно такий самий відгук на цю модель?
      const exist = await pool.query('SELECT id FROM reviews WHERE asset_id = $1 AND client_id = $2 AND comment = $3', [r.asset_id, r.client_id, r.comment]);
      
      if (exist.rows.length === 0) { // Якщо немає, тоді зберігаємо
        await pool.query(
          'INSERT INTO reviews (asset_id, client_id, rating, comment) VALUES ($1, $2, $3, $4)',
          [r.asset_id, r.client_id, r.rating, r.comment]
        );
        inserted++;
      }
    } catch (err) {
      console.error(`Пропущено відгук:`, err.message);
    }
  }
  res.json({ message: `Reviews processed. Inserted new: ${inserted}` });
});

// ====== УПРАВЛІННЯ КОРИСТУВАЧАМИ (CRUD) ======

// Редагування користувача
app.put('/api/admin/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { login, email, balance } = req.body;
    
    // Захист: якщо ID прийшов пустий або як текст "null"
    if (!id || id === 'null') {
      return res.status(400).json({ error: 'User ID is missing!' });
    }

    // Перетворюємо баланс у число (щоб PostgreSQL не сварився)
    const numericBalance = parseFloat(balance) || 0;

    await pool.query(
      'UPDATE users SET login = $1, email = $2, balance_usd = $3 WHERE id = $4',
      [login, email, numericBalance, id]
    );
    res.json({ message: 'User updated successfully' });
  } catch (err) { 
    console.error("Backend Update Error:", err); // Друк справжньої помилки в термінал
    res.status(500).json({ error: err.message }); 
  }
});

// Видалення (Бан) користувача
app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // CASCADE в PostgreSQL автоматично видалить і моделі, і відгуки цього користувача!
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'User banned and deleted' });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});


// ==========================================
// ====== АВТОРСЬКИЙ ДАШБОРД (AUTHOR) =======
// ==========================================

// 1. Отримати "передостаннього" автора (Імітація логіну)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    // Шукаємо користувача з таким email та паролем
    const result = await pool.query('SELECT * FROM users WHERE email = $1 AND password_hash = $2', [email, password]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    res.json(result.rows[0]); // Повертаємо знайденого юзера
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.get('/api/author/me', async (req, res) => {
  try {
    const { userId } = req.query;
    let query = 'SELECT * FROM users WHERE role_id = 2 ORDER BY id DESC LIMIT 1 OFFSET 1';
    let params = [];
    
    if (userId) {
      query = 'SELECT * FROM users WHERE id = $1';
      params = [userId];
    }
    const result = await pool.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Author not found.' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. Отримати всі 3D-моделі цього конкретного автора
// 6. Додати нову модель (РЕАЛЬНА ФОРМА)
app.post('/api/author/:id/assets', async (req, res) => {
  try {
    const { id } = req.params;
    // ДОДАЛИ file_url
    const { title, file_url, price_usd, polygons_count, category_id, is_rigged } = req.body; 
    
    await pool.query(
      'INSERT INTO assets (title, file_url, polygons_count, is_rigged, price_usd, category_id, author_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [title, file_url, polygons_count, is_rigged, price_usd, category_id, id] // ВСТАВИЛИ file_url сюди
    );
    res.json({ message: 'Model uploaded successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
// Отримати всі 3D-моделі цього конкретного автора (ЦЕЙ МАРШРУТ ГУБИВСЯ!)
app.get('/api/author/:id/assets', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM assets WHERE author_id = $1 ORDER BY id DESC', [id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
// 3. Фальшиве виведення коштів (Withdrawal)
app.post('/api/author/:id/withdraw', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    
    // Перевіряємо, чи вистачає грошей
    const user = await pool.query('SELECT balance_usd FROM users WHERE id = $1', [id]);
    if (user.rows[0].balance_usd < amount) {
      return res.status(400).json({ error: 'Insufficient funds!' });
    }

    // Знімаємо гроші (Наш SQL-тригер аудиту автоматично це зафіксує!)
    await pool.query('UPDATE users SET balance_usd = balance_usd - $1 WHERE id = $2', [amount, id]);
    res.json({ message: `Successfully withdrew $${amount}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. Отримати історію продажів автора
app.get('/api/author/:id/sales', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.id, a.title as asset, u.login as buyer, t.amount_usd as amount, TO_CHAR(t.transaction_date, 'YYYY-MM-DD HH24:MI') as date
      FROM transactions t
      JOIN assets a ON t.asset_id = a.id
      JOIN users u ON t.buyer_id = u.id
      WHERE a.author_id = $1 ORDER BY t.id DESC
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 5. Отримати відгуки на моделі автора
app.get('/api/author/:id/reviews', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.id, a.title as asset, u.login as client, r.rating, r.comment
      FROM reviews r
      JOIN assets a ON r.asset_id = a.id
      JOIN users u ON r.client_id = u.id
      WHERE a.author_id = $1 ORDER BY r.id DESC
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 6. Додати нову модель (Швидке створення заглушки для тесту)
app.post('/api/author/:id/assets', async (req, res) => {
  try {
    const { id } = req.params;
    const mockTitle = "Neon Cyber-Prop " + Math.floor(Math.random() * 1000);
    await pool.query(
      'INSERT INTO assets (title, file_url, polygons_count, is_rigged, price_usd, category_id, author_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [mockTitle, 'https://example.com/file.fbx', 12500, false, 25.00, 2, id]
    );
    res.json({ message: 'Model uploaded successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 7. Змінити ціну моделі (Edit)
app.put('/api/author/assets/:assetId', async (req, res) => {
  try {
    const { price } = req.body;
    await pool.query('UPDATE assets SET price_usd = $1 WHERE id = $2', [price, req.params.assetId]);
    res.json({ message: 'Price updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 8. Видалити модель (Delete - з CASCADE!)
app.delete('/api/author/assets/:assetId', async (req, res) => {
  try {
    await pool.query('DELETE FROM assets WHERE id = $1', [req.params.assetId]);
    res.json({ message: 'Asset deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});



// --- ОНОВЛЕНІ МАРШРУТИ ПРОФІЛІВ ---
app.get('/api/client/me', async (req, res) => {
  try {
    const { userId } = req.query; // Отримуємо ID з фронтенду
    let query = 'SELECT * FROM users WHERE role_id = 3 ORDER BY id DESC LIMIT 1 OFFSET 1'; // Демо-режим
    let params = [];
    
    if (userId) { // Якщо є реальний ID - шукаємо його!
      query = 'SELECT * FROM users WHERE id = $1';
      params = [userId];
    }
    const result = await pool.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Client not found.' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// 2. Отримати всі 3D-моделі для вітрини маркетплейсу
app.get('/api/marketplace/assets', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, u.login as author_name, c.name as category_name
      FROM assets a
      JOIN users u ON a.author_id = u.id
      LEFT JOIN categories c ON a.category_id = c.id
      ORDER BY a.id DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. Отримати всі куплені моделі клієнта (Його бібліотека)
app.get('/api/client/:id/purchases', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, u.login as author_name, t.transaction_date 
      FROM transactions t
      JOIN assets a ON t.asset_id = a.id
      JOIN users u ON a.author_id = u.id
      WHERE t.buyer_id = $1 
      ORDER BY t.id DESC
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. Отримати всі відгуки, які залишив цей клієнт
app.get('/api/client/:id/reviews', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.id, a.title as asset, r.rating, r.comment
      FROM reviews r
      JOIN assets a ON r.asset_id = a.id
      WHERE r.client_id = $1 
      ORDER BY r.id DESC
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 5. Поповнення балансу клієнта (Top Up)
app.post('/api/client/:id/topup', async (req, res) => {
  try {
    const { amount } = req.body;
    await pool.query('UPDATE users SET balance_usd = balance_usd + $1 WHERE id = $2', [amount, req.params.id]);
    res.json({ message: `Successfully added $${amount} to balance!` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// 3. Купівля моделі (СПРАВЖНЯ SQL ТРАНЗАКЦІЯ!)
app.post('/api/marketplace/buy', async (req, res) => {
  const dbClient = await pool.connect(); // Беремо окреме з'єднання для транзакції
  try {
    const { buyer_id, asset_id, amount } = req.body;
    
    await dbClient.query('BEGIN'); // Початок транзакції

    // 1. Перевіряємо баланс покупця
    const userRes = await dbClient.query('SELECT balance_usd FROM users WHERE id = $1', [buyer_id]);
    if (userRes.rows[0].balance_usd < amount) {
      throw new Error('Insufficient funds');
    }

    // 2. Знімаємо гроші з покупця
    await dbClient.query('UPDATE users SET balance_usd = balance_usd - $1 WHERE id = $2', [amount, buyer_id]);

    // 3. Шукаємо автора і віддаємо гроші йому
    const assetRes = await dbClient.query('SELECT author_id FROM assets WHERE id = $1', [asset_id]);
    const author_id = assetRes.rows[0].author_id;
    await dbClient.query('UPDATE users SET balance_usd = balance_usd + $1 WHERE id = $2', [amount, author_id]);

    // 4. Записуємо чек у таблицю транзакцій
    await dbClient.query('INSERT INTO transactions (buyer_id, asset_id, amount_usd) VALUES ($1, $2, $3)', [buyer_id, asset_id, amount]);

    await dbClient.query('COMMIT'); // Якщо все успішно - зберігаємо!
    res.json({ message: 'Purchase successful!' });
  } catch (err) {
    await dbClient.query('ROLLBACK'); // Якщо десь помилка - відкочуємо ВСЕ назад!
    res.status(400).json({ error: err.message });
  } finally {
    dbClient.release();
  }
});

// 4. Залишити відгук
app.post('/api/client/reviews', async (req, res) => {
  try {
    const { client_id, asset_id, rating, comment } = req.body;
    await pool.query(
      'INSERT INTO reviews (client_id, asset_id, rating, comment) VALUES ($1, $2, $3, $4)', 
      [client_id, asset_id, rating, comment]
    );
    res.json({ message: 'Review published successfully!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// ====== АВТОРИЗАЦІЯ ТА РЕЄСТРАЦІЯ =========
// ==========================================

// Реєстрація нового користувача

app.post('/api/auth/register', async (req, res) => {
  try {
    const { login, email, password, role_id } = req.body;
    
    // Перевіряємо, чи немає вже такого email
    const checkUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists!' });
    }

    // Робимо магію: передаємо змінну login також і для first_name та last_name!
    await pool.query(
      `INSERT INTO users 
      (login, email, password_hash, first_name, last_name, role_id, balance_usd) 
      VALUES ($1, $2, $3, $4, $5, $6, 0)`, 
      [login, email, password, login, login, role_id]
    );
    
    res.json({ message: 'Registration successful!' });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

// ==========================================
// ====== CUSTOM ORDERS (За таблицею Orders)
// ==========================================

// 1. Створити нове замовлення (Клієнт)
// 1. Створення замовлення (ВИПРАВЛЕНО: додано повний client_notes)
// ==========================================
// ====== CUSTOM ORDERS (За таблицею Orders)
// ==========================================

// 1. Створити нове замовлення (Клієнт)
app.post('/api/orders', async (req, res) => {
  try {
    const { client_id, client_notes, total_price_usd, deadline } = req.body;
    const order_number = 'ORD-' + Math.floor(Math.random() * 10000) + '-' + Date.now().toString().slice(-4);

    await pool.query(
      `INSERT INTO orders (order_number, status, total_price_usd, client_notes, deadline, client_id) 
       VALUES ($1, 'Pending', $2, $3, $4, $5)`,
      [order_number, total_price_usd, client_notes, deadline, client_id]
    );
    res.json({ message: 'Order created successfully!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. Отримати замовлення КОНКРЕТНОГО КЛІЄНТА (для його Дашборда)
// 2. Отримати замовлення КОНКРЕТНОГО КЛІЄНТА (для його Дашборда)
// 1. Оновлений метод завершення замовлення (ПЕРЕКАЗ КОШТІВ ТА ХАК)
app.put('/api/orders/:id/complete', async (req, res) => {
  const dbClient = await pool.connect();
  try {
    const { id } = req.params;
    const { file_url } = req.body; 
    await dbClient.query('BEGIN');

    // Отримуємо ціну та учасників
    const orderRes = await dbClient.query('SELECT total_price_usd, client_id, author_id FROM orders WHERE id = $1', [id]);
    const order = orderRes.rows[0];
    const amount = parseFloat(order.total_price_usd);

    // Списуємо у клієнта, даємо автору
    await dbClient.query('UPDATE users SET balance_usd = balance_usd - $1 WHERE id = $2', [amount, order.client_id]);
    await dbClient.query('UPDATE users SET balance_usd = balance_usd + $1 WHERE id = $2', [amount, order.author_id]);

    // ХАК: Пишемо посилання у client_notes
    const hackyUrlString = `|||FILE_URL=${file_url}`;
    await dbClient.query(
      "UPDATE orders SET status = 'Completed', client_notes = client_notes || $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [hackyUrlString, id]
    );

    await dbClient.query('COMMIT');
    res.json({ message: 'Success' });
  } catch (err) { 
    await dbClient.query('ROLLBACK');
    res.status(500).json({ error: err.message }); 
  } finally { dbClient.release(); }
});

// 2. Оновлений метод отримання замовлень (РОЗШИФРОВКА ХАКУ)
app.get('/api/client/:id/orders', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders WHERE client_id = $1 ORDER BY created_at DESC', [req.params.id]);
    const parsedOrders = result.rows.map(order => {
      if (order.client_notes && order.client_notes.includes('|||FILE_URL=')) {
        const parts = order.client_notes.split('|||FILE_URL=');
        order.client_notes = parts[0]; 
        order.file_url = parts[1]; // Це поле з'явиться в об'єкті для Angular
      }
      return order;
    });
    res.json(parsedOrders);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. Отримати ВСІ відкриті замовлення (Для Біржі Авторів)
app.get('/api/orders', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT o.*, u.login as client_name 
      FROM orders o 
      JOIN users u ON o.client_id = u.id 
      WHERE o.status = 'Pending' 
      ORDER BY o.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ... далі йде app.get('/api/artists', ...)

app.get('/api/artists', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id, 
        u.login as name, 
        COUNT(DISTINCT a.id)::int as models_count,
        COALESCE(ROUND(AVG(r.rating), 1), 0) as average_rating
      FROM users u 
      LEFT JOIN assets a ON u.id = a.author_id 
      LEFT JOIN reviews r ON a.id = r.asset_id
      WHERE u.role_id = 2 
      GROUP BY u.id 
      ORDER BY average_rating DESC, models_count DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
// 4. Прийняти замовлення Автором
app.put('/api/orders/:id/accept', async (req, res) => {
  try {
    const { id } = req.params;
    const { author_id } = req.body;
    
    // Перевіряємо, чи замовлення ще вільне (Pending)
    const check = await pool.query("SELECT status FROM orders WHERE id = $1", [id]);
    if (check.rows.length === 0) return res.status(404).json({error: "Order not found"});
    if (check.rows[0].status !== 'Pending') return res.status(400).json({error: "This order is already taken by someone else!"});

    // Оновлюємо статус та призначаємо автора
    await pool.query(
      "UPDATE orders SET status = 'In Progress', author_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [author_id, id]
    );
    
    res.json({ message: 'Order accepted successfully!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Отримати прийняті замовлення автора (In Progress)
// ==========================================
// ====== АКТИВНІ ЗАМОВЛЕННЯ АВТОРА =========
// ==========================================
app.get('/api/author/:id/orders', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT o.*, u.login as client_name 
      FROM orders o 
      JOIN users u ON o.client_id = u.id 
      WHERE o.author_id = $1 AND o.status = 'In Progress'
      ORDER BY o.deadline ASC
    `, [id]);
    res.json(result.rows);
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

// 5. Завершити замовлення (Submit Work Автором)
app.put('/api/orders/:id/complete', async (req, res) => {
  try {
    // Змінюємо статус на Completed
    await pool.query(
      "UPDATE orders SET status = 'Completed', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [req.params.id]
    );
    res.json({ message: 'Order marked as completed!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/orders/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { file_url } = req.body; // Отримуємо посилання на завантажену модель

    await pool.query(
      "UPDATE orders SET status = 'Completed', file_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [file_url, id]
    );
    res.json({ message: 'Order marked as completed and file linked!' });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

// 5. Завершити замовлення (Submit Work Автором) + Перерахунок Балансу
// 5. Завершити замовлення (Submit Work Автором) + Перерахунок Балансу + ХАК ДЛЯ ФАЙЛУ
app.put('/api/orders/:id/complete', async (req, res) => {
  const dbClient = await pool.connect(); // Ізольована транзакція
  try {
    const { id } = req.params;
    const { file_url } = req.body; 

    await dbClient.query('BEGIN');

    // 1. Отримуємо ціну замовлення
    const orderRes = await dbClient.query('SELECT total_price_usd, client_id, author_id FROM orders WHERE id = $1', [id]);
    if (orderRes.rows.length === 0) throw new Error('Order not found');
    const order = orderRes.rows[0];
    const amount = parseFloat(order.total_price_usd);

    // 2. Перевіряємо баланс Клієнта
    const clientRes = await dbClient.query('SELECT balance_usd FROM users WHERE id = $1', [order.client_id]);
    if (clientRes.rows[0].balance_usd < amount) {
      throw new Error(`The Client does not have enough funds ($${amount}). Tell them to Top Up!`);
    }

    // 3. Знімаємо гроші з клієнта, даємо автору
    await dbClient.query('UPDATE users SET balance_usd = balance_usd - $1 WHERE id = $2', [amount, order.client_id]);
    await dbClient.query('UPDATE users SET balance_usd = balance_usd + $1 WHERE id = $2', [amount, order.author_id]);

    // 4. ХАК: Дописуємо посилання на файл у кінець колонки client_notes!
    const hackyUrlString = `|||FILE_URL=${file_url}`;
    await dbClient.query(
      "UPDATE orders SET status = 'Completed', client_notes = client_notes || $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [hackyUrlString, id]
    );

    await dbClient.query('COMMIT');
    res.json({ message: 'Order marked as completed, file saved, and funds transferred!' });
  } catch (err) { 
    await dbClient.query('ROLLBACK');
    res.status(500).json({ error: err.message }); 
  } finally {
    dbClient.release();
  }
});

app.listen(3000, () => console.log('Backend is running on port 3000'));