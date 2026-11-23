#!/usr/bin/env node
// Generated from src/scripts/photos.ts by `npm run build`. Edit the TypeScript, not this file.
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_COUNT = exports.MIN_LONG_SIDE = void 0;
exports.parseArgs = parseArgs;
exports.openverseUrl = openverseUrl;
exports.commonsUrl = commonsUrl;
exports.licenceAllowed = licenceAllowed;
exports.openverseLicenceName = openverseLicenceName;
exports.plainText = plainText;
exports.parseOpenverse = parseOpenverse;
exports.parseCommons = parseCommons;
exports.orientationOf = orientationOf;
exports.rejectReason = rejectReason;
exports.interleave = interleave;
exports.slug = slug;
exports.extensionFor = extensionFor;
exports.fileNameFor = fileNameFor;
exports.imageSize = imageSize;
exports.mergeCredits = mergeCredits;
exports.describeError = describeError;
exports.main = main;
/*
 * Argus photo search. Finds free-licence photographs for a page and downloads
 * candidates to look at, with a credits file recording where each came from.
 *
 * This is the one Argus tool that uses the network, and only when you run it.
 * It asks two free-licence sources that need no account or key, Openverse
 * (api.openverse.org) and Wikimedia Commons (commons.wikimedia.org), and
 * downloads the image files they point to. It sends only the search words.
 * The installer and every other tool make no network calls.
 *
 * Usage:
 *   node photos.js "<search words>" [--count N] [--out DIR] [--orientation landscape|portrait|square] [--json]
 *
 *   --count N        how many candidates to download (default 8, at most 20)
 *   --out DIR        where to save them (default: ./photos-candidates)
 *   --orientation    keep only landscape, portrait or square pictures
 *   --json           print the result as JSON instead of a table
 *
 * It keeps only pictures whose licence allows commercial use and changes (CC0,
 * public domain, CC BY, CC BY-SA), skips anything under about 1200px on the
 * long side when the size is known, and writes credits.json beside the files:
 * title, author, source page, licence and licence address for each.
 * Every candidate must still be looked at before it is used.
 *
 * Exit codes: 0 when at least one picture was saved, 1 for a usage error,
 * 2 when nothing could be downloaded (no results, or no network).
 * Needs Node 22 or later.
 */
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const node_crypto_1 = require("node:crypto");
exports.MIN_LONG_SIDE = 1200;
exports.MAX_COUNT = 20;
const MAX_BYTES = 30 * 1024 * 1024;
const SEARCH_TIMEOUT_MS = 20000;
const DOWNLOAD_TIMEOUT_MS = 45000;
const USER_AGENT = 'argus-skill-photos (free-licence image search for a design skill; https://www.npmjs.com/package/argus-skill)';
function parseArgs(argv) {
    const o = { query: null, count: 8, out: 'photos-candidates', orientation: null, json: false, help: false, bad: [] };
    const words = [];
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] ?? '';
        if (a === '--count' || a === '-n') {
            const n = Number(argv[++i]);
            if (Number.isFinite(n) && n >= 1)
                o.count = Math.min(exports.MAX_COUNT, Math.floor(n));
            else
                o.bad.push('--count ' + String(argv[i] ?? ''));
        }
        else if (a === '--out') {
            const dir = argv[++i];
            if (dir)
                o.out = dir;
            else
                o.bad.push('--out');
        }
        else if (a === '--orientation') {
            const v = String(argv[++i] ?? '').toLowerCase();
            if (v === 'landscape' || v === 'portrait' || v === 'square')
                o.orientation = v;
            else
                o.bad.push('--orientation ' + v);
        }
        else if (a === '--json')
            o.json = true;
        else if (a === '--help' || a === '-h')
            o.help = true;
        else if (a.startsWith('-'))
            o.bad.push(a);
        else
            words.push(a);
    }
    const q = words.join(' ').replace(/\s+/g, ' ').trim();
    o.query = q || null;
    return o;
}
/** Openverse search, limited to licences that allow commercial use and changes. */
function openverseUrl(query, orientation) {
    const p = new URLSearchParams({ q: query, license_type: 'commercial,modification', page_size: '20', mature: 'false' });
    const aspect = orientation === 'landscape' ? 'wide' : orientation === 'portrait' ? 'tall' : orientation === 'square' ? 'square' : null;
    if (aspect)
        p.set('aspect_ratio', aspect);
    return 'https://api.openverse.org/v1/images/?' + p.toString();
}
/** Wikimedia Commons search over the File namespace, bitmaps only, with licence and author metadata. */
function commonsUrl(query) {
    const p = new URLSearchParams({
        action: 'query',
        format: 'json',
        generator: 'search',
        gsrsearch: query + ' filetype:bitmap',
        gsrnamespace: '6',
        gsrlimit: '30',
        prop: 'imageinfo',
        iiprop: 'url|size|mime|extmetadata',
        // A scaled copy about 1920px wide: enough for a full-width picture, far lighter than most originals.
        iiurlwidth: '1920',
        iiextmetadatafilter: 'ObjectName|Artist|Credit|LicenseShortName|License|LicenseUrl|UsageTerms',
        origin: '*',
    });
    return 'https://commons.wikimedia.org/w/api.php?' + p.toString();
}
/**
 * Whether a licence clearly allows commercial use and changes. Accepts CC0,
 * public domain and CC BY / CC BY-SA in any version; refuses NC, ND, anything
 * unknown and anything missing.
 */
