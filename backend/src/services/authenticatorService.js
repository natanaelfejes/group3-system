import {createClient} from "@supabase/supabase-js";
import {createServerClient, parseCookieHeader, serializeCookieHeader} from "@supabase/ssr";
import cookies from "express/lib/application.js";

export class AuthenticatorService {

     API_KEY;
     URL;
    constructor(api_key, url) {
        this.API_KEY = api_key
        this.URL = url;
    }

     getClient(req, res) {
        try {
            return  createServerClient(
                this.URL,
                this.API_KEY,
                {
                    cookieOptions: {
                        path: '/',
                        sameSite: 'lax',
                        secure: isProduction,
                        httpOnly: true
                    },
                    cookies: {
                        getAll() {
                            let parsedHeaders = parseCookieHeader(req.headers.get('Cookie'));

                            return parsedHeaders.map((value) => {
                                value.name
                                value.value
                            });
                        },

                        setAll(cookiesToSet, cacheHeaders) {
                            for (const { name, value, options } of cookiesToSet) {
                                cookies.set(name, value);

                                res.append('Set-Cookie', serializeCookieHeader(
                                    name,
                                    value,
                                    {
                                        ...options,
                                        path: '/',
                                        sameSite: 'lax',
                                        secure: isProduction,
                                        httpOnly: true
                                    }
                                ));
                            }

                            for (const [key, value] of Object.entries(cacheHeaders ?? {})) {
                                res.setHeader(key, value);
                            }
                        }
                    }
                }
            );


        } catch (e) {
            console.error("Error initialising supabase authentication client", e);
            return null;
        }
    }
}