import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../app.js';

describe('Chat Routes', () => {
    let agent;
    const testUser = {
        fullName: 'Chat Test User',
        email: `chat_test_${Date.now()}@example.com`,
        password: 'password123'
    };

    beforeEach(async () => {
        agent = request.agent(app);
        
        // Register the user
        await agent.post('/api/v1/user/register').send(testUser);
        
        // Login to set the JWT cookie in the `agent`
        await agent.post('/api/v1/user/login').send({ email: testUser.email, password: testUser.password });
    });

    it('should create a new chat and return the chat object', async () => {
        const res = await agent.post('/api/v1/chat/create').send({
            chatName: "Test Chat",
            docsUrl: "https://example.com"
        });

        expect(res.status).toBe(201); // Assuming 201 Created
        expect(res.body.success).toBe(true);
        expect(res.body.data.chat.chatName).toBe("Test Chat");
        expect(res.body.data.chat.id).toBeDefined();
    });

    it('should list only chats owned by the user', async () => {
        // Create a chat first
        await agent.post('/api/v1/chat/create').send({
            chatName: "My Private Chat",
            docsUrl: "https://example.com"
        });

        // List chats
        const res = await agent.get('/api/v1/chat/all');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.chats.length).toBeGreaterThan(0);
        expect(res.body.data.chats[0].chatName).toBe("My Private Chat");
    });
});
