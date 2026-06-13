-- CreateTable
CREATE TABLE "secure_messages" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "sender_type" TEXT NOT NULL,
    "sender_user_id" TEXT,
    "message_body" TEXT NOT NULL,
    "attachments_metadata" TEXT,
    "encryption_metadata" JSONB NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "secure_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_sm_report_id" ON "secure_messages"("report_id");

-- CreateIndex
CREATE INDEX "idx_sm_direction" ON "secure_messages"("direction");

-- CreateIndex
CREATE INDEX "idx_sm_created_at" ON "secure_messages"("created_at");

-- AddForeignKey
ALTER TABLE "secure_messages" ADD CONSTRAINT "secure_messages_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Check constraints
ALTER TABLE "secure_messages" ADD CONSTRAINT "secure_messages_direction_check"
    CHECK ("direction" IN ('INBOUND_FROM_REPORTER', 'OUTBOUND_TO_REPORTER'));

ALTER TABLE "secure_messages" ADD CONSTRAINT "secure_messages_sender_type_check"
    CHECK ("sender_type" IN ('SYSTEM_USER', 'ANONYMOUS_REPORTER'));
