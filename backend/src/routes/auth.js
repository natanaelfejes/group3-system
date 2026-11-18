import { urlNoPath, fullUrl} from "../helpers/urlHelper.js";
import {Router} from "express";
import {config} from "../config/var.js";




export const authRouter = Router();

authRouter.get("/auth/google", async (req, res) => {
    const currentUrl = urlNoPath(req);

    const supabase = req.supabase;

    const {data, error} = await supabase.auth.signInWithOAuth({
        provider: "google",
        options : {
            redirectTo: `${currentUrl}/api/auth/callback`
        }
    })

    if(error) {
        const currentFullUrl = fullUrl(req);
        console.error(`Error authenticating in ${currentFullUrl}: ${error}`);

        return res.status(500).json({error: "Failed to authenticate."})
    }
})

authRouter.get("/auth/callback", async (req, res) => {
    const code = req.query.code;

    if(typeof code !== 'string') {
        return res.redirect(`${config.client.url}/login?error=oauth`);
    }

    const { error } = await req.supabase.auth.exchangeCodeForSession(code);

    if (error) {
        return res.redirect(`${config.client.url}/login?error=oauth`);
    }

    // Session cookies have been written automatically.
    return res.redirect(`${config.client.url}/dashboard`);
})

export async function requireAuth(req, res, next) {
    try {
        const { data, error } = await req.supabase.auth.getClaims();

        if (error || !data?.claims) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        req.user = data.claims;
        next();

    } catch (error) {
        next(error);
    }
}

app.post('/auth/logout', requireAuth, async (req, res) => {
    const { error } = await req.supabase.auth.signOut({
        scope: 'local'
    });

    if (error) {
        return res.status(500).json({ error: 'Logout failed' });
    }

    return res.json({ message: 'Logged out successfully' });
});
