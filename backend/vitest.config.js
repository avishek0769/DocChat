import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    env: {
      DATABASE_URL: 'postgresql://testuser:testpassword@localhost:5433/docchat_test',
      JWT_SECRET: 'test_jwt_secret',
      NODE_ENV: 'test',
      PORT: '5001' // Use different port than dev
    },
  },
});
