import {createClient} from "@supabase/supabase-js";
import {createServerClient, parseCookieHeader, serializeCookieHeader} from "@supabase/ssr";
import cookies from "express/lib/application.js";
import {config} from "../config/var.js";

export class AuthenticatorService {

     API_KEY;
     URL;
    constructor(api_key, url) {
        this.API_KEY = api_key
        this.URL = url;
    }

     getClient(req, res) {
        console.log("Initialising Get client in AuthenticationService class.");
            const cookies = new Map(
                parseCookieHeader(req.headers.cookie ?? '')
                    .map(({ name, value }) => [name, value])
            );

            return  createServerClient(
                this.URL,
                this.API_KEY,
                {
                    cookieOptions: {
                        path: '/',
                        sameSite: 'lax',
                        secure: config.env.isProduction,
                        httpOnly: true
                    },
                    cookies: {
                        getAll() {
                            let parsedHeaders = parseCookieHeader(req.get('Cookie') ?? "");

                            return parsedHeaders.map((value) => {
                              return {
                                  name: value.name,
                                  value: value.value
                              }
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
                                        secure: config.env.isProduction,
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
    }
}