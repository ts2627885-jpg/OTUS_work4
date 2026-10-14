import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function addColumn() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'azs_pult',
  });

  try {
    console.log('Adding is_active column to users table...');

    // Add is_active column
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true
    `);
    console.log('✅ Added is_active column');

    // Update existing users
    await pool.query(`
      UPDATE users SET is_active = true WHERE is_active IS NULL
    `);
    console.log('✅ Updated existing users');

    console.log('\n✅ All done!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

addColumn();
