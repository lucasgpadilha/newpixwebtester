"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tempDbService = void 0;
const sqlite3_1 = __importDefault(require("sqlite3"));
const fs_1 = __importDefault(require("fs"));
const createTempDb = (testId) => {
    return new Promise((resolve, reject) => {
        const dbFilePath = `./${testId}.sqlite`;
        const db = new sqlite3_1.default.Database(dbFilePath, (err) => {
            if (err) {
                console.error('Failed to create temp db:', err);
                return reject(err);
            }
            console.log(`Temporary database created at ${dbFilePath}`);
        });
        const createUserTable = `
      CREATE TABLE IF NOT EXISTS User (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ra TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        token TEXT,
        saldo REAL DEFAULT 0.0
      );
    `;
        const createTransactionTable = `
      CREATE TABLE IF NOT EXISTS Transaction (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES User(id)
      );
    `;
        db.serialize(() => {
            db.run(createUserTable, (err) => {
                if (err)
                    return reject(err);
            })
                .run(createTransactionTable, (err) => {
                if (err)
                    return reject(err);
                resolve(db);
            });
        });
    });
};
const destroyTempDb = (db, testId) => {
    return new Promise((resolve, reject) => {
        const dbFilePath = `./${testId}.sqlite`;
        db.close((err) => {
            if (err) {
                console.error('Failed to close temp db:', err);
                return reject(err);
            }
            fs_1.default.unlink(dbFilePath, (err) => {
                if (err) {
                    // It might already be gone, so just log it
                    console.error('Failed to delete temp db file:', err);
                }
                console.log(`Temporary database ${dbFilePath} destroyed.`);
                resolve();
            });
        });
    });
};
exports.tempDbService = {
    createTempDb,
    destroyTempDb,
};
//# sourceMappingURL=tempDbService.js.map