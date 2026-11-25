/** @type {import('next').NextConfig} */
module.exports = {
  // Keep verification builds separate when a development server is running.
  distDir: process.env.SKILLBARTER_UX_CHECK === "1" ? ".next-ux-check" : ".next",
  async headers() {
    return [{ source: "/auth/callback", headers: [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
      { key: "Cache-Control", value: "private, no-store" },
    ] }];
  },
};
