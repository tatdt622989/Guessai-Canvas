#!/usr/bin/env node
/*
 * Prints a GUESSAI_ADMIN_PASSWORD_HASH for a new admin password (docs/server.md §6.1).
 *   node scripts/hash-password.js            asks for the password (not shown on screen)
 *   printf '%s' "$PASSWORD" | node scripts/hash-password.js
 */
import readline from 'node:readline';
import { hashPassword } from '../src/admin/password.js';

const MIN_LENGTH = 12;

const readHidden = (question) => new Promise((resolve) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  // Show the question, then hide what is typed
  rl.stdoutMuted = false;
  rl._writeToOutput = (text) => { if (!rl.stdoutMuted) rl.output.write(text); };
  rl.question(question, (answer) => {
    rl.close();
    process.stdout.write('\n');
    resolve(answer);
  });
  rl.stdoutMuted = true;
});

const readPiped = async () => {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
};

const main = async () => {
  let password;
  if (process.stdin.isTTY) {
    password = await readHidden('新的管理員密碼：');
    const again = await readHidden('再輸入一次：');
    if (password !== again) {
      console.error('兩次輸入的密碼不一樣。');
      process.exit(1);
    }
  } else {
    password = await readPiped();
  }
  if (password.length < MIN_LENGTH) {
    console.error(`密碼至少要 ${MIN_LENGTH} 個字元。`);
    process.exit(1);
  }
  console.log(await hashPassword(password));
};

main();
