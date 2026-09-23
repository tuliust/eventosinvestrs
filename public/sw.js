const buildParam = new URL(self.location.href).searchParams.get("build") || "default"
const buildKey = buildParam.replace(/[^a-zA-Z0-9_-]/g, "").slice(-48) || "default"
const CACHE_NAME = `invest-rs-shell-${buildKey}`
const CORE = [
  "/",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/favicon.png",
]

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME)
  const response = await fetch("/", { cache: "no-store" })
  if (response.ok) {
    await cache.put("/", response.clone())
    const html = await response.text()
    const assets = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
      .map((match) => match[1])
      .filter((url) => url.startsWith("/") && !url.startsWith("/sw.js"))
    await Promise.allSettled([...new Set([...CORE.slice(1), ...assets])].map((url) => cache.add(url)))
  } else {
    await cache.addAll(CORE)
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheAppShell())
})

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter((name) => name.startsWith("invest-rs-shell-") && name !== CACHE_NAME).map((name) => caches.delete(name)))
    await self.clients.claim()
  })())
})

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting()
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname === "/sw.js") return

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const network = await fetch(request)
        if (network.ok) {
          const cache = await caches.open(CACHE_NAME)
          await cache.put("/", network.clone())
        }
        return network
      } catch {
        return (await caches.match("/")) || Response.error()
      }
    })())
    return
  }

  if (url.pathname.startsWith("/assets/") || CORE.includes(url.pathname)) {
    event.respondWith((async () => {
      const cached = await caches.match(request)
      if (cached) {
        event.waitUntil(fetch(request).then(async (network) => {
          if (network.ok) {
            const cache = await caches.open(CACHE_NAME)
            await cache.put(request, network.clone())
          }
        }).catch(() => {}))
        return cached
      }
      try {
        const network = await fetch(request)
        if (network.ok) {
          const cache = await caches.open(CACHE_NAME)
          await cache.put(request, network.clone())
        }
        return network
      } catch {
        return Response.error()
      }
    })())
  }
})
