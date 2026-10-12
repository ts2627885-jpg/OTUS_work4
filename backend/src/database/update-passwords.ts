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
    database: process.env.DB_NAME || 'azs_pult'
  });

  try {
    const passwords: { [key: string]: string } = {
      'admin': 'Admin123456',
      'manager': 'Manager123456',
      'analyst': 'Analyst123456'
    };

    for (const [username, password] of Object.entries(passwords)) {
      const hash = await bcrypt.hash(password, 10);
      await pool.query(
        'UPDATE users SET password_hash = $1 WHERE username = $2',
        [hash, username]
      );
      console.log(`✅ Updated ${username}: ${password}`);
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
