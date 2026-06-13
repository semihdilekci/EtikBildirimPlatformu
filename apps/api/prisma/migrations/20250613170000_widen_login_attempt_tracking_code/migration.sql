-- Align login_attempts.tracking_code with ETK-XXXX-XXXX (14 chars)
ALTER TABLE "login_attempts" ALTER COLUMN "tracking_code" TYPE VARCHAR(14);
