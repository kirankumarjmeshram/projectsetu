export type UserRole = "USER" | "ADMIN";

export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: UserRole;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AuthSession {
  readonly id: string;
  readonly userId: string;
  readonly token: string;
  readonly expiresAt: Date;
  readonly user: AuthUser;
}

export interface AuthCredentials {
  readonly email: string;
  readonly password: string;
}

export interface CreateUserInput {
  readonly id?: string;
  readonly email: string;
  readonly name: string;
  readonly password: string;
  readonly role?: UserRole;
  readonly isActive?: boolean;
}

export interface AuthResult {
  readonly success: boolean;
  readonly user?: AuthUser;
  readonly error?: string;
}
