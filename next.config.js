/** @type {import('next').NextConfig} */
module.exports = {
  // Keep verification builds separate when a development server is running.
  distDir: process.env.SKILLBARTER_UX_CHECK === "1" ? ".next-ux-check" : ".next",
};
