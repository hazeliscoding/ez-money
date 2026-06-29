// Create backend/.env from the template on first setup (no-op if it exists).
const fs = require('fs');
const path = require('path');

const env = path.join(__dirname, '..', 'backend', '.env');
const example = path.join(__dirname, '..', 'backend', '.env.example');

if (fs.existsSync(env)) {
  console.log('backend/.env already exists — leaving it as is.');
} else if (fs.existsSync(example)) {
  fs.copyFileSync(example, env);
  console.log('Created backend/.env from .env.example.');
} else {
  console.warn('No backend/.env.example found; skipping.');
}
