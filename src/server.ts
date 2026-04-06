import { app } from './app';
import { env } from '@/config/env';
import { bootstrapAdmin } from '@/lib/bootstrap';

const PORT = parseInt(env.PORT, 10);

async function main() {
  await bootstrapAdmin();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Environment: ${env.NODE_ENV}`);
  });
}

main();
