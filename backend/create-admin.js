require('dotenv').config();

const bcrypt = require('bcryptjs');
const readline = require('node:readline');
const pool = require('./config/db');

function ask(prompt) {
  const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => terminal.question(prompt, (answer) => {
    terminal.close();
    resolve(answer.trim());
  }));
}

function askHidden(prompt) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    if (!input.isTTY) return reject(new Error('Run this command in an interactive terminal.'));

    readline.emitKeypressEvents(input);
    input.setRawMode(true);
    input.resume();
    process.stdout.write(prompt);
    let value = '';

    const cleanup = () => {
      input.off('keypress', onKeypress);
      input.setRawMode(false);
      input.pause();
      process.stdout.write('\n');
    };

    const onKeypress = (character, key) => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        reject(new Error('Admin creation cancelled.'));
      } else if (key.name === 'return') {
        cleanup();
        resolve(value);
      } else if (key.name === 'backspace') {
        value = value.slice(0, -1);
      } else if (!key.ctrl && !key.meta) {
        value += character;
      }
    };

    input.on('keypress', onKeypress);
  });
}

async function main() {
  const name = await ask('Admin name: ');
  const email = (await ask('Admin email: ')).toLowerCase();
  const password = await askHidden('Admin password (hidden): ');

  if (!name || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a name (up to 120 characters) and a valid email address.');
  }
  if (Buffer.byteLength(password, 'utf8') < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Password must be between 8 and 72 bytes.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await pool.execute(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [name, email, passwordHash, 'admin']
  );
  console.log(`Admin account created for ${email}.`);
}

main()
  .catch((error) => {
    if (error.code === 'ER_DUP_ENTRY') {
      console.error('An account with that email already exists.');
    } else {
      console.error(error.message);
    }
    process.exitCode = 1;
  })
  .finally(() => pool.end());
