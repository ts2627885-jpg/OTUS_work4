/**
 * User model and related interfaces
 */

export type UserRole = 'admin' | 'manager' | 'analyst' | 'viewer';

/**
 * User database entity
 */
export interface IUser {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  role_id: number;
  role?: UserRole;
  permissions?: string[];
  azs_access?: number[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * User response without sensitive data
 */
export interface IUserResponse {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  permissions: string[];
  azs_access: number[];
}

/**
 * Authentication payload
 */
export interface IAuthPayload {
  id: string;
  username: string;
  email: string;
  role_id: number;
  role?: UserRole;
  permissions?: string[];
}

/**
 * JWT token
 */
export interface IAuthToken {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number | string;
}

/**
 * Login request
 */
export interface ILoginRequest {
  username: string;
  password: string;
}

/**
 * Login response
 */
export interface ILoginResponse {
  token: IAuthToken;
  user: IUserResponse;
}

/**
 * Register request
 */
export interface IRegisterRequest {
  username: string;
  email: string;
  password: string;
}

/**
 * Role entity
 */
export interface IRole {
  id: number;
  name: UserRole;
  description: string;
  permissions: string[];
}

/**
 * Permission entity
 */
export interface IPermission {
  id: number;
  name: string;
  description: string;
  category: 'azs' | 'recommendations' | 'data' | 'users' | 'settings';
}
