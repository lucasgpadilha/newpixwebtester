-- CreateTable
CREATE TABLE "TestStep" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "test_type" TEXT NOT NULL,
    "step_key" TEXT NOT NULL,
    "step_name" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "step_order" INTEGER NOT NULL,
    "weight" REAL NOT NULL DEFAULT 0,
    "is_auto_evaluated" BOOLEAN NOT NULL DEFAULT true,
    "requires_user_input" BOOLEAN NOT NULL DEFAULT false,
    "prompt_title" TEXT,
    "prompt_hint" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "TestStep_test_type_step_order_idx" ON "TestStep"("test_type", "step_order");

-- CreateIndex
CREATE UNIQUE INDEX "TestStep_test_type_step_key_key" ON "TestStep"("test_type", "step_key");
