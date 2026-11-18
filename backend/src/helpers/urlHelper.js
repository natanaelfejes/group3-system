import * as url from "node:url";

export function fullUrl(req) {
    return url.format({
        protocol: req.protocol,
        host: req.get('host'),
        pathname: req.originalUrl
    });
}

export function urlNoPath(req) {
    return url.format({
        protocol: req.protoc,
        host: req.get('host'),
    });
}
