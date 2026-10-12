/**
 * Price Model
 * Type definitions for fuel prices
 */

/**
 * Fuel types available
 */
export type FuelType = 'AI-92' | 'AI-95' | 'AI-98' | 'Diesel';

/**
 * Price record
 */
export interface IPrice {
  id: string;
  azs_id: string;
  fuel_type: FuelType;
  price: number;
  cost: number;
  margin: number;
  margin_percent: number;
  effective_from: Date;
  created_at: Date;
  updated_at: Date;
}

/**
 * Price history record
 */
export interface IPriceHistory {
  id: string;
  price_id: string;
  azs_id: string;
  fuel_type: FuelType;
  price: number;
  changed_by: string;
  changed_at: Date;
}

/**
 * Price update request
 */
export interface IUpdatePriceRequest {
  fuel_type: FuelType;
  price: number;
  effective_from?: Date;
}

/**
 * Price statistics
 */
export interface IPriceStats {
  fuel_type: FuelType;
  avg_price: number;
  min_price: number;
  max_price: number;
  count: number;
}

/**
 * Competitor price comparison
 */
export interface ICompetitorPrices {
  fuel_type: FuelType;
  our_price: number;
  competitor_avg: number;
  difference: number;
  difference_percent: number;
  below_market: boolean;
}
