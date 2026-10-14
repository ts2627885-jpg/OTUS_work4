import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function checkUsers() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'azs_pult',
  });

  try {
    const result = await pool.query('SELECT username, email, role, is_active FROM users');
    console.log('Users in database:');
    console.table(result.rows);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkUsers();
