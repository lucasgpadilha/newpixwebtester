-- CreateTable
CREATE TABLE "User" (
    "ra" TEXT NOT NULL PRIMARY KEY,
    "password_hash" TEXT NOT NULL,
    "is_admin" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "TestHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_ra" TEXT NOT NULL,
    "test_type" TEXT NOT NULL,
    "final_score" REAL NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TestHistory_user_ra_fkey" FOREIGN KEY ("user_ra") REFERENCES "User" ("ra") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TestStepResult" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "history_id" INTEGER NOT NULL,
    "step_name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    CONSTRAINT "TestStepResult_history_id_fkey" FOREIGN KEY ("history_id") REFERENCES "TestHistory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RAWhitelist" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ra" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "User_ra_key" ON "User"("ra");

-- CreateIndex
CREATE UNIQUE INDEX "RAWhitelist_ra_key" ON "RAWhitelist"("ra");
