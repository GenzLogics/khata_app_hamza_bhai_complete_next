export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface SignUpRequest {
  email: string;
  password: string;
  full_name: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export interface SignUpResponse {
  message: string;
  user: User;
}

export interface SignInResponse {
  message: string;
  user: User;
  tokens: TokenResponse;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