function licenceAllowed(raw) {
    const s = String(raw ?? '').toLowerCase().replace(/[_\s]+/g, '-').trim();
    if (!s)
        return false;
    if (/(^|-)n[cd](-|$)/.test(s) || s.includes('noncommercial') || s.includes('noderiv'))
        return false;
    if (/^(cc0|cc-zero|cc-0)(-|$)/.test(s))
        return true;
    if (/^(pd|pdm|public-domain|publicdomain)(-|$)/.test(s))
        return true;
    if (/^(cc-)?by(-sa)?(-\d(\.\d)?)?(-[a-z]{2})?$/.test(s))
        return true;
    return false;
}
/** A readable licence name from an Openverse code and version. */
function openverseLicenceName(code, version) {
    const c = code.toLowerCase();
    const v = version ? ' ' + version : '';
    if (c === 'cc0')
        return 'CC0' + v;
    if (c === 'pdm')
        return 'Public Domain Mark' + v;
    return 'CC ' + c.toUpperCase() + v;
}
/** Strip HTML tags and entities from Commons metadata, which is HTML. */
function plainText(html) {
    return String(html ?? '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;|&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
}
const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
const str = (v) => (typeof v === 'string' ? v : '');
const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
/** Turn an Openverse search response into candidates. Never throws on a bad result: it is skipped with a reason. */
function parseOpenverse(body) {
    const out = { candidates: [], skipped: [] };
    const results = isObject(body) && Array.isArray(body['results']) ? body['results'] : null;
    if (!results) {
        out.skipped.push('openverse: the response had no results list');
        return out;
    }
    for (const r of results) {
        if (!isObject(r)) {
            out.skipped.push('openverse: a result that was not an object');
            continue;
        }
        const title = plainText(str(r['title'])) || 'Untitled';
        const code = str(r['license']);
        const imageUrl = str(r['url']);
        const pageUrl = str(r['foreign_landing_url']) || str(r['detail_url']);
        if (!imageUrl || !/^https:\/\//.test(imageUrl)) {
            out.skipped.push(`openverse: "${title}" has no image address`);
            continue;
        }
        if (!licenceAllowed(code)) {
            out.skipped.push(`openverse: "${title}" licence is missing or not clearly reusable (${code || 'none'})`);
            continue;
        }
        if (!pageUrl) {
            out.skipped.push(`openverse: "${title}" has no source page to credit`);
            continue;
        }
        out.candidates.push({
            source: 'openverse',
            title,
            author: plainText(str(r['creator'])) || 'Unknown',
            pageUrl,
            imageUrl,
            licence: openverseLicenceName(code, str(r['license_version']) || null),
            licenceUrl: str(r['license_url']),
            width: num(r['width']),
            height: num(r['height']),
        });
    }
    return out;
}
/** Turn a Wikimedia Commons query response into candidates, in search order. */
function parseCommons(body) {
    const out = { candidates: [], skipped: [] };
    const query = isObject(body) ? body['query'] : null;
    const pages = isObject(query) ? query['pages'] : null;
    if (!isObject(pages)) {
        // An answer with no pages is how the API says "no matches"; anything else is a bad response.
        if (!isObject(body) || 'error' in body)
            out.skipped.push('wikimedia: the response had no pages');
        return out;
    }
    const list = Object.values(pages)
        .filter(isObject)
        .sort((a, b) => (num(a['index']) ?? 0) - (num(b['index']) ?? 0));
    for (const page of list) {
        const fileTitle = str(page['title']);
        const info = Array.isArray(page['imageinfo']) ? page['imageinfo'][0] : null;
        if (!isObject(info)) {
            out.skipped.push(`wikimedia: "${fileTitle}" has no image information`);
            continue;
        }
        const meta = isObject(info['extmetadata']) ? info['extmetadata'] : {};
        const field = (name) => {
            const f = meta[name];
            return isObject(f) ? str(f['value']) : '';
        };
        const title = plainText(field('ObjectName')) || fileTitle.replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '') || 'Untitled';
        const mime = str(info['mime']);
        if (mime && !/^image\/(jpeg|png|webp)$/.test(mime)) {
            out.skipped.push(`wikimedia: "${title}" is ${mime}, not a photograph format`);
            continue;
        }
        const code = field('License') || field('LicenseShortName');
        if (!licenceAllowed(code) && !licenceAllowed(field('LicenseShortName'))) {
            out.skipped.push(`wikimedia: "${title}" licence is missing or not clearly reusable (${plainText(field('LicenseShortName')) || code || 'none'})`);
            continue;
        }
        const imageUrl = str(info['thumburl']) || str(info['url']);
        const pageUrl = str(info['descriptionurl']);
        if (!imageUrl || !pageUrl) {
            out.skipped.push(`wikimedia: "${title}" has no image or source page address`);
            continue;
        }
        // The size of the file that will be downloaded: the scaled copy when there is one.
        const thumbW = num(info['thumbwidth']);
        const thumbH = num(info['thumbheight']);
        const hasThumb = !!str(info['thumburl']) && thumbW && thumbH;
        out.candidates.push({
            source: 'wikimedia',
            title,
            author: plainText(field('Artist')) || plainText(field('Credit')) || 'Unknown',
            pageUrl,
            imageUrl,
            licence: plainText(field('LicenseShortName')) || code,
            licenceUrl: field('LicenseUrl'),
            width: hasThumb ? thumbW : num(info['width']),
            height: hasThumb ? thumbH : num(info['height']),
        });
    }
    return out;
}
function orientationOf(width, height) {
    const r = width / height;
    if (r > 1.1)
        return 'landscape';
    if (r < 0.9)
        return 'portrait';
    return 'square';
}
/** Why a candidate should be left out, or null to keep it. Size and shape count only when known. */
function rejectReason(c, orientation) {
    if (c.width && c.height) {
        const long = Math.max(c.width, c.height);
        if (long < exports.MIN_LONG_SIDE)
            return `too small (${c.width}x${c.height}, under ${exports.MIN_LONG_SIDE}px on the long side)`;
        if (orientation && orientationOf(c.width, c.height) !== orientation)
            return `${orientationOf(c.width, c.height)}, not ${orientation}`;
    }
    return null;
}
/** Take candidates from each source in turn, so one source does not crowd out the other, and drop repeats. */
function interleave(...lists) {
    const out = [];
    const seen = new Set();
    const longest = Math.max(0, ...lists.map((l) => l.length));
    for (let i = 0; i < longest; i++) {
        for (const list of lists) {
            const c = list[i];
            if (!c)
                continue;
            const key = c.imageUrl.split('?')[0] ?? c.imageUrl;
            if (seen.has(key))
                continue;
            seen.add(key);
            out.push(c);
        }
    }
    return out;
}
function slug(s, max = 40) {
    const out = s
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, max)
        .replace(/-+$/g, '');
    return out || 'photo';
}
/** File extension from an address or a content type; null for formats that are not photographs. */
function extensionFor(url, contentType) {
    const type = String(contentType ?? '').toLowerCase();
    if (type.includes('jpeg') || type.includes('jpg'))
        return 'jpg';
    if (type.includes('png'))
        return 'png';
    if (type.includes('webp'))
        return 'webp';
    if (type && type.startsWith('image/'))
        return null;
    const m = /\.([a-z0-9]{3,4})(?:$|[?#])/i.exec(url);
    const ext = m?.[1]?.toLowerCase();
    if (ext === 'jpg' || ext === 'jpeg')
        return 'jpg';
    if (ext === 'png' || ext === 'webp')
        return ext;
    return type ? null : 'jpg';
}
/** A stable, readable file name: the search, the title and a short hash of the address. */
function fileNameFor(c, query, ext) {
    const hash = (0, node_crypto_1.createHash)('sha1').update(c.imageUrl).digest('hex').slice(0, 6);
    return `${slug(query, 24)}-${slug(c.title, 40)}-${hash}.${ext}`;
}
/** Width and height read from the start of a JPEG, PNG or WebP file, or null. */
function imageSize(buf) {
    const b = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
    if (b.length >= 24 && b.readUInt32BE(0) === 0x89504e47)
        return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
    if (b.length >= 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
        const kind = b.toString('ascii', 12, 16);
        if (kind === 'VP8X')
            return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
        if (kind === 'VP8 ')
            return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
        if (kind === 'VP8L') {
            const bits = b.readUInt32LE(21);
            return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
        }
        return null;
    }
    if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
        let i = 2;
        while (i + 8 < b.length) {
            if (b[i] !== 0xff) {
                i++;
                continue;
            }
            const marker = b[i + 1] ?? 0;
            if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0xff) {
                i += marker === 0xff ? 1 : 2;
                continue;
            }
            const len = b.readUInt16BE(i + 2);
            const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
            if (isFrame)
                return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
            i += 2 + len;
        }
    }
    return null;
}
/** Merge new credits into an existing list, replacing entries for the same file. */
function mergeCredits(existing, added) {
    const old = Array.isArray(existing) ? existing.filter((e) => isObject(e) && typeof e['file'] === 'string') : [];
    const names = new Set(added.map((c) => c.file));
    return [...old.filter((c) => !names.has(c.file)), ...added];
}
/** The plain-words explanation for a failed request. */
function describeError(err) {
    const e = err;
    const code = e?.cause?.code ?? '';
    if (e?.name === 'TimeoutError' || e?.name === 'AbortError')
        return 'it took too long to answer';
    if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ENETUNREACH|EHOSTUNREACH|UND_ERR_CONNECT/.test(code))
        return 'it could not be reached (' + code + ')';
    return e?.cause?.message ?? e?.message ?? String(err);
}
function isNetworkFailure(reason) {
    return /could not be reached|took too long|fetch failed/.test(reason);
}
async function getJson(url) {
    for (let attempt = 1;; attempt++) {
        const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS) });
        if (res.ok)
            return res.json();
        // A busy server (5xx) gets one more try after a short pause; anything else is final.
        if (res.status < 500 || attempt >= 2)
            throw new Error('it answered ' + res.status + ' ' + res.statusText);
        await new Promise((r) => setTimeout(r, 1500));
    }
}
async function download(c, query, dir, orientation) {
    const res = await fetch(c.imageUrl, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow', signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
    if (!res.ok)
        return `the file answered ${res.status}`;
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > MAX_BYTES)
        return `the file is too large (${Math.round(declared / 1048576)} MB)`;
    const ext = extensionFor(c.imageUrl, res.headers.get('content-type'));
    if (!ext)
        return `not a JPEG, PNG or WebP file (${res.headers.get('content-type') ?? 'unknown type'})`;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES)
        return `the file is too large (${Math.round(buf.byteLength / 1048576)} MB)`;
    const size = imageSize(buf);
    if (!size)
        return 'the file could not be read as an image';
    const reason = rejectReason(size, orientation);
    if (reason)
        return reason;
    const file = fileNameFor(c, query, ext);
    fs.writeFileSync(path.join(dir, file), buf);
    return {
        bytes: buf.byteLength,
        credit: {
            file,
            title: c.title,
            author: c.author,
            source: c.source,
            sourcePage: c.pageUrl,
            licence: c.licence,
            licenceUrl: c.licenceUrl,
            width: size.width,
            height: size.height,
            search: query,
        },
    };
}
/** Fit text to a column of n characters, always leaving a space before the next column. */
const clip = (s, n) => (s.length > n - 1 ? s.slice(0, n - 2) + '~' : s).padEnd(n);
function usage() {
    console.log([
        'Usage: node photos.js "<search words>" [--count N] [--out DIR] [--orientation landscape|portrait|square] [--json]',
        '',
        'Searches Openverse and Wikimedia Commons for free-licence photographs (CC0, public domain,',
        'CC BY, CC BY-SA), downloads up to N candidates (default 8, at most 20) into DIR',
        '(default ./photos-candidates) and writes credits.json beside them.',
        '',
        'This is the one Argus tool that uses the network, and only when you run it. It sends',
        'only the search words. Look at every picture before using any of them.',
    ].join('\n'));
}
async function main(argv) {
    const o = parseArgs(argv);
    if (o.help) {
        usage();
        return 0;
    }
    if (o.bad.length || !o.query) {
        if (o.bad.length)
            console.log('Not understood: ' + o.bad.join(' ') + '\n');
        usage();
        return 1;
    }
    if (typeof fetch !== 'function') {
        console.log('This needs Node 22 or later (you have ' + process.version + ').');
        return 2;
    }
    const query = o.query;
    const notes = [];
    const unreachable = [];
    const searches = [
        ['openverse', openverseUrl(query, o.orientation), parseOpenverse],
        ['wikimedia', commonsUrl(query), parseCommons],
    ];
    const found = await Promise.all(searches.map(async ([name, url, parse]) => {
        try {
            const parsed = parse(await getJson(url));
            notes.push(...parsed.skipped);
            return parsed.candidates;
        }
        catch (err) {
            const reason = describeError(err);
            notes.push(`${name}: search failed, ${reason}`);
            if (isNetworkFailure(reason))
                unreachable.push(name);
            return [];
        }
    }));
    if (unreachable.length === searches.length) {
        console.log('Could not reach Openverse or Wikimedia Commons. The network seems to be unavailable here.');
        console.log('Nothing was downloaded. Ask the user to supply photographs, or use the next rung of the ladder in imagery.md.');
        return 2;
    }
    const pool = [];
    for (const c of interleave(...found)) {
        const reason = rejectReason(c, o.orientation);
        if (reason)
            notes.push(`${c.source}: "${c.title}" skipped, ${reason}`);
        else
            pool.push(c);
    }
    fs.mkdirSync(o.out, { recursive: true });
    const saved = [];
    for (const c of pool) {
        if (saved.length >= o.count)
            break;
        try {
            const result = await download(c, query, o.out, o.orientation);
            if (typeof result === 'string')
                notes.push(`${c.source}: "${c.title}" skipped, ${result}`);
            else
                saved.push(result);
        }
        catch (err) {
            notes.push(`${c.source}: "${c.title}" skipped, ${describeError(err)}`);
        }
    }
    let creditsFile = null;
    if (saved.length) {
        creditsFile = path.join(o.out, 'credits.json');
        let existing = [];
        try {
            existing = JSON.parse(fs.readFileSync(creditsFile, 'utf8'));
        }
        catch {
            /* none yet, or unreadable: start a new one */
        }
        fs.writeFileSync(creditsFile, JSON.stringify(mergeCredits(existing, saved.map((s) => s.credit)), null, 2) + '\n');
    }
    if (o.json) {
        console.log(JSON.stringify({ search: query, dir: path.resolve(o.out), saved: saved.map((s) => ({ ...s.credit, bytes: s.bytes })), skipped: notes }, null, 2));
    }
    else {
        console.log(`Search: "${query}"  ${found[0]?.length ?? 0} from Openverse, ${found[1]?.length ?? 0} from Wikimedia Commons with a reusable licence`);
        if (saved.length) {
            console.log('');
            console.log('  ' + clip('file', 56) + clip('size', 11) + clip('licence', 16) + 'author');
            for (const s of saved) {
                const c = s.credit;
                const mb = s.bytes > 4 * 1048576 ? `  (${(s.bytes / 1048576).toFixed(1)} MB, resize before use)` : '';
                console.log('  ' + clip(c.file, 56) + clip(`${c.width}x${c.height}`, 11) + clip(c.licence, 16) + clip(c.author, 28) + mb);
            }
        }
        if (notes.length) {
            console.log(`\nLeft out ${notes.length}:`);
            for (const n of notes.slice(0, 12))
                console.log('  ' + (n.length > 150 ? n.slice(0, 147) + '...' : n));
            if (notes.length > 12)
                console.log(`  ...and ${notes.length - 12} more (--json lists them all)`);
        }
        if (saved.length) {
            console.log(`\nSaved ${saved.length} of ${o.count} asked for in ${path.resolve(o.out)}; credits in ${creditsFile}.`);
            console.log('Open and look at every one. Keep only those that fit the subject and the direction, and credit them as their licence requires.');
        }
    }
    if (!saved.length) {
        console.log('Nothing could be downloaded for this search. Try other words (the thing itself, not a mood), or a different orientation.');
        return 2;
    }
    return 0;
}
if (require.main === module) {
    main(process.argv.slice(2)).then((code) => process.exit(code), (err) => {
        console.log('Unexpected error: ' + (err instanceof Error ? err.message : String(err)));
        process.exit(2);
    });
}
