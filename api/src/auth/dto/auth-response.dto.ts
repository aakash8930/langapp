import { UserResponse } from '../../user/dto/user-response.dto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** Access token lifetime in seconds, so clients don't have to decode the JWT. */
  expiresIn: number;
}

export interface AuthResponse {
  user: UserResponse;
  tokens: TokenPair;
}
