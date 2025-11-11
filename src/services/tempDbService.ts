import sqlite3 from 'sqlite3';
import fs from 'fs';

const createTempDb = (testId: string): Promise<sqlite3.Database> => {
  return new Promise((resolve, reject) => {
    const dbFilePath = `./${testId}.sqlite`;
    const db = new sqlite3.Database(dbFilePath, (err) => {
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
        if (err) return reject(err);
      })
      .run(createTransactionTable, (err) => {
        if (err) return reject(err);
        resolve(db);
      });
    });
  });
};

const destroyTempDb = (db: sqlite3.Database, testId: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const dbFilePath = `./${testId}.sqlite`;
    db.close((err) => {
      if (err) {
        console.error('Failed to close temp db:', err);
        return reject(err);
      }
      
      fs.unlink(dbFilePath, (err) => {
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

export const tempDbService = {
  createTempDb,
  destroyTempDb,
};
