import type { DrizzleDatabase } from "../persistence/db";
import { PgUserRepository } from "../persistence/repositories";
import { DEFAULT_ADMIN_USER, DEFAULT_DEMO_USER } from "./constants";
import { hashPassword } from "./password";

export { DEFAULT_ADMIN_USER, DEFAULT_DEMO_USER };

/**
 * Seeds default administrator and demo user accounts for development and testing.
 *
 * SECURITY: This function is strictly disabled in production environments
 * unless explicitly authorized via ALLOW_DEV_SEED=true.
 */
export async function seedDefaultUsers(db: DrizzleDatabase): Promise<void> {
  // Prevent unintended demo user provisioning in production
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_DEV_SEED !== "true"
  ) {
    return;
  }

  const adminEmail = process.env.DEV_ADMIN_EMAIL || DEFAULT_ADMIN_USER.email;
  const adminPassword =
    process.env.DEV_ADMIN_PASSWORD || DEFAULT_ADMIN_USER.password;
  const adminName = DEFAULT_ADMIN_USER.name;

  const userEmail = process.env.DEV_USER_EMAIL || DEFAULT_DEMO_USER.email;
  const userPassword =
    process.env.DEV_USER_PASSWORD || DEFAULT_DEMO_USER.password;
  const userName = DEFAULT_DEMO_USER.name;

  const userRepo = new PgUserRepository(db);

  const existingAdmin = await userRepo.findByEmail(adminEmail);
  if (!existingAdmin) {
    const passwordHash = await hashPassword(adminPassword);
    await userRepo.create({
      email: adminEmail,
      name: adminName,
      passwordHash,
      role: "ADMIN",
      isActive: true,
    });
  }

  const existingUser = await userRepo.findByEmail(userEmail);
  if (!existingUser) {
    const passwordHash = await hashPassword(userPassword);
    await userRepo.create({
      email: userEmail,
      name: userName,
      passwordHash,
      role: "USER",
      isActive: true,
    });
  }
}
