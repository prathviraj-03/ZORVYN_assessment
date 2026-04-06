import dotenv from 'dotenv';
import path from 'path';

export default async function globalSetup() {
  dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });
  process.env.DATABASE_URL = process.env.DATABASE_URL!;
}
