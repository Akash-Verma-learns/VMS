import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// We add a retryStrategy that returns 'null' so it fails quietly instead of spamming the console
export const redisPublisher = new Redis(redisUrl, {
    retryStrategy: () => null
});

export const redisSubscriber = new Redis(redisUrl, {
    retryStrategy: () => null
});

redisPublisher.on('error', () => {
    // Silencing the error log for local testing
});

redisSubscriber.on('error', () => {
    // Silencing the error log for local testing
});