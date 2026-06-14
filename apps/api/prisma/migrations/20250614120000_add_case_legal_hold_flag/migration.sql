-- Faz 8 İterasyon 5: retention purge legal_hold skip
ALTER TABLE "cases" ADD COLUMN "legal_hold_flag" BOOLEAN NOT NULL DEFAULT false;
