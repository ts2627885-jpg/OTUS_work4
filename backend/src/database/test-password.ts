import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function testPassword() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'azs_pult',
  });

  try {
    const result = await pool.query(
      'SELECT username, password_hash FROM users WHERE username = $1',
      ['admin']
    );

    if (result.rows.length === 0) {
      console.log('Admin user not found');
      return;
    }

    const user = result.rows[0];
    console.log('Admin user found:');
    console.log('Username:', user.username);
    console.log('Password hash:', user.password_hash);

    // Пароль берётся из окружения (ADMIN_PASSWORD), не из кода
    const password = process.env.ADMIN_PASSWORD;
    if (!password) {
      console.log('Задайте ADMIN_PASSWORD в окружении, чтобы проверить пароль администратора');
      return;
    }
    const match = await bcrypt.compare(password, user.password_hash);

    console.log('Password match:', match);

    if (!match) {
      console.log('\n❌ Password does not match ADMIN_PASSWORD!');
    } else {
      console.log('\n✅ Password matches!');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testPassword();
