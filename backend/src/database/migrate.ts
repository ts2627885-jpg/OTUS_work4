import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function runMigration() {
  // First connect as postgres to create database and user if needed
  const adminPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: 5432,
    user: 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: 'postgres'
  });

  try {
    // Create database if it doesn't exist
    await adminPool.query(`CREATE DATABASE azs_pult`);
    console.log('Database created');
  } catch (error: any) {
    if (error.code === '42P04') {  // database already exists
      console.log('Database already exists');
    } else {
      throw error;
    }
  } finally {
    await adminPool.end();
  }

  // Now connect to the actual database
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'azs_pult'
  });

  try {
    const sqlFile = path.join(__dirname, 'init.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('Running migration...');
    await pool.query(sql);
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
