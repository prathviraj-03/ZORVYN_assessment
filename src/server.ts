import { app } from './app';
import { env } from '@/config/env';

const PORT = parseInt(env.PORT, 10);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📄 Swagger docs at http://localhost:${PORT}/api/docs`);
  console.log(`🌍 Environment: ${env.NODE_ENV}`);
});