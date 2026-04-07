import path from 'path';
import dotenv from 'dotenv';

const envDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(envDir, '.env') });
dotenv.config({ path: path.join(envDir, '.env.local'), override: true });
