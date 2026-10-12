/**
 * Recommendation Model
 * Type definitions for pricing recommendations
 */

/**
 * Price recommendation
 */
export interface IRecommendation {
  id: string;
  azs_id: string;
  fuel_type: string;
  current_price: number;
  recommended_price: number;
  confidence: number;
  reason: string;
  elasticity: number;
  competitor_avg: number;
  estimated_revenue_impact: number;
  estimated_volume_impact: number;
  created_at: Date;
  expires_at: Date;
  is_applied: boolean;
  applied_at?: Date;
}

/**
 * Request to calculate recommendations
 */
export interface IRecommendationRequest {
  azs_id?: string;
  fuel_type?: string;
  include_historical: boolean;
  confidence_threshold?: number;
}

/**
 * Recommendation response
 */
export interface IRecommendationResponse {
  azs_id: string;
  recommendations: IRecommendation[];
  total_estimated_revenue_impact: number;
  generated_at: Date;
}

/**
 * Recommendation engine parameters
 */
export interface IRecommendationParams {
  elasticity: number;
  competitor_price: number;
  cost_price: number;
  current_price: number;
}

/**
 * Elasticity data for demand calculation
 */
export interface IElasticityData {
  fuel_type: string;
  region: string;
  elasticity: number;
  last_updated: Date;
}
