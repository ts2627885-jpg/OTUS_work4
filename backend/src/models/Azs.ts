/**
 * AZS (Gas Station) model and related interfaces
 */

export interface IAzs {
  id: number;
  name: string;
  location_region: string;
  latitude?: number;
  longitude?: number;
  manager_id?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface IFuelSales {
  id: number;
  azs_id: number;
  fuel_type: 'AI-92' | 'AI-95' | 'AI-98' | 'Diesel';
  price: number;
  quantity_sold: number;
  revenue: number;
  timestamp: Date;
}

export interface ITrafficData {
  id: number;
  azs_id: number;
  cars_count: number;
  peak_hour: boolean;
  weather_condition?: string;
  timestamp: Date;
}

export interface ICompetitorPrice {
  id: number;
  azs_id: number;
  competitor_name: string;
  fuel_type: string;
  price: number;
  distance_km: number;
  timestamp: Date;
}

export interface IWeatherData {
  id: number;
  azs_id: number;
  temperature: number;
  humidity: number;
  wind_speed: number;
  precipitation: number;
  condition: string;
  timestamp: Date;
}

export interface IAzsAccess {
  id: number;
  user_id: string;
  azs_id: number;
  created_at: Date;
}
