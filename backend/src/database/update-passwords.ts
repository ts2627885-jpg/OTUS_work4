import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function updatePasswords() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'azs_pult',
  });

  try {
    // Пароли только из окружения (в репозитории их нет); пустые или короткие — отказ
    const passwords: { [key: string]: string | undefined } = {
      admin: process.env.ADMIN_PASSWORD,
      manager: process.env.MANAGER_PASSWORD,
      analyst: process.env.ANALYST_PASSWORD,
      viewer: process.env.VIEWER_PASSWORD,
    };

    for (const [username, password] of Object.entries(passwords)) {
      if (!password || password.length < 8) {
        throw new Error(
          `Не задан пароль для ${username} (переменная ${username.toUpperCase()}_PASSWORD, не короче 8 символов)`
        );
      }
      const hash = await bcrypt.hash(password, 12);
      await pool.query('UPDATE users SET password_hash = $1 WHERE username = $2', [hash, username]);
      console.log(`✅ Updated ${username}`);
    }

    console.log('\n✅ All passwords updated successfully!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

updatePasswords();
