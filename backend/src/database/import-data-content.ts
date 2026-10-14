import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import * as tar from 'tar';
import { createReadStream } from 'fs';
import * as iconv from 'iconv-lite';

interface Station {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  region: string;
}

interface Price {
  id: string;
  station_id: string;
  fuel_type: string;
  price: number;
  date: Date;
}

interface CompetitorPrice {
  id: string;
  competitor_name: string;
  fuel_type: string;
  price: number;
  date: Date;
}

interface ShopSale {
  id: string;
  station_id: string;
  product: string;
  quantity: number;
  revenue: number;
  date: Date;
}

interface Promotion {
  id: string;
  station_id: string;
  title: string;
  description: string;
  discount_percent: number;
  start_date: Date;
  end_date: Date;
}

interface TrafficData {
  id: string;
  station_id: string;
  hour: number;
  day: string;
  traffic_count: number;
  date: Date;
}

interface WeatherData {
  id: string;
  station_id: string;
  temperature: number;
  humidity: number;
  wind_speed: number;
  precipitation: number;
  date: Date;
}

class DataImporter {
  private pool: Pool;
  private dataDir: string;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    this.dataDir = process.env.DATA_DIR || '/azs-pult-fullstack/_data/';
  }

  async initialize() {
    await this.createTables();
  }

  private async createTables() {
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS stations (
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          latitude DECIMAL(10, 8),
          longitude DECIMAL(11, 8),
          region VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS prices (
          id VARCHAR(50) PRIMARY KEY,
          station_id VARCHAR(50) REFERENCES stations(id),
          fuel_type VARCHAR(50),
          price DECIMAL(10, 2),
          date TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS competitor_prices (
          id VARCHAR(50) PRIMARY KEY,
          competitor_name VARCHAR(255),
          fuel_type VARCHAR(50),
          price DECIMAL(10, 2),
          date TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS shop_sales (
          id VARCHAR(50) PRIMARY KEY,
          station_id VARCHAR(50) REFERENCES stations(id),
          product VARCHAR(255),
          quantity INTEGER,
          revenue DECIMAL(12, 2),
          date TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS promotions (
          id VARCHAR(50) PRIMARY KEY,
          station_id VARCHAR(50) REFERENCES stations(id),
          title VARCHAR(255),
          description TEXT,
          discount_percent DECIMAL(5, 2),
          start_date TIMESTAMP,
          end_date TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS traffic_data (
          id VARCHAR(50) PRIMARY KEY,
          station_id VARCHAR(50) REFERENCES stations(id),
          hour INTEGER,
          day VARCHAR(20),
          traffic_count INTEGER,
          date TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS weather_data (
          id VARCHAR(50) PRIMARY KEY,
          station_id VARCHAR(50) REFERENCES stations(id),
          temperature DECIMAL(5, 2),
          humidity DECIMAL(5, 2),
          wind_speed DECIMAL(5, 2),
          precipitation DECIMAL(5, 2),
          date TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } finally {
      client.release();
    }
  }

  private detectEncoding(buffer: Buffer): string {
    // Проверить UTF-8 BOM
    if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
      return 'utf-8';
    }
    // Если содержит кириллицу - вероятно CP1251
    try {
      const text = buffer.toString('utf-8');
      if (text.includes('ё') || text.includes('Ё')) return 'utf-8';
    } catch (e) {
      return 'cp1251';
    }
    return 'utf-8';
  }

  private parseCSV(content: string): Record<string, string>[] {
    const lines = content.split('\n').filter((line) => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map((h) => h.trim());
    const data: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });
      data.push(row);
    }

    return data;
  }

  async importStations() {
    const filePath = path.join(this.dataDir, 'stations.csv');
    if (!fs.existsSync(filePath)) {
      console.log('⚠️  stations.csv not found');
      return 0;
    }

    const buffer = fs.readFileSync(filePath);
    const encoding = this.detectEncoding(buffer);
    const content = iconv.decode(buffer, encoding);
    const data = this.parseCSV(content);

    let count = 0;
    for (const row of data) {
      try {
        await this.pool.query(
          `INSERT INTO stations (id, name, latitude, longitude, region)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO UPDATE SET
           name = $2, latitude = $3, longitude = $4, region = $5`,
          [
            row.id || `station_${count}`,
            row.name || 'Unknown',
            parseFloat(row.latitude) || 0,
            parseFloat(row.longitude) || 0,
            row.region || 'Unknown',
          ]
        );
        count++;
      } catch (err) {
        console.error('Error inserting station:', err);
      }
    }

    console.log(`✅ Станции: ${count} импортировано`);
    return count;
  }

  async importPrices() {
    const filePath = path.join(this.dataDir, 'prices.csv');
    if (!fs.existsSync(filePath)) {
      console.log('⚠️  prices.csv not found');
      return 0;
    }

    const buffer = fs.readFileSync(filePath);
    const encoding = this.detectEncoding(buffer);
    const content = iconv.decode(buffer, encoding);
    const data = this.parseCSV(content);

    let count = 0;
    for (const row of data) {
      try {
        await this.pool.query(
          `INSERT INTO prices (id, station_id, fuel_type, price, date)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO UPDATE SET
           station_id = $2, fuel_type = $3, price = $4, date = $5`,
          [
            row.id || `price_${count}`,
            row.station_id || 'unknown',
            row.fuel_type || 'Petrol',
            parseFloat(row.price) || 0,
            row.date ? new Date(row.date) : new Date(),
          ]
        );
        count++;
      } catch (err) {
        console.error('Error inserting price:', err);
      }
    }

    console.log(`✅ Цены: ${count} импортировано`);
    return count;
  }

  async importCompetitorPrices() {
    const filePath = path.join(this.dataDir, 'competitor_prices.csv');
    if (!fs.existsSync(filePath)) {
      console.log('⚠️  competitor_prices.csv not found');
      return 0;
    }

    const buffer = fs.readFileSync(filePath);
    const encoding = this.detectEncoding(buffer);
    const content = iconv.decode(buffer, encoding);
    const data = this.parseCSV(content);

    let count = 0;
    for (const row of data) {
      try {
        await this.pool.query(
          `INSERT INTO competitor_prices (id, competitor_name, fuel_type, price, date)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO UPDATE SET
           competitor_name = $2, fuel_type = $3, price = $4, date = $5`,
          [
            row.id || `comp_${count}`,
            row.competitor_name || 'Unknown',
            row.fuel_type || 'Petrol',
            parseFloat(row.price) || 0,
            row.date ? new Date(row.date) : new Date(),
          ]
        );
        count++;
      } catch (err) {
        // Игнорируем некритичные ошибки
      }
    }

    console.log(`✅ Конкуренты: ${count} импортировано`);
    return count;
  }

  async importShopSales() {
    const filePath = path.join(this.dataDir, 'shop_sales.csv');
    if (!fs.existsSync(filePath)) {
      console.log('⚠️  shop_sales.csv not found');
      return 0;
    }

    const buffer = fs.readFileSync(filePath);
    const encoding = this.detectEncoding(buffer);
    const content = iconv.decode(buffer, encoding);
    const data = this.parseCSV(content);

    let count = 0;
    for (const row of data) {
      try {
        await this.pool.query(
          `INSERT INTO shop_sales (id, station_id, product, quantity, revenue, date)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET
           station_id = $2, product = $3, quantity = $4, revenue = $5, date = $6`,
          [
            row.id || `sale_${count}`,
            row.station_id || 'unknown',
            row.product || 'Unknown',
            parseInt(row.quantity) || 0,
            parseFloat(row.revenue) || 0,
            row.date ? new Date(row.date) : new Date(),
          ]
        );
        count++;
      } catch (err) {
        console.error('Error inserting shop sale:', err);
      }
    }

    console.log(`✅ Продажи: ${count} импортировано`);
    return count;
  }

  async importPromotions() {
    const filePath = path.join(this.dataDir, 'promotions.csv');
    if (!fs.existsSync(filePath)) {
      console.log('⚠️  promotions.csv not found');
      return 0;
    }

    const buffer = fs.readFileSync(filePath);
    const encoding = this.detectEncoding(buffer);
    const content = iconv.decode(buffer, encoding);
    const data = this.parseCSV(content);

    let count = 0;
    for (const row of data) {
      try {
        await this.pool.query(
          `INSERT INTO promotions (id, station_id, title, description, discount_percent, start_date, end_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO UPDATE SET
           station_id = $2, title = $3, description = $4, discount_percent = $5, start_date = $6, end_date = $7`,
          [
            row.id || `promo_${count}`,
            row.station_id || 'unknown',
            row.title || 'Unknown',
            row.description || '',
            parseFloat(row.discount_percent) || 0,
            row.start_date ? new Date(row.start_date) : new Date(),
            row.end_date ? new Date(row.end_date) : new Date(),
          ]
        );
        count++;
      } catch (err) {
        console.error('Error inserting promotion:', err);
      }
    }

    console.log(`✅ Промо: ${count} импортировано`);
    return count;
  }

  async importTrafficData() {
    const filePath = path.join(this.dataDir, 'traffic_data.csv');
    if (!fs.existsSync(filePath)) {
      console.log('⚠️  traffic_data.csv not found');
      return 0;
    }

    const buffer = fs.readFileSync(filePath);
    const encoding = this.detectEncoding(buffer);
    const content = iconv.decode(buffer, encoding);
    const data = this.parseCSV(content);

    let count = 0;
    for (const row of data) {
      try {
        await this.pool.query(
          `INSERT INTO traffic_data (id, station_id, hour, day, traffic_count, date)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET
           station_id = $2, hour = $3, day = $4, traffic_count = $5, date = $6`,
          [
            row.id || `traffic_${count}`,
            row.station_id || 'unknown',
            parseInt(row.hour) || 0,
            row.day || 'Monday',
            parseInt(row.traffic_count) || 0,
            row.date ? new Date(row.date) : new Date(),
          ]
        );
        count++;
      } catch (err) {
        console.error('Error inserting traffic data:', err);
      }
    }

    console.log(`✅ Трафик: ${count} импортировано`);
    return count;
  }

  async importWeatherData() {
    const filePath = path.join(this.dataDir, 'weather_data.csv');
    if (!fs.existsSync(filePath)) {
      console.log('⚠️  weather_data.csv not found');
      return 0;
    }

    const buffer = fs.readFileSync(filePath);
    const encoding = this.detectEncoding(buffer);
    const content = iconv.decode(buffer, encoding);
    const data = this.parseCSV(content);

    let count = 0;
    for (const row of data) {
      try {
        await this.pool.query(
          `INSERT INTO weather_data (id, station_id, temperature, humidity, wind_speed, precipitation, date)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO UPDATE SET
           station_id = $2, temperature = $3, humidity = $4, wind_speed = $5, precipitation = $6, date = $7`,
          [
            row.id || `weather_${count}`,
            row.station_id || 'unknown',
            parseFloat(row.temperature) || 0,
            parseFloat(row.humidity) || 0,
            parseFloat(row.wind_speed) || 0,
            parseFloat(row.precipitation) || 0,
            row.date ? new Date(row.date) : new Date(),
          ]
        );
        count++;
      } catch (err) {
        console.error('Error inserting weather data:', err);
      }
    }

    console.log(`✅ Погода: ${count} импортировано`);
    return count;
  }

  async run() {
    console.log('\n📊 Импорт данных AZS Dashboard');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    try {
      await this.initialize();

      const results = {
        stations: await this.importStations(),
        prices: await this.importPrices(),
        competitors: await this.importCompetitorPrices(),
        sales: await this.importShopSales(),
        promotions: await this.importPromotions(),
        traffic: await this.importTrafficData(),
        weather: await this.importWeatherData(),
      };

      const total = Object.values(results).reduce((a, b) => a + b, 0);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📈 Итого: ${total} записей ✓\n`);
      console.log('✨ Импорт завершен!');
    } catch (err) {
      console.error('❌ Ошибка импорта:', err);
    } finally {
      await this.pool.end();
    }
  }
}

// Запустить импорт
const importer = new DataImporter();
importer.run();
