import { UserResponse } from '../../user/dto/user-response.dto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** Access token lifetime in seconds, so clients don't have to decode the JWT. */
  expiresIn: number;
}

export interface EmailDeliveryResponse {
  status: 'queued' | 'unavailable';
  deliveryId: string;
}

export interface AuthResponse {
  user: UserResponse;
  tokens: TokenPair;
  /** Present on registration; login has no email side effect. */
  emailDelivery?: EmailDeliveryResponse;
}
