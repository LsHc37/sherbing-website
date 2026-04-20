import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { hostname } from "node:os";
import { createServer } from "node:http";
import { Buffer } from "node:buffer";
import express from "express";
import basicAuth from "express-basic-auth";
import wisp from "wisp-server-node";

import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

const app = express();
const adminPassword = process.env.ADMIN_PASSWORD || "change-me";
const storageRoot = join(process.cwd(), "storage");

const requireLucasAuth = basicAuth({
	users: { lucas: adminPassword },
	challenge: true,
	unauthorizedResponse: "Admin credentials are required.",
});

function isLucasAuthenticated(req) {
	const authHeader = req.headers.authorization;
	if (!authHeader || !authHeader.startsWith("Basic ")) {
		return false;
	}

	const encodedCredentials = authHeader.slice(6).trim();
	let decodedCredentials = "";

	try {
		decodedCredentials = Buffer.from(encodedCredentials, "base64").toString("utf8");
	} catch {
		return false;
	}

	const separatorIndex = decodedCredentials.indexOf(":");
	if (separatorIndex === -1) {
		return false;
	}

	const username = decodedCredentials.slice(0, separatorIndex);
	const password = decodedCredentials.slice(separatorIndex + 1);

	return (
		basicAuth.safeCompare(username, "lucas") &&
		basicAuth.safeCompare(password, adminPassword)
	);
}

function resolveStoragePath(relativePath) {
	const normalizedRelativePath = (relativePath || "").replace(/^\/+/, "");
	const absolutePath = resolve(storageRoot, normalizedRelativePath);

	if (absolutePath === storageRoot || absolutePath.startsWith(`${storageRoot}${sep}`)) {
		return absolutePath;
	}

	return null;
}

async function streamLargeStorageFile(req, res) {
	const relativePath = decodeURIComponent(req.params[0] || "");
	const absolutePath = resolveStoragePath(relativePath);

	if (!absolutePath) {
		res.status(403).send("Forbidden path.");
		return;
	}

	let fileStats;
	try {
		fileStats = await stat(absolutePath);
	} catch {
		res.status(404).send("Storage file not found.");
		return;
	}

	if (!fileStats.isFile()) {
		res.status(404).send("Storage file not found.");
		return;
	}

	const totalSize = fileStats.size;
	const extension = extname(absolutePath).toLowerCase();
	const contentType = extension === ".iso" ? "application/x-iso9660-image" : "application/octet-stream";

	res.setHeader("Content-Type", contentType);
	res.setHeader("Accept-Ranges", "bytes");
	res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");

	const rangeHeader = req.headers.range;
	if (!rangeHeader) {
		res.status(200);
		res.setHeader("Content-Length", totalSize);

		if (req.method === "HEAD") {
			res.end();
			return;
		}

		createReadStream(absolutePath).pipe(res);
		return;
	}

	const rangeMatch = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
	if (!rangeMatch) {
		res.status(416);
		res.setHeader("Content-Range", `bytes */${totalSize}`);
		res.end();
		return;
	}

	let start = rangeMatch[1] ? Number.parseInt(rangeMatch[1], 10) : 0;
	let end = rangeMatch[2] ? Number.parseInt(rangeMatch[2], 10) : totalSize - 1;

	if (
		Number.isNaN(start) ||
		Number.isNaN(end) ||
		start < 0 ||
		start >= totalSize ||
		end < start
	) {
		res.status(416);
		res.setHeader("Content-Range", `bytes */${totalSize}`);
		res.end();
		return;
	}

	if (end >= totalSize) {
		end = totalSize - 1;
	}

	const chunkSize = end - start + 1;

	res.status(206);
	res.setHeader("Content-Range", `bytes ${start}-${end}/${totalSize}`);
	res.setHeader("Content-Length", chunkSize);

	if (req.method === "HEAD") {
		res.end();
		return;
	}

	createReadStream(absolutePath, { start, end }).pipe(res);
}

// Load our publicPath first and prioritize it over UV.
app.use(express.static("./public"));
app.use("/admin", requireLucasAuth, express.static(join(process.cwd(), "public", "admin")));

// Gate game assets and v86 artifacts behind admin auth.
app.use("/storage", requireLucasAuth);
app.get(/^\/storage\/(.+\.(?:img|iso))$/i, streamLargeStorageFile);
app.head(/^\/storage\/(.+\.(?:img|iso))$/i, streamLargeStorageFile);
app.use("/storage", express.static(storageRoot, { acceptRanges: true }));

// Gate all unrestricted proxy assets behind authenticated access.
app.use(["/uv/", "/epoxy/", "/baremux/"], requireLucasAuth);
// Load vendor files last.
// The vendor's uv.config.js won't conflict with our uv.config.js inside the publicPath directory.
app.use("/uv/", express.static(uvPath));
app.use("/epoxy/", express.static(epoxyPath));
app.use("/baremux/", express.static(baremuxPath));

// Error for everything else
app.use((req, res) => {
	res.status(404);
	res.sendFile("./public/404.html");
});

const server = createServer();

server.on("request", (req, res) => {
	res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
	res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
	app(req, res);
});
server.on("upgrade", (req, socket, head) => {
	const requestUrl = req.url || "";

	if (requestUrl.endsWith("/wisp/")) {
		if (!isLucasAuthenticated(req)) {
			socket.write("HTTP/1.1 401 Unauthorized\\r\\nWWW-Authenticate: Basic realm=\"Admin Portal\"\\r\\n\\r\\n");
			socket.end();
			return;
		}
		wisp.routeRequest(req, socket, head);
		return;
	} 
	socket.end();
});

let port = parseInt(process.env.PORT || "");

if (isNaN(port)) port = 8080;

server.on("listening", () => {
	const address = server.address();

	// by default we are listening on 0.0.0.0 (every interface)
	// we just need to list a few
	console.log("Listening on:");
	console.log(`\thttp://localhost:${address.port}`);
	console.log(`\thttp://${hostname()}:${address.port}`);
	console.log(
		`\thttp://${
			address.family === "IPv6" ? `[${address.address}]` : address.address
		}:${address.port}`
	);
});

// https://expressjs.com/en/advanced/healthcheck-graceful-shutdown.html
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown() {
	console.log("SIGTERM signal received: closing HTTP server");
	server.close();
	process.exit(0);
}

server.listen({
	port,
});
