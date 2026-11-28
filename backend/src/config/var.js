export const config = Object.freeze({
    server: {
        // IMPORTANT: 127.0.0.1 only allows this computer (safe default, there is no auth yet).
        // Set HOST=0.0.0.0 in .env to let the Pico W connect over Wi-Fi.
        host: process.env.HOST ?? '127.0.0.1',
        port: Number(process.env.PORT ?? 3000),
    },

    client: {
        url: process.env.WEB_CLIENT_URL,
    },

    supaBase: {
        url: process.env.SUPABASE_URL,
        publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
    },
    env: {
        isProduction: process.env.PRODUCTION,
    }
});