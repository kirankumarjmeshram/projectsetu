import type { DrizzleDatabase } from "../persistence/db";
import { PgUserRepository } from "../persistence/repositories";
import { DEFAULT_ADMIN_USER, DEFAULT_DEMO_USER } from "./constants";
import { hashPassword } from "./password";

export { DEFAULT_ADMIN_USER, DEFAULT_DEMO_USER };

/**
 * Seeds default administrator and demo user accounts if they do not already exist.
 */
export async function seedDefaultUsers(db: DrizzleDatabase): Promise<void> {
  const userRepo = new PgUserRepository(db);

  const existingAdmin = await userRepo.findByEmail(DEFAULT_ADMIN_USER.email);
  if (!existingAdmin) {
    const passwordHash = await hashPassword(DEFAULT_ADMIN_USER.password);
    await userRepo.create({
      email: DEFAULT_ADMIN_USER.email,
      name: DEFAULT_ADMIN_USER.name,
      passwordHash,
      role: DEFAULT_ADMIN_USER.role,
      isActive: true,
    });
  }

  const existingUser = await userRepo.findByEmail(DEFAULT_DEMO_USER.email);
  if (!existingUser) {
    const passwordHash = await hashPassword(DEFAULT_DEMO_USER.password);
    await userRepo.create({
      email: DEFAULT_DEMO_USER.email,
      name: DEFAULT_DEMO_USER.name,
      passwordHash,
      role: DEFAULT_DEMO_USER.role,
      isActive: true,
    });
  }
}
