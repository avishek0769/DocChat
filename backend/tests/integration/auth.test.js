import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../app.js';

describe('Auth Routes', () => {
    const testUser = {
        fullName: 'Test Auth User',
        email: `test_auth_${Date.now()}@example.com`,
        password: 'password123'
    };

    it('should register a new user successfully', async () => {
        const res = await request(app)
            .post('/api/v1/user/register')
            .send(testUser);
        
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe("User registerd Successfully");
    });

    it('should login and return tokens', async () => {
        const res = await request(app)
            .post('/api/v1/user/login')
            .send({ email: testUser.email, password: testUser.password });
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.user.email).toBe(testUser.email);
        
        // Ensure cookies are set
        const cookies = res.headers['set-cookie'];
        expect(cookies).toBeDefined();
        expect(cookies.some(c => c.startsWith('accessToken='))).toBe(true);
        expect(cookies.some(c => c.startsWith('refreshToken='))).toBe(true);
    });

    it('should reject login with wrong password', async () => {
        const res = await request(app)
            .post('/api/v1/user/login')
            .send({ email: testUser.email, password: 'wrongpassword' });
        
        expect(res.status).toBe(400); // Or whatever status your app throws for invalid credentials
    });
});
